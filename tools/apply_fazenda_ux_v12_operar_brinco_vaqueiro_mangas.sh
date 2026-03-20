#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_operate_region_v12.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_ux_v12_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_operate_region_v12.jsxfrag").read_text(encoding="utf-8").rstrip() + "\n\n"

t = p.read_text(encoding="utf-8", errors="ignore")

# 1) garante useRef no import de React (se houver import { ... } )
# tolera diferentes estilos de import
if "useRef" not in t:
    # só adiciona se já tiver useMemo/useState importados
    t = re.sub(r'import\s+React\s*,\s*\{([^}]*)\}\s+from\s+"react";',
               lambda m: 'import React, {' + (m.group(1).strip() + ', useRef' if 'useRef' not in m.group(1) else m.group(1)) + '} from "react";',
               t, count=1)

# 2) garantir refs/states/helpers UX V12 (idempotente)
if "/* UX V12 VAQUEIRO */" not in t:
    insert = """\
  /* UX V12 VAQUEIRO */
  const opEarRef = useRef(null);
  const opPesoRef = useRef(null);
  const [opPeso, setOpPeso] = useState("");
  const [opData, setOpData] = useState(() => {
    try { return new Date().toISOString().slice(0, 10); } catch { return ""; }
  });
  const [opMangaId, setOpMangaId] = useState("__KEEP__");
  const [opMsg, setOpMsg] = useState("");
  const [opLog, setOpLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rebanho_oplog_v1") || "[]") || []; } catch { return []; }
  });

  const opMangas = useMemo(() => {
    try {
      const list = Array.isArray(lotsAll) ? lotsAll : [];
      return list
        .map((l) => ({
          id: l.id,
          name: l.name || l.title || ("Manga " + String(l.id).padStart(2, "0")),
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
    } catch {
      return [];
    }
  }, [lotsAll]);

  const opLotLabel = (a) => {
    try {
      const lot = lotById.get(Number(a.lot_id));
      return lot?.name || (a.lot_id != null ? "Manga " + String(a.lot_id).padStart(2, "0") : "—");
    } catch { return "—"; }
  };

  const opLastInfo = (a) => {
    try {
      const lastIso = animalLastDateIso(a);
      const ds = animalDays(a);
      const d = lastIso ? fmtDateShort(lastIso) : "sem data";
      const dd = ds != null ? (ds + " dias") : "";
      return dd ? (d + " • " + dd) : d;
    } catch { return "—"; }
  };

  const onOpPushLog = (item) => {
    try {
      const next = [item, ...(Array.isArray(opLog) ? opLog : [])].slice(0, 50);
      setOpLog(next);
      localStorage.setItem("rebanho_oplog_v1", JSON.stringify(next));
    } catch {}
  };

  const onOpLimparLog = () => {
    setOpLog([]);
    try { localStorage.removeItem("rebanho_oplog_v1"); } catch {}
  };

  const onOpRegistrarPesagem = () => {
    setOpMsg("");
    if (!opExact) {
      setOpMsg("Informe um brinco válido.");
      return;
    }
    const kg = Number(String(opPeso).replace(",", "."));
    if (!kg || kg <= 0) {
      setOpMsg("Informe um peso válido (kg).");
      return;
    }
    const it = {
      id: String(Date.now()) + "_w",
      type: "weigh",
      ear: opExact.ear_tag,
      kg: kg,
      date: opData || "",
      to: null,
    };
    onOpPushLog(it);
    setOpMsg("✅ Pesagem registrada (pendente).");
    setOpPeso("");
    setOpQ("");
    requestAnimationFrame(() => opEarRef?.current?.focus());
  };

  const onOpRegistrarMover = () => {
    setOpMsg("");
    if (!opExact) {
      setOpMsg("Informe um brinco válido.");
      return;
    }
    if (opMangaId === "__KEEP__") {
      setOpMsg("Selecione uma manga destino (ou mantenha a atual).");
      return;
    }
    const toName = (opMangas.find((m) => String(m.id) === String(opMangaId)) || {}).name || ("Manga " + opMangaId);
    const it = {
      id: String(Date.now()) + "_m",
      type: "move",
      ear: opExact.ear_tag,
      kg: null,
      date: opData || "",
      to: toName,
    };
    onOpPushLog(it);
    setOpMsg("✅ Movimentação registrada (pendente).");
    setOpMangaId("__KEEP__");
    setOpQ("");
    requestAnimationFrame(() => opEarRef?.current?.focus());
  };

"""
    # inserir após o opExact (se existir) senão após opQNorm
    if "const opExact" in t:
        t = re.sub(r'(const\s+opExact\s*=\s*useMemo\([\s\S]*?\);\s*\n)',
                   r'\1\n' + insert,
                   t, count=1)
    else:
        # fallback: antes do return (
        t = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)

# 3) substitui a região operate (delimitada até o próximo {tab === ...})
m = re.search(r'\{\s*tab\s*===\s*["\']operate["\']', t)
if not m:
    raise SystemExit("ERRO: não encontrei início do bloco operate.")
start = m.start()

tab_pat = re.compile(r'\{\s*tab\s*===\s*["\'](\w+)["\']')
next_pos = None
for mm in tab_pat.finditer(t, m.end()):
    if mm.group(1) != "operate":
        next_pos = mm.start()
        break
if next_pos is None:
    raise SystemExit("ERRO: não encontrei o próximo bloco de tab para delimitar o operate.")

t2 = t[:start] + frag + t[next_pos:]

# 4) garantir que o bloco use && (evita ': null')
t2 = t2.replace('{tab === "operate" ? (', '{tab === "operate" && (')

p.write_text(t2, encoding="utf-8")
print("OK: UX V12 aplicado (operate region + helpers).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_ux_v12_$TS"
