# PATCH IDEAL_FAZENDA_BACK_V1

Backend standalone (FastAPI + SQLModel + SQLite) para o produto IDEAL Fazenda.
Inclui endpoints:
- GET /health
- CRUD /events (para a UI mock já consumir)
- /whatsapp/webhook (GET verify + POST captura payload bruto)

Porta padrão: 8001 (para não conflitar com outros serviços)

## Rodar
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run_dev.sh
