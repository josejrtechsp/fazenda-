#!/usr/bin/env bash
set -e

ROOT="$(pwd)"

echo "Verificando arquivos do Rebanho (UX V7)…"
[ -f "$ROOT/frontend/src/pages/Herd.jsx" ] || { echo "Faltando frontend/src/pages/Herd.jsx"; exit 1; }
[ -f "$ROOT/frontend/src/styles/herd_rebanho_fix.css" ] || { echo "Faltando frontend/src/styles/herd_rebanho_fix.css"; exit 1; }

grep -q "herdDash" "$ROOT/frontend/src/pages/Herd.jsx" || { echo "Herd.jsx não contém herdDash (patch não aplicado?)"; exit 1; }
grep -q "Rebanho UX V7" "$ROOT/frontend/src/styles/herd_rebanho_fix.css" || { echo "CSS não contém marcador UX V7"; exit 1; }

echo "OK ✅ Estrutura e marcadores encontrados."
