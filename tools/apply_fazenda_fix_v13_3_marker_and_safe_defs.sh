#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_3_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# Helper: insert marker near first scanner-related line
def insert_marker_near(pattern: str, marker: str) -> str:
    m = re.search(pattern, t, flags=re.M)
    if not m:
        return t
    # insert marker comment just before the matched line
    idx = m.start()
    return t[:idx] + marker + "\n" + t[idx:]

marker = "  /* UX V13 SCANNER (fila de brincos) */"
has_marker = "UX V13 SCANNER" in t

# If marker missing, but scanner vars exist, just add marker above first relevant definition.
if not has_marker:
    if re.search(r'\bconst\s+opFilaStart\b', t) or re.search(r'\bopFilaStart\s*=\s*\(', t) or re.search(r'\bconst\s*\[\s*opFilaRaw\s*,', t):
        # prefer to anchor above opFilaRaw state if exists, else above opFilaStart
        if re.search(r'\bconst\s*\[\s*opFilaRaw\s*,', t):
            t = insert_marker_near(r'^\s*const\s*\[\s*opFilaRaw\s*,', marker)
        else:
            t = insert_marker_near(r'^\s*(const\s+opFilaStart\b|const\s+opFilaIsOn\b|const\s*\[\s*opFila\b)', marker)
        has_marker = True

# If base scanner states do NOT exist, inject full block after V12 marker.
if not re.search(r'\bconst\s*\[\s*opFilaRaw\s*,\s*setOpFilaRaw\s*\]\s*=\s*useState\(', t):
    v12 = "/* UX V12 VAQUEIRO */"
    pos = t.find(v12)
    if pos == -1:
        raise SystemExit("ERRO: marker UX V12 VAQUEIRO não encontrado (V12 precisa estar aplicado).")

    full = r'''
  /* UX V13 SCANNER (fila de brincos) */
  const [opFilaRaw, setOpFilaRaw] = useState("");
  const [opFila, setOpFila] = useState([]);
  const [opFilaIdx, setOpFilaIdx] = useState(0);

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

  const opFilaIsOn = Array.isArray(opFila) && opFila.length > 0;
  const opFilaTotal = opFilaIsOn ? opFila.length : 0;
  const opFilaPos = opFilaIsOn ? (opFilaIdx + 1) : 0;
  const opFilaCurrent = opFilaIsOn ? (opFila[opFilaIdx] || "") : "";
  const opFilaNextEar = opFilaIsOn ? (opFila[opFilaIdx + 1] || "") : "";

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

  const opFilaClear = () => {
    setOpFilaRaw("");
    setOpFila([]);
    setOpFilaIdx(0);
  };

  const opFilaNext = () => {
    const n = Array.isArray(opFila) ? opFila.length : 0;
    if (!n) return;
    const next = Math.min(opFilaIdx + 1, n - 1);
    setOpFilaIdx(next);
    setOpQ(opFila[next] || "");
    requestAnimationFrame(() => opPesoRef?.current?.focus());
  };
'''
    # insert right after the V12 marker line
    lines = t.splitlines(True)
    idx = None
    for i, ln in enumerate(lines):
        if v12 in ln:
            idx = i + 1
            break
    if idx is None:
        raise SystemExit("ERRO: não consegui localizar o marker V12 em linhas.")
    lines.insert(idx, full + "\n")
    t = "".join(lines)
    has_marker = True

p.write_text(t, encoding="utf-8")
print("OK: V13.3 aplicado (marker + defs seguras).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_3_$TS"
