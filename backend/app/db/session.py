from __future__ import annotations

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine

load_dotenv()


def _default_db_url() -> str:
    # Mantém o SQLite fora do iCloud para evitar modo readonly em processos launchd.
    return f"sqlite:///{Path.home() / '.fazenda_ideal' / 'fazenda.db'}"


def _db_url() -> str:
    db_url = os.getenv("DATABASE_URL", "").strip()
    return db_url if db_url else _default_db_url()


def _sqlite_file_from_url(url: str) -> Path | None:
    if not url.startswith("sqlite:///"):
        return None
    raw = url[len("sqlite:///") :].split("?", 1)[0]
    if not raw or raw == ":memory:":
        return None
    if raw.startswith("/"):
        return Path(raw)
    return Path.cwd() / raw


def _bootstrap_sqlite_file(url: str) -> None:
    target = _sqlite_file_from_url(url)
    if target is None:
        return
    target.parent.mkdir(parents=True, exist_ok=True)

    legacy = Path(__file__).resolve().parents[2] / "fazenda.db"
    if target.resolve() == legacy.resolve():
        return
    if target.exists() or not legacy.exists():
        return

    shutil.copy2(legacy, target)


def get_engine():
    """Engine do banco. (SQLite em dev)"""
    url = _db_url()
    _bootstrap_sqlite_file(url)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, echo=False, connect_args=connect_args)


ENGINE = get_engine()


def get_session():
    """Dependency de Session para FastAPI routers."""
    with Session(ENGINE) as session:
        yield session


def init_db() -> None:
    """Inicializa DB + garante schema minimo para o Rebanho."""
    # Importa models para registrar no metadata (import side-effect)
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(ENGINE)

    # SQLite: garante colunas/tabelas para o módulo Rebanho
    try:
        if _db_url().startswith("sqlite"):
            from app.db.migrate import ensure_sqlite_schema

            ensure_sqlite_schema(ENGINE)
    except Exception:
        # não derruba o app se migração falhar
        pass
