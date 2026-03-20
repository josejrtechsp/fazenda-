#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_ux_v13_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# 1) inserir states da fila após marker UX V12
marker = "/* UX V12 VAQUEIRO */"
mi = t.find(marker)
if mi == -1:
    raise SystemExit("ERRO: marker UX V12 VAQUEIRO não encontrado.")

sub = t[mi:]

if "/* UX V13 SCANNER */" not in sub:
    insert = """\
  /* UX V13 SCANNER */
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
      // remove duplicados preservando ordem
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

  const opFilaIsOn = Array.isArray(opFila) && opFila.length > 0;
  const opFilaTotal = opFilaIsOn ? opFila.length : 0;
  const opFilaPos = opFilaIsOn ? (opFilaIdx + 1) : 0;
  const opFilaCurrent = opFilaIsOn ? (opFila[opFilaIdx] || "") : "";
  const opFilaNextEar = opFilaIsOn ? (opFila[opFilaIdx + 1] || "") : "";
\n"""

    # inserir logo após o bloco UX V12 helpers: depois de onOpRegistrarMover
    pat_end = re.compile(r'(const\s+onOpRegistrarMover\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};\s*\n)', re.M)
    m_end = pat_end.search(sub)
    if m_end:
        sub2 = sub[:m_end.end(1)] + "\n" + insert + sub[m_end.end(1):]
        t = t[:mi] + sub2
    else:
        # fallback: antes do return
        t = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)

# 2) dentro do onOpRegistrarPesagem: avançar fila se estiver ligada
# substitui o trecho que limpa brinco/peso e foca
t = re.sub(
    r'setOpPeso\(""\);\s*\n\s*setOpQ\(""\);\s*\n\s*requestAnimationFrame\(\(\)\s*=>\s*opEarRef\?\.current\?\.focus\(\)\);',
    'setOpPeso("");\n    if (opFilaIsOn && opFilaIdx < opFilaTotal - 1) {\n      const next = opFilaIdx + 1;\n      setOpFilaIdx(next);\n      setOpQ(opFila[next] || "");\n      requestAnimationFrame(() => opPesoRef?.current?.focus());\n    } else {\n      setOpQ("");\n      requestAnimationFrame(() => opEarRef?.current?.focus());\n    }',
    t,
    count=1
)

# 3) Inserir UI do Scanner no Operar: após o grid principal, antes do card do animal
scanner_ui = """\
            <div className="card" style={{ marginTop: 12, border: "1px solid rgba(226,232,240,.92)" }}>
              <div className="card-header-row">
                <div>
                  <div style={{ fontWeight: 900 }}>Modo scanner (fila de brincos)</div>
                  <div className="card-subtitle">Cole a lista e pese um por um (Enter para avançar).</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="faz-btn primary" type="button" onClick={opFilaStart}>Iniciar fila</button>
                  <button className="faz-btn" type="button" onClick={opFilaNext} disabled={!opFilaIsOn}>Próximo</button>
                  <button className="faz-btn" type="button" onClick={opFilaClear}>Limpar fila</button>
                </div>
              </div>

              <textarea
                className="input"
                rows={3}
                value={opFilaRaw}
                onChange={(e) => setOpFilaRaw(e.target.value)}
                placeholder={"Cole aqui os brincos (um por linha).\nEx:\nA2402\nA2403\nN901"}
              />

              {opFilaIsOn ? (
                <div className="texto-suave" style={{ marginTop: 10 }}>
                  <b>Fila:</b> {opFilaPos}/{opFilaTotal} • <b>Atual:</b> {opFilaCurrent || "—"} • <b>Próximo:</b> {opFilaNextEar || "—"}
                </div>
              ) : (
                <div className="texto-suave" style={{ marginTop: 10 }}>
                  Dica: você pode colar separado por vírgula, ponto-e-vírgula ou espaços.
                </div>
              )}
            </div>
\n"""

# Find the operate region and inject after the first detail-grid closing
# We'll insert after the line containing '</div>

            {opExact ?' (first occurrence in operate region)
t2 = t.replace(
    '

            {opExact ? (',
    '

' + scanner_ui + '
            {opExact ? (',
    1
)
t = t2

p.write_text(t, encoding="utf-8")
print("OK: UX V13 aplicado (scanner + fila).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_ux_v13_$TS"
