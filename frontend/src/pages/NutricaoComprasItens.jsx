import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";

// CSS do módulo (auto-contido, não depende do FazendaApp importar)
import "../styles/nutricao_admin.css";

const API_BASE = (import.meta?.env?.VITE_API_BASE || "http://localhost:8001").replace(/\/+$/, "");

function parsePtNumber(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatPtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getJson(path) {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

async function postJson(path, body) {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    let txt = "";
    try {
      txt = await r.text();
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${r.status} ${txt}`);
  }
  return await r.json().catch(() => ({}));
}

function Tab({ active, onClick, children }) {
  return (
    <button type="button" className={`faz-seg ${active ? "isActive" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="faz-field">
      <div className="faz-fieldLabel">{label}</div>
      {children}
      {hint ? <div className="faz-fieldHint">{hint}</div> : null}
    </div>
  );
}

export default function NutricaoComprasItens() {
  const [tab, setTab] = useState("compras");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [autoSeedTried, setAutoSeedTried] = useState(false);
  const [err, setErr] = useState(null);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Volumoso",
    default_unit: "kg",
    kg_per_unit: "",
    matter_dry_pct: "",
    aliases: "",
  });

  const [buy, setBuy] = useState({
    item_id: "",
    purchased_at: new Date().toISOString().slice(0, 10),
    qty: "",
    unit: "kg",
    unit_price_brl: "",
    notes: "",
  });

  const itemsById = useMemo(() => {
    const m = new Map();
    for (const it of items || []) m.set(Number(it.id), it);
    return m;
  }, [items]);

  const totalBuy = useMemo(() => {
    const q = parsePtNumber(buy.qty);
    const p = parsePtNumber(buy.unit_price_brl);
    if (!isFinite(q) || !isFinite(p)) return NaN;
    return q * p;
  }, [buy.qty, buy.unit_price_brl]);

  const selectedItem = useMemo(
    () => items.find((it) => Number(it.id) === Number(buy.item_id)) || null,
    [items, buy.item_id]
  );

  const summary = useMemo(() => {
    const totalAuto = Number.isFinite(totalBuy) ? totalBuy : 0;
    return {
      itemsCount: items.length,
      purchasesCount: purchases.length,
      selectedItem: selectedItem?.name || "—",
      totalAuto: isFinite(totalAuto) ? totalAuto : 0,
    };
  }, [items, purchases, selectedItem, totalBuy]);

  async function refreshAll() {
    setLoading(true);
    setErr(null);
    try {
      const [it, pu] = await Promise.all([getJson("/nutrition/items"), getJson("/nutrition/purchases?limit=50")]);
      const nextItems = it || [];
      setItems(nextItems);
      setPurchases(pu || []);

      // Primeira carga sem itens: cria catálogo padrão automaticamente
      if (!autoSeedTried && !nextItems.length) {
        setAutoSeedTried(true);
        await postJson("/nutrition/seed-default", {});
        const seeded = await getJson("/nutrition/items");
        setItems(seeded || []);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!items.length || buy.item_id) return;
    setBuy((prev) => ({
      ...prev,
      item_id: String(items[0].id),
      unit: prev.unit || items[0].default_unit || "kg",
    }));
  }, [items, buy.item_id]);

  useEffect(() => {
    if (!selectedItem) return;
    setBuy((prev) => ({ ...prev, unit: selectedItem.default_unit || prev.unit || "kg" }));
  }, [selectedItem]);

  async function seedDefaults() {
    setSeeding(true);
    setErr(null);
    try {
      await postJson("/nutrition/seed-default", {});
      await refreshAll();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSeeding(false);
    }
  }

  async function createItem() {
    setLoading(true);
    setErr(null);
    try {
      const isVol = String(newItem.category || "").toLowerCase().includes("vol");
      const payload = {
        name: newItem.name.trim(),
        category: newItem.category,
        is_volumoso: isVol,
        default_unit: newItem.default_unit,
        kg_per_unit: newItem.kg_per_unit ? Number(String(newItem.kg_per_unit).replace(",", ".")) : null,
        matter_dry_pct: newItem.matter_dry_pct ? Number(String(newItem.matter_dry_pct).replace(",", ".")) : null,
        aliases: newItem.aliases,
      };
      await postJson("/nutrition/items", payload);
      setNewItem({
        name: "",
        category: newItem.category,
        default_unit: newItem.default_unit,
        kg_per_unit: "",
        matter_dry_pct: "",
        aliases: "",
      });
      await refreshAll();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createPurchase() {
    setLoading(true);
    setErr(null);
    try {
      await postJson("/nutrition/purchases", {
        item_id: Number(buy.item_id),
        purchased_at: buy.purchased_at,
        qty: parsePtNumber(buy.qty),
        unit: buy.unit,
        unit_price_brl: parsePtNumber(buy.unit_price_brl),
        notes: buy.notes,
      });
      setBuy({ ...buy, qty: "", unit_price_brl: "", notes: "" });
      await refreshAll();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="faz-page faz-nutri-admin">
      <CrasPageHeader
        eyebrow="Nutrição"
        title="Itens e compras"
        subtitle="Preço automático: o vaqueiro lança só quantidade; o valor vem da última compra do item."
        help={{
          title: "Guia rápido",
          summary: "Cadastre compra uma vez e use no WhatsApp.",
          what: "A compra vira o preço vigente para os lançamentos operacionais.",
          steps: [
            "Cadastre ou selecione o item.",
            "Registre quantidade e preço unitário.",
            "Use no WhatsApp sem digitar valor toda vez.",
          ],
          after: "Custos ficam consistentes no mês.",
        }}
        actions={[
          { key: "seed", label: "Seed catálogo", tone: "soft" },
          { key: "reload", label: loading ? "Atualizando..." : "Atualizar", tone: "soft" },
        ]}
        onAction={(a) => {
          if (a?.key === "seed" && !loading && !seeding) seedDefaults();
          if (a?.key === "reload" && !loading) refreshAll();
        }}
      />

      <div className="nt-shell nt-summaryShell" style={{ marginTop: 12 }}>
        <div className="nt-summaryHead">
          <div>
            <div className="nt-eyebrow">Resumo do dia</div>
            <h3>Nutrição rápida e rastreável</h3>
          </div>
          <button className="faz-btn" type="button" onClick={refreshAll} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        <div className="nt-kpiGrid">
          <div className="nt-kpi">
            <div className="k">Itens cadastrados</div>
            <div className="v">{summary.itemsCount}</div>
            <div className="s">Disponíveis no catálogo</div>
          </div>
          <div className="nt-kpi">
            <div className="k">Últimas compras</div>
            <div className="v">{summary.purchasesCount}</div>
            <div className="s">Registros carregados</div>
          </div>
          <div className="nt-kpi">
            <div className="k">Item no formulário</div>
            <div className="v">{summary.selectedItem}</div>
            <div className="s">Selecionado para compra</div>
          </div>
          <div className="nt-kpi">
            <div className="k">Total da compra</div>
            <div className="v">{summary.totalAuto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            <div className="s">Cálculo automático</div>
          </div>
        </div>
      </div>

      {err ? (
        <div className="faz-alertBox">
          <div className="t">Atenção</div>
          <div className="d">{err}</div>
        </div>
      ) : null}

      {!loading && !items.length ? (
        <div className="faz-alertBox">
          <div className="t">Catálogo vazio</div>
          <div className="d">Não há itens para selecionar. Clique para criar o catálogo padrão e liberar o lançamento de compras.</div>
          <div style={{ marginTop: 10 }}>
            <button className="faz-btn primary" type="button" onClick={seedDefaults} disabled={seeding}>
              {seeding ? "Criando catálogo..." : "Criar itens padrão"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="faz-segRow">
        <Tab active={tab === "compras"} onClick={() => setTab("compras")}>
          Compras
        </Tab>
        <Tab active={tab === "itens"} onClick={() => setTab("itens")}>
          Itens
        </Tab>
      </div>

      {tab === "compras" ? (
        <div className="faz-grid2">
          <div className="faz-panel nt-shell">
            <h3>Registrar compra</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              A compra define o preço usado nos lançamentos do WhatsApp.
            </div>

            <div className="faz-formGrid" style={{ marginTop: 12 }}>
              <Field label="Item">
                <select className="faz-input" value={buy.item_id} onChange={(e) => setBuy({ ...buy, item_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data">
                <input className="faz-input" type="date" value={buy.purchased_at} onChange={(e) => setBuy({ ...buy, purchased_at: e.target.value })} />
              </Field>

              <Field label="Quantidade">
                <input className="faz-input" value={buy.qty} onChange={(e) => setBuy({ ...buy, qty: e.target.value })} placeholder="Ex.: 50" />
              </Field>
              <Field label="Unidade">
                <input className="faz-input" value={buy.unit} onChange={(e) => setBuy({ ...buy, unit: e.target.value })} placeholder="kg, saco, fardo, rolo, ton..." />
              </Field>

              <Field label="Preço unitário (R$)">
                <input className="faz-input" value={buy.unit_price_brl} onChange={(e) => setBuy({ ...buy, unit_price_brl: e.target.value })} placeholder="Ex.: 120" />
              </Field>
              <Field label="Total (auto)">
                <input className="faz-input" value={Number.isFinite(totalBuy) ? formatPtMoney(totalBuy) : ""} readOnly placeholder="—" />
              </Field>

              <Field label="Obs." hint="Opcional">
                <input className="faz-input" value={buy.notes} onChange={(e) => setBuy({ ...buy, notes: e.target.value })} placeholder="Fornecedor, frete, nota..." />
              </Field>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button className="faz-btn primary" type="button" onClick={createPurchase} disabled={loading || !items.length || !buy.item_id || !buy.qty || !buy.unit_price_brl}>
                Registrar compra
              </button>
            </div>
          </div>

          <div className="faz-panel nt-shell">
            <h3>Últimas compras</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              Usadas como “preço vigente” para o WhatsApp.
            </div>

            <div className="faz-table" style={{ marginTop: 12 }}>
              <div className="faz-tr faz-th">
                <div>Data</div>
                <div>Item</div>
                <div>Qtd</div>
                <div>Un</div>
                <div>R$/un</div>
              </div>
              {purchases.map((p) => {
                const it = itemsById.get(Number(p.item_id));
                const nm = it?.name || `#${p.item_id}`;
                return (
                  <div className="faz-tr" key={p.id}>
                    <div>{String(p.purchased_at || "").slice(0, 10)}</div>
                    <div>{nm}</div>
                    <div>{p.qty}</div>
                    <div>{p.unit}</div>
                    <div>{Number(p.unit_price_brl || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                  </div>
                );
              })}
              {!purchases.length ? <div className="faz-muted" style={{ marginTop: 10 }}>Sem compras ainda.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "itens" ? (
        <div className="faz-grid2">
          <div className="faz-panel nt-shell">
            <h3>Novo item</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              Cadastre equivalências (kg por unidade) para facilitar conversões.
            </div>

            <div className="faz-formGrid" style={{ marginTop: 12 }}>
              <Field label="Nome">
                <input className="faz-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Ex.: Silagem de sorgo" />
              </Field>
              <Field label="Tipo">
                <select className="faz-input" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                  <option>Volumoso</option>
                  <option>Concentrado</option>
                  <option>Proteico</option>
                  <option>Mineral</option>
                  <option>Aditivo</option>
                </select>
              </Field>

              <Field label="Unidade padrão">
                <input className="faz-input" value={newItem.default_unit} onChange={(e) => setNewItem({ ...newItem, default_unit: e.target.value })} placeholder="kg, saco, fardo..." />
              </Field>
              <Field label="kg por unidade" hint="Opcional. Ex.: saco=40, fardo=20, rolo=350">
                <input className="faz-input" value={newItem.kg_per_unit} onChange={(e) => setNewItem({ ...newItem, kg_per_unit: e.target.value })} placeholder="Ex.: 40" />
              </Field>

              <Field label="Matéria seca (%)" hint="Opcional (p/ eficiência depois)">
                <input className="faz-input" value={newItem.matter_dry_pct} onChange={(e) => setNewItem({ ...newItem, matter_dry_pct: e.target.value })} placeholder="Ex.: 32" />
              </Field>
              <Field label="Sinônimos" hint="Separar por ; ou vírgula. Ex.: silagem sorgo; sorgo ensilado">
                <input className="faz-input" value={newItem.aliases} onChange={(e) => setNewItem({ ...newItem, aliases: e.target.value })} placeholder="Ex.: ração; trato; concentrado" />
              </Field>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button className="faz-btn primary" type="button" onClick={createItem} disabled={loading || !newItem.name.trim()}>
                Criar item
              </button>
            </div>
          </div>

          <div className="faz-panel nt-shell">
            <h3>Itens cadastrados</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              O WhatsApp identifica o item por nome/sinônimos.
            </div>

            <div className="faz-table" style={{ marginTop: 12 }}>
              <div className="faz-tr faz-th">
                <div>Item</div>
                <div>Vol?</div>
                <div>Un</div>
                <div>kg/un</div>
                <div>MS%</div>
              </div>
              {items.map((it) => (
                <div className="faz-tr" key={it.id}>
                  <div>{it.name}</div>
                  <div>{it.is_volumoso ? "Sim" : "Não"}</div>
                  <div>{it.default_unit}</div>
                  <div>{it.kg_per_unit == null ? "—" : it.kg_per_unit}</div>
                  <div>{it.matter_dry_pct == null ? "—" : it.matter_dry_pct}</div>
                </div>
              ))}
              {!items.length ? <div className="faz-muted" style={{ marginTop: 10 }}>Sem itens. Use “Seed catálogo”.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="faz-muted" style={{ marginTop: 14, fontSize: 12 }}>
        Dica: depois de registrar uma compra, teste no WhatsApp: “dei 1 saco de ração na manga 30”.
      </div>
    </div>
  );
}
