#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

python3 - <<'PY'
from pathlib import Path
import re
t = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
if not re.search(r'setTab\(\s*["\']operate["\']\s*\)', t):
    raise SystemExit("ERRO: ainda não encontrei navegação para operate (setTab('operate')).")
print("OK ✅ Navegação operate encontrada.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
