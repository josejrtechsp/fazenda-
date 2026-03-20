from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Person(SQLModel, table=True):
    """Cadastro de pessoas/entidades usadas no financeiro."""

    __tablename__ = "people"

    id: Optional[int] = Field(default=None, primary_key=True)

    name: str = Field(default="", index=True)
    legal_name: str = Field(default="")
    document_type: str = Field(default="OUTRO", index=True)  # CPF|CNPJ|OUTRO
    document: str = Field(default="", index=True)  # CPF/CNPJ/etc
    phone: str = Field(default="")
    email: str = Field(default="", index=True)

    zip_code: str = Field(default="")
    street: str = Field(default="")
    number: str = Field(default="")
    district: str = Field(default="")
    city: str = Field(default="", index=True)
    state: str = Field(default="", index=True)

    is_customer: bool = Field(default=False, index=True)
    is_supplier: bool = Field(default=False, index=True)
    is_employee: bool = Field(default=False, index=True)
    is_carrier: bool = Field(default=False, index=True)
    is_owner: bool = Field(default=False, index=True)

    supplier_category_id: Optional[int] = Field(default=None, index=True)
    supplier_tags_csv: str = Field(default="")

    bank_name: str = Field(default="")
    bank_branch: str = Field(default="")
    bank_account: str = Field(default="")
    pix_key: str = Field(default="")
    pix_type: str = Field(default="")  # CPF|CNPJ|EMAIL|PHONE|RANDOM

    notes: str = Field(default="")
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PersonCreate(SQLModel):
    name: str
    legal_name: Optional[str] = ""
    document_type: Optional[str] = "OUTRO"
    document: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    zip_code: Optional[str] = ""
    street: Optional[str] = ""
    number: Optional[str] = ""
    district: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    is_customer: Optional[bool] = False
    is_supplier: Optional[bool] = False
    is_employee: Optional[bool] = False
    is_carrier: Optional[bool] = False
    is_owner: Optional[bool] = False
    supplier_category_id: Optional[int] = None
    supplier_tags_csv: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_branch: Optional[str] = ""
    bank_account: Optional[str] = ""
    pix_key: Optional[str] = ""
    pix_type: Optional[str] = ""
    notes: Optional[str] = ""
    is_active: Optional[bool] = True


class PersonUpdate(SQLModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    document_type: Optional[str] = None
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    zip_code: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_customer: Optional[bool] = None
    is_supplier: Optional[bool] = None
    is_employee: Optional[bool] = None
    is_carrier: Optional[bool] = None
    is_owner: Optional[bool] = None
    supplier_category_id: Optional[int] = None
    supplier_tags_csv: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account: Optional[str] = None
    pix_key: Optional[str] = None
    pix_type: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
