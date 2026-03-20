from __future__ import annotations

import json
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import ChartAccount

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _seed_path() -> Path:
    return Path(__file__).resolve().parents[1] / "seeds" / "inttegra_accounts.json"


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _code_sort_key(code: str) -> tuple:
    parts = []
    for p in str(code or "").split("."):
        try:
            parts.append(int(p))
        except Exception:
            parts.append(0)
    while len(parts) < 4:
        parts.append(0)
    return tuple(parts[:4])


def _load_seed_items() -> List[Dict[str, Any]]:
    p = _seed_path()
    if not p.exists():
        raise HTTPException(status_code=500, detail=f"arquivo de seed não encontrado: {p}")
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"seed inválido: {type(e).__name__}: {e}") from e
    if not isinstance(raw, list):
        raise HTTPException(status_code=500, detail="seed inválido: esperado array JSON")
    out: List[Dict[str, Any]] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if not code:
            continue
        parts = code.split(".")
        level = int(row.get("level") or len(parts))
        parent_code = row.get("parent_code")
        if parent_code is not None:
            parent_code = str(parent_code).strip() or None
        category = str(row.get("category") or "DESPESA").strip().upper() or "DESPESA"
        out.append(
            {
                "code": code,
                "name": name or f"Conta {code}",
                "level": level,
                "parent_code": parent_code,
                "category": category,
                "source": "INTTEGRA",
            }
        )
    out.sort(key=lambda x: _code_sort_key(x["code"]))
    return out


def _build_tree(rows: List[ChartAccount]) -> List[Dict[str, Any]]:
    nodes: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        nodes[r.code] = {
            "code": r.code,
            "name": r.name,
            "level": r.level,
            "parent_code": r.parent_code,
            "category": r.category,
            "source": r.source,
            "is_active": r.is_active,
            "children": [],
        }

    roots: List[Dict[str, Any]] = []
    for code in sorted(nodes.keys(), key=_code_sort_key):
        node = nodes[code]
        parent = node.get("parent_code")
        if parent and parent in nodes:
            nodes[parent]["children"].append(node)
        else:
            roots.append(node)

    def _sort_rec(items: List[Dict[str, Any]]) -> None:
        items.sort(key=lambda n: _code_sort_key(str(n.get("code") or "")))
        for it in items:
            _sort_rec(it.get("children") or [])

    _sort_rec(roots)
    return roots


@router.get("")
def list_accounts(
    q: Optional[str] = None,
    category: Optional[str] = None,
    level: Optional[int] = None,
    parent_code: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = 800,
    session: Session = Depends(get_session),
) -> List[ChartAccount]:
    if level is not None and (int(level) < 1 or int(level) > 4):
        raise HTTPException(status_code=422, detail="level deve estar entre 1 e 4")
    if limit < 1:
        limit = 1
    if limit > 5000:
        limit = 5000

    stmt = select(ChartAccount)
    if not include_inactive:
        stmt = stmt.where(ChartAccount.is_active == True)  # noqa
    if category:
        stmt = stmt.where(ChartAccount.category == str(category).strip().upper())
    if level is not None:
        stmt = stmt.where(ChartAccount.level == int(level))
    if parent_code:
        stmt = stmt.where(ChartAccount.parent_code == str(parent_code).strip())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: _code_sort_key(r.code))

    if q:
        nq = _norm_text(q)
        rows = [r for r in rows if nq in _norm_text(r.code) or nq in _norm_text(r.name)]

    return rows[:limit]


@router.get("/tree")
def list_accounts_tree(
    category: Optional[str] = None,
    max_level: int = 4,
    include_inactive: bool = False,
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    if max_level < 1 or max_level > 4:
        raise HTTPException(status_code=422, detail="max_level deve estar entre 1 e 4")

    stmt = select(ChartAccount).where(ChartAccount.level <= int(max_level))
    if not include_inactive:
        stmt = stmt.where(ChartAccount.is_active == True)  # noqa
    if category:
        stmt = stmt.where(ChartAccount.category == str(category).strip().upper())
    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda r: _code_sort_key(r.code))
    return _build_tree(rows)


@router.post("/seed-inttegra")
def seed_inttegra_accounts(
    reset: bool = False,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    items = _load_seed_items()
    created = 0
    updated = 0
    deleted = 0

    if reset:
        to_delete = list(session.exec(select(ChartAccount).where(ChartAccount.source == "INTTEGRA")).all())
        for row in to_delete:
            session.delete(row)
        deleted = len(to_delete)
        session.commit()

    for row in items:
        ex = session.exec(select(ChartAccount).where(ChartAccount.code == row["code"]).limit(1)).first()
        if ex:
            changed = False
            for field in ("name", "level", "parent_code", "category", "source"):
                val = row.get(field)
                if getattr(ex, field) != val:
                    setattr(ex, field, val)
                    changed = True
            if not ex.is_active:
                ex.is_active = True
                changed = True
            if changed:
                ex.updated_at = datetime.utcnow()
                session.add(ex)
                updated += 1
            continue

        obj = ChartAccount(
            code=row["code"],
            name=row["name"],
            level=row["level"],
            parent_code=row["parent_code"],
            category=row["category"],
            source="INTTEGRA",
            is_active=True,
        )
        session.add(obj)
        created += 1

    session.commit()

    total = session.exec(select(ChartAccount)).all()
    total_active = [r for r in total if r.is_active]

    return {
        "ok": True,
        "seed_file": str(_seed_path()),
        "seed_items": len(items),
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "total_accounts": len(total),
        "total_active": len(total_active),
        "levels": {
            "1": sum(1 for r in total_active if int(r.level or 0) == 1),
            "2": sum(1 for r in total_active if int(r.level or 0) == 2),
            "3": sum(1 for r in total_active if int(r.level or 0) == 3),
            "4": sum(1 for r in total_active if int(r.level or 0) == 4),
        },
    }
