from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class NutritionItem(SQLModel, table=True):
    __tablename__ = "nutrition_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, nullable=False)
    category: str = Field(default="NUTRICAO", index=True)  # NUTRICAO/MINERAL/ADITIVO/VOLUMOSO etc
    is_volumoso: bool = Field(default=False, index=True)

    default_unit: str = Field(default="saco", nullable=False)
    kg_per_unit: Optional[float] = Field(default=None)  # ex: saco 40kg, fardo 20kg, rolo 350kg
    matter_dry_pct: Optional[float] = Field(default=None)  # opcional

    aliases: str = Field(default="")  # lista separada por ;
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NutritionPurchase(SQLModel, table=True):
    __tablename__ = "nutrition_purchases"

    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(index=True, nullable=False)

    purchased_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    qty: float = Field(default=0)
    unit: str = Field(default="saco")

    unit_price_brl: float = Field(default=0)
    total_brl: float = Field(default=0)

    supplier: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
