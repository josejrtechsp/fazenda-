from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any

from sqlmodel import SQLModel, Field, Column, JSON


class EventBase(SQLModel):
    source: str = "app"  # app|whatsapp
    status: str = "pending"  # pending|approved|rejected
    type: str  # transfer|nutrition|occurrence|query|weighing|exit|cost
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    raw_text: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class Event(EventBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int
    created_at: datetime


class EventUpdate(SQLModel):
    status: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None


# ============================================================
# Herd / Inventory (mínimo para aplicar transferências)
# ============================================================


class Lot(SQLModel, table=True):
    """Lote cadastrado.

    Nota: usamos o mesmo número do campo (ex.: 10, 15) como chave primária.
    Isso facilita o WhatsApp ("lote 10") sem precisar mapear IDs internos.
    """

    id: int = Field(primary_key=True)
    label: str = ""
    # Cabeças "sem brinco" (ou não conciliadas). Para transferências por quantidade.
    heads_untagged: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Animal(SQLModel, table=True):
    """Animal individual por brinco/ID.

    Ear tag pode ser numérico ("30") ou alfanumérico ("A12").
    """

    ear_tag: str = Field(primary_key=True)
    lot_id: Optional[int] = Field(default=None, index=True)
    status: str = "active"  # active|sold|dead
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
