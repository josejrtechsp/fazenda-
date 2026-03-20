from __future__ import annotations

import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()

ENV = _get("FAZENDA_ENV", "dev")
DB_URL = _get("FAZENDA_DB_URL", "sqlite:///./fazenda.db")

# CORS: inclua localhost e 127.0.0.1 nas portas padrão do Vite
DEFAULT_CORS = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        # margem para outras portas comuns
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]
)

def cors_origins() -> List[str]:
    raw = _get("FAZENDA_CORS_ORIGINS", DEFAULT_CORS)
    return [s.strip() for s in raw.split(",") if s.strip()]


WA_VERIFY_TOKEN = _get("WA_VERIFY_TOKEN", "")
WA_APP_SECRET = _get("WA_APP_SECRET", "")
WA_ACCESS_TOKEN = _get("WA_ACCESS_TOKEN", "")
