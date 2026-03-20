#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_SIDEBAR_UX_V1"

TARGET_MAIN="$ROOT/frontend/src/main.jsx"
SRC_MAIN="$PATCH_DIR/frontend/src/main.jsx"

if [ ! -f "$TARGET_MAIN" ]; then
  echo "ERRO: não encontrei $TARGET_MAIN"
  echo "Dica: rode este script na raiz do projeto (onde existe frontend/)."
  exit 1
fi
if [ ! -f "$SRC_MAIN" ]; then
  echo "ERRO: não encontrei arquivo do patch: $SRC_MAIN"
  exit 1
fi

TS="$(date +"%Y%m%d_%H%M%S")"
BACK_DIR="$ROOT/Arquivo/_tmp/update_${TS}"
mkdir -p "$BACK_DIR/frontend/src"

# backup
cp -f "$TARGET_MAIN" "$BACK_DIR/frontend/src/main.jsx.bak"

# apply
cp -f "$SRC_MAIN" "$TARGET_MAIN"

echo "OK ✅ Sidebar/UX patch aplicado (import do cras_ui_v2.css restaurado)."
echo "Backup: $BACK_DIR/frontend/src/main.jsx.bak"
