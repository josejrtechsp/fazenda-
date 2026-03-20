#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== verify REBANHO_TRANSFER_LOTE_V1 =="

if ! grep -R --line-number "REBANHO_TRANSFER_LOTE_V1" "$ROOT/frontend/src/pages/Herd.jsx" >/dev/null 2>&1; then
  echo "ERRO: marker não encontrado no front (Herd.jsx)"
  exit 1
fi

if ! grep -R --line-number "@router.post(\"/move\")" "$ROOT/backend/app/routers/herd.py" >/dev/null 2>&1; then
  echo "ERRO: endpoint /herd/move não encontrado no backend"
  exit 1
fi

echo "OK: markers presentes."
