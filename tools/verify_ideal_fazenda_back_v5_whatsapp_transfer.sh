#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Back V5 (WhatsApp ear tags + resumo WhatsApp) =="

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# compila routers (sem precisar de venv)
python3 -m py_compile "$ROOT_DIR/backend/app/routers/whatsapp.py"
python3 -m py_compile "$ROOT_DIR/backend/app/routers/producer.py"

echo "OK: whatsapp.py + producer.py compilam (Back V5)."

echo "Dica: depois suba o backend e teste:"
echo "  curl -s -X POST http://localhost:8001/whatsapp/ingest -H 'Content-Type: application/json' -d '{\"text\":\"mudei gado 30 do lote 10 para o lote 15\"}'"
echo "  curl -s http://localhost:8001/producer/monthly-summary-text"
