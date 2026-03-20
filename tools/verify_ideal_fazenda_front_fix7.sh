#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Verificando IDEAL Fazenda Front FIX7 =="
cd "$ROOT_DIR/frontend"
npm run build
echo "OK: build passou (FIX7)."
