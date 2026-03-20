#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== verify rebanho ficha v1 =="

test -f "$ROOT/frontend/src/pages/Herd.jsx" || { echo "ERRO: Herd.jsx não encontrado"; exit 1; }
test -f "$ROOT/frontend/src/styles/herd_rebanho_fix.css" || { echo "ERRO: herd_rebanho_fix.css não encontrado"; exit 1; }
test -f "$ROOT/backend/app/routers/herd.py" || { echo "ERRO: backend herd router não encontrado"; exit 1; }

# checa endpoints no router
if ! grep -q "@router.get(\"/animal/" "$ROOT/backend/app/routers/herd.py"; then
  echo "ERRO: endpoint GET /herd/animal/{ear_tag} não encontrado"; exit 1;
fi
if ! grep -q "@router.post(\"/weighings\"" "$ROOT/backend/app/routers/herd.py"; then
  echo "ERRO: endpoint POST /herd/weighings não encontrado"; exit 1;
fi

PY="$ROOT/backend/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

( cd "$ROOT/backend" && "$PY" -c "import app.main; print('OK: import app.main')" )

echo "OK: verify concluído."
