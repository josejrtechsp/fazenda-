#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


def _http_get(base: str, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    query = ""
    if params:
        query = "?" + urllib.parse.urlencode(params)
    url = f"{base}{path}{query}"
    req = urllib.request.Request(url=url, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data) if data else {}


def _http_post(base: str, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{base}{path}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        method="POST",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data) if data else {}


def _http_put(base: str, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{base}{path}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        method="PUT",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data) if data else {}


def _http_post_expect_http_error(base: str, path: str, payload: Dict[str, Any]) -> Tuple[int, str]:
    try:
        _http_post(base, path, payload)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        return int(e.code), body
    raise AssertionError("Era esperado erro HTTP, mas a chamada retornou sucesso.")


def _get_accounts(base: str) -> Tuple[str, str]:
    rows = _http_get(
        base,
        "/accounts",
        {"level": 4, "include_inactive": "false", "limit": 5000},
    )
    items = rows if isinstance(rows, list) else []
    cost_code = ""
    rev_code = ""
    for a in items:
        cat = str(a.get("category") or "").upper()
        code = str(a.get("code") or "")
        if not cost_code and cat == "DESPESA":
            cost_code = code
        if not rev_code and cat == "RECEITA":
            rev_code = code
        if cost_code and rev_code:
            break
    if not cost_code or not rev_code:
        raise RuntimeError("Nao foi possivel localizar contas de nivel 4 para DESPESA e RECEITA.")
    return cost_code, rev_code


def _pick_person(base: str, role: str) -> int:
    rows = _http_get(
        base,
        "/people",
        {"role": role, "include_inactive": "false", "limit": 3000},
    )
    items = rows if isinstance(rows, list) else []
    if not items:
        _http_post(base, "/people/seed-demo", {})
        rows = _http_get(
            base,
            "/people",
            {"role": role, "include_inactive": "false", "limit": 3000},
        )
        items = rows if isinstance(rows, list) else []
    if not items:
        raise RuntimeError(f"Nao foi possivel localizar pessoa com role={role}.")
    return int(items[0]["id"])


def _restore_policy(base: str, original_item: Dict[str, Any]) -> None:
    payload = {
        "enabled": bool(original_item.get("enabled")),
        "payable_threshold_brl": float(original_item.get("payable_threshold_brl") or 0.0),
        "receivable_threshold_brl": float(original_item.get("receivable_threshold_brl") or 0.0),
        "payable_required_by": str(original_item.get("payable_required_by") or "gestor"),
        "receivable_required_by": str(original_item.get("receivable_required_by") or "gestor"),
        "payable_tiers": original_item.get("payable_tiers") if isinstance(original_item.get("payable_tiers"), list) else [],
        "receivable_tiers": original_item.get("receivable_tiers") if isinstance(original_item.get("receivable_tiers"), list) else [],
    }
    _http_put(base, "/finance/approval-policy", payload)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def _find_item(items: List[Dict[str, Any]], token: str) -> Dict[str, Any]:
    for it in items:
        notes = str(it.get("notes") or "")
        if token in notes:
            return it
    raise AssertionError(f"Titulo com token {token} nao encontrado.")


def run(base: str) -> None:
    _http_get(base, "/health")
    original = _http_get(base, "/finance/approval-policy")
    original_item = original.get("item") if isinstance(original, dict) else {}
    if not isinstance(original_item, dict):
        raise RuntimeError("Falha ao ler politica de aprovacao atual.")

    cost_code, rev_code = _get_accounts(base)
    supplier_id = _pick_person(base, "supplier")
    customer_id = _pick_person(base, "customer")

    token = f"qa-tier-{int(time.time())}"
    cost_low_token = f"{token}-cost-low"
    cost_high_token = f"{token}-cost-high"
    rev_high_token = f"{token}-rev-high"

    try:
        _http_put(
            base,
            "/finance/approval-policy",
            {
                "enabled": True,
                "payable_tiers": [
                    {"min_brl": 5000, "required_by": "gestor"},
                    {"min_brl": 20000, "required_by": "admin"},
                ],
                "receivable_tiers": [
                    {"min_brl": 10000, "required_by": "financeiro"},
                ],
            },
        )

        _http_post(
            base,
            "/events/finance/cost",
            {
                "date": "2026-03-03",
                "due_date": "2026-03-03",
                "competence_month": "2026-03",
                "account_code": cost_code,
                "supplier_id": supplier_id,
                "category": "QA",
                "center_cost": "Fazenda",
                "cost_kind": "operational",
                "status": "open",
                "value_brl": 3000,
                "notes": cost_low_token,
            },
        )

        _http_post(
            base,
            "/events/finance/cost",
            {
                "date": "2026-03-03",
                "due_date": "2026-03-03",
                "competence_month": "2026-03",
                "account_code": cost_code,
                "supplier_id": supplier_id,
                "category": "QA",
                "center_cost": "Fazenda",
                "cost_kind": "operational",
                "status": "open",
                "value_brl": 25000,
                "notes": cost_high_token,
            },
        )

        _http_post(
            base,
            "/events/finance/revenue",
            {
                "date": "2026-03-03",
                "due_date": "2026-03-03",
                "competence_month": "2026-03",
                "account_code": rev_code,
                "customer_id": customer_id,
                "category": "QA",
                "center_cost": "Fazenda",
                "status": "open",
                "value_brl": 15000,
                "notes": rev_high_token,
            },
        )

        ap = _http_get(base, "/finance/accounts-payable", {"q": token, "limit": 200})
        ar = _http_get(base, "/finance/accounts-receivable", {"q": token, "limit": 200})

        ap_items = ap.get("items") if isinstance(ap, dict) else []
        ar_items = ar.get("items") if isinstance(ar, dict) else []
        _assert(isinstance(ap_items, list), "Resposta invalida em contas a pagar.")
        _assert(isinstance(ar_items, list), "Resposta invalida em contas a receber.")

        low = _find_item(ap_items, cost_low_token)
        high = _find_item(ap_items, cost_high_token)
        rev = _find_item(ar_items, rev_high_token)

        _assert(bool(low.get("requires_approval")) is False, "Despesa baixa nao deveria exigir aprovacao.")
        _assert(str(low.get("approval_status")) == "approved", "Despesa baixa deveria ficar aprovada.")
        _assert(str(low.get("approval_policy_mode")) == "tier", "Despesa baixa deveria usar modo tier.")

        _assert(bool(high.get("requires_approval")) is True, "Despesa alta deveria exigir aprovacao.")
        _assert(str(high.get("approval_status")) == "pending", "Despesa alta deveria ficar pendente.")
        _assert(str(high.get("approval_required_by")) == "admin", "Despesa alta deveria exigir admin.")
        _assert(str(high.get("approval_policy_mode")) == "tier", "Despesa alta deveria usar modo tier.")

        _assert(bool(rev.get("requires_approval")) is True, "Receita alta deveria exigir aprovacao.")
        _assert(str(rev.get("approval_status")) == "pending", "Receita alta deveria ficar pendente.")
        _assert(str(rev.get("approval_required_by")) == "financeiro", "Receita alta deveria exigir financeiro.")
        _assert(str(rev.get("approval_policy_mode")) == "tier", "Receita alta deveria usar modo tier.")

        # Workflow programar -> pagar -> conciliar (payable baixo, sem aprovacao)
        low_event_id = int(low.get("event_id") or 0)
        _assert(low_event_id > 0, "Despesa baixa sem event_id.")

        _http_post(
            base,
            f"/finance/accounts-payable/{low_event_id}/schedule",
            {"scheduled_on": "2026-03-05", "method": "pix", "actor": "qa"},
        )
        ap_sched = _http_get(base, "/finance/accounts-payable", {"q": cost_low_token, "limit": 20})
        ap_sched_items = ap_sched.get("items") if isinstance(ap_sched, dict) else []
        low_sched = _find_item(ap_sched_items if isinstance(ap_sched_items, list) else [], cost_low_token)
        _assert(str(low_sched.get("scheduled_on")) == "2026-03-05", "Despesa programada deveria gravar scheduled_on.")

        _http_post(
            base,
            f"/finance/accounts-payable/{low_event_id}/pay",
            {"amount_brl": 3000, "settled_on": "2026-03-06", "method": "pix", "actor": "qa"},
        )

        csv_text = "\n".join(
            [
                "data;historico;documento;valor",
                f"2026-03-06;Baixa automatica {cost_low_token};;-3000,00",
            ]
        )
        preview = _http_post(
            base,
            "/finance/reconciliation/preview",
            {"csv_text": csv_text, "tolerance_brl": 0.05, "date_window_days": 7},
        )
        p_items = preview.get("items") if isinstance(preview, dict) else []
        _assert(isinstance(p_items, list) and len(p_items) >= 1, "Preview de conciliacao deveria retornar linhas.")
        first = p_items[0] if p_items else {}
        _assert(str(first.get("status")) == "matched", "Linha do extrato deveria casar automaticamente.")
        _assert(int(first.get("match", {}).get("event_id") or 0) == low_event_id, "Match deveria apontar para a despesa baixa.")

        _http_post(
            base,
            "/finance/reconciliation/apply",
            {
                "actor": "qa",
                "matches": [
                    {
                        "row_index": first.get("row_index"),
                        "movement_date": first.get("movement_date"),
                        "match": first.get("match"),
                    }
                ],
            },
        )
        ap_rec = _http_get(base, "/finance/accounts-payable", {"q": cost_low_token, "limit": 20})
        ap_rec_items = ap_rec.get("items") if isinstance(ap_rec, dict) else []
        low_rec = _find_item(ap_rec_items if isinstance(ap_rec_items, list) else [], cost_low_token)
        _assert(str(low_rec.get("reconciliation_status")) == "reconciled", "Despesa baixa deveria ficar conciliada.")

        # Trava de alçada por perfil: perfil errado deve falhar
        code, _ = _http_post_expect_http_error(
            base,
            f"/finance/accounts-payable/{int(high.get('event_id') or 0)}/approve",
            {"actor": "qa", "actor_role": "gestor", "note": "deve falhar"},
        )
        _assert(code == 403, "Aprovação indevida deveria retornar 403.")

        # Perfil correto aprova
        _http_post(
            base,
            f"/finance/accounts-payable/{int(high.get('event_id') or 0)}/approve",
            {"actor": "qa", "actor_role": "admin", "note": "ok"},
        )
        ap2 = _http_get(base, "/finance/accounts-payable", {"q": cost_high_token, "limit": 20})
        ap2_items = ap2.get("items") if isinstance(ap2, dict) else []
        high_after = _find_item(ap2_items if isinstance(ap2_items, list) else [], cost_high_token)
        _assert(str(high_after.get("approval_status")) == "approved", "Despesa alta deveria ficar aprovada após aprovação.")
        _assert(str(high_after.get("approved_by_role")) == "admin", "approved_by_role deveria ser admin.")

        print("OK - smoke de alcada por faixas validado com sucesso.")
        print(f"Token de teste: {token}")
        print(
            "Resultados: "
            f"cost-low={low.get('approval_status')}, "
            f"cost-high={high.get('approval_status')}({high.get('approval_required_by')}), "
            f"rev-high={rev.get('approval_status')}({rev.get('approval_required_by')})"
        )

    finally:
        _restore_policy(base, original_item)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test de alçada financeira por faixas.")
    parser.add_argument("--base", default="http://127.0.0.1:8001", help="Base URL da API backend")
    args = parser.parse_args()

    try:
        run(args.base.rstrip("/"))
        return 0
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        print(f"HTTPError: {e.code} {e.reason} {detail}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
