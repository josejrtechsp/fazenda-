from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class Event(SQLModel, table=True):
    __tablename__ = "events"

    id: Optional[int] = Field(default=None, primary_key=True)

    source: str = Field(default="manual", index=True)
    status: str = Field(default="pending", index=True)

    type: str = Field(index=True)
    occurred_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    raw_text: Optional[str] = Field(default=None)

    # JSON livre (nlp, whatsapp meta, etc)
    payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class EventCreate(SQLModel):
    # status/source podem vir do sistema
    type: str
    occurred_at: Optional[datetime] = None
    raw_text: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    source: Optional[str] = None
    status: Optional[str] = None


class EventRead(SQLModel):
    id: int
    source: str
    status: str
    type: str
    occurred_at: datetime
    raw_text: Optional[str] = None
    payload: Dict[str, Any] = {}
    created_at: datetime


class EventUpdate(SQLModel):
    source: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    occurred_at: Optional[datetime] = None
    raw_text: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
