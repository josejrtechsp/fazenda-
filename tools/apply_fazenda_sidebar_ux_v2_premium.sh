#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_SIDEBAR_UX_V2_PREMIUM"

if [ ! -d "$PATCH_DIR" ]; then
  echo "ERRO: pasta do patch não encontrada: $PATCH_DIR"
  exit 1
fi

# checa estrutura
if [ ! -d "$ROOT/frontend/src" ]; then
  echo "ERRO: não encontrei frontend/src em $ROOT"
  echo "Dica: rode este script na raiz do projeto (onde existe a pasta frontend/)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/update_${STAMP}"
mkdir -p "$BK/frontend/src/components" "$BK/frontend/src/styles"

# backup (se existir)
[ -f "$ROOT/frontend/src/components/CrasSidebarNav.jsx" ] && cp -a "$ROOT/frontend/src/components/CrasSidebarNav.jsx" "$BK/frontend/src/components/" || true
[ -f "$ROOT/frontend/src/styles/cras_ui_v2.css" ] && cp -a "$ROOT/frontend/src/styles/cras_ui_v2.css" "$BK/frontend/src/styles/" || true

# aplica
cp -a "$PATCH_DIR/frontend/src/components/CrasSidebarNav.jsx" "$ROOT/frontend/src/components/CrasSidebarNav.jsx"
cp -a "$PATCH_DIR/frontend/src/styles/cras_ui_v2.css" "$ROOT/frontend/src/styles/cras_ui_v2.css"

echo "OK ✅ Patch aplicado: FAZENDA SIDEBAR UX V2 (Premium)"
echo "Backup em: $BK"
