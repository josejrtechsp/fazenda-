#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
HFILE="$ROOT/frontend/src/pages/Herd.jsx"
[ -f "$HFILE" ] || { echo "ERRO: Herd.jsx não encontrado em $HFILE"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/fix_exportlogcsv_v2_3_$TS"
mkdir -p "$BK"
cp -v "$HFILE" "$BK/Herd.jsx.bak"

python3 - <<'PY'
import re, pathlib, textwrap

hfile = pathlib.Path("frontend/src/pages/Herd.jsx")
s = hfile.read_text(encoding="utf-8", errors="ignore")

# 1) Replace onClick={exportLogCsv} with safe inline handler
safe_onclick = 'onClick={() => { try { if (typeof exportLogCsv === "function") exportLogCsv(); } catch (e) { console.warn("exportLogCsv", e); } }}'
s2 = re.sub(r'onClick=\{\s*exportLogCsv\s*\}', safe_onclick, s)

# 2) Insert exportLogCsv definition if missing
has_def = bool(re.search(r'\bfunction\s+exportLogCsv\b', s2) or re.search(r'\bconst\s+exportLogCsv\s*=', s2))
if not has_def:
    m_herd = re.search(r'(export\s+default\s+function\s+Herd\s*\(|function\s+Herd\s*\()', s2)
    if not m_herd:
        raise SystemExit("ERRO: não encontrei declaração do componente Herd().")
    start = m_herd.start()
    m_ret = re.search(r'\n\s*return\s*\(', s2[start:])
    if not m_ret:
        raise SystemExit("ERRO: não encontrei return() dentro do Herd().")
    insert_at = start + m_ret.start()

    block = textwrap.dedent('''      // --- FIX V2.3: export CSV do log (garante que não quebre)
      const exportLogCsv = () => {
        try {
          const rows = [["id","tipo","brinco","kg","data","destino","motivo"]];
          const list = Array.isArray(opsLog) ? opsLog.slice().reverse() : [];
          for (const it of list) {
            rows.push([
              it?.id || "",
              it?.type || "",
              it?.ear || "",
              (it?.kg ?? ""),
              it?.date || "",
              it?.to || "",
              it?.reason || ""
            ]);
          }
          const esc = (v) => {
            const str = String(v ?? "");
            const needs = str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r");
            if (!needs) return str;
            return '"' + str.replace(/"/g, '""') + '"';
          };
          const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const d = (typeof todayIso === "function") ? todayIso() : "data";
          a.download = "rebanho_log_" + d + ".csv";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn("exportLogCsv falhou", e);
        }
      };

    ''').rstrip() + "\n\n"

    s2 = s2[:insert_at] + block + s2[insert_at:]

hfile.write_text(s2, encoding="utf-8")
print("OK: aplicado fix exportLogCsv V2.3 (safe onclick + def).")
PY

echo "OK ✅ Patch aplicado. Backup em: $BK"
