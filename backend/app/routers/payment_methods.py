from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import BankAccount, PaymentMethod, PaymentMethodCreate, PaymentMethodUpdate

router = APIRouter(prefix="/payment-methods", tags=["payment_methods"])

_ALLOWED_METHOD_TYPES = {"PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CARTAO", "BARTER"}


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _serialize(obj: PaymentMethod) -> Dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "method_type": obj.method_type,
        "fee_percent": obj.fee_percent,
        "term_days": obj.term_days,
        "default_bank_account_id": obj.default_bank_account_id,
        "is_active": obj.is_active,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _validate_method_type(method_type: str) -> str:
    mt = str(method_type or "PIX").strip().upper()
    if mt not in _ALLOWED_METHOD_TYPES:
        allowed = ", ".join(sorted(_ALLOWED_METHOD_TYPES))
        raise HTTPException(status_code=422, detail=f"method_type invalido. Use: {allowed}")
    return mt


def _validate_default_bank(session: Session, bank_id: Optional[int]) -> Optional[int]:
    if bank_id is None:
        return None
    obj = session.get(BankAccount, int(bank_id))
    if not obj:
        raise HTTPException(status_code=422, detail="default_bank_account_id nao encontrado")
    return int(bank_id)


@router.get("")
def list_payment_methods(
    q: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = Query(default=200, ge=1, le=2000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(PaymentMethod)
    if not include_inactive:
        stmt = stmt.where(PaymentMethod.is_active == True)  # noqa

    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: (str(r.name or "").lower(), int(r.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [r for r in rows if nq in _norm_text(r.name) or nq in _norm_text(r.method_type)]

    return [_serialize(r) for r in rows[:limit]]


@router.post("")
def create_payment_method(payload: PaymentMethodCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da forma de pagamento e obrigatorio")

    method_type = _validate_method_type(payload.method_type or "PIX")
    fee_percent = float(payload.fee_percent or 0.0)
    term_days = int(payload.term_days or 0)
    if fee_percent < 0:
        raise HTTPException(status_code=422, detail="fee_percent nao pode ser negativo")
    if term_days < 0:
        raise HTTPException(status_code=422, detail="term_days nao pode ser negativo")

    default_bank_account_id = _validate_default_bank(session, payload.default_bank_account_id)

    obj = PaymentMethod(
        name=name,
        method_type=method_type,
        fee_percent=fee_percent,
        term_days=term_days,
        default_bank_account_id=default_bank_account_id,
        is_active=bool(payload.is_active if payload.is_active is not None else True),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)


@router.patch("/{payment_method_id}")
def update_payment_method(payment_method_id: int, patch: PaymentMethodUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    obj = session.get(PaymentMethod, int(payment_method_id))
    if not obj:
        raise HTTPException(status_code=404, detail="forma de pagamento nao encontrada")

    data = patch.model_dump(exclude_unset=True)

    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="nome da forma de pagamento nao pode ser vazio")
        obj.name = name

    if "method_type" in data:
        obj.method_type = _validate_method_type(data.get("method_type"))

    if "fee_percent" in data:
        fp = float(data.get("fee_percent") or 0.0)
        if fp < 0:
            raise HTTPException(status_code=422, detail="fee_percent nao pode ser negativo")
        obj.fee_percent = fp

    if "term_days" in data:
        td = int(data.get("term_days") or 0)
        if td < 0:
            raise HTTPException(status_code=422, detail="term_days nao pode ser negativo")
        obj.term_days = td

    if "default_bank_account_id" in data:
        obj.default_bank_account_id = _validate_default_bank(session, data.get("default_bank_account_id"))

    if "is_active" in data:
        obj.is_active = bool(data.get("is_active"))

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)


@router.post("/seed-defaults")
def seed_default_payment_methods(session: Session = Depends(get_session)) -> Dict[str, Any]:
    defaults = [
        ("PIX", "PIX", 0.0, 0),
        ("Boleto", "BOLETO", 0.0, 2),
        ("Transferencia", "TRANSFERENCIA", 0.0, 0),
        ("Dinheiro", "DINHEIRO", 0.0, 0),
        ("Cartao", "CARTAO", 2.5, 30),
        ("Barter", "BARTER", 0.0, 0),
    ]
    existing = {_norm_text(x.name) for x in session.exec(select(PaymentMethod)).all()}

    created = 0
    for name, method_type, fee_percent, term_days in defaults:
        if _norm_text(name) in existing:
            continue
        session.add(
            PaymentMethod(
                name=name,
                method_type=method_type,
                fee_percent=float(fee_percent),
                term_days=int(term_days),
                is_active=True,
            )
        )
        created += 1

    session.commit()
    return {"ok": True, "created": created}
