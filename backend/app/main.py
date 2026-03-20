from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import cors_origins
from app.db.session import init_db
from app.routers.health import router as health_router
from app.routers.events import router as events_router
from app.routers.whatsapp import router as whatsapp_router
from app.routers.producer import router as producer_router
from app.routers.herd import router as herd_router
from app.routers.nutrition import router as nutrition_router
from app.routers.accounts import router as accounts_router
from app.routers.people import router as people_router
from app.routers.finance_titles import router as finance_titles_router
from app.routers.bank_accounts import router as bank_accounts_router
from app.routers.cost_centers import router as cost_centers_router
from app.routers.payment_methods import router as payment_methods_router
from app.routers.supplier_catalog import router as supplier_catalog_router
from app.routers.operations import router as operations_router
from app.routers.reports import router as reports_router
from app.routers.inventory import router as inventory_router

app = FastAPI(
    title="IDEAL Fazenda API",
    version="0.6.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


app.include_router(health_router)
app.include_router(events_router)
app.include_router(whatsapp_router)
app.include_router(producer_router)
app.include_router(herd_router)
app.include_router(nutrition_router)
app.include_router(accounts_router)
app.include_router(people_router)
app.include_router(finance_titles_router)
app.include_router(bank_accounts_router)
app.include_router(cost_centers_router)
app.include_router(payment_methods_router)
app.include_router(supplier_catalog_router)
app.include_router(operations_router)
app.include_router(reports_router)
app.include_router(inventory_router)
