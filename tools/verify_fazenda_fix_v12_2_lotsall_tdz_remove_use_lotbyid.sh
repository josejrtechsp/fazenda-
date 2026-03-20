#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
t = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
if "FIX V12.1: fallback para lista de lotes/mangas" in t:
    raise SystemExit("ERRO: bloco V12.1 ainda existe.")
if "const opMangas = useMemo" not in t:
    raise SystemExit("ERRO: opMangas não encontrado.")
print("OK ✅ V12.2 verificado.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
