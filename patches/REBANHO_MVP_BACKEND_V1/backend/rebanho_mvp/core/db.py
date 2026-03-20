from __future__ import annotations

from pathlib import Path
from sqlmodel import SQLModel, create_engine
from .config import DATABASE_URL

def _ensure_sqlite_dir(database_url: str) -> None:
    # sqlite:///./data/rebanho_mvp.db -> ./data
    if database_url.startswith("sqlite:///"):
        rel = database_url.replace("sqlite:///", "", 1)
        # Se for :memory: não cria pasta
        if rel == ":memory:":
            return
        p = Path(rel)
        if p.parent and str(p.parent) not in (".", ""):
            p.parent.mkdir(parents=True, exist_ok=True)

def get_engine():
    _ensure_sqlite_dir(DATABASE_URL)
    connect_args = {}
    if DATABASE_URL.startswith("sqlite:///"):
        connect_args = {"check_same_thread": False}
    return create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

engine = get_engine()

def init_db() -> None:
    from .. import models  # noqa: F401 (garante import das tabelas)
    SQLModel.metadata.create_all(engine)
