#!/usr/bin/env bash
set -euo pipefail

CSS="frontend/src/styles/herd_rebanho_fix.css"

if [ ! -f "$CSS" ]; then
  echo "ERRO: não encontrei $CSS"
  echo "Rode este script na raiz do projeto (onde existe a pasta frontend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$CSS" "$CSS.bak_$TS"

python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/styles/herd_rebanho_fix.css")
txt = p.read_text(encoding="utf-8", errors="ignore")
marker = "UX V8 — Rebanho (Visão geral / Lotes / Animais)"
if marker in txt:
    print("OK: CSS UX V8 já está aplicado. Nada a fazer.")
    raise SystemExit(0)

addon = Path("patches/_ux_v8_addon.css").read_text(encoding="utf-8")
p.write_text(txt.rstrip()+"\n\n"+addon, encoding="utf-8")
print("OK: CSS UX V8 anexado em", p)
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $CSS.bak_$TS"
