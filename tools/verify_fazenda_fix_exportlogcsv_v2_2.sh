#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
HFILE="$ROOT/frontend/src/pages/Herd.jsx"
[ -f "$HFILE" ] || { echo "ERRO: Herd.jsx não encontrado"; exit 1; }

grep -n "const exportLogCsv" "$HFILE" >/dev/null || { echo "ERRO: definição const exportLogCsv não encontrada"; exit 1; }

if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd "$ROOT/frontend" && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
