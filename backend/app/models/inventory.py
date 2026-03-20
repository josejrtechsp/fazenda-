from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, SQLModel


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    name: str = Field(index=True)
    item_type: str = Field(default="")
    manufacturer: str = Field(default="")
    quantity: float = Field(default=0.0)
    unit: str = Field(default="un")
    unit_price_brl: float = Field(default=0.0)
    batch: str = Field(default="")
    expires_on: str = Field(default="")
    location: str = Field(default="")
    property_name: str = Field(default="")
    last_movement_at: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class InventoryItemPayload(SQLModel):
    name: str
    item_type: Optional[str] = ""
    manufacturer: Optional[str] = ""
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "un"
    unit_price_brl: Optional[float] = 0.0
    batch: Optional[str] = ""
    expires_on: Optional[str] = ""
    location: Optional[str] = ""
    property_name: Optional[str] = ""
    last_movement_at: Optional[str] = ""


class InventoryBulkReplace(SQLModel):
    items: List[InventoryItemPayload] = Field(default_factory=list)
