#!/usr/bin/env bash
set -e

ROOT="$(pwd)"
if [ ! -f "$ROOT/frontend/src/pages/Herd.jsx" ]; then
  echo "ERRO: rode este script na raiz do projeto (pasta que contém frontend/src/pages/Herd.jsx)."
  echo "Dica: cd \"$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA\""
  exit 1
fi

TS=$(date +%Y%m%d_%H%M%S)
BKDIR="$ROOT/Arquivo/_tmp/apply_${TS}"
mkdir -p "$BKDIR" 2>/dev/null || true

# backups
cp -v "$ROOT/frontend/src/pages/Herd.jsx" "$BKDIR/Herd.jsx.bak" || true
cp -v "$ROOT/frontend/src/styles/herd_rebanho_fix.css" "$BKDIR/herd_rebanho_fix.css.bak" || true

# apply
cp -v "$ROOT/patches/FAZENDA_UX_V7_REBANHO_REDESIGN/frontend/src/pages/Herd.jsx" "$ROOT/frontend/src/pages/Herd.jsx"
cp -v "$ROOT/patches/FAZENDA_UX_V7_REBANHO_REDESIGN/frontend/src/styles/herd_rebanho_fix.css" "$ROOT/frontend/src/styles/herd_rebanho_fix.css"

echo "OK ✅ UX V7 aplicado. Backup em: $BKDIR"
