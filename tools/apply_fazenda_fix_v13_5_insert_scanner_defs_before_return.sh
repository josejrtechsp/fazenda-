#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_5_$TS"

python3 - <<'PY'
from pathlib import Path
import re, textwrap

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# If already defined, do nothing
if re.search(r'\bconst\s+opFilaStart\b', t):
    print("OK: const opFilaStart já existe. Nada a fazer.")
    raise SystemExit(0)

# Find the first "return (" line
m = re.search(r'^\s*return\s*\(\s*$', t, flags=re.M)
if not m:
    # fallback: return( no mesmo line
    m = re.search(r'^\s*return\s*\(\s*', t, flags=re.M)
if not m:
    raise SystemExit("ERRO: não encontrei um 'return (' para inserir antes.")

insert = textwrap.dedent("""  /* UX V13 SCANNER (defs inseridas antes do return) */
  const [opFilaRaw, setOpFilaRaw] = useState("");
  const [opFila, setOpFila] = useState([]);
  const [opFilaIdx, setOpFilaIdx] = useState(0);

  const opNormEar = (s) => {
    try {
      // typeof em variável possivelmente inexistente é seguro
      if (typeof normalizeEarTag === "function") return normalizeEarTag(s);
    } catch {}
    return String(s || "").trim().toUpperCase();
  };

  const opParseFila = (raw) => {
    try {
      const txt = String(raw || "")
        .replace(/\r/g, "\n")
        .replace(/[;,]+/g, "\n")
        .replace(/\s+/g, "\n");
      const arr = txt
        .split("\n")
        .map((s) => opNormEar(s))
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
      try { opPesoRef?.current?.focus?.(); } catch {}
    } else {
      setOpMsg("Cole uma lista de brincos (um por linha).");
      try { opEarRef?.current?.focus?.(); } catch {}
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
    try { opPesoRef?.current?.focus?.(); } catch {}
  };

""").rstrip() + "\n\n"

# Insert before the matched return
t2 = t[:m.start()] + insert + t[m.start():]

p.write_text(t2, encoding="utf-8")
print("OK: defs do scanner inseridas antes do return.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_5_$TS"
