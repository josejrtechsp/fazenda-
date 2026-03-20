from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import CostCenter, CostCenterCreate, CostCenterUpdate

router = APIRouter(prefix="/cost-centers", tags=["cost_centers"])


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _serialize(obj: CostCenter) -> Dict[str, Any]:
    return {
        "id": obj.id,
        "code": obj.code,
        "name": obj.name,
        "parent_id": obj.parent_id,
        "is_active": obj.is_active,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


@router.get("")
def list_cost_centers(
    q: Optional[str] = None,
    parent_id: Optional[int] = None,
    include_inactive: bool = False,
    limit: int = Query(default=400, ge=1, le=4000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(CostCenter)
    if not include_inactive:
        stmt = stmt.where(CostCenter.is_active == True)  # noqa
    if parent_id is not None:
        stmt = stmt.where(CostCenter.parent_id == int(parent_id))

    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: (str(r.code or "").lower(), str(r.name or "").lower(), int(r.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [r for r in rows if nq in _norm_text(r.code) or nq in _norm_text(r.name)]

    return [_serialize(r) for r in rows[:limit]]


@router.post("")
def create_cost_center(payload: CostCenterCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    code = str(payload.code or "").strip().upper()
    name = str(payload.name or "").strip()
    if not code:
        raise HTTPException(status_code=422, detail="codigo do centro de custo e obrigatorio")
    if not name:
        raise HTTPException(status_code=422, detail="nome do centro de custo e obrigatorio")

    exists = session.exec(select(CostCenter).where(CostCenter.code == code).limit(1)).first()
    if exists:
        raise HTTPException(status_code=422, detail="codigo de centro de custo ja existe")

    obj = CostCenter(
        code=code,
        name=name,
        parent_id=payload.parent_id,
        is_active=bool(payload.is_active if payload.is_active is not None else True),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)


@router.patch("/{cost_center_id}")
def update_cost_center(cost_center_id: int, patch: CostCenterUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    obj = session.get(CostCenter, int(cost_center_id))
    if not obj:
        raise HTTPException(status_code=404, detail="centro de custo nao encontrado")

    data = patch.model_dump(exclude_unset=True)
    if "code" in data:
        code = str(data.get("code") or "").strip().upper()
        if not code:
            raise HTTPException(status_code=422, detail="codigo do centro de custo nao pode ser vazio")
        exists = session.exec(select(CostCenter).where(CostCenter.code == code).limit(1)).first()
        if exists and int(exists.id or 0) != int(obj.id or 0):
            raise HTTPException(status_code=422, detail="codigo de centro de custo ja existe")
        obj.code = code

    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="nome do centro de custo nao pode ser vazio")
        obj.name = name

    if "parent_id" in data:
        obj.parent_id = data.get("parent_id")
    if "is_active" in data:
        obj.is_active = bool(data.get("is_active"))

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)


@router.post("/seed-defaults")
def seed_default_cost_centers(session: Session = Depends(get_session)) -> Dict[str, Any]:
    defaults = [
        ("PEC-CRIA", "Pecuaria - Cria"),
        ("PEC-RECRIA", "Pecuaria - Recria"),
        ("PEC-ENGORDA", "Pecuaria - Engorda"),
        ("AGRI-SOJA", "Agricultura - Soja"),
        ("AGRI-MILHO", "Agricultura - Milho"),
        ("SILVICULTURA", "Silvicultura"),
        ("ADMIN", "Administracao"),
    ]
    existing = {str(x.code or "").strip().upper() for x in session.exec(select(CostCenter)).all()}

    created = 0
    for code, name in defaults:
        if code in existing:
            continue
        session.add(CostCenter(code=code, name=name, is_active=True))
        created += 1

    session.commit()
    return {"ok": True, "created": created}
