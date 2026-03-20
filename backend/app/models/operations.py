from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Machine(SQLModel, table=True):
    __tablename__ = "machines"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    machine_type: str = Field(default="MAQUINA", index=True)  # MAQUINA|IMPLEMENTO|OUTRO
    brand: str = Field(default="")
    model: str = Field(default="")
    plate: str = Field(default="", index=True)
    serial_number: str = Field(default="", index=True)
    hour_meter: float = Field(default=0.0)
    notes: str = Field(default="")
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class MachineCreate(SQLModel):
    name: str
    machine_type: Optional[str] = "MAQUINA"
    brand: Optional[str] = ""
    model: Optional[str] = ""
    plate: Optional[str] = ""
    serial_number: Optional[str] = ""
    hour_meter: Optional[float] = 0.0
    notes: Optional[str] = ""
    is_active: Optional[bool] = True


class MachineUpdate(SQLModel):
    name: Optional[str] = None
    machine_type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    plate: Optional[str] = None
    serial_number: Optional[str] = None
    hour_meter: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class MachineMovement(SQLModel, table=True):
    __tablename__ = "machine_movements"

    id: Optional[int] = Field(default=None, primary_key=True)
    machine_id: int = Field(index=True)
    occurred_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    movement_type: str = Field(default="OUTRO", index=True)  # COMBUSTIVEL|MANUTENCAO|SEGURO|IMPOSTO|MULTA|OUTRO
    description: str = Field(default="")
    value_brl: float = Field(default=0.0)
    quantity: float = Field(default=0.0)  # litros/horas/qtde (opcional)
    unit: str = Field(default="")
    supplier: str = Field(default="")
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class MachineMovementCreate(SQLModel):
    machine_id: int
    occurred_at: Optional[datetime] = None
    movement_type: Optional[str] = "OUTRO"
    description: Optional[str] = ""
    value_brl: float
    quantity: Optional[float] = 0.0
    unit: Optional[str] = ""
    supplier: Optional[str] = ""
    notes: Optional[str] = ""


class ClimateRecord(SQLModel, table=True):
    __tablename__ = "climate_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference_month: str = Field(default="", index=True)  # YYYY-MM
    property_name: str = Field(default="Fazenda", index=True)
    rain_mm: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ClimateRecordCreate(SQLModel):
    reference_month: str
    property_name: Optional[str] = "Fazenda"
    rain_mm: float
    notes: Optional[str] = ""


class ClimateRecordUpdate(SQLModel):
    reference_month: Optional[str] = None
    property_name: Optional[str] = None
    rain_mm: Optional[float] = None
    notes: Optional[str] = None


class DiscResult(SQLModel, table=True):
    __tablename__ = "planning_disc_results"

    id: Optional[int] = Field(default=None, primary_key=True)
    respondent_name: str = Field(default="", index=True)
    season: str = Field(default="", index=True)
    dominance: float = Field(default=25.0)
    influence: float = Field(default=25.0)
    stability: float = Field(default=25.0)
    conformity: float = Field(default=25.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class DiscResultCreate(SQLModel):
    respondent_name: str
    season: Optional[str] = ""
    dominance: float
    influence: float
    stability: float
    conformity: float
    notes: Optional[str] = ""


class CulturalMapResult(SQLModel, table=True):
    __tablename__ = "planning_cultural_map_results"

    id: Optional[int] = Field(default=None, primary_key=True)
    leader_name: str = Field(default="", index=True)
    season: str = Field(default="", index=True)
    culture_score: float = Field(default=0.0)
    management_score: float = Field(default=0.0)
    team_score: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class CulturalMapResultCreate(SQLModel):
    leader_name: str
    season: Optional[str] = ""
    culture_score: float
    management_score: float
    team_score: float
    notes: Optional[str] = ""


class Goal(SQLModel, table=True):
    __tablename__ = "planning_goals"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="", index=True)
    season: str = Field(default="", index=True)
    area: str = Field(default="", index=True)
    period_type: str = Field(default="trimestral", index=True)  # trimestral|safra
    unit: str = Field(default="%")
    target_value: float = Field(default=0.0)
    current_value: float = Field(default=0.0)
    status: str = Field(default="aberta", index=True)  # aberta|em_andamento|concluida
    due_date: Optional[datetime] = Field(default=None, index=True)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class GoalCreate(SQLModel):
    title: str
    season: Optional[str] = ""
    area: Optional[str] = ""
    period_type: Optional[str] = "trimestral"
    unit: Optional[str] = "%"
    target_value: float
    current_value: Optional[float] = 0.0
    status: Optional[str] = "aberta"
    due_date: Optional[datetime] = None
    notes: Optional[str] = ""


class GoalUpdate(SQLModel):
    title: Optional[str] = None
    season: Optional[str] = None
    area: Optional[str] = None
    period_type: Optional[str] = None
    unit: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="", index=True)
    description: str = Field(default="")
    assignee: str = Field(default="", index=True)
    status: str = Field(default="aberta", index=True)  # aberta|em_andamento|concluida|cancelada
    priority: str = Field(default="media", index=True)  # baixa|media|alta|critica
    due_date: Optional[datetime] = Field(default=None, index=True)
    notify_before_hours: int = Field(default=24)
    unit: str = Field(default="hora")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TaskCreate(SQLModel):
    title: str
    description: Optional[str] = ""
    assignee: Optional[str] = ""
    status: Optional[str] = "aberta"
    priority: Optional[str] = "media"
    due_date: Optional[datetime] = None
    notify_before_hours: Optional[int] = 24
    unit: Optional[str] = "hora"


class TaskUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    notify_before_hours: Optional[int] = None
    unit: Optional[str] = None


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    notification_type: str = Field(default="sistema", index=True)  # tarefa|sistema|alerta
    message: str = Field(default="")
    task_id: Optional[int] = Field(default=None, index=True)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class Property(SQLModel, table=True):
    __tablename__ = "setup_properties"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    city: str = Field(default="", index=True)
    state: str = Field(default="", index=True)
    total_area_ha: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PropertyCreate(SQLModel):
    name: str
    city: Optional[str] = ""
    state: Optional[str] = ""
    total_area_ha: Optional[float] = 0.0
    notes: Optional[str] = ""


class Season(SQLModel, table=True):
    __tablename__ = "setup_seasons"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    start_year: int = Field(default=2026, index=True)
    end_year: int = Field(default=2027, index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class SeasonCreate(SQLModel):
    name: str
    start_year: int
    end_year: int
    is_active: Optional[bool] = True


class SeasonUpdate(SQLModel):
    name: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    is_active: Optional[bool] = None


class LivestockMovement(SQLModel, table=True):
    __tablename__ = "livestock_movements"

    id: Optional[int] = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    movement_type: str = Field(default="OUTRO", index=True)
    direction: str = Field(default="processo", index=True)  # entrada|saida|processo
    property_name: str = Field(default="Fazenda", index=True)
    lot_from: str = Field(default="", index=True)
    lot_to: str = Field(default="", index=True)
    category: str = Field(default="", index=True)
    heads: int = Field(default=0)
    avg_weight_kg: float = Field(default=0.0)
    total_weight_kg: float = Field(default=0.0)
    value_brl: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class LivestockMovementCreate(SQLModel):
    occurred_at: Optional[datetime] = None
    movement_type: Optional[str] = "OUTRO"
    direction: Optional[str] = "processo"
    property_name: Optional[str] = "Fazenda"
    lot_from: Optional[str] = ""
    lot_to: Optional[str] = ""
    category: Optional[str] = ""
    heads: int
    avg_weight_kg: Optional[float] = 0.0
    total_weight_kg: Optional[float] = 0.0
    value_brl: Optional[float] = 0.0
    notes: Optional[str] = ""


class HerdMonthlyStock(SQLModel, table=True):
    __tablename__ = "herd_monthly_stock"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference_month: str = Field(default="", index=True)  # YYYY-MM
    property_name: str = Field(default="Fazenda", index=True)
    category: str = Field(default="", index=True)
    heads: int = Field(default=0)
    avg_weight_kg: float = Field(default=0.0)
    total_weight_kg: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class HerdMonthlyStockCreate(SQLModel):
    reference_month: str
    property_name: Optional[str] = "Fazenda"
    category: str
    heads: int
    avg_weight_kg: Optional[float] = 0.0
    total_weight_kg: Optional[float] = 0.0
    notes: Optional[str] = ""


class HerdMonthlyStockUpdate(SQLModel):
    reference_month: Optional[str] = None
    property_name: Optional[str] = None
    category: Optional[str] = None
    heads: Optional[int] = None
    avg_weight_kg: Optional[float] = None
    total_weight_kg: Optional[float] = None
    notes: Optional[str] = None


class ProductiveAreaMonthly(SQLModel, table=True):
    __tablename__ = "productive_area_monthly"

    id: Optional[int] = Field(default=None, primary_key=True)
    reference_month: str = Field(default="", index=True)  # YYYY-MM
    property_name: str = Field(default="Fazenda", index=True)
    area_type: str = Field(default="PASTAGEM", index=True)  # PASTAGEM|ILP|VOLUMOSO|REFORMA|ALAGADA|OUTRA
    area_ha: float = Field(default=0.0)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ProductiveAreaMonthlyCreate(SQLModel):
    reference_month: str
    property_name: Optional[str] = "Fazenda"
    area_type: Optional[str] = "PASTAGEM"
    area_ha: float
    notes: Optional[str] = ""


class ProductiveAreaMonthlyUpdate(SQLModel):
    reference_month: Optional[str] = None
    property_name: Optional[str] = None
    area_type: Optional[str] = None
    area_ha: Optional[float] = None
    notes: Optional[str] = None


class ReproductionEvent(SQLModel, table=True):
    __tablename__ = "reproduction_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    reference_month: str = Field(default="", index=True)  # YYYY-MM
    event_type: str = Field(default="OUTRO", index=True)
    property_name: str = Field(default="Fazenda", index=True)
    lot_name: str = Field(default="", index=True)
    animal_ear_tag: str = Field(default="", index=True)
    heads_involved: int = Field(default=0)
    protocol: str = Field(default="")
    semen: str = Field(default="")
    result: str = Field(default="", index=True)  # prenhe|vazia|nascido|desmamado|outro
    status: str = Field(default="registrado", index=True)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ReproductionEventCreate(SQLModel):
    occurred_at: Optional[datetime] = None
    event_type: Optional[str] = "OUTRO"
    property_name: Optional[str] = "Fazenda"
    lot_name: Optional[str] = ""
    animal_ear_tag: Optional[str] = ""
    heads_involved: Optional[int] = 0
    protocol: Optional[str] = ""
    semen: Optional[str] = ""
    result: Optional[str] = ""
    status: Optional[str] = "registrado"
    notes: Optional[str] = ""


class ReproductionEventUpdate(SQLModel):
    occurred_at: Optional[datetime] = None
    event_type: Optional[str] = None
    property_name: Optional[str] = None
    lot_name: Optional[str] = None
    animal_ear_tag: Optional[str] = None
    heads_involved: Optional[int] = None
    protocol: Optional[str] = None
    semen: Optional[str] = None
    result: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
