#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado"
  exit 1
fi

grep -q "opFilaStart" "$FILE" && echo "OK ✅ opFilaStart presente." || { echo "ERRO: opFilaStart ainda não existe"; exit 1; }
grep -q "opFilaNext" "$FILE" && echo "OK ✅ opFilaNext presente." || { echo "ERRO: opFilaNext ainda não existe"; exit 1; }
grep -q "opFilaClear" "$FILE" && echo "OK ✅ opFilaClear presente." || { echo "ERRO: opFilaClear ainda não existe"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
