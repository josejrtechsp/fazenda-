from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class PaymentMethod(SQLModel, table=True):
    __tablename__ = "payment_methods"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    method_type: str = Field(default="PIX", index=True)
    fee_percent: float = Field(default=0.0)
    term_days: int = Field(default=0)
    default_bank_account_id: Optional[int] = Field(default=None, index=True)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PaymentMethodCreate(SQLModel):
    name: str
    method_type: Optional[str] = "PIX"
    fee_percent: Optional[float] = 0.0
    term_days: Optional[int] = 0
    default_bank_account_id: Optional[int] = None
    is_active: Optional[bool] = True


class PaymentMethodUpdate(SQLModel):
    name: Optional[str] = None
    method_type: Optional[str] = None
    fee_percent: Optional[float] = None
    term_days: Optional[int] = None
    default_bank_account_id: Optional[int] = None
    is_active: Optional[bool] = None
