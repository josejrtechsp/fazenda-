#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Back V4 (WhatsApp questions/send) =="
cd "$ROOT_DIR/backend"

# ativa venv se existir (não falha se não existir)
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

python -m py_compile app/routers/whatsapp.py

echo "OK: whatsapp.py compila (Back V4)."
