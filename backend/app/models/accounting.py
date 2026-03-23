from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ChartAccount(SQLModel, table=True):
    """Conta contábil/gerencial (plano de contas em níveis 1..4)."""

    __tablename__ = "chart_accounts"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True)  # ex.: 5.4.4
    name: str = Field(default="", index=True)
    level: int = Field(default=1, index=True)  # 1..4
    parent_code: Optional[str] = Field(default=None, index=True)

    # RECEITA | DESPESA | OUTROS
    category: str = Field(default="DESPESA", index=True)
    source: str = Field(default="INTTEGRA", index=True)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ChartAccountCreate(SQLModel):
    code: str
    name: str
    level: int = 4
    parent_code: Optional[str] = None
    category: str = "DESPESA"
    source: Optional[str] = "MANUAL"
    is_active: Optional[bool] = True


class ChartAccountUpdate(SQLModel):
    name: Optional[str] = None
    parent_code: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
