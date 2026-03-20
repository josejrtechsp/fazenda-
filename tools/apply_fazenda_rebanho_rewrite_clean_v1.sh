\
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_REBANHO_REWRITE_CLEAN_V1"

HFILE="$ROOT/frontend/src/pages/Herd.jsx"

if [ ! -d "$ROOT/frontend" ]; then
  echo "ERRO: não encontrei a pasta frontend/ na raiz atual: $ROOT" >&2
  exit 1
fi

if [ ! -f "$HFILE" ]; then
  echo "ERRO: não encontrei $HFILE" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/rebanho_rewrite_clean_v1_$TS"
mkdir -p "$BK"
cp -v "$HFILE" "$BK/Herd.jsx.bak"

cp -v "$PATCH_DIR/frontend/src/pages/Herd.jsx" "$HFILE"

echo "OK ✅ Rebanho refeito (clean)."
echo "Backup em: $BK"
