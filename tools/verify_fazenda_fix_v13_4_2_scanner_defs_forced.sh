#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado"
  exit 1
fi

grep -q "const opFilaStart" "$FILE" && echo "OK ✅ opFilaStart definido." || { echo "ERRO: opFilaStart não definido"; exit 1; }
grep -q "const opParseFila" "$FILE" && echo "OK ✅ opParseFila definido." || { echo "ERRO: opParseFila não definido"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
