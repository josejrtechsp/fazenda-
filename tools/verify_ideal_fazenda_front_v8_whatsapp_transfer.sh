#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Front V8 (WhatsApp ear tags + resumo WhatsApp) =="

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# checa arquivos
test -f "$ROOT_DIR/frontend/src/pages/WhatsAppValidations.jsx"
test -f "$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx"

# checa marcadores
grep -q "parseEarTagsText" "$ROOT_DIR/frontend/src/pages/WhatsAppValidations.jsx"
grep -q "Copiar resumo WhatsApp" "$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx"

echo "OK: Arquivos e marcadores presentes."

echo "(Opcional) Rodando build para pegar erro de import/deps..."
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  (cd "$ROOT_DIR/frontend" && npm run build)
  echo "OK: npm run build"
else
  echo "WARN: package.json não encontrado em frontend/ (projeto incompleto?)"
fi
