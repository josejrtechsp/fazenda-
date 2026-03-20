#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_ux_v13_1_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

marker_v12 = "/* UX V12 VAQUEIRO */"
if marker_v12 not in t:
    raise SystemExit("ERRO: marker UX V12 VAQUEIRO não encontrado (V12 precisa estar aplicado).")

# 1) inserir states/helpers V13 após onOpRegistrarMover (idempotente)
if "/* UX V13 SCANNER */" not in t:
    insert = r'''
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
'''
    pat_end = re.compile(r'(const\s+onOpRegistrarMover\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};\s*)', re.M)
    m = pat_end.search(t)
    if m:
        t = t[:m.end(1)] + "\n" + insert + "\n" + t[m.end(1):]
    else:
        # fallback: antes do return
        t = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)

# 2) alterar onOpRegistrarPesagem para avançar fila (se ainda não tem)
if "opFilaIsOn" not in t or "setOpFilaIdx" not in t:
    # só mexe se existir o padrão simples de limpar brinco e focar
    pass
else:
    # se a função já contém avanço, não mexe
    if "opFilaIsOn && opFilaIdx" not in t:
        t = re.sub(
            r'setOpPeso\(""\);\s*\n\s*setOpQ\(""\);\s*\n\s*requestAnimationFrame\(\(\)\s*=>\s*opEarRef\?\.current\?\.focus\(\)\);',
            'setOpPeso("");\n    if (opFilaIsOn && opFilaIdx < opFilaTotal - 1) {\n      const next = opFilaIdx + 1;\n      setOpFilaIdx(next);\n      setOpQ(opFila[next] || "");\n      requestAnimationFrame(() => opPesoRef?.current?.focus());\n    } else {\n      setOpQ("");\n      requestAnimationFrame(() => opEarRef?.current?.focus());\n    }',
            t,
            count=1
        )

# 3) inserir UI do scanner antes do card "Log do dia (pendências)" (idempotente)
if "Modo scanner (fila de brincos)" not in t:
    scanner_ui = r'''
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
'''
    # encontra o card do Log do dia e insere antes dele
    idx = t.find("Log do dia (pendências)")
    if idx == -1:
        raise SystemExit("ERRO: não encontrei o card 'Log do dia (pendências)' para inserir o scanner.")
    # procura o início do <div className="card" ...> imediatamente antes do texto
    start = t.rfind('<div className="card"', 0, idx)
    if start == -1:
        raise SystemExit("ERRO: não encontrei o início do card do Log para inserir o scanner.")
    t = t[:start] + scanner_ui + "\n" + t[start:]

p.write_text(t, encoding="utf-8")
print("OK: UX V13.1 aplicado (scanner + fila).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_ux_v13_1_$TS"
