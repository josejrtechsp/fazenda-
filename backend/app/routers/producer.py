from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Event

router = APIRouter(prefix="/producer", tags=["producer"])

TOP5_GROUPS = [
    "Pasto",
    "Nutrição",
    "Sanidade/Reprodução",
    "Operação",
    "Máquinas/Infra/Outros",
]

GROUP_ALIASES = {
    "pasto": "Pasto",
    "pastagem": "Pasto",
    "pastagens": "Pasto",
    "nutricao": "Nutrição",
    "nutrição": "Nutrição",
    "racao": "Nutrição",
    "ração": "Nutrição",
    "sal": "Nutrição",
    "mineral": "Nutrição",
    "sanidade": "Sanidade/Reprodução",
    "reproducao": "Sanidade/Reprodução",
    "reprodução": "Sanidade/Reprodução",
    "mao de obra": "Operação",
    "mão de obra": "Operação",
    "operacao": "Operação",
    "operação": "Operação",
    "maquinas": "Máquinas/Infra/Outros",
    "máquinas": "Máquinas/Infra/Outros",
    "infra": "Máquinas/Infra/Outros",
    "outros": "Máquinas/Infra/Outros",
}

@dataclass
class MonthWindow:
    key: str
    start: datetime
    end: datetime  # exclusive


def _parse_month_key(month: Optional[str]) -> MonthWindow:
    """Parse month like YYYY-MM. Default: current month."""
    now = datetime.now()
    if not month:
        y, m = now.year, now.month
    else:
        s = month.strip()
        y, m = int(s[0:4]), int(s[5:7])
    start = datetime(y, m, 1)
    if m == 12:
        end = datetime(y + 1, 1, 1)
    else:
        end = datetime(y, m + 1, 1)
    return MonthWindow(key=f"{y:04d}-{m:02d}", start=start, end=end)


def _money(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _norm_group(raw: Any) -> str:
    s = (str(raw) if raw is not None else "").strip().lower()
    if not s:
        return "Máquinas/Infra/Outros"
    return GROUP_ALIASES.get(s, s.title() if s.title() in TOP5_GROUPS else "Máquinas/Infra/Outros")


def _extract_cost(ev: Event) -> Tuple[str, float]:
    # Expect payload: { group: 'Nutricao', value_brl: 123.45 }
    p = ev.payload or {}
    group = _norm_group(p.get("group") or p.get("categoria") or p.get("simple_group"))
    value = _money(p.get("value_brl") or p.get("value") or p.get("valor"))
    return group, value


def _extract_exit(ev: Event) -> Tuple[float, float]:
    # Expect payload: { arrobas: 10.5, value_brl: 2500 }
    p = ev.payload or {}
    arrobas = _money(p.get("arrobas") or p.get("@") or p.get("arroba"))
    if arrobas <= 0:
        # fallback: weight_kg
        weight_kg = _money(p.get("weight_kg") or p.get("peso_kg") or p.get("peso"))
        if weight_kg > 0:
            arrobas = weight_kg / 15.0
    value = _money(p.get("value_brl") or p.get("valor_brl") or p.get("valor") or p.get("total_brl"))
    return arrobas, value


def _month_label(key: str) -> str:
    # YYYY-MM -> "Jan/2026" in pt-BR
    y, m = int(key[0:4]), int(key[5:7])
    meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return f"{meses[m-1]}/{y}"


def _calc_month(session: Session, win: MonthWindow) -> Dict[str, Any]:
    # Approved only for KPI
    cost_stmt = (
        select(Event)
        .where(Event.type == "cost")
        .where(Event.status == "approved")
        .where(Event.occurred_at >= win.start)
        .where(Event.occurred_at < win.end)
    )
    exit_stmt = (
        select(Event)
        .where(Event.type == "exit")
        .where(Event.status == "approved")
        .where(Event.occurred_at >= win.start)
        .where(Event.occurred_at < win.end)
    )

    costs = session.exec(cost_stmt).all()
    exits = session.exec(exit_stmt).all()

    group_totals = {g: 0.0 for g in TOP5_GROUPS}
    other_total = 0.0
    for ev in costs:
        g, v = _extract_cost(ev)
        if g in group_totals:
            group_totals[g] += v
        else:
            other_total += v

    if other_total:
        group_totals["Máquinas/Infra/Outros"] += other_total

    cost_total = sum(group_totals.values())

    arrobas_total = 0.0
    revenue_total = 0.0
    for ev in exits:
        a, v = _extract_exit(ev)
        arrobas_total += a
        revenue_total += v

    cost_per_arroba = (cost_total / arrobas_total) if arrobas_total > 0 else None
    price_per_arroba = (revenue_total / arrobas_total) if arrobas_total > 0 and revenue_total > 0 else None
    margin_per_arroba = (price_per_arroba - cost_per_arroba) if (price_per_arroba is not None and cost_per_arroba is not None) else None
    margin_total = (margin_per_arroba * arrobas_total) if margin_per_arroba is not None else None

    top_costs = [{"group": g, "value_brl": round(group_totals[g], 2)} for g in TOP5_GROUPS]

    alerts: List[Dict[str, Any]] = []
    if arrobas_total <= 0:
        alerts.append({"kind": "info", "text": "Sem @ produzida no mês. Registre saídas (venda/abate) ou pesagens para calcular R$/@."})
    if cost_total > 0 and arrobas_total > 0 and cost_per_arroba and cost_per_arroba > 200:
        alerts.append({"kind": "warn", "text": f"Custo acima de R$ 200/@ ({cost_per_arroba:.2f}/@). Verifique Nutrição e Operação."})
    if group_totals.get("Nutrição", 0) > 0 and cost_total > 0 and (group_totals["Nutrição"] / cost_total) > 0.45:
        alerts.append({"kind": "warn", "text": "Nutrição representa mais de 45% do custo do mês."})

    # Resumo em português claro (3 linhas)
    summary_lines: List[str] = []
    summary_lines.append(f"Você produziu {arrobas_total:.0f} @ no mês." if arrobas_total > 0 else "Você não registrou @ produzida neste mês.")
    if cost_per_arroba is not None:
        if price_per_arroba is not None:
            summary_lines.append(f"Seu custo foi R$ {cost_per_arroba:,.2f}/@ e seu preço médio foi R$ {price_per_arroba:,.2f}/@.".replace(",", "X").replace(".", ",").replace("X", "."))
        else:
            summary_lines.append(f"Seu custo foi R$ {cost_per_arroba:,.2f}/@.".replace(",", "X").replace(".", ",").replace("X", "."))
    else:
        summary_lines.append(f"Custo total no mês: R$ {cost_total:,.2f}.".replace(",", "X").replace(".", ",").replace("X", "."))

    # maior grupo de custo
    top_group = max(TOP5_GROUPS, key=lambda g: group_totals[g]) if cost_total > 0 else None
    if top_group and group_totals[top_group] > 0:
        summary_lines.append(f"O que mais pesou foi {top_group}.")
    else:
        summary_lines.append("Sem custos registrados neste mês.")

    return {
        "month": win.key,
        "month_label": _month_label(win.key),
        "arrobas": round(arrobas_total, 2),
        "cost_total_brl": round(cost_total, 2),
        "cost_per_arroba_brl": round(cost_per_arroba, 2) if cost_per_arroba is not None else None,
        "revenue_total_brl": round(revenue_total, 2),
        "price_per_arroba_brl": round(price_per_arroba, 2) if price_per_arroba is not None else None,
        "margin_per_arroba_brl": round(margin_per_arroba, 2) if margin_per_arroba is not None else None,
        "margin_total_brl": round(margin_total, 2) if margin_total is not None else None,
        "top_costs": top_costs,
        "alerts": alerts[:5],
        "summary_lines": summary_lines[:3],
    }


def _last_n_month_keys(win: MonthWindow, n: int = 6) -> List[str]:
    y, m = int(win.key[0:4]), int(win.key[5:7])
    out = []
    for i in range(n-1, -1, -1):
        mm = m - i
        yy = y
        while mm <= 0:
            mm += 12
            yy -= 1
        out.append(f"{yy:04d}-{mm:02d}")
    return out


@router.get("/monthly-summary")
def monthly_summary(
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
    session: Session = Depends(get_session),
):
    win = _parse_month_key(month)
    current = _calc_month(session, win)

    # Trend last 6 months
    trend = []
    for mk in _last_n_month_keys(win, 6):
        w = _parse_month_key(mk)
        mdata = _calc_month(session, w)
        trend.append({
            "month": mdata["month"],
            "month_label": mdata["month_label"],
            "arrobas": mdata["arrobas"],
            "cost_per_arroba_brl": mdata["cost_per_arroba_brl"],
        })

    return {
        **current,
        "trend": trend,
        "groups": TOP5_GROUPS,
    }


def _format_brl_pt(v: float) -> str:
    try:
        s = f"{float(v):,.2f}"
    except Exception:
        s = "0,00"
    # swap separators: 1,234.56 -> 1.234,56
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _format_num_pt(v: float) -> str:
    try:
        s = f"{float(v):,.0f}"
    except Exception:
        s = "0"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return s


@router.get("/monthly-summary-text")
def monthly_summary_text(
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
    session: Session = Depends(get_session),
):
    """Retorna um texto pronto (WhatsApp) com o resumo do mês."""
    win = _parse_month_key(month)
    current = _calc_month(session, win)

    arrobas = float(current.get("arrobas") or 0.0)
    cost_total = float(current.get("cost_total_brl") or 0.0)
    cost_per = current.get("cost_per_arroba_brl")
    price_per = current.get("price_per_arroba_brl")
    margin_per = current.get("margin_per_arroba_brl")

    # Top custos (apenas os > 0), ordenados
    top = []
    for it in current.get("top_costs") or []:
        try:
            g = it.get("group")
            v = float(it.get("value_brl") or 0.0)
            if v > 0 and g:
                top.append((g, v))
        except Exception:
            pass
    top.sort(key=lambda x: x[1], reverse=True)
    top = top[:3]

    lines = []
    lines.append(f"📊 Resumo {current.get('month_label')}")
    lines.append(f"• @ produzidas: {_format_num_pt(arrobas)} @")
    lines.append(f"• Custo total: {_format_brl_pt(cost_total)}")
    if cost_per is not None and arrobas > 0:
        lines.append(f"• Custo: {_format_brl_pt(float(cost_per))}/@")
    else:
        lines.append("• Custo: — (sem @ no mês)")
    if price_per is not None and arrobas > 0:
        lines.append(f"• Preço médio: {_format_brl_pt(float(price_per))}/@")
    if margin_per is not None and arrobas > 0:
        lines.append(f"• Margem: {_format_brl_pt(float(margin_per))}/@")

    if top:
        lines.append("\nTop custos:")
        for i, (g, v) in enumerate(top, 1):
            lines.append(f"{i}) {g}: {_format_brl_pt(v)}")

    # Alertas (se houver)
    alerts = current.get("alerts") or []
    if alerts:
        lines.append("\nAvisos:")
        for a in alerts[:2]:
            txt = a.get("text") if isinstance(a, dict) else str(a)
            if txt:
                lines.append(f"• {txt}")

    text = "\n".join(lines).strip() + "\n"

    return {"month": current.get("month"), "text": text}
