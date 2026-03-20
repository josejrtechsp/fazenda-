#!/usr/bin/env bash
set -euo pipefail

CSS="frontend/src/styles/herd_rebanho_fix.css"
HERD="frontend/src/pages/Herd.jsx"

[ -f "$CSS" ] || { echo "ERRO: $CSS não encontrado"; exit 1; }
[ -f "$HERD" ] || { echo "ERRO: $HERD não encontrado"; exit 1; }

grep -q "UX V8 — Rebanho (Visão geral / Lotes / Animais)" "$CSS"   && echo "OK ✅ marker UX V8 encontrado no CSS."   || { echo "ERRO: marker UX V8 não encontrado."; exit 1; }

# checa se Herd.jsx usa classes esperadas
python3 - <<'PY'
from pathlib import Path
t = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
need = ["faz-detail-grid","faz-mini","faz-lots","faz-lot-row","faz-animals","faz-animal-row"]
missing=[x for x in need if x not in t]
if missing:
    print("AVISO: Herd.jsx não contém algumas classes esperadas:", missing)
else:
    print("OK ✅ Herd.jsx contém as classes esperadas.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
