from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import CORS_ORIGINS
from .core.db import init_db
from .routers.mangas import router as mangas_router
from .routers.animais import router as animais_router
from .routers.pesagens import router as pesagens_router
from .routers.movimentacoes import router as movimentacoes_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="IDEAL Fazenda — Rebanho MVP",
        version="1.0.0",
        description="Backend isolado (SQLite) para validar o MVP do Rebanho: Mangas, Animais, Pesagens e Movimentações.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup():
        init_db()

    @app.get("/health")
    def health():
        return {"ok": True}

    app.include_router(mangas_router, prefix="/api/rebanho")
    app.include_router(animais_router, prefix="/api/rebanho")
    app.include_router(pesagens_router, prefix="/api/rebanho")
    app.include_router(movimentacoes_router, prefix="/api/rebanho")

    return app


app = create_app()
