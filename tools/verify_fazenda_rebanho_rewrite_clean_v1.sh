\
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
HFILE="$ROOT/frontend/src/pages/Herd.jsx"
[ -f "$HFILE" ] || { echo "ERRO: $HFILE não encontrado"; exit 1; }

# sanity checks
grep -q "REBANHO (REWRITE CLEAN V1)" "$HFILE" && echo "OK ✅ marcador encontrado." || { echo "ERRO: marcador não encontrado"; exit 1; }
grep -q "export default function Herd" "$HFILE" && echo "OK ✅ export default ok." || { echo "ERRO: export default não encontrado"; exit 1; }

if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd "$ROOT/frontend" && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
