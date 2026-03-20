#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="$ROOT/backend"

PY="$BACK/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

echo "== verify Rebanho Reprodução (IATF/Resync) =="
echo "ROOT: $ROOT"
echo "BACK: $BACK"
echo "PY:   $PY"

# front files
[[ -f "$ROOT/frontend/src/pages/Herd.jsx" ]] || { echo "FALTA: frontend/src/pages/Herd.jsx"; exit 1; }
[[ -f "$ROOT/frontend/src/styles/herd_rebanho_fix.css" ]] || { echo "FALTA: frontend/src/styles/herd_rebanho_fix.css"; exit 1; }

# back import
cd "$BACK"
"$PY" -c "import app.routers.herd; print('OK import app.routers.herd')"

echo "OK"
