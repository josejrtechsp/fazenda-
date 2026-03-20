#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

PYTHON_BIN="python3"
if [ -x "$HERE/.venv/bin/python" ]; then
  PYTHON_BIN="$HERE/.venv/bin/python"
fi

# garante db
PYTHONPATH="$HERE" "$PYTHON_BIN" -m rebanho_mvp.init_db >/dev/null

PORT="${REBANHO_MVP_PORT:-8011}"
HOST="${REBANHO_MVP_HOST:-127.0.0.1}"

echo "Subindo Rebanho MVP em http://$HOST:$PORT (docs em /docs)"
PYTHONPATH="$HERE" "$PYTHON_BIN" -m uvicorn rebanho_mvp.main:app --reload --host "$HOST" --port "$PORT"
