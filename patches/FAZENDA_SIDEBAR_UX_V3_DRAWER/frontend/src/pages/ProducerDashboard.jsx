import React, { useEffect, useMemo, useState } from "react";
import "../styles/producer_dashboard_fix.css";

/**
 * ProducerDashboard (Início / Mês)
 * FIX12:
 * - Troca os chips (Mês/Jan/R$/@) por botões de navegação (1 tela por vez)
 * - Cada seção tem botão "Abrir" que leva para uma tela dedicada
 * - Telas dedicadas trazem mais painéis/gráficos e um resumo automático (sem "DEMO")
 */

function apiBase() {
  const env = (import.meta?.env?.VITE_API_BASE || import.meta?.env?.VITE_API_BASE_URL || "").toString().trim();
  if (env) return env.replace(/\/+$/, "");

  const host = typeof window !== "undefined" && window.location && window.location.hostname ? window.location.hostname : "127.0.0.1";
  const proto = typeof window !== "undefined" && window.location && window.location.protocol ? window.location.protocol : "http:";
  const base = `${proto}//${host}:8001`;
  return base.replace(/\/+$/, "");
}

async function fetchJson(path) {
  const url = `${apiBase()}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em ${url}${txt ? ` — ${txt.slice(0, 180)}` : ""}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function postJson(path, body) {
  const url = `${apiBase()}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body || {}),
  });
  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em ${url}${txt ? ` — ${txt.slice(0, 180)}` : ""}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function formatBRL(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBRLPerArroba(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${formatBRL(n)}/@`;
}

function formatNumber(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR");
}

function monthLabel(yyyy_mm) {
  if (!yyyy_mm || !/^\d{4}-\d{2}$/.test(yyyy_mm)) return yyyy_mm || "";
  const [y, m] = yyyy_mm.split("-").map((x) => parseInt(x, 10));
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[(m || 1) - 1]}/${y}`;
}

function normalizeLabel(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getTopCostValue(rawTopCosts, key, label) {
  const arr = Array.isArray(rawTopCosts)
    ? rawTopCosts
    : Array.isArray(rawTopCosts?.items)
      ? rawTopCosts.items
      : [];

  const want = (normalizeLabel(key) || "").trim();
  const wantLabel = (normalizeLabel(label) || "").trim();

  for (const it of arr) {
    if (Array.isArray(it) && it.length >= 2) {
      const g0 = normalizeLabel(String(it[0] ?? ""));
      const v0 = Number(it[1] ?? 0);
      if ((want && g0 === want) || (wantLabel && g0 === wantLabel)) return v0 || 0;
      continue;
    }

    const g = normalizeLabel(
      it?.group ??
        it?.group_name ??
        it?.groupLabel ??
        it?.category ??
        it?.category_name ??
        it?.categoryLabel ??
        it?.label ??
        it?.name ??
        it?.key ??
        ""
    );

    const v = it?.value_brl ?? it?.total_brl ?? it?.amount_brl ?? it?.value ?? it?.total ?? it?.amount ?? 0;

    if (!g) continue;
    if ((want && g === want) || (wantLabel && g === wantLabel)) return Number(v || 0) || 0;
  }

  return 0;
}

const VIEWS = {
  HOME: "home",
  NUTRITION: "nutrition",
  HERD: "herd",
  SUMMARY: "summary",
  COST_EVOLUTION: "cost_evolution",
  COST_DRIVERS: "cost_drivers",
};

function NavTabs({ active, onChange }) {
  const items = [
    { key: VIEWS.HOME, label: "Início" },
    { key: VIEWS.NUTRITION, label: "Nutrição — mês" },
    { key: VIEWS.HERD, label: "Gado — rápido" },
    { key: VIEWS.SUMMARY, label: "Resumo e contexto" },
    { key: VIEWS.COST_EVOLUTION, label: "Evolução do custo" },
    { key: VIEWS.COST_DRIVERS, label: "Puxou seu custo" },
  ];

  return (
    <div className="pd-tabs" role="tablist" aria-label="Atalhos do dashboard">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`pd-tab ${active === it.key ? "isActive" : ""}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function BackLine({ onBack, title, subtitle, mk, onRefresh, loading }) {
  return (
    <div className="pd-subhead">
      <div className="pd-subhead-left">
        <button className="faz-btn sm" type="button" onClick={onBack}>
          ← Voltar
        </button>
        <div>
          <div className="pd-subtitle">{title}</div>
          <div className="faz-muted">{subtitle}</div>
        </div>
      </div>
      <div className="pd-subhead-right">
        <span className="pd-pill">{monthLabel(mk)}</span>
        <button className="faz-btn ghost sm" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
    </div>
  );
}

function calcMoM(series) {
  const rows = (series || []).map((r) => ({
    month: r?.month || "",
    value: Number(r?.cost_per_arroba_brl),
  }));
  const clean = rows.filter((x) => x.month && Number.isFinite(x.value));
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const cur = clean[i];
    const prev = clean[i - 1];
    const delta = prev ? cur.value - prev.value : null;
    const pct = prev && prev.value !== 0 ? (delta / prev.value) * 100 : null;
    out.push({ ...cur, delta, pct });
  }
  return out;
}

function AutoSummary({ title, bullets }) {
  return (
    <div className="faz-callout info" style={{ marginTop: 8 }}>
      <div className="ic">i</div>
      <div className="tx">
        <div style={{ fontWeight: 950, marginBottom: 6 }}>{title}</div>
        <ul className="pd-ul">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CostEvolutionView({ mk, data, onBack, refresh, loading }) {
  const trendAll = Array.isArray(data?.trend) ? data.trend : [];
  const last12 = trendAll.slice(-12);
  const mom = useMemo(() => calcMoM(last12), [last12]);
  const vals = mom.map((x) => x.value).filter((n) => Number.isFinite(n));
  const maxv = vals.length ? Math.max(...vals) : 0;

  const bullets = useMemo(() => {
    if (mom.length < 2) {
      return [
        "Ainda falta histórico suficiente para comparar meses.",
        "Assim que houver custo + @ em mais meses, a evolução fica automática.",
      ];
    }
    const first = mom[0]?.value;
    const last = mom[mom.length - 1]?.value;
    const diff = Number.isFinite(first) && Number.isFinite(last) ? last - first : null;
    const pct = Number.isFinite(first) && first !== 0 && diff != null ? (diff / first) * 100 : null;

    const lastDelta = mom[mom.length - 1]?.delta;
    const lastPct = mom[mom.length - 1]?.pct;

    const t1 = diff == null ? "" : `No período, variou ${formatBRLPerArroba(diff)} (${pct == null ? "" : `${pct.toFixed(1)}%`}).`;
    const t2 = lastDelta == null ? "" : `No último mês, mudou ${formatBRLPerArroba(lastDelta)} (${lastPct == null ? "" : `${lastPct.toFixed(1)}%`}).`;

    return [
      t1 || "Tendência calculada com base no histórico disponível.",
      t2 || "Sem comparação mês a mês no último período.",
      "Use esta tela para enxergar rapidamente se o custo está subindo ou caindo.",
    ].filter(Boolean);
  }, [mom]);

  return (
    <div>
      <BackLine
        onBack={onBack}
        title="Evolução do custo (R$/@)"
        subtitle="Mais detalhes do histórico do custo por arroba."
        mk={mk}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="faz-panels2" style={{ marginTop: 8 }}>
        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Histórico (últimos 12 meses)</h3>
              <div className="faz-muted">Barra proporcional ao maior valor do período.</div>
            </div>
          </div>

          {mom.length === 0 ? (
            <div className="faz-empty">
              <div className="ic">📌</div>
              <div>
                <div className="t">Sem histórico suficiente</div>
                <div className="d">Quando houver custos e @ em meses anteriores, a evolução aparece aqui.</div>
              </div>
            </div>
          ) : (
            <div className="faz-trendList">
              {mom.map((r, i) => {
                const pct = maxv > 0 ? `${Math.max(2, Math.min(100, (r.value / maxv) * 100))}%` : "0%";
                return (
                  <div className="faz-trendRow" key={`${r.month}-${i}`}>
                    <div className="m">{monthLabel(r.month)}</div>
                    <div className="p">
                      <div className="bar">
                        <span className="fill" style={{ width: pct }} />
                      </div>
                    </div>
                    <div className="v">{formatBRLPerArroba(r.value)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Variação mês a mês</h3>
              <div className="faz-muted">Diferença e % em relação ao mês anterior.</div>
            </div>
          </div>

          {mom.length < 2 ? (
            <div className="faz-empty">
              <div className="ic">📌</div>
              <div>
                <div className="t">Precisa de pelo menos 2 meses</div>
                <div className="d">Registre custos e @ em mais meses para ver a variação.</div>
              </div>
            </div>
          ) : (
            <div className="pd-tableWrap">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>R$/@</th>
                    <th>Δ</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {mom.map((r) => {
                    const up = r.delta != null && r.delta > 0;
                    const down = r.delta != null && r.delta < 0;
                    const cls = up ? "isUp" : down ? "isDown" : "";
                    return (
                      <tr key={r.month}>
                        <td>{monthLabel(r.month)}</td>
                        <td>{formatBRLPerArroba(r.value)}</td>
                        <td className={cls}>
                          {r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${formatBRLPerArroba(r.delta)}`}
                        </td>
                        <td className={cls}>{r.pct == null ? "—" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <AutoSummary title="Resumo automático" bullets={bullets} />
        </div>
      </div>
    </div>
  );
}

function CostDriversView({ mk, data, topCosts, onBack, refresh, loading }) {
  const arrobas = Number(data?.arrobas ?? 0);
  const hasArrobas = Number.isFinite(arrobas) && arrobas > 0;
  const total = Number(data?.cost_total_brl ?? 0);
  const hasTotal = Number.isFinite(total) && total > 0;

  const items = topCosts?.items || [];

  const bullets = useMemo(() => {
    if (!hasTotal) return ["Sem custos lançados no período.", "Lance custos no dia a dia para o ranking aparecer."];
    const sorted = [...items].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = sorted[0];
    const topShare = top && total > 0 ? ((Number(top.value) || 0) / total) * 100 : null;
    const t1 = top ? `${top.label} é o maior peso do mês (${topShare == null ? "" : `${topShare.toFixed(1)}%`}).` : "";
    const t2 = hasArrobas && top ? `Impacto em R$/@: ${(Number(top.value) / arrobas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/@ (aprox.).` : "";
    return [
      t1 || "Ranking por categoria com base no total do mês.",
      t2 || "Registre @ produzida para ver impacto por arroba.",
      "Foque primeiro nas 2 categorias que mais pesam — normalmente elas explicam quase todo o custo.",
    ].filter(Boolean);
  }, [items, total, hasTotal, hasArrobas, arrobas]);

  return (
    <div>
      <BackLine
        onBack={onBack}
        title="O que mais puxou seu custo"
        subtitle="Ranking por categoria + participação no total."
        mk={mk}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="faz-panels2" style={{ marginTop: 8 }}>
        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Ranking do mês</h3>
              <div className="faz-muted">Participação no total do período.</div>
            </div>
          </div>

          {!hasTotal ? (
            <div className="faz-empty">
              <div className="ic">📌</div>
              <div>
                <div className="t">Sem custos registrados</div>
                <div className="d">Lance custos (ou registre via eventos) para aparecer aqui.</div>
              </div>
            </div>
          ) : (
            <div className="faz-bars">
              {items.map((it) => {
                const share = total > 0 ? ((Number(it.value) || 0) / total) * 100 : 0;
                const w = `${Math.max(2, Math.min(100, share))}%`;
                return (
                  <div className="faz-bar" key={it.key}>
                    <div className="name">{it.label}</div>
                    <div className="track">
                      <div className="fill" style={{ width: w }} />
                    </div>
                    <div className="val">{formatBRL(it.value)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Detalhamento</h3>
              <div className="faz-muted">Valor, participação e impacto estimado em R$/@.</div>
            </div>
          </div>

          {!hasTotal ? null : (
            <div className="pd-tableWrap">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>R$</th>
                    <th>%</th>
                    <th>R$/@</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice()
                    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                    .map((it) => {
                      const v = Number(it.value) || 0;
                      const share = total > 0 ? (v / total) * 100 : 0;
                      const perA = hasArrobas ? v / arrobas : null;
                      return (
                        <tr key={it.key}>
                          <td>{it.label}</td>
                          <td>{formatBRL(v)}</td>
                          <td>{share.toFixed(1)}%</td>
                          <td>{perA == null ? "—" : formatBRLPerArroba(perA)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <AutoSummary title="Resumo automático" bullets={bullets} />
        </div>
      </div>
    </div>
  );
}

function NutritionView({ mk, data, topCosts, onBack, refresh, loading }) {
  const arrobas = Number(data?.arrobas ?? 0);
  const hasArrobas = Number.isFinite(arrobas) && arrobas > 0;
  const total = Number(data?.cost_total_brl ?? 0);
  const nut = Number(topCosts?.items?.find((x) => x.key === "NUTRICAO")?.value ?? 0);
  const hasNut = Number.isFinite(nut) && nut > 0;
  const share = total > 0 ? (nut / total) * 100 : null;
  const perA = hasArrobas ? nut / arrobas : null;

  const bullets = useMemo(() => {
    if (!hasNut) {
      return [
        "Sem custos de nutrição lançados no período.",
        "Registre compras/consumos para a visão do mês ficar completa.",
      ];
    }
    const t1 = share == null ? "" : `Nutrição representa ${share.toFixed(1)}% do custo do mês.`;
    const t2 = perA == null ? "" : `Impacto estimado: ${formatBRLPerArroba(perA)}.`;
    const t3 = share != null && share > 45 ? "Atenção: nutrição está muito alta — revise consumo, perdas e preço de compra." : "";
    return [t1 || "Resumo automático baseado nos custos do mês.", t2 || "Registre @ produzida para ver impacto por arroba.", t3].filter(Boolean);
  }, [hasNut, share, perA]);

  return (
    <div>
      <BackLine
        onBack={onBack}
        title="Nutrição — visão do mês"
        subtitle="Custo de nutrição e impacto no seu R$/@."
        mk={mk}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="faz-grid-kpis" style={{ marginTop: 8 }}>
        <div className="faz-kpi">
          <div className="k">Nutrição (R$)</div>
          <div className="v">{hasNut ? formatBRL(nut) : "—"}</div>
          <div className="s">Total do mês</div>
        </div>
        <div className="faz-kpi">
          <div className="k">Participação</div>
          <div className="v">{share == null ? "—" : `${share.toFixed(1)}%`}</div>
          <div className="s">Sobre o custo total</div>
        </div>
        <div className="faz-kpi">
          <div className="k">Nutrição (R$/@)</div>
          <div className="v">{perA == null ? "—" : formatBRLPerArroba(perA)}</div>
          <div className="s">Impacto estimado</div>
        </div>
      </div>

      <div className="faz-panels2" style={{ marginTop: 8 }}>
        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Distribuição (visão simples)</h3>
              <div className="faz-muted">No V1, o detalhamento por item entra quando houver lançamentos por compra/consumo.</div>
            </div>
          </div>

          {!hasNut ? (
            <div className="faz-empty">
              <div className="ic">📌</div>
              <div>
                <div className="t">Sem dados de nutrição</div>
                <div className="d">Registre compras/consumos para separar ração, silagem, mineral etc.</div>
              </div>
            </div>
          ) : (
            <div className="pd-split">
              <div className="pd-splitBar">
                <div className="pd-splitFill" style={{ width: `${Math.max(2, Math.min(100, share ?? 0))}%` }} />
              </div>
              <div className="pd-splitText">
                {share == null ? "" : `${share.toFixed(1)}% do seu custo total está vindo da nutrição.`}
              </div>
            </div>
          )}

          <AutoSummary title="Resumo automático" bullets={bullets} />
        </div>

        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Recomendações práticas</h3>
              <div className="faz-muted">Checklist rápido para reduzir custo sem perder desempenho.</div>
            </div>
          </div>

          <div className="pd-check">
            <div className="pd-checkItem">• Conferir perdas no cocho (umidade, sobra, pisoteio).</div>
            <div className="pd-checkItem">• Comparar preço da última compra vs praça e buscar alternativa.</div>
            <div className="pd-checkItem">• Revisar volumoso (qualidade) antes de aumentar concentrado.</div>
            <div className="pd-checkItem">• Ajustar lote/lotação para não “comprar desempenho” no saco.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HerdQuickView({ mk, onBack, refresh, loading }) {
  const [lots, setLots] = useState([]);
  const [lotsErr, setLotsErr] = useState("");
  const [lotsLoading, setLotsLoading] = useState(false);

  const loadLots = async () => {
    setLotsLoading(true);
    setLotsErr("");
    try {
      const j = await fetchJson("/herd/lots");
      const arr = Array.isArray(j?.lots) ? j.lots : [];
      setLots(arr);
    } catch (e) {
      setLotsErr(String(e?.message || e));
      // fallback: mostra lotes basicos quando o back nao responde
      setLots([{ id: "10", label: "Lote 10" }, { id: "15", label: "Lote 15" }]);
    } finally {
      setLotsLoading(false);
    }
  };

  useEffect(() => {
    loadLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bullets = useMemo(() => {
    return [
      "Esta visão é um resumo rápido. O módulo Rebanho (detalhado) entra na sequência.",
      "Quando o rebanho estiver cadastrado, aqui aparece peso médio, GMD e alertas de pesagem.",
    ];
  }, []);

  return (
    <div>
      <BackLine
        onBack={onBack}
        title="Gado — visão rápida"
        subtitle="Atalhos e visão resumida por lotes."
        mk={mk}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="faz-panels2" style={{ marginTop: 8 }}>
        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Lotes</h3>
              <div className="faz-muted">Lista rápida (vindas do back). Use para navegar entre lotes.</div>
            </div>
            <div className="faz-metric">
              <div className="k">Qtd</div>
              <div className="v">{lots.length || "—"}</div>
            </div>
          </div>

          {lotsErr ? (
            <div className="faz-alertBox">
              <div className="t">Falha ao carregar lotes</div>
              <div className="d">{lotsErr}</div>
            </div>
          ) : null}

          {lotsLoading ? (
            <div className="faz-muted" style={{ marginTop: 8 }}>
              Carregando...
            </div>
          ) : lots.length === 0 ? (
            <div className="faz-empty">
              <div className="ic">📌</div>
              <div>
                <div className="t">Sem lotes cadastrados</div>
                <div className="d">Cadastre lotes/animais para enxergar composição e alertas.</div>
              </div>
            </div>
          ) : (
            <div className="pd-lots">
              {lots.slice(0, 10).map((l) => (
                <div className="pd-lot" key={String(l.id)}>
                  <div className="pd-lotTitle">{l.label || `Lote ${l.id}`}</div>
                  <div className="pd-lotSub">ID: {String(l.id)}</div>
                </div>
              ))}
              {lots.length > 10 ? <div className="faz-muted">+ {lots.length - 10} lotes</div> : null}
            </div>
          )}

          <button className="faz-btn ghost sm" type="button" onClick={loadLots} disabled={lotsLoading} style={{ marginTop: 8 }}>
            {lotsLoading ? "Atualizando..." : "Atualizar lotes"}
          </button>

          <AutoSummary title="Resumo automático" bullets={bullets} />
        </div>

        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Próximos indicadores</h3>
              <div className="faz-muted">O que vai aparecer aqui quando o Rebanho estiver completo.</div>
            </div>
          </div>

          <div className="pd-check">
            <div className="pd-checkItem">• Peso médio por lote</div>
            <div className="pd-checkItem">• Animais sem pesagem há X dias</div>
            <div className="pd-checkItem">• GMD por animal e por lote</div>
            <div className="pd-checkItem">• Alertas de queda brusca</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryContextView({ mk, data, topCosts, onBack, refresh, loading }) {
  const arrobas = Number(data?.arrobas ?? 0);
  const hasArrobas = Number.isFinite(arrobas) && arrobas > 0;
  const total = Number(data?.cost_total_brl ?? 0);
  const hasTotal = Number.isFinite(total) && total > 0;

  const summaryLines = useMemo(() => {
    if (Array.isArray(data?.summary_lines) && data.summary_lines.length) return data.summary_lines;
    const lines = [];
    if (!hasArrobas) lines.push("Você não registrou @ produzida neste mês.");
    if (hasTotal) lines.push(`Custo total no mês: ${formatBRL(total)}.`);
    if (!hasTotal) lines.push("Sem custos registrados neste mês.");
    return lines;
  }, [data, hasArrobas, hasTotal, total]);

  const checklist = useMemo(() => {
    const items = [];
    items.push({ ok: hasArrobas, text: "Registrar @ produzida (venda/abate)" });
    items.push({ ok: hasTotal, text: "Lançar custos do mês" });
    items.push({ ok: data?.price_per_arroba_brl != null, text: "Registrar preço médio de venda (R$/@)" });
    items.push({ ok: true, text: "Conferir categorias que mais puxaram o custo" });
    return items;
  }, [hasArrobas, hasTotal, data]);

  const bullets = useMemo(() => {
    const nut = Number(topCosts?.items?.find((x) => x.key === "NUTRICAO")?.value ?? 0);
    const nutShare = hasTotal && total > 0 ? (nut / total) * 100 : null;

    const t1 = hasTotal ? `Custo total no mês: ${formatBRL(total)}.` : "Sem custo registrado.";
    const t2 = hasArrobas ? `R$/@ calculado automaticamente: ${formatBRLPerArroba(data?.cost_per_arroba_brl)}.` : "Registre @ produzida para calcular R$/@.";
    const t3 = nutShare != null ? `Nutrição está em ${nutShare.toFixed(1)}% do custo.` : "";

    return [t1, t2, t3, "Use a checklist abaixo para fechar o mês sem buraco de informação."].filter(Boolean);
  }, [hasTotal, total, hasArrobas, data, topCosts]);

  return (
    <div>
      <BackLine
        onBack={onBack}
        title="Resumo e contexto"
        subtitle="Checklist do mês + leitura automática."
        mk={mk}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="faz-panels2" style={{ marginTop: 8 }}>
        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Leitura do mês</h3>
              <div className="faz-muted">Frases objetivas (modo produtor).</div>
            </div>
          </div>

          <div className="faz-summaryLines" style={{ marginTop: 6 }}>
            {summaryLines.map((l, i) => (
              <div className="faz-sline" key={i}>
                <span className="dot" />
                <span className="t">{l}</span>
              </div>
            ))}
          </div>

          <AutoSummary title="Resumo automático" bullets={bullets} />
        </div>

        <div className="faz-panel">
          <div className="faz-panel-head">
            <div>
              <h3>Checklist do mês</h3>
              <div className="faz-muted">O que falta para o relatório ficar completo.</div>
            </div>
          </div>

          <div className="pd-check" style={{ marginTop: 6 }}>
            {checklist.map((c, i) => (
              <div className={`pd-checkItem ${c.ok ? "ok" : ""}`} key={i}>
                <span className="pd-checkDot">{c.ok ? "✓" : "•"}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProducerDashboard({ monthKey }) {
  const mk = monthKey || new Date().toISOString().slice(0, 7);

  const [view, setView] = useState(VIEWS.HOME);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [connOk, setConnOk] = useState(true);
  const [data, setData] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setErr("");
    try {
      const j = await fetchJson(`/producer/monthly-summary?month=${encodeURIComponent(mk)}`);
      setData(j || {});
      setConnOk(true);
    } catch (e) {
      const msg = String(e?.message || e);
      setErr(msg);
      setConnOk(false);
      // mantém a tela utilizável mesmo sem back (valores ficam em branco/zero)
      setData((prev) => prev || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mk]);

  const arrobas = Number(data?.arrobas ?? 0);
  const hasArrobas = Number.isFinite(arrobas) && arrobas > 0;

  const costTotal = Number(data?.cost_total_brl ?? 0);
  const hasCosts = Number.isFinite(costTotal) && costTotal > 0;

  const topCosts = useMemo(() => {
    const raw =
      data?.top_costs ??
      data?.topCosts ??
      data?.top_costs_brl ??
      data?.top_costs_items ??
      data?.top_costs_groups ??
      data?.top_costs_by_group;

    const order = [
      ["PASTO", "Pasto"],
      ["NUTRICAO", "Nutrição"],
      ["SANIDADE_REPRODUCAO", "Sanidade/Reprodução"],
      ["OPERACAO", "Operação"],
      ["MAQUINAS_INFRA_OUTROS", "Máquinas/Infra/Outros"],
    ];

    const items = order.map(([key, label]) => ({
      key,
      label,
      value: getTopCostValue(raw, key, label),
    }));

    const maxv = Math.max(0, ...items.map((x) => Number(x.value) || 0));
    return { items, maxv };
  }, [data]);

  const trend = useMemo(() => {
    const t = Array.isArray(data?.trend) ? data.trend : [];
    return t.slice(-6);
  }, [data]);

  const trendMax = useMemo(() => {
    const vals = trend.map((r) => Number(r?.cost_per_arroba_brl)).filter((n) => Number.isFinite(n));
    return vals.length ? Math.max(...vals) : 0;
  }, [trend]);

  const seedExample = async () => {
    try {
      setLoading(true);
      await postJson("/producer/seed-demo", {});
      await refresh();
    } catch (e) {
      setErr(String(e?.message || e));
      setConnOk(false);
    } finally {
      setLoading(false);
    }
  };

  const goto = (k) => setView(k);

  return (
    <div className="faz-page faz-producer-dashboard">
      <div className="faz-pageHead">
        <div>
          <div className="faz-kicker">RELATÓRIO DO PRODUTOR</div>
          <div className="faz-titleRow">
            <h1 className="faz-title">Resumo do mês</h1>
            <div className="faz-muted">Período: {monthLabel(mk)} · Leitura rápida (R$/@) e decisões do mês.</div>
          </div>

          <NavTabs active={view} onChange={goto} />
        </div>

        <div className="faz-headActions">
          {!connOk ? (
            <div className="pd-connPill" title={err ? String(err) : undefined}>
              <span className="pd-connDot" aria-hidden="true" />
              <span className="pd-connLabel">Sem backend</span>
            </div>
          ) : null}

          <button className="faz-btn" type="button" onClick={refresh} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="faz-btn ghost" type="button" onClick={seedExample} disabled={loading}>
            Gerar exemplo
          </button>
        </div>
      </div>

      {view !== VIEWS.HOME ? (
        <div className="pd-detail">
          {view === VIEWS.COST_EVOLUTION ? (
            <CostEvolutionView mk={mk} data={data} onBack={() => setView(VIEWS.HOME)} refresh={refresh} loading={loading} />
          ) : null}

          {view === VIEWS.COST_DRIVERS ? (
            <CostDriversView
              mk={mk}
              data={data}
              topCosts={topCosts}
              onBack={() => setView(VIEWS.HOME)}
              refresh={refresh}
              loading={loading}
            />
          ) : null}

          {view === VIEWS.NUTRITION ? (
            <NutritionView
              mk={mk}
              data={data}
              topCosts={topCosts}
              onBack={() => setView(VIEWS.HOME)}
              refresh={refresh}
              loading={loading}
            />
          ) : null}

          {view === VIEWS.HERD ? (
            <HerdQuickView mk={mk} onBack={() => setView(VIEWS.HOME)} refresh={refresh} loading={loading} />
          ) : null}

          {view === VIEWS.SUMMARY ? (
            <SummaryContextView
              mk={mk}
              data={data}
              topCosts={topCosts}
              onBack={() => setView(VIEWS.HOME)}
              refresh={refresh}
              loading={loading}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="faz-grid-kpis">
            <div className="faz-kpi">
              <div className="k">@ produzidas (mês)</div>
              <div className="v">{formatNumber(arrobas)} @</div>
              <div className="s">Período: {monthLabel(mk)}</div>
            </div>

            <div className="faz-kpi">
              <div className="k">Custo (R$/@)</div>
              <div className="v">{hasArrobas ? formatBRLPerArroba(data?.cost_per_arroba_brl) : "—"}</div>
              <div className="s">Sempre por arroba produzida</div>
            </div>

            <div className="faz-kpi">
              <div className="k">Preço médio (R$/@)</div>
              <div className="v">{data?.price_per_arroba_brl == null ? "—" : formatBRLPerArroba(data.price_per_arroba_brl)}</div>
              <div className="s">Vendas/abates do mês</div>
            </div>

            <div className="faz-kpi">
              <div className="k">Margem (R$/@)</div>
              <div className="v">{data?.margin_per_arroba_brl == null ? "—" : formatBRLPerArroba(data.margin_per_arroba_brl)}</div>
              <div className="s">Preço − custo</div>
            </div>

            <div className="faz-kpi">
              <div className="k">Margem total (R$)</div>
              <div className="v">{data?.margin_total_brl == null ? "—" : formatBRL(data.margin_total_brl)}</div>
              <div className="s">Margem/@ × @ vendidas</div>
            </div>
          </div>

          <div className="faz-panels2">
            <div className="faz-panel">
              <div className="faz-panel-head">
                <div>
                  <h3>Evolução do custo (R$/@) — últimos 6 meses</h3>
                  <div className="faz-muted">Clique em “Abrir” para ver mais gráficos.</div>
                </div>
                <button className="faz-btn ghost sm" type="button" onClick={() => setView(VIEWS.COST_EVOLUTION)}>
                  Abrir
                </button>
              </div>

              {trend.length === 0 ? (
                <div className="faz-empty">
                  <div className="ic">📌</div>
                  <div>
                    <div className="t">Sem histórico suficiente</div>
                    <div className="d">Quando houver custos e @ em meses anteriores, a tendência aparece aqui.</div>
                  </div>
                </div>
              ) : (
                <div className="faz-trendList">
                  {trend.map((r, i) => {
                    const m = r?.month || "";
                    const v = Number(r?.cost_per_arroba_brl);
                    const pct =
                      trendMax > 0 && Number.isFinite(v) ? `${Math.max(2, Math.min(100, (v / trendMax) * 100))}%` : "0%";
                    return (
                      <div className="faz-trendRow" key={`${m}-${i}`}>
                        <div className="m">{monthLabel(m)}</div>
                        <div className="p">
                          <div className="bar">
                            <span className="fill" style={{ width: pct }} />
                          </div>
                        </div>
                        <div className="v">{Number.isFinite(v) ? formatBRLPerArroba(v) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="faz-panel">
              <div className="faz-panel-head">
                <div>
                  <h3>O que mais puxou seu custo</h3>
                  <div className="faz-muted">
                    Top 5 categorias (fixas) · Total no mês: <b>{formatBRL(costTotal)}</b>
                  </div>
                </div>
                <button className="faz-btn ghost sm" type="button" onClick={() => setView(VIEWS.COST_DRIVERS)}>
                  Abrir
                </button>
              </div>

              {!hasCosts ? (
                <div className="faz-empty">
                  <div className="ic">📌</div>
                  <div>
                    <div className="t">Sem custos registrados no mês</div>
                    <div className="d">Lance custos para aparecer aqui.</div>
                  </div>
                </div>
              ) : (
                <div className="faz-bars">
                  {topCosts.items.map((it) => {
                    const w =
                      topCosts.maxv <= 0 || !Number.isFinite(it.value)
                        ? "0%"
                        : `${Math.max(2, Math.min(100, (it.value / topCosts.maxv) * 100))}%`;
                    return (
                      <div className="faz-bar" key={it.key}>
                        <div className="name">{it.label}</div>
                        <div className="track">
                          <div className="fill" style={{ width: w }} />
                        </div>
                        <div className="val">{formatBRL(it.value)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="faz-panel" style={{ marginTop: 8 }}>
            <div className="faz-panel-head">
              <div>
                <h3>Resumo do mês</h3>
                <div className="faz-muted">Clique em “Abrir” para checklist e leitura completa.</div>
              </div>
              <button className="faz-btn ghost sm" type="button" onClick={() => setView(VIEWS.SUMMARY)}>
                Abrir
              </button>
            </div>

            <div className="faz-summaryGrid">
              <div className="faz-summaryLines">
                {(Array.isArray(data?.summary_lines) && data.summary_lines.length
                  ? data.summary_lines
                  : [
                      !hasArrobas ? "Você não registrou @ produzida neste mês." : null,
                      hasCosts ? `Custo total no mês: ${formatBRL(costTotal)}.` : "Sem custos registrados neste mês.",
                    ].filter(Boolean)
                ).slice(0, 6).map((l, i) => (
                  <div className="faz-sline" key={i}>
                    <span className="dot" />
                    <span className="t">{l}</span>
                  </div>
                ))}

                {!hasArrobas ? (
                  <div className="faz-callout info">
                    <div className="ic">i</div>
                    <div className="tx">
                      Sem @ produzida no mês. Registre <b>venda/abate</b> (saída) ou <b>pesagens</b> para calcular R$/@.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="faz-quick">
                <div className="faz-quick-title">Atalhos</div>
                <div className="faz-quick-grid">
                  <button className="faz-btn primary sm" type="button" onClick={() => setView(VIEWS.NUTRITION)}>
                    Nutrição — mês
                  </button>
                  <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.HERD)}>
                    Gado — rápido
                  </button>
                  <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_EVOLUTION)}>
                    Evolução do custo
                  </button>
                  <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_DRIVERS)}>
                    Puxou seu custo
                  </button>
                </div>
                <div className="faz-muted" style={{ marginTop: 8 }}>
                  Dica: feche o mês lançando custos e @ produzida. O R$/@ fica automático.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
