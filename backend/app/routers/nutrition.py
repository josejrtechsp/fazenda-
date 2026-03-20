from __future__ import annotations

from datetime import datetime
import re
import unicodedata
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from app.db.session import get_engine
from app.models.nutrition import NutritionItem, NutritionPurchase

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


DEFAULT_ITEMS: List[Dict[str, Any]] = [
    # Volumosos
    {"name": "Silagem de milho", "is_volumoso": True, "default_unit": "ton", "aliases": "silagem milho;silagem de milho"},
    {"name": "Silagem de sorgo", "is_volumoso": True, "default_unit": "ton", "aliases": "silagem sorgo;silagem de sorgo"},
    {"name": "Silagem de capim", "is_volumoso": True, "default_unit": "ton", "aliases": "silagem capim;silagem de capim"},
    {"name": "Feno de capim", "is_volumoso": True, "default_unit": "fardo", "aliases": "feno capim;feno de capim"},
    {"name": "Feno de alfafa", "is_volumoso": True, "default_unit": "fardo", "aliases": "feno alfafa;feno de alfafa"},
    {"name": "Feno em rolo", "is_volumoso": True, "default_unit": "rolo", "aliases": "rolo;feno rolo;feno em rolo"},
    {"name": "Capim picado (verde)", "is_volumoso": True, "default_unit": "kg", "aliases": "capim picado;capim verde"},

    # Concentrados
    {"name": "Ração concentrada", "is_volumoso": False, "default_unit": "saco", "aliases": "ração;concentrado;trato"},
    {"name": "Ração terminação", "is_volumoso": False, "default_unit": "saco", "aliases": "ração terminação;terminação"},
    {"name": "Milho grão", "is_volumoso": False, "default_unit": "kg", "aliases": "milho;milho grão"},
    {"name": "Sorgo grão", "is_volumoso": False, "default_unit": "kg", "aliases": "sorgo;sorgo grão"},
    {"name": "Polpa cítrica peletizada", "is_volumoso": False, "default_unit": "kg", "aliases": "polpa cítrica;polpa citrica"},
    {"name": "Casquinha de soja", "is_volumoso": False, "default_unit": "kg", "aliases": "casca soja;casquinha soja"},

    # Proteicos
    {"name": "Farelo de soja", "is_volumoso": False, "default_unit": "kg", "aliases": "farelo soja;soja"},
    {"name": "Farelo de algodão", "is_volumoso": False, "default_unit": "kg", "aliases": "farelo algodão;farelo algodao"},
    {"name": "DDG", "is_volumoso": False, "default_unit": "kg", "aliases": "ddg"},
    {"name": "Ureia pecuária", "is_volumoso": False, "default_unit": "kg", "aliases": "ureia;uréia"},

    # Minerais / sal
    {"name": "Sal mineral", "is_volumoso": False, "default_unit": "saco", "aliases": "sal mineral;mineral"},
    {"name": "Sal proteinado", "is_volumoso": False, "default_unit": "saco", "aliases": "proteinado;sal proteinado"},
    {"name": "Sal comum (NaCl)", "is_volumoso": False, "default_unit": "saco", "aliases": "sal comum;sal"},

    # Aditivos
    {"name": "Monensina", "is_volumoso": False, "default_unit": "kg", "aliases": "monensina"},
    {"name": "Bicarbonato de sódio", "is_volumoso": False, "default_unit": "kg", "aliases": "bicarbonato"},
    {"name": "Adsorvente de micotoxina", "is_volumoso": False, "default_unit": "kg", "aliases": "micotoxina;adsorvente"},
]


def _engine():
    return get_engine()


# --- helpers: match item_name -> item_id (aceita aliases) ---

def _norm_key(s: str) -> str:
    s = (s or '').strip().lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())


def _best_match_item_id(s, name: str):
    key = _norm_key(name)
    if not key:
        return None
    items = s.exec(select(NutritionItem).where(NutritionItem.is_active == True)).all()
    best_id = None
    best_score = 0
    for it in items:
        cands = [it.name] + [a.strip() for a in (it.aliases or '').split(';') if a.strip()]
        for c in cands:
            ck = _norm_key(c)
            if ck and (ck in key or key in ck):
                score = len(ck)
                if score > best_score:
                    best_score = score
                    best_id = it.id
    return best_id


@router.post("/seed-default")
def seed_default_items() -> Dict[str, Any]:
    eng = _engine()
    created = 0
    with Session(eng) as s:
        existing = {i.name.lower(): i for i in s.exec(select(NutritionItem)).all()}
        for it in DEFAULT_ITEMS:
            key = it["name"].lower()
            if key in existing:
                continue
            obj = NutritionItem(**it)
            s.add(obj)
            created += 1
        s.commit()
    return {"ok": True, "created": created}


@router.get("/items")
def list_items(active_only: bool = True) -> List[NutritionItem]:
    eng = _engine()
    with Session(eng) as s:
        q = select(NutritionItem)
        if active_only:
            q = q.where(NutritionItem.is_active == True)  # noqa
        q = q.order_by(NutritionItem.is_volumoso.desc(), NutritionItem.name.asc())
        return list(s.exec(q).all())


@router.post("/items")
def create_item(payload: Dict[str, Any]) -> NutritionItem:
    eng = _engine()
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name é obrigatório")
    obj = NutritionItem(
        name=name,
        category=(payload.get("category") or "NUTRICAO"),
        is_volumoso=bool(payload.get("is_volumoso") or False),
        default_unit=(payload.get("default_unit") or "saco"),
        kg_per_unit=payload.get("kg_per_unit"),
        matter_dry_pct=payload.get("matter_dry_pct"),
        aliases=(payload.get("aliases") or ""),
        is_active=bool(payload.get("is_active", True)),
        updated_at=datetime.utcnow(),
    )
    with Session(eng) as s:
        s.add(obj)
        s.commit()
        s.refresh(obj)
        return obj


@router.post("/purchases")
def create_purchase(payload: Dict[str, Any]) -> NutritionPurchase:
    eng = _engine()
    item_id = payload.get("item_id")
    item_name = payload.get("item_name") or payload.get("item") or payload.get("name")
    if not item_id and item_name:
        with Session(eng) as s:
            best = _best_match_item_id(s, str(item_name))
            if best:
                item_id = best
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id é obrigatório (ou use item_name)")
    qty = float(payload.get("qty") or 0)
    unit = (payload.get("unit") or "saco").strip()
    unit_price = float(payload.get("unit_price_brl") or 0)
    if qty <= 0 or unit_price <= 0:
        raise HTTPException(status_code=400, detail="qty e unit_price_brl devem ser > 0")

    purchased_at = payload.get("purchased_at") or payload.get("occurred_at")
    if purchased_at:
        try:
            dt = datetime.fromisoformat(purchased_at)
        except Exception:
            raise HTTPException(status_code=400, detail="purchased_at inválido (ISO)"
            )
    else:
        dt = datetime.utcnow()

    obj = NutritionPurchase(
        item_id=int(item_id),
        purchased_at=dt,
        qty=qty,
        unit=unit,
        unit_price_brl=unit_price,
        total_brl=qty * unit_price,
        supplier=payload.get("supplier"),
        notes=payload.get("notes"),
    )
    with Session(eng) as s:
        # ensure item exists
        it = s.get(NutritionItem, obj.item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        s.add(obj)
        s.commit()
        s.refresh(obj)
        return obj


@router.get("/purchases")
def list_purchases(item_id: Optional[int] = None, limit: int = 50) -> List[NutritionPurchase]:
    eng = _engine()
    with Session(eng) as s:
        q = select(NutritionPurchase)
        if item_id is not None:
            q = q.where(NutritionPurchase.item_id == int(item_id))
        q = q.order_by(NutritionPurchase.purchased_at.desc()).limit(limit)
        return list(s.exec(q).all())


def find_unit_price(item: NutritionItem, at: datetime, unit: str) -> Optional[float]:
    """Retorna preço unitário vigente para o item na unidade informada.

    Estratégia:
    - usa última compra (<= at)
    - se unidade diferente: tenta converter via kg_per_unit (item) ou equivalência ton<->kg
    """
    eng = _engine()
    unit = (unit or "").strip().lower()
    with Session(eng) as s:
        q = (
            select(NutritionPurchase)
            .where(NutritionPurchase.item_id == item.id)
            .where(NutritionPurchase.purchased_at <= at)
            .order_by(NutritionPurchase.purchased_at.desc())
            .limit(1)
        )
        p = s.exec(q).first()
        if not p:
            return None

        p_unit = (p.unit or "").strip().lower()
        if p_unit == unit:
            return float(p.unit_price_brl)

        # direct conversion kg<->ton
        if p_unit == "ton" and unit == "kg":
            return float(p.unit_price_brl) / 1000.0
        if p_unit == "kg" and unit == "ton":
            return float(p.unit_price_brl) * 1000.0

        # use kg_per_unit when possible
        if item.kg_per_unit and p_unit == "kg" and unit in ("saco", "fardo", "rolo", "carga", "carreta"):
            return float(p.unit_price_brl) * float(item.kg_per_unit)
        if item.kg_per_unit and unit == "kg" and p_unit in ("saco", "fardo", "rolo", "carga", "carreta"):
            return float(p.unit_price_brl) / float(item.kg_per_unit)

        return None
