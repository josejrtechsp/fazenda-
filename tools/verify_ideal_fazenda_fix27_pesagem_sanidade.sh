#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACK="$ROOT/backend"
PY="$BACK/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

echo "== verify FIX27 (pesagem + sanidade) =="
echo "ROOT: $ROOT"
echo "BACK: $BACK"
echo "PY:   $PY"
echo

( cd "$BACK" && "$PY" -c "import app.main; print('OK: import app.main')" )

echo "OK: verify concluído."
