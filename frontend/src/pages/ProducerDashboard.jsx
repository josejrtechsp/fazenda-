import React, { useEffect, useMemo, useState } from "react";
import { fetchPendingSnapshot, normalizePendingSnapshot } from "../lib/herdSignals.js";
import { bootstrapLegacyInventoryToBackend, fetchInventoryAlerts } from "../lib/inventorySignals.js";
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

function safeParseJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function normEar(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

function daysSinceIso(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const ms = Date.now() - d.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

function readPendingSnapshotFromLocal() {
  try {
    if (typeof window === "undefined") return normalizePendingSnapshot({});

    const readHerdLs = (base, fallback) => {
      const keys = [`${base}_v3`, `${base}_v2`, `${base}_v1`];
      for (const key of keys) {
        const parsed = safeParseJson(localStorage.getItem(key) || "", null);
        if (parsed != null) return parsed;
      }
      return fallback;
    };
    const animals = readHerdLs("faz_rebanho_animals", []);
    const opsLog = readHerdLs("faz_rebanho_opslog", []);
    const health = readHerdLs("faz_rebanho_health", {});
    const active = (Array.isArray(animals) ? animals : []).filter((a) => a && a.status !== "inactive");

    const suspectSet = new Set();
    for (const it of (Array.isArray(opsLog) ? opsLog : [])) {
      if (!it || it.type !== "weigh" || it.flag !== "out_of_range") continue;
      const ear = normEar(it.ear);
      if (ear) suspectSet.add(ear);
    }
    const suspectWeights = suspectSet.size;

    let noWeigh = 0;
    let staleWeigh = 0;
    let vacOverdue = 0;

    for (const a of active) {
      const ds = daysSinceIso(a?.lastWeighedAt);
      if (ds == null) noWeigh += 1;
      else if (ds >= 60) staleWeigh += 1;

      const ear = normEar(a?.ear);
      const h = (health && typeof health === "object" ? health[ear] : null) || {};
      const vac = (h && typeof h.vac === "object" ? h.vac : {}) || {};
      const vacNext = vac.next || "";
      if (vacNext && String(vacNext) < new Date().toISOString().slice(0, 10)) vacOverdue += 1;
    }
    const pendingTotal = suspectWeights + noWeigh + staleWeigh;

    return normalizePendingSnapshot({
      counts: {
        suspect_weighs: suspectWeights,
        no_weigh: noWeigh,
        stale_weigh: staleWeigh,
        overdue_vaccine: vacOverdue,
        operational_total: pendingTotal,
      },
    });
  } catch {
    return normalizePendingSnapshot({});
  }
}

function readClassicOverviewFromLocal() {
  try {
    if (typeof window === "undefined") {
      return {
        propertyCount: 1,
        activeHeads: 0,
        areaCount: 0,
        lotCount: 0,
        male: 0,
        female: 0,
        topCategories: [],
        stockAlerts: [],
        totalArrobas: 0,
        totalWeightKg: 0,
        healthSummary: {
          pregCount: 0,
          emptyCount: 0,
          ndPregCount: 0,
          overdueVaccineCount: 0,
          noVaccineScheduleCount: 0,
          recentHealthEventsMonth: 0,
          recentReproEventsMonth: 0,
        },
      };
    }

    const readHerdLs = (base, fallback) => {
      const keys = [`${base}_v3`, `${base}_v2`, `${base}_v1`];
      for (const key of keys) {
        const parsed = safeParseJson(localStorage.getItem(key) || "", null);
        if (parsed != null) return parsed;
      }
      return fallback;
    };
    const animals = readHerdLs("faz_rebanho_animals", []);
    const lots = readHerdLs("faz_rebanho_lots", []);
    const health = readHerdLs("faz_rebanho_health", {});

    const active = (Array.isArray(animals) ? animals : []).filter((a) => a && a.status !== "inactive");
    const lotIds = new Set();
    let male = 0;
    let female = 0;
    let totalWeightKg = 0;
    let pregCount = 0;
    let emptyCount = 0;
    let ndPregCount = 0;
    let overdueVaccineCount = 0;
    let noVaccineScheduleCount = 0;
    const catMap = new Map();
    const todayIso = new Date().toISOString().slice(0, 10);

    for (const a of active) {
      const lotId = Number(a?.lotId);
      if (Number.isFinite(lotId) && lotId > 0) lotIds.add(lotId);

      const sex = String(a?.sex || "").toUpperCase();
      if (sex === "M") male += 1;
      if (sex === "F") female += 1;

      const cat = String(a?.category || "Sem categoria").trim();
      catMap.set(cat, (catMap.get(cat) || 0) + 1);

      const lastWeightKg = Number(a?.lastWeightKg);
      if (Number.isFinite(lastWeightKg) && lastWeightKg > 0) totalWeightKg += lastWeightKg;

      const ear = normEar(a?.ear);
      const h = (health && typeof health === "object" ? health[ear] : null) || {};
      const preg = String(h?.pregStatus || h?.preg_status || "ND").toUpperCase();
      if (preg === "PRENHA") pregCount += 1;
      else if (preg === "VAZIA") emptyCount += 1;
      else ndPregCount += 1;

      const vac = (h && typeof h.vac === "object" ? h.vac : {}) || {};
      const vacNext = String(vac?.next || "").trim();
      if (vacNext && vacNext < todayIso) overdueVaccineCount += 1;
      if (!vacNext) noVaccineScheduleCount += 1;
    }

    const topCategories = Array.from(catMap.entries())
      .map(([label, value]) => ({
        label,
        value: Number(value) || 0,
        pct: active.length > 0 ? ((Number(value) || 0) / active.length) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const readStockRows = (key) => {
      const raw = safeParseJson(localStorage.getItem(key) || "[]", []);
      return Array.isArray(raw) ? raw : [];
    };

    const stockPools = [
      { key: "Sêmen e Embriões", rows: readStockRows("faz_estoque_semen_v1") },
      { key: "Nutrição", rows: readStockRows("faz_estoque_nutricional_v1") },
      { key: "Farmácia", rows: readStockRows("faz_estoque_farmacia_v1") },
    ];

    const stockAlerts = [];
    for (const pool of stockPools) {
      const low = pool.rows
        .filter((r) => {
          const q = Number(r?.quantidade ?? r?.qty ?? 0);
          return Number.isFinite(q) && q <= 0;
        })
        .slice(0, 2);

      for (const r of low) {
        stockAlerts.push({
          section: pool.key,
          name: String(r?.nome || r?.name || "Item"),
          qty: Number(r?.quantidade ?? 0) || 0,
          unit: String(r?.unidade || r?.unit || "un"),
          local: String(r?.local || "Sem local"),
        });
      }
    }

    return {
      propertyCount: 1,
      activeHeads: active.length,
      areaCount: Math.max(0, Math.min(99, Math.round(Math.max(1, lotIds.size / 2)))),
      lotCount: (Array.isArray(lots) ? lots.length : 0) || lotIds.size,
      male,
      female,
      topCategories,
      stockAlerts,
      totalArrobas: totalWeightKg / 15,
      totalWeightKg,
      healthSummary: {
        pregCount,
        emptyCount,
        ndPregCount,
        overdueVaccineCount,
        noVaccineScheduleCount,
        recentHealthEventsMonth: 0,
        recentReproEventsMonth: 0,
      },
    };
  } catch {
    return {
      propertyCount: 1,
      activeHeads: 0,
      areaCount: 0,
      lotCount: 0,
      male: 0,
      female: 0,
      topCategories: [],
      stockAlerts: [],
      totalArrobas: 0,
      totalWeightKg: 0,
      healthSummary: {
        pregCount: 0,
        emptyCount: 0,
        ndPregCount: 0,
        overdueVaccineCount: 0,
        noVaccineScheduleCount: 0,
        recentHealthEventsMonth: 0,
        recentReproEventsMonth: 0,
      },
    };
  }
}

function normalizeInventoryAlertSnapshot(raw) {
  const alerts = Array.isArray(raw?.alerts)
    ? raw.alerts.map((item) => ({
        section: String(item?.section || item?.label || item?.kind || "Estoque"),
        name: String(item?.name || "Item"),
        qty: Number(item?.qty || 0),
        unit: String(item?.unit || "un"),
        local: String(item?.local || item?.location || "Sem local"),
      }))
    : [];

  return {
    alerts,
    totalItems: Math.max(0, Number(raw?.total_items || 0)),
  };
}

function buildClassicOverviewFromBackend(herdSummary, properties, stockAlertSnapshot) {
  const activeHeads = Number(herdSummary?.total_active || 0);
  const totalWeightKg = Number(herdSummary?.total_weight_kg || 0);
  const totalArrobas = Number(herdSummary?.total_arrobas || 0);
  const inventorySnapshot = normalizeInventoryAlertSnapshot(stockAlertSnapshot || {});
  const propCount = Array.isArray(properties) && properties.length
    ? properties.length
    : Math.max(1, Number(herdSummary?.property_count || 0));

  const topCategories = Array.isArray(herdSummary?.top_categories)
    ? herdSummary.top_categories.map((item) => ({
        label: String(item?.label || "Sem categoria"),
        value: Number(item?.value || 0),
        pct: Number(item?.pct || 0),
      }))
    : [];

  return {
    propertyCount: propCount,
    activeHeads,
    areaCount: Number(herdSummary?.area_count || 0),
    lotCount: Number(herdSummary?.lot_count || 0),
    male: Number(herdSummary?.male_count || 0),
    female: Number(herdSummary?.female_count || 0),
    topCategories,
    stockAlerts: inventorySnapshot.alerts,
    inventoryTotalItems: inventorySnapshot.totalItems,
    totalArrobas: Number.isFinite(totalArrobas) ? totalArrobas : 0,
    totalWeightKg: Number.isFinite(totalWeightKg) ? totalWeightKg : 0,
    healthSummary: {
      pregCount: Number(herdSummary?.health_summary?.preg_count ?? herdSummary?.preg_count ?? 0),
      emptyCount: Number(herdSummary?.health_summary?.empty_count ?? herdSummary?.empty_count ?? 0),
      ndPregCount: Number(herdSummary?.health_summary?.nd_preg_count ?? herdSummary?.nd_preg_count ?? 0),
      overdueVaccineCount: Number(
        herdSummary?.health_summary?.overdue_vaccine_count ?? herdSummary?.overdue_vaccine_count ?? 0
      ),
      noVaccineScheduleCount: Number(
        herdSummary?.health_summary?.no_vaccine_schedule_count ?? herdSummary?.no_vaccine_schedule_count ?? 0
      ),
      recentHealthEventsMonth: Number(herdSummary?.health_summary?.recent_health_events_month ?? 0),
      recentReproEventsMonth: Number(herdSummary?.health_summary?.recent_repro_events_month ?? 0),
    },
  };
}

function createEmptyTitlesSummary(loaded = false) {
  return {
    payable: {
      open_brl: 0,
      open_count: 0,
      overdue_brl: 0,
      overdue_count: 0,
      pending_approval_brl: 0,
      pending_approval_count: 0,
      pending_reconciliation_brl: 0,
      pending_reconciliation_count: 0,
    },
    receivable: {
      open_brl: 0,
      open_count: 0,
      overdue_brl: 0,
      overdue_count: 0,
      pending_approval_brl: 0,
      pending_approval_count: 0,
      pending_reconciliation_brl: 0,
      pending_reconciliation_count: 0,
    },
    result: { net_open_brl: 0 },
    meta: { loaded },
  };
}

function createEmptyFinanceSetup(loaded = false) {
  return {
    hasSupplier: false,
    hasCustomer: false,
    hasExpenseAccount: false,
    hasRevenueAccount: false,
    hasCostCenter: false,
    hasBankAccount: false,
    hasPaymentMethod: false,
    costCenters: { total: 0, active: 0, usable: 0, status: "missing", issue: "" },
    bankAccounts: { total: 0, active: 0, usable: 0, status: "missing", issue: "" },
    paymentMethods: { total: 0, active: 0, usable: 0, status: "missing", issue: "" },
    approvalPolicy: { enabled: false, payableTiers: 0, receivableTiers: 0, ready: false, issue: "" },
    meta: { loaded },
  };
}

function normalizeSetupRows(rows) {
  return Array.isArray(rows) ? rows.filter((item) => item && typeof item === "object") : [];
}

function buildSetupStatus(rows, isUsable, messages) {
  const allRows = normalizeSetupRows(rows);
  const activeRows = allRows.filter((item) => item?.is_active !== false);
  const usableRows = activeRows.filter((item) => (typeof isUsable === "function" ? isUsable(item) : true));

  if (!allRows.length) {
    return { total: 0, active: 0, usable: 0, status: "missing", issue: String(messages?.missing || "") };
  }
  if (!activeRows.length) {
    return {
      total: allRows.length,
      active: 0,
      usable: 0,
      status: "inactive",
      issue: String(messages?.inactive || messages?.attention || ""),
    };
  }
  if (!usableRows.length) {
    return {
      total: allRows.length,
      active: activeRows.length,
      usable: 0,
      status: "attention",
      issue: String(messages?.attention || messages?.inactive || ""),
    };
  }
  return {
    total: allRows.length,
    active: activeRows.length,
    usable: usableRows.length,
    status: "ready",
    issue: "",
  };
}

function buildFinanceSetupSnapshot({
  suppliers,
  customers,
  expenseAccounts,
  revenueAccounts,
  costCenters,
  bankAccounts,
  paymentMethods,
  approvalPolicy,
  loaded,
}) {
  const bankStatus = buildSetupStatus(
    bankAccounts,
    (item) => !!String(item?.name || "").trim() && !!String(item?.bank_name || "").trim() && !!String(item?.account_number || "").trim(),
    {
      missing: "Nenhuma conta bancária cadastrada.",
      inactive: "Existem contas bancárias, mas todas estão inativas.",
      attention: "As contas bancárias ativas ainda estão incompletas. Preencha banco e número da conta.",
    }
  );

  const usableBankIds = new Set(
    normalizeSetupRows(bankAccounts)
      .filter((item) => item?.is_active !== false)
      .filter((item) => !!String(item?.name || "").trim() && !!String(item?.bank_name || "").trim() && !!String(item?.account_number || "").trim())
      .map((item) => Number(item?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0)
  );
  const bankLinkedMethods = new Set(["PIX", "BOLETO", "TRANSFERENCIA", "CARTAO"]);
  const paymentStatus = buildSetupStatus(
    paymentMethods,
    (item) => {
      const name = !!String(item?.name || "").trim();
      const methodType = String(item?.method_type || "").trim().toUpperCase();
      if (!name || !methodType) return false;
      if (!bankLinkedMethods.has(methodType)) return true;
      return usableBankIds.has(Number(item?.default_bank_account_id || 0));
    },
    {
      missing: "Nenhuma forma de pagamento cadastrada.",
      inactive: "Existem formas de pagamento, mas todas estão inativas.",
      attention: "As formas ativas que passam por banco ainda não têm conta padrão válida.",
    }
  );

  const costCenterStatus = buildSetupStatus(
    costCenters,
    (item) => !!String(item?.code || "").trim() && !!String(item?.name || "").trim(),
    {
      missing: "Nenhum centro de custo cadastrado.",
      inactive: "Existem centros de custo, mas todos estão inativos.",
      attention: "Os centros de custo ativos estão incompletos.",
    }
  );

  const approvalItem =
    approvalPolicy && typeof approvalPolicy === "object" && approvalPolicy.item && typeof approvalPolicy.item === "object"
      ? approvalPolicy.item
      : approvalPolicy && typeof approvalPolicy === "object"
        ? approvalPolicy
        : {};
  const payableTiers = Array.isArray(approvalItem?.payable_tiers) ? approvalItem.payable_tiers.length : 0;
  const receivableTiers = Array.isArray(approvalItem?.receivable_tiers) ? approvalItem.receivable_tiers.length : 0;
  const approvalEnabled = !!approvalItem?.enabled;
  const approvalReady = approvalEnabled && payableTiers + receivableTiers > 0;

  return {
    hasSupplier: normalizeSetupRows(suppliers).length > 0,
    hasCustomer: normalizeSetupRows(customers).length > 0,
    hasExpenseAccount: normalizeSetupRows(expenseAccounts).length > 0,
    hasRevenueAccount: normalizeSetupRows(revenueAccounts).length > 0,
    hasCostCenter: costCenterStatus.status === "ready",
    hasBankAccount: bankStatus.status === "ready",
    hasPaymentMethod: paymentStatus.status === "ready",
    costCenters: costCenterStatus,
    bankAccounts: bankStatus,
    paymentMethods: paymentStatus,
    approvalPolicy: {
      enabled: approvalEnabled,
      payableTiers,
      receivableTiers,
      ready: approvalReady,
      issue: !approvalEnabled
        ? "A alçada de aprovação financeira está desligada."
        : !approvalReady
          ? "A alçada está ativa, mas sem faixas configuradas."
          : "",
    },
    meta: { loaded },
  };
}

const VIEWS = {
  HOME: "home",
  NUTRITION: "nutrition",
  HERD: "herd",
  SUMMARY: "summary",
  COST_EVOLUTION: "cost_evolution",
  COST_DRIVERS: "cost_drivers",
};
const LS_FINANCE_NAV_HINT = "fazenda_nav_finance_open_v1";
const LS_FINANCE_SETTINGS_HINT = "fazenda_nav_finance_settings_v1";

function NavTabs({ active, onChange }) {
  const items = [
    { key: VIEWS.HOME, label: "Visão Geral" },
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

function SummaryContextView({
  mk,
  data,
  topCosts,
  titlesSummary,
  financeSetup,
  herdPending,
  onBack,
  onOpenFinance,
  onOpenAccounts,
  onOpenPeople,
  onOpenCostCenters,
  onOpenBankAccounts,
  onOpenPaymentMethods,
  onOpenApprovalPolicy,
  onOpenCostLaunch,
  onOpenRevenueLaunch,
  refresh,
  loading,
}) {
  const arrobas = Number(data?.arrobas ?? 0);
  const hasArrobas = Number.isFinite(arrobas) && arrobas > 0;
  const total = Number(data?.cost_total_brl ?? 0);
  const hasTotal = Number.isFinite(total) && total > 0;
  const pricePerArroba = Number(data?.price_per_arroba_brl ?? 0);
  const hasPrice = Number.isFinite(pricePerArroba) && pricePerArroba > 0;
  const financeLoaded = titlesSummary?.meta?.loaded !== false;
  const openReceivable = Number(titlesSummary?.receivable?.open_brl || 0);
  const openPayable = Number(titlesSummary?.payable?.open_brl || 0);
  const receivableOverdueCount = Number(titlesSummary?.receivable?.overdue_count || 0);
  const payableOverdueCount = Number(titlesSummary?.payable?.overdue_count || 0);
  const receivableOverdueBrl = Number(titlesSummary?.receivable?.overdue_brl || 0);
  const payableOverdueBrl = Number(titlesSummary?.payable?.overdue_brl || 0);
  const receivablePendingApprovalCount = Number(titlesSummary?.receivable?.pending_approval_count || 0);
  const payablePendingApprovalCount = Number(titlesSummary?.payable?.pending_approval_count || 0);
  const receivablePendingReconciliationCount = Number(titlesSummary?.receivable?.pending_reconciliation_count || 0);
  const payablePendingReconciliationCount = Number(titlesSummary?.payable?.pending_reconciliation_count || 0);
  const financeOpenBrl = openReceivable + openPayable;
  const overdueFinanceCount = receivableOverdueCount + payableOverdueCount;
  const overdueFinanceBrl = receivableOverdueBrl + payableOverdueBrl;
  const pendingApprovalCount = receivablePendingApprovalCount + payablePendingApprovalCount;
  const pendingReconciliationCount = receivablePendingReconciliationCount + payablePendingReconciliationCount;
  const pendingOperationalTotal = Number(herdPending?.counts?.operationalTotal || 0);
  const pendingVaccineCount = Number(herdPending?.counts?.overdueVaccine || 0);
  const hasTopCosts = Array.isArray(topCosts?.items) && topCosts.items.some((item) => Number(item?.value || 0) > 0);
  const financeSetupLoaded = financeSetup?.meta?.loaded !== false;
  const hasSupplier = !!financeSetup?.hasSupplier;
  const hasCustomer = !!financeSetup?.hasCustomer;
  const hasExpenseAccount = !!financeSetup?.hasExpenseAccount;
  const hasRevenueAccount = !!financeSetup?.hasRevenueAccount;
  const hasCostCenter = !!financeSetup?.hasCostCenter;
  const hasBankAccount = !!financeSetup?.hasBankAccount;
  const hasPaymentMethod = !!financeSetup?.hasPaymentMethod;
  const costCenterIssue = !hasCostCenter ? String(financeSetup?.costCenters?.issue || "Centro de custo ainda não está pronto.") : "";
  const bankAccountIssue = !hasBankAccount
    ? String(financeSetup?.bankAccounts?.issue || "Conta bancária ainda não está pronta para operar.")
    : "";
  const paymentMethodIssue = !hasPaymentMethod
    ? String(financeSetup?.paymentMethods?.issue || "Forma de pagamento ainda não está pronta para operar.")
    : "";
  const approvalReady = !!financeSetup?.approvalPolicy?.ready;
  const approvalIssue =
    pendingApprovalCount > 0 && !approvalReady
      ? String(financeSetup?.approvalPolicy?.issue || "A alçada de aprovação ainda não está pronta.")
      : "";
  const financeSetupActionNeeded =
    financeSetupLoaded &&
    (!hasSupplier ||
      !hasCustomer ||
      !hasExpenseAccount ||
      !hasRevenueAccount ||
      !hasCostCenter ||
      !hasBankAccount ||
      !hasPaymentMethod);
  const financeActionNeeded =
    !financeLoaded ||
    overdueFinanceCount > 0 ||
    pendingApprovalCount > 0 ||
    pendingReconciliationCount > 0 ||
    financeOpenBrl > 0;

  const summaryLines = useMemo(() => {
    const lines = Array.isArray(data?.summary_lines) && data.summary_lines.length ? [...data.summary_lines] : [];
    if (!hasArrobas) lines.push("Você não registrou @ produzida neste mês.");
    if (hasTotal) lines.push(`Custo total no mês: ${formatBRL(total)}.`);
    if (!hasTotal) lines.push("Sem custos registrados neste mês.");
    if (!financeLoaded) {
      lines.push("Resumo de títulos do mês indisponível. Confira o Financeiro antes de fechar a leitura.");
    } else if (financeOpenBrl > 0) {
      lines.push(`Há ${formatBRL(financeOpenBrl)} em títulos abertos no mês entre receber e pagar.`);
    } else {
      lines.push("Sem títulos em aberto no fechamento do mês.");
    }
    if (overdueFinanceCount > 0) {
      lines.push(`Existem ${formatNumber(overdueFinanceCount)} título(s) vencidos, somando ${formatBRL(overdueFinanceBrl)}.`);
    }
    if (pendingApprovalCount > 0) {
      lines.push(`Há ${formatNumber(pendingApprovalCount)} título(s) aguardando aprovação.`);
    }
    if (pendingReconciliationCount > 0) {
      lines.push(`Há ${formatNumber(pendingReconciliationCount)} título(s) aguardando conciliação bancária.`);
    }
    if (financeSetupLoaded && approvalIssue) {
      lines.push(approvalIssue);
    }
    if (financeSetupLoaded && !hasSupplier) {
      lines.push("Não existe fornecedor ativo cadastrado para lançar despesas.");
    }
    if (financeSetupLoaded && !hasCustomer) {
      lines.push("Não existe cliente ativo cadastrado para lançar receitas.");
    }
    if (financeSetupLoaded && !hasExpenseAccount) {
      lines.push("Não existe conta N4 de despesa ativa para lançar custos.");
    }
    if (financeSetupLoaded && !hasRevenueAccount) {
      lines.push("Não existe conta N4 de receita ativa para lançar faturamento.");
    }
    if (financeSetupLoaded && !hasCostCenter && costCenterIssue) {
      lines.push(costCenterIssue);
    }
    if (financeSetupLoaded && !hasBankAccount && bankAccountIssue) {
      lines.push(bankAccountIssue);
    }
    if (financeSetupLoaded && !hasPaymentMethod && paymentMethodIssue) {
      lines.push(paymentMethodIssue);
    }
    if (pendingOperationalTotal > 0) {
      lines.push(`O rebanho ainda tem ${formatNumber(pendingOperationalTotal)} pendência(s) operacional(is) para fechar o mês.`);
    }
    return Array.from(new Set(lines.filter(Boolean)));
  }, [
    data,
    financeLoaded,
    financeOpenBrl,
    hasArrobas,
    hasTotal,
    financeSetupLoaded,
    approvalIssue,
    approvalReady,
    hasCustomer,
    hasCostCenter,
    hasExpenseAccount,
    hasBankAccount,
    hasPaymentMethod,
    hasRevenueAccount,
    hasSupplier,
    bankAccountIssue,
    costCenterIssue,
    overdueFinanceBrl,
    overdueFinanceCount,
    pendingApprovalCount,
    pendingOperationalTotal,
    pendingReconciliationCount,
    paymentMethodIssue,
    total,
  ]);

  const checklist = useMemo(() => {
    const items = [];
    items.push({ ok: hasArrobas, text: "Registrar @ produzida (venda/abate)" });
    items.push({ ok: hasTotal, text: "Lançar custos do mês" });
    items.push({ ok: hasPrice, text: "Registrar preço médio de venda (R$/@)" });
    items.push({ ok: financeSetupLoaded && hasSupplier, text: "Ter fornecedor ativo para lançar despesas" });
    items.push({ ok: financeSetupLoaded && hasCustomer, text: "Ter cliente ativo para lançar receitas" });
    items.push({ ok: financeSetupLoaded && hasExpenseAccount, text: "Ter conta N4 de despesa ativa" });
    items.push({ ok: financeSetupLoaded && hasRevenueAccount, text: "Ter conta N4 de receita ativa" });
    items.push({ ok: financeSetupLoaded && hasCostCenter, text: "Ter centro de custo ativo para classificar despesas" });
    items.push({ ok: financeSetupLoaded && hasBankAccount, text: "Ter conta bancária pronta para caixa e conciliação" });
    items.push({ ok: financeSetupLoaded && hasPaymentMethod, text: "Ter forma de pagamento/recebimento pronta para uso" });
    items.push({ ok: financeLoaded && overdueFinanceCount === 0, text: "Zerar títulos vencidos do mês" });
    items.push({ ok: financeLoaded && pendingApprovalCount === 0, text: "Aprovar títulos pendentes" });
    if (pendingApprovalCount > 0) {
      items.push({ ok: financeSetupLoaded && approvalReady, text: "Ter alçada de aprovação configurada" });
    }
    items.push({ ok: financeLoaded && pendingReconciliationCount === 0, text: "Conciliar títulos pendentes" });
    items.push({ ok: pendingOperationalTotal === 0, text: "Resolver pendências operacionais do rebanho" });
    items.push({ ok: pendingVaccineCount === 0, text: "Fechar vacinas atrasadas do rebanho" });
    items.push({ ok: hasTopCosts, text: "Conferir categorias que mais puxaram o custo" });
    return items;
  }, [
    financeLoaded,
    financeSetupLoaded,
    approvalReady,
    hasArrobas,
    hasCustomer,
    hasCostCenter,
    hasExpenseAccount,
    hasBankAccount,
    hasPaymentMethod,
    hasPrice,
    hasRevenueAccount,
    hasSupplier,
    hasTopCosts,
    hasTotal,
    overdueFinanceCount,
    pendingApprovalCount,
    pendingOperationalTotal,
    pendingReconciliationCount,
    pendingVaccineCount,
  ]);

  const bullets = useMemo(() => {
    const nut = Number(topCosts?.items?.find((x) => x.key === "NUTRICAO")?.value ?? 0);
    const nutShare = hasTotal && total > 0 ? (nut / total) * 100 : null;

    const t1 = hasTotal ? `Custo total no mês: ${formatBRL(total)}.` : "Sem custo registrado.";
    const t2 = hasArrobas ? `R$/@ calculado automaticamente: ${formatBRLPerArroba(data?.cost_per_arroba_brl)}.` : "Registre @ produzida para calcular R$/@.";
    const t3 = nutShare != null ? `Nutrição está em ${nutShare.toFixed(1)}% do custo.` : "";
    const t4 = !financeLoaded
      ? "Os títulos do mês ainda não foram carregados. Valide o financeiro antes de confiar no fechamento."
      : financeOpenBrl > 0
        ? `O financeiro ainda carrega ${formatBRL(financeOpenBrl)} em aberto entre receber e pagar.`
        : "Não há títulos em aberto no mês.";
    const t5 =
      overdueFinanceCount > 0
        ? `Existem ${formatNumber(overdueFinanceCount)} título(s) vencidos, o que contamina a leitura de caixa.`
        : financeSetupLoaded && financeSetupActionNeeded
          ? "O cadastro financeiro ainda está incompleto ou mal configurado para operar sem retrabalho."
          : pendingOperationalTotal > 0
          ? `O rebanho ainda tem ${formatNumber(pendingOperationalTotal)} pendência(s) operacional(is) antes do fechamento.`
          : "Fechamento operacional e financeiro do mês está limpo.";

    return [t1, t2, t3, t4, t5, "Use a checklist abaixo para fechar o mês sem buraco de informação."].filter(Boolean);
  }, [
    data,
    financeLoaded,
    financeOpenBrl,
    financeSetupActionNeeded,
    financeSetupLoaded,
    hasArrobas,
    hasCustomer,
    hasCostCenter,
    hasExpenseAccount,
    hasTotal,
    hasBankAccount,
    hasPaymentMethod,
    hasRevenueAccount,
    hasSupplier,
    overdueFinanceCount,
    pendingOperationalTotal,
    topCosts,
    total,
  ]);

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

          {!hasTotal || !hasArrobas || !hasPrice || financeActionNeeded || financeSetupActionNeeded ? (
            <div className="pdOverview-actions" style={{ marginTop: 12 }}>
              {!hasTotal && hasSupplier && typeof onOpenCostLaunch === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenCostLaunch}>
                  Nova despesa
                </button>
              ) : null}
              {(!hasArrobas || !hasPrice) && hasCustomer && typeof onOpenRevenueLaunch === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenRevenueLaunch}>
                  Nova receita
                </button>
              ) : null}
              {financeSetupLoaded && (!hasSupplier || !hasCustomer) && typeof onOpenPeople === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenPeople}>
                  Pessoas e empresas
                </button>
              ) : null}
              {financeSetupLoaded && (!hasExpenseAccount || !hasRevenueAccount) && typeof onOpenAccounts === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenAccounts}>
                  Plano de contas
                </button>
              ) : null}
              {financeSetupLoaded && !hasCostCenter && typeof onOpenCostCenters === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenCostCenters}>
                  Centros de custo
                </button>
              ) : null}
              {financeSetupLoaded && !hasBankAccount && typeof onOpenBankAccounts === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenBankAccounts}>
                  Contas bancárias
                </button>
              ) : null}
              {financeSetupLoaded && !hasPaymentMethod && typeof onOpenPaymentMethods === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenPaymentMethods}>
                  Formas de pagamento
                </button>
              ) : null}
              {financeSetupLoaded && approvalIssue && typeof onOpenApprovalPolicy === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenApprovalPolicy}>
                  Alçada de aprovação
                </button>
              ) : null}
              {financeActionNeeded && typeof onOpenFinance === "function" ? (
                <button className="faz-btn sm" type="button" onClick={onOpenFinance}>
                  Abrir Financeiro
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProducerDashboard({ monthKey, onNavigate }) {
  const mk = monthKey || new Date().toISOString().slice(0, 7);

  const [view, setView] = useState(VIEWS.HOME);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [connOk, setConnOk] = useState(true);
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(() => readClassicOverviewFromLocal());
  const [herdPending, setHerdPending] = useState(() => readPendingSnapshotFromLocal());
  const [titlesSummary, setTitlesSummary] = useState(() => createEmptyTitlesSummary(false));
  const [financeSetup, setFinanceSetup] = useState(() => createEmptyFinanceSetup(false));

  const refresh = async () => {
    setLoading(true);
    setErr("");
    try {
      const stockFallback = readClassicOverviewFromLocal();
      const pendingFallback = readPendingSnapshotFromLocal();
      let inventoryBootstrapped = false;
      const [
        monthlyRes,
        herdRes,
        propertiesRes,
        pendingRes,
        inventoryRes,
        titlesRes,
        supplierRes,
        customerRes,
        expenseAccountRes,
        revenueAccountRes,
        costCenterRes,
        bankAccountRes,
        paymentMethodRes,
        approvalPolicyRes,
      ] = await Promise.allSettled([
        fetchJson(`/producer/monthly-summary?month=${encodeURIComponent(mk)}`),
        fetchJson("/herd/summary"),
        fetchJson("/setup/properties"),
        fetchPendingSnapshot({ limit: 5, staleDays: 60 }),
        fetchInventoryAlerts(2),
        postJson("/finance/close-month", { month: mk }),
        fetchJson("/people?role=supplier&include_inactive=false&limit=1"),
        fetchJson("/people?role=customer&include_inactive=false&limit=1"),
        fetchJson("/accounts?level=4&category=DESPESA&include_inactive=false&limit=1"),
        fetchJson("/accounts?level=4&category=RECEITA&include_inactive=false&limit=1"),
        fetchJson("/cost-centers?include_inactive=true&limit=200"),
        fetchJson("/bank-accounts?include_inactive=true&limit=200"),
        fetchJson("/payment-methods?include_inactive=true&limit=200"),
        fetchJson("/finance/approval-policy"),
      ]);

      if (monthlyRes.status === "fulfilled") {
        setData(monthlyRes.value || {});
      } else {
        setData((prev) => prev || {});
      }

      if (herdRes.status === "fulfilled") {
        const properties = propertiesRes.status === "fulfilled" ? propertiesRes.value : [];
        let stockSnapshot =
          inventoryRes.status === "fulfilled"
            ? inventoryRes.value || {}
            : { alerts: stockFallback.stockAlerts, total_items: 0 };
        if (
          Number(stockSnapshot?.total_items || 0) === 0 &&
          Array.isArray(stockFallback.stockAlerts) &&
          stockFallback.stockAlerts.length
        ) {
          try {
            inventoryBootstrapped = await bootstrapLegacyInventoryToBackend();
            if (inventoryBootstrapped) {
              stockSnapshot = await fetchInventoryAlerts(2);
            }
          } catch {
            // mantém fallback já calculado
          }
        }
        setOverview(buildClassicOverviewFromBackend(herdRes.value || {}, properties, stockSnapshot));
      } else {
        setOverview(stockFallback);
      }

      if (pendingRes.status === "fulfilled") setHerdPending(pendingRes.value || pendingFallback);
      else setHerdPending(pendingFallback);

      if (titlesRes.status === "fulfilled") {
        setTitlesSummary({
          payable: {
            open_brl: Number(titlesRes.value?.payable?.open_brl || 0),
            open_count: Number(titlesRes.value?.payable?.open_count || 0),
            overdue_brl: Number(titlesRes.value?.payable?.overdue_brl || 0),
            overdue_count: Number(titlesRes.value?.payable?.overdue_count || 0),
            pending_approval_brl: Number(titlesRes.value?.payable?.pending_approval_brl || 0),
            pending_approval_count: Number(titlesRes.value?.payable?.pending_approval_count || 0),
            pending_reconciliation_brl: Number(titlesRes.value?.payable?.pending_reconciliation_brl || 0),
            pending_reconciliation_count: Number(titlesRes.value?.payable?.pending_reconciliation_count || 0),
          },
          receivable: {
            open_brl: Number(titlesRes.value?.receivable?.open_brl || 0),
            open_count: Number(titlesRes.value?.receivable?.open_count || 0),
            overdue_brl: Number(titlesRes.value?.receivable?.overdue_brl || 0),
            overdue_count: Number(titlesRes.value?.receivable?.overdue_count || 0),
            pending_approval_brl: Number(titlesRes.value?.receivable?.pending_approval_brl || 0),
            pending_approval_count: Number(titlesRes.value?.receivable?.pending_approval_count || 0),
            pending_reconciliation_brl: Number(titlesRes.value?.receivable?.pending_reconciliation_brl || 0),
            pending_reconciliation_count: Number(titlesRes.value?.receivable?.pending_reconciliation_count || 0),
          },
          result: {
            net_open_brl: Number(titlesRes.value?.result?.net_open_brl || 0),
          },
          meta: { loaded: true },
        });
      } else {
        setTitlesSummary(createEmptyTitlesSummary(false));
      }

      const financeSetupLoaded = [
        supplierRes,
        customerRes,
        expenseAccountRes,
        revenueAccountRes,
        costCenterRes,
        bankAccountRes,
        paymentMethodRes,
        approvalPolicyRes,
      ].every((res) => res.status === "fulfilled");

      if (financeSetupLoaded) {
        setFinanceSetup(
          buildFinanceSetupSnapshot({
            suppliers: supplierRes.value,
            customers: customerRes.value,
            expenseAccounts: expenseAccountRes.value,
            revenueAccounts: revenueAccountRes.value,
            costCenters: costCenterRes.value,
            bankAccounts: bankAccountRes.value,
            paymentMethods: paymentMethodRes.value,
            approvalPolicy: approvalPolicyRes.value,
            loaded: true,
          })
        );
      } else {
        setFinanceSetup(createEmptyFinanceSetup(false));
      }

      const monthlyOk = monthlyRes.status === "fulfilled";
      const herdOk = herdRes.status === "fulfilled";
      setConnOk(monthlyOk && herdOk);

      if (!monthlyOk || !herdOk) {
        const msgs = [];
        if (!monthlyOk) msgs.push(String(monthlyRes.reason?.message || monthlyRes.reason || "falha no resumo do produtor"));
        if (!herdOk) msgs.push(String(herdRes.reason?.message || herdRes.reason || "falha no resumo do rebanho"));
        if (inventoryRes.status !== "fulfilled" && !inventoryBootstrapped) {
          msgs.push(String(inventoryRes.reason?.message || inventoryRes.reason || "falha no inventário"));
        }
        setErr(msgs.join(" | "));
      }
    } catch (e) {
      const msg = String(e?.message || e);
      setErr(msg);
      setConnOk(false);
      setData((prev) => prev || {});
      setOverview(readClassicOverviewFromLocal());
      setTitlesSummary(createEmptyTitlesSummary(false));
      setFinanceSetup(createEmptyFinanceSetup(false));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mk]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onInventory = () => {
      void refresh();
    };
    window.addEventListener("fazenda_inventory_updated", onInventory);
    return () => window.removeEventListener("fazenda_inventory_updated", onInventory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const overviewData = useMemo(() => {
    const fallback = readClassicOverviewFromLocal();
    const base = overview || fallback;
    const inventoryTotalItems = Number(base?.inventoryTotalItems ?? -1);
    const useFallbackStock = inventoryTotalItems < 0 || (inventoryTotalItems === 0 && fallback.stockAlerts.length > 0);
    return {
      ...fallback,
      ...base,
      stockAlerts: useFallbackStock
        ? fallback.stockAlerts
        : Array.isArray(base?.stockAlerts)
          ? base.stockAlerts
          : [],
    };
  }, [overview, data, view, loading]);
  const revenueTotal = Number(data?.revenue_total_brl ?? 0);
  const balanceTotal = revenueTotal - costTotal;
  const topExpenseGroups = useMemo(
    () =>
      (topCosts?.items || [])
        .map((it) => ({ ...it, value: Number(it?.value || 0) }))
        .filter((it) => it.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
    [topCosts]
  );
  const topExpenseMax = Number(topExpenseGroups?.[0]?.value || 0);
  const openReceivable = Number(titlesSummary?.receivable?.open_brl || 0);
  const openPayable = Number(titlesSummary?.payable?.open_brl || 0);
  const openReceivableCount = Number(titlesSummary?.receivable?.open_count || 0);
  const openPayableCount = Number(titlesSummary?.payable?.open_count || 0);
  const receivableOverdueCount = Number(titlesSummary?.receivable?.overdue_count || 0);
  const receivableOverdueBrl = Number(titlesSummary?.receivable?.overdue_brl || 0);
  const payableOverdueCount = Number(titlesSummary?.payable?.overdue_count || 0);
  const payableOverdueBrl = Number(titlesSummary?.payable?.overdue_brl || 0);
  const receivablePendingApprovalCount = Number(titlesSummary?.receivable?.pending_approval_count || 0);
  const payablePendingApprovalCount = Number(titlesSummary?.payable?.pending_approval_count || 0);
  const receivablePendingReconciliationCount = Number(titlesSummary?.receivable?.pending_reconciliation_count || 0);
  const payablePendingReconciliationCount = Number(titlesSummary?.payable?.pending_reconciliation_count || 0);
  const financeTitlesLoaded = titlesSummary?.meta?.loaded !== false;
  const financeSetupLoaded = financeSetup?.meta?.loaded !== false;
  const financeHasSupplier = !!financeSetup?.hasSupplier;
  const financeHasCustomer = !!financeSetup?.hasCustomer;
  const financeHasExpenseAccount = !!financeSetup?.hasExpenseAccount;
  const financeHasRevenueAccount = !!financeSetup?.hasRevenueAccount;
  const financeHasCostCenter = !!financeSetup?.hasCostCenter;
  const financeHasBankAccount = !!financeSetup?.hasBankAccount;
  const financeHasPaymentMethod = !!financeSetup?.hasPaymentMethod;
  const financeCostCenterIssue = !financeHasCostCenter
    ? String(financeSetup?.costCenters?.issue || "Centro de custo ainda não está pronto.")
    : "";
  const financeBankAccountIssue = !financeHasBankAccount
    ? String(financeSetup?.bankAccounts?.issue || "Conta bancária ainda não está pronta.")
    : "";
  const financePaymentMethodIssue = !financeHasPaymentMethod
    ? String(financeSetup?.paymentMethods?.issue || "Forma de pagamento ainda não está pronta.")
    : "";
  const financeApprovalReady = !!financeSetup?.approvalPolicy?.ready;
  const financeApprovalIssue =
    pendingApprovalCount > 0 && !financeApprovalReady
      ? String(financeSetup?.approvalPolicy?.issue || "A alçada de aprovação ainda não está pronta.")
      : "";

  const openHerd = (hint) => {
    try {
      localStorage.setItem("fazenda_nav_herd_open_v1", JSON.stringify(hint || { tab: "operate" }));
      window.dispatchEvent(new Event("fazenda_nav_herd_open_v1"));
    } catch {}

    if (typeof onNavigate === "function") onNavigate("herd");
    else setView(VIEWS.HERD);
  };

  const openAreas = () => {
    if (typeof onNavigate === "function") onNavigate("areas");
  };

  const defaultFinanceHint = useMemo(() => {
    if (payablePendingApprovalCount > 0 || receivablePendingApprovalCount > 0) {
      return payablePendingApprovalCount >= receivablePendingApprovalCount
        ? { screen: "analise_pagamentos", payStatus: "Pendente aprovação", payFocus: "approval", monthKey: mk }
        : { screen: "analise_recebimentos", recvStatus: "Pendente aprovação", recvFocus: "approval", monthKey: mk };
    }
    if (payableOverdueCount > 0 || receivableOverdueCount > 0) {
      return payableOverdueCount >= receivableOverdueCount
        ? { screen: "analise_pagamentos", payStatus: "Vencido", monthKey: mk }
        : { screen: "analise_recebimentos", recvStatus: "Vencido", monthKey: mk };
    }
    if (payablePendingReconciliationCount > 0 || receivablePendingReconciliationCount > 0) {
      return payablePendingReconciliationCount >= receivablePendingReconciliationCount
        ? { screen: "analise_pagamentos", payStatus: "Pago", payFocus: "reconciliation", monthKey: mk }
        : { screen: "analise_recebimentos", recvStatus: "Recebido", recvFocus: "reconciliation", monthKey: mk };
    }
    if (openPayableCount > 0 || openReceivableCount > 0) {
      return openPayableCount >= openReceivableCount
        ? { screen: "analise_pagamentos", payStatus: "Em aberto", monthKey: mk }
        : { screen: "analise_recebimentos", recvStatus: "Em aberto", monthKey: mk };
    }
    return { screen: "fluxo_caixa", monthKey: mk };
  }, [
    mk,
    openPayableCount,
    openReceivableCount,
    payableOverdueCount,
    payablePendingApprovalCount,
    payablePendingReconciliationCount,
    receivableOverdueCount,
    receivablePendingApprovalCount,
    receivablePendingReconciliationCount,
  ]);

  const payableFinanceHint = useMemo(() => {
    if (payablePendingApprovalCount > 0) return { screen: "analise_pagamentos", payStatus: "Pendente aprovação", payFocus: "approval", monthKey: mk };
    if (payableOverdueCount > 0) return { screen: "analise_pagamentos", payStatus: "Vencido", monthKey: mk };
    if (payablePendingReconciliationCount > 0) return { screen: "analise_pagamentos", payStatus: "Pago", payFocus: "reconciliation", monthKey: mk };
    if (openPayableCount > 0) return { screen: "analise_pagamentos", payStatus: "Em aberto", monthKey: mk };
    return { screen: "analise_pagamentos", monthKey: mk };
  }, [mk, openPayableCount, payableOverdueCount, payablePendingApprovalCount, payablePendingReconciliationCount]);

  const receivableFinanceHint = useMemo(() => {
    if (receivablePendingApprovalCount > 0) return { screen: "analise_recebimentos", recvStatus: "Pendente aprovação", recvFocus: "approval", monthKey: mk };
    if (receivableOverdueCount > 0) return { screen: "analise_recebimentos", recvStatus: "Vencido", monthKey: mk };
    if (receivablePendingReconciliationCount > 0) return { screen: "analise_recebimentos", recvStatus: "Recebido", recvFocus: "reconciliation", monthKey: mk };
    if (openReceivableCount > 0) return { screen: "analise_recebimentos", recvStatus: "Em aberto", monthKey: mk };
    return { screen: "analise_recebimentos", monthKey: mk };
  }, [mk, openReceivableCount, receivableOverdueCount, receivablePendingApprovalCount, receivablePendingReconciliationCount]);

  const approvalFinanceHint = useMemo(() => {
    if (payablePendingApprovalCount >= receivablePendingApprovalCount) return payableFinanceHint;
    return receivableFinanceHint;
  }, [payableFinanceHint, payablePendingApprovalCount, receivableFinanceHint, receivablePendingApprovalCount]);

  const reconciliationFinanceHint = useMemo(() => {
    if (payablePendingReconciliationCount >= receivablePendingReconciliationCount) {
      return { screen: "analise_pagamentos", payStatus: "Pago", payFocus: "reconciliation", monthKey: mk };
    }
    return { screen: "analise_recebimentos", recvStatus: "Recebido", recvFocus: "reconciliation", monthKey: mk };
  }, [mk, payablePendingReconciliationCount, receivablePendingReconciliationCount]);

  const launchCostFinanceHint = useMemo(
    () => ({ screen: "lancamentos", lancamentosSubtab: "lancamentos", finTab: "despesa", monthKey: mk }),
    [mk]
  );

  const launchRevenueFinanceHint = useMemo(
    () => ({ screen: "lancamentos", lancamentosSubtab: "lancamentos", finTab: "receita", monthKey: mk }),
    [mk]
  );

  const financePeopleHint = useMemo(
    () => ({ screen: "lancamentos", lancamentosSubtab: "pessoas_empresas", monthKey: mk }),
    [mk]
  );

  const financeAccountsHint = useMemo(() => {
    if (!financeHasExpenseAccount && financeHasRevenueAccount) {
      return { showAccountsPanel: true, accCategory: "DESPESA", accLevel: "4", focusSection: "accounts" };
    }
    if (!financeHasRevenueAccount && financeHasExpenseAccount) {
      return { showAccountsPanel: true, accCategory: "RECEITA", accLevel: "4", focusSection: "accounts" };
    }
    return { showAccountsPanel: true, accCategory: "ALL", accLevel: "4", focusSection: "accounts" };
  }, [financeHasExpenseAccount, financeHasRevenueAccount]);

  const financeCostCenterHint = useMemo(
    () => ({ showAccountsPanel: false, peopleTab: "cadastro", focusSection: "cost_centers" }),
    []
  );
  const financeBankAccountHint = useMemo(
    () => ({ showAccountsPanel: false, peopleTab: "cadastro", focusSection: "bank_accounts" }),
    []
  );
  const financePaymentMethodHint = useMemo(
    () => ({ showAccountsPanel: false, peopleTab: "cadastro", focusSection: "payment_methods" }),
    []
  );
  const financeApprovalPolicyHint = useMemo(
    () => ({ showAccountsPanel: false, peopleTab: "cadastro", focusSection: "approval_policy" }),
    []
  );

  const openFinance = (hint) => {
    const payload = hint && typeof hint === "object" ? { ...defaultFinanceHint, ...hint } : defaultFinanceHint;
    try {
      localStorage.setItem(LS_FINANCE_NAV_HINT, JSON.stringify(payload));
      window.dispatchEvent(new Event(LS_FINANCE_NAV_HINT));
    } catch {}
    if (typeof onNavigate === "function") onNavigate("finance");
  };

  const openFinanceSettings = (hint) => {
    const payload =
      hint && typeof hint === "object"
        ? { showAccountsPanel: false, peopleTab: "cadastro", ...hint }
        : { showAccountsPanel: false, peopleTab: "cadastro" };
    try {
      localStorage.setItem(LS_FINANCE_SETTINGS_HINT, JSON.stringify(payload));
      window.dispatchEvent(new Event(LS_FINANCE_SETTINGS_HINT));
    } catch {}
    if (typeof onNavigate === "function") onNavigate("settings");
  };

  const malePct = overviewData.activeHeads > 0 ? (overviewData.male / overviewData.activeHeads) * 100 : 0;
  const femalePct = overviewData.activeHeads > 0 ? (overviewData.female / overviewData.activeHeads) * 100 : 0;
  const financeAlerts = Array.isArray(data?.alerts) ? data.alerts.slice(0, 5) : [];
  const herdArrobas = Number(overviewData.totalArrobas || 0);
  const hasHerdArrobas = Number.isFinite(herdArrobas) && herdArrobas > 0;
  const healthSummary = overviewData.healthSummary || {
    pregCount: 0,
    emptyCount: 0,
    ndPregCount: 0,
    overdueVaccineCount: 0,
    noVaccineScheduleCount: 0,
    recentHealthEventsMonth: 0,
    recentReproEventsMonth: 0,
  };
  const pendingCounts = herdPending?.counts || {
    operationalTotal: 0,
    suspectWeighs: 0,
    noWeigh: 0,
    staleWeigh: 0,
    overdueVaccine: 0,
  };
  const releaseNotes = [
    `Dashboard atualizado em ${new Date().toLocaleDateString("pt-BR")}`,
    "Leitura consolidada de fazenda, rebanho e financeiro em um único painel.",
    "Fluxo de decisão rápida: custos, alertas e prioridades do mês.",
  ];
  const totalOverdueCount = receivableOverdueCount + payableOverdueCount;
  const totalApprovalPendingCount = receivablePendingApprovalCount + payablePendingApprovalCount;
  const totalReconciliationPendingCount = receivablePendingReconciliationCount + payablePendingReconciliationCount;
  const heroStatusTone =
    balanceTotal < 0 || totalOverdueCount > 0
      ? "is-warn"
      : totalApprovalPendingCount > 0 || totalReconciliationPendingCount > 0
      ? "is-attention"
      : "is-ok";
  const heroStatusTitle =
    balanceTotal < 0
      ? "Mês pressionado pelo custo"
      : totalOverdueCount > 0
      ? "Existem pendências vencidas"
      : totalApprovalPendingCount > 0 || totalReconciliationPendingCount > 0
      ? "Mês exige conferência financeira"
      : "Mês sob controle";
  const heroStatusText =
    balanceTotal < 0
      ? `O balanço está em ${formatBRL(balanceTotal)}. O foco imediato é reduzir o peso de ${topExpenseGroups[0]?.label || "custos operacionais"} e revisar o caixa.`
      : totalOverdueCount > 0
      ? `Há ${formatNumber(totalOverdueCount)} título(s) vencido(s) entre pagar e receber. Vale atacar essa fila antes do fechamento do mês.`
      : totalApprovalPendingCount > 0 || totalReconciliationPendingCount > 0
      ? `Existem ${formatNumber(totalApprovalPendingCount)} pendência(s) de aprovação e ${formatNumber(totalReconciliationPendingCount)} de conciliação.`
      : "Receitas, despesas e operação estão sem alerta crítico. O momento é de acompanhar produtividade e consolidar fechamento.";
  const heroFocusPills = [
    {
      label: "Maior custo",
      value: topExpenseGroups[0] ? `${topExpenseGroups[0].label} • ${formatBRL(topExpenseGroups[0].value)}` : "Sem despesa relevante",
      tone: balanceTotal < 0 ? "is-warn" : "",
    },
    {
      label: "Pendências",
      value: `${formatNumber(pendingCounts.operationalTotal)} operacionais`,
      tone: pendingCounts.operationalTotal > 0 ? "is-warn" : "is-ok",
    },
    {
      label: "Financeiro",
      value: `${formatNumber(totalOverdueCount)} vencidos • ${formatNumber(totalApprovalPendingCount)} aprovação`,
      tone: totalOverdueCount > 0 || totalApprovalPendingCount > 0 ? "is-warn" : "is-ok",
    },
  ];

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
              titlesSummary={titlesSummary}
              financeSetup={financeSetup}
              herdPending={herdPending}
              onBack={() => setView(VIEWS.HOME)}
              onOpenAccounts={() => openFinanceSettings(financeAccountsHint)}
              onOpenPeople={() => openFinance(financePeopleHint)}
              onOpenCostCenters={() => openFinanceSettings(financeCostCenterHint)}
              onOpenBankAccounts={() => openFinanceSettings(financeBankAccountHint)}
              onOpenPaymentMethods={() => openFinanceSettings(financePaymentMethodHint)}
              onOpenApprovalPolicy={() => openFinanceSettings(financeApprovalPolicyHint)}
              onOpenCostLaunch={() => openFinance(launchCostFinanceHint)}
              onOpenRevenueLaunch={() => openFinance(launchRevenueFinanceHint)}
              onOpenFinance={openFinance}
              refresh={refresh}
              loading={loading}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="pdOverview-topline">
            <span className="pd-pill">Propriedades</span>
            <span className="pd-pill">{monthLabel(mk)}</span>
            {!connOk ? <span className="pd-pill">Offline</span> : null}
          </div>

          <section className={`pdOverview-hero ${heroStatusTone}`}>
            <div className="pdOverview-heroMain">
              <div className="pdOverview-heroLead">
                <div className="pdOverview-kicker">Visão executiva</div>
                <h2>Painel geral da operação</h2>
                <p className="pdOverview-heroText">{heroStatusText}</p>

                <div className={`pdOverview-heroStatus ${heroStatusTone}`}>
                  <strong>{heroStatusTitle}</strong>
                  <span>
                    {formatNumber(totalOverdueCount)} vencidos • {formatNumber(totalApprovalPendingCount)} aguardando aprovação •{" "}
                    {formatNumber(totalReconciliationPendingCount)} aguardando conciliação
                  </span>
                </div>

                <div className="pdOverview-heroFocus">
                  {heroFocusPills.map((pill) => (
                    <article key={pill.label} className={`pdOverview-heroFocusItem ${pill.tone || ""}`}>
                      <span>{pill.label}</span>
                      <b>{pill.value}</b>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="pdOverview-heroAside">
                <div className="pdOverview-heroActions">
                  <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_EVOLUTION)}>Ver evolução</button>
                  <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.SUMMARY)}>Resumo detalhado</button>
                </div>

                <div className="pdOverview-heroMetricGrid">
                  <article className="pdOverview-heroMetric">
                    <span>Receita</span>
                    <strong className="is-pos">{formatBRL(revenueTotal)}</strong>
                  </article>
                  <article className="pdOverview-heroMetric">
                    <span>Despesa</span>
                    <strong className="is-neg">{formatBRL(costTotal)}</strong>
                  </article>
                  <article className="pdOverview-heroMetric">
                    <span>Balanço</span>
                    <strong className={balanceTotal >= 0 ? "is-pos" : "is-neg"}>{formatBRL(balanceTotal)}</strong>
                  </article>
                  <article className="pdOverview-heroMetric">
                    <span>Efetivo ativo</span>
                    <strong>{formatNumber(overviewData.activeHeads)} cab</strong>
                  </article>
                </div>
              </aside>
            </div>

            <div className="pdOverview-heroStrip">
              <article className="pdOverview-heroStripItem">
                <span>Custo (R$/@)</span>
                <b>{formatBRLPerArroba(data?.cost_per_arroba_brl)}</b>
              </article>
              <article className="pdOverview-heroStripItem">
                <span>Arrobas estimadas</span>
                <b>{hasHerdArrobas ? `${formatNumber(herdArrobas)} @` : "0 @"}</b>
              </article>
              <article className="pdOverview-heroStripItem">
                <span>Pendências operacionais</span>
                <b>{formatNumber(pendingCounts.operationalTotal)}</b>
              </article>
            </div>
          </section>

          <div className="pdOverview-grid">
            <section className="pdOverview-card">
              <div className="pdOverview-head">
                <h3>Operação da Fazenda</h3>
                <span className="pdOverview-tag">Rebanho</span>
              </div>

              <div className="pdOverview-miniGrid">
                <div><span>Propriedades</span><b>{formatNumber(overviewData.propertyCount)}</b></div>
                <div><span>Áreas</span><b>{formatNumber(overviewData.areaCount)}</b></div>
                <div><span>Lotes</span><b>{formatNumber(overviewData.lotCount)}</b></div>
                <div><span>Animais</span><b>{formatNumber(overviewData.activeHeads)}</b></div>
              </div>

              <div className="pdOverview-sexBars">
                <div className="pdOverview-sexRow">
                  <span>Machos</span>
                  <b>{formatNumber(overviewData.male)}</b>
                </div>
                <div className="pdOverview-track"><i style={{ width: `${Math.max(0, Math.min(100, malePct))}%` }} /></div>

                <div className="pdOverview-sexRow">
                  <span>Fêmeas</span>
                  <b>{formatNumber(overviewData.female)}</b>
                </div>
                <div className="pdOverview-track is-female"><i style={{ width: `${Math.max(0, Math.min(100, femalePct))}%` }} /></div>
              </div>

              <div className="pdOverview-subtitle">Principais categorias</div>
              <div className="pdOverview-chipList">
                {overviewData.topCategories.map((c) => (
                  <div key={c.label} className="pdOverview-chip">
                    <span>{c.label}</span>
                    <b>
                      {formatNumber(c.value)} <small>{c.pct.toFixed(0)}%</small>
                    </b>
                  </div>
                ))}
                {!overviewData.topCategories.length ? <div className="pdOverview-empty">Sem categorias no rebanho.</div> : null}
              </div>

              <div className="pdOverview-subtitle">Pendências operacionais</div>
              <div className="pdOverview-chipList">
                <div className="pdOverview-chip">
                  <span>Total</span>
                  <b>{formatNumber(pendingCounts.operationalTotal)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>Pesos suspeitos</span>
                  <b>{formatNumber(pendingCounts.suspectWeighs)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>60+ dias</span>
                  <b>{formatNumber(pendingCounts.staleWeigh)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>Vacina atrasada</span>
                  <b>{formatNumber(pendingCounts.overdueVaccine)}</b>
                </div>
              </div>

              <div className="pdOverview-subtitle">Reprodução e sanidade</div>
              <div className="pdOverview-chipList">
                <div className="pdOverview-chip">
                  <span>Prenhas</span>
                  <b>{formatNumber(healthSummary.pregCount)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>Vazias</span>
                  <b>{formatNumber(healthSummary.emptyCount)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>Sem agenda sanitária</span>
                  <b>{formatNumber(healthSummary.noVaccineScheduleCount)}</b>
                </div>
                <div className="pdOverview-chip">
                  <span>Manejo sanitário no mês</span>
                  <b>{formatNumber(healthSummary.recentHealthEventsMonth)}</b>
                </div>
              </div>

              <div className="pdOverview-actions">
                <button className="faz-btn sm" type="button" onClick={openAreas}>Abrir Áreas</button>
                <button className="faz-btn sm" type="button" onClick={() => openHerd({ tab: "lots" })}>Abrir Lotes</button>
                <button className="faz-btn sm" type="button" onClick={() => openHerd({ action: "pending", pendingFocus: "ALL" })}>Pendências</button>
                <button className="faz-btn sm" type="button" onClick={() => openHerd({ action: "pending", pendingFocus: "VACCINE" })}>Vacinas</button>
              </div>
            </section>

            <section className="pdOverview-card">
              <div className="pdOverview-head">
                <h3>Financeiro do Mês</h3>
                <span className="pdOverview-tag">Resultados</span>
              </div>

              <div className="pdOverview-finGrid">
                <article className="pdOverview-finItem">
                  <span>Receitas</span>
                  <b className="is-pos">{formatBRL(revenueTotal)}</b>
                </article>
                <article className="pdOverview-finItem">
                  <span>Despesas</span>
                  <b className="is-neg">{formatBRL(costTotal)}</b>
                </article>
                <article className="pdOverview-finItem pdOverview-finItem--full">
                  <span>Balanço</span>
                  <b className={balanceTotal >= 0 ? "is-pos" : "is-neg"}>{formatBRL(balanceTotal)}</b>
                </article>
                <article className="pdOverview-finItem">
                  <span>A Receber</span>
                  <b>{formatBRL(openReceivable)}</b>
                </article>
                <article className="pdOverview-finItem">
                  <span>A Pagar</span>
                  <b>{formatBRL(openPayable)}</b>
                </article>
              </div>

              <div className="pdOverview-subtitle">Categorias que puxaram custo</div>
              <div className="pdOverview-costList">
                {topExpenseGroups.map((it) => (
                  <div key={it.key} className="pdOverview-costRow">
                    <div className="pdOverview-costMain">
                      <span>{it.label}</span>
                      <b>{formatBRL(it.value)}</b>
                    </div>
                    <div className="pdOverview-costTrack">
                      <i style={{ width: `${Math.max(8, Math.min(100, topExpenseMax > 0 ? (it.value / topExpenseMax) * 100 : 0))}%` }} />
                    </div>
                  </div>
                ))}
                {!topExpenseGroups.length ? <div className="pdOverview-empty">Sem despesas lançadas no período.</div> : null}
              </div>

              <div className="pdOverview-actions">
                <button className="faz-btn sm" type="button" onClick={() => openFinance(launchCostFinanceHint)}>Nova despesa</button>
                <button className="faz-btn sm" type="button" onClick={() => openFinance(launchRevenueFinanceHint)}>Nova receita</button>
                <button className="faz-btn sm" type="button" onClick={() => openFinance(payableFinanceHint)}>A pagar</button>
                <button className="faz-btn sm" type="button" onClick={() => openFinance(receivableFinanceHint)}>A receber</button>
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_DRIVERS)}>Puxou custo</button>
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_EVOLUTION)}>Evolução</button>
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.SUMMARY)}>Resumo</button>
              </div>
            </section>

            <section className="pdOverview-card">
              <div className="pdOverview-head">
                <h3>Alertas de Estoque</h3>
                <span className="pdOverview-tag">Prioridade</span>
              </div>
              <div className="pdOverview-alerts">
                {overviewData.stockAlerts.map((a, idx) => (
                  <div key={`${a.section}_${a.name}_${idx}`} className="pdOverview-alert">
                    <div className="pdOverview-alertTop">
                      <span>{a.section}</span>
                      <b>{a.qty} {a.unit}</b>
                    </div>
                    <div className="pdOverview-alertName">{a.name}</div>
                    <div className="pdOverview-alertMeta">{a.local}</div>
                  </div>
                ))}
                {!overviewData.stockAlerts.length ? <div className="pdOverview-empty">Sem alerta de estoque no momento.</div> : null}
              </div>
            </section>

            <section className="pdOverview-card">
              <div className="pdOverview-head">
                <h3>Alertas Financeiros</h3>
                <span className="pdOverview-tag">Risco</span>
              </div>

              <div className="pdOverview-list">
                {openReceivableCount > 0 ? (
                  <div className="pdOverview-line">Há <b>{formatNumber(openReceivableCount)}</b> título(s) a receber em aberto, somando <b>{formatBRL(openReceivable)}</b>.</div>
                ) : null}
                {openPayableCount > 0 ? (
                  <div className="pdOverview-line">Há <b>{formatNumber(openPayableCount)}</b> título(s) a pagar em aberto, somando <b>{formatBRL(openPayable)}</b>.</div>
                ) : null}
                {receivableOverdueCount > 0 ? (
                  <div className="pdOverview-line">Recebimentos vencidos: <b>{formatNumber(receivableOverdueCount)}</b> título(s), total de <b>{formatBRL(receivableOverdueBrl)}</b>.</div>
                ) : null}
                {payableOverdueCount > 0 ? (
                  <div className="pdOverview-line">Pagamentos vencidos: <b>{formatNumber(payableOverdueCount)}</b> título(s), total de <b>{formatBRL(payableOverdueBrl)}</b>.</div>
                ) : null}
                {receivablePendingApprovalCount > 0 || payablePendingApprovalCount > 0 ? (
                  <div className="pdOverview-line">Há <b>{formatNumber(receivablePendingApprovalCount + payablePendingApprovalCount)}</b> título(s) aguardando aprovação financeira.</div>
                ) : null}
                {financeSetupLoaded && financeApprovalIssue ? (
                  <div className="pdOverview-line">{financeApprovalIssue}</div>
                ) : null}
                {receivablePendingReconciliationCount > 0 || payablePendingReconciliationCount > 0 ? (
                  <div className="pdOverview-line">Há <b>{formatNumber(receivablePendingReconciliationCount + payablePendingReconciliationCount)}</b> título(s) aguardando conciliação bancária.</div>
                ) : null}
                {financeSetupLoaded && !financeHasSupplier ? (
                  <div className="pdOverview-line">Falta fornecedor ativo para lançar despesa no financeiro.</div>
                ) : null}
                {financeSetupLoaded && !financeHasCustomer ? (
                  <div className="pdOverview-line">Falta cliente ativo para lançar receita no financeiro.</div>
                ) : null}
                {financeSetupLoaded && !financeHasExpenseAccount ? (
                  <div className="pdOverview-line">Falta conta N4 de despesa ativa no plano de contas.</div>
                ) : null}
                {financeSetupLoaded && !financeHasRevenueAccount ? (
                  <div className="pdOverview-line">Falta conta N4 de receita ativa no plano de contas.</div>
                ) : null}
                {financeSetupLoaded && !financeHasCostCenter ? (
                  <div className="pdOverview-line">{financeCostCenterIssue}</div>
                ) : null}
                {financeSetupLoaded && !financeHasBankAccount ? (
                  <div className="pdOverview-line">{financeBankAccountIssue}</div>
                ) : null}
                {financeSetupLoaded && !financeHasPaymentMethod ? (
                  <div className="pdOverview-line">{financePaymentMethodIssue}</div>
                ) : null}
                {!financeTitlesLoaded ? (
                  <div className="pdOverview-line">Resumo de títulos indisponível. Valide o módulo Financeiro antes de fechar o mês.</div>
                ) : null}
                {financeAlerts.map((a, idx) => (
                  <div key={`alert_${idx}`} className="pdOverview-line">
                    {String(a?.text || a || "")}
                  </div>
                ))}
                {!financeAlerts.length &&
                openReceivableCount <= 0 &&
                openPayableCount <= 0 &&
                receivableOverdueCount <= 0 &&
                payableOverdueCount <= 0 &&
                receivablePendingApprovalCount <= 0 &&
                payablePendingApprovalCount <= 0 &&
                receivablePendingReconciliationCount <= 0 &&
                payablePendingReconciliationCount <= 0 &&
                financeTitlesLoaded &&
                balanceTotal < 0 ? (
                  <div className="pdOverview-line">Balanço negativo no mês. Revisar top custos e fluxo de caixa.</div>
                ) : null}
                {!financeAlerts.length &&
                openReceivableCount <= 0 &&
                openPayableCount <= 0 &&
                receivableOverdueCount <= 0 &&
                payableOverdueCount <= 0 &&
                receivablePendingApprovalCount <= 0 &&
                payablePendingApprovalCount <= 0 &&
                receivablePendingReconciliationCount <= 0 &&
                payablePendingReconciliationCount <= 0 &&
                financeTitlesLoaded &&
                balanceTotal >= 0 ? (
                  <div className="pdOverview-empty">Sem alerta financeiro crítico no período.</div>
                ) : null}
              </div>

              <div className="pdOverview-subtitle">Atualizações do sistema</div>
              <div className="pdOverview-list">
                {releaseNotes.map((line, idx) => (
                  <div key={`release_${idx}`} className="pdOverview-line">{line}</div>
                ))}
              </div>

              <div className="pdOverview-actions">
                <button className="faz-btn sm" type="button" onClick={() => openFinance(defaultFinanceHint)}>Abrir Financeiro</button>
                {financeSetupLoaded && (!financeHasSupplier || !financeHasCustomer) ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinance(financePeopleHint)}>Pessoas e empresas</button>
                ) : null}
                {financeSetupLoaded && (!financeHasExpenseAccount || !financeHasRevenueAccount) ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinanceSettings(financeAccountsHint)}>Plano de contas</button>
                ) : null}
                {financeSetupLoaded && !financeHasCostCenter ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinanceSettings(financeCostCenterHint)}>Centros de custo</button>
                ) : null}
                {financeSetupLoaded && !financeHasBankAccount ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinanceSettings(financeBankAccountHint)}>Contas bancárias</button>
                ) : null}
                {financeSetupLoaded && !financeHasPaymentMethod ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinanceSettings(financePaymentMethodHint)}>Pagamentos</button>
                ) : null}
                {financeSetupLoaded && financeApprovalIssue ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinanceSettings(financeApprovalPolicyHint)}>Alçada</button>
                ) : null}
                {receivablePendingApprovalCount > 0 || payablePendingApprovalCount > 0 ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinance(approvalFinanceHint)}>Aprovação</button>
                ) : null}
                {receivablePendingReconciliationCount > 0 || payablePendingReconciliationCount > 0 ? (
                  <button className="faz-btn sm" type="button" onClick={() => openFinance(reconciliationFinanceHint)}>Conciliação</button>
                ) : null}
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.NUTRITION)}>Nutrição</button>
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.HERD)}>Gado rápido</button>
              </div>
            </section>

            <section className="pdOverview-card pdOverview-card--wide">
              <div className="pdOverview-head">
                <h3>Leitura rápida para decisão</h3>
                <span className="pdOverview-tag">Resumo executivo</span>
              </div>

              <div className="pdOverview-summary">
                <div className="pdOverview-summaryItem">
                  <span>R$/@ do período</span>
                  <b>{formatBRLPerArroba(data?.cost_per_arroba_brl)}</b>
                </div>
                <div className="pdOverview-summaryItem">
                  <span>Preço médio (@)</span>
                  <b>{formatBRLPerArroba(data?.price_per_arroba_brl)}</b>
                </div>
                <div className="pdOverview-summaryItem">
                  <span>Resultado do mês</span>
                  <b className={balanceTotal >= 0 ? "is-pos" : "is-neg"}>{formatBRL(balanceTotal)}</b>
                </div>
              </div>

              <div className="pdOverview-list">
                {balanceTotal < 0 ? (
                  <div className="pdOverview-line is-neg">Balanço negativo no mês. Prioridade: reduzir categorias de maior peso e revisar fluxo.</div>
                ) : (
                  <div className="pdOverview-line is-pos">Balanço positivo. Próximo passo: consolidar ganhos e acompanhar evolução de custo.</div>
                )}
                {topExpenseGroups[0] ? (
                  <div className="pdOverview-line">Maior peso de custo: <b>{topExpenseGroups[0].label}</b> ({formatBRL(topExpenseGroups[0].value)}).</div>
                ) : null}
                {!hasArrobas ? (
                  <div className="pdOverview-line">Falta registrar arrobas para completar a análise por produtividade.</div>
                ) : null}
              </div>

              <div className="pdOverview-actions">
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.COST_DRIVERS)}>Ver custos</button>
                <button className="faz-btn sm" type="button" onClick={() => setView(VIEWS.SUMMARY)}>Plano de ação</button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
