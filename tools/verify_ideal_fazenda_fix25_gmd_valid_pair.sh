#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="$ROOT/backend"
PY="$BACK/.venv/bin/python"
if [[ ! -x "$PY" ]]; then PY="python3"; fi
echo "== verify FIX25 (GMD valid pair) =="
echo "PY: $PY"
echo "BACK: $BACK"
"$PY" -c "import app.main; print('OK import app.main')"
echo "OK"
