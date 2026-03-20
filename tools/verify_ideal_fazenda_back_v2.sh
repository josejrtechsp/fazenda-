#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- sanity checks: expected files
if [ ! -f "$ROOT_DIR/backend/app/routers/producer.py" ]; then
  echo "FALTA: backend/app/routers/producer.py"
  exit 1
fi

if [ ! -f "$ROOT_DIR/backend/app/routers/herd.py" ]; then
  echo "FALTA: backend/app/routers/herd.py (corrige import do app.main)"
  exit 1
fi

# --- pick a python interpreter
PY_BIN=""
if [ -x "$ROOT_DIR/backend/.venv/bin/python" ]; then
  PY_BIN="$ROOT_DIR/backend/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PY_BIN="$(command -v python)"
else
  echo "ERRO: nao encontrei python3 (nem python)."
  echo "Instale Python 3 via Homebrew: brew install python@3.12"
  exit 1
fi

# --- import test
(
  cd "$ROOT_DIR/backend" || exit 1
  "$PY_BIN" - <<'PY'
import sys
print("PY:", sys.executable)
import app.main
print("OK: import app.main")
PY
)

echo "OK: verify_ideal_fazenda_back_v2"
