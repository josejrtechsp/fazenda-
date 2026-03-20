#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET="$ROOT_DIR/frontend/src/FazendaApp.jsx"
CSS_MAIN="$ROOT_DIR/frontend/src/styles/fazenda_extras.css"

if [ ! -f "$TARGET" ]; then
  echo "ERRO: não encontrei $TARGET"
  exit 1
fi

# 1) Importar página se ainda não existir
python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/FazendaApp.jsx")
s = p.read_text(encoding="utf-8")
if "NutricaoComprasItens" not in s:
    # tenta inserir perto de outros imports de pages
    lines = s.splitlines()
    out = []
    inserted = False
    for ln in lines:
        out.append(ln)
        if (not inserted) and ln.startswith("import") and "pages" in ln and ln.endswith(";" ):
            # continua
            pass
    # insere após o último import
    idx = 0
    for i, ln in enumerate(out):
        if ln.startswith("import "):
            idx = i
    out.insert(idx+1, 'import NutricaoComprasItens from "./pages/NutricaoComprasItens.jsx";')
    s2 = "\n".join(out)
    p.write_text(s2, encoding="utf-8")
PY

# 2) Garantir CSS importado (nutricao_admin.css)
python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/FazendaApp.jsx")
s = p.read_text(encoding="utf-8")
if "nutricao_admin.css" not in s:
    # inserir import CSS perto do topo
    lines = s.splitlines()
    out=[]
    inserted=False
    for ln in lines:
        out.append(ln)
        if (not inserted) and (ln.startswith("import") and "fazenda_extras" in ln):
            out.append('import "./styles/nutricao_admin.css";')
            inserted=True
    if not inserted:
        # fallback: depois do primeiro import
        for i, ln in enumerate(out):
            if ln.startswith("import"):
                out.insert(i+1,'import "./styles/nutricao_admin.css";')
                break
    p.write_text("\n".join(out), encoding="utf-8")
PY

# 3) Adicionar rota/aba ao switch de página (sem sobrescrever tudo)
python3 - <<'PY'
from pathlib import Path
import re
p = Path("frontend/src/FazendaApp.jsx")
s = p.read_text(encoding="utf-8")
# Procurar switch (view) ou render condicional
if "case \"nutricao_admin\"" in s:
    raise SystemExit(0)

# tenta achar um switch(view)
m = re.search(r"switch\s*\(\s*view\s*\)\s*\{", s)
if m:
    # inserir antes do default
    s = re.sub(r"(default\s*:\s*)", 'case "nutricao_admin":\n        return <NutricaoComprasItens />;\n\n      \\1', s, count=1)
else:
    # fallback: procura renderização por if/ternário de view
    # injeta perto de onde já existe nutrição
    s = s.replace('view === "nutricao"', 'view === "nutricao_admin" ? <NutricaoComprasItens /> : (view === "nutricao"')

p.write_text(s, encoding="utf-8")
PY

echo "OK: Front V12 nutricao_admin aplicado (rota + imports + CSS)."
