import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/nutrition_fix.css";

function currentMonthKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

function todayLocalISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function toOccurredAt(dateYYYYMMDD){
  // fixa meio-dia local para evitar virar o dia por timezone
  try {
    const [y,m,d] = dateYYYYMMDD.split("-").map(n => parseInt(n,10));
    const dt = new Date(y, (m||1)-1, d||1, 12, 0, 0);
    return dt.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function money(n){
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function brl(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(key){
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || "";
  const [y,m] = key.split("-").map(x => parseInt(x,10));
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[(m||1)-1]}/${y}`;
}

function safeText(v){
  return (v == null) ? "" : String(v);
}

function extractNutriTotal(summary){
  const top = Array.isArray(summary?.top_costs) ? summary.top_costs : [];
  const item = top.find(x => (x?.group || "").toLowerCase().includes("nut"));
  return money(item?.value_brl);
}

function eventIsInMonth(ev, monthKey){
  const iso = ev?.occurred_at || ev?.created_at;
  if (!iso) return false;
  try {
    const m = new Date(iso).toISOString().slice(0,7);
    return m === monthKey;
  } catch {
    return false;
  }
}

function isNutriCost(ev){
  const p = ev?.payload || {};
  const g = (p.group || p.categoria || p.simple_group || "").toString().toLowerCase();
  return g.includes("nut") || g.includes("ração") || g.includes("racao") || g.includes("sal") || g.includes("mineral");
}

function prettyWhen(iso){
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso || "";
  }
}

const ITEM_PRESETS = [
  { key: "racao", label: "Ração" },
  { key: "sal", label: "Sal" },
  { key: "mineral", label: "Mineral" },
];

const UNIT_PRESETS = [
  { key: "saco", label: "Saco" },
  { key: "kg", label: "kg" },
  { key: "litro", label: "Litro" },
  { key: "un", label: "Un." },
];

function storageKey(itemKey, unitKey){
  return `ideal_fazenda_price_${itemKey}_${unitKey}`;
}

export default function Nutrition({ monthKey }){
  const mk = monthKey || currentMonthKey();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);

  const [form, setForm] = useState({
    date: todayLocalISO(),
    areaCode: "",
    itemKey: "racao",
    unitKey: "saco",
    qty: "1",
    unitPrice: "",
    total: "",
    notes: "",
  });

  // carrega preço padrão salvo
  useEffect(() => {
    try {
      const k = storageKey(form.itemKey, form.unitKey);
      const v = localStorage.getItem(k);
      if (v && !form.unitPrice){
        setForm(f => ({ ...f, unitPrice: v }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itemKey, form.unitKey]);

  // recalcula total
  useEffect(() => {
    const q = money(form.qty);
    const up = money(form.unitPrice);
    if (q > 0 && up > 0) {
      const t = q * up;
      setForm(f => ({ ...f, total: String(Math.round(t * 100) / 100) }));
    }
    // não forçar total se não tiver preço
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.qty, form.unitPrice]);

  async function load(){
    setLoading(true);
    setErr(null);
    try {
      const [s, evs] = await Promise.all([
        api.get(`/producer/monthly-summary?month=${encodeURIComponent(mk)}`),
        api.get(`/events?type=cost&limit=200`),
      ]);
      setSummary(s || null);
      setEvents(Array.isArray(evs) ? evs : []);
    } catch (e){
      setErr(e?.message || "Falha ao carregar");
      setSummary(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mk]);

  const monthNutriTotal = useMemo(() => extractNutriTotal(summary), [summary]);
  const monthCostTotal = useMemo(() => money(summary?.cost_total_brl), [summary]);
  const arrobas = useMemo(() => money(summary?.arrobas), [summary]);
  const nutriPerArroba = useMemo(() => (arrobas > 0 ? (monthNutriTotal/arrobas) : null), [monthNutriTotal, arrobas]);

  const monthNutriEvents = useMemo(() => {
    const list = (events || [])
      .filter(ev => eventIsInMonth(ev, mk))
      .filter(ev => isNutriCost(ev))
      .sort((a,b) => (new Date(b.occurred_at||b.created_at) - new Date(a.occurred_at||a.created_at)));
    return list;
  }, [events, mk]);

  async function saveDefaultPrice(){
    try {
      const k = storageKey(form.itemKey, form.unitKey);
      const up = money(form.unitPrice);
      if (up <= 0) return alert("Informe um preço unitário válido para salvar.");
      localStorage.setItem(k, String(up));
      alert("Preço padrão salvo.");
    } catch {
      alert("Não foi possível salvar (localStorage bloqueado).");
    }
  }

  async function submit(){
    const area = safeText(form.areaCode).trim();
    const qty = money(form.qty);
    const unitPrice = money(form.unitPrice);
    let total = money(form.total);

    if (!area) return alert("Informe a Manga (ex.: 30).");
    if (qty <= 0) return alert("Quantidade inválida.");

    // Se total não foi informado, tenta calcular
    if (total <= 0 && unitPrice > 0) total = qty * unitPrice;
    if (total <= 0) return alert("Informe o Total (R$) ou um Preço unitário para calcular.");

    const itemLabel = ITEM_PRESETS.find(x => x.key === form.itemKey)?.label || "Nutrição";
    const unitLabel = UNIT_PRESETS.find(x => x.key === form.unitKey)?.label || form.unitKey;

    const raw_text = `Nutrição: ${qty} ${unitLabel} de ${itemLabel} na Manga ${area} (${brl(total)})`;

    const payload = {
      group: "Nutrição",
      item: itemLabel,
      qty,
      unit: unitLabel,
      unit_price_brl: unitPrice > 0 ? unitPrice : null,
      value_brl: Math.round(total * 100) / 100,
      area_code: area,
      area_label: `Manga ${area}`,
      notes: safeText(form.notes).trim() || null,
    };

    setLoading(true);
    try {
      await api.post("/events", {
        source: "app",
        status: "approved",
        type: "cost",
        occurred_at: toOccurredAt(form.date),
        raw_text,
        payload,
      });

      // limpa só o que faz sentido
      setForm(f => ({
        ...f,
        qty: "1",
        total: "",
        notes: "",
      }));

      await load();
    } catch (e){
      alert(e?.message || "Falha ao lançar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cras-stage-v2 faz-nutri">
      <CrasPageHeader
        eyebrow="Operação"
        title="Nutrição"
        subtitle="Registre o trato no dia a dia. Isso entra no custo do mês e aparece em R$/@ produzida."
        actions={[{ key: "refresh", label: loading ? "Atualizando…" : "Atualizar", tone: "primary" }]}
        onAction={() => load()}
      />

      <div className="cras-stage-body">
        {err ? (
          <div className="faz-panel" style={{ borderColor: "rgba(185,28,28,.35)" }}>
            <h3>Falha ao carregar</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>{err}</div>
          </div>
        ) : null}

        <div className="faz-nutri-kpis">
          <div className="faz-kpiCard">
            <div className="k">Nutrição no mês</div>
            <div className="v">{brl(monthNutriTotal)}</div>
            <div className="s">Período: {monthLabel(mk)}</div>
          </div>
          <div className="faz-kpiCard">
            <div className="k">Total de custos no mês</div>
            <div className="v">{brl(monthCostTotal)}</div>
            <div className="s">Soma das categorias</div>
          </div>
          <div className="faz-kpiCard">
            <div className="k">@ produzidas no mês</div>
            <div className="v">{Number.isFinite(arrobas) ? arrobas.toLocaleString("pt-BR") : "—"} @</div>
            <div className="s">Base do R$/@</div>
          </div>
          <div className="faz-kpiCard">
            <div className="k">Nutrição por @</div>
            <div className="v">{nutriPerArroba == null ? "—" : `${brl(nutriPerArroba)}/@`}</div>
            <div className="s">Estimativa (Nutrição ÷ @)</div>
          </div>
        </div>

        {arrobas <= 0 ? (
          <div className="faz-panel" style={{ marginTop: 12 }}>
            <div className="faz-emptyRow">
              <div className="ic">📌</div>
              <div>
                <div className="t">Sem @ produzida neste mês</div>
                <div className="d">O custo entra, mas o R$/@ só fecha quando você registrar saídas (venda/abate) ou pesagens.</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="faz-nutri-grid">
          <div className="card faz-nutri-card">
            <div className="faz-nutri-cardHead">
              <div>
                <div className="faz-nutri-title">Novo lançamento</div>
                <div className="faz-nutri-sub">Ex.: “1 saco de ração na manga 30”.</div>
              </div>
              <div className="faz-nutri-badges">
                <span className="faz-chipLite">Sempre por @</span>
                <span className="faz-chipLite">Grupo: Nutrição</span>
              </div>
            </div>

            <div className="faz-nutri-form">
              <div className="col">
                <label className="form-label">Data</label>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <div className="col">
                <label className="form-label">Manga</label>
                <input className="input" value={form.areaCode} onChange={(e) => setForm(f => ({ ...f, areaCode: e.target.value }))} placeholder="Ex.: 30" />
                <div className="texto-suave" style={{ marginTop: 6 }}>Pode digitar só o número.</div>
              </div>

              <div className="col">
                <label className="form-label">Item</label>
                <select className="input" value={form.itemKey} onChange={(e) => setForm(f => ({ ...f, itemKey: e.target.value }))}>
                  {ITEM_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>

              <div className="col">
                <label className="form-label">Unidade</label>
                <select className="input" value={form.unitKey} onChange={(e) => setForm(f => ({ ...f, unitKey: e.target.value }))}>
                  {UNIT_PRESETS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
              </div>

              <div className="col">
                <label className="form-label">Quantidade</label>
                <input className="input" inputMode="decimal" value={form.qty} onChange={(e) => setForm(f => ({ ...f, qty: e.target.value }))} />
              </div>

              <div className="col">
                <label className="form-label">Preço unitário (R$)</label>
                <input className="input" inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="Ex.: 120" />
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="faz-btn" type="button" onClick={saveDefaultPrice}>Salvar como padrão</button>
                  <button className="faz-btn" type="button" onClick={() => setForm(f => ({ ...f, unitPrice: "", total: "" }))}>Limpar preço</button>
                </div>
              </div>

              <div className="col">
                <label className="form-label">Total (R$)</label>
                <input className="input" inputMode="decimal" value={form.total} onChange={(e) => setForm(f => ({ ...f, total: e.target.value }))} placeholder="Ex.: 120" />
                <div className="texto-suave" style={{ marginTop: 6 }}>Se tiver preço unitário, calcula automático.</div>
              </div>

              <div className="col full">
                <label className="form-label">Observação</label>
                <input className="input" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex.: lote 10, bezerros, trato da manhã…" />
              </div>
            </div>

            <div className="card-footer-right" style={{ marginTop: 12 }}>
              <button className="btn-secundario" type="button" onClick={() => setForm(f => ({ ...f, qty: "1", total: "", notes: "" }))}>Limpar</button>
              <button className="btn-primario" type="button" onClick={submit} disabled={loading}>{loading ? "Salvando…" : "Lançar custo"}</button>
            </div>

            <div className="faz-nutri-tip">
              <b>Dica WhatsApp (próximo patch):</b> “Hoje dei 1 saco de ração na manga 30”. O sistema cria pendente e você aprova.
            </div>
          </div>

          <div className="card faz-nutri-card">
            <div className="faz-nutri-cardHead">
              <div>
                <div className="faz-nutri-title">Lançamentos do mês</div>
                <div className="faz-nutri-sub">Últimos registros de Nutrição (aprovados).</div>
              </div>
              <div className="faz-nutri-badges">
                <span className="faz-chipLite">{monthNutriEvents.length} itens</span>
              </div>
            </div>

            {monthNutriEvents.slice(0, 20).map((ev) => {
              const p = ev.payload || {};
              const area = p.area_label || (p.area_code ? `Manga ${p.area_code}` : "—");
              const item = p.item || "—";
              const qty = p.qty;
              const unit = p.unit || "";
              const total = p.value_brl;

              return (
                <div className="faz-nutri-row" key={ev.id}>
                  <div className="a">
                    <div className="t">{area}</div>
                    <div className="d">{prettyWhen(ev.occurred_at || ev.created_at)} • {item}</div>
                  </div>
                  <div className="q">{qty != null ? `${qty} ${unit}` : "—"}</div>
                  <div className="v">{brl(total)}</div>
                </div>
              );
            })}

            {monthNutriEvents.length === 0 ? (
              <div className="faz-empty" style={{ marginTop: 10 }}>
                <div className="ic">📌</div>
                <div>
                  <div className="t">Nada lançado ainda</div>
                  <div className="d">Registre acima e isso já entra no custo do mês.</div>
                </div>
              </div>
            ) : null}

            <div className="texto-suave" style={{ marginTop: 12 }}>
              Observação: por enquanto, a lista busca os últimos 200 custos e filtra pelo mês.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
