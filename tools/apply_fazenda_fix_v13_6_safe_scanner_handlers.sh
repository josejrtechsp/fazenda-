#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v13_6_$TS"

python3 - <<'PY'
from pathlib import Path
import re, textwrap

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

marker = "/* FIX V13.6 SAFE SCANNER HANDLERS */"
if marker not in t:
    snippet = textwrap.dedent("""      /* FIX V13.6 SAFE SCANNER HANDLERS */
      const opFilaIsOnSafe = (() => { try { return (typeof opFilaIsOn !== "undefined") ? !!opFilaIsOn : false; } catch { return false; } })();
      const opFilaPosSafe = (() => { try { return (typeof opFilaPos !== "undefined") ? opFilaPos : 0; } catch { return 0; } })();
      const opFilaTotalSafe = (() => { try { return (typeof opFilaTotal !== "undefined") ? opFilaTotal : 0; } catch { return 0; } })();
      const opFilaCurrentSafe = (() => { try { return (typeof opFilaCurrent !== "undefined") ? opFilaCurrent : ""; } catch { return ""; } })();
      const opFilaNextEarSafe = (() => { try { return (typeof opFilaNextEar !== "undefined") ? opFilaNextEar : ""; } catch { return ""; } })();

      const onOpFilaStartSafe = () => {
        try { if (typeof opFilaStart === "function") return opFilaStart(); } catch {}
        try { setOpMsg && setOpMsg("Scanner ainda não configurado. Clique em Demo e recarregue."); } catch {}
      };
      const onOpFilaNextSafe = () => { try { if (typeof opFilaNext === "function") return opFilaNext(); } catch {} };
      const onOpFilaClearSafe = () => { try { if (typeof opFilaClear === "function") return opFilaClear(); } catch {} };

    """)
    m = re.search(r'^\s*return\s*\(\s*$', t, flags=re.M)
    if not m:
        m = re.search(r'^\s*return\s*\(\s*', t, flags=re.M)
    if not m:
        raise SystemExit("ERRO: não encontrei 'return (' para inserir os handlers safe.")
    t = t[:m.start()] + snippet + "\n" + t[m.start():]

repls = [
    (r'onClick=\{\s*opFilaStart\s*\}', 'onClick={onOpFilaStartSafe}'),
    (r'onClick=\{\s*opFilaNext\s*\}', 'onClick={onOpFilaNextSafe}'),
    (r'onClick=\{\s*opFilaClear\s*\}', 'onClick={onOpFilaClearSafe}'),
    (r'disabled=\{\s*!\s*opFilaIsOn\s*\}', 'disabled={!opFilaIsOnSafe}'),
    (r'\{\s*opFilaPos\s*\}', '{opFilaPosSafe}'),
    (r'\{\s*opFilaTotal\s*\}', '{opFilaTotalSafe}'),
    (r'\{\s*opFilaCurrent\s*\}', '{opFilaCurrentSafe}'),
    (r'\{\s*opFilaNextEar\s*\}', '{opFilaNextEarSafe}'),
]
for pat, rep in repls:
    t = re.sub(pat, rep, t)

p.write_text(t, encoding="utf-8")
print("OK: V13.6 aplicado (safe handlers + replacements).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v13_6_$TS"
