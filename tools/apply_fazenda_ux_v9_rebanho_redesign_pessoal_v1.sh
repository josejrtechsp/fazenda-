#!/usr/bin/env bash
set -euo pipefail

HERD="frontend/src/pages/Herd.jsx"
CSS="frontend/src/styles/herd_rebanho_fix.css"

[ -f "$HERD" ] || { echo "ERRO: $HERD não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$CSS" ] || { echo "ERRO: $CSS não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$HERD" "$HERD.bak_$TS"
cp "$CSS" "$CSS.bak_$TS"

python3 - <<'PY'
import re
from pathlib import Path

herd_p = Path("frontend/src/pages/Herd.jsx")
css_p = Path("frontend/src/styles/herd_rebanho_fix.css")

t = herd_p.read_text(encoding="utf-8", errors="ignore")
css = css_p.read_text(encoding="utf-8", errors="ignore")

# 1) CSS: anexar bloco UX V9 se ainda não existir
if "UX V9 — Rebanho (Visão Geral + Animais lista)" not in css:
    addon = Path("patches/_ux_v9_addon.css").read_text(encoding="utf-8")
    css_p.write_text(css.rstrip()+"\n\n"+addon, encoding="utf-8")

# 2) Herd.jsx: garantir state animalsView
if "animalsView" not in t:
    t2 = re.sub(
        r'(const\s*\[\s*sortKey\s*,\s*setSortKey\s*\]\s*=\s*useState\([^\)]*\);[^\n]*\n)',
        r'\1  const [animalsView, setAnimalsView] = useState("cards"); // cards | table\n',
        t,
        count=1
    )
    t = t2

# 3) Substituir bloco "overview" por um painel de decisão
overview_pat = re.compile(r'\{tab\s*===\s*"overview"\s*\?\s*\(.*?\)\s*:\s*null\}', re.S)
if overview_pat.search(t):
    new_overview = r'''{tab === "overview" ? (
          <div className="card">
            <div className="card-header-row">
              <div>
                <div style={{ fontWeight: 900 }}>Visão geral</div>
                <div className="card-subtitle">O que importa hoje (clique para filtrar).</div>
              </div>
            </div>

            <div className="faz-kpiGrid">
              <button type="button" className="faz-kpiCard" onClick={() => { setTab("animals"); setFCategory("ALL"); setOnlyStale(false); setOnlyNegGmd(false); }}>
                <div className="k">Cabeças ativas</div>
                <div className="v">{totalActive != null ? fmtInt(totalActive) : "—"}</div>
                <div className="s">Total no sistema</div>
              </button>

              <button type="button" className="faz-kpiCard" onClick={() => { setTab("animals"); setOnlyStale(false); setOnlyNegGmd(false); }}>
                <div className="k">Pesagem em dia</div>
                <div className="v">{summary?.weighing_ok_pct != null ? `${summary.weighing_ok_pct}%` : "—"}</div>
                <div className="s">No período</div>
              </button>

              <button type="button" className="faz-kpiCard" onClick={() => { setTab("animals"); setOnlyStale(true); setOnlyNegGmd(false); }}>
                <div className="k">Sem pesagem</div>
                <div className="v">{summary?.no_weigh_count != null ? fmtInt(summary.no_weigh_count) : "—"}</div>
                <div className="s">Prioridade de manejo</div>
              </button>

              <button type="button" className="faz-kpiCard" onClick={() => { setTab("animals"); setOnlyStale(false); setOnlyNegGmd(true); }}>
                <div className="k">GMD negativo</div>
                <div className="v">{summary?.neg_gmd_count != null ? fmtInt(summary.neg_gmd_count) : "—"}</div>
                <div className="s">Precisam de atenção</div>
              </button>
            </div>

            <div className="faz-panels">
              <div className="card" style={{ boxShadow: "none", border: "1px solid rgba(226,232,240,.92)" }}>
                <div className="card-header-row">
                  <div>
                    <div style={{ fontWeight: 900 }}>Categorias</div>
                    <div className="card-subtitle">Clique para ver os animais filtrados.</div>
                  </div>
                </div>

                <div className="faz-catGrid">
                  {Object.keys(byCat).length ? (
                    Object.keys(byCat).slice(0, 12).map((k) => (
                      <button key={k} type="button" className="faz-catBtn" onClick={() => { setTab("animals"); setFCategory(k); }}>
                        <div className="top">
                          <div className="name">{k}</div>
                          <div className="num">{fmtInt(byCat[k])}</div>
                        </div>
                        <div className="sub">Ver lista dessa categoria</div>
                      </button>
                    ))
                  ) : (
                    <div className="faz-emptyNice">Sem categorias disponíveis (use Seed demo para preencher).</div>
                  )}
                </div>

                <div className="faz-actions-row" style={{ marginTop: 12 }}>
                  <button className="faz-btn primary" type="button" onClick={() => setTab("lots")}>Abrir lotes</button>
                  <button className="faz-btn" type="button" onClick={() => setTab("animals")}>Abrir animais</button>
                  <button className="faz-btn" type="button" onClick={seedDemo}>Seed (demo)</button>
                </div>
              </div>

              <div className="card" style={{ boxShadow: "none", border: "1px solid rgba(226,232,240,.92)" }}>
                <div className="card-header-row">
                  <div>
                    <div style={{ fontWeight: 900 }}>Ações do dia</div>
                    <div className="card-subtitle">Atalhos (sem bagunça).</div>
                  </div>
                </div>

                <div className="faz-toggles" style={{ marginTop: 10 }}>
                  <button type="button" className={"faz-toggle" + (onlyStale ? " is-on" : "")} onClick={() => { setOnlyStale(true); setOnlyNegGmd(false); setTab("animals"); }}>Sem pesagem &gt; {staleDays}d</button>
                  <button type="button" className={"faz-toggle" + (onlyNegGmd ? " is-on" : "")} onClick={() => { setOnlyStale(false); setOnlyNegGmd(true); setTab("animals"); }}>GMD negativo</button>
                  <button type="button" className="faz-toggle" onClick={() => openTransferTab(selectedLotId)}>Transferir lote</button>
                  <button type="button" className="faz-toggle" onClick={() => setTab("lots")}>Ver lotes</button>
                </div>

                <div className="texto-suave" style={{ marginTop: 10 }}>
                  Dica: para o vaqueiro, use <b>Lotes</b> (busca por brinco) e registre pesagem/movimentação sem entrar em tabela.
                </div>
              </div>
            </div>
          </div>
        ) : null}'''
    t = overview_pat.sub(new_overview, t, count=1)
else:
    raise SystemExit("ERRO: não encontrei o bloco da aba overview para substituir (Herd.jsx mudou).")

# 4) Animais: inserir toggle Lista/Tabela e renderização em cards
# 4.1) inserir toggles no topo dos filtros (após checkbox GMD negativo)
if "setAnimalsView" in t and "Lista" not in t:
    # insere após o segundo label (GMD negativo)
    t = re.sub(
        r'(GMD negativo\s*\n\s*</label>\s*\n)',
        r'\1\n              <div className="faz-toggles" style={{ marginLeft: "auto" }}>\n'
        r'                <button type="button" className={"faz-toggle" + (animalsView === "cards" ? " is-on" : "")} onClick={() => setAnimalsView("cards")}>Lista</button>\n'
        r'                <button type="button" className={"faz-toggle" + (animalsView === "table" ? " is-on" : "")} onClick={() => setAnimalsView("table")}>Tabela</button>\n'
        r'              </div>\n',
        t,
        count=1
    )

# 4.2) capturar tabela existente e envolver com condicional (mantém tabela idêntica)
table_pat = re.compile(r'(<div className="faz-tableWrap"[\s\S]*?</div>\s*\n\s*\n\s*<div className="texto-suave")', re.S)
m = table_pat.search(t)
if m:
    block = m.group(1)
    # separar: tableWrap ... </div> e o início do texto-suave
    # vamos capturar apenas tableWrap
    tw = re.search(r'(<div className="faz-tableWrap"[\s\S]*?</div>)', block, re.S)
    if not tw:
        raise SystemExit("ERRO: não consegui capturar faz-tableWrap.")
    table_wrap = tw.group(1)

    cards = r'''{animalsView === "cards" ? (
              <div className="faz-animals" style={{ marginTop: 10 }}>
                {filteredAnimalsAll.length === 0 ? (
                  <div className="faz-emptyNice">Nenhum animal encontrado com esses filtros.</div>
                ) : null}

                {filteredAnimalsAll.map((a) => {
                  const lot = lotById.get(Number(a.lot_id));
                  const ds = animalDays(a);
                  const stale = ds != null && ds > Number(staleDays);
                  const lastIso = animalLastDateIso(a);
                  const g = animalGmd(a);
                  const gv = fmtGmdValue(g);
                  const gTxt = gv.txt === "—" ? "—" : `${gv.txt} kg/d`;

                  return (
                    <div key={a.ear_tag} className={"faz-animal-row" + (stale ? " is-alert" : "")}>
                      <button type="button" className="link ear" onClick={() => openFicha(a.ear_tag)}>{a.ear_tag}</button>
                      <div className="meta">
                        <span className="ear">{a.category || "—"}</span> • {lot?.name || (a.lot_id != null ? `Lote ${a.lot_id}` : "—")}
                        {" • "}{fmtKg(a.last_weight_kg)}{lastIso ? ` • ${fmtDateShort(lastIso)}` : ""}{ds != null ? ` • ${ds} dias` : ""}
                        {gTxt !== "—" ? ` • GMD ${gTxt.replace(" kg/d","")}` : ""}
                      </div>

                      <button className="faz-btn" type="button" onClick={() => openFicha(a.ear_tag)}>Ficha</button>
                      <button className="faz-btn primary" type="button" onClick={() => openFichaWeigh(a.ear_tag)}>Pesagem</button>
                      <button className="faz-btn" type="button" onClick={() => onTransfer({ mode: "animal", earTags: [a.ear_tag], notes: `Movimentação individual — ${a.ear_tag}` })}>Mover</button>
                      <button className="faz-btn" type="button" onClick={() => openBaixa(a.ear_tag)}>Baixa</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              ''' + table_wrap + r'''
            )}

            <div className="texto-suave'''
    # substituir tableWrap + início do texto-suave por nosso bloco
    t = table_pat.sub(cards, t, count=1)
else:
    # se não achar, não aborta (arquivo pode ter mudado); apenas deixa sem cards
    pass

herd_p.write_text(t, encoding="utf-8")
print("OK: Herd.jsx atualizado (UX V9).")
PY

echo "OK ✅ Patch aplicado."
echo "Backups: $HERD.bak_$TS e $CSS.bak_$TS"
