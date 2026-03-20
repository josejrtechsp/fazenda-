#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Back (Fix: Nutrição WhatsApp + preço automático) =="

cd "$ROOT_DIR/backend"

PYTHON_BIN="${PYTHON_BIN:-python3}"

# 1) py_compile dos arquivos críticos
"$PYTHON_BIN" -m py_compile \
  app/routers/whatsapp.py \
  app/routers/nutrition.py \
  app/models/nutrition.py

# 2) sanity check: funções esperadas existem
"$PYTHON_BIN" - <<'PY'
from app.routers import whatsapp as w
assert hasattr(w, '_enrich_nutrition_cost'), 'faltou _enrich_nutrition_cost'
print('OK: whatsapp.py importou e tem _enrich_nutrition_cost')
PY

echo "OK: Back fix compila e importa."
