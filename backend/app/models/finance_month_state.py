from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FinanceMonthState(SQLModel, table=True):
    __tablename__ = "finance_month_state"

    id: Optional[int] = Field(default=None, primary_key=True)
    month: str = Field(index=True)
    is_locked: bool = Field(default=False, index=True)
    locked_by: Optional[str] = Field(default=None)
    locked_by_role: Optional[str] = Field(default=None)
    locked_at: Optional[datetime] = Field(default=None, index=True)
    note: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
