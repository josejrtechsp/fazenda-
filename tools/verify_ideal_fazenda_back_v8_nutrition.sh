#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Back V8 (nutrition) =="
python3 -m py_compile "$ROOT_DIR/backend/app/models/nutrition.py"
python3 -m py_compile "$ROOT_DIR/backend/app/routers/nutrition.py"
python3 -m py_compile "$ROOT_DIR/backend/app/main.py"
echo "OK: Back V8 compila."
