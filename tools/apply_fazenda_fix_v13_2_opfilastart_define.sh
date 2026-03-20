#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_2_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# Se já existe opFilaStart, não faz nada
if re.search(r'\bconst\s+opFilaStart\b', t) or re.search(r'\bopFilaStart\s*=\s*\(', t):
    print("OK: opFilaStart já existe. Nada a fazer.")
    raise SystemExit(0)

marker_v12 = "/* UX V12 VAQUEIRO */"
pos = t.find(marker_v12)
if pos == -1:
    raise SystemExit("ERRO: marker UX V12 VAQUEIRO não encontrado (V12 precisa estar aplicado).")

insert = r'''
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

# Inserir logo após o marker V12 (primeira linha depois do marker)
lines = t.splitlines(True)
# achar linha do marker
idx = None
for i, ln in enumerate(lines):
    if marker_v12 in ln:
        idx = i + 1
        break
if idx is None:
    raise SystemExit("ERRO: não consegui localizar o marker V12 em linhas.")

lines.insert(idx, insert + "\n")
t2 = "".join(lines)

p.write_text(t2, encoding="utf-8")
print("OK: bloco UX V13 SCANNER inserido.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_2_$TS"
