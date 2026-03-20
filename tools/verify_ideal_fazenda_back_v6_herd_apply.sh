#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Back V6 (herd + apply transfer) =="
python3 -m py_compile "$ROOT_DIR/backend/app/models.py"
python3 -m py_compile "$ROOT_DIR/backend/app/routers/herd.py"
python3 -m py_compile "$ROOT_DIR/backend/app/routers/events.py"
python3 -m py_compile "$ROOT_DIR/backend/app/main.py"

echo "OK: Back V6 compila."
