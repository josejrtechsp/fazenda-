#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado"
  exit 1
fi

grep -q "FIX V13.6 SAFE SCANNER HANDLERS" "$FILE" && echo "OK ✅ marker V13.6 encontrado." || { echo "ERRO: marker V13.6 não encontrado"; exit 1; }
grep -q "onOpFilaStartSafe" "$FILE" && echo "OK ✅ handler safe presente." || { echo "ERRO: handler safe não encontrado"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi
echo "OK ✅ Verify concluído."
