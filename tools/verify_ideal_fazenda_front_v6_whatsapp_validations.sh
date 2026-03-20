#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Front (WhatsApp Validations + Simulador) =="

[ -f "$ROOT_DIR/frontend/src/pages/WhatsAppValidations.jsx" ] || { echo "ERRO: WhatsAppValidations.jsx não encontrado"; exit 1; }

cd "$ROOT_DIR/frontend"
npm run build

echo "OK: build passou (WhatsApp Validations)."
