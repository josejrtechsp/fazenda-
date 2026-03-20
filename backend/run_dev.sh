#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# sempre usa a venv local
PY="$ROOT_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "ERRO: venv não encontrada em $ROOT_DIR/.venv"
  echo "Crie com: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

export PYTHONUNBUFFERED=1
export UVICORN_HOST="${UVICORN_HOST:-0.0.0.0}"
export UVICORN_PORT="${UVICORN_PORT:-8001}"

exec "$PY" -m uvicorn app.main:app \
  --host "$UVICORN_HOST" \
  --port "$UVICORN_PORT" \
  --reload \
  --reload-exclude ".venv/*" \
  --reload-exclude "**/__pycache__/*" \
  --reload-exclude "**/*.pyc"
