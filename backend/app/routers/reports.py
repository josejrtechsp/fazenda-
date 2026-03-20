from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import (
    Event,
    MachineMovement,
    ClimateRecord,
    LivestockMovement,
    HerdMonthlyStock,
    ProductiveAreaMonthly,
    ReproductionEvent,
    Task,
    Notification,
    NutritionPurchase,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_float(v: Any) -> float:
    try:
        if isinstance(v, bool) or v is None:
            return 0.0
        return float(v)
    except Exception:
        return 0.0


def _norm_text(v: Any) -> str:
    return str(v or "").strip().lower()


def _add_months(start: datetime, months: int) -> datetime:
    y = int(start.year)
    m = int(start.month) + int(months)
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    return datetime(y, m, 1)


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _month_keys_in_window(start: datetime, end: datetime) -> List[str]:
    keys: List[str] = []
    cur = datetime(start.year, start.month, 1)
    while cur < end:
        keys.append(_month_key(cur))
        cur = _add_months(cur, 1)
    return keys


def _period_window(period_type: str, year: int, period_index: int) -> Dict[str, Any]:
    p = _norm_text(period_type)
    y = int(year)
    idx = int(period_index)
    if y < 2000 or y > 2100:
        raise HTTPException(status_code=422, detail="ano inválido")

    if p in {"trimestral", "trimestre", "quarter", "quarterly"}:
        if idx < 1 or idx > 4:
            raise HTTPException(status_code=422, detail="período trimestral deve ser 1..4")
        start_month = (idx - 1) * 3 + 1
        start = datetime(y, start_month, 1)
        end = _add_months(start, 3)
        return {
            "period_type": "trimestral",
            "period_index": idx,
            "label": f"Trimestre {idx}/{y}",
            "start": start,
            "end": end,
            "month_keys": _month_keys_in_window(start, end),
        }

    if p in {"semestral", "semestre", "semester", "half-year"}:
        if idx < 1 or idx > 2:
            raise HTTPException(status_code=422, detail="período semestral deve ser 1..2")
        start_month = 1 if idx == 1 else 7
        start = datetime(y, start_month, 1)
        end = _add_months(start, 6)
        return {
            "period_type": "semestral",
            "period_index": idx,
            "label": f"Semestre {idx}/{y}",
            "start": start,
            "end": end,
            "month_keys": _month_keys_in_window(start, end),
        }

    raise HTTPException(status_code=422, detail="period_type inválido. Use trimestral ou semestral")


def _event_value_brl(payload: Dict[str, Any]) -> float:
    p = payload if isinstance(payload, dict) else {}
    return max(
        0.0,
        _to_float(
            p.get("value_brl")
            or p.get("total_brl")
            or p.get("valor_brl")
            or p.get("valor")
            or p.get("value")
        ),
    )


def _event_matches_property(ev: Event, property_name: Optional[str]) -> bool:
    prop = _norm_text(property_name)
    if not prop:
        return True
    payload = ev.payload if isinstance(ev.payload, dict) else {}
    raw = " ".join(
        [
            str(payload.get("property_name") or ""),
            str(payload.get("property") or ""),
            str(payload.get("farm") or ""),
            str(payload.get("unit") or ""),
            str(payload.get("center_cost") or ""),
        ]
    )
    return prop in _norm_text(raw)


def _csv_escape(v: Any) -> str:
    s = str(v if v is not None else "")
    if any(ch in s for ch in [",", "\n", '"']):
        return '"' + s.replace('"', '""') + '"'
    return s


def _build_report(
    session: Session,
    *,
    period_type: str,
    year: int,
    period_index: int,
    property_name: Optional[str] = None,
) -> Dict[str, Any]:
    period = _period_window(period_type, year, period_index)
    start: datetime = period["start"]
    end: datetime = period["end"]
    month_keys: List[str] = period["month_keys"]
    now = datetime.utcnow()

    export_rows: List[Dict[str, Any]] = []

    def add_row(module: str, metric: str, value: Any, unit: str = "", detail: str = "") -> None:
        export_rows.append(
            {
                "module": str(module),
                "metric": str(metric),
                "value": value,
                "unit": str(unit),
                "detail": str(detail),
            }
        )

    # ---------------------------------
    # FINANCEIRO (eventos)
    # ---------------------------------
    cost_events = list(
        session.exec(
            select(Event)
            .where(Event.type == "cost")
            .where(Event.status == "approved")
            .where(Event.occurred_at >= start)
            .where(Event.occurred_at < end)
        ).all()
    )
    cost_events = [ev for ev in cost_events if _event_matches_property(ev, property_name)]
    total_cost_brl = sum(_event_value_brl(ev.payload if isinstance(ev.payload, dict) else {}) for ev in cost_events)

    revenue_types = ["revenue", "receipt", "sale", "income", "exit"]
    revenue_events = list(
        session.exec(
            select(Event)
            .where(Event.type.in_(revenue_types))
            .where(Event.status == "approved")
            .where(Event.occurred_at >= start)
            .where(Event.occurred_at < end)
        ).all()
    )
    revenue_events = [ev for ev in revenue_events if _event_matches_property(ev, property_name)]
    total_revenue_brl = sum(_event_value_brl(ev.payload if isinstance(ev.payload, dict) else {}) for ev in revenue_events)

    finance = {
        "cost_events": len(cost_events),
        "revenue_events": len(revenue_events),
        "total_cost_brl": round(total_cost_brl, 2),
        "total_revenue_brl": round(total_revenue_brl, 2),
        "margin_brl": round(total_revenue_brl - total_cost_brl, 2),
    }
    add_row("finance", "eventos_despesa", finance["cost_events"], "eventos")
    add_row("finance", "eventos_receita", finance["revenue_events"], "eventos")
    add_row("finance", "despesa_total", finance["total_cost_brl"], "BRL")
    add_row("finance", "receita_total", finance["total_revenue_brl"], "BRL")
    add_row("finance", "margem", finance["margin_brl"], "BRL")

    # ---------------------------------
    # MÁQUINAS
    # ---------------------------------
    machine_rows = list(
        session.exec(
            select(MachineMovement)
            .where(MachineMovement.occurred_at >= start)
            .where(MachineMovement.occurred_at < end)
        ).all()
    )
    machine_by_type: Dict[str, float] = defaultdict(float)
    for r in machine_rows:
        machine_by_type[str(r.movement_type or "OUTRO").upper()] += max(0.0, float(r.value_brl or 0.0))
    machine_total = round(sum(machine_by_type.values()), 2)
    machines = {
        "events": len(machine_rows),
        "total_brl": machine_total,
        "by_type": [{"type": k, "value_brl": round(v, 2)} for k, v in sorted(machine_by_type.items())],
    }
    add_row("machines", "movimentacoes", machines["events"], "eventos")
    add_row("machines", "custo_total", machines["total_brl"], "BRL")
    for item in machines["by_type"]:
        add_row("machines", "custo_por_tipo", item["value_brl"], "BRL", item["type"])

    # ---------------------------------
    # CLIMA
    # ---------------------------------
    climate_stmt = select(ClimateRecord).where(ClimateRecord.reference_month.in_(month_keys))
    if property_name:
        climate_stmt = climate_stmt.where(ClimateRecord.property_name == str(property_name).strip())
    climate_rows = list(session.exec(climate_stmt).all())
    rain_by_month: Dict[str, float] = defaultdict(float)
    for r in climate_rows:
        rain_by_month[str(r.reference_month)] += max(0.0, float(r.rain_mm or 0.0))
    climate_series = [{"month": mk, "rain_mm": round(rain_by_month.get(mk, 0.0), 2)} for mk in month_keys]
    climate = {
        "records": len(climate_rows),
        "total_rain_mm": round(sum(v["rain_mm"] for v in climate_series), 2),
        "series": climate_series,
    }
    add_row("climate", "registros", climate["records"], "registros")
    add_row("climate", "chuva_total", climate["total_rain_mm"], "mm")
    for item in climate["series"]:
        add_row("climate", "chuva_mensal", item["rain_mm"], "mm", item["month"])

    # ---------------------------------
    # PECUÁRIA - MOVIMENTAÇÕES
    # ---------------------------------
    livestock_stmt = (
        select(LivestockMovement)
        .where(LivestockMovement.occurred_at >= start)
        .where(LivestockMovement.occurred_at < end)
    )
    if property_name:
        livestock_stmt = livestock_stmt.where(LivestockMovement.property_name == str(property_name).strip())
    livestock_rows = list(session.exec(livestock_stmt).all())
    entered = 0
    exited = 0
    process = 0
    by_movement_type: Dict[str, int] = defaultdict(int)
    for r in livestock_rows:
        heads = max(0, int(r.heads or 0))
        by_movement_type[str(r.movement_type or "OUTRO").upper()] += heads
        d = _norm_text(r.direction)
        if d == "entrada":
            entered += heads
        elif d == "saida":
            exited += heads
        else:
            process += heads
    livestock = {
        "events": len(livestock_rows),
        "entered_heads": entered,
        "exited_heads": exited,
        "process_heads": process,
        "net_heads": entered - exited,
        "by_type_heads": [{"movement_type": k, "heads": int(v)} for k, v in sorted(by_movement_type.items())],
    }
    add_row("livestock", "eventos", livestock["events"], "eventos")
    add_row("livestock", "cabecas_entrada", livestock["entered_heads"], "cabecas")
    add_row("livestock", "cabecas_saida", livestock["exited_heads"], "cabecas")
    add_row("livestock", "cabecas_saldo", livestock["net_heads"], "cabecas")

    # ---------------------------------
    # EFETIVO MENSAL
    # ---------------------------------
    stock_stmt = select(HerdMonthlyStock).where(HerdMonthlyStock.reference_month.in_(month_keys))
    if property_name:
        stock_stmt = stock_stmt.where(HerdMonthlyStock.property_name == str(property_name).strip())
    stock_rows = list(session.exec(stock_stmt).all())
    heads_by_month: Dict[str, int] = defaultdict(int)
    category_totals: Dict[str, int] = defaultdict(int)
    total_weight_period = 0.0
    for r in stock_rows:
        mk = str(r.reference_month or "")
        heads = max(0, int(r.heads or 0))
        heads_by_month[mk] += heads
        category_totals[str(r.category or "SEM_CATEGORIA").upper()] += heads
        total_weight_period += max(0.0, float(r.total_weight_kg or 0.0))
    latest_month = ""
    latest_heads = 0
    for mk in month_keys:
        if heads_by_month.get(mk, 0) > 0:
            latest_month = mk
            latest_heads = heads_by_month.get(mk, 0)
    months_count = len(month_keys) if month_keys else 1
    stock = {
        "records": len(stock_rows),
        "avg_heads_period": round(sum(heads_by_month.get(mk, 0) for mk in month_keys) / months_count, 2),
        "latest_heads": int(latest_heads),
        "latest_month": latest_month,
        "total_weight_kg_period": round(total_weight_period, 2),
        "heads_by_month": [{"month": mk, "heads": int(heads_by_month.get(mk, 0))} for mk in month_keys],
        "by_category_heads": [{"category": k, "heads": int(v)} for k, v in sorted(category_totals.items())],
    }
    add_row("stock", "registros", stock["records"], "registros")
    add_row("stock", "media_cabecas_periodo", stock["avg_heads_period"], "cabecas")
    add_row("stock", "cabecas_ultimo_mes", stock["latest_heads"], "cabecas", stock["latest_month"])
    add_row("stock", "peso_total_periodo", stock["total_weight_kg_period"], "kg")
    for item in stock["heads_by_month"]:
        add_row("stock", "cabecas_mensal", item["heads"], "cabecas", item["month"])

    # ---------------------------------
    # ÁREAS PRODUTIVAS
    # ---------------------------------
    areas_stmt = select(ProductiveAreaMonthly).where(ProductiveAreaMonthly.reference_month.in_(month_keys))
    if property_name:
        areas_stmt = areas_stmt.where(ProductiveAreaMonthly.property_name == str(property_name).strip())
    area_rows = list(session.exec(areas_stmt).all())
    area_by_type: Dict[str, float] = defaultdict(float)
    area_by_month: Dict[str, float] = defaultdict(float)
    for r in area_rows:
        area = max(0.0, float(r.area_ha or 0.0))
        area_by_type[str(r.area_type or "OUTRA").upper()] += area
        area_by_month[str(r.reference_month or "")] += area
    areas = {
        "records": len(area_rows),
        "total_area_ha": round(sum(area_by_type.values()), 2),
        "avg_area_ha_month": round(sum(area_by_month.get(mk, 0.0) for mk in month_keys) / months_count, 2),
        "by_type": [{"area_type": k, "area_ha": round(v, 2)} for k, v in sorted(area_by_type.items())],
        "by_month": [{"month": mk, "area_ha": round(area_by_month.get(mk, 0.0), 2)} for mk in month_keys],
    }
    add_row("areas", "registros", areas["records"], "registros")
    add_row("areas", "area_total", areas["total_area_ha"], "ha")
    add_row("areas", "area_media_mensal", areas["avg_area_ha_month"], "ha")
    for item in areas["by_type"]:
        add_row("areas", "area_por_tipo", item["area_ha"], "ha", item["area_type"])

    # ---------------------------------
    # REPRODUÇÃO
    # ---------------------------------
    repro_stmt = select(ReproductionEvent).where(ReproductionEvent.reference_month.in_(month_keys))
    if property_name:
        repro_stmt = repro_stmt.where(ReproductionEvent.property_name == str(property_name).strip())
    repro_rows = list(session.exec(repro_stmt).all())
    repro_by_type: Dict[str, int] = defaultdict(int)
    repro_by_result: Dict[str, int] = defaultdict(int)
    repro_heads = 0
    for r in repro_rows:
        heads = max(0, int(r.heads_involved or 0))
        repro_heads += heads
        repro_by_type[str(r.event_type or "OUTRO").upper()] += heads if heads > 0 else 1
        res = _norm_text(r.result)
        if res:
            repro_by_result[res] += heads if heads > 0 else 1
    reproduction = {
        "events": len(repro_rows),
        "heads_involved": repro_heads,
        "by_type": [{"event_type": k, "value": int(v)} for k, v in sorted(repro_by_type.items())],
        "by_result": [{"result": k, "value": int(v)} for k, v in sorted(repro_by_result.items())],
    }
    add_row("reproduction", "eventos", reproduction["events"], "eventos")
    add_row("reproduction", "cabecas_envolvidas", reproduction["heads_involved"], "cabecas")
    for item in reproduction["by_type"]:
        add_row("reproduction", "tipo_evento", item["value"], "indice", item["event_type"])

    # ---------------------------------
    # NUTRIÇÃO (compras)
    # ---------------------------------
    nutrition_rows = list(
        session.exec(
            select(NutritionPurchase)
            .where(NutritionPurchase.purchased_at >= start)
            .where(NutritionPurchase.purchased_at < end)
        ).all()
    )
    nutrition_total_brl = 0.0
    nutrition_total_qty = 0.0
    for r in nutrition_rows:
        nutrition_total_brl += max(0.0, float(r.total_brl or 0.0))
        nutrition_total_qty += max(0.0, float(r.qty or 0.0))
    nutrition = {
        "purchases": len(nutrition_rows),
        "total_brl": round(nutrition_total_brl, 2),
        "total_qty": round(nutrition_total_qty, 2),
    }
    add_row("nutrition", "compras", nutrition["purchases"], "compras")
    add_row("nutrition", "valor_total", nutrition["total_brl"], "BRL")
    add_row("nutrition", "quantidade_total", nutrition["total_qty"], "quantidade")

    # ---------------------------------
    # TAREFAS / NOTIFICAÇÕES
    # ---------------------------------
    task_rows = list(
        session.exec(
            select(Task)
            .where(Task.created_at >= start)
            .where(Task.created_at < end)
        ).all()
    )
    task_completed = sum(1 for t in task_rows if _norm_text(t.status) == "concluida")
    task_open = sum(1 for t in task_rows if _norm_text(t.status) in {"aberta", "em_andamento"})
    overdue = list(session.exec(select(Task).where(Task.due_date < now)).all())
    overdue = [t for t in overdue if _norm_text(t.status) not in {"concluida", "cancelada"}]
    tasks = {
        "created": len(task_rows),
        "completed": task_completed,
        "open": task_open,
        "overdue": len(overdue),
    }
    add_row("tasks", "criadas", tasks["created"], "tarefas")
    add_row("tasks", "concluidas", tasks["completed"], "tarefas")
    add_row("tasks", "abertas", tasks["open"], "tarefas")
    add_row("tasks", "vencidas", tasks["overdue"], "tarefas")

    notif_period = list(
        session.exec(
            select(Notification)
            .where(Notification.created_at >= start)
            .where(Notification.created_at < end)
        ).all()
    )
    notif_unread = list(session.exec(select(Notification).where(Notification.is_read == False)).all())  # noqa
    notifications = {
        "created_in_period": len(notif_period),
        "unread_total": len(notif_unread),
    }
    add_row("notifications", "criadas_no_periodo", notifications["created_in_period"], "notificacoes")
    add_row("notifications", "nao_lidas_total", notifications["unread_total"], "notificacoes")

    overview = {
        "revenue_brl": round(total_revenue_brl, 2),
        "cost_brl": round(total_cost_brl, 2),
        "margin_brl": round(total_revenue_brl - total_cost_brl, 2),
        "machine_cost_brl": round(machine_total, 2),
        "nutrition_brl": nutrition["total_brl"],
        "rain_mm": climate["total_rain_mm"],
        "livestock_net_heads": livestock["net_heads"],
        "stock_avg_heads": stock["avg_heads_period"],
        "areas_avg_ha": areas["avg_area_ha_month"],
        "tasks_created": tasks["created"],
        "tasks_overdue": tasks["overdue"],
        "notifications_unread": notifications["unread_total"],
    }
    add_row("overview", "periodo", period["label"], "", "")
    for key, value in overview.items():
        add_row("overview", key, value)

    return {
        "period": {
            "period_type": period["period_type"],
            "period_index": period["period_index"],
            "label": period["label"],
            "year": year,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "months": month_keys,
            "property_name": property_name or "",
        },
        "overview": overview,
        "modules": {
            "finance": finance,
            "machines": machines,
            "climate": climate,
            "livestock": livestock,
            "stock": stock,
            "areas": areas,
            "reproduction": reproduction,
            "nutrition": nutrition,
            "tasks": tasks,
            "notifications": notifications,
        },
        "available_modules": [
            "overview",
            "finance",
            "machines",
            "climate",
            "livestock",
            "stock",
            "areas",
            "reproduction",
            "nutrition",
            "tasks",
            "notifications",
        ],
        "export_rows": export_rows,
    }


@router.get("/overview")
def reports_overview(
    period_type: str = Query(default="trimestral"),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    period_index: int = Query(default=1),
    property_name: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    y = int(year or datetime.utcnow().year)
    return _build_report(
        session,
        period_type=period_type,
        year=y,
        period_index=int(period_index),
        property_name=property_name,
    )


@router.get("/export/csv")
def reports_export_csv(
    period_type: str = Query(default="trimestral"),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    period_index: int = Query(default=1),
    property_name: Optional[str] = Query(default=None),
    module: Optional[str] = Query(default=None, description="overview|finance|machines|..."),
    session: Session = Depends(get_session),
) -> Response:
    y = int(year or datetime.utcnow().year)
    report = _build_report(
        session,
        period_type=period_type,
        year=y,
        period_index=int(period_index),
        property_name=property_name,
    )
    rows = report.get("export_rows", [])
    if module and _norm_text(module) not in {"", "all"}:
        m = _norm_text(module)
        rows = [r for r in rows if _norm_text(r.get("module")) == m]

    header = ["module", "metric", "value", "unit", "detail"]
    lines = [",".join(header)]
    for r in rows:
        lines.append(
            ",".join(
                [
                    _csv_escape(r.get("module")),
                    _csv_escape(r.get("metric")),
                    _csv_escape(r.get("value")),
                    _csv_escape(r.get("unit")),
                    _csv_escape(r.get("detail")),
                ]
            )
        )
    content = "\ufeff" + "\n".join(lines)
    filename = f"relatorio_{report['period']['period_type']}_{report['period']['year']}_P{report['period']['period_index']}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
