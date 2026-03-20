#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_7_$TS"

python3 - <<'PY'
from pathlib import Path
import re, textwrap

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

marker = "/* UX V13 SCANNER V13 VARS */"

# 1) Insert V13 scanner defs before first return (idempotent)
if marker not in t:
    m = re.search(r'^\s*return\s*\(\s*$', t, flags=re.M)
    if not m:
        m = re.search(r'^\s*return\s*\(\s*', t, flags=re.M)
    if not m:
        raise SystemExit("ERRO: não encontrei 'return (' para inserir defs V13.")

    snippet = textwrap.dedent('''      /* UX V13 SCANNER V13 VARS */
      const [opFilaRawV13, setOpFilaRawV13] = useState("");
      const [opFilaV13, setOpFilaV13] = useState([]);
      const [opFilaIdxV13, setOpFilaIdxV13] = useState(0);

      const opNormEarV13 = (s) => {
        try { if (typeof normalizeEarTag === "function") return normalizeEarTag(s); } catch {}
        return String(s || "").trim().toUpperCase();
      };

      const opParseFilaV13 = (raw) => {
        try {
          const txt = String(raw || "")
            .replace(/\r/g, "\n")
            .replace(/[;,]+/g, "\n")
            .replace(/\s+/g, "\n");
          const arr = txt
            .split("\n")
            .map((s) => opNormEarV13(s))
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

      const opFilaIsOnV13 = Array.isArray(opFilaV13) && opFilaV13.length > 0;
      const opFilaTotalV13 = opFilaIsOnV13 ? opFilaV13.length : 0;
      const opFilaPosV13 = opFilaIsOnV13 ? (opFilaIdxV13 + 1) : 0;
      const opFilaCurrentV13 = opFilaIsOnV13 ? (opFilaV13[opFilaIdxV13] || "") : "";
      const opFilaNextEarV13 = opFilaIsOnV13 ? (opFilaV13[opFilaIdxV13 + 1] || "") : "";

      const opFilaStartV13 = () => {
        const arr = opParseFilaV13(opFilaRawV13);
        setOpFilaV13(arr);
        setOpFilaIdxV13(0);
        if (arr.length) {
          try { setOpQ(arr[0]); } catch {}
          try { opPesoRef?.current?.focus?.(); } catch {}
        } else {
          try { setOpMsg("Cole uma lista de brincos (um por linha)."); } catch {}
          try { opEarRef?.current?.focus?.(); } catch {}
        }
      };

      const opFilaClearV13 = () => {
        setOpFilaRawV13("");
        setOpFilaV13([]);
        setOpFilaIdxV13(0);
      };

      const opFilaNextV13 = () => {
        const n = Array.isArray(opFilaV13) ? opFilaV13.length : 0;
        if (!n) return;
        const next = Math.min(opFilaIdxV13 + 1, n - 1);
        setOpFilaIdxV13(next);
        try { setOpQ(opFilaV13[next] || ""); } catch {}
        try { opPesoRef?.current?.focus?.(); } catch {}
      };

    ''').rstrip() + "\n\n"

    t = t[:m.start()] + snippet + t[m.start():]

# 2) Replace old scanner identifiers in JSX to V13 ones
repls = [
    (r'\bopFilaRaw\b', 'opFilaRawV13'),
    (r'\bsetOpFilaRaw\b', 'setOpFilaRawV13'),
    (r'\bopFila\b', 'opFilaV13'),
    (r'\bsetOpFila\b', 'setOpFilaV13'),
    (r'\bopFilaIdx\b', 'opFilaIdxV13'),
    (r'\bsetOpFilaIdx\b', 'setOpFilaIdxV13'),
    (r'\bopFilaIsOn\b', 'opFilaIsOnV13'),
    (r'\bopFilaTotal\b', 'opFilaTotalV13'),
    (r'\bopFilaPos\b', 'opFilaPosV13'),
    (r'\bopFilaCurrent\b', 'opFilaCurrentV13'),
    (r'\bopFilaNextEar\b', 'opFilaNextEarV13'),
    (r'\bopFilaStart\b', 'opFilaStartV13'),
    (r'\bopFilaNext\b', 'opFilaNextV13'),
    (r'\bopFilaClear\b', 'opFilaClearV13'),
]
for pat, rep in repls:
    t = re.sub(pat, rep, t)

p.write_text(t, encoding="utf-8")
print("OK: V13.7 aplicado (scanner V13 vars + replacements).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_7_$TS"
