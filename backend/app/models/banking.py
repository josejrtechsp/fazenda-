from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class BankAccount(SQLModel, table=True):
    __tablename__ = "bank_accounts"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    bank_name: str = Field(default="", index=True)
    branch: str = Field(default="")
    account_number: str = Field(default="")
    account_type: str = Field(default="CORRENTE", index=True)
    opening_balance: float = Field(default=0.0)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class BankAccountCreate(SQLModel):
    name: str
    bank_name: Optional[str] = ""
    branch: Optional[str] = ""
    account_number: Optional[str] = ""
    account_type: Optional[str] = "CORRENTE"
    opening_balance: Optional[float] = 0.0
    is_active: Optional[bool] = True


class BankAccountUpdate(SQLModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    account_number: Optional[str] = None
    account_type: Optional[str] = None
    opening_balance: Optional[float] = None
    is_active: Optional[bool] = None
