from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class SupplierCategory(SQLModel, table=True):
    __tablename__ = "supplier_categories"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    parent_id: Optional[int] = Field(default=None, index=True)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class SupplierCategoryCreate(SQLModel):
    name: str
    parent_id: Optional[int] = None
    is_active: Optional[bool] = True


class SupplierCategoryUpdate(SQLModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


class SupplierTag(SQLModel, table=True):
    __tablename__ = "supplier_tags"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="", index=True)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class SupplierTagCreate(SQLModel):
    name: str
    is_active: Optional[bool] = True


class SupplierTagUpdate(SQLModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierTagLink(SQLModel, table=True):
    __tablename__ = "supplier_tag_links"

    id: Optional[int] = Field(default=None, primary_key=True)
    person_id: int = Field(index=True)
    tag_id: int = Field(index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
