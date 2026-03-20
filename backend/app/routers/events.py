from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Event, EventCreate, EventRead, EventUpdate, Lot, Animal, ChartAccount, Person, FinanceApprovalPolicy, FinanceMonthState

router = APIRouter(prefix="/events", tags=["events"])


def _assert_finance_month_unlocked(session: Session, month: Optional[str], action: str) -> None:
    s = _as_str(month)
    if not s:
        return
    rows = list(
        session.exec(
            select(FinanceMonthState)
            .where(FinanceMonthState.month == s)
            .order_by(FinanceMonthState.updated_at.desc())
            .limit(1)
        ).all()
    )
    state = rows[0] if rows else None
    if state and bool(state.is_locked):
        locked_at = state.locked_at.strftime("%d/%m/%Y %H:%M") if state.locked_at else "data não registrada"
        who = _as_str(state.locked_by) or "usuário não identificado"
        raise HTTPException(
            status_code=423,
            detail=f"Mês {s} está travado para {action}. Fechado por {who} em {locked_at}.",
        )


def _as_int(v: Any) -> Optional[int]:
    try:
        if v is None:
            return None
        if isinstance(v, bool):
            return None
        return int(v)
    except Exception:
        return None


def _as_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _as_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            n = float(v)
            return n if n == n else None
        s = str(v).strip()
        if not s:
            return None
        s = s.replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
        n = float(s)
        return n if n == n else None
    except Exception:
        return None


def _as_bool(v: Any, default: bool = False) -> bool:
    if v is None:
        return bool(default)
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "sim", "s"):
        return True
    if s in ("0", "false", "f", "no", "n", "nao", "não"):
        return False
    return bool(default)


def _parse_ymd(v: Any, field: str, required: bool = False) -> Optional[datetime]:
    s = _as_str(v)
    if not s:
        if required:
            raise HTTPException(status_code=422, detail=f"{field} é obrigatório (YYYY-MM-DD)")
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=422, detail=f"{field} inválido. Use YYYY-MM-DD")


def _parse_month_key(v: Any, field: str) -> Optional[str]:
    s = _as_str(v)
    if not s:
        return None
    if len(s) == 7 and s[4] == "-" and s[:4].isdigit() and s[5:7].isdigit():
        mm = int(s[5:7])
        if 1 <= mm <= 12:
            return s
    raise HTTPException(status_code=422, detail=f"{field} inválido. Use YYYY-MM")


def _ensure_level4_account(session: Session, code: str, mode: str) -> ChartAccount:
    account_code = _as_str(code)
    if not account_code:
        raise HTTPException(status_code=422, detail="conta contábil é obrigatória")

    acc = session.exec(select(ChartAccount).where(ChartAccount.code == account_code).limit(1)).first()
    if not acc or not bool(acc.is_active):
        raise HTTPException(status_code=422, detail="conta contábil não encontrada ou inativa")
    if int(acc.level or 0) != 4:
        raise HTTPException(status_code=422, detail="use conta de nível 4 no lançamento")

    cat = str(acc.category or "").strip().upper()
    if mode == "cost" and cat == "RECEITA":
        raise HTTPException(status_code=422, detail="despesa não pode usar conta de receita")
    if mode == "revenue" and cat == "DESPESA":
        raise HTTPException(status_code=422, detail="receita não pode usar conta de despesa")
    return acc


def _ensure_person_role(session: Session, person_id: Any, mode: str) -> Person:
    pid = _as_int(person_id)
    if not pid:
        if mode == "cost":
            raise HTTPException(status_code=422, detail="fornecedor é obrigatório")
        raise HTTPException(status_code=422, detail="cliente é obrigatório")

    person = session.get(Person, pid)
    if not person or not bool(person.is_active):
        raise HTTPException(status_code=422, detail="pessoa não encontrada ou inativa")

    if mode == "cost" and not bool(person.is_supplier):
        raise HTTPException(status_code=422, detail="pessoa informada não está marcada como fornecedor")
    if mode == "revenue" and not bool(person.is_customer):
        raise HTTPException(status_code=422, detail="pessoa informada não está marcada como cliente")
    return person


_ALLOWED_APPROVER_ROLES = {"gestor", "admin", "financeiro", "rh"}


def _normalize_approver_role(v: Any, default: str = "gestor") -> str:
    s = str(v or default).strip().lower()
    if s not in _ALLOWED_APPROVER_ROLES:
        return default
    return s


def _parse_tiers_json(raw: Any) -> List[Dict[str, Any]]:
    if raw is None:
        return []

    data = raw
    if isinstance(raw, str):
        txt = raw.strip()
        if not txt:
            return []
        try:
            data = json.loads(txt)
        except Exception:
            return []

    if not isinstance(data, list):
        return []

    rows: List[Dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        min_brl = _as_float(item.get("min_brl"))
        if min_brl is None or min_brl < 0:
            continue
        required_by = _normalize_approver_role(item.get("required_by"), default="gestor")
        rows.append({"min_brl": float(min_brl), "required_by": required_by})

    rows.sort(key=lambda x: float(x.get("min_brl") or 0.0))
    return rows


def _load_finance_approval_policy(session: Session) -> FinanceApprovalPolicy:
    obj = session.get(FinanceApprovalPolicy, 1)
    if obj:
        if _as_str(getattr(obj, "payable_tiers_json", None)) is None:
            obj.payable_tiers_json = "[]"
        if _as_str(getattr(obj, "receivable_tiers_json", None)) is None:
            obj.receivable_tiers_json = "[]"
        return obj

    obj = FinanceApprovalPolicy(
        id=1,
        enabled=False,
        payable_threshold_brl=0.0,
        receivable_threshold_brl=0.0,
        payable_required_by="gestor",
        receivable_required_by="gestor",
        payable_tiers_json="[]",
        receivable_tiers_json="[]",
    )
    session.add(obj)
    try:
        session.commit()
        session.refresh(obj)
    except Exception:
        session.rollback()
        obj = session.get(FinanceApprovalPolicy, 1)
        if not obj:
            obj = FinanceApprovalPolicy(
                id=1,
                enabled=False,
                payable_threshold_brl=0.0,
                receivable_threshold_brl=0.0,
                payable_required_by="gestor",
                receivable_required_by="gestor",
                payable_tiers_json="[]",
                receivable_tiers_json="[]",
            )
    return obj


def _must_require_approval_by_policy(session: Session, mode: str, value_brl: float) -> Dict[str, Any]:
    policy = _load_finance_approval_policy(session)
    if not bool(policy.enabled):
        return {
            "required": False,
            "required_by": "",
            "threshold_brl": 0.0,
            "rule_mode": "none",
        }

    if mode == "cost":
        tiers = _parse_tiers_json(getattr(policy, "payable_tiers_json", "[]"))
        threshold = float(policy.payable_threshold_brl or 0.0)
        required_by = _normalize_approver_role(policy.payable_required_by, default="gestor")
    else:
        tiers = _parse_tiers_json(getattr(policy, "receivable_tiers_json", "[]"))
        threshold = float(policy.receivable_threshold_brl or 0.0)
        required_by = _normalize_approver_role(policy.receivable_required_by, default="gestor")

    abs_value = abs(float(value_brl or 0.0))

    # Regra nova por faixas (prioritaria)
    if tiers:
        matched = None
        for row in tiers:
            if abs_value >= float(row.get("min_brl") or 0.0):
                matched = row
        if matched:
            return {
                "required": True,
                "required_by": str(matched.get("required_by") or "gestor"),
                "threshold_brl": float(matched.get("min_brl") or 0.0),
                "rule_mode": "tier",
            }
        return {
            "required": False,
            "required_by": required_by,
            "threshold_brl": 0.0,
            "rule_mode": "tier",
        }

    # Compat: limiar unico
    if threshold <= 0:
        return {
            "required": False,
            "required_by": required_by,
            "threshold_brl": threshold,
            "rule_mode": "threshold",
        }

    is_required = abs_value >= threshold
    return {
        "required": is_required,
        "required_by": required_by,
        "threshold_brl": threshold,
        "rule_mode": "threshold",
    }


def _ensure_lot(session: Session, lot_id: int) -> Lot:
    lot = session.get(Lot, lot_id)
    if lot:
        return lot
    lot = Lot(id=lot_id, name=f"Lote {lot_id}")
    session.add(lot)
    # flush para garantir PK disponível antes de usar (SQLite ok)
    try:
        session.flush()
    except Exception:
        pass
    return lot


def _ensure_animal(session: Session, ear_tag: str, *, lot_id: Optional[int] = None, area_id: Optional[int] = None) -> Animal:
    tag = (_as_str(ear_tag) or "").upper()
    if not tag:
        raise HTTPException(status_code=400, detail="ear_tag inválido")

    animal = session.get(Animal, tag)
    if not animal:
        animal = Animal(ear_tag=tag)
        session.add(animal)

    if lot_id is not None:
        animal.lot_id = lot_id
    if area_id is not None:
        animal.area_id = area_id

    animal.updated_at = datetime.utcnow()
    return animal


def _extract_transfer_fields(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza campos de transferência vindos do WhatsApp / tela de validação."""
    p = payload or {}

    mode = (_as_str(p.get("transfer_mode")) or "heads").lower()

    origin = p.get("origin") or {}
    dest = p.get("destination") or {}
    if not isinstance(origin, dict):
        origin = {}
    if not isinstance(dest, dict):
        dest = {}

    origin_lot_id = _as_int(origin.get("lot_id")) or _as_int(p.get("from_lot")) or _as_int(p.get("from_lot_id"))
    dest_lot_id = _as_int(dest.get("lot_id")) or _as_int(p.get("to_lot")) or _as_int(p.get("to_lot_id"))

    origin_area_id = _as_int(origin.get("area_id")) or _as_int(p.get("from_area")) or _as_int(p.get("from_area_id"))
    dest_area_id = _as_int(dest.get("area_id")) or _as_int(p.get("to_area")) or _as_int(p.get("to_area_id"))

    qty_heads = _as_int(p.get("qty_heads"))

    ear_tags_raw = p.get("ear_tags")
    ear_tags: List[str] = []
    if isinstance(ear_tags_raw, list):
        for t in ear_tags_raw:
            s = _as_str(t)
            if s:
                ear_tags.append(s.upper())

    # fallback: quando vem como texto
    ear_tags_text = _as_str(p.get("ear_tags_text"))
    if ear_tags_text and not ear_tags:
        for tok in ear_tags_text.replace(",", " ").replace(";", " ").split():
            s = _as_str(tok)
            if s:
                ear_tags.append(s.upper())

    return {
        "mode": mode,
        "qty_heads": qty_heads,
        "ear_tags": ear_tags,
        "origin_lot_id": origin_lot_id,
        "dest_lot_id": dest_lot_id,
        "origin_area_id": origin_area_id,
        "dest_area_id": dest_area_id,
    }


def _apply_transfer(session: Session, ev: Event) -> Dict[str, Any]:
    payload = ev.payload or {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload inválido")

    f = _extract_transfer_fields(payload)

    mode = f["mode"]
    qty_heads = f["qty_heads"]
    ear_tags = f["ear_tags"]

    origin_lot_id = f["origin_lot_id"]
    dest_lot_id = f["dest_lot_id"]
    origin_area_id = f["origin_area_id"]
    dest_area_id = f["dest_area_id"]

    if dest_lot_id is None and dest_area_id is None:
        raise HTTPException(status_code=400, detail="transferência sem destino (lote/manga)")

    applied: Dict[str, Any] = {
        "kind": "transfer",
        "mode": mode,
        "moved_ear_tags": 0,
        "moved_heads": 0,
        "origin": {"lot_id": origin_lot_id, "area_id": origin_area_id},
        "destination": {"lot_id": dest_lot_id, "area_id": dest_area_id},
    }

    # 0) Transferência de lote para manga (sem qty/brinco)
    if mode in ("lot_move", "lot_to_area"):
        if origin_lot_id is None or dest_area_id is None:
            raise HTTPException(status_code=400, detail="lot_move exige origem lote e destino manga")

        animals = session.exec(
            select(Animal).where(Animal.status == "active").where(Animal.lot_id == origin_lot_id)
        ).all()
        for a in animals:
            a.area_id = dest_area_id
            a.updated_at = datetime.utcnow()

        applied["mode"] = "lot_move"
        applied["moved_ear_tags"] = len(animals)
        applied["moved_heads"] = len(animals)

        payload.setdefault("applied", {})
        if isinstance(payload.get("applied"), dict):
            payload["applied"].update({
                "at": datetime.utcnow().isoformat(),
                "summary": applied,
            })
        ev.payload = payload
        return applied

    # 1) Transferência por brincos
    if mode == "ear_tags" and ear_tags:
        if dest_lot_id is not None:
            _ensure_lot(session, dest_lot_id)
        if origin_lot_id is not None:
            _ensure_lot(session, origin_lot_id)

        for tag in ear_tags:
            # se não existia, nasce com origem (se tiver)
            _ensure_animal(session, tag, lot_id=origin_lot_id, area_id=origin_area_id)
            # move para destino
            a = session.get(Animal, tag.upper())
            if a:
                if dest_lot_id is not None:
                    a.lot_id = dest_lot_id
                if dest_area_id is not None:
                    a.area_id = dest_area_id
                a.updated_at = datetime.utcnow()

        applied["moved_ear_tags"] = len(ear_tags)
        # se não informou qty_heads, assume contagem dos brincos
        if qty_heads is None:
            qty_heads = len(ear_tags)

    # 2) Transferência por cabeça (sem brinco)
    if mode != "ear_tags":
        if qty_heads is None:
            raise HTTPException(status_code=400, detail="transferência por cabeça sem qty_heads")

        if dest_lot_id is not None:
            to_lot = _ensure_lot(session, dest_lot_id)
            to_lot.heads_untagged = int(to_lot.heads_untagged or 0) + int(qty_heads)
            to_lot.updated_at = datetime.utcnow()

        if origin_lot_id is not None:
            from_lot = _ensure_lot(session, origin_lot_id)
            from_lot.heads_untagged = max(0, int(from_lot.heads_untagged or 0) - int(qty_heads))
            from_lot.updated_at = datetime.utcnow()

        applied["moved_heads"] = int(qty_heads)

    # marca no payload que foi aplicado
    payload.setdefault("applied", {})
    if isinstance(payload.get("applied"), dict):
        payload["applied"].update({
            "at": datetime.utcnow().isoformat(),
            "summary": applied,
        })
    ev.payload = payload

    return applied


@router.post("/finance/cost", response_model=EventRead)
def create_finance_cost(payload: Dict[str, Any], session: Session = Depends(get_session)):
    p = payload or {}
    if not isinstance(p, dict):
        raise HTTPException(status_code=422, detail="payload inválido")

    account = _ensure_level4_account(session, p.get("account_code"), mode="cost")
    supplier = _ensure_person_role(session, p.get("supplier_id"), mode="cost")

    value_brl = _as_float(p.get("value_brl"))
    if value_brl is None or value_brl <= 0:
        raise HTTPException(status_code=422, detail="valor da despesa deve ser maior que zero")

    planned_value_brl = _as_float(p.get("planned_value_brl"))
    if planned_value_brl is not None and planned_value_brl < 0:
        raise HTTPException(status_code=422, detail="valor previsto não pode ser negativo")

    occurred_at = _parse_ymd(p.get("occurred_on") or p.get("date") or p.get("occurred_at"), "data", required=False)
    if occurred_at is None:
        occurred_at = datetime.utcnow()

    due_at = _parse_ymd(p.get("due_date"), "vencimento", required=False) or occurred_at
    payment_at = _parse_ymd(p.get("payment_date"), "pagamento", required=False)
    competence_month = _parse_month_key(p.get("competence_month"), "competência")
    if not competence_month:
        competence_month = occurred_at.strftime("%Y-%m")
    _assert_finance_month_unlocked(session, competence_month, "lançamento de despesa")

    manual_requires_approval = _as_bool(p.get("requires_approval"), default=False)
    policy_req = _must_require_approval_by_policy(session, mode="cost", value_brl=float(value_brl))
    auto_requires_approval = bool(policy_req.get("required"))
    requires_approval = bool(manual_requires_approval or auto_requires_approval)
    approval_status = "pending" if requires_approval else "approved"
    approval_note = _as_str(p.get("approval_note")) or ""
    approval_required_by = _as_str(p.get("approval_required_by")) or _as_str(policy_req.get("required_by")) or "gestor"
    approval_source = "manual" if manual_requires_approval else ("policy" if auto_requires_approval else "none")
    approval_policy_threshold_brl = float(policy_req.get("threshold_brl") or 0.0)

    status = str(p.get("status") or "open").strip().lower()
    if status not in ("open", "paid", "overdue"):
        raise HTTPException(status_code=422, detail="status da despesa deve ser open, paid ou overdue")
    if requires_approval and status == "paid":
        status = "open"
    payment_status = "paid" if status == "paid" else "open"
    if payment_status == "paid" and payment_at is None:
        payment_at = occurred_at

    cost_kind = str(p.get("cost_kind") or "operational").strip().lower()
    if cost_kind not in ("operational", "investment"):
        raise HTTPException(status_code=422, detail="cost_kind deve ser operational ou investment")

    center_cost = _as_str(p.get("center_cost")) or "Fazenda"
    notes = _as_str(p.get("notes")) or f"Despesa {account.name}"
    doc_number = _as_str(p.get("doc_number")) or ""

    event = Event(
        source="manual",
        status="approved",
        type="cost",
        occurred_at=occurred_at,
        raw_text=f"FIN_COST:{account.code}:{supplier.id}:{occurred_at.strftime('%Y-%m-%d')}",
        payload={
            "group": "financeiro",
            "category": _as_str(p.get("category")) or account.name,
            "account_code": account.code,
            "account_name": account.name,
            "account_category": account.category,
            "center_cost": center_cost,
            "cost_kind": cost_kind,
            "is_investment": cost_kind == "investment",
            "payment_status": payment_status,
            "status_label": status,
            "due_date": due_at.strftime("%Y-%m-%d"),
            "payment_date": payment_at.strftime("%Y-%m-%d") if payment_at else None,
            "competence_month": competence_month,
            "supplier_id": int(supplier.id),
            "supplier_name": supplier.name,
            "person_id": int(supplier.id),
            "person_name": supplier.name,
            "value_brl": float(value_brl),
            "planned_value_brl": float(planned_value_brl) if planned_value_brl is not None else None,
            "doc_number": doc_number,
            "notes": notes,
            "requires_approval": requires_approval,
            "approval_status": approval_status,
            "approval_required_by": approval_required_by,
            "approval_note": approval_note,
            "approval_source": approval_source,
            "approval_policy_threshold_brl": approval_policy_threshold_brl,
            "approval_policy_mode": policy_req.get("rule_mode") or "threshold",
        },
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.post("/finance/revenue", response_model=EventRead)
def create_finance_revenue(payload: Dict[str, Any], session: Session = Depends(get_session)):
    p = payload or {}
    if not isinstance(p, dict):
        raise HTTPException(status_code=422, detail="payload inválido")

    account = _ensure_level4_account(session, p.get("account_code"), mode="revenue")
    customer = _ensure_person_role(session, p.get("customer_id"), mode="revenue")

    value_brl = _as_float(p.get("value_brl"))
    if value_brl is None or value_brl <= 0:
        raise HTTPException(status_code=422, detail="valor da receita deve ser maior que zero")

    planned_value_brl = _as_float(p.get("planned_value_brl"))
    if planned_value_brl is not None and planned_value_brl < 0:
        raise HTTPException(status_code=422, detail="valor previsto não pode ser negativo")

    arrobas = _as_float(p.get("arrobas"))
    if arrobas is not None and arrobas < 0:
        raise HTTPException(status_code=422, detail="arrobas não pode ser negativo")

    occurred_at = _parse_ymd(p.get("occurred_on") or p.get("date") or p.get("occurred_at"), "data", required=False)
    if occurred_at is None:
        occurred_at = datetime.utcnow()

    receive_due = _parse_ymd(p.get("due_date"), "vencimento", required=False) or occurred_at
    received_at = _parse_ymd(p.get("received_date"), "recebimento", required=False)
    competence_month = _parse_month_key(p.get("competence_month"), "competência")
    if not competence_month:
        competence_month = occurred_at.strftime("%Y-%m")
    _assert_finance_month_unlocked(session, competence_month, "lançamento de receita")

    manual_requires_approval = _as_bool(p.get("requires_approval"), default=False)
    policy_req = _must_require_approval_by_policy(session, mode="revenue", value_brl=float(value_brl))
    auto_requires_approval = bool(policy_req.get("required"))
    requires_approval = bool(manual_requires_approval or auto_requires_approval)
    approval_status = "pending" if requires_approval else "approved"
    approval_note = _as_str(p.get("approval_note")) or ""
    approval_required_by = _as_str(p.get("approval_required_by")) or _as_str(policy_req.get("required_by")) or "gestor"
    approval_source = "manual" if manual_requires_approval else ("policy" if auto_requires_approval else "none")
    approval_policy_threshold_brl = float(policy_req.get("threshold_brl") or 0.0)

    status = str(p.get("status") or "open").strip().lower()
    if status not in ("open", "received"):
        raise HTTPException(status_code=422, detail="status da receita deve ser open ou received")
    if requires_approval and status == "received":
        status = "open"
    receive_status = "received" if status == "received" else "open"
    if receive_status == "received" and received_at is None:
        received_at = occurred_at

    center_cost = _as_str(p.get("center_cost")) or "Fazenda"
    notes = _as_str(p.get("notes")) or f"Receita {account.name}"
    doc_number = _as_str(p.get("doc_number")) or ""
    price_per_arroba = float(value_brl / arrobas) if arrobas and arrobas > 0 else None

    event = Event(
        source="manual",
        status="approved",
        type="exit",
        occurred_at=occurred_at,
        raw_text=f"FIN_REV:{account.code}:{customer.id}:{occurred_at.strftime('%Y-%m-%d')}",
        payload={
            "group": "financeiro",
            "category": _as_str(p.get("category")) or account.name,
            "account_code": account.code,
            "account_name": account.name,
            "account_category": account.category,
            "center_cost": center_cost,
            "receive_status": receive_status,
            "status_label": status,
            "due_date": receive_due.strftime("%Y-%m-%d"),
            "received_date": received_at.strftime("%Y-%m-%d") if received_at else None,
            "competence_month": competence_month,
            "customer_id": int(customer.id),
            "customer_name": customer.name,
            "person_id": int(customer.id),
            "person_name": customer.name,
            "arrobas": float(arrobas) if arrobas is not None else None,
            "price_per_arroba_brl": price_per_arroba,
            "value_brl": float(value_brl),
            "planned_value_brl": float(planned_value_brl) if planned_value_brl is not None else None,
            "doc_number": doc_number,
            "notes": notes,
            "requires_approval": requires_approval,
            "approval_status": approval_status,
            "approval_required_by": approval_required_by,
            "approval_note": approval_note,
            "approval_source": approval_source,
            "approval_policy_threshold_brl": approval_policy_threshold_brl,
            "approval_policy_mode": policy_req.get("rule_mode") or "threshold",
        },
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.post("", response_model=EventRead)
def create_event(payload: EventCreate, session: Session = Depends(get_session)):
    ev = Event.model_validate(payload)
    # default occurred_at
    if getattr(ev, "occurred_at", None) is None:
        ev.occurred_at = datetime.utcnow()
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return ev


@router.get("", response_model=List[EventRead])
def list_events(
    session: Session = Depends(get_session),
    status: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Busca simples em raw_text"),
    limit: int = Query(default=50, ge=1, le=500),
):
    stmt = select(Event).order_by(Event.created_at.desc())
    if status:
        stmt = stmt.where(Event.status == status)
    if type:
        stmt = stmt.where(Event.type == type)
    if source:
        stmt = stmt.where(Event.source == source)
    if q:
        stmt = stmt.where(Event.raw_text.ilike(f"%{q}%"))
    return session.exec(stmt.limit(limit)).all()


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, session: Session = Depends(get_session)):
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


@router.patch("/{event_id}", response_model=EventRead)
def update_event(event_id: int, patch: EventUpdate, session: Session = Depends(get_session)):
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    old_status = ev.status

    data = patch.model_dump(exclude_unset=True)
    if str(ev.type or "").lower() in ("cost", "exit"):
        payload = dict(ev.payload or {})
        patch_payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
        month = (
            _as_str(patch_payload.get("competence_month"))
            or _as_str(payload.get("competence_month"))
        )
        _assert_finance_month_unlocked(session, month, "edição de lançamento financeiro")
    for k, v in data.items():
        setattr(ev, k, v)

    # aplica regras quando muda para aprovado
    try:
        if old_status != "approved" and ev.status == "approved":
            if ev.type == "transfer":
                _apply_transfer(session, ev)
            # (futuro: aplicar cost/nutrição/exit aqui)

        session.add(ev)
        session.commit()
        session.refresh(ev)
        return ev
    except HTTPException:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e))
