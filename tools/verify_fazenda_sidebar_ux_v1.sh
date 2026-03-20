#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_MAIN="$ROOT/frontend/src/main.jsx"

if [ ! -f "$TARGET_MAIN" ]; then
  echo "ERRO: não encontrei $TARGET_MAIN"
  exit 1
fi

echo "Verificando imports do main.jsx..."
if ! grep -q "./styles/App.css" "$TARGET_MAIN"; then
  echo "ERRO: main.jsx não importa ./styles/App.css"
  exit 1
fi
if ! grep -q "./styles/cras_ui_v2.css" "$TARGET_MAIN"; then
  echo "ERRO: main.jsx não importa ./styles/cras_ui_v2.css (layout da sidebar)"
  exit 1
fi

echo "OK ✅ Imports essenciais presentes."

# Build check opcional
if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando build check (npm run build)..."
  (cd "$ROOT/frontend" && npm run build)
  echo "OK ✅ Build passou."
else
  echo "INFO: node_modules não encontrado — pulando npm run build."
  echo "Se quiser checar manualmente: cd frontend && npm install && npm run build"
fi
