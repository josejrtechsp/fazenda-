from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import SupplierCategory, SupplierCategoryCreate, SupplierCategoryUpdate, SupplierTag, SupplierTagCreate, SupplierTagUpdate

router = APIRouter(tags=["supplier_catalog"])


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _serialize_category(obj: SupplierCategory) -> Dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "parent_id": obj.parent_id,
        "is_active": obj.is_active,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


def _serialize_tag(obj: SupplierTag) -> Dict[str, Any]:
    return {
        "id": obj.id,
        "name": obj.name,
        "is_active": obj.is_active,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }


@router.get("/supplier-categories")
def list_supplier_categories(
    q: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = Query(default=300, ge=1, le=3000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(SupplierCategory)
    if not include_inactive:
        stmt = stmt.where(SupplierCategory.is_active == True)  # noqa
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: (str(r.name or "").lower(), int(r.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [r for r in rows if nq in _norm_text(r.name)]

    return [_serialize_category(r) for r in rows[:limit]]


@router.post("/supplier-categories")
def create_supplier_category(payload: SupplierCategoryCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da categoria e obrigatorio")

    existing = list(session.exec(select(SupplierCategory)).all())
    if any(_norm_text(c.name) == _norm_text(name) for c in existing):
        raise HTTPException(status_code=422, detail="categoria ja cadastrada")

    obj = SupplierCategory(
        name=name,
        parent_id=payload.parent_id,
        is_active=bool(payload.is_active if payload.is_active is not None else True),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize_category(obj)


@router.patch("/supplier-categories/{category_id}")
def update_supplier_category(category_id: int, patch: SupplierCategoryUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    obj = session.get(SupplierCategory, int(category_id))
    if not obj:
        raise HTTPException(status_code=404, detail="categoria nao encontrada")

    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="nome da categoria nao pode ser vazio")
        existing = list(session.exec(select(SupplierCategory)).all())
        if any(int(c.id or 0) != int(obj.id or 0) and _norm_text(c.name) == _norm_text(name) for c in existing):
            raise HTTPException(status_code=422, detail="categoria ja cadastrada")
        obj.name = name

    if "parent_id" in data:
        obj.parent_id = data.get("parent_id")
    if "is_active" in data:
        obj.is_active = bool(data.get("is_active"))

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize_category(obj)


@router.post("/supplier-categories/seed-defaults")
def seed_default_supplier_categories(session: Session = Depends(get_session)) -> Dict[str, Any]:
    defaults = [
        "Insumos agricolas",
        "Servicos agricolas",
        "Pecuaria",
        "Maquinas",
        "Infraestrutura/manutencao",
        "Administracao",
        "RH",
    ]
    existing = list(session.exec(select(SupplierCategory)).all())
    existing_norm = {_norm_text(x.name) for x in existing}

    created = 0
    for name in defaults:
        if _norm_text(name) in existing_norm:
            continue
        session.add(SupplierCategory(name=name, is_active=True))
        created += 1

    session.commit()
    return {"ok": True, "created": created}


@router.get("/supplier-tags")
def list_supplier_tags(
    q: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    stmt = select(SupplierTag)
    if not include_inactive:
        stmt = stmt.where(SupplierTag.is_active == True)  # noqa
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: (str(r.name or "").lower(), int(r.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [r for r in rows if nq in _norm_text(r.name)]

    return [_serialize_tag(r) for r in rows[:limit]]


@router.post("/supplier-tags")
def create_supplier_tag(payload: SupplierTagCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="nome da tag e obrigatorio")

    existing = list(session.exec(select(SupplierTag)).all())
    if any(_norm_text(t.name) == _norm_text(name) for t in existing):
        raise HTTPException(status_code=422, detail="tag ja cadastrada")

    obj = SupplierTag(
        name=name,
        is_active=bool(payload.is_active if payload.is_active is not None else True),
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize_tag(obj)


@router.patch("/supplier-tags/{tag_id}")
def update_supplier_tag(tag_id: int, patch: SupplierTagUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    obj = session.get(SupplierTag, int(tag_id))
    if not obj:
        raise HTTPException(status_code=404, detail="tag nao encontrada")

    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="nome da tag nao pode ser vazio")
        existing = list(session.exec(select(SupplierTag)).all())
        if any(int(t.id or 0) != int(obj.id or 0) and _norm_text(t.name) == _norm_text(name) for t in existing):
            raise HTTPException(status_code=422, detail="tag ja cadastrada")
        obj.name = name

    if "is_active" in data:
        obj.is_active = bool(data.get("is_active"))

    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return _serialize_tag(obj)


@router.post("/supplier-tags/seed-defaults")
def seed_default_supplier_tags(session: Session = Depends(get_session)) -> Dict[str, Any]:
    defaults = [
        "corretivos",
        "fertilizantes",
        "defensivos",
        "sementes",
        "mudas",
        "colheita",
        "frete",
        "operacoes mecanizadas",
        "nutricao",
        "sanidade",
        "reproducao",
        "rastreabilidade",
        "combustivel",
        "manutencao",
        "seguros",
        "contabilidade",
        "juridico",
        "energia",
        "epi",
        "beneficios",
        "treinamentos",
    ]
    existing = list(session.exec(select(SupplierTag)).all())
    existing_norm = {_norm_text(x.name) for x in existing}

    created = 0
    for name in defaults:
        if _norm_text(name) in existing_norm:
            continue
        session.add(SupplierTag(name=name, is_active=True))
        created += 1

    session.commit()
    return {"ok": True, "created": created}
