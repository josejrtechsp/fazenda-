#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Backend V1 =="
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$ROOT/backend" ] || { echo "FALTA: backend/"; exit 1; }
[ -f "$ROOT/backend/requirements.txt" ] || { echo "FALTA: backend/requirements.txt"; exit 1; }
[ -f "$ROOT/backend/app/main.py" ] || { echo "FALTA: backend/app/main.py"; exit 1; }
[ -f "$ROOT/backend/app/models.py" ] || { echo "FALTA: backend/app/models.py"; exit 1; }
echo "OK"
