#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

need_file() {
  local p="$1"
  if [[ ! -f "$ROOT_DIR/$p" ]]; then
    echo "FALTA: $p"
    exit 1
  fi
}

need_file "frontend/src/components/PageHeader.jsx"

# build check (detecta imports faltando)
if [[ -f "$ROOT_DIR/frontend/package.json" ]]; then
  echo "== Build check (npm run build) =="
  (cd "$ROOT_DIR/frontend" && npm run build >/dev/null)
  echo "OK: build passou"
else
  echo "AVISO: frontend/package.json não encontrado; pulando build."
fi

echo "OK: IDEAL Fazenda Front FIX6B (PageHeader + build check)"
