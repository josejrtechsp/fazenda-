from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import (
    Machine,
    MachineCreate,
    MachineUpdate,
    MachineMovement,
    MachineMovementCreate,
    ClimateRecord,
    ClimateRecordCreate,
    ClimateRecordUpdate,
    DiscResult,
    DiscResultCreate,
    CulturalMapResult,
    CulturalMapResultCreate,
    Goal,
    GoalCreate,
    GoalUpdate,
    Task,
    TaskCreate,
    TaskUpdate,
    Notification,
    Property,
    PropertyCreate,
    Season,
    SeasonCreate,
    SeasonUpdate,
    LivestockMovement,
    LivestockMovementCreate,
    HerdMonthlyStock,
    HerdMonthlyStockCreate,
    HerdMonthlyStockUpdate,
    ProductiveAreaMonthly,
    ProductiveAreaMonthlyCreate,
    ProductiveAreaMonthlyUpdate,
    ReproductionEvent,
    ReproductionEventCreate,
    ReproductionEventUpdate,
)

router = APIRouter(tags=["operations"])


def _month_start(month_key: str) -> datetime:
    s = str(month_key or "").strip()
    if len(s) != 7 or s[4] != "-":
        raise HTTPException(status_code=422, detail="mês inválido. Use YYYY-MM")
    y = int(s[:4])
    m = int(s[5:7])
    if m < 1 or m > 12:
        raise HTTPException(status_code=422, detail="mês inválido. Use YYYY-MM")
    return datetime(y, m, 1)


def _month_window(month_key: Optional[str]) -> tuple[datetime, datetime]:
    if month_key:
        start = _month_start(month_key)
    else:
        now = datetime.utcnow()
        start = datetime(now.year, now.month, 1)
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    return start, end


def _month_key_from_dt(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _movement_direction(movement_type: str, fallback: Optional[str] = None) -> str:
    m = str(movement_type or "").strip().upper()
    if m in {"NASCIMENTO", "COMPRA", "TRANSFERENCIA_ENTRADA", "ESTOQUE_PARTIDA"}:
        return "entrada"
    if m in {"ABATE", "VENDA_PE", "TRANSFERENCIA_SAIDA", "MORTE", "CONSUMO", "DOACAO"}:
        return "saida"
    if m in {"DESMAME", "CONFINAMENTO", "SEMICONFINAMENTO", "TIP", "RIP"}:
        return "processo"
    fb = str(fallback or "").strip().lower()
    if fb in {"entrada", "saida", "processo"}:
        return fb
    return "processo"


def _mk_notification(
    session: Session,
    message: str,
    *,
    notification_type: str = "tarefa",
    task_id: Optional[int] = None,
) -> Notification:
    n = Notification(
        notification_type=str(notification_type or "tarefa").strip().lower(),
        message=str(message or "").strip(),
        task_id=task_id,
        is_read=False,
    )
    session.add(n)
    return n


# ------------------------------------------------------------
# MÁQUINAS
# ------------------------------------------------------------


@router.get("/machines")
def list_machines(
    include_inactive: bool = False,
    q: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
    session: Session = Depends(get_session),
) -> List[Machine]:
    stmt = select(Machine)
    if not include_inactive:
        stmt = stmt.where(Machine.is_active == True)  # noqa
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (str(x.name or "").lower(), int(x.id or 0)))
    if q:
        nq = str(q).strip().lower()
        rows = [
            r
            for r in rows
            if nq in str(r.name or "").lower()
            or nq in str(r.machine_type or "").lower()
            or nq in str(r.brand or "").lower()
            or nq in str(r.model or "").lower()
            or nq in str(r.plate or "").lower()
        ]
    return rows[:limit]


@router.post("/machines")
def create_machine(payload: MachineCreate, session: Session = Depends(get_session)) -> Machine:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da máquina é obrigatório")
    obj = Machine(
        name=name,
        machine_type=str(payload.machine_type or "MAQUINA").strip().upper(),
        brand=str(payload.brand or "").strip(),
        model=str(payload.model or "").strip(),
        plate=str(payload.plate or "").strip(),
        serial_number=str(payload.serial_number or "").strip(),
        hour_meter=float(payload.hour_meter or 0.0),
        notes=str(payload.notes or "").strip(),
        is_active=bool(payload.is_active if payload.is_active is not None else True),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/machines/{machine_id}")
def patch_machine(machine_id: int, patch: MachineUpdate, session: Session = Depends(get_session)) -> Machine:
    obj = session.get(Machine, int(machine_id))
    if not obj:
        raise HTTPException(status_code=404, detail="máquina não encontrada")
    data = patch.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/machines/movements")
def list_machine_movements(
    machine_id: Optional[int] = None,
    month: Optional[str] = None,
    limit: int = Query(default=400, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[MachineMovement]:
    stmt = select(MachineMovement)
    if machine_id is not None:
        stmt = stmt.where(MachineMovement.machine_id == int(machine_id))
    if month:
        start, end = _month_window(month)
        stmt = stmt.where(MachineMovement.occurred_at >= start).where(MachineMovement.occurred_at < end)
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.occurred_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/machines/movements")
def create_machine_movement(payload: MachineMovementCreate, session: Session = Depends(get_session)) -> MachineMovement:
    m = session.get(Machine, int(payload.machine_id))
    if not m:
        raise HTTPException(status_code=404, detail="máquina não encontrada")
    value = float(payload.value_brl or 0.0)
    if value <= 0:
        raise HTTPException(status_code=422, detail="valor deve ser maior que zero")
    occurred = payload.occurred_at or datetime.utcnow()
    obj = MachineMovement(
        machine_id=int(payload.machine_id),
        occurred_at=occurred,
        movement_type=str(payload.movement_type or "OUTRO").strip().upper(),
        description=str(payload.description or "").strip(),
        value_brl=value,
        quantity=float(payload.quantity or 0.0),
        unit=str(payload.unit or "").strip(),
        supplier=str(payload.supplier or "").strip(),
        notes=str(payload.notes or "").strip(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/machines/summary")
def machine_summary(
    month: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    stmt = select(MachineMovement)
    if month:
        start, end = _month_window(month)
        stmt = stmt.where(MachineMovement.occurred_at >= start).where(MachineMovement.occurred_at < end)
    rows = list(session.exec(stmt).all())
    totals = defaultdict(float)
    for r in rows:
        totals[str(r.movement_type or "OUTRO").upper()] += float(r.value_brl or 0.0)
    return {
        "total_movements": len(rows),
        "total_brl": round(sum(float(x.value_brl or 0.0) for x in rows), 2),
        "by_type": [{"type": k, "value_brl": round(v, 2)} for k, v in sorted(totals.items())],
    }


# ------------------------------------------------------------
# CLIMA
# ------------------------------------------------------------


@router.get("/climate")
def list_climate_records(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    limit: int = Query(default=240, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[ClimateRecord]:
    stmt = select(ClimateRecord)
    if month:
        stmt = stmt.where(ClimateRecord.reference_month == str(month).strip())
    if property_name:
        stmt = stmt.where(ClimateRecord.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (str(x.reference_month), int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/climate")
def create_climate_record(payload: ClimateRecordCreate, session: Session = Depends(get_session)) -> ClimateRecord:
    _ = _month_start(payload.reference_month)
    rain = float(payload.rain_mm or 0.0)
    if rain < 0:
        raise HTTPException(status_code=422, detail="mm de chuva não pode ser negativo")
    obj = ClimateRecord(
        reference_month=str(payload.reference_month).strip(),
        property_name=str(payload.property_name or "Fazenda").strip() or "Fazenda",
        rain_mm=rain,
        notes=str(payload.notes or "").strip(),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/climate/{record_id}")
def patch_climate_record(record_id: int, patch: ClimateRecordUpdate, session: Session = Depends(get_session)) -> ClimateRecord:
    obj = session.get(ClimateRecord, int(record_id))
    if not obj:
        raise HTTPException(status_code=404, detail="registro de clima não encontrado")
    data = patch.model_dump(exclude_unset=True)
    if "reference_month" in data and data["reference_month"] is not None:
        _ = _month_start(str(data["reference_month"]))
    if "rain_mm" in data and data["rain_mm"] is not None and float(data["rain_mm"]) < 0:
        raise HTTPException(status_code=422, detail="mm de chuva não pode ser negativo")
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/climate/summary")
def climate_summary(
    months: int = Query(default=12, ge=1, le=60),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    rows = list(session.exec(select(ClimateRecord)).all())
    rows.sort(key=lambda x: str(x.reference_month))
    if not rows:
        return {"total_mm": 0.0, "series": []}
    grouped = defaultdict(float)
    for r in rows:
        grouped[str(r.reference_month)] += float(r.rain_mm or 0.0)
    keys = sorted(grouped.keys())[-months:]
    series = [{"month": k, "rain_mm": round(grouped[k], 2)} for k in keys]
    return {
        "total_mm": round(sum(s["rain_mm"] for s in series), 2),
        "series": series,
    }


# ------------------------------------------------------------
# PECUARIA AVANCADA
# ------------------------------------------------------------


@router.get("/livestock/movements")
def list_livestock_movements(
    month: Optional[str] = None,
    movement_type: Optional[str] = None,
    property_name: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[LivestockMovement]:
    stmt = select(LivestockMovement)
    if month:
        start, end = _month_window(month)
        stmt = stmt.where(LivestockMovement.occurred_at >= start).where(LivestockMovement.occurred_at < end)
    if movement_type:
        stmt = stmt.where(LivestockMovement.movement_type == str(movement_type).strip().upper())
    if property_name:
        stmt = stmt.where(LivestockMovement.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.occurred_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/livestock/movements")
def create_livestock_movement(payload: LivestockMovementCreate, session: Session = Depends(get_session)) -> LivestockMovement:
    heads = int(payload.heads or 0)
    if heads <= 0:
        raise HTTPException(status_code=422, detail="quantidade de cabecas deve ser maior que zero")
    movement_type = str(payload.movement_type or "OUTRO").strip().upper()
    occurred = payload.occurred_at or datetime.utcnow()
    avg_weight = max(0.0, float(payload.avg_weight_kg or 0.0))
    total_weight = float(payload.total_weight_kg or 0.0)
    if total_weight <= 0 and avg_weight > 0:
        total_weight = avg_weight * float(heads)
    total_weight = max(0.0, total_weight)

    obj = LivestockMovement(
        occurred_at=occurred,
        movement_type=movement_type,
        direction=_movement_direction(movement_type, payload.direction),
        property_name=str(payload.property_name or "Fazenda").strip() or "Fazenda",
        lot_from=str(payload.lot_from or "").strip(),
        lot_to=str(payload.lot_to or "").strip(),
        category=str(payload.category or "").strip().upper(),
        heads=heads,
        avg_weight_kg=avg_weight,
        total_weight_kg=total_weight,
        value_brl=max(0.0, float(payload.value_brl or 0.0)),
        notes=str(payload.notes or "").strip(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/livestock/movements/summary")
def livestock_movement_summary(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    stmt = select(LivestockMovement)
    if month:
        start, end = _month_window(month)
        stmt = stmt.where(LivestockMovement.occurred_at >= start).where(LivestockMovement.occurred_at < end)
    if property_name:
        stmt = stmt.where(LivestockMovement.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    by_type = defaultdict(int)
    entered = 0
    exited = 0
    process = 0
    total_value = 0.0
    for r in rows:
        heads = max(0, int(r.heads or 0))
        by_type[str(r.movement_type or "OUTRO").upper()] += heads
        direction = str(r.direction or "").strip().lower()
        if direction == "entrada":
            entered += heads
        elif direction == "saida":
            exited += heads
        else:
            process += heads
        total_value += max(0.0, float(r.value_brl or 0.0))
    return {
        "total_events": len(rows),
        "entered_heads": entered,
        "exited_heads": exited,
        "process_heads": process,
        "net_heads": entered - exited,
        "total_value_brl": round(total_value, 2),
        "by_type_heads": [{"movement_type": k, "heads": int(v)} for k, v in sorted(by_type.items())],
    }


@router.get("/livestock/monthly-stock")
def list_herd_monthly_stock(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[HerdMonthlyStock]:
    stmt = select(HerdMonthlyStock)
    if month:
        _ = _month_start(month)
        stmt = stmt.where(HerdMonthlyStock.reference_month == str(month).strip())
    if property_name:
        stmt = stmt.where(HerdMonthlyStock.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(
        key=lambda x: (str(x.reference_month or ""), str(x.property_name or ""), str(x.category or ""), int(x.id or 0)),
        reverse=True,
    )
    return rows[:limit]


@router.post("/livestock/monthly-stock")
def create_or_update_herd_monthly_stock(payload: HerdMonthlyStockCreate, session: Session = Depends(get_session)) -> HerdMonthlyStock:
    month = str(payload.reference_month or "").strip()
    _ = _month_start(month)
    property_name = str(payload.property_name or "Fazenda").strip() or "Fazenda"
    category = str(payload.category or "").strip().upper()
    if not category:
        raise HTTPException(status_code=422, detail="categoria do efetivo e obrigatoria")
    heads = int(payload.heads or 0)
    if heads < 0:
        raise HTTPException(status_code=422, detail="cabecas nao pode ser negativo")

    avg_weight = max(0.0, float(payload.avg_weight_kg or 0.0))
    total_weight = float(payload.total_weight_kg or 0.0)
    if total_weight <= 0 and heads > 0 and avg_weight > 0:
        total_weight = avg_weight * float(heads)
    total_weight = max(0.0, total_weight)

    stmt = (
        select(HerdMonthlyStock)
        .where(HerdMonthlyStock.reference_month == month)
        .where(HerdMonthlyStock.property_name == property_name)
        .where(HerdMonthlyStock.category == category)
    )
    obj = session.exec(stmt).first()
    if obj:
        obj.heads = heads
        obj.avg_weight_kg = avg_weight
        obj.total_weight_kg = total_weight
        obj.notes = str(payload.notes or "").strip()
        obj.updated_at = datetime.utcnow()
    else:
        obj = HerdMonthlyStock(
            reference_month=month,
            property_name=property_name,
            category=category,
            heads=heads,
            avg_weight_kg=avg_weight,
            total_weight_kg=total_weight,
            notes=str(payload.notes or "").strip(),
            updated_at=datetime.utcnow(),
        )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/livestock/monthly-stock/{stock_id}")
def patch_herd_monthly_stock(stock_id: int, patch: HerdMonthlyStockUpdate, session: Session = Depends(get_session)) -> HerdMonthlyStock:
    obj = session.get(HerdMonthlyStock, int(stock_id))
    if not obj:
        raise HTTPException(status_code=404, detail="registro de efetivo mensal nao encontrado")
    data = patch.model_dump(exclude_unset=True)
    if "reference_month" in data and data.get("reference_month") is not None:
        _ = _month_start(str(data.get("reference_month")))
    if "heads" in data and data.get("heads") is not None and int(data.get("heads")) < 0:
        raise HTTPException(status_code=422, detail="cabecas nao pode ser negativo")
    if "avg_weight_kg" in data and data.get("avg_weight_kg") is not None and float(data.get("avg_weight_kg")) < 0:
        raise HTTPException(status_code=422, detail="peso medio nao pode ser negativo")
    if "total_weight_kg" in data and data.get("total_weight_kg") is not None and float(data.get("total_weight_kg")) < 0:
        raise HTTPException(status_code=422, detail="peso total nao pode ser negativo")
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/livestock/monthly-stock/summary")
def herd_monthly_stock_summary(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    target_month = str(month).strip() if month else _month_key_from_dt(datetime.utcnow())
    _ = _month_start(target_month)
    stmt = select(HerdMonthlyStock).where(HerdMonthlyStock.reference_month == target_month)
    if property_name:
        stmt = stmt.where(HerdMonthlyStock.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    total_heads = 0
    total_weight = 0.0
    by_category: Dict[str, Dict[str, float]] = {}
    for r in rows:
        category = str(r.category or "SEM_CATEGORIA").upper()
        if category not in by_category:
            by_category[category] = {"heads": 0, "total_weight_kg": 0.0}
        heads = max(0, int(r.heads or 0))
        weight = max(0.0, float(r.total_weight_kg or 0.0))
        by_category[category]["heads"] += heads
        by_category[category]["total_weight_kg"] += weight
        total_heads += heads
        total_weight += weight
    return {
        "reference_month": target_month,
        "total_heads": total_heads,
        "total_weight_kg": round(total_weight, 2),
        "avg_weight_kg": round((total_weight / total_heads), 2) if total_heads > 0 else 0.0,
        "by_category": [
            {
                "category": cat,
                "heads": int(vals["heads"]),
                "total_weight_kg": round(float(vals["total_weight_kg"]), 2),
                "avg_weight_kg": round(float(vals["total_weight_kg"]) / int(vals["heads"]), 2) if int(vals["heads"]) > 0 else 0.0,
            }
            for cat, vals in sorted(by_category.items())
        ],
    }


@router.get("/livestock/monthly-areas")
def list_productive_area_monthly(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[ProductiveAreaMonthly]:
    stmt = select(ProductiveAreaMonthly)
    if month:
        _ = _month_start(month)
        stmt = stmt.where(ProductiveAreaMonthly.reference_month == str(month).strip())
    if property_name:
        stmt = stmt.where(ProductiveAreaMonthly.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(
        key=lambda x: (str(x.reference_month or ""), str(x.property_name or ""), str(x.area_type or ""), int(x.id or 0)),
        reverse=True,
    )
    return rows[:limit]


@router.post("/livestock/monthly-areas")
def create_or_update_productive_area_monthly(
    payload: ProductiveAreaMonthlyCreate,
    session: Session = Depends(get_session),
) -> ProductiveAreaMonthly:
    month = str(payload.reference_month or "").strip()
    _ = _month_start(month)
    property_name = str(payload.property_name or "Fazenda").strip() or "Fazenda"
    area_type = str(payload.area_type or "PASTAGEM").strip().upper()
    area_ha = float(payload.area_ha or 0.0)
    if area_ha < 0:
        raise HTTPException(status_code=422, detail="area em ha nao pode ser negativa")

    stmt = (
        select(ProductiveAreaMonthly)
        .where(ProductiveAreaMonthly.reference_month == month)
        .where(ProductiveAreaMonthly.property_name == property_name)
        .where(ProductiveAreaMonthly.area_type == area_type)
    )
    obj = session.exec(stmt).first()
    if obj:
        obj.area_ha = area_ha
        obj.notes = str(payload.notes or "").strip()
        obj.updated_at = datetime.utcnow()
    else:
        obj = ProductiveAreaMonthly(
            reference_month=month,
            property_name=property_name,
            area_type=area_type,
            area_ha=area_ha,
            notes=str(payload.notes or "").strip(),
            updated_at=datetime.utcnow(),
        )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/livestock/monthly-areas/{area_id}")
def patch_productive_area_monthly(
    area_id: int,
    patch: ProductiveAreaMonthlyUpdate,
    session: Session = Depends(get_session),
) -> ProductiveAreaMonthly:
    obj = session.get(ProductiveAreaMonthly, int(area_id))
    if not obj:
        raise HTTPException(status_code=404, detail="registro de area mensal nao encontrado")
    data = patch.model_dump(exclude_unset=True)
    if "reference_month" in data and data.get("reference_month") is not None:
        _ = _month_start(str(data.get("reference_month")))
    if "area_ha" in data and data.get("area_ha") is not None and float(data.get("area_ha")) < 0:
        raise HTTPException(status_code=422, detail="area em ha nao pode ser negativa")
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/livestock/monthly-areas/summary")
def productive_area_monthly_summary(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    target_month = str(month).strip() if month else _month_key_from_dt(datetime.utcnow())
    _ = _month_start(target_month)
    stmt = select(ProductiveAreaMonthly).where(ProductiveAreaMonthly.reference_month == target_month)
    if property_name:
        stmt = stmt.where(ProductiveAreaMonthly.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    by_type = defaultdict(float)
    for r in rows:
        by_type[str(r.area_type or "OUTRA").upper()] += max(0.0, float(r.area_ha or 0.0))
    return {
        "reference_month": target_month,
        "total_area_ha": round(sum(by_type.values()), 2),
        "by_type": [{"area_type": k, "area_ha": round(v, 2)} for k, v in sorted(by_type.items())],
    }


@router.get("/livestock/reproduction")
def list_reproduction_events(
    month: Optional[str] = None,
    event_type: Optional[str] = None,
    property_name: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[ReproductionEvent]:
    stmt = select(ReproductionEvent)
    if month:
        _ = _month_start(month)
        stmt = stmt.where(ReproductionEvent.reference_month == str(month).strip())
    if event_type:
        stmt = stmt.where(ReproductionEvent.event_type == str(event_type).strip().upper())
    if property_name:
        stmt = stmt.where(ReproductionEvent.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.occurred_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/livestock/reproduction")
def create_reproduction_event(payload: ReproductionEventCreate, session: Session = Depends(get_session)) -> ReproductionEvent:
    occurred = payload.occurred_at or datetime.utcnow()
    heads = int(payload.heads_involved or 0)
    if heads < 0:
        raise HTTPException(status_code=422, detail="cabecas envolvidas nao pode ser negativo")
    obj = ReproductionEvent(
        occurred_at=occurred,
        reference_month=_month_key_from_dt(occurred),
        event_type=str(payload.event_type or "OUTRO").strip().upper(),
        property_name=str(payload.property_name or "Fazenda").strip() or "Fazenda",
        lot_name=str(payload.lot_name or "").strip(),
        animal_ear_tag=str(payload.animal_ear_tag or "").strip().upper(),
        heads_involved=heads,
        protocol=str(payload.protocol or "").strip(),
        semen=str(payload.semen or "").strip(),
        result=str(payload.result or "").strip().lower(),
        status=str(payload.status or "registrado").strip().lower(),
        notes=str(payload.notes or "").strip(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/livestock/reproduction/{event_id}")
def patch_reproduction_event(
    event_id: int,
    patch: ReproductionEventUpdate,
    session: Session = Depends(get_session),
) -> ReproductionEvent:
    obj = session.get(ReproductionEvent, int(event_id))
    if not obj:
        raise HTTPException(status_code=404, detail="evento de reproducao nao encontrado")
    data = patch.model_dump(exclude_unset=True)
    if "heads_involved" in data and data.get("heads_involved") is not None and int(data.get("heads_involved")) < 0:
        raise HTTPException(status_code=422, detail="cabecas envolvidas nao pode ser negativo")
    if "occurred_at" in data and data.get("occurred_at") is not None:
        dt = data["occurred_at"]
        data["reference_month"] = _month_key_from_dt(dt)
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/livestock/reproduction/summary")
def reproduction_summary(
    month: Optional[str] = None,
    property_name: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    target_month = str(month).strip() if month else _month_key_from_dt(datetime.utcnow())
    _ = _month_start(target_month)
    stmt = select(ReproductionEvent).where(ReproductionEvent.reference_month == target_month)
    if property_name:
        stmt = stmt.where(ReproductionEvent.property_name == str(property_name).strip())
    rows = list(session.exec(stmt).all())
    by_type = defaultdict(int)
    by_result = defaultdict(int)
    total_heads = 0
    for r in rows:
        heads = max(0, int(r.heads_involved or 0))
        total_heads += heads
        by_type[str(r.event_type or "OUTRO").upper()] += heads if heads > 0 else 1
        if str(r.result or "").strip():
            by_result[str(r.result).strip().lower()] += heads if heads > 0 else 1
    return {
        "reference_month": target_month,
        "total_events": len(rows),
        "total_heads_involved": total_heads,
        "by_type": [{"event_type": k, "value": int(v)} for k, v in sorted(by_type.items())],
        "by_result": [{"result": k, "value": int(v)} for k, v in sorted(by_result.items())],
    }


# ------------------------------------------------------------
# PLANEJAMENTO
# ------------------------------------------------------------


@router.get("/planning/disc")
def list_disc_results(
    limit: int = Query(default=200, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[DiscResult]:
    rows = list(session.exec(select(DiscResult)).all())
    rows.sort(key=lambda x: (x.created_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/planning/disc")
def create_disc_result(payload: DiscResultCreate, session: Session = Depends(get_session)) -> DiscResult:
    name = str(payload.respondent_name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome do respondente é obrigatório")
    total = float(payload.dominance + payload.influence + payload.stability + payload.conformity)
    if total <= 0:
        raise HTTPException(status_code=422, detail="soma dos quatro fatores DISC deve ser maior que zero")
    obj = DiscResult(
        respondent_name=name,
        season=str(payload.season or "").strip(),
        dominance=float(payload.dominance),
        influence=float(payload.influence),
        stability=float(payload.stability),
        conformity=float(payload.conformity),
        notes=str(payload.notes or "").strip(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/planning/cultural-map")
def list_cultural_maps(
    limit: int = Query(default=200, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[CulturalMapResult]:
    rows = list(session.exec(select(CulturalMapResult)).all())
    rows.sort(key=lambda x: (x.created_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/planning/cultural-map")
def create_cultural_map(payload: CulturalMapResultCreate, session: Session = Depends(get_session)) -> CulturalMapResult:
    leader = str(payload.leader_name or "").strip()
    if not leader:
        raise HTTPException(status_code=422, detail="nome do líder é obrigatório")
    obj = CulturalMapResult(
        leader_name=leader,
        season=str(payload.season or "").strip(),
        culture_score=float(payload.culture_score),
        management_score=float(payload.management_score),
        team_score=float(payload.team_score),
        notes=str(payload.notes or "").strip(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/planning/goals")
def list_goals(
    status: Optional[str] = None,
    season: Optional[str] = None,
    limit: int = Query(default=300, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Goal]:
    stmt = select(Goal)
    if status:
        stmt = stmt.where(Goal.status == str(status).strip().lower())
    if season:
        stmt = stmt.where(Goal.season == str(season).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.created_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/planning/goals")
def create_goal(payload: GoalCreate, session: Session = Depends(get_session)) -> Goal:
    title = str(payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="título da meta é obrigatório")
    obj = Goal(
        title=title,
        season=str(payload.season or "").strip(),
        area=str(payload.area or "").strip(),
        period_type=str(payload.period_type or "trimestral").strip().lower(),
        unit=str(payload.unit or "%").strip(),
        target_value=float(payload.target_value),
        current_value=float(payload.current_value or 0.0),
        status=str(payload.status or "aberta").strip().lower(),
        due_date=payload.due_date,
        notes=str(payload.notes or "").strip(),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/planning/goals/{goal_id}")
def patch_goal(goal_id: int, patch: GoalUpdate, session: Session = Depends(get_session)) -> Goal:
    obj = session.get(Goal, int(goal_id))
    if not obj:
        raise HTTPException(status_code=404, detail="meta não encontrada")
    data = patch.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/planning/goals/summary")
def goal_summary(session: Session = Depends(get_session)) -> Dict[str, Any]:
    rows = list(session.exec(select(Goal)).all())
    status_count = defaultdict(int)
    progress_sum = 0.0
    progress_n = 0
    for r in rows:
        status_count[str(r.status or "aberta").lower()] += 1
        target = float(r.target_value or 0.0)
        current = float(r.current_value or 0.0)
        if target > 0:
            progress_sum += max(0.0, min(100.0, (current / target) * 100.0))
            progress_n += 1
    return {
        "total": len(rows),
        "status": dict(status_count),
        "avg_progress_pct": round(progress_sum / progress_n, 2) if progress_n else 0.0,
    }


# ------------------------------------------------------------
# TAREFAS E NOTIFICAÇÕES
# ------------------------------------------------------------


@router.get("/tasks")
def list_tasks(
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = Query(default=400, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Task]:
    stmt = select(Task)
    if status:
        stmt = stmt.where(Task.status == str(status).strip().lower())
    if assignee:
        stmt = stmt.where(Task.assignee == str(assignee).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.created_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.post("/tasks")
def create_task(payload: TaskCreate, session: Session = Depends(get_session)) -> Task:
    title = str(payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="título da tarefa é obrigatório")
    obj = Task(
        title=title,
        description=str(payload.description or "").strip(),
        assignee=str(payload.assignee or "").strip(),
        status=str(payload.status or "aberta").strip().lower(),
        priority=str(payload.priority or "media").strip().lower(),
        due_date=payload.due_date,
        notify_before_hours=int(payload.notify_before_hours or 24),
        unit=str(payload.unit or "hora").strip(),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.flush()
    _mk_notification(
        session,
        f"Nova tarefa criada: {obj.title}",
        notification_type="tarefa",
        task_id=obj.id,
    )
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/tasks/{task_id}")
def patch_task(task_id: int, patch: TaskUpdate, session: Session = Depends(get_session)) -> Task:
    obj = session.get(Task, int(task_id))
    if not obj:
        raise HTTPException(status_code=404, detail="tarefa não encontrada")
    old_status = str(obj.status or "").lower()
    data = patch.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    new_status = str(obj.status or "").lower()
    if new_status != old_status:
        _mk_notification(
            session,
            f"Tarefa '{obj.title}' mudou de status para '{new_status}'.",
            notification_type="tarefa",
            task_id=obj.id,
        )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: int, session: Session = Depends(get_session)) -> Task:
    obj = session.get(Task, int(task_id))
    if not obj:
        raise HTTPException(status_code=404, detail="tarefa não encontrada")
    obj.status = "concluida"
    obj.updated_at = datetime.utcnow()
    _mk_notification(
        session,
        f"Tarefa concluída: {obj.title}",
        notification_type="tarefa",
        task_id=obj.id,
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/notifications")
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=400, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Notification]:
    stmt = select(Notification)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)  # noqa
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.created_at, int(x.id or 0)), reverse=True)
    return rows[:limit]


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, session: Session = Depends(get_session)) -> Notification:
    obj = session.get(Notification, int(notification_id))
    if not obj:
        raise HTTPException(status_code=404, detail="notificação não encontrada")
    obj.is_read = True
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.post("/notifications/read-all")
def mark_all_notifications_read(session: Session = Depends(get_session)) -> Dict[str, Any]:
    rows = list(session.exec(select(Notification).where(Notification.is_read == False)).all())  # noqa
    for r in rows:
        r.is_read = True
        session.add(r)
    session.commit()
    return {"ok": True, "updated": len(rows)}


# ------------------------------------------------------------
# CADASTROS GERAIS (PROPRIEDADES/SAFRAS)
# ------------------------------------------------------------


@router.get("/setup/properties")
def list_properties(
    limit: int = Query(default=300, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Property]:
    rows = list(session.exec(select(Property)).all())
    rows.sort(key=lambda x: (str(x.name or "").lower(), int(x.id or 0)))
    return rows[:limit]


@router.post("/setup/properties")
def create_property(payload: PropertyCreate, session: Session = Depends(get_session)) -> Property:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da propriedade é obrigatório")
    obj = Property(
        name=name,
        city=str(payload.city or "").strip(),
        state=str(payload.state or "").strip(),
        total_area_ha=float(payload.total_area_ha or 0.0),
        notes=str(payload.notes or "").strip(),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/setup/seasons")
def list_seasons(
    include_inactive: bool = True,
    limit: int = Query(default=300, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Season]:
    stmt = select(Season)
    if not include_inactive:
        stmt = stmt.where(Season.is_active == True)  # noqa
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda x: (x.start_year, x.end_year), reverse=True)
    return rows[:limit]


@router.post("/setup/seasons")
def create_season(payload: SeasonCreate, session: Session = Depends(get_session)) -> Season:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da safra é obrigatório")
    if int(payload.end_year) < int(payload.start_year):
        raise HTTPException(status_code=422, detail="ano final da safra deve ser maior ou igual ao inicial")
    obj = Season(
        name=name,
        start_year=int(payload.start_year),
        end_year=int(payload.end_year),
        is_active=bool(payload.is_active if payload.is_active is not None else True),
        updated_at=datetime.utcnow(),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/setup/seasons/{season_id}")
def patch_season(season_id: int, patch: SeasonUpdate, session: Session = Depends(get_session)) -> Season:
    obj = session.get(Season, int(season_id))
    if not obj:
        raise HTTPException(status_code=404, detail="safra não encontrada")
    data = patch.model_dump(exclude_unset=True)
    if "end_year" in data and data.get("end_year") is not None:
        start = int(data.get("start_year") if data.get("start_year") is not None else obj.start_year)
        end = int(data["end_year"])
        if end < start:
            raise HTTPException(status_code=422, detail="ano final da safra deve ser maior ou igual ao inicial")
    for k, v in data.items():
        if isinstance(v, str):
            setattr(obj, k, v.strip())
        else:
            setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj
