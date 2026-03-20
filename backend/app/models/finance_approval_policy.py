from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FinanceApprovalPolicy(SQLModel, table=True):
    __tablename__ = "finance_approval_policy"

    id: Optional[int] = Field(default=None, primary_key=True)
    enabled: bool = Field(default=False, index=True)

    # Compat: regra simples por limiar unico
    payable_threshold_brl: float = Field(default=0.0)
    receivable_threshold_brl: float = Field(default=0.0)
    payable_required_by: str = Field(default="gestor")
    receivable_required_by: str = Field(default="gestor")

    # Nova regra: faixas (JSON em texto)
    # Ex.: [{"min_brl":5000,"required_by":"gestor"},{"min_brl":20000,"required_by":"admin"}]
    payable_tiers_json: str = Field(default="[]")
    receivable_tiers_json: str = Field(default="[]")

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
