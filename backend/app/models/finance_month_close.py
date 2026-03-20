from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class FinanceMonthClose(SQLModel, table=True):
    __tablename__ = "finance_month_close"

    id: Optional[int] = Field(default=None, primary_key=True)
    month: str = Field(index=True)
    actor: str = Field(default="ui", index=True)
    note: Optional[str] = Field(default=None)

    snapshot: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    net_settled_brl: float = Field(default=0.0)
    net_open_brl: float = Field(default=0.0)
    payable_open_brl: float = Field(default=0.0)
    receivable_open_brl: float = Field(default=0.0)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
