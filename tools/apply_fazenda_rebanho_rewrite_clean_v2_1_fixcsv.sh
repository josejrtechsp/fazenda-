#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/frontend/src/pages/Herd.jsx"
PATCH_SRC="$ROOT/patches/FAZENDA_REBANHO_REWRITE_CLEAN_V2_1_FIXCSV/frontend/src/pages/Herd.jsx"

if [ ! -f "$TARGET" ]; then
  echo "ERRO: Não achei $TARGET"
  exit 1
fi
if [ ! -f "$PATCH_SRC" ]; then
  echo "ERRO: Não achei $PATCH_SRC"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR="$ROOT/Arquivo/_tmp/rebanho_rewrite_clean_v2_1_fixcsv_$TS"
mkdir -p "$BK_DIR"
cp "$TARGET" "$BK_DIR/Herd.jsx.bak"

cp "$PATCH_SRC" "$TARGET"

echo "OK ✅ Fix CSV aplicado (V2.1)."
echo "Backup em: $BK_DIR/Herd.jsx.bak"
