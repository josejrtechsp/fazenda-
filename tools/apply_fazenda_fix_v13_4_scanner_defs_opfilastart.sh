#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_4_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

def has(pattern: str) -> bool:
    return re.search(pattern, t) is not None

need_state = not has(r'const\s*\[\s*opFilaRaw\s*,\s*setOpFilaRaw\s*\]\s*=\s*useState\(')
need_derived = not has(r'\bconst\s+opFilaIsOn\b') or not has(r'\bconst\s+opFilaTotal\b') or not has(r'\bconst\s+opFilaPos\b')
need_parse = not has(r'\bconst\s+opParseFila\b') and not has(r'\bfunction\s+opParseFila\b')
need_start = not has(r'\bconst\s+opFilaStart\b') and not has(r'\bfunction\s+opFilaStart\b')
need_next = not has(r'\bconst\s+opFilaNext\b') and not has(r'\bfunction\s+opFilaNext\b')
need_clear = not has(r'\bconst\s+opFilaClear\b') and not has(r'\bfunction\s+opFilaClear\b')

blocks = []

if need_state:
    blocks.append(r'''
  /* UX V13 SCANNER (states) */
  const [opFilaRaw, setOpFilaRaw] = useState("");
  const [opFila, setOpFila] = useState([]);
  const [opFilaIdx, setOpFilaIdx] = useState(0);
'''.rstrip()+"
")

if need_derived:
    blocks.append(r'''
  /* UX V13 SCANNER (derivados) */
  const opFilaIsOn = Array.isArray(opFila) && opFila.length > 0;
  const opFilaTotal = opFilaIsOn ? opFila.length : 0;
  const opFilaPos = opFilaIsOn ? (opFilaIdx + 1) : 0;
  const opFilaCurrent = opFilaIsOn ? (opFila[opFilaIdx] || "") : "";
  const opFilaNextEar = opFilaIsOn ? (opFila[opFilaIdx + 1] || "") : "";
'''.rstrip()+"
")

if need_parse:
    blocks.append(r'''
  /* UX V13 SCANNER (parse) */
  const opParseFila = (raw) => {
    try {
      const txt = String(raw || "")
        .replace(/\r/g, "\n")
        .replace(/[;,]+/g, "\n")
        .replace(/\s+/g, "\n");
      const arr = txt
        .split("\n")
        .map((s) => normalizeEarTag(s))
        .filter(Boolean);
      const seen = new Set();
      const out = [];
      for (const x of arr) {
        if (seen.has(x)) continue;
        seen.add(x);
        out.push(x);
      }
      return out;
    } catch {
      return [];
    }
  };
'''.rstrip()+"
")

if need_start:
    blocks.append(r'''
  /* UX V13 SCANNER (ações) */
  const opFilaStart = () => {
    const arr = opParseFila(opFilaRaw);
    setOpFila(arr);
    setOpFilaIdx(0);
    if (arr.length) {
      setOpQ(arr[0]);
      requestAnimationFrame(() => opPesoRef?.current?.focus());
    } else {
      setOpMsg("Cole uma lista de brincos (um por linha).");
      requestAnimationFrame(() => opEarRef?.current?.focus());
    }
  };
'''.rstrip()+"
")

if need_next:
    blocks.append(r'''
  const opFilaNext = () => {
    const n = Array.isArray(opFila) ? opFila.length : 0;
    if (!n) return;
    const next = Math.min(opFilaIdx + 1, n - 1);
    setOpFilaIdx(next);
    setOpQ(opFila[next] || "");
    requestAnimationFrame(() => opPesoRef?.current?.focus());
  };
'''.rstrip()+"
")

if need_clear:
    blocks.append(r'''
  const opFilaClear = () => {
    setOpFilaRaw("");
    setOpFila([]);
    setOpFilaIdx(0);
  };
'''.rstrip()+"
")

if not blocks:
    print("OK: nada a inserir (scanner já completo).")
    raise SystemExit(0)

insert = "
".join(blocks).rstrip() + "

"

# Insert position
v12_marker = "/* UX V12 VAQUEIRO */"
pos = t.find(v12_marker)
if pos != -1:
    # insert right after marker line
    lines = t.splitlines(True)
    idx = None
    for i, ln in enumerate(lines):
        if v12_marker in ln:
            idx = i + 1
            break
    if idx is None:
        idx = 0
    lines.insert(idx, insert)
    t2 = "".join(lines)
else:
    # fallback before first return
    t2 = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)

p.write_text(t2, encoding="utf-8")
print("OK: V13.4 aplicado (scanner defs).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_4_$TS"
