from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import InventoryBulkReplace, InventoryItem

router = APIRouter(prefix="/inventory", tags=["inventory"])

KIND_LABELS = {
    "farmacia": "Farmácia",
    "semen": "Sêmen e Embriões",
    "nutricional": "Nutrição",
}


def _normalize_kind(raw: Optional[str]) -> str:
    txt = str(raw or "").strip().lower()
    aliases = {
        "farmacia": "farmacia",
        "farmácia": "farmacia",
        "semen": "semen",
        "sêmen": "semen",
        "semen": "semen",
        "semen e embrioes": "semen",
        "sêmen e embriões": "semen",
        "nutricional": "nutricional",
        "nutricao": "nutricional",
        "nutrição": "nutricional",
    }
    if txt in aliases:
        return aliases[txt]
    raise HTTPException(status_code=400, detail="Tipo de inventário inválido.")


def _item_to_dict(item: InventoryItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "kind": item.kind,
        "name": item.name,
        "item_type": item.item_type,
        "manufacturer": item.manufacturer,
        "quantity": float(item.quantity or 0.0),
        "unit": item.unit,
        "unit_price_brl": float(item.unit_price_brl or 0.0),
        "batch": item.batch,
        "expires_on": item.expires_on,
        "location": item.location,
        "property_name": item.property_name,
        "last_movement_at": item.last_movement_at,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/items")
def list_inventory_items(
    kind: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(InventoryItem)
    if kind:
        stmt = stmt.where(InventoryItem.kind == _normalize_kind(kind))
    stmt = stmt.order_by(InventoryItem.kind, InventoryItem.name)
    rows = session.exec(stmt).all()
    return [_item_to_dict(row) for row in rows]


@router.put("/items/bulk/{kind}")
def replace_inventory_items(
    kind: str,
    payload: InventoryBulkReplace,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    canonical = _normalize_kind(kind)
    existing = session.exec(select(InventoryItem).where(InventoryItem.kind == canonical)).all()
    for row in existing:
        session.delete(row)
    session.commit()

    created: List[InventoryItem] = []
    now = datetime.utcnow()
    for item in payload.items or []:
        name = str(item.name or "").strip()
        if not name:
            continue
        obj = InventoryItem(
            kind=canonical,
            name=name,
            item_type=str(item.item_type or "").strip(),
            manufacturer=str(item.manufacturer or "").strip(),
            quantity=float(item.quantity or 0.0),
            unit=str(item.unit or "un").strip() or "un",
            unit_price_brl=float(item.unit_price_brl or 0.0),
            batch=str(item.batch or "").strip(),
            expires_on=str(item.expires_on or "").strip(),
            location=str(item.location or "").strip(),
            property_name=str(item.property_name or "").strip(),
            last_movement_at=str(item.last_movement_at or "").strip(),
            updated_at=now,
        )
        session.add(obj)
        created.append(obj)

    session.commit()
    for row in created:
        session.refresh(row)

    return {
        "kind": canonical,
        "label": KIND_LABELS.get(canonical, canonical.title()),
        "items": [_item_to_dict(row) for row in created],
        "total_items": len(created),
    }


@router.get("/alerts")
def inventory_alerts(
    limit_per_kind: int = Query(default=2, ge=1, le=10),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    rows = session.exec(select(InventoryItem).order_by(InventoryItem.kind, InventoryItem.name)).all()
    by_kind: Dict[str, List[InventoryItem]] = {key: [] for key in KIND_LABELS}
    for row in rows:
        kind = _normalize_kind(row.kind)
        by_kind.setdefault(kind, []).append(row)

    alerts: List[Dict[str, Any]] = []
    summaries: List[Dict[str, Any]] = []
    total_items = 0

    for kind, label in KIND_LABELS.items():
        items = by_kind.get(kind, [])
        total_items += len(items)
        low_or_zero = [row for row in items if float(row.quantity or 0.0) <= 0]
        low_or_zero.sort(key=lambda row: (float(row.quantity or 0.0), str(row.name or "").lower()))
        total_value = sum(max(0.0, float(row.quantity or 0.0)) * max(0.0, float(row.unit_price_brl or 0.0)) for row in items)

        summaries.append(
            {
                "kind": kind,
                "label": label,
                "total_items": len(items),
                "low_or_zero_items": len(low_or_zero),
                "total_quantity": round(sum(float(row.quantity or 0.0) for row in items), 2),
                "total_value_brl": round(total_value, 2),
            }
        )

        for row in low_or_zero[:limit_per_kind]:
            alerts.append(
                {
                    "kind": kind,
                    "section": label,
                    "name": row.name,
                    "qty": round(float(row.quantity or 0.0), 2),
                    "unit": row.unit or "un",
                    "local": row.location or "Sem local",
                    "property_name": row.property_name or "Fazenda da Estrela",
                }
            )

    return {
        "alerts": alerts,
        "kinds": summaries,
        "total_items": total_items,
        "generated_at": datetime.utcnow().isoformat(),
    }
