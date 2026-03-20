#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Verificando UX V5 (Rebanho)..."

FILE="$ROOT/frontend/src/pages/Herd.jsx"

if [ ! -f "$FILE" ]; then
  echo "ERRO: Herd.jsx não encontrado em $FILE" >&2
  exit 1
fi

grep -q "subtabs={headerTabs}" "$FILE"
grep -q "Pesagem rápida" "$FILE"
grep -q "submitQuickWeigh" "$FILE"

echo "OK ✅ Arquivo atualizado (subtabs + pesagem rápida)."

# Build opcional (só se node_modules existir)
if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando npm run build (frontend)..."
  (cd "$ROOT/frontend" && npm run build)
else
  echo "Aviso: frontend/node_modules não encontrado — pulando npm run build."
fi

echo "OK ✅ Verify concluído."
