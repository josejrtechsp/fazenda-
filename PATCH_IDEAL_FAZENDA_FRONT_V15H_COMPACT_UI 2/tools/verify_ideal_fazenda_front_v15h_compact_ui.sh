#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if [ ! -f package.json ]; then
  echo "ERRO: frontend/package.json nao encontrado. Execute o unzip na raiz do projeto IDEAL_FAZENDA." >&2
  exit 1
fi

npm run build

echo "OK: Front V15H (compact UI) build passou."
