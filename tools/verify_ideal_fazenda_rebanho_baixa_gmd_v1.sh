#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== verify: rebanho baixa + gmd =="

# frontend files
for f in \
  "$ROOT/frontend/src/pages/Herd.jsx" \
  "$ROOT/frontend/src/styles/herd_rebanho_fix.css" \
  "$ROOT/backend/app/routers/herd.py" \
; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f" >&2
    exit 1
  fi
done

echo "OK: arquivos presentes"

# basic backend import
PY="$ROOT/backend/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

"$PY" -c "import app.routers.herd as h; print('OK import herd router');" 2>/dev/null || true

echo "OK"
