#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-light}" # light | full
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$HOME/Downloads/IDEAL_FAZENDA_SYSTEM_${TS}_${MODE}.zip"

if [ ! -d "$ROOT/frontend" ] || [ ! -d "$ROOT/backend" ]; then
  echo "ERRO: rode este script na raiz do projeto (onde existem frontend/ e backend/)."
  echo "ROOT detectado: $ROOT"
  exit 1
fi

cd "$ROOT"

REL_EX=(
  "frontend/node_modules/*"
  "frontend/dist/*"
  "frontend/.vite/*"
  "backend/.venv/*"
  "**/__pycache__/*"
  "**/.pytest_cache/*"
  "**/.mypy_cache/*"
  "**/.ruff_cache/*"
  "**/.cache/*"
  "**/coverage/*"
  "**/.DS_Store"
  ".git/*"
  ".idea/*"
  ".vscode/*"
  ".env"
)

if [ "$MODE" = "light" ]; then
  REL_EX+=(
    "Arquivo/_tmp/*"
    "data/*.parquet"
    "data/*.sqlite-wal"
    "data/*.sqlite-shm"
    "backend/fazenda.db-wal"
    "backend/fazenda.db-shm"
  )
fi

rm -f "$OUT"
echo "Gerando ZIP em: $OUT"
zip -r "$OUT" . -x "${REL_EX[@]}"

echo "OK ✅ ZIP gerado:"
echo "$OUT"
