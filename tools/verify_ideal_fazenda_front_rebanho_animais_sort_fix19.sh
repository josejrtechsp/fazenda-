#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== verify rebanho animais sort fix19 =="

test -f "$ROOT/frontend/src/pages/Herd.jsx" || { echo "ERRO: Herd.jsx não encontrado"; exit 1; }

grep -q "setSortFromHeader" "$ROOT/frontend/src/pages/Herd.jsx" || { echo "ERRO: setSortFromHeader não encontrado"; exit 1; }
grep -q "className=\"thBtn\"" "$ROOT/frontend/src/pages/Herd.jsx" || { echo "ERRO: thBtn não encontrado"; exit 1; }

test -f "$ROOT/frontend/src/styles/herd_rebanho_fix.css" || { echo "ERRO: herd_rebanho_fix.css não encontrado"; exit 1; }
grep -q "Cabeçalhos clicáveis" "$ROOT/frontend/src/styles/herd_rebanho_fix.css" || { echo "ERRO: css de cabeçalhos clicáveis não encontrado"; exit 1; }

echo "OK: verify concluído."
