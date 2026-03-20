from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CostCenter(SQLModel, table=True):
    __tablename__ = "cost_centers"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(default="", index=True)
    name: str = Field(default="", index=True)
    parent_id: Optional[int] = Field(default=None, index=True)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class CostCenterCreate(SQLModel):
    code: str
    name: str
    parent_id: Optional[int] = None
    is_active: Optional[bool] = True


class CostCenterUpdate(SQLModel):
    code: Optional[str] = None
    name: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None
