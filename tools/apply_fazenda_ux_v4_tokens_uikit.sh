#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
[ -d "$ROOT/frontend" ] || { echo "ERRO: rode na raiz do projeto (pasta que contém frontend/)."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
TMP="$ROOT/Arquivo/_tmp/update_${STAMP}"
mkdir -p "$TMP"

echo "Aplicando FAZENDA UX V4 (tokens + uikit)..."

# 1) Copia arquivo novo
SRC="$ROOT/patches/FAZENDA_UX_V4/frontend/src/styles/fazenda_tokens.css"
DST_DIR="$ROOT/frontend/src/styles"
mkdir -p "$DST_DIR"
cp -f "$SRC" "$DST_DIR/fazenda_tokens.css"

# 2) Garante import no main.jsx (idempotente)
MAIN="$ROOT/frontend/src/main.jsx"
[ -f "$MAIN" ] || { echo "ERRO: não encontrei $MAIN"; exit 1; }

MAIN="$MAIN" python3 - <<'PY'
import os
main_path = os.environ["MAIN"]
txt = open(main_path, "r", encoding="utf-8").read()

def ensure_import(line: str):
    global txt
    if line in txt:
        return
    lines = txt.splitlines(True)
    insert_at = None
    for i, l in enumerate(lines):
        if "cras_ui_v2.css" in l:
            insert_at = i + 1
    if insert_at is None:
        for i, l in enumerate(lines):
            if "./styles/App.css" in l:
                insert_at = i + 1
                break
    if insert_at is None:
        # fallback: after last import
        insert_at = 0
        for i, l in enumerate(lines):
            if l.strip().startswith("import "):
                insert_at = i + 1
    lines.insert(insert_at, line + "\n")
    txt = "".join(lines)

# garante cras_ui_v2.css também (se não existir), porque tokens assumem o shell
if "cras_ui_v2.css" not in txt:
    ensure_import("import './styles/cras_ui_v2.css'")

ensure_import("import './styles/fazenda_tokens.css'")

open(main_path, "w", encoding="utf-8").write(txt)
PY

# 3) Backup do main.jsx e tokens
cp -f "$MAIN" "$TMP/main.jsx"
cp -f "$DST_DIR/fazenda_tokens.css" "$TMP/fazenda_tokens.css"

echo "OK ✅ UX V4 aplicado."
echo "Próximo: bash tools/verify_fazenda_ux_v4_tokens_uikit.sh"
