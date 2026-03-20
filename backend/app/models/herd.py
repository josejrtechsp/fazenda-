from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class HerdLot(SQLModel, table=True):
    """Lote de animais (modelo canônico do Rebanho)."""

    __tablename__ = "herd_lots"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    category: str = Field(default="", index=True)  # VACA/BOI/NOVILHA/BEZERRO/...
    area_name: str = Field(default="", index=True)  # Manga/Pasto (texto)
    heads: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class HerdAnimal(SQLModel, table=True):
    """Animal individual (identificação principal: brinco/ear_tag)."""

    __tablename__ = "herd_animals"

    ear_tag: str = Field(primary_key=True, index=True)  # brinco
    sex: str = Field(default="", index=True)  # M/F
    category: str = Field(default="", index=True)  # VACA/BOI/NOVILHA/BEZERRO/...
    status: str = Field(default="active", index=True)  # active/sold/dead/culled

    lot_id: Optional[int] = Field(default=None, index=True)
    area_name: str = Field(default="", index=True)  # Manga/Pasto (texto)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class HerdAnimalProfile(SQLModel, table=True):
    """Metadados operacionais do animal usados no cadastro geral e no dashboard."""

    __tablename__ = "herd_animal_profiles"

    ear_tag: str = Field(primary_key=True, index=True)

    birth_date: str = Field(default="", index=True)
    preg_status: str = Field(default="ND", index=True)  # PRENHA | VAZIA | ND
    preg_start_date: str = Field(default="", index=True)

    last_vaccine_name: str = Field(default="")
    last_vaccine_date: str = Field(default="", index=True)
    next_vaccine_date: str = Field(default="", index=True)
    note: str = Field(default="")

    sheet_json: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class HerdWeighing(SQLModel, table=True):
    """Pesagem do animal."""

    __tablename__ = "herd_weighings"

    id: Optional[int] = Field(default=None, primary_key=True)
    animal_ear_tag: str = Field(index=True)
    weighed_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    weight_kg: float = Field(default=0.0)
    note: str = Field(default="")


class HerdHealth(SQLModel, table=True):
    """Registro de sanidade (vacina/verminose/tratamento), opcionalmente ligado a uma pesagem."""

    __tablename__ = "herd_health"

    id: Optional[int] = Field(default=None, primary_key=True)
    animal_ear_tag: str = Field(index=True)

    occurred_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    kind: str = Field(default="vaccine", index=True)  # vaccine | dewormer | treatment | other

    code: str = Field(default="", index=True)  # ex.: CLOSTRIDIAL, RAIVA
    name: str = Field(default="")  # nome exibível
    dose: str = Field(default="")  # texto livre (ex.: 2 mL)
    batch: str = Field(default="")  # lote do produto (opcional)
    note: str = Field(default="")  # observação

    linked_weighing_id: Optional[int] = Field(default=None, index=True)
