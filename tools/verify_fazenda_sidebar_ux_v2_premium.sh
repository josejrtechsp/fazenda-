#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Verificando arquivos..."

F1="$ROOT/frontend/src/components/CrasSidebarNav.jsx"
F2="$ROOT/frontend/src/styles/cras_ui_v2.css"

[ -f "$F1" ] || { echo "ERRO: não achei $F1"; exit 1; }
[ -f "$F2" ] || { echo "ERRO: não achei $F2"; exit 1; }

echo "Checando assinaturas do patch..."

grep -q "cras-sidebar-v2-subline" "$F1" || { echo "ERRO: CrasSidebarNav.jsx sem subline"; exit 1; }
grep -q "cras-sidebar-v2-text" "$F1" || { echo "ERRO: CrasSidebarNav.jsx sem text wrapper"; exit 1; }

grep -q -- "--nav-active-indicator" "$F2" || { echo "ERRO: cras_ui_v2.css sem tokens"; exit 1; }
grep -q "max-height: calc(100vh - 28px)" "$F2" || { echo "ERRO: cras_ui_v2.css sem max-height da sidebar"; exit 1; }
grep -q "::-webkit-scrollbar" "$F2" || { echo "ERRO: cras_ui_v2.css sem scrollbar custom"; exit 1; }
grep -q "is-active::before" "$F2" || { echo "ERRO: cras_ui_v2.css sem indicador ativo"; exit 1; }

echo "OK ✅ Verify passou (UX V2 Premium)."
