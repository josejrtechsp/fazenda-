#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import re

ROOT = Path.cwd()

def find_root(p: Path) -> Path:
    cur = p.resolve()
    for _ in range(10):
        if (cur/"frontend/src").exists() and (cur/"frontend/package.json").exists():
            return cur
        cur = cur.parent
    raise SystemExit("ERRO: rode dentro da pasta IDEAL_FAZENDA (onde existe frontend/).")

root = find_root(ROOT)

dash = root/"frontend/src/pages/ProducerDashboard.jsx"
areas = root/"frontend/src/pages/AreasPasture.jsx"
css  = root/"frontend/src/styles/fazenda_extras.css"

missing = [str(p) for p in (dash, areas, css) if not p.exists()]
if missing:
    raise SystemExit("ERRO: arquivos não encontrados:\n- " + "\n- ".join(missing))

def patch_file(path: Path, fn):
    s = path.read_text(encoding="utf-8", errors="ignore")
    s2 = fn(s)
    if s2 == s:
        print(f"AVISO: nenhuma alteração aplicada em {path.name} (padrão não encontrado).")
        return False
    path.write_text(s2, encoding="utf-8")
    print(f"OK: atualizado {path}")
    return True

# ---------------- AreasPasture.jsx (Resumo) ----------------
def patch_areas(s: str) -> str:
    pat = re.compile(
        r'(<div\s+className="faz-panel"[^>]*>\s*<h3>\s*Resumo\s*</h3>)(.*?)(</div>\s*</div>\s*\n\s*<div\s+className="faz-panel"[^>]*>\s*<h3>\s*Alertas\s*</h3>)',
        flags=re.S
    )
    m = pat.search(s)
    if not m:
        return s

    new_block = """<div className=\"faz-panel\">
  <div className=\"faz-panel-head\">
    <div>
      <h3>Resumo</h3>
      <div className=\"faz-muted\" style={{ marginTop: 4 }}>Leitura rápida das mangas (sem excesso).</div>
    </div>
  </div>

  <div className=\"faz-statgrid\" style={{ marginTop: 10 }}>
    <div className=\"faz-stat\">
      <div className=\"k\">Mangas</div>
      <div className=\"v\">{areas.length}</div>
    </div>
    <div className=\"faz-stat\">
      <div className=\"k\">Ocupadas</div>
      <div className=\"v\">{summary.occupied}</div>
    </div>
    <div className=\"faz-stat\">
      <div className=\"k\">Vazias</div>
      <div className=\"v\">{summary.empty}</div>
    </div>
    <div className=\"faz-stat\">
      <div className=\"k\">Descanso</div>
      <div className=\"v\">{summary.resting}</div>
    </div>
    <div className=\"faz-stat\">
      <div className=\"k\">Com alerta</div>
      <div className=\"v\">{summary.alerts}</div>
    </div>
    <div className=\"faz-stat\">
      <div className=\"k\">Cabeças</div>
      <div className=\"v\">{summary.heads}</div>
      <div className=\"s\">(mock)</div>
    </div>
  </div>

  <div className=\"faz-muted\" style={{ marginTop: 12, fontSize: 12 }}>
    Buscar manga / lote
  </div>
  <input
    className=\"faz-input\"
    value={q}
    onChange={(e) => setQ(e.target.value)}
    placeholder=\"Ex.: 30, Lote 15, Bezerros...\"
    style={{ marginTop: 6 }}
  />

  <div className=\"faz-callout soft\" style={{ marginTop: 12 }}>
    <div className=\"ic\">💡</div>
    <div className=\"tx\">Dica: clique em uma manga no <b>Mapa</b> para ver detalhes e transferir.</div>
  </div>
</div>

</div>
<div className=\"faz-panel\">
  <h3>Alertas</h3>"""

    # Replace from start of Resumo panel to start of Alertas panel heading
    return s[:m.start(1)] + new_block + s[m.end(3):]

# ---------------- ProducerDashboard.jsx (Resumo + Tendência) ----------------
def patch_dash(s: str) -> str:
    # Tendência
    pat_trend = re.compile(
        r'(<h3>\s*Evolução do custo \(R\$/@\)\s*—\s*últimos 6 meses\s*</h3>)(.*?)(</div>\s*</div>\s*\n\s*<div className="faz-panel")',
        flags=re.S
    )
    m = pat_trend.search(s)
    if m:
        new_trend = """<h3>Evolução do custo (R$/@) — últimos 6 meses</h3>
<div className=\"faz-muted\" style={{ marginTop: 4 }}>Tendência calculada pelo backend.</div>

{(data?.trend || []).every((t) => !t?.cost_per_arroba_brl) ? (
  <div className=\"faz-empty\" style={{ marginTop: 10 }}>
    <div className=\"ic\">📈</div>
    <div>
      <div className=\"t\">Sem tendência ainda</div>
      <div className=\"d\">Quando existir @ produzida e custos, a tendência aparece automaticamente.</div>
    </div>
  </div>
) : (
  <div className=\"faz-trendlist\" style={{ marginTop: 12 }}>
    {(data?.trend || []).map((t) => {
      const v = t?.cost_per_arroba_brl || 0;
      const maxv = Math.max(1, data?.trend_max || 1);
      const pct = Math.max(6, Math.min(100, (v / maxv) * 100));
      return (
        <div className=\"faz-trendrow\" key={t.month}>
          <div className=\"m\">{t.label}</div>
          <div className=\"bar\"><div className=\"fill\" style={{ width: pct + \"%\" }} /></div>
          <div className=\"v\">{v ? (\"R$ \" + v.toFixed(2).replace(\".\", \",\") + \"/@\") : \"—\"}</div>
        </div>
      );
    })}
  </div>
)}"""
        s = s[:m.start(1)] + new_trend + s[m.end(2):]

    # Resumo do mês
    pat_sum = re.compile(
        r'(<h3>\s*Resumo do mês\s*</h3>)(.*?)(</div>\s*</div>\s*\n\s*<Modal\s+open=\{openExit\})',
        flags=re.S
    )
    m2 = pat_sum.search(s)
    if m2:
        new_sum = """<h3>Resumo do mês</h3>
<div className=\"faz-muted\" style={{ marginTop: 4 }}>Objetivo: decisão rápida, sem excesso.</div>

<div className=\"faz-summary3\" style={{ marginTop: 12 }}>
  <div className=\"faz-miniKpi\">
    <div className=\"k\">@ produzidas</div>
    <div className=\"v\">{Number(data?.arrobas || 0).toLocaleString(\"pt-BR\")} @</div>
    <div className=\"s\">No mês selecionado</div>
  </div>

  <div className=\"faz-miniKpi\">
    <div className=\"k\">Custo do mês</div>
    <div className=\"v\">{formatBRL(data?.cost_total_brl || 0)}</div>
    <div className=\"s\">{data?.cost_per_arroba_brl == null ? \"Sem R$/@ (sem produção)\" : (\"Custo: \" + formatBRLPerArroba(data.cost_per_arroba_brl))}</div>
  </div>

  <div className=\"faz-miniKpi\">
    <div className=\"k\">Próxima ação</div>
    <div className=\"v\">{Number(data?.arrobas || 0) > 0 ? \"Registrar custos\" : \"Registrar saída ou pesagem\"}</div>
    <div className=\"s\">Para liberar R$/@ do mês</div>
  </div>
</div>

<div className=\"faz-summary-split\" style={{ marginTop: 12 }}>
  <div className=\"left\">
    <div className=\"faz-summary-lines\">
      {(summaryLines || []).slice(0, 6).map((l, i) => (
        <div key={i} className=\"faz-sline\">
          <span className=\"dot\" />
          <span className=\"t\">{l}</span>
        </div>
      ))}
      {!summaryLines?.length ? (<div className=\"faz-muted\">Sem resumo disponível.</div>) : null}
    </div>

    {alerts?.length ? (
      <div className=\"faz-alerts-compact\" style={{ marginTop: 12 }}>
        {alerts.slice(0, 4).map((t, i) => (
          <div key={i} className=\"faz-alert faz-alert-compact\">
            <div className=\"dot\" />
            <div className=\"txt\">{t}</div>
          </div>
        ))}
      </div>
    ) : null}
  </div>

  <div className=\"right\">
    <div className=\"faz-quick\">
      <div className=\"faz-quick-title\">Ações rápidas</div>
      <div className=\"faz-quick-grid\">
        <button className=\"faz-btn primary sm\" type=\"button\" onClick={() => setOpenExit(true)}>
          Registrar venda/saída
        </button>
        <button className=\"faz-btn sm\" type=\"button\" onClick={() => setOpenCost(true)}>
          Lançar custo
        </button>
        <button className=\"faz-btn sm\" type=\"button\" onClick={() => alert(\"Pesagens entram no próximo patch.\")}>
          Registrar pesagem
        </button>
        <button className=\"faz-btn sm\" type=\"button\" onClick={() => (window.location.hash = \"#/movimentacoes\")}>
          Transferências
        </button>
      </div>
      <div className=\"faz-muted\" style={{ marginTop: 10, fontSize: 12 }}>
        Dica: com saída/pesagem + custo, o R$/@ do mês fica automático.
      </div>
    </div>
  </div>
</div>"""
        s = s[:m2.start(1)] + new_sum + s[m2.end(2):]

    return s

# ---------------- CSS additions ----------------
def patch_css(s: str) -> str:
    if "FIX4: refazer resumos" in s:
        return s
    s += """

/* ============================================================
   FIX4: refazer resumos (Dashboard + Mangas) — padrão CRAS/IDEAL
   ============================================================ */

.cras-ui-v2 .faz-statgrid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cras-ui-v2 .faz-stat{
  border: 1px solid rgba(226,232,240,.92);
  background: rgba(248,250,252,.86);
  border-radius: 16px;
  padding: 10px 12px;
}

.cras-ui-v2 .faz-stat .k{
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .14em;
  font-weight: 950;
  color: rgba(100,116,139,1);
}

.cras-ui-v2 .faz-stat .v{
  margin-top: 6px;
  font-size: 18px;
  font-weight: 950;
  color: rgba(15,23,42,1);
}

.cras-ui-v2 .faz-stat .s{
  margin-top: 2px;
  font-size: 11px;
  color: rgba(100,116,139,1);
}

.cras-ui-v2 .faz-empty{
  display: flex;
  gap: 12px;
  border: 1px dashed rgba(226,232,240,.92);
  background: rgba(248,250,252,.66);
  border-radius: 18px;
  padding: 14px 14px;
}

.cras-ui-v2 .faz-empty .ic{
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(99,102,241,.10);
  border: 1px solid rgba(199,210,254,.92);
}

.cras-ui-v2 .faz-empty .t{
  font-weight: 950;
  color: rgba(15,23,42,1);
}

.cras-ui-v2 .faz-empty .d{
  margin-top: 2px;
  color: rgba(100,116,139,1);
  font-size: 13px;
}

.cras-ui-v2 .faz-trendlist{ display: flex; flex-direction: column; gap: 10px; }
.cras-ui-v2 .faz-trendrow{
  display: grid;
  grid-template-columns: 110px 1fr 92px;
  gap: 10px;
  align-items: center;
}
.cras-ui-v2 .faz-trendrow .m{ font-weight: 850; color: rgba(15,23,42,1); }
.cras-ui-v2 .faz-trendrow .bar{
  height: 10px;
  background: rgba(226,232,240,.92);
  border-radius: 999px;
  overflow: hidden;
}
.cras-ui-v2 .faz-trendrow .fill{
  height: 10px;
  background: linear-gradient(90deg, rgba(99,102,241,.75), rgba(168,85,247,.75));
  border-radius: 999px;
}
.cras-ui-v2 .faz-trendrow .v{
  text-align: right;
  font-weight: 850;
  color: rgba(15,23,42,1);
  font-size: 12px;
}

.cras-ui-v2 .faz-summary3{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
@media (max-width: 980px){
  .cras-ui-v2 .faz-summary3{ grid-template-columns: 1fr; }
}

.cras-ui-v2 .faz-miniKpi{
  border: 1px solid rgba(226,232,240,.92);
  background: rgba(248,250,252,.86);
  border-radius: 18px;
  padding: 12px 12px;
}
.cras-ui-v2 .faz-miniKpi .k{
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .14em;
  font-weight: 950;
  color: rgba(100,116,139,1);
}
.cras-ui-v2 .faz-miniKpi .v{
  margin-top: 6px;
  font-size: 18px;
  font-weight: 950;
  color: rgba(15,23,42,1);
}
.cras-ui-v2 .faz-miniKpi .s{
  margin-top: 4px;
  font-size: 12px;
  color: rgba(100,116,139,1);
}

.cras-ui-v2 .faz-summary-split{
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 980px){
  .cras-ui-v2 .faz-summary-split{ grid-template-columns: 1fr; }
}
"""
    return s

changed = False
changed |= patch_file(areas, patch_areas)
changed |= patch_file(dash, patch_dash)
changed |= patch_file(css, patch_css)

if not changed:
    print("ATENÇÃO: nenhum padrão encontrado. Se acontecer, me envie o conteúdo dos arquivos para ajustar os seletores.")
