#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"
echo "== Verificando IDEAL Fazenda Front V12 (Nutrição admin) =="
npm run build
echo "OK: build passou (Front V12)."
