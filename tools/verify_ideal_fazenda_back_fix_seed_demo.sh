#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="$ROOT/backend"
PY="$BACK/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

echo "== verify back seed demo (fix18) =="
cd "$BACK"
"$PY" -c "import app.main; print('OK import app.main')"
"$PY" - <<'PY'
from app.db.session import init_db
init_db()
print('OK init_db')
PY
echo "OK"
