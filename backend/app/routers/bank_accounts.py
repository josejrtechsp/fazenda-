from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import BankAccount, BankAccountCreate, BankAccountUpdate

router = APIRouter(prefix="/bank-accounts", tags=["bank_accounts"])


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _serialize(obj: BankAccount) -> Dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "bank_name": obj.bank_name,
        "branch": obj.branch,
        "account_number": obj.account_number,
        "account_type": obj.account_type,
        "opening_balance": obj.opening_balance,
        "is_active": obj.is_active,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


@router.get("")
def list_bank_accounts(
    q: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = Query(default=200, ge=1, le=2000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(BankAccount)
    if not include_inactive:
        stmt = stmt.where(BankAccount.is_active == True)  # noqa

    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: (str(r.name or "").lower(), int(r.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [
            r
            for r in rows
            if nq in _norm_text(r.name)
            or nq in _norm_text(r.bank_name)
            or nq in _norm_text(r.branch)
            or nq in _norm_text(r.account_number)
        ]

    return [_serialize(r) for r in rows[:limit]]


@router.post("")
def create_bank_account(payload: BankAccountCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da conta bancaria e obrigatorio")

    obj = BankAccount(
        name=name,
        bank_name=str(payload.bank_name or "").strip(),
        branch=str(payload.branch or "").strip(),
        account_number=str(payload.account_number or "").strip(),
        account_type=str(payload.account_type or "CORRENTE").strip().upper() or "CORRENTE",
        opening_balance=float(payload.opening_balance or 0.0),
        is_active=bool(payload.is_active if payload.is_active is not None else True),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)


@router.patch("/{bank_account_id}")
def update_bank_account(bank_account_id: int, patch: BankAccountUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    obj = session.get(BankAccount, int(bank_account_id))
    if not obj:
        raise HTTPException(status_code=404, detail="conta bancaria nao encontrada")

    data = patch.model_dump(exclude_unset=True)

    for fld in ("name", "bank_name", "branch", "account_number", "account_type"):
        if fld in data:
            v = str(data.get(fld) or "").strip()
            if fld == "name" and not v:
                raise HTTPException(status_code=422, detail="nome da conta bancaria nao pode ser vazio")
            if fld == "account_type":
                v = v.upper() if v else "CORRENTE"
            setattr(obj, fld, v)

    if "opening_balance" in data:
        obj.opening_balance = float(data.get("opening_balance") or 0.0)
    if "is_active" in data:
        obj.is_active = bool(data.get("is_active"))

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize(obj)
