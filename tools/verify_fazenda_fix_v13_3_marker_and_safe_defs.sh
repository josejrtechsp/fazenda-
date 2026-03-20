#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado"
  exit 1
fi

grep -q "UX V13 SCANNER" "$FILE" && echo "OK ✅ marker V13 encontrado." || { echo "ERRO: marker V13 não encontrado"; exit 1; }
grep -q "opFilaStart" "$FILE" && echo "OK ✅ opFilaStart presente." || { echo "ERRO: opFilaStart não encontrado"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
