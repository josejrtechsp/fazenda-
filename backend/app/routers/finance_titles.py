from __future__ import annotations

import csv
import io
import json
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Event, FinanceApprovalPolicy, FinanceMonthClose, FinanceMonthState

router = APIRouter(prefix="/finance", tags=["finance_titles"])


def _as_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _as_int(v: Any) -> Optional[int]:
    try:
        if v is None or isinstance(v, bool):
            return None
        return int(v)
    except Exception:
        return None


def _as_float(v: Any) -> Optional[float]:
    try:
        if v is None or isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            n = float(v)
            return n if n == n else None
        s = str(v).strip().replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
        if not s:
            return None
        n = float(s)
        return n if n == n else None
    except Exception:
        return None


def _parse_ymd(v: Any, field: str, required: bool = False) -> Optional[date]:
    s = _as_str(v)
    if not s:
        if required:
            raise HTTPException(status_code=422, detail=f"{field} e obrigatorio (YYYY-MM-DD)")
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=422, detail=f"{field} invalido. Use YYYY-MM-DD")


def _parse_month(v: Any, field: str = "month") -> Optional[str]:
    s = _as_str(v)
    if not s:
        return None
    if len(s) == 7 and s[4] == "-" and s[:4].isdigit() and s[5:7].isdigit():
        m = int(s[5:7])
        if 1 <= m <= 12:
            return s
    raise HTTPException(status_code=422, detail=f"{field} invalido. Use YYYY-MM")


_ALLOWED_APPROVER_ROLES = {"gestor", "admin", "financeiro", "rh"}
_ALLOWED_MONTH_LOCK_ROLES = {"gestor", "admin"}


def _approver_role(v: Any, default: str = "gestor") -> str:
    s = str(v or default).strip().lower()
    if s not in _ALLOWED_APPROVER_ROLES:
        raise HTTPException(status_code=422, detail="perfil aprovador invalido")
    return s


def _month_lock_role(v: Any, default: str = "gestor") -> str:
    s = str(v or default).strip().lower()
    if s not in _ALLOWED_APPROVER_ROLES:
        raise HTTPException(status_code=422, detail="perfil invalido")
    return s


def _parse_tiers_value(v: Any, field: str) -> List[Dict[str, Any]]:
    if v is None:
        return []

    data = v
    if isinstance(v, str):
        raw = v.strip()
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except Exception:
            raise HTTPException(status_code=422, detail=f"{field} invalido. Use lista JSON")

    if not isinstance(data, list):
        raise HTTPException(status_code=422, detail=f"{field} deve ser uma lista")

    out: List[Dict[str, Any]] = []
    for i, row in enumerate(data):
        if not isinstance(row, dict):
            raise HTTPException(status_code=422, detail=f"{field}[{i}] invalido")

        min_brl = _as_float(row.get("min_brl"))
        if min_brl is None or min_brl < 0:
            raise HTTPException(status_code=422, detail=f"{field}[{i}].min_brl deve ser >= 0")

        required_by = _approver_role(row.get("required_by"), default="gestor")
        out.append({"min_brl": round(float(min_brl), 2), "required_by": required_by})

    out.sort(key=lambda x: float(x.get("min_brl") or 0.0))

    dedup: Dict[float, str] = {}
    for row in out:
        dedup[float(row["min_brl"])] = str(row["required_by"])

    final_rows = [
        {"min_brl": k, "required_by": dedup[k]}
        for k in sorted(dedup.keys())
    ]
    return final_rows


def _read_tiers_json(raw: Any) -> List[Dict[str, Any]]:
    if raw is None:
        return []
    try:
        return _parse_tiers_value(raw, "tiers")
    except HTTPException:
        return []


def _ensure_approval_policy(session: Session) -> FinanceApprovalPolicy:
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
    session.commit()
    session.refresh(obj)
    return obj


def _serialize_approval_policy(obj: FinanceApprovalPolicy) -> Dict[str, Any]:
    payable_tiers = _read_tiers_json(getattr(obj, "payable_tiers_json", "[]"))
    receivable_tiers = _read_tiers_json(getattr(obj, "receivable_tiers_json", "[]"))
    return {
        "id": int(obj.id or 1),
        "enabled": bool(obj.enabled),
        "payable_threshold_brl": float(obj.payable_threshold_brl or 0.0),
        "receivable_threshold_brl": float(obj.receivable_threshold_brl or 0.0),
        "payable_required_by": str(obj.payable_required_by or "gestor"),
        "receivable_required_by": str(obj.receivable_required_by or "gestor"),
        "payable_tiers": payable_tiers,
        "receivable_tiers": receivable_tiers,
        "updated_at": obj.updated_at,
    }


def _kind_for_event(ev: Event) -> Optional[str]:
    if str(ev.type or "").lower() == "cost":
        return "payable"
    if str(ev.type or "").lower() == "exit":
        return "receivable"
    return None


def _payload(ev: Event) -> Dict[str, Any]:
    p = ev.payload or {}
    return p if isinstance(p, dict) else {}


def _title_amounts(kind: str, payload: Dict[str, Any]) -> Dict[str, float]:
    total = float(_as_float(payload.get("value_brl")) or 0.0)
    settled = _as_float(payload.get("settled_brl"))
    if settled is None:
        if kind == "payable" and str(payload.get("payment_status") or "").lower() == "paid":
            settled = total
        elif kind == "receivable" and str(payload.get("receive_status") or "").lower() == "received":
            settled = total
        else:
            settled = 0.0

    settled = min(max(float(settled), 0.0), total)
    remaining = max(total - settled, 0.0)
    return {
        "total_brl": round(total, 2),
        "settled_brl": round(settled, 2),
        "remaining_brl": round(remaining, 2),
    }


def _derive_status(kind: str, payload: Dict[str, Any], remaining_brl: float) -> str:
    due = _parse_ymd(payload.get("due_date"), "due_date", required=False)
    today = date.today()

    if remaining_brl <= 0.000001:
        return "paid" if kind == "payable" else "received"
    if due and due < today:
        return "overdue"
    return "open"


def _approval_status(payload: Dict[str, Any]) -> str:
    s = str(payload.get("approval_status") or "").strip().lower()
    if s in ("pending", "approved", "rejected"):
        return s
    if bool(payload.get("requires_approval")):
        return "pending"
    return "approved"


def _reconciliation_status(payload: Dict[str, Any], settled_brl: float) -> str:
    s = str(payload.get("reconciliation_status") or "").strip().lower()
    if s in ("pending", "reconciled", "not_applicable"):
        return s
    if bool(payload.get("is_reconciled")):
        return "reconciled"
    if float(settled_brl or 0.0) > 0.000001:
        return "pending"
    return "not_applicable"


def _can_actor_approve(required_by: str, actor_role: str) -> bool:
    req = _approver_role(required_by, default="gestor")
    actor = _approver_role(actor_role, default="gestor")
    if actor == "admin":
        return True
    return actor == req


def _append_audit(payload: Dict[str, Any], action: str, actor: Optional[str], details: Dict[str, Any]) -> None:
    logs = payload.get("audit_log")
    if not isinstance(logs, list):
        logs = []

    row = {
        "at": datetime.utcnow().isoformat(),
        "action": action,
        "actor": _as_str(actor) or "system",
    }
    row.update(details or {})
    logs.append(row)
    payload["audit_log"] = logs


def _norm_key(v: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(v or "").strip().lower())


def _coalesce(mapping: Dict[str, Any], keys: List[str]) -> Any:
    for k in keys:
        if k in mapping and _as_str(mapping.get(k)) is not None:
            return mapping.get(k)
    return None


def _parse_flexible_date(v: Any) -> Optional[date]:
    s = _as_str(v)
    if not s:
        return None
    raw = s.replace(".", "/").strip()
    fmts = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d")
    for fmt in fmts:
        try:
            return datetime.strptime(raw[:10], fmt).date()
        except Exception:
            pass
    return None


def _parse_amount_any(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        n = float(v)
        return n if n == n else None

    s = str(v).strip()
    if not s:
        return None
    s = s.replace("R$", "").replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    s = re.sub(r"[^0-9.\-+]", "", s)
    if not s or s in ("-", "+", ".", "-.", "+."):
        return None
    try:
        n = float(s)
        return n if n == n else None
    except Exception:
        return None


def _guess_delimiter(csv_text: str, preferred: Optional[str] = None) -> str:
    if preferred in (";", ",", "\t", "|"):
        return preferred
    first = "\n".join(str(csv_text or "").splitlines()[:5])
    counts = {
        ";": first.count(";"),
        ",": first.count(","),
        "\t": first.count("\t"),
        "|": first.count("|"),
    }
    return max(counts.items(), key=lambda x: x[1])[0] if counts else ";"


def _read_statement_rows(
    csv_text: str,
    delimiter: Optional[str],
    max_rows: int = 1000,
) -> List[Dict[str, Any]]:
    text = str(csv_text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="csv_text e obrigatorio")

    delim = _guess_delimiter(text, delimiter)
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    raw_rows = list(reader)
    if not raw_rows:
        return []

    out: List[Dict[str, Any]] = []
    for idx, row in enumerate(raw_rows, start=1):
        if idx > max_rows:
            break

        norm = {_norm_key(k): (v if v is not None else "") for k, v in (row or {}).items()}

        date_raw = _coalesce(
            norm,
            [
                "data",
                "datamovimento",
                "datalancamento",
                "date",
                "dt",
                "movementdate",
            ],
        )
        desc_raw = _coalesce(
            norm,
            [
                "historico",
                "descricao",
                "description",
                "memo",
                "detalhe",
            ],
        )
        doc_raw = _coalesce(
            norm,
            [
                "documento",
                "doc",
                "numerodoc",
                "numero",
                "referencia",
                "reference",
            ],
        )
        amount_raw = _coalesce(norm, ["valor", "amount", "value", "valorrs", "valortotal"])
        credit_raw = _coalesce(norm, ["credito", "credit", "entrada", "recebimento"])
        debit_raw = _coalesce(norm, ["debito", "debit", "saida", "pagamento"])
        type_raw = _coalesce(norm, ["tipo", "natureza", "dc", "type"])

        movement_date = _parse_flexible_date(date_raw)
        if movement_date is None:
            continue

        amount = _parse_amount_any(amount_raw)
        if amount is None:
            credit = _parse_amount_any(credit_raw) or 0.0
            debit = _parse_amount_any(debit_raw) or 0.0
            if abs(credit) <= 0.000001 and abs(debit) <= 0.000001:
                continue
            amount = float(credit) - float(debit)

        direction = "receivable" if amount >= 0 else "payable"
        t = str(type_raw or "").strip().lower()
        if t in ("d", "debito", "debito/saida", "saida", "pagamento", "out"):
            direction = "payable"
        elif t in ("c", "credito", "entrada", "recebimento", "in"):
            direction = "receivable"

        out.append(
            {
                "row_index": idx,
                "movement_date": movement_date.strftime("%Y-%m-%d"),
                "description": _as_str(desc_raw) or "",
                "doc_number": _as_str(doc_raw) or "",
                "amount_brl": round(abs(float(amount)), 2),
                "direction": direction,
            }
        )

    return out


def _collect_reconciliation_candidates(session: Session) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for kind, ev_type in (("payable", "cost"), ("receivable", "exit")):
        events = list(session.exec(select(Event).where(Event.type == ev_type).order_by(Event.occurred_at.desc())).all())
        for ev in events:
            item = _serialize_title(ev, kind)
            if float(item.get("settled_brl") or 0.0) <= 0.000001:
                continue
            if str(item.get("reconciliation_status") or "") == "reconciled":
                continue
            rows.append(item)
    return rows


def _score_match(
    movement: Dict[str, Any],
    candidate: Dict[str, Any],
    tolerance_brl: float,
    date_window_days: int,
) -> Tuple[int, List[str]]:
    score = 0
    reasons: List[str] = []
    mv_amount = float(movement.get("amount_brl") or 0.0)
    cand_settled = float(candidate.get("settled_brl") or 0.0)
    cand_total = float(candidate.get("total_brl") or 0.0)

    if abs(cand_settled - mv_amount) <= tolerance_brl:
        score += 70
        reasons.append("valor baixado exato")
    elif abs(cand_total - mv_amount) <= tolerance_brl:
        score += 55
        reasons.append("valor total exato")
    elif cand_settled > 0 and abs(cand_settled - mv_amount) <= max(1.0, tolerance_brl * 10):
        score += 30
        reasons.append("valor aproximado")
    else:
        return 0, ["valor incompatível"]

    mv_doc = str(movement.get("doc_number") or "").strip().lower()
    cand_doc = str(candidate.get("doc_number") or "").strip().lower()
    if mv_doc and cand_doc and mv_doc == cand_doc:
        score += 25
        reasons.append("documento igual")

    mv_date = _parse_flexible_date(movement.get("movement_date"))
    dates_to_compare = [
        _parse_flexible_date(candidate.get("settled_on")),
        _parse_flexible_date(candidate.get("due_date")),
        _parse_flexible_date(candidate.get("date")),
    ]
    date_diff = None
    if mv_date:
        for d in dates_to_compare:
            if d is None:
                continue
            delta = abs((mv_date - d).days)
            if date_diff is None or delta < date_diff:
                date_diff = delta

    if date_diff is not None and date_diff <= date_window_days:
        if date_diff == 0:
            score += 15
            reasons.append("data igual")
        elif date_diff <= 3:
            score += 10
            reasons.append("data próxima")
        else:
            score += 6
            reasons.append("data compatível")

    desc = str(movement.get("description") or "").lower()
    person = str(candidate.get("person_name") or "").lower()
    if desc and person and person in desc:
        score += 8
        reasons.append("nome no histórico")

    return score, reasons


def _preview_reconciliation(
    session: Session,
    movement_rows: List[Dict[str, Any]],
    tolerance_brl: float,
    date_window_days: int,
) -> Dict[str, Any]:
    candidates = _collect_reconciliation_candidates(session)
    items: List[Dict[str, Any]] = []
    matched = 0
    ambiguous = 0
    unmatched = 0

    for mv in movement_rows:
        direction = str(mv.get("direction") or "")
        filtered = [c for c in candidates if str(c.get("kind") or "") == direction]
        scored: List[Tuple[int, Dict[str, Any], List[str]]] = []
        for cand in filtered:
            score, reasons = _score_match(mv, cand, tolerance_brl=tolerance_brl, date_window_days=date_window_days)
            if score > 0:
                scored.append((score, cand, reasons))

        scored.sort(key=lambda x: x[0], reverse=True)
        status = "unmatched"
        best_match = None
        alternatives = []

        if scored:
            top_score = scored[0][0]
            top = [s for s in scored if s[0] == top_score]
            if len(top) == 1 and top_score >= 60:
                status = "matched"
                matched += 1
                b_score, b_cand, b_reasons = top[0]
                best_match = {
                    "event_id": int(b_cand.get("event_id") or 0),
                    "kind": str(b_cand.get("kind") or ""),
                    "person_name": str(b_cand.get("person_name") or ""),
                    "doc_number": str(b_cand.get("doc_number") or ""),
                    "due_date": str(b_cand.get("due_date") or ""),
                    "settled_on": str(b_cand.get("settled_on") or ""),
                    "total_brl": float(b_cand.get("total_brl") or 0.0),
                    "settled_brl": float(b_cand.get("settled_brl") or 0.0),
                    "score": int(b_score),
                    "reasons": b_reasons,
                }
            else:
                status = "ambiguous"
                ambiguous += 1
                for s, cand, rs in scored[:5]:
                    alternatives.append(
                        {
                            "event_id": int(cand.get("event_id") or 0),
                            "kind": str(cand.get("kind") or ""),
                            "person_name": str(cand.get("person_name") or ""),
                            "doc_number": str(cand.get("doc_number") or ""),
                            "score": int(s),
                            "reasons": rs,
                        }
                    )
        if status == "unmatched":
            unmatched += 1

        items.append(
            {
                "row_index": int(mv.get("row_index") or 0),
                "movement_date": str(mv.get("movement_date") or ""),
                "description": str(mv.get("description") or ""),
                "doc_number": str(mv.get("doc_number") or ""),
                "amount_brl": float(mv.get("amount_brl") or 0.0),
                "direction": direction,
                "status": status,
                "match": best_match,
                "alternatives": alternatives,
            }
        )

    return {
        "items": items,
        "summary": {
            "rows": len(items),
            "matched": matched,
            "ambiguous": ambiguous,
            "unmatched": max(unmatched, 0),
        },
    }


def _sum_title_rows(rows: List[Dict[str, Any]], field: str) -> float:
    return round(sum(float(x.get(field) or 0.0) for x in rows), 2)


def _close_month_snapshot(session: Session, month: str) -> Dict[str, Any]:
    ap = _list_titles(kind="payable", session=session, competence_month=month, limit=5000)
    ar = _list_titles(kind="receivable", session=session, competence_month=month, limit=5000)

    ap_open = [x for x in ap if x.get("status") in ("open", "overdue")]
    ar_open = [x for x in ar if x.get("status") in ("open", "overdue")]
    ap_overdue = [x for x in ap if x.get("status") == "overdue"]
    ar_overdue = [x for x in ar if x.get("status") == "overdue"]
    ap_pending_approval = [x for x in ap if x.get("approval_status") == "pending"]
    ar_pending_approval = [x for x in ar if x.get("approval_status") == "pending"]
    ap_pending_reconciliation = [x for x in ap if x.get("reconciliation_status") == "pending"]
    ar_pending_reconciliation = [x for x in ar if x.get("reconciliation_status") == "pending"]

    return {
        "ok": True,
        "month": month,
        "payable": {
            "count": len(ap),
            "total_brl": _sum_title_rows(ap, "total_brl"),
            "settled_brl": _sum_title_rows(ap, "settled_brl"),
            "remaining_brl": _sum_title_rows(ap, "remaining_brl"),
            "open_count": len(ap_open),
            "open_brl": _sum_title_rows(ap_open, "remaining_brl"),
            "overdue_count": len(ap_overdue),
            "overdue_brl": _sum_title_rows(ap_overdue, "remaining_brl"),
            "pending_approval_count": len(ap_pending_approval),
            "pending_approval_brl": _sum_title_rows(ap_pending_approval, "remaining_brl"),
            "pending_reconciliation_count": len(ap_pending_reconciliation),
            "pending_reconciliation_brl": _sum_title_rows(ap_pending_reconciliation, "settled_brl"),
        },
        "receivable": {
            "count": len(ar),
            "total_brl": _sum_title_rows(ar, "total_brl"),
            "settled_brl": _sum_title_rows(ar, "settled_brl"),
            "remaining_brl": _sum_title_rows(ar, "remaining_brl"),
            "open_count": len(ar_open),
            "open_brl": _sum_title_rows(ar_open, "remaining_brl"),
            "overdue_count": len(ar_overdue),
            "overdue_brl": _sum_title_rows(ar_overdue, "remaining_brl"),
            "pending_approval_count": len(ar_pending_approval),
            "pending_approval_brl": _sum_title_rows(ar_pending_approval, "remaining_brl"),
            "pending_reconciliation_count": len(ar_pending_reconciliation),
            "pending_reconciliation_brl": _sum_title_rows(ar_pending_reconciliation, "settled_brl"),
        },
        "result": {
            "net_settled_brl": round(_sum_title_rows(ar, "settled_brl") - _sum_title_rows(ap, "settled_brl"), 2),
            "net_open_brl": round(_sum_title_rows(ar_open, "remaining_brl") - _sum_title_rows(ap_open, "remaining_brl"), 2),
        },
    }


def _serialize_close_history_item(row: FinanceMonthClose) -> Dict[str, Any]:
    return {
        "id": int(row.id or 0),
        "month": str(row.month or ""),
        "actor": str(row.actor or ""),
        "note": _as_str(row.note),
        "net_settled_brl": round(float(row.net_settled_brl or 0.0), 2),
        "net_open_brl": round(float(row.net_open_brl or 0.0), 2),
        "payable_open_brl": round(float(row.payable_open_brl or 0.0), 2),
        "receivable_open_brl": round(float(row.receivable_open_brl or 0.0), 2),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _recent_close_history(session: Session, month: str, limit: int = 6) -> List[Dict[str, Any]]:
    rows = list(
        session.exec(
            select(FinanceMonthClose)
            .where(FinanceMonthClose.month == month)
            .order_by(FinanceMonthClose.created_at.desc())
            .limit(max(1, int(limit or 6)))
        ).all()
    )
    return [_serialize_close_history_item(row) for row in rows]


def _get_month_state(session: Session, month: str) -> Optional[FinanceMonthState]:
    rows = list(
        session.exec(
            select(FinanceMonthState)
            .where(FinanceMonthState.month == month)
            .order_by(FinanceMonthState.updated_at.desc())
            .limit(1)
        ).all()
    )
    return rows[0] if rows else None


def _serialize_month_state(row: Optional[FinanceMonthState]) -> Dict[str, Any]:
    if not row:
        return {
            "month": "",
            "is_locked": False,
            "locked_by": None,
            "locked_by_role": None,
            "locked_at": None,
            "note": None,
            "updated_at": None,
        }
    return {
        "month": str(row.month or ""),
        "is_locked": bool(row.is_locked),
        "locked_by": _as_str(row.locked_by),
        "locked_by_role": _as_str(row.locked_by_role),
        "locked_at": row.locked_at.isoformat() if row.locked_at else None,
        "note": _as_str(row.note),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _assert_month_unlocked(session: Session, month: Optional[str], action: str) -> None:
    month_key = _parse_month(month, "month") if month else None
    if not month_key:
        return
    state = _get_month_state(session, month_key)
    if state and bool(state.is_locked):
        locked_at = state.locked_at.strftime("%d/%m/%Y %H:%M") if state.locked_at else "data não registrada"
        who = _as_str(state.locked_by) or "usuário não identificado"
        raise HTTPException(
            status_code=423,
            detail=f"Mês {month_key} está travado para {action}. Fechado por {who} em {locked_at}.",
        )


def _build_close_month_response(session: Session, month: str) -> Dict[str, Any]:
    summary = _close_month_snapshot(session, month)
    history = _recent_close_history(session, month, limit=8)
    return {
        **summary,
        "month_state": _serialize_month_state(_get_month_state(session, month)),
        "latest_saved": history[0] if history else None,
        "history": history,
    }


def _serialize_title(ev: Event, kind: str) -> Dict[str, Any]:
    p = dict(_payload(ev))
    amounts = _title_amounts(kind, p)
    status = _derive_status(kind, p, amounts["remaining_brl"])
    reconciliation_status = _reconciliation_status(p, amounts["settled_brl"])

    if kind == "payable":
        person_id = _as_int(p.get("supplier_id") or p.get("person_id"))
        person_name = _as_str(p.get("supplier_name") or p.get("person_name")) or ""
        settled_on = _as_str(p.get("payment_date"))
    else:
        person_id = _as_int(p.get("customer_id") or p.get("person_id"))
        person_name = _as_str(p.get("customer_name") or p.get("person_name")) or ""
        settled_on = _as_str(p.get("received_date"))

    return {
        "event_id": int(ev.id or 0),
        "kind": kind,
        "created_at": ev.created_at,
        "occurred_at": ev.occurred_at,
        "competence_month": _as_str(p.get("competence_month")),
        "due_date": _as_str(p.get("due_date")),
        "status": status,
        "person_id": person_id,
        "person_name": person_name,
        "account_code": _as_str(p.get("account_code")),
        "account_name": _as_str(p.get("account_name")),
        "category": _as_str(p.get("category")),
        "center_cost": _as_str(p.get("center_cost")) or "Fazenda",
        "doc_number": _as_str(p.get("doc_number")) or "",
        "notes": _as_str(p.get("notes")) or "",
        "total_brl": amounts["total_brl"],
        "settled_brl": amounts["settled_brl"],
        "remaining_brl": amounts["remaining_brl"],
        "settled_on": settled_on,
        "scheduled_on": _as_str(p.get("scheduled_on")),
        "schedule_method": _as_str(p.get("schedule_method")) or "",
        "schedule_bank_account_id": _as_int(p.get("schedule_bank_account_id")),
        "scheduled_by": _as_str(p.get("scheduled_by")) or "",
        "scheduled_at": _as_str(p.get("scheduled_at")),
        "requires_approval": bool(p.get("requires_approval")),
        "approval_status": _approval_status(p),
        "approval_required_by": _as_str(p.get("approval_required_by")) or "",
        "approved_by": _as_str(p.get("approved_by")) or "",
        "approved_by_role": _as_str(p.get("approved_by_role")) or "",
        "approved_at": _as_str(p.get("approved_at")),
        "approval_source": _as_str(p.get("approval_source")) or ("manual" if bool(p.get("requires_approval")) else "none"),
        "approval_policy_threshold_brl": float(_as_float(p.get("approval_policy_threshold_brl")) or 0.0),
        "approval_policy_mode": _as_str(p.get("approval_policy_mode")) or "threshold",
        "is_reconciled": reconciliation_status == "reconciled",
        "reconciliation_status": reconciliation_status,
        "reconciled_on": _as_str(p.get("reconciled_on")),
        "reconciled_by": _as_str(p.get("reconciled_by")) or "",
        "reconciled_at": _as_str(p.get("reconciled_at")),
        "settlements": p.get("settlements") if isinstance(p.get("settlements"), list) else [],
    }


def _list_titles(
    kind: str,
    session: Session,
    status: Optional[str] = None,
    person_id: Optional[int] = None,
    category: Optional[str] = None,
    center_cost: Optional[str] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None,
    competence_month: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    ev_type = "cost" if kind == "payable" else "exit"
    rows = list(session.exec(select(Event).where(Event.type == ev_type).order_by(Event.occurred_at.desc())).all())

    due_from_d = _parse_ymd(due_from, "due_from", required=False)
    due_to_d = _parse_ymd(due_to, "due_to", required=False)
    cm = _parse_month(competence_month, "competence_month") if competence_month else None

    out: List[Dict[str, Any]] = []
    q_norm = str(q or "").strip().lower()

    for ev in rows:
        row = _serialize_title(ev, kind)

        if status and status != "ALL" and str(row["status"]).lower() != str(status).lower():
            continue
        if person_id is not None and int(row.get("person_id") or 0) != int(person_id):
            continue
        if category and str(row.get("category") or "").strip().lower() != str(category).strip().lower():
            continue
        if center_cost and str(row.get("center_cost") or "").strip().lower() != str(center_cost).strip().lower():
            continue
        if cm and str(row.get("competence_month") or "") != cm:
            continue

        due_s = row.get("due_date")
        due_d = _parse_ymd(due_s, "due_date", required=False)
        if due_from_d and (not due_d or due_d < due_from_d):
            continue
        if due_to_d and (not due_d or due_d > due_to_d):
            continue

        if q_norm:
            hay = " ".join(
                [
                    str(row.get("person_name") or ""),
                    str(row.get("account_code") or ""),
                    str(row.get("account_name") or ""),
                    str(row.get("category") or ""),
                    str(row.get("center_cost") or ""),
                    str(row.get("doc_number") or ""),
                    str(row.get("notes") or ""),
                ]
            ).lower()
            if q_norm not in hay:
                continue

        out.append(row)
        if len(out) >= int(limit):
            break

    return out


def _settle_title(session: Session, event_id: int, kind: str, body: Dict[str, Any], action: str) -> Dict[str, Any]:
    ev = session.get(Event, int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="titulo nao encontrado")

    expected_type = "cost" if kind == "payable" else "exit"
    if str(ev.type or "").lower() != expected_type:
        raise HTTPException(status_code=422, detail="tipo de titulo invalido para esta operacao")

    # Importante: copia defensiva para nao mutar o dict JSON original em-place
    p = dict(_payload(ev))
    _assert_month_unlocked(session, _as_str(p.get("competence_month")), "liquidação")
    amounts = _title_amounts(kind, p)
    remaining = amounts["remaining_brl"]
    approval_state = _approval_status(p)
    if approval_state == "pending":
        raise HTTPException(status_code=422, detail="titulo pendente de aprovacao")
    if approval_state == "rejected":
        raise HTTPException(status_code=422, detail="titulo rejeitado. nao pode liquidar")

    if remaining <= 0.000001:
        raise HTTPException(status_code=422, detail="titulo ja liquidado")

    amount_brl = _as_float(body.get("amount_brl"))
    if amount_brl is None:
        amount_brl = remaining
    if amount_brl <= 0:
        raise HTTPException(status_code=422, detail="amount_brl deve ser maior que zero")
    if amount_brl - remaining > 0.000001:
        raise HTTPException(status_code=422, detail="amount_brl maior que saldo em aberto")

    settle_on = _parse_ymd(body.get("settled_on") or body.get("date"), "settled_on", required=False) or date.today()
    settle_on_s = settle_on.strftime("%Y-%m-%d")

    settlements = p.get("settlements")
    if not isinstance(settlements, list):
        settlements = []

    entry = {
        "idx": len(settlements) + 1,
        "at": datetime.utcnow().isoformat(),
        "date": settle_on_s,
        "amount_brl": round(float(amount_brl), 2),
        "method": _as_str(body.get("method")) or _as_str(body.get("payment_method")) or "manual",
        "method_id": _as_int(body.get("method_id")),
        "bank_account_id": _as_int(body.get("bank_account_id")),
        "note": _as_str(body.get("note")) or "",
        "actor": _as_str(body.get("actor")) or "system",
    }
    settlements.append(entry)

    new_settled = round(amounts["settled_brl"] + float(amount_brl), 2)
    if new_settled > amounts["total_brl"]:
        new_settled = amounts["total_brl"]
    new_remaining = round(max(amounts["total_brl"] - new_settled, 0.0), 2)

    p["settlements"] = settlements
    p["settled_brl"] = new_settled
    p["remaining_brl"] = new_remaining

    if bool(p.get("is_reconciled")):
        # Nova baixa apos conciliacao reabre status para reconciliar de novo.
        p["is_reconciled"] = False
        p["reconciliation_status"] = "pending"
        p["reconciled_on"] = None
        p["reconciled_by"] = ""
        p["reconciled_at"] = None

    if kind == "payable":
        p["payment_date"] = settle_on_s
        p["payment_status"] = "paid" if new_remaining <= 0.000001 else _derive_status(kind, p, new_remaining)
        p["status_label"] = p["payment_status"]
    else:
        p["received_date"] = settle_on_s
        status = "received" if new_remaining <= 0.000001 else _derive_status(kind, p, new_remaining)
        p["receive_status"] = status
        p["status_label"] = status

    _append_audit(
        p,
        action=action,
        actor=_as_str(body.get("actor")),
        details={
            "amount_brl": round(float(amount_brl), 2),
            "remaining_brl": new_remaining,
            "date": settle_on_s,
            "note": _as_str(body.get("note")) or "",
        },
    )

    ev.payload = dict(p)
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return _serialize_title(ev, kind)


def _schedule_title(session: Session, event_id: int, kind: str, body: Dict[str, Any], action: str) -> Dict[str, Any]:
    ev = session.get(Event, int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="titulo nao encontrado")

    expected_type = "cost" if kind == "payable" else "exit"
    if str(ev.type or "").lower() != expected_type:
        raise HTTPException(status_code=422, detail="tipo de titulo invalido para esta operacao")

    p = dict(_payload(ev))
    _assert_month_unlocked(session, _as_str(p.get("competence_month")), "programação")
    amounts = _title_amounts(kind, p)
    if amounts["remaining_brl"] <= 0.000001:
        raise HTTPException(status_code=422, detail="titulo ja liquidado")

    scheduled_on = _parse_ymd(body.get("scheduled_on") or body.get("scheduled_date"), "scheduled_on", required=False)
    if scheduled_on is None:
        scheduled_on = _parse_ymd(p.get("due_date"), "due_date", required=False) or date.today()
    scheduled_on_s = scheduled_on.strftime("%Y-%m-%d")

    actor = _as_str(body.get("actor")) or "system"
    note = _as_str(body.get("note")) or ""
    method = _as_str(body.get("method")) or _as_str(body.get("payment_method")) or "manual"
    bank_account_id = _as_int(body.get("bank_account_id"))

    p["scheduled_on"] = scheduled_on_s
    p["schedule_method"] = method
    p["schedule_bank_account_id"] = bank_account_id
    p["scheduled_by"] = actor
    p["scheduled_at"] = datetime.utcnow().isoformat()
    p["schedule_note"] = note

    _append_audit(
        p,
        action=action,
        actor=actor,
        details={
            "scheduled_on": scheduled_on_s,
            "method": method,
            "bank_account_id": bank_account_id,
            "note": note,
        },
    )

    ev.payload = dict(p)
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return _serialize_title(ev, kind)


def _reconcile_title(session: Session, event_id: int, kind: str, body: Dict[str, Any], action: str) -> Dict[str, Any]:
    ev = session.get(Event, int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="titulo nao encontrado")

    expected_type = "cost" if kind == "payable" else "exit"
    if str(ev.type or "").lower() != expected_type:
        raise HTTPException(status_code=422, detail="tipo de titulo invalido para esta operacao")

    p = dict(_payload(ev))
    _assert_month_unlocked(session, _as_str(p.get("competence_month")), "conciliação")
    amounts = _title_amounts(kind, p)
    if amounts["settled_brl"] <= 0.000001:
        raise HTTPException(status_code=422, detail="titulo sem baixa. nao ha o que conciliar")

    if bool(p.get("is_reconciled")):
        return _serialize_title(ev, kind)

    actor = _as_str(body.get("actor")) or "system"
    note = _as_str(body.get("note")) or ""
    reconciled_on = _parse_ymd(body.get("reconciled_on") or body.get("date"), "reconciled_on", required=False) or date.today()
    reconciled_on_s = reconciled_on.strftime("%Y-%m-%d")

    p["is_reconciled"] = True
    p["reconciliation_status"] = "reconciled"
    p["reconciled_on"] = reconciled_on_s
    p["reconciled_by"] = actor
    p["reconciled_at"] = datetime.utcnow().isoformat()
    p["reconciliation_note"] = note

    _append_audit(
        p,
        action=action,
        actor=actor,
        details={
            "reconciled_on": reconciled_on_s,
            "note": note,
        },
    )

    ev.payload = dict(p)
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return _serialize_title(ev, kind)


@router.get("/accounts-payable")
def list_accounts_payable(
    status: Optional[str] = Query(default=None, description="open|paid|overdue|ALL"),
    supplier_id: Optional[int] = None,
    category: Optional[str] = None,
    center_cost: Optional[str] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None,
    competence_month: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=3000),
    session: Session = Depends(get_session),
):
    rows = _list_titles(
        kind="payable",
        session=session,
        status=status,
        person_id=supplier_id,
        category=category,
        center_cost=center_cost,
        due_from=due_from,
        due_to=due_to,
        competence_month=competence_month,
        q=q,
        limit=limit,
    )
    return {"ok": True, "items": rows, "count": len(rows)}


@router.get("/accounts-receivable")
def list_accounts_receivable(
    status: Optional[str] = Query(default=None, description="open|received|overdue|ALL"),
    customer_id: Optional[int] = None,
    category: Optional[str] = None,
    center_cost: Optional[str] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None,
    competence_month: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=3000),
    session: Session = Depends(get_session),
):
    rows = _list_titles(
        kind="receivable",
        session=session,
        status=status,
        person_id=customer_id,
        category=category,
        center_cost=center_cost,
        due_from=due_from,
        due_to=due_to,
        competence_month=competence_month,
        q=q,
        limit=limit,
    )
    return {"ok": True, "items": rows, "count": len(rows)}


@router.post("/accounts-payable/{event_id}/pay")
def settle_accounts_payable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _settle_title(session, int(event_id), kind="payable", body=body, action="pay")
    return {"ok": True, "item": item}


@router.post("/accounts-receivable/{event_id}/receive")
def settle_accounts_receivable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _settle_title(session, int(event_id), kind="receivable", body=body, action="receive")
    return {"ok": True, "item": item}


@router.post("/accounts-payable/{event_id}/schedule")
def schedule_accounts_payable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _schedule_title(session, int(event_id), kind="payable", body=body, action="schedule_payable")
    return {"ok": True, "item": item}


@router.post("/accounts-receivable/{event_id}/schedule")
def schedule_accounts_receivable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _schedule_title(session, int(event_id), kind="receivable", body=body, action="schedule_receivable")
    return {"ok": True, "item": item}


@router.post("/accounts-payable/{event_id}/reconcile")
def reconcile_accounts_payable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _reconcile_title(session, int(event_id), kind="payable", body=body, action="reconcile_payable")
    return {"ok": True, "item": item}


@router.post("/accounts-receivable/{event_id}/reconcile")
def reconcile_accounts_receivable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _reconcile_title(session, int(event_id), kind="receivable", body=body, action="reconcile_receivable")
    return {"ok": True, "item": item}


def _normalize_statement_rows_input(rows: Any) -> List[Dict[str, Any]]:
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise HTTPException(status_code=422, detail="rows deve ser lista")

    out: List[Dict[str, Any]] = []
    for i, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        movement_date = _parse_flexible_date(row.get("movement_date") or row.get("date"))
        amount = _as_float(row.get("amount_brl") or row.get("amount"))
        if movement_date is None or amount is None or float(amount) <= 0:
            continue

        direction_raw = str(row.get("direction") or row.get("kind") or "").strip().lower()
        if direction_raw not in ("payable", "receivable"):
            direction_raw = "payable" if bool(row.get("is_debit")) else "receivable"

        out.append(
            {
                "row_index": int(_as_int(row.get("row_index")) or i),
                "movement_date": movement_date.strftime("%Y-%m-%d"),
                "description": _as_str(row.get("description")) or "",
                "doc_number": _as_str(row.get("doc_number")) or "",
                "amount_brl": round(float(amount), 2),
                "direction": direction_raw,
            }
        )
    return out


@router.post("/reconciliation/preview")
def preview_reconciliation(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    tolerance = _as_float(body.get("tolerance_brl"))
    if tolerance is None or tolerance < 0:
        tolerance = 0.05
    tolerance = float(min(max(tolerance, 0.0), 10.0))

    date_window = _as_int(body.get("date_window_days"))
    if date_window is None or date_window < 0:
        date_window = 7
    date_window = int(min(max(date_window, 0), 60))

    max_rows = _as_int(body.get("max_rows"))
    if max_rows is None or max_rows <= 0:
        max_rows = 1000
    max_rows = int(min(max(max_rows, 1), 5000))

    rows = _normalize_statement_rows_input(body.get("rows"))
    if not rows:
        csv_text = _as_str(body.get("csv_text"))
        if not csv_text:
            raise HTTPException(status_code=422, detail="informe rows ou csv_text")
        rows = _read_statement_rows(
            csv_text=csv_text,
            delimiter=_as_str(body.get("delimiter")),
            max_rows=max_rows,
        )

    preview = _preview_reconciliation(
        session=session,
        movement_rows=rows,
        tolerance_brl=tolerance,
        date_window_days=date_window,
    )

    return {
        "ok": True,
        "summary": preview["summary"],
        "items": preview["items"],
    }


@router.post("/reconciliation/apply")
def apply_reconciliation(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    actor = _as_str(body.get("actor")) or "system"

    raw_matches = body.get("matches")
    if not isinstance(raw_matches, list):
        raise HTTPException(status_code=422, detail="matches deve ser lista")

    applied: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    seen = set()

    for i, row in enumerate(raw_matches, start=1):
        if not isinstance(row, dict):
            continue

        match = row.get("match") if isinstance(row.get("match"), dict) else row
        event_id = _as_int(match.get("event_id"))
        kind = str(match.get("kind") or "").strip().lower()
        if not event_id or kind not in ("payable", "receivable"):
            skipped.append({"row_index": i, "reason": "sem event_id/kind"})
            continue

        key = f"{kind}:{event_id}"
        if key in seen:
            skipped.append({"row_index": i, "event_id": event_id, "kind": kind, "reason": "duplicado no lote"})
            continue
        seen.add(key)

        movement_date = _parse_flexible_date(row.get("movement_date") or row.get("date"))
        reconciled_on = movement_date.strftime("%Y-%m-%d") if movement_date else date.today().strftime("%Y-%m-%d")
        note = _as_str(row.get("note")) or ""
        if not note:
            note = f"Conciliação por importação CSV (row {int(_as_int(row.get('row_index')) or i)})"

        try:
            item = _reconcile_title(
                session=session,
                event_id=int(event_id),
                kind=kind,
                body={
                    "reconciled_on": reconciled_on,
                    "actor": actor,
                    "note": note,
                },
                action=f"reconcile_{kind}_import",
            )
            applied.append(
                {
                    "row_index": int(_as_int(row.get("row_index")) or i),
                    "event_id": int(event_id),
                    "kind": kind,
                    "reconciled_on": item.get("reconciled_on"),
                    "reconciliation_status": item.get("reconciliation_status"),
                }
            )
        except HTTPException as e:
            skipped.append(
                {
                    "row_index": int(_as_int(row.get("row_index")) or i),
                    "event_id": int(event_id),
                    "kind": kind,
                    "reason": str(e.detail),
                }
            )

    return {
        "ok": True,
        "summary": {
            "requested": len(raw_matches),
            "applied": len(applied),
            "skipped": len(skipped),
        },
        "applied": applied,
        "skipped": skipped,
    }


def _approve_title(session: Session, event_id: int, kind: str, body: Dict[str, Any], action: str) -> Dict[str, Any]:
    ev = session.get(Event, int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="titulo nao encontrado")

    expected_type = "cost" if kind == "payable" else "exit"
    if str(ev.type or "").lower() != expected_type:
        raise HTTPException(status_code=422, detail="tipo de titulo invalido para esta operacao")

    p = dict(_payload(ev))
    _assert_month_unlocked(session, _as_str(p.get("competence_month")), "aprovação")
    prev = _approval_status(p)
    if prev == "approved":
        return _serialize_title(ev, kind)

    actor_role_raw = _as_str(body.get("actor_role") or body.get("role"))
    actor_role: Optional[str] = None
    required_by = _approver_role(_as_str(p.get("approval_required_by")) or "gestor", default="gestor")
    if prev == "pending":
        if not actor_role_raw:
            raise HTTPException(status_code=422, detail="actor_role e obrigatorio para aprovar titulo pendente")
        actor_role = _approver_role(actor_role_raw, default="gestor")
        if not _can_actor_approve(required_by=required_by, actor_role=actor_role):
            raise HTTPException(
                status_code=403,
                detail=f"perfil {actor_role} nao pode aprovar titulo que exige {required_by}",
            )
    elif actor_role_raw:
        actor_role = _approver_role(actor_role_raw, default="gestor")

    actor = _as_str(body.get("actor")) or "system"
    note = _as_str(body.get("note")) or ""
    now_iso = datetime.utcnow().isoformat()

    p["approval_status"] = "approved"
    p["approved_by"] = actor
    p["approved_by_role"] = actor_role or ""
    p["approved_at"] = now_iso

    _append_audit(
        p,
        action=action,
        actor=actor,
        details={
            "note": note,
            "from": prev,
            "to": "approved",
            "required_by": required_by,
            "actor_role": actor_role or "",
        },
    )

    ev.payload = dict(p)
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return _serialize_title(ev, kind)


@router.post("/accounts-payable/{event_id}/approve")
def approve_accounts_payable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _approve_title(session, int(event_id), kind="payable", body=body, action="approve_payable")
    return {"ok": True, "item": item}


@router.post("/accounts-receivable/{event_id}/approve")
def approve_accounts_receivable(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")
    item = _approve_title(session, int(event_id), kind="receivable", body=body, action="approve_receivable")
    return {"ok": True, "item": item}


@router.get("/approval-policy")
def get_approval_policy(session: Session = Depends(get_session)):
    obj = _ensure_approval_policy(session)
    return {"ok": True, "item": _serialize_approval_policy(obj)}


@router.put("/approval-policy")
def update_approval_policy(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    obj = _ensure_approval_policy(session)

    if "enabled" in body:
        obj.enabled = bool(body.get("enabled"))

    if "payable_threshold_brl" in body:
        v = _as_float(body.get("payable_threshold_brl"))
        if v is None or v < 0:
            raise HTTPException(status_code=422, detail="payable_threshold_brl deve ser >= 0")
        obj.payable_threshold_brl = float(v)

    if "receivable_threshold_brl" in body:
        v = _as_float(body.get("receivable_threshold_brl"))
        if v is None or v < 0:
            raise HTTPException(status_code=422, detail="receivable_threshold_brl deve ser >= 0")
        obj.receivable_threshold_brl = float(v)

    if "payable_required_by" in body:
        obj.payable_required_by = _approver_role(body.get("payable_required_by"), default="gestor")

    if "receivable_required_by" in body:
        obj.receivable_required_by = _approver_role(body.get("receivable_required_by"), default="gestor")

    if "payable_tiers" in body:
        tiers = _parse_tiers_value(body.get("payable_tiers"), "payable_tiers")
        obj.payable_tiers_json = json.dumps(tiers, ensure_ascii=False)

    if "receivable_tiers" in body:
        tiers = _parse_tiers_value(body.get("receivable_tiers"), "receivable_tiers")
        obj.receivable_tiers_json = json.dumps(tiers, ensure_ascii=False)

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return {"ok": True, "item": _serialize_approval_policy(obj)}


@router.get("/close-month/history")
def close_month_history(
    month: str = Query(..., description="Competência YYYY-MM"),
    limit: int = Query(12, ge=1, le=36),
    session: Session = Depends(get_session),
):
    month_key = _parse_month(month, "month")
    if not month_key:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")

    return {
        "ok": True,
        "month": month_key,
        "items": _recent_close_history(session, month_key, limit=limit),
    }


@router.get("/close-month/state")
def close_month_state(
    month: str = Query(..., description="Competência YYYY-MM"),
    session: Session = Depends(get_session),
):
    month_key = _parse_month(month, "month")
    if not month_key:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")
    return {
        "ok": True,
        "month": month_key,
        "item": _serialize_month_state(_get_month_state(session, month_key)),
    }


@router.post("/close-month")
def close_month(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    month = _parse_month(body.get("month"), "month")
    if not month:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")

    return _build_close_month_response(session, month)


@router.post("/close-month/save")
def save_close_month(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    month = _parse_month(body.get("month"), "month")
    if not month:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")

    actor = _as_str(body.get("actor")) or "ui"
    note = _as_str(body.get("note"))
    snapshot = _close_month_snapshot(session, month)

    item = FinanceMonthClose(
        month=month,
        actor=actor,
        note=note,
        snapshot=snapshot,
        net_settled_brl=float(snapshot.get("result", {}).get("net_settled_brl") or 0.0),
        net_open_brl=float(snapshot.get("result", {}).get("net_open_brl") or 0.0),
        payable_open_brl=float(snapshot.get("payable", {}).get("open_brl") or 0.0),
        receivable_open_brl=float(snapshot.get("receivable", {}).get("open_brl") or 0.0),
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    response = _build_close_month_response(session, month)
    response["saved"] = _serialize_close_history_item(item)
    return response


@router.post("/close-month/lock")
def lock_close_month(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    month = _parse_month(body.get("month"), "month")
    if not month:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")

    actor = _as_str(body.get("actor")) or "ui"
    actor_role = _month_lock_role(body.get("actor_role") or body.get("role"), default="gestor")
    if actor_role not in _ALLOWED_MONTH_LOCK_ROLES:
        raise HTTPException(status_code=403, detail="perfil sem permissão para travar mês")

    note = _as_str(body.get("note"))
    now_dt = datetime.utcnow()
    state = _get_month_state(session, month)
    if state is None:
        state = FinanceMonthState(month=month)
    state.is_locked = True
    state.locked_by = actor
    state.locked_by_role = actor_role
    state.locked_at = now_dt
    state.note = note
    state.updated_at = now_dt
    session.add(state)

    snapshot = _close_month_snapshot(session, month)
    item = FinanceMonthClose(
        month=month,
        actor=actor,
        note=note or "Fechamento travado",
        snapshot=snapshot,
        net_settled_brl=float(snapshot.get("result", {}).get("net_settled_brl") or 0.0),
        net_open_brl=float(snapshot.get("result", {}).get("net_open_brl") or 0.0),
        payable_open_brl=float(snapshot.get("payable", {}).get("open_brl") or 0.0),
        receivable_open_brl=float(snapshot.get("receivable", {}).get("open_brl") or 0.0),
    )
    session.add(item)
    session.commit()
    session.refresh(state)
    session.refresh(item)

    response = _build_close_month_response(session, month)
    response["locked"] = True
    return response


@router.post("/close-month/unlock")
def unlock_close_month(payload: Dict[str, Any], session: Session = Depends(get_session)):
    body = payload or {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="payload invalido")

    month = _parse_month(body.get("month"), "month")
    if not month:
        raise HTTPException(status_code=422, detail="month e obrigatorio (YYYY-MM)")

    actor = _as_str(body.get("actor")) or "ui"
    actor_role = _month_lock_role(body.get("actor_role") or body.get("role"), default="gestor")
    if actor_role not in _ALLOWED_MONTH_LOCK_ROLES:
        raise HTTPException(status_code=403, detail="perfil sem permissão para destravar mês")

    state = _get_month_state(session, month)
    if state is None:
        state = FinanceMonthState(month=month)
    state.is_locked = False
    state.locked_by = None
    state.locked_by_role = None
    state.locked_at = None
    state.note = _as_str(body.get("note")) or "Mês reaberto"
    state.updated_at = datetime.utcnow()
    session.add(state)
    session.commit()
    session.refresh(state)

    response = _build_close_month_response(session, month)
    response["locked"] = False
    response["unlocked_by"] = actor
    response["unlocked_by_role"] = actor_role
    return response
