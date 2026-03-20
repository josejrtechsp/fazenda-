#!/usr/bin/env bash
set -euo pipefail

HERD="frontend/src/pages/Herd.jsx"
CSS="frontend/src/styles/herd_rebanho_fix.css"

[ -f "$HERD" ] || { echo "ERRO: $HERD não encontrado"; exit 1; }
[ -f "$CSS" ] || { echo "ERRO: $CSS não encontrado"; exit 1; }

grep -q "UX V9 — Rebanho (Visão Geral + Animais lista)" "$CSS" && echo "OK ✅ CSS V9 encontrado." || { echo "ERRO: CSS V9 não encontrado."; exit 1; }

python3 - <<'PY'
from pathlib import Path
t = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
need = ["faz-kpiGrid","faz-kpiCard","faz-catGrid","animalsView","setAnimalsView"]
missing=[x for x in need if x not in t]
if missing:
    raise SystemExit("ERRO: Herd.jsx não contém marcas do V9: " + ", ".join(missing))
print("OK ✅ Herd.jsx contém marcas do V9.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
