from __future__ import annotations
import os

def get_env(name: str, default: str) -> str:
    v = os.getenv(name)
    return v if v not in (None, "") else default

# SQLite por padrão (arquivo em backend/data/rebanho_mvp.db quando rodar a partir de backend/)
DATABASE_URL = get_env("REBANHO_MVP_DATABASE_URL", "sqlite:///./data/rebanho_mvp.db")

# CORS (para o Vite). Separe por vírgula.
CORS_ORIGINS = [o.strip() for o in get_env("REBANHO_MVP_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
