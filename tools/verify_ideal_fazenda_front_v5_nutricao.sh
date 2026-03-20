#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Front V5 (Nutrição) =="

# Checagens rápidas
[ -f "$ROOT_DIR/frontend/src/pages/Nutrition.jsx" ] || { echo "ERRO: Nutrition.jsx não encontrado"; exit 1; }

# Build real
cd "$ROOT_DIR/frontend"
npm run build

echo "OK: build passou (V5 Nutrição)."
