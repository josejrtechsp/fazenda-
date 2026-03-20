import React, { useEffect, useMemo, useRef, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import FinanceiroCadastros from "./FinanceiroCadastros.jsx";
import "../styles/financeiro.css";

const REPORTS = [
  { key: "lancamentos", title: "Lançamentos", desc: "Registrar receitas e despesas com plano de contas e pessoa." },
  { key: "analise_pagamentos", title: "Análise de Pagamentos", desc: "Gastos por categoria e centro de custo." },
  { key: "analise_recebimentos", title: "Análise de Recebimentos", desc: "Receitas por categoria e período." },
  { key: "fechamento_mensal", title: "Fechamento Mensal", desc: "Checklist do mês: aberto, vencido, aprovação e conciliação." },
  { key: "dre", title: "DRE Gerencial", desc: "Resultado consolidado: receita, custo e margem." },
  { key: "receita_prev_real", title: "Receita Prevista / Realizada", desc: "Comparativo do planejado com o realizado." },
  { key: "despesa_prev_real", title: "Despesa Prevista / Realizada", desc: "Controle de orçamento da fazenda." },
  { key: "custos_rh", title: "Custos com RH", desc: "Folha, encargos e benefícios da equipe." },
  { key: "fluxo_caixa", title: "Fluxo de Caixa", desc: "Entradas, saídas e saldo por período." },
  { key: "lcdpr", title: "LCDPR", desc: "Conferência para entrega fiscal do produtor rural." },
  { key: "desembolso_cabeca", title: "Desembolso por Cabeça / Mês", desc: "Custo médio mensal por animal." },
];

const RH_CATEGORIES = [
  "Salários",
  "Encargos",
  "Férias",
  "13º Salário",
  "Benefícios",
  "Terceiros/Serviços RH",
];

const RH_MONTHLY_MODELS = [
  {
    key: "basico",
    label: "Equipe básica (3 colaboradores)",
    items: [
      { category: "Salários", qty: 3, unit_value_brl: 2800 },
      { category: "Encargos", total_brl: 3528 },
      { category: "Benefícios", total_brl: 1350 },
      { category: "Terceiros/Serviços RH", total_brl: 700 },
    ],
  },
  {
    key: "recria",
    label: "Recria intensiva (5 colaboradores)",
    items: [
      { category: "Salários", qty: 5, unit_value_brl: 2900 },
      { category: "Encargos", total_brl: 6090 },
      { category: "Benefícios", total_brl: 2400 },
      { category: "Terceiros/Serviços RH", total_brl: 1200 },
    ],
  },
  {
    key: "confinamento",
    label: "Confinamento (8 colaboradores)",
    items: [
      { category: "Salários", qty: 8, unit_value_brl: 3200 },
      { category: "Encargos", total_brl: 11264 },
      { category: "Benefícios", total_brl: 4400 },
      { category: "Terceiros/Serviços RH", total_brl: 2200 },
    ],
  },
];

const FIXED_COST_CAP_PER_HEAD = 90;
const FIN_STATUS_COST = ["open", "paid", "overdue"];
const FIN_STATUS_REVENUE = ["open", "received"];
const LS_LOGIN_USER = "fazenda_login_user_v1";
const LS_LOGIN_ROLE = "fazenda_login_role_v1";
const LS_FINANCE_NAV_HINT = "fazenda_nav_finance_open_v1";
const APPROVER_ROLE_LABEL = {
  gestor: "Gestor",
  admin: "Admin",
  financeiro: "Financeiro",
  rh: "RH",
};

function monthFromFinanceTitle(row) {
  return String(
    row?.competence_month ||
      row?.occurred_at ||
      row?.due_date ||
      ""
  ).slice(0, 7);
}

function financeStatusLabel(kind, statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "pending") return "Pendente aprovação";
  if (kind === "payable") {
    if (s === "paid") return "Pago";
    if (s === "overdue") return "Vencido";
    return "Em aberto";
  }
  if (s === "received") return "Recebido";
  if (s === "overdue") return "Vencido";
  return "Em aberto";
}

function financeStatusClass(label) {
  if (label === "Pendente aprovação") return "rec";
  if (label === "Pago" || label === "Recebido") return "ok";
  if (label === "Vencido") return "bad";
  return "warn";
}

function approvalStatusLabel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "approved") return "Aprovado";
  if (s === "rejected") return "Rejeitado";
  return "Pendente";
}

function approvalStatusClass(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "approved") return "ok";
  if (s === "rejected") return "bad";
  return "warn";
}

function reconciliationStatusLabel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "reconciled") return "Conciliado";
  if (s === "pending") return "Pendente";
  return "N/A";
}

function reconciliationStatusClass(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "reconciled") return "ok";
  if (s === "pending") return "warn";
  return "";
}

function normalizeQueueFocus(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["approval", "reconciliation", "scheduled", "unscheduled"].includes(value)) return value;
  return "all";
}

function matchesQueueFocus(row, focusRaw) {
  const focus = normalizeQueueFocus(focusRaw);
  if (focus === "all") return true;

  const approvalPending = String(row?.approval_status || "").toLowerCase() === "pending";
  const reconciled = String(row?.reconciliation_status || "not_applicable").toLowerCase() === "reconciled";
  const hasSettlement = asNum(row?.settled_brl) > 0;
  const hasSchedule = !!String(row?.scheduled_on || "").trim();

  if (focus === "approval") return approvalPending;
  if (focus === "reconciliation") return hasSettlement && !reconciled;
  if (focus === "scheduled") return hasSchedule;
  if (focus === "unscheduled") return !hasSchedule;
  return true;
}

function rhItemsToDraft(items = []) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    category: String(it?.category || "").trim(),
    qty: it?.qty != null ? String(it.qty) : "",
    unit_value_brl: it?.unit_value_brl != null ? String(it.unit_value_brl) : "",
    total_brl: it?.total_brl != null ? String(it.total_brl) : "",
  }));
}

function rhEmptyDraftLine() {
  return {
    category: "Salários",
    qty: "1",
    unit_value_brl: "",
    total_brl: "",
  };
}

function nowMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function toBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function formatDateTimeBR(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

function toNum(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function parseBRNumber(input) {
  if (typeof input === "number") return input;
  const s = String(input ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function monthLabel(monthKey) {
  const [y, m] = String(monthKey || "").split("-");
  const mm = Number(m);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (!y || !mm || mm < 1 || mm > 12) return String(monthKey || "");
  return `${months[mm - 1]}/${y}`;
}

function previousMonthKey(monthKey) {
  const [yRaw, mRaw] = String(monthKey || "").split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const mm = m === 1 ? 12 : m - 1;
  const yy = m === 1 ? y - 1 : y;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

function parseYmdLocal(raw) {
  const m = String(raw || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(d)) return null;
  return new Date(y, mm - 1, d, 12, 0, 0, 0);
}

function daysDiffYmd(fromYmd, toYmd) {
  const from = parseYmdLocal(fromYmd);
  const to = parseYmdLocal(toYmd);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

function buildAgingSummary(rows, todayYmd) {
  const buckets = {
    overdue: { count: 0, amount: 0, label: "Atrasado" },
    today: { count: 0, amount: 0, label: "Vence hoje" },
    next7: { count: 0, amount: 0, label: "Próx. 7 dias" },
    next15: { count: 0, amount: 0, label: "8 a 15 dias" },
    next30: { count: 0, amount: 0, label: "16 a 30 dias" },
    future: { count: 0, amount: 0, label: "+30 dias" },
    no_due: { count: 0, amount: 0, label: "Sem vencimento" },
  };

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const remaining = asNum(row?.remaining_brl);
    if (!(remaining > 0)) return;

    const due = String(row?.due_date || row?.date || "").trim();
    if (!due) {
      buckets.no_due.count += 1;
      buckets.no_due.amount += remaining;
      return;
    }

    const diff = daysDiffYmd(todayYmd, due);
    if (diff == null) {
      buckets.no_due.count += 1;
      buckets.no_due.amount += remaining;
      return;
    }

    if (diff < 0) {
      buckets.overdue.count += 1;
      buckets.overdue.amount += remaining;
    } else if (diff === 0) {
      buckets.today.count += 1;
      buckets.today.amount += remaining;
    } else if (diff <= 7) {
      buckets.next7.count += 1;
      buckets.next7.amount += remaining;
    } else if (diff <= 15) {
      buckets.next15.count += 1;
      buckets.next15.amount += remaining;
    } else if (diff <= 30) {
      buckets.next30.count += 1;
      buckets.next30.amount += remaining;
    } else {
      buckets.future.count += 1;
      buckets.future.amount += remaining;
    }
  });

  const urgentAmount = buckets.overdue.amount + buckets.today.amount + buckets.next7.amount;
  const urgentCount = buckets.overdue.count + buckets.today.count + buckets.next7.count;
  const shortAmount = urgentAmount + buckets.next15.amount;
  const shortCount = urgentCount + buckets.next15.count;

  return {
    buckets,
    urgentAmount,
    urgentCount,
    shortAmount,
    shortCount,
  };
}

function buildCloseChecklist(summary) {
  const payable = summary?.payable || {};
  const receivable = summary?.receivable || {};
  const result = summary?.result || {};

  return [
    {
      key: "payable-approval",
      level: "blocker",
      ok: asNum(payable.pending_approval_count) <= 0,
      title: "Pagamentos sem aprovação",
      detail: `${toNum(payable.pending_approval_count || 0, 0)} título(s) • ${toBRL(payable.pending_approval_brl)}`,
    },
    {
      key: "receivable-approval",
      level: "blocker",
      ok: asNum(receivable.pending_approval_count) <= 0,
      title: "Recebimentos sem aprovação",
      detail: `${toNum(receivable.pending_approval_count || 0, 0)} título(s) • ${toBRL(receivable.pending_approval_brl)}`,
    },
    {
      key: "payable-reconciliation",
      level: "blocker",
      ok: asNum(payable.pending_reconciliation_count) <= 0,
      title: "Pagamentos sem conciliação",
      detail: `${toNum(payable.pending_reconciliation_count || 0, 0)} título(s) • ${toBRL(payable.pending_reconciliation_brl)}`,
    },
    {
      key: "receivable-reconciliation",
      level: "blocker",
      ok: asNum(receivable.pending_reconciliation_count) <= 0,
      title: "Recebimentos sem conciliação",
      detail: `${toNum(receivable.pending_reconciliation_count || 0, 0)} título(s) • ${toBRL(receivable.pending_reconciliation_brl)}`,
    },
    {
      key: "payable-overdue",
      level: "blocker",
      ok: asNum(payable.overdue_count) <= 0,
      title: "Pagamentos vencidos",
      detail: `${toNum(payable.overdue_count || 0, 0)} título(s) • ${toBRL(payable.overdue_brl)}`,
    },
    {
      key: "receivable-overdue",
      level: "blocker",
      ok: asNum(receivable.overdue_count) <= 0,
      title: "Recebimentos vencidos",
      detail: `${toNum(receivable.overdue_count || 0, 0)} título(s) • ${toBRL(receivable.overdue_brl)}`,
    },
    {
      key: "payable-open",
      level: "alert",
      ok: asNum(payable.open_count) <= 0,
      title: "Pagamentos em aberto",
      detail: `${toNum(payable.open_count || 0, 0)} título(s) • ${toBRL(payable.open_brl)}`,
    },
    {
      key: "receivable-open",
      level: "alert",
      ok: asNum(receivable.open_count) <= 0,
      title: "Recebimentos em aberto",
      detail: `${toNum(receivable.open_count || 0, 0)} título(s) • ${toBRL(receivable.open_brl)}`,
    },
    {
      key: "net-open",
      level: "alert",
      ok: Math.abs(asNum(result.net_open_brl)) <= 0.009,
      title: "Saldo líquido aberto",
      detail: toBRL(result.net_open_brl),
    },
  ];
}

function buildCloseDiffCards(summary, latestSaved) {
  const payable = summary?.payable || {};
  const receivable = summary?.receivable || {};
  const result = summary?.result || {};
  if (!latestSaved) return [];

  const current = {
    net_settled_brl: asNum(result.net_settled_brl),
    net_open_brl: asNum(result.net_open_brl),
    payable_open_brl: asNum(payable.open_brl),
    receivable_open_brl: asNum(receivable.open_brl),
  };
  const previous = {
    net_settled_brl: asNum(latestSaved.net_settled_brl),
    net_open_brl: asNum(latestSaved.net_open_brl),
    payable_open_brl: asNum(latestSaved.payable_open_brl),
    receivable_open_brl: asNum(latestSaved.receivable_open_brl),
  };

  const defs = [
    { key: "net_settled_brl", label: "Saldo liquidado", toneUp: "rec", toneDown: "warn" },
    { key: "net_open_brl", label: "Saldo aberto", toneUp: "warn", toneDown: "ok" },
    { key: "payable_open_brl", label: "Pagar em aberto", toneUp: "warn", toneDown: "ok" },
    { key: "receivable_open_brl", label: "Receber em aberto", toneUp: "rec", toneDown: "warn" },
  ];

  return defs.map((item) => {
    const now = current[item.key];
    const old = previous[item.key];
    const delta = now - old;
    const unchanged = Math.abs(delta) <= 0.009;
    const tone = unchanged ? "neutral" : delta > 0 ? item.toneUp : item.toneDown;
    return {
      ...item,
      now,
      old,
      delta,
      unchanged,
      tone,
    };
  });
}

function buildCloseReadiness({ monthLocked, blockerPending, alertPending, pendingItems = [] }) {
  const topPending = (Array.isArray(pendingItems) ? pendingItems : []).slice(0, 3);
  if (monthLocked) {
    return {
      tone: "locked",
      title: "Mês travado",
      summary: "O período já foi congelado e alterações financeiras estão bloqueadas até destravar.",
      helper: "Use isso quando o mês já estiver conferido e oficializado.",
      reasons: topPending,
    };
  }

  if (blockerPending <= 0 && alertPending <= 0) {
    return {
      tone: "ready",
      title: "Pronto para travar",
      summary: "Não há bloqueios nem alertas pendentes. O mês está limpo para fechamento.",
      helper: "Se a conferência estiver concluída, já dá para registrar o snapshot e travar.",
      reasons: [],
    };
  }

  if (blockerPending <= 0) {
    return {
      tone: "review",
      title: "Pode travar com ressalvas",
      summary: "Não existe bloqueio duro, mas ainda há pontos que merecem revisão antes do travamento.",
      helper: "Você pode travar, mas vale confirmar se os alertas em aberto devem seguir para o próximo mês.",
      reasons: topPending,
    };
  }

  return {
    tone: "blocked",
    title: "Ainda não está pronto para travar",
    summary: "Existem pendências que bloqueiam o fechamento do mês e precisam ser resolvidas antes da trava.",
    helper: "Resolva aprovação, conciliação e vencidos antes de oficializar o período.",
    reasons: topPending,
  };
}

function closeDiffLabel(delta) {
  const n = asNum(delta);
  if (Math.abs(n) <= 0.009) return "Sem mudança";
  return `${n > 0 ? "+" : "−"}${toBRL(Math.abs(n))}`;
}

function shiftMonthKey(monthKey, delta) {
  const [yRaw, mRaw] = String(monthKey || "").split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKeys(endMonthKey, count) {
  const n = Math.max(1, Number(count) || 1);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(shiftMonthKey(endMonthKey, -i));
  return out;
}

function daysInMonth(monthKey) {
  const [yRaw, mRaw] = String(monthKey || "").split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 30;
  return new Date(y, m, 0).getDate();
}

function quarterLabel(key) {
  const [y, q] = String(key || "").split("-Q");
  if (!y || !q) return key;
  return `T${q}/${y}`;
}

function isPastDate(isoDate) {
  if (!isoDate) return false;
  return String(isoDate) < todayYMD();
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTextKey(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCategory(payload, fallback = "Sem categoria") {
  const p = payload || {};
  return String(p.category || p.group || p.simple_group || fallback).trim() || fallback;
}

function normalizeCenter(payload) {
  const p = payload || {};
  return String(
    p.center_cost || p.cost_center || p.center || p.farm || p.unit || p.lot_name || p.lot || "Não informado"
  ).trim() || "Não informado";
}

function normalizeDoc(payload) {
  const p = payload || {};
  return String(p.doc_number || p.document || p.invoice || p.nf || p.nota_fiscal || "").trim();
}

function personHasRole(person, roleKey) {
  const roles = Array.isArray(person?.roles) ? person.roles : [];
  return roles.includes(roleKey);
}

function normalizeApproverRole(v, fallback = "admin") {
  const s = String(v || fallback).trim().toLowerCase();
  return ["gestor", "admin", "financeiro", "rh"].includes(s) ? s : fallback;
}

function approverRoleLabel(role) {
  const k = normalizeApproverRole(role, "admin");
  return APPROVER_ROLE_LABEL[k] || k;
}

function canRoleApprove(requiredBy, actorRole) {
  const required = normalizeApproverRole(requiredBy, "gestor");
  const actor = normalizeApproverRole(actorRole, "admin");
  if (actor === "admin") return true;
  return actor === required;
}

function reconMatchKey(match) {
  const kind = String(match?.kind || "").trim();
  const eventId = Number(match?.event_id);
  if (!["payable", "receivable"].includes(kind) || !Number.isFinite(eventId) || eventId <= 0) return "";
  return `${kind}:${eventId}`;
}

function parseReconMatchKey(value) {
  const raw = String(value || "").trim();
  const [kind, eventIdRaw] = raw.split(":");
  const eventId = Number(eventIdRaw);
  if (!["payable", "receivable"].includes(kind) || !Number.isFinite(eventId) || eventId <= 0) return null;
  return { kind, event_id: eventId };
}

function accountOptionLabel(acc) {
  return `${acc?.code || ""} • ${acc?.name || ""}`.trim();
}

function fixedCostGroup(payload) {
  const p = payload || {};
  const group = normalizeTextKey(p.group || p.simple_group || "");
  const category = normalizeTextKey(normalizeCategory(p, ""));

  if (group.includes("rh")) return "RH";
  if (group.includes("nutri")) return "Nutrição";
  if (group.includes("manut")) return "Manutenção";
  if (group.includes("combust")) return "Combustível";

  if (
    category.includes("rh") ||
    category.includes("salario") ||
    category.includes("encargo") ||
    category.includes("beneficio") ||
    category.includes("ferias") ||
    category.includes("13")
  ) return "RH";

  if (
    category.includes("nutri") ||
    category.includes("racao") ||
    category.includes("silagem") ||
    category.includes("feno") ||
    category.includes("capim") ||
    category.includes("sal mineral") ||
    category.includes("sal proteinado")
  ) return "Nutrição";

  if (
    category.includes("manutencao") ||
    category.includes("manutenc")
  ) return "Manutenção";

  if (
    category.includes("combustivel") ||
    category.includes("diesel") ||
    category.includes("gasolina") ||
    category.includes("etanol")
  ) return "Combustível";

  return "";
}

function pctFrom(realized, planned) {
  const r = asNum(realized);
  const p = asNum(planned);
  if (p === 0) return r === 0 ? 0 : 100;
  return ((r - p) / Math.abs(p)) * 100;
}

function errorText(err, fallback = "Falha ao carregar financeiro") {
  const e = err || {};
  const detail = e?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msg = detail
      .map((d) => (typeof d === "string" ? d : d?.msg || d?.message || JSON.stringify(d)))
      .filter(Boolean)
      .join(" | ");
    if (msg) return msg;
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {}
  }
  if (typeof e?.message === "string" && e.message.trim()) return e.message;
  return fallback;
}

function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(";") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openPrintDocument(title, bodyHtml) {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=900");
  if (!win) return false;
  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #0f172a; }
      h1, h2, h3 { margin: 0; }
      h1 { font-size: 28px; margin-bottom: 6px; }
      h2 { font-size: 18px; margin: 22px 0 10px; }
      p, li, td, th, small, span, div { font-size: 13px; line-height: 1.45; }
      .muted { color: #475569; }
      .meta { display: grid; gap: 4px; margin-bottom: 18px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; background: #fff; }
      .kpi { display: grid; gap: 4px; }
      .kpi span { text-transform: uppercase; letter-spacing: .06em; font-weight: 700; color: #64748b; font-size: 11px; }
      .kpi b { font-size: 22px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; vertical-align: top; }
      th { color: #64748b; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; }
      .tag { display: inline-block; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 11px; }
      .ok { background: #dcfce7; color: #166534; }
      .bad { background: #fee2e2; color: #991b1b; }
      .warn { background: #fef3c7; color: #92400e; }
      @media print {
        body { margin: 12mm; }
        .card { break-inside: avoid; }
        table, tr, td, th { break-inside: avoid; }
      }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 120);
  return true;
}

function normalizeFinanceNavHint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const allowedScreens = new Set(["hub", ...REPORTS.map((r) => r.key)]);
  const allowedPayStatus = new Set(["ALL", "Pendente aprovação", "Pago", "Em aberto", "Vencido"]);
  const allowedRecvStatus = new Set(["ALL", "Pendente aprovação", "Recebido", "Em aberto", "Vencido"]);
  const allowedFinTabs = new Set(["despesa", "receita"]);
  const allowedLancamentosSubtabs = new Set(["lancamentos", "pessoas_empresas"]);
  const allowedQueueFocus = new Set(["all", "approval", "reconciliation", "scheduled", "unscheduled"]);

  const screen = allowedScreens.has(String(raw?.screen || "").trim()) ? String(raw.screen).trim() : null;
  const payStatus = allowedPayStatus.has(String(raw?.payStatus || "").trim()) ? String(raw.payStatus).trim() : "";
  const recvStatus = allowedRecvStatus.has(String(raw?.recvStatus || "").trim()) ? String(raw.recvStatus).trim() : "";
  const finTab = allowedFinTabs.has(String(raw?.finTab || "").trim()) ? String(raw.finTab).trim() : "";
  const lancamentosSubtab = allowedLancamentosSubtabs.has(String(raw?.lancamentosSubtab || "").trim())
    ? String(raw.lancamentosSubtab).trim()
    : "";
  const monthKey = /^\d{4}-\d{2}$/.test(String(raw?.monthKey || "").trim()) ? String(raw.monthKey).trim() : "";
  const category = String(raw?.category || "").trim();
  const center = String(raw?.center || "").trim();
  const search = String(raw?.search || "").trim();
  const payFocus = allowedQueueFocus.has(normalizeQueueFocus(raw?.payFocus)) ? normalizeQueueFocus(raw?.payFocus) : "all";
  const recvFocus = allowedQueueFocus.has(normalizeQueueFocus(raw?.recvFocus)) ? normalizeQueueFocus(raw?.recvFocus) : "all";

  if (!screen && !payStatus && !recvStatus && !finTab && !lancamentosSubtab && !monthKey && !category && !center && !search && payFocus === "all" && recvFocus === "all") {
    return null;
  }

  return {
    screen: screen || "hub",
    payStatus,
    recvStatus,
    finTab,
    lancamentosSubtab,
    monthKey,
    category,
    center,
    search,
    payFocus,
    recvFocus,
  };
}

export default function Financeiro() {
  const financeNavHintRef = useRef(null);
  const [monthKey, setMonthKey] = useState(nowMonthKey());
  const [payBreakdown, setPayBreakdown] = useState("category");
  const [payStatus, setPayStatus] = useState("ALL");
  const [recvStatus, setRecvStatus] = useState("ALL");
  const [payFocus, setPayFocus] = useState("all");
  const [recvFocus, setRecvFocus] = useState("all");
  const [flowGranularity, setFlowGranularity] = useState("monthly");
  const [flowIncludePlanned, setFlowIncludePlanned] = useState(false);
  const [desWindow, setDesWindow] = useState(3);
  const [desGrowthPct, setDesGrowthPct] = useState("");
  const [desCategory, setDesCategory] = useState("ALL");
  const [desCenter, setDesCenter] = useState("ALL");
  const [hectares, setHectares] = useState("");
  const [heads, setHeads] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [center, setCenter] = useState("ALL");
  const [screen, setScreen] = useState("hub");
  const [refreshTick, setRefreshTick] = useState(0);
  const [approverUser] = useState(() => {
    if (typeof window === "undefined") return "usuario";
    try {
      return String(window.sessionStorage.getItem(LS_LOGIN_USER) || "usuario");
    } catch {
      return "usuario";
    }
  });
  const [approverRole] = useState(() => {
    if (typeof window === "undefined") return "admin";
    try {
      return normalizeApproverRole(window.sessionStorage.getItem(LS_LOGIN_ROLE), "admin");
    } catch {
      return "admin";
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [herdSummary, setHerdSummary] = useState(null);
  const [allCostEvents, setAllCostEvents] = useState([]);
  const [allExitEvents, setAllExitEvents] = useState([]);
  const [allNutritionPurchases, setAllNutritionPurchases] = useState([]);
  const [allNutritionItems, setAllNutritionItems] = useState([]);
  const [accountsL4, setAccountsL4] = useState([]);
  const [peopleAll, setPeopleAll] = useState([]);
  const [titlesPayableAll, setTitlesPayableAll] = useState([]);
  const [titlesReceivableAll, setTitlesReceivableAll] = useState([]);
  const [titlesBusyId, setTitlesBusyId] = useState("");
  const [titlesMsg, setTitlesMsg] = useState("");
  const [reconCsvText, setReconCsvText] = useState("");
  const [reconPreview, setReconPreview] = useState(null);
  const [reconSelections, setReconSelections] = useState({});
  const [reconBusy, setReconBusy] = useState(false);
  const [reconApplyBusy, setReconApplyBusy] = useState(false);
  const [reconMsg, setReconMsg] = useState("");
  const [reconTolerance, setReconTolerance] = useState("0,05");
  const [reconWindowDays, setReconWindowDays] = useState("7");
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeSummary, setCloseSummary] = useState(null);
  const [closeHistory, setCloseHistory] = useState([]);
  const [closeSaveBusy, setCloseSaveBusy] = useState(false);
  const [closeMonthState, setCloseMonthState] = useState(null);
  const [closeLockBusy, setCloseLockBusy] = useState(false);
  const [closeExportBusy, setCloseExportBusy] = useState(false);
  const [finTab, setFinTab] = useState("despesa");
  const [lancamentosSubtab, setLancamentosSubtab] = useState("lancamentos");
  const [finSaving, setFinSaving] = useState(false);
  const [finMsg, setFinMsg] = useState("");
  const [finCostForm, setFinCostForm] = useState({
    date: todayYMD(),
    due_date: todayYMD(),
    competence_month: nowMonthKey(),
    account_code: "",
    supplier_id: "",
    category: "",
    center_cost: "Fazenda",
    cost_kind: "operational",
    status: "open",
    value_brl: "",
    planned_value_brl: "",
    doc_number: "",
    notes: "",
    requires_approval: false,
    approval_note: "",
    approval_required_by: "gestor",
  });
  const [finRevForm, setFinRevForm] = useState({
    date: todayYMD(),
    due_date: todayYMD(),
    competence_month: nowMonthKey(),
    account_code: "",
    customer_id: "",
    category: "",
    center_cost: "Fazenda",
    status: "open",
    value_brl: "",
    planned_value_brl: "",
    arrobas: "",
    doc_number: "",
    notes: "",
    requires_approval: false,
    approval_note: "",
    approval_required_by: "gestor",
  });
  const [rhDate, setRhDate] = useState(todayYMD());
  const [rhDueDate, setRhDueDate] = useState(todayYMD());
  const [rhCategory, setRhCategory] = useState(RH_CATEGORIES[0]);
  const [rhCenter, setRhCenter] = useState("Fazenda");
  const [rhQtyPeople, setRhQtyPeople] = useState("1");
  const [rhUnitValue, setRhUnitValue] = useState("");
  const [rhTotalValue, setRhTotalValue] = useState("");
  const [rhPaymentStatus, setRhPaymentStatus] = useState("paid");
  const [rhNotes, setRhNotes] = useState("");
  const [rhSaving, setRhSaving] = useState(false);
  const [rhMsg, setRhMsg] = useState("");
  const [rhModelKey, setRhModelKey] = useState(RH_MONTHLY_MODELS[0].key);
  const [rhModelMonth, setRhModelMonth] = useState(nowMonthKey());
  const [rhModelCenter, setRhModelCenter] = useState("Fazenda");
  const [rhModelPaymentStatus, setRhModelPaymentStatus] = useState("open");
  const [rhModelDraftItems, setRhModelDraftItems] = useState(() => rhItemsToDraft(RH_MONTHLY_MODELS[0].items));
  const [rhModelSaving, setRhModelSaving] = useState(false);
  const [rhModelMsg, setRhModelMsg] = useState("");

  const titleMonth = useMemo(() => monthLabel(monthKey), [monthKey]);

  const reconSelectionStats = useMemo(() => {
    const items = Array.isArray(reconPreview?.items) ? reconPreview.items : [];
    const ambiguous = items.filter((it) => String(it?.status || "") === "ambiguous");
    let selected = 0;
    ambiguous.forEach((it) => {
      const key = reconSelections[String(it?.row_index || "")];
      if (parseReconMatchKey(key)) selected += 1;
    });
    return {
      ambiguous: ambiguous.length,
      selected,
    };
  }, [reconPreview, reconSelections]);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [sumRes, costsRes, exitsRes, purchasesRes, itemsRes, herdSumRes, accRes, peopleRes, payRes, recvRes] = await Promise.allSettled([
          api.get(`/producer/monthly-summary?month=${encodeURIComponent(monthKey)}`),
          api.get("/events?type=cost&status=approved&limit=500"),
          api.get("/events?type=exit&status=approved&limit=400"),
          api.get("/nutrition/purchases?limit=700"),
          api.get("/nutrition/items?active_only=true"),
          api.get("/herd/summary"),
          api.get("/accounts?level=4&include_inactive=false&limit=5000"),
          api.get("/people?include_inactive=false&limit=3000"),
          api.get("/finance/accounts-payable?limit=3000"),
          api.get("/finance/accounts-receivable?limit=3000"),
        ]);
        if (!on) return;

        if (sumRes.status !== "fulfilled" || costsRes.status !== "fulfilled" || exitsRes.status !== "fulfilled") {
          const rootErr = sumRes.status !== "fulfilled"
            ? sumRes.reason
            : costsRes.status !== "fulfilled"
              ? costsRes.reason
              : exitsRes.reason;
          throw rootErr || new Error("Falha ao carregar financeiro");
        }

        const costs = (Array.isArray(costsRes.value) ? costsRes.value : []).sort((a, b) => String(b?.occurred_at || "").localeCompare(String(a?.occurred_at || "")));
        const exits = (Array.isArray(exitsRes.value) ? exitsRes.value : []).sort((a, b) => String(b?.occurred_at || "").localeCompare(String(a?.occurred_at || "")));
        const purchases = (purchasesRes.status === "fulfilled" && Array.isArray(purchasesRes.value) ? purchasesRes.value : [])
          .sort((a, b) => String(b?.purchased_at || "").localeCompare(String(a?.purchased_at || "")));
        const items = itemsRes.status === "fulfilled" && Array.isArray(itemsRes.value)
          ? itemsRes.value
          : [];

        setSummary(sumRes.value || null);
        setAllCostEvents(costs);
        setAllExitEvents(exits);
        setAllNutritionPurchases(purchases);
        setAllNutritionItems(items);
        setHerdSummary(herdSumRes.status === "fulfilled" ? (herdSumRes.value || null) : null);
        setAccountsL4(
          accRes.status === "fulfilled" && Array.isArray(accRes.value)
            ? accRes.value
            : []
        );
        setPeopleAll(
          peopleRes.status === "fulfilled" && Array.isArray(peopleRes.value)
            ? peopleRes.value
            : []
        );
        setTitlesPayableAll(
          payRes.status === "fulfilled" && Array.isArray(payRes.value?.items)
            ? payRes.value.items
            : []
        );
        setTitlesReceivableAll(
          recvRes.status === "fulfilled" && Array.isArray(recvRes.value?.items)
            ? recvRes.value.items
            : []
        );
      } catch (e) {
        if (!on) return;
        setError(errorText(e));
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [monthKey, refreshTick]);

  useEffect(() => {
    setSearch("");
    setCategory("ALL");
    setCenter("ALL");
    setPayStatus("ALL");
    setRecvStatus("ALL");
    setPayFocus("all");
    setRecvFocus("all");
    setFinMsg("");
    setLancamentosSubtab("lancamentos");
    setRhMsg("");
    setRhModelMsg("");

    const hint = financeNavHintRef.current;
    if (!hint || hint.screen !== screen) return;
    if (hint.payStatus) setPayStatus(hint.payStatus);
    if (hint.recvStatus) setRecvStatus(hint.recvStatus);
    if (hint.payFocus) setPayFocus(hint.payFocus);
    if (hint.recvFocus) setRecvFocus(hint.recvFocus);
    if (hint.finTab) setFinTab(hint.finTab);
    if (hint.lancamentosSubtab) setLancamentosSubtab(hint.lancamentosSubtab);
    if (hint.category) setCategory(hint.category);
    if (hint.center) setCenter(hint.center);
    if (hint.search) setSearch(hint.search);
    financeNavHintRef.current = null;
  }, [screen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const applyHint = (raw) => {
      const hint = normalizeFinanceNavHint(raw);
      if (!hint) return;
      if (hint.monthKey) setMonthKey(hint.monthKey);
      if (hint.screen && hint.screen !== screen) {
        financeNavHintRef.current = hint;
        setScreen(hint.screen);
        return;
      }
      if (hint.payStatus) setPayStatus(hint.payStatus);
      if (hint.recvStatus) setRecvStatus(hint.recvStatus);
      if (hint.payFocus) setPayFocus(hint.payFocus);
      if (hint.recvFocus) setRecvFocus(hint.recvFocus);
      if (hint.finTab) setFinTab(hint.finTab);
      if (hint.lancamentosSubtab) setLancamentosSubtab(hint.lancamentosSubtab);
      if (hint.category) setCategory(hint.category);
      if (hint.center) setCenter(hint.center);
      if (hint.search) setSearch(hint.search);
    };

    const consumeStoredHint = () => {
      try {
        const raw = window.localStorage.getItem(LS_FINANCE_NAV_HINT);
        if (!raw) return;
        window.localStorage.removeItem(LS_FINANCE_NAV_HINT);
        applyHint(JSON.parse(raw));
      } catch {
        try {
          window.localStorage.removeItem(LS_FINANCE_NAV_HINT);
        } catch {}
      }
    };

    consumeStoredHint();
    const onHint = () => consumeStoredHint();
    window.addEventListener(LS_FINANCE_NAV_HINT, onHint);
    return () => window.removeEventListener(LS_FINANCE_NAV_HINT, onHint);
  }, [screen]);

  useEffect(() => {
    const model = RH_MONTHLY_MODELS.find((m) => m.key === rhModelKey) || RH_MONTHLY_MODELS[0];
    setRhModelDraftItems(rhItemsToDraft(model?.items || []));
    setRhModelMsg("");
  }, [rhModelKey]);

  const nutritionItemById = useMemo(() => {
    const m = {};
    allNutritionItems.forEach((it) => {
      const id = String(it?.id ?? "");
      if (!id) return;
      m[id] = String(it?.name || "").trim() || `Item ${id}`;
    });
    return m;
  }, [allNutritionItems]);

  const nutritionMerge = useMemo(() => {
    const existingBySignature = new Set();
    const existingByNote = new Set();
    const sig = ({ date, category, unit, qty, total }) =>
      [
        String(date || ""),
        normalizeTextKey(category),
        normalizeTextKey(unit),
        asNum(qty).toFixed(4),
        asNum(total).toFixed(2),
      ].join("|");

    allCostEvents.forEach((ev) => {
      const p = ev?.payload || {};
      const date = String(ev?.occurred_at || "").slice(0, 10);
      const category = normalizeCategory(p);
      const unit = String(p?.unit || "").trim();
      const qty = p?.qty;
      const total = p?.value_brl ?? p?.total_brl;
      existingBySignature.add(sig({ date, category, unit, qty, total }));
      const noteA = normalizeTextKey(p?.notes);
      const noteB = normalizeTextKey(ev?.raw_text);
      if (noteA) existingByNote.add(noteA);
      if (noteB) existingByNote.add(noteB);
    });

    const synthetic = [];
    let deduped = 0;
    allNutritionPurchases.forEach((p) => {
      const date = String(p?.purchased_at || "").slice(0, 10);
      const itemName = nutritionItemById[String(p?.item_id)] || `Item ${String(p?.item_id || "")}`;
      const qty = asNum(p?.qty);
      const unit = String(p?.unit || "").trim();
      const unitPrice = asNum(p?.unit_price_brl);
      const total = asNum(p?.total_brl) || qty * unitPrice;
      const noteKey = normalizeTextKey(p?.notes);
      const rowSig = sig({ date, category: itemName, unit, qty, total });

      if ((noteKey && existingByNote.has(noteKey)) || existingBySignature.has(rowSig)) {
        deduped += 1;
        return;
      }

      synthetic.push({
        id: `nutri-${p?.id}`,
        source: "nutrition",
        status: "approved",
        type: "cost",
        occurred_at: p?.purchased_at,
        raw_text: p?.notes || "",
        payload: {
          group: "nutricao",
          category: itemName,
          center_cost: "Nutrição",
          cost_kind: "operational",
          payment_status: "paid",
          qty,
          unit,
          unit_price_brl: unitPrice,
          value_brl: total,
          notes: p?.notes || `Compra nutrição: ${itemName}`,
          supplier: p?.supplier || "",
          nutrition_purchase_id: p?.id,
          nutrition_item_id: p?.item_id,
          nutrition_item_name: itemName,
        },
      });
      existingBySignature.add(rowSig);
      if (noteKey) existingByNote.add(noteKey);
    });

    return {
      merged: [...allCostEvents, ...synthetic]
        .sort((a, b) => String(b?.occurred_at || "").localeCompare(String(a?.occurred_at || ""))),
      integratedCount: synthetic.length,
      dedupedCount: deduped,
      totalNutritionPurchases: allNutritionPurchases.length,
    };
  }, [allCostEvents, allNutritionPurchases, nutritionItemById]);

  const mergedCostEvents = nutritionMerge.merged;

  const costEvents = useMemo(
    () => mergedCostEvents.filter((ev) => String(ev?.occurred_at || "").slice(0, 7) === monthKey),
    [mergedCostEvents, monthKey]
  );

  const exitEvents = useMemo(
    () => allExitEvents.filter((ev) => String(ev?.occurred_at || "").slice(0, 7) === monthKey),
    [allExitEvents, monthKey]
  );

  const payRows = useMemo(() => {
    return costEvents
      .map((ev) => {
        const p = ev?.payload || {};
        const value = Number(p?.value_brl);
        const planned = Number(p?.planned_value_brl);
        const kindRaw = String(p?.cost_kind || (p?.is_investment ? "investment" : "operational")).toLowerCase();
        const kind = kindRaw === "investment" ? "Investimento" : "Operacional";
        const cat = normalizeCategory(p);
        const due = String(p?.due_date || ev?.occurred_at || "").slice(0, 10);
        const paid = String(p?.payment_status || "paid") === "paid";
        const status = paid ? "Pago" : isPastDate(due) ? "Vencido" : "Em aberto";
        return {
          id: ev.id,
          source: ev?.source || "manual",
          group: String(p?.group || "").toLowerCase(),
          date: String(ev?.occurred_at || "").slice(0, 10),
          due,
          status,
          title: String(p?.notes || cat || "Lançamento"),
          category: cat,
          kind,
          center: normalizeCenter(p),
          doc: normalizeDoc(p),
          value,
          planned,
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [costEvents]);

  const recvRows = useMemo(() => {
    return exitEvents
      .map((ev) => {
        const p = ev?.payload || {};
        const arrobas = Number(p?.arrobas);
        const total = Number(p?.value_brl);
        const planned = Number(p?.planned_value_brl);
        const price = Number.isFinite(arrobas) && arrobas > 0 ? total / arrobas : Number(p?.price_per_arroba_brl);
        const cat = normalizeCategory(p, "Venda");
        return {
          id: ev.id,
          date: String(ev?.occurred_at || "").slice(0, 10),
          status: String(p?.receive_status || "received") === "open" ? "Em aberto" : "Recebido",
          title: String(p?.notes || "Venda/abate"),
          category: cat,
          center: normalizeCenter(p),
          doc: normalizeDoc(p),
          arrobas,
          price,
          total,
          planned,
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [exitEvents]);

  const payableRows = useMemo(() => {
    return titlesPayableAll
      .filter((row) => monthFromFinanceTitle(row) === monthKey)
      .map((row) => {
        const approvalStatus = String(row?.approval_status || (row?.requires_approval ? "pending" : "approved")).toLowerCase();
        const effectiveStatus = approvalStatus === "pending" ? "pending" : row?.status;
        return {
          event_id: Number(row?.event_id),
          competence_month: String(row?.competence_month || monthFromFinanceTitle(row)),
          date: String(row?.occurred_at || "").slice(0, 10),
          due_date: String(row?.due_date || "").slice(0, 10),
          person_name: String(row?.person_name || "—"),
          category: String(row?.category || "Sem categoria"),
          center: String(row?.center_cost || "Fazenda"),
          status_label: financeStatusLabel("payable", effectiveStatus),
          approval_status: approvalStatus,
          requires_approval: !!row?.requires_approval,
          approval_required_by: String(row?.approval_required_by || "gestor"),
          approved_by: String(row?.approved_by || ""),
          approved_by_role: String(row?.approved_by_role || ""),
          approved_at: String(row?.approved_at || ""),
          scheduled_on: String(row?.scheduled_on || ""),
          schedule_method: String(row?.schedule_method || ""),
          reconciliation_status: String(row?.reconciliation_status || "not_applicable"),
          reconciled_on: String(row?.reconciled_on || ""),
          total_brl: asNum(row?.total_brl),
          settled_brl: asNum(row?.settled_brl),
          remaining_brl: asNum(row?.remaining_brl),
        };
      })
      .sort((a, b) => String(b.due_date || b.date).localeCompare(String(a.due_date || a.date)));
  }, [titlesPayableAll, monthKey]);

  const receivableRows = useMemo(() => {
    return titlesReceivableAll
      .filter((row) => monthFromFinanceTitle(row) === monthKey)
      .map((row) => {
        const approvalStatus = String(row?.approval_status || (row?.requires_approval ? "pending" : "approved")).toLowerCase();
        const effectiveStatus = approvalStatus === "pending" ? "pending" : row?.status;
        return {
          event_id: Number(row?.event_id),
          competence_month: String(row?.competence_month || monthFromFinanceTitle(row)),
          date: String(row?.occurred_at || "").slice(0, 10),
          due_date: String(row?.due_date || "").slice(0, 10),
          person_name: String(row?.person_name || "—"),
          category: String(row?.category || "Sem categoria"),
          center: String(row?.center_cost || "Fazenda"),
          status_label: financeStatusLabel("receivable", effectiveStatus),
          approval_status: approvalStatus,
          requires_approval: !!row?.requires_approval,
          approval_required_by: String(row?.approval_required_by || "gestor"),
          approved_by: String(row?.approved_by || ""),
          approved_by_role: String(row?.approved_by_role || ""),
          approved_at: String(row?.approved_at || ""),
          scheduled_on: String(row?.scheduled_on || ""),
          schedule_method: String(row?.schedule_method || ""),
          reconciliation_status: String(row?.reconciliation_status || "not_applicable"),
          reconciled_on: String(row?.reconciled_on || ""),
          total_brl: asNum(row?.total_brl),
          settled_brl: asNum(row?.settled_brl),
          remaining_brl: asNum(row?.remaining_brl),
        };
      })
      .sort((a, b) => String(b.due_date || b.date).localeCompare(String(a.due_date || a.date)));
  }, [titlesReceivableAll, monthKey]);

  const categories = useMemo(() => {
    const set = new Set();
    [...payRows, ...recvRows, ...payableRows, ...receivableRows].forEach((r) => {
      const c = String(r?.category || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [payRows, recvRows, payableRows, receivableRows]);

  const centers = useMemo(() => {
    const set = new Set();
    [...payRows, ...recvRows, ...payableRows, ...receivableRows].forEach((r) => {
      const c = String(r?.center || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [payRows, recvRows, payableRows, receivableRows]);

  const accountsCostOptions = useMemo(
    () =>
      accountsL4
        .filter((a) => String(a?.category || "").toUpperCase() !== "RECEITA")
        .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || ""), "pt-BR")),
    [accountsL4]
  );

  const accountsRevenueOptions = useMemo(
    () =>
      accountsL4
        .filter((a) => String(a?.category || "").toUpperCase() !== "DESPESA")
        .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || ""), "pt-BR")),
    [accountsL4]
  );

  const suppliers = useMemo(
    () =>
      peopleAll
        .filter((p) => personHasRole(p, "supplier"))
        .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR")),
    [peopleAll]
  );

  const customers = useMemo(
    () =>
      peopleAll
        .filter((p) => personHasRole(p, "customer"))
        .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR")),
    [peopleAll]
  );

  useEffect(() => {
    const costCode = String(finCostForm.account_code || "");
    const revCode = String(finRevForm.account_code || "");
    const hasCost = accountsCostOptions.some((a) => String(a?.code || "") === costCode);
    const hasRev = accountsRevenueOptions.some((a) => String(a?.code || "") === revCode);

    if (accountsCostOptions.length > 0 && !hasCost) {
      setFinCostForm((prev) => ({ ...prev, account_code: String(accountsCostOptions[0].code || "") }));
    }
    if (accountsRevenueOptions.length > 0 && !hasRev) {
      setFinRevForm((prev) => ({ ...prev, account_code: String(accountsRevenueOptions[0].code || "") }));
    }
  }, [accountsCostOptions, accountsRevenueOptions, finCostForm.account_code, finRevForm.account_code]);

  useEffect(() => {
    const supplierId = String(finCostForm.supplier_id || "");
    const customerId = String(finRevForm.customer_id || "");
    const hasSupplier = suppliers.some((p) => String(p?.id || "") === supplierId);
    const hasCustomer = customers.some((p) => String(p?.id || "") === customerId);

    if (suppliers.length > 0 && !hasSupplier) {
      setFinCostForm((prev) => ({ ...prev, supplier_id: String(suppliers[0].id || "") }));
    }
    if (customers.length > 0 && !hasCustomer) {
      setFinRevForm((prev) => ({ ...prev, customer_id: String(customers[0].id || "") }));
    }
  }, [suppliers, customers, finCostForm.supplier_id, finRevForm.customer_id]);

  const filteredPayRows = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    return payRows
      .filter((r) => (payStatus === "ALL" ? true : r.status === payStatus))
      .filter((r) => (category === "ALL" ? true : r.category === category))
      .filter((r) => (center === "ALL" ? true : r.center === center))
      .filter((r) => (!q ? true : `${r.title} ${r.category} ${r.kind} ${r.center}`.toLowerCase().includes(q)));
  }, [payRows, search, category, center, payStatus]);

  const filteredRecvRows = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    return recvRows
      .filter((r) => (recvStatus === "ALL" ? true : r.status === recvStatus))
      .filter((r) => (category === "ALL" ? true : r.category === category))
      .filter((r) => (center === "ALL" ? true : r.center === center))
      .filter((r) => (!q ? true : `${r.title} ${r.category} ${r.center}`.toLowerCase().includes(q)));
  }, [recvRows, search, category, center, recvStatus]);

  const filteredPayableRows = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    return payableRows
      .filter((r) => (payStatus === "ALL" ? true : r.status_label === payStatus))
      .filter((r) => matchesQueueFocus(r, payFocus))
      .filter((r) => (category === "ALL" ? true : r.category === category))
      .filter((r) => (center === "ALL" ? true : r.center === center))
      .filter((r) => (!q ? true : `${r.person_name} ${r.category} ${r.center}`.toLowerCase().includes(q)));
  }, [payableRows, search, category, center, payFocus, payStatus]);

  const filteredReceivableRows = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    return receivableRows
      .filter((r) => (recvStatus === "ALL" ? true : r.status_label === recvStatus))
      .filter((r) => matchesQueueFocus(r, recvFocus))
      .filter((r) => (category === "ALL" ? true : r.category === category))
      .filter((r) => (center === "ALL" ? true : r.center === center))
      .filter((r) => (!q ? true : `${r.person_name} ${r.category} ${r.center}`.toLowerCase().includes(q)));
  }, [receivableRows, search, category, center, recvFocus, recvStatus]);

  const costOp = useMemo(
    () =>
      payRows.reduce((acc, r) => {
        const isInv = r.kind === "Investimento";
        const v = Number(r.value);
        if (isInv || !Number.isFinite(v) || v <= 0) return acc;
        return acc + v;
      }, 0),
    [payRows]
  );

  const investment = useMemo(
    () =>
      payRows.reduce((acc, r) => {
        const isInv = r.kind === "Investimento";
        const v = Number(r.value);
        if (!isInv || !Number.isFinite(v) || v <= 0) return acc;
        return acc + v;
      }, 0),
    [payRows]
  );

  const prevKey = previousMonthKey(monthKey);

  const prevCostEvents = useMemo(
    () => mergedCostEvents.filter((ev) => String(ev?.occurred_at || "").slice(0, 7) === prevKey),
    [mergedCostEvents, prevKey]
  );

  const prevExitEvents = useMemo(
    () => allExitEvents.filter((ev) => String(ev?.occurred_at || "").slice(0, 7) === prevKey),
    [allExitEvents, prevKey]
  );

  const prevCostOp = useMemo(
    () =>
      prevCostEvents.reduce((acc, ev) => {
        const p = ev?.payload || {};
        const isInv = String(p?.cost_kind || "").toLowerCase() === "investment" || p?.is_investment;
        const v = asNum(p?.value_brl);
        return isInv ? acc : acc + v;
      }, 0),
    [prevCostEvents]
  );

  const prevReceita = useMemo(
    () => prevExitEvents.reduce((acc, ev) => acc + asNum(ev?.payload?.value_brl), 0),
    [prevExitEvents]
  );

  const receita = Number(summary?.revenue_total_brl) || recvRows.reduce((acc, r) => acc + asNum(r.total), 0);
  const lucroOperacional = receita - costOp;
  const ha = parseBRNumber(hectares);
  const lucroHa = Number.isFinite(ha) && ha > 0 ? lucroOperacional / ha : null;

  const pagarOpen = filteredPayableRows.filter((r) => r.status_label === "Em aberto").reduce((a, r) => a + asNum(r.remaining_brl), 0);
  const pagarVencido = filteredPayableRows.filter((r) => r.status_label === "Vencido").reduce((a, r) => a + asNum(r.remaining_brl), 0);
  const pagarPago = filteredPayableRows.filter((r) => r.status_label === "Pago").reduce((a, r) => a + asNum(r.settled_brl), 0);

  const receberOpen = filteredReceivableRows.filter((r) => r.status_label === "Em aberto").reduce((a, r) => a + asNum(r.remaining_brl), 0);
  const receberRec = filteredReceivableRows.filter((r) => r.status_label === "Recebido").reduce((a, r) => a + asNum(r.settled_brl), 0);

  const payableQueueStats = useMemo(() => {
    const stats = {
      approval: { count: 0, amount: 0 },
      reconciliation: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      open: { count: 0, amount: 0 },
      scheduled: { count: 0, amount: 0 },
      unscheduled: { count: 0, amount: 0 },
    };
    payableRows.forEach((row) => {
      const remaining = asNum(row?.remaining_brl);
      const settled = asNum(row?.settled_brl);
      const amount = remaining > 0 ? remaining : settled;
      const approvalPending = String(row?.approval_status || "").toLowerCase() === "pending";
      const reconciliationPending = settled > 0 && String(row?.reconciliation_status || "not_applicable").toLowerCase() !== "reconciled";
      const hasSchedule = !!String(row?.scheduled_on || "").trim();
      const status = String(row?.status_label || "");

      if (approvalPending) {
        stats.approval.count += 1;
        stats.approval.amount += amount;
      }
      if (reconciliationPending) {
        stats.reconciliation.count += 1;
        stats.reconciliation.amount += settled;
      }
      if (status === "Vencido") {
        stats.overdue.count += 1;
        stats.overdue.amount += remaining;
      }
      if (status === "Em aberto") {
        stats.open.count += 1;
        stats.open.amount += remaining;
      }
      if (hasSchedule) {
        stats.scheduled.count += 1;
        stats.scheduled.amount += amount;
      } else {
        stats.unscheduled.count += 1;
        stats.unscheduled.amount += amount;
      }
    });
    return stats;
  }, [payableRows]);

  const receivableQueueStats = useMemo(() => {
    const stats = {
      approval: { count: 0, amount: 0 },
      reconciliation: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      open: { count: 0, amount: 0 },
      scheduled: { count: 0, amount: 0 },
      unscheduled: { count: 0, amount: 0 },
    };
    receivableRows.forEach((row) => {
      const remaining = asNum(row?.remaining_brl);
      const settled = asNum(row?.settled_brl);
      const amount = remaining > 0 ? remaining : settled;
      const approvalPending = String(row?.approval_status || "").toLowerCase() === "pending";
      const reconciliationPending = settled > 0 && String(row?.reconciliation_status || "not_applicable").toLowerCase() !== "reconciled";
      const hasSchedule = !!String(row?.scheduled_on || "").trim();
      const status = String(row?.status_label || "");

      if (approvalPending) {
        stats.approval.count += 1;
        stats.approval.amount += amount;
      }
      if (reconciliationPending) {
        stats.reconciliation.count += 1;
        stats.reconciliation.amount += settled;
      }
      if (status === "Vencido") {
        stats.overdue.count += 1;
        stats.overdue.amount += remaining;
      }
      if (status === "Em aberto") {
        stats.open.count += 1;
        stats.open.amount += remaining;
      }
      if (hasSchedule) {
        stats.scheduled.count += 1;
        stats.scheduled.amount += amount;
      } else {
        stats.unscheduled.count += 1;
        stats.unscheduled.amount += amount;
      }
    });
    return stats;
  }, [receivableRows]);

  const payableAging = useMemo(
    () => buildAgingSummary(filteredPayableRows, todayYMD()),
    [filteredPayableRows]
  );

  const receivableAging = useMemo(
    () => buildAgingSummary(filteredReceivableRows, todayYMD()),
    [filteredReceivableRows]
  );

  function applyPayQueuePreset(preset) {
    const key = normalizeQueueFocus(preset);
    if (key === "approval") {
      setPayStatus("Pendente aprovação");
      setPayFocus("approval");
      return;
    }
    if (key === "reconciliation") {
      setPayStatus("Pago");
      setPayFocus("reconciliation");
      return;
    }
    if (key === "scheduled") {
      setPayStatus("ALL");
      setPayFocus("scheduled");
      return;
    }
    if (key === "unscheduled") {
      setPayStatus("Em aberto");
      setPayFocus("unscheduled");
      return;
    }
    if (key === "overdue") {
      setPayStatus("Vencido");
      setPayFocus("all");
      return;
    }
    if (key === "open") {
      setPayStatus("Em aberto");
      setPayFocus("all");
      return;
    }
    setPayStatus("ALL");
    setPayFocus("all");
  }

  function applyRecvQueuePreset(preset) {
    const key = normalizeQueueFocus(preset);
    if (key === "approval") {
      setRecvStatus("Pendente aprovação");
      setRecvFocus("approval");
      return;
    }
    if (key === "reconciliation") {
      setRecvStatus("Recebido");
      setRecvFocus("reconciliation");
      return;
    }
    if (key === "scheduled") {
      setRecvStatus("ALL");
      setRecvFocus("scheduled");
      return;
    }
    if (key === "unscheduled") {
      setRecvStatus("Em aberto");
      setRecvFocus("unscheduled");
      return;
    }
    if (key === "overdue") {
      setRecvStatus("Vencido");
      setRecvFocus("all");
      return;
    }
    if (key === "open") {
      setRecvStatus("Em aberto");
      setRecvFocus("all");
      return;
    }
    setRecvStatus("ALL");
    setRecvFocus("all");
  }

  function openCloseChecklistItem(itemKey) {
    if (itemKey === "payable-approval") {
      setScreen("analise_pagamentos");
      applyPayQueuePreset("approval");
      return;
    }
    if (itemKey === "payable-reconciliation") {
      setScreen("analise_pagamentos");
      applyPayQueuePreset("reconciliation");
      return;
    }
    if (itemKey === "payable-overdue") {
      setScreen("analise_pagamentos");
      applyPayQueuePreset("overdue");
      return;
    }
    if (itemKey === "payable-open") {
      setScreen("analise_pagamentos");
      applyPayQueuePreset("open");
      return;
    }
    if (itemKey === "receivable-approval") {
      setScreen("analise_recebimentos");
      applyRecvQueuePreset("approval");
      return;
    }
    if (itemKey === "receivable-reconciliation") {
      setScreen("analise_recebimentos");
      applyRecvQueuePreset("reconciliation");
      return;
    }
    if (itemKey === "receivable-overdue") {
      setScreen("analise_recebimentos");
      applyRecvQueuePreset("overdue");
      return;
    }
    if (itemKey === "receivable-open") {
      setScreen("analise_recebimentos");
      applyRecvQueuePreset("open");
    }
  }

  const payContextSummary = useMemo(() => {
    const rows = filteredPayableRows;
    const totalBrl = rows.reduce((acc, row) => acc + Math.max(asNum(row?.remaining_brl), asNum(row?.settled_brl)), 0);
    const focus = normalizeQueueFocus(payFocus);
    if (focus === "approval" || payStatus === "Pendente aprovação") {
      return {
        tone: "warn",
        title: "Fila de aprovação de pagamentos",
        detail: `${toNum(rows.length, 0)} título(s) aguardando aprovação, somando ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: aprove os títulos válidos e depois programe ou baixe o que for caixa do mês.",
      };
    }
    if (focus === "reconciliation") {
      return {
        tone: "rec",
        title: "Fila de conciliação de pagamentos",
        detail: `${toNum(rows.length, 0)} título(s) pagos ainda sem conciliação, total conciliável de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: concilie as baixas antes de confiar no fluxo de caixa.",
      };
    }
    if (payStatus === "Vencido") {
      return {
        tone: "bad",
        title: "Fila crítica de pagamentos vencidos",
        detail: `${toNum(rows.length, 0)} título(s) vencidos, total em risco de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: renegocie, programe ou faça a baixa para limpar o mês.",
      };
    }
    if (focus === "unscheduled") {
      return {
        tone: "warn",
        title: "Pagamentos sem programação",
        detail: `${toNum(rows.length, 0)} título(s) em aberto sem agenda financeira, total de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: programe o caixa antes do vencimento para evitar distorção no fluxo.",
      };
    }
    if (payStatus === "Em aberto") {
      return {
        tone: "rec",
        title: "Fila de pagamentos em aberto",
        detail: `${toNum(rows.length, 0)} título(s) em aberto, somando ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: priorize vencidos, depois programe os próximos desembolsos.",
      };
    }
    return {
      tone: "ok",
      title: "Visão operacional de pagamentos",
      detail: `${toNum(rows.length, 0)} título(s) no filtro atual, total de ${toBRL(totalBrl)}.`,
      helper: "Use as filas abaixo para entrar direto em aprovação, conciliação ou programação.",
    };
  }, [filteredPayableRows, payFocus, payStatus]);

  const recvContextSummary = useMemo(() => {
    const rows = filteredReceivableRows;
    const totalBrl = rows.reduce((acc, row) => acc + Math.max(asNum(row?.remaining_brl), asNum(row?.settled_brl)), 0);
    const focus = normalizeQueueFocus(recvFocus);
    if (focus === "approval" || recvStatus === "Pendente aprovação") {
      return {
        tone: "warn",
        title: "Fila de aprovação de recebimentos",
        detail: `${toNum(rows.length, 0)} título(s) aguardando aprovação, somando ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: aprove os títulos válidos e depois programe ou baixe o que já entrou no mês.",
      };
    }
    if (focus === "reconciliation") {
      return {
        tone: "rec",
        title: "Fila de conciliação de recebimentos",
        detail: `${toNum(rows.length, 0)} título(s) recebidos ainda sem conciliação, total conciliável de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: concilie as entradas antes de fechar saldo e fluxo.",
      };
    }
    if (recvStatus === "Vencido") {
      return {
        tone: "bad",
        title: "Fila crítica de recebimentos vencidos",
        detail: `${toNum(rows.length, 0)} título(s) vencidos, total em cobrança de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: cobre, renegocie ou reprograme para limpar o contas a receber.",
      };
    }
    if (focus === "unscheduled") {
      return {
        tone: "warn",
        title: "Recebimentos sem programação",
        detail: `${toNum(rows.length, 0)} título(s) em aberto sem agenda, total de ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: programe as entradas para alinhar caixa e cobrança.",
      };
    }
    if (recvStatus === "Em aberto") {
      return {
        tone: "rec",
        title: "Fila de recebimentos em aberto",
        detail: `${toNum(rows.length, 0)} título(s) em aberto, somando ${toBRL(totalBrl)}.`,
        helper: "Ação recomendada: priorize vencidos e programe os próximos recebimentos do mês.",
      };
    }
    return {
      tone: "ok",
      title: "Visão operacional de recebimentos",
      detail: `${toNum(rows.length, 0)} título(s) no filtro atual, total de ${toBRL(totalBrl)}.`,
      helper: "Use as filas abaixo para entrar direto em aprovação, conciliação ou cobrança.",
    };
  }, [filteredReceivableRows, recvFocus, recvStatus]);

  const payableAgingCards = useMemo(
    () => ([
      { key: "overdue", tone: "bad", title: "Atrasado", data: payableAging.buckets.overdue },
      { key: "today", tone: "warn", title: "Vence hoje", data: payableAging.buckets.today },
      { key: "next7", tone: "rec", title: "Próx. 7 dias", data: payableAging.buckets.next7 },
      { key: "next15", tone: "rec", title: "8 a 15 dias", data: payableAging.buckets.next15 },
      { key: "next30", tone: "ok", title: "16 a 30 dias", data: payableAging.buckets.next30 },
      { key: "future", tone: "ok", title: "+30 dias", data: payableAging.buckets.future },
    ]),
    [payableAging]
  );

  const receivableAgingCards = useMemo(
    () => ([
      { key: "overdue", tone: "bad", title: "Atrasado", data: receivableAging.buckets.overdue },
      { key: "today", tone: "warn", title: "Vence hoje", data: receivableAging.buckets.today },
      { key: "next7", tone: "rec", title: "Próx. 7 dias", data: receivableAging.buckets.next7 },
      { key: "next15", tone: "rec", title: "8 a 15 dias", data: receivableAging.buckets.next15 },
      { key: "next30", tone: "ok", title: "16 a 30 dias", data: receivableAging.buckets.next30 },
      { key: "future", tone: "ok", title: "+30 dias", data: receivableAging.buckets.future },
    ]),
    [receivableAging]
  );

  const monthlyFlow = useMemo(() => {
    const map = {};
    const periodKey = (mk) => {
      if (!mk) return "";
      if (flowGranularity === "yearly") return mk.slice(0, 4);
      if (flowGranularity === "quarterly") {
        const y = mk.slice(0, 4);
        const mm = Number(mk.slice(5, 7));
        const q = Math.floor((mm - 1) / 3) + 1;
        return `${y}-Q${q}`;
      }
      return mk;
    };

    mergedCostEvents.forEach((ev) => {
      const p = ev?.payload || {};
      const mk = String(ev?.occurred_at || "").slice(0, 7);
      const k = periodKey(mk);
      const actual = asNum(p?.value_brl);
      const planned = asNum(p?.planned_value_brl);
      const isOpen = String(p?.payment_status || "paid") !== "paid";
      const v = flowIncludePlanned && isOpen ? (planned || actual) : actual;
      if (!k || v <= 0) return;
      map[k] = map[k] || { in: 0, out: 0 };
      map[k].out += v;
    });

    allExitEvents.forEach((ev) => {
      const p = ev?.payload || {};
      const mk = String(ev?.occurred_at || "").slice(0, 7);
      const k = periodKey(mk);
      const actual = asNum(p?.value_brl);
      const planned = asNum(p?.planned_value_brl);
      const isOpen = String(p?.receive_status || "received") === "open";
      const v = flowIncludePlanned && isOpen ? (planned || actual) : actual;
      if (!k || v <= 0) return;
      map[k] = map[k] || { in: 0, out: 0 };
      map[k].in += v;
    });

    const sortKey = (k) => {
      if (flowGranularity === "yearly") return Number(k);
      if (flowGranularity === "quarterly") {
        const [y, q] = k.split("-Q");
        return Number(y) * 10 + Number(q);
      }
      return Number(k.replace("-", ""));
    };

    let acum = 0;
    return Object.entries(map)
      .map(([k, v]) => ({ month: k, in: v.in, out: v.out, saldo: v.in - v.out }))
      .sort((a, b) => sortKey(a.month) - sortKey(b.month))
      .slice(-12)
      .map((r) => {
        acum += r.saldo;
        return { ...r, acum };
      });
  }, [mergedCostEvents, allExitEvents, flowGranularity, flowIncludePlanned]);

  const selectedYear = String(monthKey || "").slice(0, 4);

  const payYearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, "0")}`),
    [selectedYear]
  );

  const payYearMatrix = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    const by = payBreakdown === "center" ? "center" : "category";
    const map = {};

    mergedCostEvents.forEach((ev) => {
      const p = ev?.payload || {};
      const mk = String(ev?.occurred_at || "").slice(0, 7);
      if (!mk || !mk.startsWith(`${selectedYear}-`)) return;
      const rowCategory = normalizeCategory(p);
      const rowCenter = normalizeCenter(p);
      const due = String(p?.due_date || ev?.occurred_at || "").slice(0, 10);
      const paid = String(p?.payment_status || "paid") === "paid";
      const rowStatus = paid ? "Pago" : isPastDate(due) ? "Vencido" : "Em aberto";
      if (payStatus !== "ALL" && rowStatus !== payStatus) return;
      if (category !== "ALL" && rowCategory !== category) return;
      if (center !== "ALL" && rowCenter !== center) return;
      const key = by === "center" ? rowCenter : rowCategory;
      if (!key) return;
      if (q && !`${key} ${rowCategory} ${rowCenter}`.toLowerCase().includes(q)) return;
      const val = asNum(p?.value_brl);
      if (val <= 0) return;

      map[key] = map[key] || { key, total: 0, months: {} };
      map[key].total += val;
      map[key].months[mk] = (map[key].months[mk] || 0) + val;
    });

    const rows = Object.values(map)
      .map((r) => {
        const monthValues = payYearMonths.map((mk) => asNum(r.months[mk]));
        return { ...r, monthValues };
      })
      .sort((a, b) => b.total - a.total);

    const total = rows.reduce((acc, r) => acc + r.total, 0);
    const withPercent = rows.map((r) => ({ ...r, pct: total > 0 ? (r.total / total) * 100 : 0 }));

    return {
      rows: withPercent,
      total,
      chart: withPercent.slice(0, 6),
      max: Math.max(...withPercent.map((r) => r.total), 0),
    };
  }, [mergedCostEvents, category, center, payBreakdown, payStatus, payYearMonths, search, selectedYear]);
  const pagarPeriodLabel = `${payYearMonths[0]?.slice(5, 7) || "--"}/${payYearMonths[0]?.slice(0, 4) || "----"} - ${payYearMonths[11]?.slice(5, 7) || "--"}/${payYearMonths[11]?.slice(0, 4) || "----"}`;

  const flowYearRows = useMemo(() => {
    return payYearMonths.map((mk) => {
      let receita = 0;
      let despesa = 0;
      let receitaPrev = 0;
      let despesaPrev = 0;

      allExitEvents.forEach((ev) => {
        if (String(ev?.occurred_at || "").slice(0, 7) !== mk) return;
        const p = ev?.payload || {};
        const actual = asNum(p?.value_brl);
        const planned = asNum(p?.planned_value_brl);
        const isOpen = String(p?.receive_status || "received") === "open";
        if (!isOpen) {
          receita += actual;
          receitaPrev += actual;
          return;
        }
        if (flowIncludePlanned) receitaPrev += planned || actual;
      });

      mergedCostEvents.forEach((ev) => {
        if (String(ev?.occurred_at || "").slice(0, 7) !== mk) return;
        const p = ev?.payload || {};
        const actual = asNum(p?.value_brl);
        const planned = asNum(p?.planned_value_brl);
        const isPaid = String(p?.payment_status || "paid") === "paid";
        if (isPaid) {
          despesa += actual;
          despesaPrev += actual;
          return;
        }
        if (flowIncludePlanned) despesaPrev += planned || actual;
      });

      const saldoInicial = 0;
      const saldoInicialPrev = 0;
      const balancoMes = receita - despesa;
      const balancoMesPrev = receitaPrev - despesaPrev;

      return {
        month: mk,
        receita,
        despesa,
        receitaPrev,
        despesaPrev,
        saldoInicial,
        saldoInicialPrev,
        balancoMes,
        balancoMesPrev,
        saldo: balancoMes,
        saldoPrev: balancoMesPrev,
      };
    });
  }, [payYearMonths, allExitEvents, mergedCostEvents, flowIncludePlanned]);

  const flowChart = useMemo(() => {
    const rows = flowYearRows;
    const values = [0];
    rows.forEach((r) => {
      values.push(-asNum(r.despesa), -asNum(r.despesaPrev), asNum(r.saldo), asNum(r.saldoPrev));
    });
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = -1;
      max = 1;
    }
    if (min === max) max = min + 1;

    const width = 1120;
    const height = 320;
    const padX = 56;
    const padY = 24;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const step = rows.length > 1 ? plotW / (rows.length - 1) : plotW;
    const barW = Math.max(12, Math.min(30, step * 0.28));
    const y = (v) => padY + ((max - v) / (max - min)) * plotH;
    const x = (i) => padX + i * step;

    const zeroY = y(0);
    const saldoPoints = rows.map((r, i) => `${x(i)},${y(r.saldo)}`).join(" ");
    const saldoPrevPoints = rows.map((r, i) => `${x(i)},${y(r.saldoPrev)}`).join(" ");
    const grid = Array.from({ length: 5 }, (_, i) => {
      const yy = padY + (plotH / 4) * i;
      return { yy };
    });

    return { rows, width, height, padX, padY, plotW, plotH, step, barW, y, x, zeroY, saldoPoints, saldoPrevPoints, grid, min, max };
  }, [flowYearRows]);

  const flowMatrixRows = useMemo(
    () => [
      {
        key: "saldo_inicial",
        label: "Saldo Inicial",
        pick: (m) => ({ planned: m.saldoInicialPrev, realized: m.saldoInicial }),
      },
      {
        key: "receita",
        label: "Receita",
        pick: (m) => ({ planned: m.receitaPrev, realized: m.receita }),
      },
      {
        key: "despesa",
        label: "Despesa",
        pick: (m) => ({ planned: m.despesaPrev, realized: m.despesa }),
      },
      {
        key: "balanco_mes",
        label: "Balanço do Mês",
        pick: (m) => ({ planned: m.balancoMesPrev, realized: m.balancoMes }),
      },
      {
        key: "saldo",
        label: "Saldo",
        pick: (m) => ({ planned: m.saldoPrev, realized: m.saldo }),
      },
    ],
    []
  );

  const receitaPrevRealRows = useMemo(() => {
    const map = {};
    filteredRecvRows.forEach((r) => {
      const key = `${r.category}||${r.center}`;
      const prev = Number.isFinite(r.planned) && r.planned > 0 ? r.planned : asNum(r.total);
      map[key] = map[key] || { category: r.category, center: r.center, previsto: 0, realizado: 0 };
      map[key].previsto += prev;
      if (r.status === "Recebido") map[key].realizado += asNum(r.total);
    });
    return Object.values(map)
      .map((r) => ({ ...r, variacao: r.realizado - r.previsto }))
      .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));
  }, [filteredRecvRows]);

  const despesaPrevRealRows = useMemo(() => {
    const map = {};
    filteredPayRows.forEach((r) => {
      const key = `${r.category}||${r.center}`;
      const prev = Number.isFinite(r.planned) && r.planned > 0 ? r.planned : asNum(r.value);
      map[key] = map[key] || { category: r.category, center: r.center, previsto: 0, realizado: 0 };
      map[key].previsto += prev;
      if (r.status === "Pago") map[key].realizado += asNum(r.value);
    });
    return Object.values(map)
      .map((r) => ({ ...r, variacao: r.realizado - r.previsto }))
      .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));
  }, [filteredPayRows]);

  const lcdprRows = useMemo(() => {
    const all = [
      ...filteredPayRows.map((r) => ({ tipo: "Despesa", data: r.date, title: r.title, category: r.category, center: r.center, doc: r.doc, value: asNum(r.value) })),
      ...filteredRecvRows.map((r) => ({ tipo: "Receita", data: r.date, title: r.title, category: r.category, center: r.center, doc: r.doc, value: asNum(r.total) })),
    ];
    return all
      .map((r) => {
        const pendencias = [];
        if (!r.category || r.category === "Sem categoria") pendencias.push("Sem categoria");
        if (!r.doc) pendencias.push("Sem documento");
        if (!r.data || r.data.length < 10) pendencias.push("Data inválida");
        if (!(r.value > 0)) pendencias.push("Valor inválido");
        return { ...r, pendencias };
      })
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [filteredPayRows, filteredRecvRows]);

  const headsNum = parseBRNumber(heads);
  const desMonths = useMemo(() => lastMonthKeys(monthKey, desWindow), [monthKey, desWindow]);
  const desGrowthRate = useMemo(() => {
    const p = parseBRNumber(desGrowthPct);
    return Number.isFinite(p) ? p / 100 : 0;
  }, [desGrowthPct]);
  const herdHeads = Number(herdSummary?.total_active);
  const desBaseHeads = Number.isFinite(headsNum) && headsNum > 0
    ? headsNum
    : Number.isFinite(herdHeads) && herdHeads > 0
      ? herdHeads
      : NaN;
  const desFilterOptions = useMemo(() => {
    const cats = new Set();
    const centersSet = new Set();
    mergedCostEvents.forEach((ev) => {
      const p = ev?.payload || {};
      const kindRaw = String(p?.cost_kind || (p?.is_investment ? "investment" : "operational")).toLowerCase();
      if (kindRaw === "investment") return;
      const cat = normalizeCategory(p);
      const ctr = normalizeCenter(p);
      if (cat) cats.add(cat);
      if (ctr) centersSet.add(ctr);
    });
    return {
      categories: Array.from(cats).sort(),
      centers: Array.from(centersSet).sort(),
    };
  }, [mergedCostEvents]);
  const desRows = useMemo(() => {
    return desMonths.map((mk, idx) => {
      const total = mergedCostEvents.reduce((acc, ev) => {
        const p = ev?.payload || {};
        if (String(ev?.occurred_at || "").slice(0, 7) !== mk) return acc;
        const kindRaw = String(p?.cost_kind || (p?.is_investment ? "investment" : "operational")).toLowerCase();
        if (kindRaw === "investment") return acc; // regra fixa: investimento fora
        const rowCategory = normalizeCategory(p);
        const rowCenter = normalizeCenter(p);
        if (desCategory !== "ALL" && rowCategory !== desCategory) return acc;
        if (desCenter !== "ALL" && rowCenter !== desCenter) return acc;
        const v = asNum(p?.value_brl);
        if (v <= 0) return acc;
        return acc + v;
      }, 0);

      const fixedTotal = mergedCostEvents.reduce((acc, ev) => {
        const p = ev?.payload || {};
        if (String(ev?.occurred_at || "").slice(0, 7) !== mk) return acc;
        const kindRaw = String(p?.cost_kind || (p?.is_investment ? "investment" : "operational")).toLowerCase();
        if (kindRaw === "investment") return acc;
        const fixedGroup = fixedCostGroup(p);
        if (!fixedGroup) return acc;
        const rowCenter = normalizeCenter(p);
        if (desCenter !== "ALL" && rowCenter !== desCenter) return acc;
        const v = asNum(p?.value_brl);
        if (v <= 0) return acc;
        return acc + v;
      }, 0);

      let headsEst = NaN;
      if (Number.isFinite(desBaseHeads) && desBaseHeads > 0) {
        const stepsFromLatest = desMonths.length - 1 - idx;
        const den = Math.pow(1 + desGrowthRate, stepsFromLatest);
        headsEst = Number.isFinite(den) && den > 0 ? desBaseHeads / den : desBaseHeads;
      }

      const perHead = Number.isFinite(headsEst) && headsEst > 0 ? total / headsEst : null;
      const fixedPerHead = Number.isFinite(headsEst) && headsEst > 0 ? fixedTotal / headsEst : null;
      const daily = total / daysInMonth(mk);

      return {
        month: mk,
        heads: headsEst,
        total,
        fixedTotal,
        fixedPerHead,
        perHead,
        daily,
      };
    });
  }, [desMonths, mergedCostEvents, desCategory, desCenter, desBaseHeads, desGrowthRate]);
  const desTotal = desRows.reduce((acc, r) => acc + asNum(r.total), 0);
  const desMonthlyAvg = desRows.length > 0 ? desTotal / desRows.length : 0;
  const desAvgHeads = (() => {
    const vals = desRows.map((r) => Number(r.heads)).filter((n) => Number.isFinite(n) && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();
  const desPerHeadAvg = Number.isFinite(desAvgHeads) && desAvgHeads > 0 ? desTotal / desAvgHeads : null;
  const desFixedTotal = desRows.reduce((acc, r) => acc + asNum(r.fixedTotal), 0);
  const desFixedPerHeadAvg = Number.isFinite(desAvgHeads) && desAvgHeads > 0 ? desFixedTotal / desAvgHeads : null;
  const desFixedExceededMonths = desRows.filter((r) => Number.isFinite(r.fixedPerHead) && Number(r.fixedPerHead) > FIXED_COST_CAP_PER_HEAD);
  const desFixedExceededAvg = Number.isFinite(desFixedPerHeadAvg) && desFixedPerHeadAvg > FIXED_COST_CAP_PER_HEAD;
  const desMax = Math.max(...desRows.map((r) => asNum(r.total)), 0);

  const receitaPrevTotal = receitaPrevRealRows.reduce((a, r) => a + r.previsto, 0);
  const receitaRealTotal = receitaPrevRealRows.reduce((a, r) => a + r.realizado, 0);
  const despesaPrevTotal = despesaPrevRealRows.reduce((a, r) => a + r.previsto, 0);
  const despesaRealTotal = despesaPrevRealRows.reduce((a, r) => a + r.realizado, 0);
  const rhRows = useMemo(
    () => payRows.filter((r) => r.group === "rh" || normalizeTextKey(r.category).startsWith("rh ")),
    [payRows]
  );
  const rhRowsFiltered = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    return rhRows
      .filter((r) => (payStatus === "ALL" ? true : r.status === payStatus))
      .filter((r) => (category === "ALL" ? true : r.category === category))
      .filter((r) => (center === "ALL" ? true : r.center === center))
      .filter((r) => (!q ? true : `${r.title} ${r.category} ${r.center}`.toLowerCase().includes(q)));
  }, [rhRows, payStatus, category, center, search]);
  const rhTotal = rhRowsFiltered.reduce((a, r) => a + asNum(r.value), 0);
  const rhPago = rhRowsFiltered.filter((r) => r.status === "Pago").reduce((a, r) => a + asNum(r.value), 0);
  const rhAberto = rhRowsFiltered.filter((r) => r.status === "Em aberto").reduce((a, r) => a + asNum(r.value), 0);
  const rhVencido = rhRowsFiltered.filter((r) => r.status === "Vencido").reduce((a, r) => a + asNum(r.value), 0);
  const rhAutoTotal = useMemo(() => {
    const qty = parseBRNumber(rhQtyPeople);
    const unit = parseBRNumber(rhUnitValue);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit > 0) return qty * unit;
    return null;
  }, [rhQtyPeople, rhUnitValue]);

  async function submitRhCost(e) {
    e?.preventDefault?.();
    setRhMsg("");
    const qty = parseBRNumber(rhQtyPeople);
    const unit = parseBRNumber(rhUnitValue);
    const totalTyped = parseBRNumber(rhTotalValue);
    const total = Number.isFinite(totalTyped) && totalTyped > 0 ? totalTyped : rhAutoTotal;

    if (!rhDate) {
      setRhMsg("Informe a data do lançamento.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setRhMsg("Informe valor válido (unitário e quantidade, ou total).");
      return;
    }

    setRhSaving(true);
    try {
      const cleanQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const cleanUnit = Number.isFinite(unit) && unit > 0 ? unit : total / cleanQty;
      const categoryLabel = `RH - ${rhCategory}`;

      await api.post("/events", {
        type: "cost",
        source: "manual",
        status: "approved",
        occurred_at: `${rhDate}T12:00:00`,
        raw_text: `RH:${rhCategory}:${rhDate}`,
        payload: {
          group: "rh",
          category: categoryLabel,
          center_cost: rhCenter || "Não informado",
          cost_kind: "operational",
          payment_status: rhPaymentStatus,
          due_date: rhDueDate || rhDate,
          qty: cleanQty,
          unit: "funcionario",
          unit_price_brl: cleanUnit,
          value_brl: total,
          notes: rhNotes || `${rhCategory} (${cleanQty} colaborador(es))`,
          rh: {
            category: rhCategory,
            employees: cleanQty,
            unit_value_brl: cleanUnit,
            total_value_brl: total,
          },
        },
      });

      setRhUnitValue("");
      setRhTotalValue("");
      setRhNotes("");
      setRhMsg("✅ Custo de RH lançado no financeiro.");
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setRhMsg(err?.data?.detail || err?.message || "Falha ao lançar custo de RH.");
    } finally {
      setRhSaving(false);
    }
  }

  const rhModelSelected = useMemo(
    () => RH_MONTHLY_MODELS.find((m) => m.key === rhModelKey) || RH_MONTHLY_MODELS[0],
    [rhModelKey]
  );
  const rhModelItems = rhModelDraftItems;
  const rhModelTotal = useMemo(
    () =>
      rhModelItems.reduce((acc, it) => {
        const qty = parseBRNumber(it?.qty);
        const unit = parseBRNumber(it?.unit_value_brl);
        const totalTyped = parseBRNumber(it?.total_brl);
        const total = Number.isFinite(totalTyped) && totalTyped > 0
          ? totalTyped
          : Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit > 0
            ? qty * unit
            : 0;
        return acc + total;
      }, 0),
    [rhModelItems]
  );

  function setRhModelDraftCell(index, field, value) {
    setRhModelDraftItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addRhModelDraftLine() {
    setRhModelDraftItems((prev) => [...prev, rhEmptyDraftLine()]);
  }

  function removeRhModelDraftLine(index) {
    setRhModelDraftItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetRhModelDraft() {
    setRhModelDraftItems(rhItemsToDraft(rhModelSelected?.items || []));
    setRhModelMsg("Modelo resetado para o padrão.");
  }

  async function applyRhMonthlyModel() {
    setRhModelMsg("");
    const mk = String(rhModelMonth || "").trim();
    if (!/^\d{4}-\d{2}$/.test(mk)) {
      setRhModelMsg("Informe o mês no formato AAAA-MM.");
      return;
    }
    const dayBase = `${mk}-05`;
    const dueBase = `${mk}-10`;
    const existingRaw = new Set(
      allCostEvents
        .map((ev) => String(ev?.raw_text || "").trim())
        .filter(Boolean)
    );

    setRhModelSaving(true);
    try {
      let created = 0;
      let skipped = 0;
      for (let i = 0; i < rhModelItems.length; i += 1) {
        const line = rhModelItems[i];
        const category = String(line?.category || "").trim();
        if (!category) continue;
        const qtyTyped = parseBRNumber(line?.qty);
        const unitTyped = parseBRNumber(line?.unit_value_brl);
        const totalTyped = parseBRNumber(line?.total_brl);
        const total = Number.isFinite(totalTyped) && totalTyped > 0
          ? totalTyped
          : Number.isFinite(qtyTyped) && qtyTyped > 0 && Number.isFinite(unitTyped) && unitTyped > 0
            ? qtyTyped * unitTyped
            : NaN;
        if (!(total > 0)) continue;
        const qty = Number.isFinite(qtyTyped) && qtyTyped > 0 ? qtyTyped : 1;

        const rawText = `RHMODEL:${rhModelSelected.key}:${mk}:${normalizeTextKey(category)}:${qty}:${total.toFixed(2)}`;
        if (existingRaw.has(rawText)) {
          skipped += 1;
          continue;
        }

        await api.post("/events", {
          type: "cost",
          source: "manual",
          status: "approved",
          occurred_at: `${dayBase}T12:00:00`,
          raw_text: rawText,
          payload: {
            group: "rh",
            category: `RH - ${category}`,
            center_cost: rhModelCenter || "Não informado",
            cost_kind: "operational",
            payment_status: rhModelPaymentStatus,
            due_date: dueBase,
            qty,
            unit: "funcionario",
            unit_price_brl: qty > 0 ? total / qty : total,
            value_brl: total,
            notes: `Folha mensal (${rhModelSelected.label}) • ${monthLabel(mk)} • ${category}`,
            rh: {
              model: rhModelSelected.key,
              model_label: rhModelSelected.label,
              month: mk,
              category,
              employees: qty,
              total_value_brl: total,
            },
          },
        });

        created += 1;
        existingRaw.add(rawText);
      }

      setRhModelMsg(`✅ Modelo aplicado: ${created} lançamento(s) criado(s), ${skipped} já existia(m).`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setRhModelMsg(err?.data?.detail || err?.message || "Falha ao aplicar modelo mensal.");
    } finally {
      setRhModelSaving(false);
    }
  }

  function updateFinCost(field, value) {
    setFinCostForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFinRev(field, value) {
    setFinRevForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submitFinanceCost(e) {
    e?.preventDefault?.();
    setFinMsg("");

    const amount = parseBRNumber(finCostForm.value_brl);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFinMsg("Informe um valor válido para a despesa.");
      return;
    }
    if (!finCostForm.account_code) {
      setFinMsg("Selecione a conta contábil (nível 4).");
      return;
    }
    if (!finCostForm.supplier_id) {
      setFinMsg("Selecione o fornecedor.");
      return;
    }
    if (!FIN_STATUS_COST.includes(finCostForm.status)) {
      setFinMsg("Status inválido para despesa.");
      return;
    }

    setFinSaving(true);
    try {
      await api.post("/events/finance/cost", {
        occurred_on: finCostForm.date,
        due_date: finCostForm.due_date || finCostForm.date,
        competence_month: finCostForm.competence_month || monthKey,
        account_code: finCostForm.account_code,
        supplier_id: Number(finCostForm.supplier_id),
        category: finCostForm.category || undefined,
        center_cost: finCostForm.center_cost || "Fazenda",
        cost_kind: finCostForm.cost_kind,
        status: finCostForm.status,
        value_brl: amount,
        planned_value_brl: parseBRNumber(finCostForm.planned_value_brl),
        doc_number: finCostForm.doc_number || "",
        notes: finCostForm.notes || "",
        requires_approval: !!finCostForm.requires_approval,
        approval_note: finCostForm.approval_note || "",
        approval_required_by: finCostForm.approval_required_by || "gestor",
      });
      setFinMsg("✅ Despesa lançada com sucesso.");
      setFinCostForm((prev) => ({
        ...prev,
        value_brl: "",
        planned_value_brl: "",
        doc_number: "",
        notes: "",
        approval_note: "",
      }));
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setFinMsg(err?.data?.detail || err?.message || "Falha ao lançar despesa.");
    } finally {
      setFinSaving(false);
    }
  }

  async function submitFinanceRevenue(e) {
    e?.preventDefault?.();
    setFinMsg("");

    const amount = parseBRNumber(finRevForm.value_brl);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFinMsg("Informe um valor válido para a receita.");
      return;
    }
    if (!finRevForm.account_code) {
      setFinMsg("Selecione a conta contábil (nível 4).");
      return;
    }
    if (!finRevForm.customer_id) {
      setFinMsg("Selecione o cliente.");
      return;
    }
    if (!FIN_STATUS_REVENUE.includes(finRevForm.status)) {
      setFinMsg("Status inválido para receita.");
      return;
    }

    const arrobas = parseBRNumber(finRevForm.arrobas);

    setFinSaving(true);
    try {
      await api.post("/events/finance/revenue", {
        occurred_on: finRevForm.date,
        due_date: finRevForm.due_date || finRevForm.date,
        competence_month: finRevForm.competence_month || monthKey,
        account_code: finRevForm.account_code,
        customer_id: Number(finRevForm.customer_id),
        category: finRevForm.category || undefined,
        center_cost: finRevForm.center_cost || "Fazenda",
        status: finRevForm.status,
        value_brl: amount,
        planned_value_brl: parseBRNumber(finRevForm.planned_value_brl),
        arrobas: Number.isFinite(arrobas) && arrobas > 0 ? arrobas : undefined,
        doc_number: finRevForm.doc_number || "",
        notes: finRevForm.notes || "",
        requires_approval: !!finRevForm.requires_approval,
        approval_note: finRevForm.approval_note || "",
        approval_required_by: finRevForm.approval_required_by || "gestor",
      });
      setFinMsg("✅ Receita lançada com sucesso.");
      setFinRevForm((prev) => ({
        ...prev,
        value_brl: "",
        planned_value_brl: "",
        arrobas: "",
        doc_number: "",
        notes: "",
        approval_note: "",
      }));
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setFinMsg(err?.data?.detail || err?.message || "Falha ao lançar receita.");
    } finally {
      setFinSaving(false);
    }
  }

  async function settlePayable(row, partial = false) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    let amount_brl;
    if (partial) {
      const typed = window.prompt(`Valor da baixa parcial (máx ${toBRL(row?.remaining_brl)}):`, String(row?.remaining_brl || ""));
      if (typed == null) return;
      amount_brl = parseBRNumber(typed);
      if (!Number.isFinite(amount_brl) || amount_brl <= 0) {
        setTitlesMsg("Informe um valor válido para a baixa parcial.");
        return;
      }
    }
    setTitlesMsg("");
    setTitlesBusyId(`pay-${eventId}-${partial ? "partial" : "full"}`);
    try {
      const res = await api.post(`/finance/accounts-payable/${eventId}/pay`, {
        amount_brl,
        settled_on: todayYMD(),
        method: "manual",
        actor: "ui",
        note: partial ? "Baixa parcial via painel" : "Baixa total via painel",
      });
      const remaining = asNum(res?.item?.remaining_brl);
      setTitlesMsg(`✅ Despesa #${eventId} baixada. Saldo em aberto: ${toBRL(remaining)}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao baixar conta a pagar.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function approvePayable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    setTitlesMsg("");
    setTitlesBusyId(`pay-${eventId}-approve`);
    try {
      await api.post(`/finance/accounts-payable/${eventId}/approve`, {
        actor: approverUser || "ui",
        actor_role: approverRole,
        note: "Aprovação manual no painel",
      });
      setTitlesMsg(`✅ Despesa #${eventId} aprovada.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao aprovar conta a pagar.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function schedulePayable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    const defaultDate = String(row?.scheduled_on || row?.due_date || todayYMD());
    const typedDate = window.prompt("Data programada para pagamento (YYYY-MM-DD):", defaultDate);
    if (typedDate == null) return;

    const dateRaw = String(typedDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      setTitlesMsg("Use data no formato YYYY-MM-DD para programar.");
      return;
    }

    setTitlesMsg("");
    setTitlesBusyId(`pay-${eventId}-schedule`);
    try {
      const res = await api.post(`/finance/accounts-payable/${eventId}/schedule`, {
        scheduled_on: dateRaw,
        method: "manual",
        actor: approverUser || "ui",
        note: "Programação via painel",
      });
      const scheduled = String(res?.item?.scheduled_on || dateRaw);
      setTitlesMsg(`✅ Despesa #${eventId} programada para ${scheduled}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao programar conta a pagar.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function reconcilePayable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    setTitlesMsg("");
    setTitlesBusyId(`pay-${eventId}-reconcile`);
    try {
      const res = await api.post(`/finance/accounts-payable/${eventId}/reconcile`, {
        reconciled_on: todayYMD(),
        actor: approverUser || "ui",
        note: "Conciliação manual via painel",
      });
      const dt = String(res?.item?.reconciled_on || todayYMD());
      setTitlesMsg(`✅ Despesa #${eventId} conciliada em ${dt}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao conciliar conta a pagar.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function settleReceivable(row, partial = false) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    let amount_brl;
    if (partial) {
      const typed = window.prompt(`Valor do recebimento parcial (máx ${toBRL(row?.remaining_brl)}):`, String(row?.remaining_brl || ""));
      if (typed == null) return;
      amount_brl = parseBRNumber(typed);
      if (!Number.isFinite(amount_brl) || amount_brl <= 0) {
        setTitlesMsg("Informe um valor válido para o recebimento parcial.");
        return;
      }
    }
    setTitlesMsg("");
    setTitlesBusyId(`recv-${eventId}-${partial ? "partial" : "full"}`);
    try {
      const res = await api.post(`/finance/accounts-receivable/${eventId}/receive`, {
        amount_brl,
        settled_on: todayYMD(),
        method: "manual",
        actor: "ui",
        note: partial ? "Recebimento parcial via painel" : "Recebimento total via painel",
      });
      const remaining = asNum(res?.item?.remaining_brl);
      setTitlesMsg(`✅ Receita #${eventId} recebida. Saldo em aberto: ${toBRL(remaining)}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao baixar conta a receber.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function approveReceivable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    setTitlesMsg("");
    setTitlesBusyId(`recv-${eventId}-approve`);
    try {
      await api.post(`/finance/accounts-receivable/${eventId}/approve`, {
        actor: approverUser || "ui",
        actor_role: approverRole,
        note: "Aprovação manual no painel",
      });
      setTitlesMsg(`✅ Receita #${eventId} aprovada.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao aprovar conta a receber.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function scheduleReceivable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    const defaultDate = String(row?.scheduled_on || row?.due_date || todayYMD());
    const typedDate = window.prompt("Data programada para recebimento (YYYY-MM-DD):", defaultDate);
    if (typedDate == null) return;

    const dateRaw = String(typedDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      setTitlesMsg("Use data no formato YYYY-MM-DD para programar.");
      return;
    }

    setTitlesMsg("");
    setTitlesBusyId(`recv-${eventId}-schedule`);
    try {
      const res = await api.post(`/finance/accounts-receivable/${eventId}/schedule`, {
        scheduled_on: dateRaw,
        method: "manual",
        actor: approverUser || "ui",
        note: "Programação via painel",
      });
      const scheduled = String(res?.item?.scheduled_on || dateRaw);
      setTitlesMsg(`✅ Receita #${eventId} programada para ${scheduled}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao programar conta a receber.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function reconcileReceivable(row) {
    const eventId = Number(row?.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    setTitlesMsg("");
    setTitlesBusyId(`recv-${eventId}-reconcile`);
    try {
      const res = await api.post(`/finance/accounts-receivable/${eventId}/reconcile`, {
        reconciled_on: todayYMD(),
        actor: approverUser || "ui",
        note: "Conciliação manual via painel",
      });
      const dt = String(res?.item?.reconciled_on || todayYMD());
      setTitlesMsg(`✅ Receita #${eventId} conciliada em ${dt}.`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao conciliar conta a receber.");
    } finally {
      setTitlesBusyId("");
    }
  }

  async function handleCloseMonth() {
    if (closeBusy) return;
    setTitlesMsg("");
    setCloseBusy(true);
    try {
      const res = await api.post("/finance/close-month", { month: monthKey });
      setCloseSummary(res || null);
      setCloseHistory(Array.isArray(res?.history) ? res.history : []);
      setCloseMonthState(res?.month_state || null);
      const payableOpen = asNum(res?.payable?.open_brl);
      const receivableOpen = asNum(res?.receivable?.open_brl);
      const netOpen = asNum(res?.result?.net_open_brl);
      setTitlesMsg(
        `✅ Fechamento ${monthLabel(monthKey)}: aberto pagar ${toBRL(payableOpen)} | aberto receber ${toBRL(receivableOpen)} | saldo aberto ${toBRL(netOpen)}.`
      );
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha no fechamento mensal.");
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleSaveCloseMonth() {
    if (closeSaveBusy) return;
    setTitlesMsg("");
    setCloseSaveBusy(true);
    try {
      const res = await api.post("/finance/close-month/save", {
        month: monthKey,
        actor: approverUser || "ui",
      });
      setCloseSummary(res || null);
      setCloseHistory(Array.isArray(res?.history) ? res.history : []);
      setCloseMonthState(res?.month_state || null);
      const savedAt = formatDateTimeBR(res?.saved?.created_at);
      setTitlesMsg(`✅ Fechamento ${monthLabel(monthKey)} registrado no histórico em ${savedAt}.`);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao registrar fechamento mensal.");
    } finally {
      setCloseSaveBusy(false);
    }
  }

  async function handleLockCloseMonth(locked) {
    if (closeLockBusy) return;
    setTitlesMsg("");
    setCloseLockBusy(true);
    try {
      const res = await api.post(locked ? "/finance/close-month/unlock" : "/finance/close-month/lock", {
        month: monthKey,
        actor: approverUser || "ui",
        actor_role: approverRole || "admin",
      });
      setCloseSummary(res || null);
      setCloseHistory(Array.isArray(res?.history) ? res.history : []);
      setCloseMonthState(res?.month_state || null);
      setTitlesMsg(
        locked
          ? `✅ Mês ${monthLabel(monthKey)} reaberto para ajustes financeiros.`
          : `✅ Mês ${monthLabel(monthKey)} travado. Novos lançamentos e baixas ficaram bloqueados.`
      );
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao alterar trava do mês.");
    } finally {
      setCloseLockBusy(false);
    }
  }

  async function ensureCloseSummaryForExport() {
    if (closeSummary?.month === monthKey) {
      return closeSummary;
    }
    const res = await api.post("/finance/close-month", { month: monthKey });
    setCloseSummary(res || null);
    setCloseHistory(Array.isArray(res?.history) ? res.history : []);
    setCloseMonthState(res?.month_state || null);
    return res || null;
  }

  async function exportCloseMonthCsv() {
    if (closeExportBusy) return;
    setCloseExportBusy(true);
    setTitlesMsg("");
    try {
      const close = await ensureCloseSummaryForExport();
      const payable = close?.payable || {};
      const receivable = close?.receivable || {};
      const result = close?.result || {};
      const history = Array.isArray(close?.history) ? close.history : [];
      const latestSaved = close?.latest_saved || history[0] || null;
      const monthState = closeMonthState || close?.month_state || {};
      const checklist = buildCloseChecklist(close);
      const rows = [
        ["fechamento", "competencia", monthKey],
        ["fechamento", "competencia_label", monthLabel(monthKey)],
        ["fechamento", "mes_travado", monthState?.is_locked ? "sim" : "nao"],
        ["fechamento", "travado_por", monthState?.locked_by || ""],
        ["fechamento", "travado_em", formatDateTimeBR(monthState?.locked_at)],
        ["fechamento", "ultimo_snapshot", formatDateTimeBR(latestSaved?.created_at)],
        ["fechamento", "responsavel_snapshot", latestSaved?.actor || ""],
        ["resultado", "saldo_liquidado_brl", asNum(result.net_settled_brl).toFixed(2)],
        ["resultado", "saldo_aberto_brl", asNum(result.net_open_brl).toFixed(2)],
        ["pagar", "total_lancado_brl", asNum(payable.total_brl).toFixed(2)],
        ["pagar", "pago_brl", asNum(payable.settled_brl).toFixed(2)],
        ["pagar", "aberto_brl", asNum(payable.open_brl).toFixed(2)],
        ["pagar", "vencido_brl", asNum(payable.overdue_brl).toFixed(2)],
        ["pagar", "pendente_aprovacao_brl", asNum(payable.pending_approval_brl).toFixed(2)],
        ["pagar", "pendente_conciliacao_brl", asNum(payable.pending_reconciliation_brl).toFixed(2)],
        ["receber", "total_lancado_brl", asNum(receivable.total_brl).toFixed(2)],
        ["receber", "recebido_brl", asNum(receivable.settled_brl).toFixed(2)],
        ["receber", "aberto_brl", asNum(receivable.open_brl).toFixed(2)],
        ["receber", "vencido_brl", asNum(receivable.overdue_brl).toFixed(2)],
        ["receber", "pendente_aprovacao_brl", asNum(receivable.pending_approval_brl).toFixed(2)],
        ["receber", "pendente_conciliacao_brl", asNum(receivable.pending_reconciliation_brl).toFixed(2)],
        ...checklist.map((item) => [
          "checklist",
          item.title,
          item.ok ? "ok" : item.level === "blocker" ? "bloqueia" : "alerta",
          item.detail,
        ]),
        ...history.map((item) => [
          "historico",
          item.month || monthKey,
          formatDateTimeBR(item.created_at),
          item.actor || "",
          item.note || "",
          asNum(item.net_settled_brl).toFixed(2),
          asNum(item.net_open_brl).toFixed(2),
        ]),
      ];

      downloadCsv(
        `fechamento_mensal_${monthKey}.csv`,
        ["secao", "campo", "valor_1", "valor_2", "valor_3", "valor_4", "valor_5"],
        rows
      );
      setTitlesMsg(`✅ CSV do fechamento ${monthLabel(monthKey)} exportado.`);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao exportar CSV do fechamento.");
    } finally {
      setCloseExportBusy(false);
    }
  }

  async function exportCloseMonthPdf() {
    if (closeExportBusy) return;
    setCloseExportBusy(true);
    setTitlesMsg("");
    try {
      const close = await ensureCloseSummaryForExport();
      const payable = close?.payable || {};
      const receivable = close?.receivable || {};
      const result = close?.result || {};
      const history = Array.isArray(close?.history) ? close.history : [];
      const latestSaved = close?.latest_saved || history[0] || null;
      const monthState = closeMonthState || close?.month_state || {};
      const checklist = buildCloseChecklist(close);
      const blockers = checklist.filter((item) => item.level === "blocker");
      const alerts = checklist.filter((item) => item.level === "alert");

      const blockTable = (items, kind) => `
        <table>
          <thead>
            <tr><th>Item</th><th>Status</th><th>Detalhe</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td><span class="tag ${item.ok ? "ok" : kind === "blocker" ? "bad" : "warn"}">${item.ok ? "OK" : kind === "blocker" ? "Bloqueia" : "Atenção"}</span></td>
                <td>${escapeHtml(item.detail)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      const historyTable = history.length
        ? `
          <table>
            <thead>
              <tr><th>Registrado em</th><th>Responsável</th><th>Nota</th><th>Saldo liquidado</th><th>Saldo aberto</th></tr>
            </thead>
            <tbody>
              ${history.map((item) => `
                <tr>
                  <td>${escapeHtml(formatDateTimeBR(item.created_at))}</td>
                  <td>${escapeHtml(item.actor || "ui")}</td>
                  <td>${escapeHtml(item.note || "")}</td>
                  <td>${escapeHtml(toBRL(item.net_settled_brl))}</td>
                  <td>${escapeHtml(toBRL(item.net_open_brl))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `
        : `<p class="muted">Sem snapshots salvos para este mês.</p>`;

      const html = `
        <h1>Fechamento Mensal</h1>
        <div class="meta">
          <div><b>Competência:</b> ${escapeHtml(monthLabel(monthKey))}</div>
          <div><b>Status do mês:</b> ${monthState?.is_locked ? "Travado" : "Aberto"}</div>
          <div><b>Travado por:</b> ${escapeHtml(monthState?.locked_by || "—")}</div>
          <div><b>Travado em:</b> ${escapeHtml(formatDateTimeBR(monthState?.locked_at) || "—")}</div>
          <div><b>Último snapshot:</b> ${escapeHtml(formatDateTimeBR(latestSaved?.created_at) || "—")}</div>
          <div><b>Responsável do último snapshot:</b> ${escapeHtml(latestSaved?.actor || "—")}</div>
        </div>

        <div class="grid">
          <div class="card kpi"><span>Saldo liquidado</span><b>${escapeHtml(toBRL(result.net_settled_brl))}</b></div>
          <div class="card kpi"><span>Saldo aberto</span><b>${escapeHtml(toBRL(result.net_open_brl))}</b></div>
          <div class="card kpi"><span>Pagar em aberto</span><b>${escapeHtml(toBRL(payable.open_brl))}</b></div>
          <div class="card kpi"><span>Receber em aberto</span><b>${escapeHtml(toBRL(receivable.open_brl))}</b></div>
        </div>

        <h2>Contas a pagar</h2>
        <table>
          <tbody>
            <tr><th>Total lançado</th><td>${escapeHtml(toBRL(payable.total_brl))}</td><th>Pago</th><td>${escapeHtml(toBRL(payable.settled_brl))}</td></tr>
            <tr><th>Em aberto</th><td>${escapeHtml(toBRL(payable.open_brl))}</td><th>Vencido</th><td>${escapeHtml(toBRL(payable.overdue_brl))}</td></tr>
            <tr><th>Pend. aprovação</th><td>${escapeHtml(toBRL(payable.pending_approval_brl))}</td><th>Pend. conciliação</th><td>${escapeHtml(toBRL(payable.pending_reconciliation_brl))}</td></tr>
          </tbody>
        </table>

        <h2>Contas a receber</h2>
        <table>
          <tbody>
            <tr><th>Total lançado</th><td>${escapeHtml(toBRL(receivable.total_brl))}</td><th>Recebido</th><td>${escapeHtml(toBRL(receivable.settled_brl))}</td></tr>
            <tr><th>Em aberto</th><td>${escapeHtml(toBRL(receivable.open_brl))}</td><th>Vencido</th><td>${escapeHtml(toBRL(receivable.overdue_brl))}</td></tr>
            <tr><th>Pend. aprovação</th><td>${escapeHtml(toBRL(receivable.pending_approval_brl))}</td><th>Pend. conciliação</th><td>${escapeHtml(toBRL(receivable.pending_reconciliation_brl))}</td></tr>
          </tbody>
        </table>

        <h2>Checklist que bloqueia o fechamento</h2>
        ${blockTable(blockers, "blocker")}

        <h2>Alertas antes de fechar</h2>
        ${blockTable(alerts, "alert")}

        <h2>Histórico de snapshots</h2>
        ${historyTable}
      `;

      const ok = openPrintDocument(`Fechamento mensal ${monthLabel(monthKey)}`, html);
      if (!ok) throw new Error("Não foi possível abrir a janela de impressão.");
      setTitlesMsg(`✅ PDF do fechamento ${monthLabel(monthKey)} preparado para impressão.`);
    } catch (err) {
      setTitlesMsg(err?.data?.detail || err?.message || "Falha ao exportar PDF do fechamento.");
    } finally {
      setCloseExportBusy(false);
    }
  }

  useEffect(() => {
    if (screen !== "fechamento_mensal") return;
    handleCloseMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, monthKey]);

  async function onReconFileChange(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setReconCsvText(String(text || ""));
      setReconPreview(null);
      setReconSelections({});
      setReconMsg(`Arquivo carregado: ${file.name}`);
    } catch {
      setReconMsg("Falha ao ler arquivo CSV.");
    }
  }

  async function previewReconciliationImport() {
    if (reconBusy) return;
    const csvText = String(reconCsvText || "").trim();
    if (!csvText) {
      setReconMsg("Cole o extrato CSV ou selecione um arquivo.");
      return;
    }

    const tolerance = parseBRNumber(reconTolerance);
    const dateWindow = Number.parseInt(String(reconWindowDays || "").trim(), 10);

    setReconBusy(true);
    setReconMsg("");
    try {
      const res = await api.post("/finance/reconciliation/preview", {
        csv_text: csvText,
        tolerance_brl: Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 0.05,
        date_window_days: Number.isFinite(dateWindow) && dateWindow >= 0 ? dateWindow : 7,
        max_rows: 1500,
      });
      setReconPreview(res || null);
      setReconSelections({});
      const s = res?.summary || {};
      setReconMsg(
        `✅ Prévia concluída: ${toNum(s.rows || 0, 0)} linhas, ${toNum(s.matched || 0, 0)} matches, ${toNum(s.ambiguous || 0, 0)} ambíguas, ${toNum(s.unmatched || 0, 0)} sem match.`
      );
    } catch (err) {
      setReconPreview(null);
      setReconMsg(err?.data?.detail || err?.message || "Falha na prévia de conciliação.");
    } finally {
      setReconBusy(false);
    }
  }

  async function applyReconciliationImport() {
    if (reconApplyBusy) return;
    const items = Array.isArray(reconPreview?.items) ? reconPreview.items : [];
    const autoMatches = items
      .filter((it) => String(it?.status || "") === "matched" && it?.match?.event_id && it?.match?.kind)
      .map((it) => ({
        row_index: it.row_index,
        movement_date: it.movement_date,
        amount_brl: it.amount_brl,
        note: `Conciliação por importação CSV (linha ${it.row_index})`,
        match: {
          event_id: Number(it.match.event_id),
          kind: String(it.match.kind),
        },
      }));

    const manualMatches = items
      .filter((it) => String(it?.status || "") === "ambiguous")
      .map((it) => {
        const selectedKey = reconSelections[String(it?.row_index || "")];
        const parsed = parseReconMatchKey(selectedKey);
        if (!parsed) return null;
        return {
          row_index: it.row_index,
          movement_date: it.movement_date,
          amount_brl: it.amount_brl,
          note: `Conciliação manual por importação CSV (linha ${it.row_index})`,
          match: parsed,
        };
      })
      .filter(Boolean);

    const matches = [...autoMatches, ...manualMatches];

    if (!matches.length) {
      setReconMsg("Não há matches prontos para aplicar.");
      return;
    }

    setReconApplyBusy(true);
    setReconMsg("");
    try {
      const res = await api.post("/finance/reconciliation/apply", {
        actor: approverUser || "ui",
        matches,
      });
      const s = res?.summary || {};
      setReconMsg(
        `✅ Conciliação aplicada: ${toNum(s.applied || 0, 0)} títulos conciliados, ${toNum(s.skipped || 0, 0)} ignorados.`
      );
      setReconPreview(null);
      setReconSelections({});
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setReconMsg(err?.data?.detail || err?.message || "Falha ao aplicar conciliação.");
    } finally {
      setReconApplyBusy(false);
    }
  }

  const renderHub = () => (
    <section className="faz-fin-hub">
      {REPORTS.map((r) => (
        <button key={r.key} type="button" className="faz-fin-hub-card" onClick={() => setScreen(r.key)}>
          <div className="t">{r.title}</div>
          <div className="d">{r.desc}</div>
        </button>
      ))}
    </section>
  );

  const renderLancamentos = () => {
    const selectedCostAccount = accountsCostOptions.find((a) => String(a?.code || "") === String(finCostForm.account_code || ""));
    const selectedRevAccount = accountsRevenueOptions.find((a) => String(a?.code || "") === String(finRevForm.account_code || ""));
    const selectedSupplier = suppliers.find((p) => String(p?.id || "") === String(finCostForm.supplier_id || ""));
    const selectedCustomer = customers.find((p) => String(p?.id || "") === String(finRevForm.customer_id || ""));

    return (
      <>
        <div className="faz-fin-switches">
          <button type="button" className={`chip ${lancamentosSubtab === "lancamentos" ? "rec" : ""}`} onClick={() => setLancamentosSubtab("lancamentos")}>
            Lançamentos
          </button>
          <button type="button" className={`chip ${lancamentosSubtab === "pessoas_empresas" ? "rec" : ""}`} onClick={() => setLancamentosSubtab("pessoas_empresas")}>
            Pessoas e empresas
          </button>
        </div>

        {lancamentosSubtab === "pessoas_empresas" ? (
          <FinanceiroCadastros embedded hideHeader showAccounts={false} showPeople />
        ) : (
          <>
            <div className="faz-fin-kpis">
              <div className="kpi"><span>Contas N4 (despesa)</span><b>{toNum(accountsCostOptions.length, 0)}</b></div>
              <div className="kpi"><span>Contas N4 (receita)</span><b>{toNum(accountsRevenueOptions.length, 0)}</b></div>
              <div className="kpi"><span>Fornecedores</span><b>{toNum(suppliers.length, 0)}</b></div>
              <div className="kpi"><span>Clientes</span><b>{toNum(customers.length, 0)}</b></div>
            </div>

            <div className="faz-fin-note">
              Regra ativa: despesa exige <b>fornecedor</b> e receita exige <b>cliente</b>. Ambos exigem <b>conta N4</b>.
              Cadastros ficam em <b>Custos & Receitas → Lançamentos → Pessoas e empresas</b>.
            </div>

            <div className="faz-fin-switches">
          <button type="button" className={`chip ${finTab === "despesa" ? "rec" : ""}`} onClick={() => setFinTab("despesa")}>
            Nova despesa
          </button>
          <button type="button" className={`chip ${finTab === "receita" ? "rec" : ""}`} onClick={() => setFinTab("receita")}>
            Nova receita
          </button>
        </div>

        <div className="faz-fin-launch-grid">
          {finTab === "despesa" ? (
            <form onSubmit={submitFinanceCost} className="faz-fin-tableWrap faz-fin-launch-card">
              <h4>Registrar despesa</h4>
              <div className="faz-fin-filters faz-fin-filters-4">
                <label className="faz-field">
                  <span className="faz-field-label">Data do lançamento</span>
                  <input className="faz-input" type="date" value={finCostForm.date} onChange={(e) => updateFinCost("date", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Data de vencimento</span>
                  <input className="faz-input" type="date" value={finCostForm.due_date} onChange={(e) => updateFinCost("due_date", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Mês de competência</span>
                  <input className="faz-input" type="month" value={finCostForm.competence_month} onChange={(e) => updateFinCost("competence_month", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Status</span>
                  <select className="faz-input" value={finCostForm.status} onChange={(e) => updateFinCost("status", e.target.value)}>
                    <option value="open">Em aberto</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </label>
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <select className="faz-input" value={finCostForm.account_code} onChange={(e) => updateFinCost("account_code", e.target.value)}>
                  {accountsCostOptions.length ? (
                    accountsCostOptions.map((a) => (
                      <option key={a.code} value={a.code}>{accountOptionLabel(a)}</option>
                    ))
                  ) : (
                    <option value="">Sem conta N4 de despesa</option>
                  )}
                </select>
                <select className="faz-input" value={finCostForm.supplier_id} onChange={(e) => updateFinCost("supplier_id", e.target.value)}>
                  {suppliers.length ? (
                    suppliers.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))
                  ) : (
                    <option value="">Sem fornecedor cadastrado</option>
                  )}
                </select>
                <input className="faz-input" value={finCostForm.category} onChange={(e) => updateFinCost("category", e.target.value)} placeholder="Categoria (opcional)" />
                <input className="faz-input" value={finCostForm.center_cost} onChange={(e) => updateFinCost("center_cost", e.target.value)} placeholder="Centro de custo" />
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <input className="faz-input" inputMode="decimal" value={finCostForm.value_brl} onChange={(e) => updateFinCost("value_brl", e.target.value)} placeholder="Valor (R$)" />
                <input className="faz-input" inputMode="decimal" value={finCostForm.planned_value_brl} onChange={(e) => updateFinCost("planned_value_brl", e.target.value)} placeholder="Previsto (R$, opcional)" />
                <select className="faz-input" value={finCostForm.cost_kind} onChange={(e) => updateFinCost("cost_kind", e.target.value)}>
                  <option value="operational">Operacional</option>
                  <option value="investment">Investimento</option>
                </select>
                <input className="faz-input" value={finCostForm.doc_number} onChange={(e) => updateFinCost("doc_number", e.target.value)} placeholder="Documento/NF" />
              </div>
              <div className="faz-fin-filters">
                <input className="faz-input" value={finCostForm.notes} onChange={(e) => updateFinCost("notes", e.target.value)} placeholder="Histórico / observações" />
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <label className="faz-field faz-check-inline">
                  <input
                    type="checkbox"
                    checked={!!finCostForm.requires_approval}
                    onChange={(e) => updateFinCost("requires_approval", e.target.checked)}
                  />
                  <span>Exigir aprovação antes do pagamento</span>
                </label>
                <select className="faz-input" value={finCostForm.approval_required_by} onChange={(e) => updateFinCost("approval_required_by", e.target.value)}>
                  <option value="gestor">Aprovação: Gestor</option>
                  <option value="admin">Aprovação: Admin</option>
                  <option value="financeiro">Aprovação: Financeiro</option>
                  <option value="rh">Aprovação: RH</option>
                </select>
                <input className="faz-input" value={finCostForm.approval_note} onChange={(e) => updateFinCost("approval_note", e.target.value)} placeholder="Motivo da aprovação (opcional)" />
                <div />
              </div>
              <div className="faz-fin-switches">
                <button type="submit" className="btn-refresh" disabled={finSaving || !accountsCostOptions.length || !suppliers.length}>
                  {finSaving ? "Salvando..." : "Salvar despesa"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitFinanceRevenue} className="faz-fin-tableWrap faz-fin-launch-card">
              <h4>Registrar receita</h4>
              <div className="faz-fin-filters faz-fin-filters-4">
                <label className="faz-field">
                  <span className="faz-field-label">Data do lançamento</span>
                  <input className="faz-input" type="date" value={finRevForm.date} onChange={(e) => updateFinRev("date", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Data de vencimento</span>
                  <input className="faz-input" type="date" value={finRevForm.due_date} onChange={(e) => updateFinRev("due_date", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Mês de competência</span>
                  <input className="faz-input" type="month" value={finRevForm.competence_month} onChange={(e) => updateFinRev("competence_month", e.target.value)} />
                </label>
                <label className="faz-field">
                  <span className="faz-field-label">Status</span>
                  <select className="faz-input" value={finRevForm.status} onChange={(e) => updateFinRev("status", e.target.value)}>
                    <option value="open">Em aberto</option>
                    <option value="received">Recebido</option>
                  </select>
                </label>
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <select className="faz-input" value={finRevForm.account_code} onChange={(e) => updateFinRev("account_code", e.target.value)}>
                  {accountsRevenueOptions.length ? (
                    accountsRevenueOptions.map((a) => (
                      <option key={a.code} value={a.code}>{accountOptionLabel(a)}</option>
                    ))
                  ) : (
                    <option value="">Sem conta N4 de receita</option>
                  )}
                </select>
                <select className="faz-input" value={finRevForm.customer_id} onChange={(e) => updateFinRev("customer_id", e.target.value)}>
                  {customers.length ? (
                    customers.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))
                  ) : (
                    <option value="">Sem cliente cadastrado</option>
                  )}
                </select>
                <input className="faz-input" value={finRevForm.category} onChange={(e) => updateFinRev("category", e.target.value)} placeholder="Categoria (opcional)" />
                <input className="faz-input" value={finRevForm.center_cost} onChange={(e) => updateFinRev("center_cost", e.target.value)} placeholder="Centro de custo" />
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <input className="faz-input" inputMode="decimal" value={finRevForm.value_brl} onChange={(e) => updateFinRev("value_brl", e.target.value)} placeholder="Valor (R$)" />
                <input className="faz-input" inputMode="decimal" value={finRevForm.planned_value_brl} onChange={(e) => updateFinRev("planned_value_brl", e.target.value)} placeholder="Previsto (R$, opcional)" />
                <input className="faz-input" inputMode="decimal" value={finRevForm.arrobas} onChange={(e) => updateFinRev("arrobas", e.target.value)} placeholder="Arrobas (opcional)" />
                <input className="faz-input" value={finRevForm.doc_number} onChange={(e) => updateFinRev("doc_number", e.target.value)} placeholder="Documento/NF" />
              </div>
              <div className="faz-fin-filters">
                <input className="faz-input" value={finRevForm.notes} onChange={(e) => updateFinRev("notes", e.target.value)} placeholder="Histórico / observações" />
              </div>
              <div className="faz-fin-filters faz-fin-filters-4">
                <label className="faz-field faz-check-inline">
                  <input
                    type="checkbox"
                    checked={!!finRevForm.requires_approval}
                    onChange={(e) => updateFinRev("requires_approval", e.target.checked)}
                  />
                  <span>Exigir aprovação antes do recebimento</span>
                </label>
                <select className="faz-input" value={finRevForm.approval_required_by} onChange={(e) => updateFinRev("approval_required_by", e.target.value)}>
                  <option value="gestor">Aprovação: Gestor</option>
                  <option value="admin">Aprovação: Admin</option>
                  <option value="financeiro">Aprovação: Financeiro</option>
                  <option value="rh">Aprovação: RH</option>
                </select>
                <input className="faz-input" value={finRevForm.approval_note} onChange={(e) => updateFinRev("approval_note", e.target.value)} placeholder="Motivo da aprovação (opcional)" />
                <div />
              </div>
              <div className="faz-fin-switches">
                <button type="submit" className="btn-refresh" disabled={finSaving || !accountsRevenueOptions.length || !customers.length}>
                  {finSaving ? "Salvando..." : "Salvar receita"}
                </button>
              </div>
            </form>
          )}

          <div className="faz-fin-tableWrap faz-fin-launch-card">
            <h4>Conferência do lançamento</h4>
            {finTab === "despesa" ? (
              <>
                <div className="faz-fin-note">
                  Conta: <b>{selectedCostAccount ? accountOptionLabel(selectedCostAccount) : "—"}</b>
                  <br />
                  Fornecedor: <b>{selectedSupplier?.name || "—"}</b>
                  <br />
                  Tipo de custo: <b>{finCostForm.cost_kind === "investment" ? "Investimento" : "Operacional"}</b>
                </div>
                <div className="faz-fin-note">
                  Valor: <b>{toBRL(parseBRNumber(finCostForm.value_brl))}</b> • Status: <b>{finCostForm.status}</b>
                  <br />
                  Aprovação: <b>{finCostForm.requires_approval ? `Pendente (${finCostForm.approval_required_by})` : "Não exigida"}</b>
                </div>
              </>
            ) : (
              <>
                <div className="faz-fin-note">
                  Conta: <b>{selectedRevAccount ? accountOptionLabel(selectedRevAccount) : "—"}</b>
                  <br />
                  Cliente: <b>{selectedCustomer?.name || "—"}</b>
                  <br />
                  Arrobas: <b>{toNum(parseBRNumber(finRevForm.arrobas), 2)}</b>
                </div>
                <div className="faz-fin-note">
                  Valor: <b>{toBRL(parseBRNumber(finRevForm.value_brl))}</b> • Status: <b>{finRevForm.status}</b>
                  <br />
                  Aprovação: <b>{finRevForm.requires_approval ? `Pendente (${finRevForm.approval_required_by})` : "Não exigida"}</b>
                </div>
              </>
            )}

            {!accountsCostOptions.length || !accountsRevenueOptions.length ? (
              <div className="faz-fin-alert">Plano de contas N4 não encontrado. Abra Custos & Receitas → Lançamentos → Pessoas e empresas e rode “Atualizar seed”.</div>
            ) : null}
            {!suppliers.length || !customers.length ? (
              <div className="faz-fin-alert">Faltam pessoas de tipo cliente/fornecedor. Cadastre em Custos & Receitas → Lançamentos → Pessoas e empresas.</div>
            ) : null}
            {finMsg ? <div className={`chip ${finMsg.includes("✅") ? "ok" : "bad"}`}>{finMsg}</div> : null}
          </div>
        </div>
          </>
        )}
      </>
    );
  };

  const renderPagar = () => (
    <>
      <div className={`faz-fin-queueContext tone-${payContextSummary.tone}`}>
        <div className="main">
          <div className="eyebrow">Fila operacional</div>
          <h4>{payContextSummary.title}</h4>
          <p>{payContextSummary.detail}</p>
          <p className="helper">{payContextSummary.helper}</p>
        </div>
        <div className="metrics">
          <div className="mini">
            <span>Aprovação</span>
            <b>{toNum(payableQueueStats.approval.count, 0)}</b>
            <small>{toBRL(payableQueueStats.approval.amount)}</small>
          </div>
          <div className="mini">
            <span>Conciliação</span>
            <b>{toNum(payableQueueStats.reconciliation.count, 0)}</b>
            <small>{toBRL(payableQueueStats.reconciliation.amount)}</small>
          </div>
          <div className="mini">
            <span>Vencidos</span>
            <b>{toNum(payableQueueStats.overdue.count, 0)}</b>
            <small>{toBRL(payableQueueStats.overdue.amount)}</small>
          </div>
          <div className="mini">
            <span>Sem programação</span>
            <b>{toNum(payableQueueStats.unscheduled.count, 0)}</b>
            <small>{toBRL(payableQueueStats.unscheduled.amount)}</small>
          </div>
        </div>
      </div>
      <div className="faz-fin-queueChips">
        <button type="button" className={`chip ${payFocus === "approval" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("approval")}>
          Aprovação
        </button>
        <button type="button" className={`chip ${payFocus === "reconciliation" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("reconciliation")}>
          Conciliação
        </button>
        <button type="button" className={`chip ${payStatus === "Vencido" && payFocus === "all" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("overdue")}>
          Vencidos
        </button>
        <button type="button" className={`chip ${payFocus === "unscheduled" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("unscheduled")}>
          Sem programação
        </button>
        <button type="button" className={`chip ${payStatus === "Em aberto" && payFocus === "all" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("open")}>
          Em aberto
        </button>
        <button type="button" className={`chip ${payStatus === "ALL" && payFocus === "all" ? "rec" : ""}`} onClick={() => applyPayQueuePreset("all")}>
          Limpar fila
        </button>
      </div>
      <div className="faz-fin-aging">
        <div className="faz-fin-aging-head">
          <div>
            <div className="eyebrow">Aging de pagamento</div>
            <h4>Pressão de caixa por vencimento</h4>
            <p>
              Curto prazo: <b>{toNum(payableAging.shortCount, 0)}</b> título(s) somando <b>{toBRL(payableAging.shortAmount)}</b>.
              Prioridade imediata: <b>{toNum(payableAging.urgentCount, 0)}</b> título(s) em <b>{toBRL(payableAging.urgentAmount)}</b>.
            </p>
          </div>
          {payableAging.buckets.no_due.count > 0 ? (
            <span className="chip warn">
              Sem vencimento: {toNum(payableAging.buckets.no_due.count, 0)} • {toBRL(payableAging.buckets.no_due.amount)}
            </span>
          ) : null}
        </div>
        <div className="faz-fin-aging-grid">
          {payableAgingCards.map((item) => (
            <div key={item.key} className={`faz-fin-aging-card tone-${item.tone}`}>
              <span>{item.title}</span>
              <b>{toNum(item.data.count, 0)}</b>
              <small>{toBRL(item.data.amount)}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="faz-pay-toolbar">
        <div className="left">
          <span className="chip rec">Mensal</span>
          <span className="chip">{pagarPeriodLabel}</span>
          <select className="faz-input pay-prop" value={center} onChange={(e) => setCenter(e.target.value)}>
            <option value="ALL">Propriedades</option>
            {centers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="right">
          <button type="button" className={`chip ${payBreakdown === "category" ? "rec" : ""}`} onClick={() => setPayBreakdown("category")}>
            Por Categoria
          </button>
          <button type="button" className={`chip ${payBreakdown === "center" ? "rec" : ""}`} onClick={() => setPayBreakdown("center")}>
            Por Centro de Custo
          </button>
        </div>
      </div>

      <div className="faz-fin-bars pay-chart-card">
        {payYearMatrix.chart.map((r) => {
          const h = payYearMatrix.max > 0 ? Math.max(14, Math.round((r.total / payYearMatrix.max) * 120)) : 14;
          return (
            <div className="bar-col" key={r.key}>
              <div className="bar-val">{toBRL(r.total)}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${h}px` }} />
              </div>
              <div className="bar-label">{r.key}</div>
            </div>
          );
        })}
        {!payYearMatrix.chart.length ? <div className="faz-fin-note">Sem dados para o gráfico no ano selecionado.</div> : null}
      </div>

      <div className="faz-pay-table-actions">
        <span className="chip">
          Perfil aprovador: {approverRoleLabel(approverRole)} ({approverUser})
        </span>
        <select
          className="faz-input pay-status"
          value={payStatus}
          onChange={(e) => {
            setPayStatus(e.target.value);
            setPayFocus("all");
          }}
        >
          <option value="ALL">Todos status</option>
          <option value="Pendente aprovação">Pendente aprovação</option>
          <option value="Pago">Pago</option>
          <option value="Em aberto">Em aberto</option>
          <option value="Vencido">Vencido</option>
        </select>
        <select className="faz-input pay-status" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">Todas categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="btn-refresh" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>{payBreakdown === "center" ? "Centro de custo" : "Categoria"}</th>
              <th>Total</th>
              <th>%</th>
              {payYearMonths.map((mk) => <th key={mk}>{mk.slice(5, 7)}/{mk.slice(0, 4)}</th>)}
            </tr>
          </thead>
          <tbody>
            {payYearMatrix.rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td>{toBRL(r.total)}</td>
                <td>{toNum(r.pct, 2)}%</td>
                {r.monthValues.map((v, idx) => (
                  <td key={`${r.key}-${idx}`}>{v > 0 ? toBRL(v) : "0"}</td>
                ))}
              </tr>
            ))}
            {!payYearMatrix.rows.length ? <tr><td colSpan={15}>Nenhum resultado encontrado</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Competência</th>
              <th>Vencimento</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Centro</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Aberto</th>
              <th>Aprovação</th>
              <th>Programação</th>
              <th>Conciliação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayableRows.map((r) => {
              const done = r.status_label === "Pago";
              const approvalPending = String(r.approval_status || "").toLowerCase() === "pending";
              const canApprove = canRoleApprove(r.approval_required_by, approverRole);
              const busyFull = titlesBusyId === `pay-${r.event_id}-full`;
              const busyPart = titlesBusyId === `pay-${r.event_id}-partial`;
              const busyApprove = titlesBusyId === `pay-${r.event_id}-approve`;
              const busySchedule = titlesBusyId === `pay-${r.event_id}-schedule`;
              const busyReconcile = titlesBusyId === `pay-${r.event_id}-reconcile`;
              const hasSchedule = !!String(r.scheduled_on || "").trim();
              const recStatus = String(r.reconciliation_status || "not_applicable");
              const canReconcile = asNum(r.settled_brl) > 0 && recStatus !== "reconciled";
              return (
                <tr key={`pay-${r.event_id}`}>
                  <td><span className={`chip ${financeStatusClass(r.status_label)}`}>{r.status_label}</span></td>
                  <td>{r.competence_month || "—"}</td>
                  <td>{r.due_date || r.date || "—"}</td>
                  <td>{r.person_name}</td>
                  <td>{r.category}</td>
                  <td>{r.center}</td>
                  <td>{toBRL(r.total_brl)}</td>
                  <td>{toBRL(r.settled_brl)}</td>
                  <td>{toBRL(r.remaining_brl)}</td>
                  <td>
                    <span className={`chip ${approvalStatusClass(r.approval_status)}`}>
                      {approvalStatusLabel(r.approval_status)}
                    </span>
                    {approvalPending ? <div className="faz-fin-approval-required">Exige: {approverRoleLabel(r.approval_required_by)}</div> : null}
                  </td>
                  <td>
                    {hasSchedule ? (
                      <span className="chip">{r.scheduled_on}{r.schedule_method ? ` • ${r.schedule_method}` : ""}</span>
                    ) : (
                      <span className="chip">Não programado</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${reconciliationStatusClass(recStatus)}`}>
                      {reconciliationStatusLabel(recStatus)}
                    </span>
                    {String(r.reconciled_on || "").trim() ? <div className="faz-fin-approval-required">{r.reconciled_on}</div> : null}
                  </td>
                  <td className="faz-fin-table-actions-inline">
                    <button type="button" className="btn-back" disabled={done || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => schedulePayable(r)}>
                      {busySchedule ? "Programando..." : "Programar"}
                    </button>
                    <button type="button" className="btn-back" disabled={done || approvalPending || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => settlePayable(r, false)}>
                      {busyFull ? "Baixando..." : "Baixar"}
                    </button>
                    <button type="button" className="btn-back" disabled={done || approvalPending || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => settlePayable(r, true)}>
                      {busyPart ? "Processando..." : "Parcial"}
                    </button>
                    <button
                      type="button"
                      className="btn-back"
                      disabled={!canReconcile || busyReconcile || busySchedule || busyFull || busyPart || busyApprove}
                      onClick={() => reconcilePayable(r)}
                      title={canReconcile ? "Conciliar título" : "Conciliação disponível após baixa"}
                    >
                      {busyReconcile ? "Conciliando..." : "Conciliar"}
                    </button>
                    {approvalPending ? (
                      <button
                        type="button"
                        className="btn-back"
                        title={canApprove ? "Aprovar título" : `Seu perfil (${approverRoleLabel(approverRole)}) não pode aprovar este título`}
                        disabled={!canApprove || busyApprove || busySchedule || busyReconcile || busyFull || busyPart}
                        onClick={() => approvePayable(r)}
                      >
                        {busyApprove ? "Aprovando..." : "Aprovar"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!filteredPayableRows.length ? <tr><td colSpan={13}>Sem títulos em contas a pagar no mês selecionado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderReceber = () => (
    <>
      <div className={`faz-fin-queueContext tone-${recvContextSummary.tone}`}>
        <div className="main">
          <div className="eyebrow">Fila operacional</div>
          <h4>{recvContextSummary.title}</h4>
          <p>{recvContextSummary.detail}</p>
          <p className="helper">{recvContextSummary.helper}</p>
        </div>
        <div className="metrics">
          <div className="mini">
            <span>Aprovação</span>
            <b>{toNum(receivableQueueStats.approval.count, 0)}</b>
            <small>{toBRL(receivableQueueStats.approval.amount)}</small>
          </div>
          <div className="mini">
            <span>Conciliação</span>
            <b>{toNum(receivableQueueStats.reconciliation.count, 0)}</b>
            <small>{toBRL(receivableQueueStats.reconciliation.amount)}</small>
          </div>
          <div className="mini">
            <span>Vencidos</span>
            <b>{toNum(receivableQueueStats.overdue.count, 0)}</b>
            <small>{toBRL(receivableQueueStats.overdue.amount)}</small>
          </div>
          <div className="mini">
            <span>Sem programação</span>
            <b>{toNum(receivableQueueStats.unscheduled.count, 0)}</b>
            <small>{toBRL(receivableQueueStats.unscheduled.amount)}</small>
          </div>
        </div>
      </div>
      <div className="faz-fin-queueChips">
        <button type="button" className={`chip ${recvFocus === "approval" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("approval")}>
          Aprovação
        </button>
        <button type="button" className={`chip ${recvFocus === "reconciliation" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("reconciliation")}>
          Conciliação
        </button>
        <button type="button" className={`chip ${recvStatus === "Vencido" && recvFocus === "all" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("overdue")}>
          Vencidos
        </button>
        <button type="button" className={`chip ${recvFocus === "unscheduled" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("unscheduled")}>
          Sem programação
        </button>
        <button type="button" className={`chip ${recvStatus === "Em aberto" && recvFocus === "all" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("open")}>
          Em aberto
        </button>
        <button type="button" className={`chip ${recvStatus === "ALL" && recvFocus === "all" ? "rec" : ""}`} onClick={() => applyRecvQueuePreset("all")}>
          Limpar fila
        </button>
      </div>
      <div className="faz-fin-kpis">
        <div className="kpi"><span>Em aberto</span><b>{toBRL(receberOpen)}</b></div>
        <div className="kpi"><span>Recebidos</span><b>{toBRL(receberRec)}</b></div>
        <div className="kpi"><span>Total período</span><b>{toBRL(receberOpen + receberRec)}</b></div>
        <div className="kpi"><span>Preço médio/@</span><b>{toBRL(summary?.price_per_arroba_brl)}</b></div>
      </div>
      <div className="faz-fin-aging">
        <div className="faz-fin-aging-head">
          <div>
            <div className="eyebrow">Aging de recebimento</div>
            <h4>Risco de cobrança no curto prazo</h4>
            <p>
              Curto prazo: <b>{toNum(receivableAging.shortCount, 0)}</b> título(s) somando <b>{toBRL(receivableAging.shortAmount)}</b>.
              Prioridade imediata: <b>{toNum(receivableAging.urgentCount, 0)}</b> título(s) em <b>{toBRL(receivableAging.urgentAmount)}</b>.
            </p>
          </div>
          {receivableAging.buckets.no_due.count > 0 ? (
            <span className="chip warn">
              Sem vencimento: {toNum(receivableAging.buckets.no_due.count, 0)} • {toBRL(receivableAging.buckets.no_due.amount)}
            </span>
          ) : null}
        </div>
        <div className="faz-fin-aging-grid">
          {receivableAgingCards.map((item) => (
            <div key={item.key} className={`faz-fin-aging-card tone-${item.tone}`}>
              <span>{item.title}</span>
              <b>{toNum(item.data.count, 0)}</b>
              <small>{toBRL(item.data.amount)}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="faz-pay-table-actions">
        <span className="chip">
          Perfil aprovador: {approverRoleLabel(approverRole)} ({approverUser})
        </span>
      </div>
      <div className="faz-fin-filters faz-fin-filters-4">
        <input className="faz-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título/categoria..." />
        <select
          className="faz-input"
          value={recvStatus}
          onChange={(e) => {
            setRecvStatus(e.target.value);
            setRecvFocus("all");
          }}
        >
          <option value="ALL">Todos status</option>
          <option value="Pendente aprovação">Pendente aprovação</option>
          <option value="Recebido">Recebido</option>
          <option value="Em aberto">Em aberto</option>
          <option value="Vencido">Vencido</option>
        </select>
        <select className="faz-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">Todas categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="faz-input" value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="ALL">Todos centros</option>
          {centers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr><th>Situação</th><th>Data</th><th>Título</th><th>Categoria</th><th>Centro</th><th>@</th><th>Preço/@</th><th>Total</th></tr>
          </thead>
          <tbody>
            {filteredRecvRows.map((r) => (
              <tr key={r.id}>
                <td><span className={`chip ${r.status === "Recebido" ? "rec" : "warn"}`}>{r.status}</span></td>
                <td>{r.date}</td>
                <td>{r.title}</td>
                <td>{r.category}</td>
                <td>{r.center}</td>
                <td>{Number.isFinite(r.arrobas) ? toNum(r.arrobas, 2) : "—"}</td>
                <td>{Number.isFinite(r.price) ? toBRL(r.price) : "—"}</td>
                <td>{Number.isFinite(r.total) ? toBRL(r.total) : "—"}</td>
              </tr>
            ))}
            {!filteredRecvRows.length ? <tr><td colSpan={8}>Nenhum resultado encontrado</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Competência</th>
              <th>Vencimento</th>
              <th>Cliente</th>
              <th>Categoria</th>
              <th>Centro</th>
              <th>Total</th>
              <th>Recebido</th>
              <th>Aberto</th>
              <th>Aprovação</th>
              <th>Programação</th>
              <th>Conciliação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceivableRows.map((r) => {
              const done = r.status_label === "Recebido";
              const approvalPending = String(r.approval_status || "").toLowerCase() === "pending";
              const canApprove = canRoleApprove(r.approval_required_by, approverRole);
              const busyFull = titlesBusyId === `recv-${r.event_id}-full`;
              const busyPart = titlesBusyId === `recv-${r.event_id}-partial`;
              const busyApprove = titlesBusyId === `recv-${r.event_id}-approve`;
              const busySchedule = titlesBusyId === `recv-${r.event_id}-schedule`;
              const busyReconcile = titlesBusyId === `recv-${r.event_id}-reconcile`;
              const hasSchedule = !!String(r.scheduled_on || "").trim();
              const recStatus = String(r.reconciliation_status || "not_applicable");
              const canReconcile = asNum(r.settled_brl) > 0 && recStatus !== "reconciled";
              return (
                <tr key={`recv-${r.event_id}`}>
                  <td><span className={`chip ${financeStatusClass(r.status_label)}`}>{r.status_label}</span></td>
                  <td>{r.competence_month || "—"}</td>
                  <td>{r.due_date || r.date || "—"}</td>
                  <td>{r.person_name}</td>
                  <td>{r.category}</td>
                  <td>{r.center}</td>
                  <td>{toBRL(r.total_brl)}</td>
                  <td>{toBRL(r.settled_brl)}</td>
                  <td>{toBRL(r.remaining_brl)}</td>
                  <td>
                    <span className={`chip ${approvalStatusClass(r.approval_status)}`}>
                      {approvalStatusLabel(r.approval_status)}
                    </span>
                    {approvalPending ? <div className="faz-fin-approval-required">Exige: {approverRoleLabel(r.approval_required_by)}</div> : null}
                  </td>
                  <td>
                    {hasSchedule ? (
                      <span className="chip">{r.scheduled_on}{r.schedule_method ? ` • ${r.schedule_method}` : ""}</span>
                    ) : (
                      <span className="chip">Não programado</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${reconciliationStatusClass(recStatus)}`}>
                      {reconciliationStatusLabel(recStatus)}
                    </span>
                    {String(r.reconciled_on || "").trim() ? <div className="faz-fin-approval-required">{r.reconciled_on}</div> : null}
                  </td>
                  <td className="faz-fin-table-actions-inline">
                    <button type="button" className="btn-back" disabled={done || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => scheduleReceivable(r)}>
                      {busySchedule ? "Programando..." : "Programar"}
                    </button>
                    <button type="button" className="btn-back" disabled={done || approvalPending || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => settleReceivable(r, false)}>
                      {busyFull ? "Recebendo..." : "Baixar"}
                    </button>
                    <button type="button" className="btn-back" disabled={done || approvalPending || busySchedule || busyReconcile || busyFull || busyPart || busyApprove} onClick={() => settleReceivable(r, true)}>
                      {busyPart ? "Processando..." : "Parcial"}
                    </button>
                    <button
                      type="button"
                      className="btn-back"
                      disabled={!canReconcile || busyReconcile || busySchedule || busyFull || busyPart || busyApprove}
                      onClick={() => reconcileReceivable(r)}
                      title={canReconcile ? "Conciliar título" : "Conciliação disponível após recebimento"}
                    >
                      {busyReconcile ? "Conciliando..." : "Conciliar"}
                    </button>
                    {approvalPending ? (
                      <button
                        type="button"
                        className="btn-back"
                        title={canApprove ? "Aprovar título" : `Seu perfil (${approverRoleLabel(approverRole)}) não pode aprovar este título`}
                        disabled={!canApprove || busyApprove || busySchedule || busyReconcile || busyFull || busyPart}
                        onClick={() => approveReceivable(r)}
                      >
                        {busyApprove ? "Aprovando..." : "Aprovar"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!filteredReceivableRows.length ? <tr><td colSpan={13}>Sem títulos em contas a receber no mês selecionado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderFechamentoMensal = () => {
    const close = closeSummary || {};
    const payable = close.payable || {};
    const receivable = close.receivable || {};
    const result = close.result || {};
    const history = Array.isArray(closeHistory) ? closeHistory : [];
    const latestSaved = close.latest_saved || history[0] || null;
    const monthState = closeMonthState || close.month_state || {};
    const monthLocked = !!monthState?.is_locked;
    const checklist = buildCloseChecklist(close);
    const diffCards = buildCloseDiffCards(close, latestSaved);
    const okCount = checklist.filter((item) => item.ok).length;
    const badCount = checklist.length - okCount;
    const blockers = checklist.filter((item) => item.level === "blocker");
    const alerts = checklist.filter((item) => item.level === "alert");
    const blockerPending = blockers.filter((item) => !item.ok).length;
    const alertPending = alerts.filter((item) => !item.ok).length;
    const readiness = buildCloseReadiness({
      monthLocked,
      blockerPending,
      alertPending,
      pendingItems: checklist.filter((item) => !item.ok),
    });
    const lockButtonLabel = monthLocked
      ? "Destravar mês"
      : blockerPending > 0
        ? "Travar mesmo assim"
        : alertPending > 0
          ? "Travar com ressalvas"
          : "Travar mês";

    return (
      <>
        <div className="faz-fin-note">
          Fechamento do período <b>{monthLabel(monthKey)}</b>. Esta tela mostra o que ainda impede um mês limpo:
          títulos em aberto, vencidos, pendentes de aprovação e pendentes de conciliação.
          {latestSaved ? (
            <>
              {" "}Último snapshot salvo em <b>{formatDateTimeBR(latestSaved.created_at)}</b> por <b>{latestSaved.actor || "ui"}</b>.
            </>
          ) : null}
        </div>

        <div className={`faz-fin-close-status tone-${readiness.tone}`}>
          <div className="main">
            <span className="eyebrow">{monthLocked ? "Status do mês" : "Prontidão de fechamento"}</span>
            <h3>{readiness.title}</h3>
            <p>{readiness.summary}</p>
            <small>{readiness.helper}</small>
            {monthLocked && monthState?.locked_at ? (
              <small>
                Travado em {formatDateTimeBR(monthState.locked_at)} por {monthState?.locked_by || "usuário"}.
              </small>
            ) : (
              <small>
                {`Enquanto o mês estiver aberto, ainda é possível lançar, aprovar, programar, baixar e conciliar em ${monthLabel(monthKey)}.`}
              </small>
            )}
          </div>
          <div className="side">
            <div className="metric">
              <span>Bloqueios</span>
              <b>{toNum(blockerPending, 0)}</b>
            </div>
            <div className="metric">
              <span>Alertas</span>
              <b>{toNum(alertPending, 0)}</b>
            </div>
            <div className="metric">
              <span>Snapshot</span>
              <b>{latestSaved ? "Salvo" : "Não salvo"}</b>
            </div>
          </div>
          {readiness.reasons?.length ? (
            <div className="reasons">
              {readiness.reasons.map((item) => (
                <div key={item.key} className={`reason ${item.level}`}>
                  <b>{item.title}</b>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="faz-fin-kpis">
          <div className="kpi"><span>Checklist OK</span><b>{toNum(okCount, 0)}</b></div>
          <div className="kpi"><span>Pendências</span><b>{toNum(badCount, 0)}</b></div>
          <div className="kpi"><span>Bloqueios</span><b>{toNum(blockerPending, 0)}</b></div>
          <div className="kpi"><span>Alertas</span><b>{toNum(alertPending, 0)}</b></div>
          <div className="kpi"><span>Saldo liquidado</span><b>{toBRL(result.net_settled_brl)}</b></div>
          <div className="kpi"><span>Saldo aberto</span><b>{toBRL(result.net_open_brl)}</b></div>
        </div>

        {latestSaved ? (
          <div className="faz-fin-close-card">
            <div className="faz-fin-aging-head">
              <div>
                <div className="eyebrow">Comparação</div>
                <h4>Atual x último snapshot salvo</h4>
                <p>
                  Comparando com o registro salvo em <b>{formatDateTimeBR(latestSaved.created_at)}</b> por <b>{latestSaved.actor || "ui"}</b>.
                  Isso mostra se o mês mudou depois do último fechamento registrado.
                </p>
              </div>
              <span className="chip">{monthLabel(monthKey)}</span>
            </div>
            <div className="faz-fin-close-diff-grid">
              {diffCards.map((item) => (
                <div key={item.key} className={`faz-fin-close-diff-card tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <b>{toBRL(item.now)}</b>
                  <small>Snapshot: {toBRL(item.old)}</small>
                  <em>{closeDiffLabel(item.delta)}</em>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="faz-fin-close-grid">
          <div className="faz-fin-close-card">
            <div className="eyebrow">Contas a pagar</div>
            <h4>Saídas do mês</h4>
            <div className="faz-fin-close-lines">
              <div><span>Total lançado</span><b>{toBRL(payable.total_brl)}</b></div>
              <div><span>Pago</span><b>{toBRL(payable.settled_brl)}</b></div>
              <div><span>Em aberto</span><b>{toBRL(payable.open_brl)}</b></div>
              <div><span>Vencido</span><b>{toBRL(payable.overdue_brl)}</b></div>
              <div><span>Pendente aprovação</span><b>{toBRL(payable.pending_approval_brl)}</b></div>
              <div><span>Pendente conciliação</span><b>{toBRL(payable.pending_reconciliation_brl)}</b></div>
            </div>
          </div>

          <div className="faz-fin-close-card">
            <div className="eyebrow">Contas a receber</div>
            <h4>Entradas do mês</h4>
            <div className="faz-fin-close-lines">
              <div><span>Total lançado</span><b>{toBRL(receivable.total_brl)}</b></div>
              <div><span>Recebido</span><b>{toBRL(receivable.settled_brl)}</b></div>
              <div><span>Em aberto</span><b>{toBRL(receivable.open_brl)}</b></div>
              <div><span>Vencido</span><b>{toBRL(receivable.overdue_brl)}</b></div>
              <div><span>Pendente aprovação</span><b>{toBRL(receivable.pending_approval_brl)}</b></div>
              <div><span>Pendente conciliação</span><b>{toBRL(receivable.pending_reconciliation_brl)}</b></div>
            </div>
          </div>
        </div>

        <div className="faz-fin-close-card">
          <div className="faz-fin-aging-head">
            <div>
              <div className="eyebrow">Checklist</div>
              <h4>O que ainda trava o fechamento</h4>
              <p>
                O ideal é fechar o mês com tudo aprovado, conciliado e sem vencidos. Se ainda houver saldo aberto,
                ele precisa estar conscientemente carregado para o mês seguinte.
              </p>
            </div>
            <button type="button" className="btn-refresh" onClick={handleCloseMonth} disabled={closeBusy}>
              {closeBusy ? "Atualizando..." : "Atualizar checklist"}
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveCloseMonth} disabled={closeSaveBusy}>
              {closeSaveBusy ? "Registrando..." : "Registrar fechamento"}
            </button>
            <button
              type="button"
              className={monthLocked ? "btn-warn" : "btn-primary"}
              onClick={() => handleLockCloseMonth(monthLocked)}
              disabled={closeLockBusy}
            >
              {closeLockBusy ? "Processando..." : lockButtonLabel}
            </button>
            <button type="button" className="btn-refresh" onClick={exportCloseMonthCsv} disabled={closeExportBusy}>
              {closeExportBusy ? "Exportando..." : "Exportar CSV"}
            </button>
            <button type="button" className="btn-refresh" onClick={exportCloseMonthPdf} disabled={closeExportBusy}>
              {closeExportBusy ? "Exportando..." : "Exportar PDF"}
            </button>
          </div>
          <div className="faz-fin-close-checklist">
            <div className="faz-fin-close-section">
              <div className="faz-fin-close-section-head">
                <b>Bloqueia fechamento</b>
                <span className={`chip ${blockerPending ? "bad" : "ok"}`}>
                  {blockerPending ? `${toNum(blockerPending, 0)} pendência(s)` : "Tudo liberado"}
                </span>
              </div>
              {blockers.map((item) => {
                const body = (
                  <>
                    <span className={`chip ${item.ok ? "ok" : "bad"}`}>{item.ok ? "OK" : "Bloqueia"}</span>
                    <div className="body">
                      <b>{item.title}</b>
                      <small>{item.detail}</small>
                      <small className="helper-link">Abrir fila correspondente</small>
                    </div>
                  </>
                );
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`faz-fin-close-check actionable ${item.ok ? "ok" : "bad"}`}
                    onClick={() => openCloseChecklistItem(item.key)}
                  >
                    {body}
                  </button>
                );
              })}
            </div>

            <div className="faz-fin-close-section">
              <div className="faz-fin-close-section-head">
                <b>Atenção antes de fechar</b>
                <span className={`chip ${alertPending ? "warn" : "ok"}`}>
                  {alertPending ? `${toNum(alertPending, 0)} alerta(s)` : "Sem alertas"}
                </span>
              </div>
              {alerts.map((item) => {
                const actionable = item.key !== "net-open";
                const body = (
                  <>
                    <span className={`chip ${item.ok ? "ok" : "warn"}`}>{item.ok ? "OK" : "Atenção"}</span>
                    <div className="body">
                      <b>{item.title}</b>
                      <small>{item.detail}</small>
                      {actionable ? <small className="helper-link">Abrir fila correspondente</small> : <small className="helper-link">Indicador consolidado do mês</small>}
                    </div>
                  </>
                );

                if (!actionable) {
                  return (
                    <div key={item.key} className={`faz-fin-close-check ${item.ok ? "ok" : "warn"}`}>
                      {body}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`faz-fin-close-check actionable ${item.ok ? "ok" : "warn"}`}
                    onClick={() => openCloseChecklistItem(item.key)}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="faz-fin-close-grid">
          <div className="faz-fin-close-card">
            <div className="eyebrow">Último registro salvo</div>
            <h4>Snapshot oficial do mês</h4>
            {latestSaved ? (
              <div className="faz-fin-close-lines">
                <div><span>Registrado em</span><b>{formatDateTimeBR(latestSaved.created_at)}</b></div>
                <div><span>Responsável</span><b>{latestSaved.actor || "ui"}</b></div>
                <div><span>Saldo liquidado</span><b>{toBRL(latestSaved.net_settled_brl)}</b></div>
                <div><span>Saldo aberto</span><b>{toBRL(latestSaved.net_open_brl)}</b></div>
                <div><span>A pagar em aberto</span><b>{toBRL(latestSaved.payable_open_brl)}</b></div>
                <div><span>A receber em aberto</span><b>{toBRL(latestSaved.receivable_open_brl)}</b></div>
              </div>
            ) : (
              <p className="faz-fin-close-empty">
                Ainda não existe snapshot salvo para {monthLabel(monthKey)}. Use <b>Registrar fechamento</b> quando quiser congelar a visão do mês.
              </p>
            )}
          </div>

          <div className="faz-fin-close-card">
            <div className="eyebrow">Histórico</div>
            <h4>Últimos fechamentos registrados</h4>
            {history.length ? (
              <div className="faz-fin-close-history">
                {history.map((item) => (
                  <div key={item.id || `${item.month}-${item.created_at}`} className="faz-fin-close-history-item">
                    <div className="main">
                      <b>{formatDateTimeBR(item.created_at)}</b>
                      <small>{item.actor || "ui"} • saldo aberto {toBRL(item.net_open_brl)}</small>
                    </div>
                    <div className="side">
                      <span>{toBRL(item.net_settled_brl)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="faz-fin-close-empty">
                Nenhum fechamento salvo ainda para este mês.
              </p>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderDRE = () => (
    <>
      <div className="faz-fin-kpis">
        <div className="kpi"><span>Receita Bruta</span><b>{toBRL(receita)}</b></div>
        <div className="kpi"><span>Despesas Operacionais</span><b>{toBRL(costOp)}</b></div>
        <div className="kpi"><span>Investimentos</span><b>{toBRL(investment)}</b></div>
        <div className="kpi"><span>Lucro Operacional</span><b>{toBRL(lucroOperacional)}</b></div>
        <div className="kpi"><span>Lucro por Hectare</span><b>{lucroHa == null ? "—" : toBRL(lucroHa)}</b></div>
      </div>
      <div className="faz-fin-filters">
        <input className="faz-input" inputMode="decimal" placeholder="Hectares (ex: 120)" value={hectares} onChange={(e) => setHectares(e.target.value)} />
      </div>
      <div className="faz-fin-note">Investimento não entra no custo efetivo para cálculo da margem operacional.</div>
      <div className="faz-fin-note">
        Comparativo vs {monthLabel(prevKey)}: Receita {toBRL(receita - prevReceita)} | Despesa {toBRL(costOp - prevCostOp)} | Resultado {toBRL((receita - costOp) - (prevReceita - prevCostOp))}
      </div>
    </>
  );

  const renderPrevReal = (type) => {
    const isReceita = type === "receita";
    const rows = isReceita ? receitaPrevRealRows : despesaPrevRealRows;
    const prev = isReceita ? receitaPrevTotal : despesaPrevTotal;
    const real = isReceita ? receitaRealTotal : despesaRealTotal;
    const desvio = real - prev;

    return (
      <>
        <div className="faz-fin-kpis">
          <div className="kpi"><span>Previsto</span><b>{toBRL(prev)}</b></div>
          <div className="kpi"><span>Realizado</span><b>{toBRL(real)}</b></div>
          <div className="kpi"><span>Diferença</span><b>{toBRL(desvio)}</b></div>
          <div className="kpi"><span>Aderência</span><b>{prev > 0 ? `${toNum((real / prev) * 100, 1)}%` : "—"}</b></div>
        </div>
        <div className="faz-fin-note">
          {isReceita
            ? "Previsto usa planned_value_brl quando informado; senão usa valor do próprio lançamento."
            : "Para despesas, realizados consideram lançamentos com status Pago."}
        </div>
        <div className="faz-fin-tableWrap">
          <table className="faz-fin-table">
            <thead>
              <tr><th>Categoria</th><th>Centro</th><th>Previsto</th><th>Realizado</th><th>Diferença</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.category}-${r.center}`}>
                  <td>{r.category}</td>
                  <td>{r.center}</td>
                  <td>{toBRL(r.previsto)}</td>
                  <td>{toBRL(r.realizado)}</td>
                  <td><span className={`chip ${r.variacao > 0 ? "warn" : "ok"}`}>{toBRL(r.variacao)}</span></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={5}>Sem dados no período selecionado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderRH = () => (
    <>
      <div className="faz-fin-kpis">
        <div className="kpi"><span>Total RH</span><b>{toBRL(rhTotal)}</b></div>
        <div className="kpi"><span>Pago</span><b>{toBRL(rhPago)}</b></div>
        <div className="kpi"><span>Em aberto</span><b>{toBRL(rhAberto)}</b></div>
        <div className="kpi"><span>Vencido</span><b>{toBRL(rhVencido)}</b></div>
      </div>
      <div className="faz-fin-note">
        Lançamentos de RH entram como custo operacional e impactam DRE, Pagamentos e Fluxo de Caixa.
      </div>

      <div className="faz-fin-tableWrap" style={{ padding: 12 }}>
        <div className="faz-fin-note" style={{ marginTop: 0 }}>
          <b>Modelo de folha mensal</b>: cria automaticamente salários, encargos e benefícios do mês.
        </div>
        <div className="faz-fin-filters faz-fin-filters-4">
          <select className="faz-input" value={rhModelKey} onChange={(e) => setRhModelKey(e.target.value)}>
            {RH_MONTHLY_MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <input className="faz-input" type="month" value={rhModelMonth} onChange={(e) => setRhModelMonth(e.target.value)} />
          <input className="faz-input" value={rhModelCenter} onChange={(e) => setRhModelCenter(e.target.value)} placeholder="Centro de custo" />
          <select className="faz-input" value={rhModelPaymentStatus} onChange={(e) => setRhModelPaymentStatus(e.target.value)}>
            <option value="open">Em aberto</option>
            <option value="paid">Pago</option>
          </select>
        </div>
        <div className="faz-fin-tableWrap" style={{ marginTop: 10 }}>
          <table className="faz-fin-table">
            <thead>
              <tr><th>Item</th><th>Qtd</th><th>R$/colab</th><th>Total (opcional)</th><th>Total calculado</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {rhModelItems.map((it, idx) => {
                const qty = parseBRNumber(it?.qty);
                const unit = parseBRNumber(it?.unit_value_brl);
                const totalTyped = parseBRNumber(it?.total_brl);
                const total = Number.isFinite(totalTyped) && totalTyped > 0
                  ? totalTyped
                  : Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit > 0
                    ? qty * unit
                    : 0;
                return (
                  <tr key={`${it.category}-${idx}`}>
                    <td>
                      <input
                        className="faz-input"
                        value={it.category}
                        onChange={(e) => setRhModelDraftCell(idx, "category", e.target.value)}
                        placeholder="Categoria RH"
                      />
                    </td>
                    <td>
                      <input
                        className="faz-input"
                        inputMode="decimal"
                        value={it.qty}
                        onChange={(e) => setRhModelDraftCell(idx, "qty", e.target.value)}
                        placeholder="Qtd"
                      />
                    </td>
                    <td>
                      <input
                        className="faz-input"
                        inputMode="decimal"
                        value={it.unit_value_brl}
                        onChange={(e) => setRhModelDraftCell(idx, "unit_value_brl", e.target.value)}
                        placeholder="Valor unitário"
                      />
                    </td>
                    <td>
                      <input
                        className="faz-input"
                        inputMode="decimal"
                        value={it.total_brl}
                        onChange={(e) => setRhModelDraftCell(idx, "total_brl", e.target.value)}
                        placeholder="Se vazio, calcula qty x unit"
                      />
                    </td>
                    <td>{toBRL(total)}</td>
                    <td>
                      <button type="button" className="btn-back" onClick={() => removeRhModelDraftLine(idx)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4}><b>Total modelo</b></td>
                <td><b>{toBRL(rhModelTotal)}</b></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="faz-fin-switches">
          <button type="button" className="btn-back" onClick={addRhModelDraftLine}>
            Adicionar linha
          </button>
          <button type="button" className="btn-back" onClick={resetRhModelDraft}>
            Resetar modelo
          </button>
          <button type="button" className="btn-refresh" onClick={applyRhMonthlyModel} disabled={rhModelSaving}>
            {rhModelSaving ? "Aplicando..." : "Aplicar modelo mensal"}
          </button>
          {rhModelMsg ? <span className={`chip ${rhModelMsg.includes("✅") ? "ok" : "bad"}`}>{rhModelMsg}</span> : null}
        </div>
      </div>

      <form onSubmit={submitRhCost} className="faz-fin-tableWrap" style={{ padding: 12 }}>
        <div className="faz-fin-filters faz-fin-filters-4" style={{ marginTop: 0 }}>
          <input className="faz-input" type="date" value={rhDate} onChange={(e) => setRhDate(e.target.value)} />
          <input className="faz-input" type="date" value={rhDueDate} onChange={(e) => setRhDueDate(e.target.value)} />
          <select className="faz-input" value={rhCategory} onChange={(e) => setRhCategory(e.target.value)}>
            {RH_CATEGORIES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input className="faz-input" value={rhCenter} onChange={(e) => setRhCenter(e.target.value)} placeholder="Centro de custo (ex: Fazenda Sede)" />
        </div>
        <div className="faz-fin-filters faz-fin-filters-4">
          <input className="faz-input" inputMode="decimal" value={rhQtyPeople} onChange={(e) => setRhQtyPeople(e.target.value)} placeholder="Qtd colaboradores" />
          <input className="faz-input" inputMode="decimal" value={rhUnitValue} onChange={(e) => setRhUnitValue(e.target.value)} placeholder="Valor por colaborador (R$)" />
          <input className="faz-input" inputMode="decimal" value={rhTotalValue} onChange={(e) => setRhTotalValue(e.target.value)} placeholder={`Total (R$)${rhAutoTotal ? ` • auto ${toBRL(rhAutoTotal)}` : ""}`} />
          <select className="faz-input" value={rhPaymentStatus} onChange={(e) => setRhPaymentStatus(e.target.value)}>
            <option value="paid">Pago</option>
            <option value="open">Em aberto</option>
          </select>
        </div>
        <div className="faz-fin-filters">
          <input className="faz-input" value={rhNotes} onChange={(e) => setRhNotes(e.target.value)} placeholder="Observação (fornecedor, sindicato, folha de jan...)" />
        </div>
        <div className="faz-fin-switches">
          <button type="submit" className="btn-refresh" disabled={rhSaving}>{rhSaving ? "Salvando..." : "Registrar custo RH"}</button>
          {rhMsg ? <span className={`chip ${rhMsg.includes("✅") ? "ok" : "bad"}`}>{rhMsg}</span> : null}
        </div>
      </form>

      <div className="faz-fin-filters faz-fin-filters-4">
        <input className="faz-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar RH..." />
        <select className="faz-input" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="ALL">Todos status</option>
          <option value="Pago">Pago</option>
          <option value="Em aberto">Em aberto</option>
          <option value="Vencido">Vencido</option>
        </select>
        <select className="faz-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">Todas categorias</option>
          {categories.filter((c) => normalizeTextKey(c).startsWith("rh ")).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="faz-input" value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="ALL">Todos centros</option>
          {centers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr><th>Status</th><th>Data</th><th>Categoria</th><th>Centro</th><th>Histórico</th><th>Valor</th></tr>
          </thead>
          <tbody>
            {rhRowsFiltered.map((r) => (
              <tr key={r.id}>
                <td><span className={`chip ${r.status === "Pago" ? "ok" : r.status === "Vencido" ? "bad" : "warn"}`}>{r.status}</span></td>
                <td>{r.date}</td>
                <td>{r.category}</td>
                <td>{r.center}</td>
                <td>{r.title}</td>
                <td>{toBRL(r.value)}</td>
              </tr>
            ))}
            {!rhRowsFiltered.length ? <tr><td colSpan={6}>Sem lançamentos de RH no período.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderFluxo = () => (
    <>
      <div className="faz-fin-card faz-fin-recon-card">
        <div className="faz-fin-recon-head">
          <div>
            <h4>Conciliação por extrato CSV</h4>
            <p>Importe o extrato bancário para sugerir e aplicar conciliação automática em títulos já baixados.</p>
          </div>
          <span className="chip">Perfil: {approverRoleLabel(approverRole)}</span>
        </div>
        <div className="faz-fin-filters faz-fin-filters-4">
          <input className="faz-input" type="file" accept=".csv,text/csv" onChange={onReconFileChange} />
          <input
            className="faz-input"
            value={reconTolerance}
            onChange={(e) => setReconTolerance(e.target.value)}
            placeholder="Tolerância (R$)"
          />
          <input
            className="faz-input"
            value={reconWindowDays}
            onChange={(e) => setReconWindowDays(e.target.value)}
            placeholder="Janela de datas (dias)"
          />
          <div className="faz-fin-switches">
            <button type="button" className="btn-back" disabled={reconBusy || reconApplyBusy} onClick={previewReconciliationImport}>
              {reconBusy ? "Processando..." : "Gerar prévia"}
            </button>
            <button type="button" className="btn-refresh" disabled={reconBusy || reconApplyBusy} onClick={applyReconciliationImport}>
              {reconApplyBusy ? "Aplicando..." : "Aplicar matches"}
            </button>
          </div>
        </div>
        <textarea
          className="faz-input faz-fin-recon-textarea"
          value={reconCsvText}
          onChange={(e) => setReconCsvText(e.target.value)}
          placeholder="Cole aqui o CSV do extrato (colunas: data, histórico, documento, valor)."
        />
        {reconMsg ? <div className={`chip ${reconMsg.includes("✅") ? "ok" : "bad"}`}>{reconMsg}</div> : null}
        {reconPreview?.summary ? (
          <div className="faz-fin-switches">
            <span className="chip rec">Linhas: {toNum(reconPreview.summary.rows || 0, 0)}</span>
            <span className="chip ok">Match: {toNum(reconPreview.summary.matched || 0, 0)}</span>
            <span className="chip warn">Ambíguas: {toNum(reconPreview.summary.ambiguous || 0, 0)}</span>
            <span className="chip bad">Sem match: {toNum(reconPreview.summary.unmatched || 0, 0)}</span>
            {reconSelectionStats.ambiguous > 0 ? (
              <span className={`chip ${reconSelectionStats.selected === reconSelectionStats.ambiguous ? "ok" : "warn"}`}>
                Seleção manual: {toNum(reconSelectionStats.selected, 0)}/{toNum(reconSelectionStats.ambiguous, 0)}
              </span>
            ) : null}
          </div>
        ) : null}
        {Array.isArray(reconPreview?.items) && reconPreview.items.length ? (
          <div className="faz-fin-tableWrap">
            <table className="faz-fin-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Direção</th>
                  <th>Status</th>
                  <th>Título sugerido</th>
                  <th>Resolver ambígua</th>
                </tr>
              </thead>
              <tbody>
                {reconPreview.items.slice(0, 120).map((row) => {
                  const st = String(row?.status || "unmatched");
                  const chipClass = st === "matched" ? "ok" : st === "ambiguous" ? "warn" : "bad";
                  const options = Array.isArray(row?.alternatives) ? row.alternatives : [];
                  const selectedKey = reconSelections[String(row?.row_index || "")] || "";
                  const selectedParsed = parseReconMatchKey(selectedKey);
                  return (
                    <tr key={`recon-${row.row_index}`}>
                      <td>{row.row_index}</td>
                      <td>{row.movement_date || "—"}</td>
                      <td>{toBRL(row.amount_brl)}</td>
                      <td>{row.direction === "payable" ? "Saída" : "Entrada"}</td>
                      <td><span className={`chip ${chipClass}`}>{st === "matched" ? "Match" : st === "ambiguous" ? "Ambígua" : "Sem match"}</span></td>
                      <td>
                        {row.match ? (
                          <span>
                            #{row.match.event_id} • {row.match.kind === "payable" ? "Pagar" : "Receber"} • {row.match.person_name || "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {st === "ambiguous" ? (
                          <select
                            className="faz-input faz-fin-recon-select"
                            value={selectedKey}
                            onChange={(e) =>
                              setReconSelections((prev) => ({
                                ...prev,
                                [String(row.row_index)]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Selecionar título...</option>
                            {options.map((opt) => {
                              const optKey = reconMatchKey(opt);
                              return (
                                <option key={`${row.row_index}-${optKey}`} value={optKey}>
                                  #{opt.event_id} • {opt.kind === "payable" ? "Pagar" : "Receber"} • {opt.person_name || "—"} • score {toNum(opt.score, 0)}
                                </option>
                              );
                            })}
                          </select>
                        ) : st === "matched" ? (
                          <span className="chip ok">Automático</span>
                        ) : (
                          "—"
                        )}
                        {st === "ambiguous" && selectedParsed ? (
                          <div className="faz-fin-approval-required">
                            Selecionado: #{selectedParsed.event_id} • {selectedParsed.kind === "payable" ? "Pagar" : "Receber"}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="faz-pay-toolbar">
        <div className="left">
          <span className="chip rec">Mensal</span>
          <span className="chip">{pagarPeriodLabel}</span>
          <button type="button" className={`chip ${flowIncludePlanned ? "rec" : ""}`} onClick={() => setFlowIncludePlanned((v) => !v)}>
            {flowIncludePlanned ? "Com previstos" : "Sem previstos"}
          </button>
        </div>
      </div>

      <div className="faz-fin-tableWrap flow-chart-wrap">
        <svg viewBox={`0 0 ${flowChart.width} ${flowChart.height}`} className="flow-svg" role="img" aria-label="Fluxo de caixa mensal">
          {flowChart.grid.map((g, i) => (
            <line key={`g-${i}`} x1={flowChart.padX} y1={g.yy} x2={flowChart.width - flowChart.padX} y2={g.yy} stroke="rgba(203,213,225,.8)" strokeWidth="1" />
          ))}
          <line
            x1={flowChart.padX}
            y1={flowChart.zeroY}
            x2={flowChart.width - flowChart.padX}
            y2={flowChart.zeroY}
            stroke="rgba(148,163,184,.95)"
            strokeWidth="1.2"
          />

          {flowChart.rows.map((r, i) => {
            const x = flowChart.x(i);
            const yDesp = flowChart.y(-asNum(r.despesa));
            const yDespPrev = flowChart.y(-asNum(r.despesaPrev));
            const base = flowChart.zeroY;
            const hDesp = Math.max(1, Math.abs(base - yDesp));
            const hDespPrev = Math.max(1, Math.abs(base - yDespPrev));
            const yBaseDesp = Math.min(base, yDesp);
            const yBaseDespPrev = Math.min(base, yDespPrev);
            return (
              <g key={r.month}>
                <rect x={x - flowChart.barW * 0.65} y={yBaseDespPrev} width={flowChart.barW * 1.3} height={hDespPrev} fill="rgba(239,68,68,.14)" />
                <rect x={x - flowChart.barW * 0.5} y={yBaseDesp} width={flowChart.barW} height={hDesp} rx="4" fill="rgba(220,38,38,1)" />
              </g>
            );
          })}

          <polyline fill="none" stroke="rgba(3,105,161,1)" strokeWidth="2.4" points={flowChart.saldoPoints} />
          <polyline fill="none" stroke="rgba(245,158,11,1)" strokeWidth="2.4" points={flowChart.saldoPrevPoints} />

          {flowChart.rows.map((r, i) => (
            <g key={`p-${r.month}`}>
              <circle cx={flowChart.x(i)} cy={flowChart.y(r.saldo)} r="3.3" fill="rgba(3,105,161,1)" />
              <circle cx={flowChart.x(i)} cy={flowChart.y(r.saldoPrev)} r="3.3" fill="rgba(245,158,11,1)" />
              <text x={flowChart.x(i)} y={flowChart.height - 8} textAnchor="middle" className="flow-xlab">
                {r.month.slice(5, 7)}/{r.month.slice(0, 4)}
              </text>
            </g>
          ))}
        </svg>

        <div className="flow-legend">
          <span><i className="swatch inprev" /> Receita Prevista</span>
          <span><i className="swatch outprev" /> Despesa Prevista</span>
          <span><i className="swatch inreal" /> Receita</span>
          <span><i className="swatch outreal" /> Despesa</span>
          <span><i className="swatch saldo" /> Saldo</span>
          <span><i className="swatch saldoprev" /> Saldo Previsto</span>
        </div>
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table faz-flow-matrix">
          <thead>
            <tr>
              <th>Categoria</th>
              {flowYearRows.map((m) => (
                <th key={`m-head-${m.month}`} colSpan={4}>{m.month.slice(5, 7)}/{m.month.slice(0, 4)}</th>
              ))}
            </tr>
            <tr>
              <th />
              {flowYearRows.map((m) => (
                <React.Fragment key={`sub-${m.month}`}>
                  <th>Planejado</th>
                  <th>Realizado</th>
                  <th>Diferença</th>
                  <th>%</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {flowMatrixRows.map((row) => (
              <tr key={row.key}>
                <td className="flow-row-title">{row.label}</td>
                {flowYearRows.map((m) => {
                  const cell = row.pick(m);
                  const planned = asNum(cell.planned);
                  const realized = asNum(cell.realized);
                  const diff = realized - planned;
                  const pct = pctFrom(realized, planned);
                  return (
                    <React.Fragment key={`${row.key}-${m.month}`}>
                      <td>{toBRL(planned)}</td>
                      <td>{toBRL(realized)}</td>
                      <td className={diff > 0 ? "flow-pos" : diff < 0 ? "flow-neg" : ""}>{toBRL(diff)}</td>
                      <td className={pct > 0 ? "flow-pos" : pct < 0 ? "flow-neg" : ""}>{toNum(pct, 1)}%</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {!flowYearRows.length ? <tr><td colSpan={49}>Sem dados de fluxo no período.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderLcdpr = () => {
    const pendentes = lcdprRows.filter((r) => r.pendencias.length > 0);
    const aptos = lcdprRows.length - pendentes.length;

    return (
      <>
        <div className="faz-fin-kpis">
          <div className="kpi"><span>Lançamentos</span><b>{toNum(lcdprRows.length, 0)}</b></div>
          <div className="kpi"><span>Aptos LCDPR</span><b>{toNum(aptos, 0)}</b></div>
          <div className="kpi"><span>Com pendência</span><b>{toNum(pendentes.length, 0)}</b></div>
          <div className="kpi"><span>Status</span><b>{pendentes.length ? "Revisar" : "Pronto"}</b></div>
        </div>
        <div className="faz-fin-note">
          Checklist LCDPR: categoria, documento, data e valor válidos em cada lançamento.
        </div>
        <div className="faz-fin-tableWrap">
          <table className="faz-fin-table">
            <thead>
              <tr><th>Tipo</th><th>Data</th><th>Histórico</th><th>Categoria</th><th>Centro</th><th>Documento</th><th>Valor</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {lcdprRows.map((r, idx) => (
                <tr key={`${r.tipo}-${r.data}-${idx}`}>
                  <td>{r.tipo}</td>
                  <td>{r.data || "—"}</td>
                  <td>{r.title || "—"}</td>
                  <td>{r.category || "—"}</td>
                  <td>{r.center || "—"}</td>
                  <td>{r.doc || "—"}</td>
                  <td>{toBRL(r.value)}</td>
                  <td>
                    {r.pendencias.length ? (
                      <span className="chip bad">{r.pendencias.join("; ")}</span>
                    ) : (
                      <span className="chip ok">OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {!lcdprRows.length ? <tr><td colSpan={8}>Sem lançamentos no período.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderDesembolsoCabeca = () => (
    <>
      <div className="faz-fin-kpis">
        <div className="kpi"><span>Desembolso por cabeça médio</span><b>{desPerHeadAvg == null ? "—" : toBRL(desPerHeadAvg)}</b></div>
        <div className="kpi">
          <span>Custo fixo por cabeça (médio)</span>
          <b style={desFixedExceededAvg ? { color: "rgba(185,28,28,1)" } : undefined}>
            {desFixedPerHeadAvg == null ? "—" : toBRL(desFixedPerHeadAvg)}
          </b>
        </div>
        <div className="kpi"><span>Desembolso médio mensal</span><b>{toBRL(desMonthlyAvg)}</b></div>
        <div className="kpi"><span>Desembolso total</span><b>{toBRL(desTotal)}</b></div>
        <div className="kpi"><span>Rebanho médio</span><b>{desAvgHeads == null ? "—" : `${toNum(desAvgHeads, 2)} cab`}</b></div>
      </div>

      <div className="faz-fin-note">
        Período analisado: <b>{monthLabel(desMonths[0])}</b> até <b>{monthLabel(desMonths[desMonths.length - 1])}</b>.
      </div>
      <div className="faz-fin-filters faz-fin-filters-4">
        <select className="faz-input" value={String(desWindow)} onChange={(e) => setDesWindow(Number(e.target.value) || 3)}>
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </select>
        <input className="faz-input" inputMode="decimal" placeholder="Rebanho base (cabeças)" value={heads} onChange={(e) => setHeads(e.target.value)} />
        <input className="faz-input" inputMode="decimal" placeholder="Crescimento %/mês (opcional)" value={desGrowthPct} onChange={(e) => setDesGrowthPct(e.target.value)} />
        <select className="faz-input" value={desCategory} onChange={(e) => setDesCategory(e.target.value)}>
          <option value="ALL">Todas categorias</option>
          {desFilterOptions.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="faz-fin-filters">
        <select className="faz-input" value={desCenter} onChange={(e) => setDesCenter(e.target.value)}>
          <option value="ALL">Todos centros</option>
          {desFilterOptions.centers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="faz-fin-note">
        Regra fixa desta aba: <b>custos de investimento não entram no cálculo</b>. Só despesas operacionais.
      </div>
      <div className="faz-fin-note">
        Regra de teto: <b>RH + Manutenção + Combustível + Nutrição</b> não pode passar de <b>{toBRL(FIXED_COST_CAP_PER_HEAD)}/cabeça</b>.
      </div>
      {desFixedExceededAvg ? (
        <div className="faz-fin-alert">
          Aviso: média de custo fixo por cabeça está em {toBRL(desFixedPerHeadAvg)} e ultrapassou o teto de {toBRL(FIXED_COST_CAP_PER_HEAD)}.
        </div>
      ) : null}
      {desFixedExceededMonths.length > 0 ? (
        <div className="faz-fin-alert">
          Meses acima do teto: {desFixedExceededMonths.map((r) => `${r.month.slice(5, 7)}/${r.month.slice(0, 4)} (${toBRL(r.fixedPerHead)}/cab)`).join(" • ")}
        </div>
      ) : null}

      <div className="faz-fin-bars">
        {desRows.map((r) => {
          const h = desMax > 0 ? Math.max(14, Math.round((r.total / desMax) * 120)) : 14;
          return (
            <div className="bar-col" key={r.month}>
              <div className="bar-val">{toBRL(r.total)}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${h}px` }} />
              </div>
              <div className="bar-label">{r.month.slice(5, 7)}/{r.month.slice(0, 4)}</div>
            </div>
          );
        })}
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Animais</th>
              <th>Desembolso Total</th>
              <th>Custo Fixo / Cabeça</th>
              <th>Desembolso por Cabeça</th>
              <th>Desembolso Diário Atual</th>
              <th>Status teto R$90</th>
            </tr>
          </thead>
          <tbody>
            {desRows.map((r) => (
              <tr key={r.month}>
                <td>{r.month.slice(5, 7)}/{r.month.slice(0, 4)}</td>
                <td>{Number.isFinite(r.heads) && r.heads > 0 ? toNum(r.heads, 2) : "—"}</td>
                <td>{toBRL(r.total)}</td>
                <td style={Number.isFinite(r.fixedPerHead) && r.fixedPerHead > FIXED_COST_CAP_PER_HEAD ? { color: "rgba(185,28,28,1)", fontWeight: 800 } : undefined}>
                  {r.fixedPerHead == null ? "—" : toBRL(r.fixedPerHead)}
                </td>
                <td>{r.perHead == null ? "—" : toBRL(r.perHead)}</td>
                <td>{toBRL(r.daily)}</td>
                <td>
                  {Number.isFinite(r.fixedPerHead) && r.fixedPerHead > FIXED_COST_CAP_PER_HEAD ? (
                    <span className="chip bad">Acima</span>
                  ) : (
                    <span className="chip ok">OK</span>
                  )}
                </td>
              </tr>
            ))}
            {!desRows.length ? <tr><td colSpan={7}>Sem dados para o período.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );

  const exportCurrent = () => {
    const stamp = monthKey || "periodo";

    if (screen === "analise_pagamentos") {
      downloadCsv(
        `financeiro_pagamentos_${stamp}.csv`,
        ["agrupamento", "total", "percentual", ...payYearMonths],
        payYearMatrix.rows.map((r) => [r.key, asNum(r.total), toNum(r.pct, 2), ...r.monthValues.map((v) => asNum(v))])
      );
      return;
    }

    if (screen === "analise_recebimentos") {
      downloadCsv(
        `financeiro_recebimentos_${stamp}.csv`,
        ["situacao", "data", "titulo", "categoria", "centro", "arrobas", "preco_arroba", "total"],
        filteredRecvRows.map((r) => [r.status, r.date, r.title, r.category, r.center, asNum(r.arrobas), asNum(r.price), asNum(r.total)])
      );
      return;
    }

    if (screen === "fluxo_caixa") {
      downloadCsv(
        `financeiro_fluxo_caixa_${stamp}.csv`,
        ["mes", "receita_prevista", "despesa_prevista", "receita", "despesa", "saldo_previsto", "saldo"],
        flowYearRows.map((r) => [r.month, r.receitaPrev, r.despesaPrev, r.receita, r.despesa, r.saldoPrev, r.saldo])
      );
      return;
    }

    if (screen === "custos_rh") {
      downloadCsv(
        `financeiro_custos_rh_${stamp}.csv`,
        ["status", "data", "categoria", "centro", "historico", "valor"],
        rhRowsFiltered.map((r) => [r.status, r.date, r.category, r.center, r.title, asNum(r.value)])
      );
      return;
    }

    if (screen === "lcdpr") {
      downloadCsv(
        `financeiro_lcdpr_${stamp}.csv`,
        ["tipo", "data", "historico", "categoria", "centro", "documento", "valor", "pendencias"],
        lcdprRows.map((r) => [r.tipo, r.data, r.title, r.category, r.center, r.doc, r.value, r.pendencias.join(" | ")])
      );
    }
  };

  const renderReport = () => {
    if (screen === "hub") return renderHub();
    if (screen === "lancamentos") return renderLancamentos();
    if (screen === "analise_pagamentos") return renderPagar();
    if (screen === "analise_recebimentos") return renderReceber();
    if (screen === "fechamento_mensal") return renderFechamentoMensal();
    if (screen === "dre") return renderDRE();
    if (screen === "receita_prev_real") return renderPrevReal("receita");
    if (screen === "despesa_prev_real") return renderPrevReal("despesa");
    if (screen === "custos_rh") return renderRH();
    if (screen === "fluxo_caixa") return renderFluxo();
    if (screen === "lcdpr") return renderLcdpr();
    if (screen === "desembolso_cabeca") return renderDesembolsoCabeca();
    return <div className="faz-fin-note">Relatório não disponível.</div>;
  };

  const currentTitle = REPORTS.find((r) => r.key === screen)?.title || "Financeiro";
  const canExport = ["analise_pagamentos", "analise_recebimentos", "fluxo_caixa", "custos_rh", "lcdpr"].includes(screen);
  const exportLabel = screen === "lcdpr" ? "Gerar arquivo LCDPR" : "Exportar CSV";

  return (
    <div className="cras-stage-v2">
      <div className="faz-financeiro-v2">
        <CrasPageHeader
          eyebrow="RELATÓRIOS"
          title="Financeiro"
          subtitle="Painel de gestão financeira da fazenda."
        />

        <div className="faz-fin-topbar">
          <div className="left">
            <span className="lbl">Período</span>
            <input className="faz-input" type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
            <span className="muted">{titleMonth}</span>
          </div>
          <div className="right">
            {screen !== "hub" ? (
              <button type="button" className="btn-back" onClick={() => setScreen("hub")}>Voltar aos relatórios</button>
            ) : null}
            {screen !== "hub" ? (
              <button type="button" className="btn-back" onClick={handleCloseMonth} disabled={closeBusy}>
                {closeBusy ? "Fechando..." : screen === "fechamento_mensal" ? "Atualizar fechamento" : "Fechar mês"}
              </button>
            ) : null}
            {canExport ? (
              <button type="button" className="btn-refresh" onClick={exportCurrent}>{exportLabel}</button>
            ) : null}
            <button type="button" className="btn-refresh" onClick={() => setRefreshTick((v) => v + 1)} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {error ? <div className="faz-fin-alert">{String(error)}</div> : null}
        {titlesMsg ? <div className={`faz-fin-alert ${titlesMsg.includes("✅") ? "ok" : ""}`}>{titlesMsg}</div> : null}

        {screen !== "hub" ? <div className="faz-fin-reportTitle">{currentTitle}</div> : null}
        {screen !== "hub" && nutritionMerge.totalNutritionPurchases > 0 ? (
          <div className="faz-fin-note">
            Nutrição integrada: {toNum(nutritionMerge.totalNutritionPurchases, 0)} compras no catálogo,{" "}
            {toNum(nutritionMerge.integratedCount, 0)} adicionadas no financeiro e{" "}
            {toNum(nutritionMerge.dedupedCount, 0)} já conciliadas com lançamentos de custo.
          </div>
        ) : null}

        {renderReport()}
      </div>
    </div>
  );
}
