#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Front V15F (header + dashboard demo) =="
cd "$ROOT_DIR/frontend"

npm run build

echo "OK: build passou (V15F)."
