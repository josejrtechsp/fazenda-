#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

need(){
  if [ ! -f "$ROOT_DIR/$1" ]; then
    echo "FALTA: $1"
    exit 1
  fi
}

need "backend/app/models/herd.py"
need "backend/app/routers/herd.py"
need "frontend/src/pages/Herd.jsx"

PY="$ROOT_DIR/backend/.venv/bin/python"
if [ ! -x "$PY" ]; then
  PY="python3"
fi

"$PY" -c "import py_compile; py_compile.compile('$ROOT_DIR/backend/app/models/herd.py', doraise=True); py_compile.compile('$ROOT_DIR/backend/app/routers/herd.py', doraise=True)"

echo "OK: verify_ideal_fazenda_rebanho_seed_v1"
