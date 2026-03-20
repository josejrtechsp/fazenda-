#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT_DIR

python3 - <<'PY'
from pathlib import Path
import os
import re

root = Path(os.environ["ROOT_DIR"]).resolve()
src = root / "frontend" / "src"

# 1) Ensure global CSS import in FazendaApp.jsx
faz = src / "FazendaApp.jsx"
if faz.exists():
    s = faz.read_text(encoding="utf-8", errors="ignore")
    if "ideal_brand_lockup.css" not in s:
        lines = s.splitlines()
        # Insert after the last import at the top
        last_import = -1
        for i, ln in enumerate(lines[:60]):
            if ln.strip().startswith("import "):
                last_import = i
        ins = 'import "./styles/ideal_brand_lockup.css";'
        if last_import >= 0:
            lines.insert(last_import + 1, ins)
        else:
            lines.insert(0, ins)
        faz.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("OK: import CSS adicionado em FazendaApp.jsx")

# 2) Inject tagline next to the logo in the best header candidate
candidates = []
for p in src.rglob("*.jsx"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "idealTagline" in t:
        continue
    if "ideal-logo" not in t and "ideal_logo" not in t and "IDEAL" not in t:
        continue

    # score candidate
    score = 0
    name = p.name.lower()
    if "header" in name or "top" in name:
        score += 5
    if p.name == "FazendaApp.jsx":
        score += 4
    if "ideal-logo" in t or "ideal_logo" in t:
        score += 4
    if "IDEAL Fazenda" in t:
        score += 3
    if "logo" in t.lower():
        score += 1

    if score >= 4:
        candidates.append((score, p, t))

candidates.sort(key=lambda x: (-x[0], str(x[1])))

patched = False
for score, p, t in candidates:
    # find img tag that references ideal logo
    m = re.search(r'(<img[^>]*(?:ideal-logo|ideal_logo)[^>]*/>)', t, flags=re.I)
    if not m:
        m = re.search(r'(<img[^>]*(?:ideal-logo|ideal_logo)[^>]*>)', t, flags=re.I)
    if not m:
        continue

    insert = '\n        <span className="idealTagline">IDEAL - SOLUÇÕES PARA PECUÁRIA</span>'

    nt = t[:m.end()] + insert + t[m.end():]

    # avoid duplication of IDEAL in a title like "IDEAL Fazenda"
    if "IDEAL Fazenda" in nt and "SOLUÇÕES PARA PECUÁRIA" in nt:
        nt = nt.replace("IDEAL Fazenda", "Fazenda", 1)

    p.write_text(nt, encoding="utf-8")
    print(f"OK: tagline inserida em {p.relative_to(root)}")
    patched = True
    break

if not patched:
    print("AVISO: não encontrei um componente claro de cabeçalho para inserir a tagline automaticamente.")
PY

