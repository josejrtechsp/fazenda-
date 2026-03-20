import { api } from "./api.js";

export function readPendingCountLocal() {
  try {
    const value = Number(localStorage.getItem("fazenda_pending_count_v1") || "0");
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function normalizePendingSnapshot(raw) {
  const counts = raw?.counts && typeof raw.counts === "object" ? raw.counts : {};
  const suspectWeighs = Array.isArray(raw?.suspect_weighs) ? raw.suspect_weighs : [];
  const noWeigh = Array.isArray(raw?.no_weigh) ? raw.no_weigh : [];
  const staleWeigh = Array.isArray(raw?.stale_weigh) ? raw.stale_weigh : [];
  const overdueVaccine = Array.isArray(raw?.overdue_vaccine) ? raw.overdue_vaccine : [];
  const suspectCount = Number(counts?.suspect_weighs || suspectWeighs.length || 0);
  const noWeighCount = Number(counts?.no_weigh || noWeigh.length || 0);
  const staleCount = Number(counts?.stale_weigh || staleWeigh.length || 0);
  const overdueCount = Number(counts?.overdue_vaccine || overdueVaccine.length || 0);
  const operationalTotal = Number(counts?.operational_total || suspectCount + noWeighCount + staleCount || 0);
  return {
    counts: {
      suspectWeighs: suspectCount,
      noWeigh: noWeighCount,
      staleWeigh: staleCount,
      overdueVaccine: overdueCount,
      operationalTotal,
    },
    suspectWeighs,
    noWeigh,
    staleWeigh,
    overdueVaccine,
    staleDays: Number(raw?.stale_days || 60),
  };
}

export function getOperationalPendingCount(raw) {
  return Number(normalizePendingSnapshot(raw)?.counts?.operationalTotal || 0);
}

export async function fetchPendingSnapshot(options = {}) {
  const limit = Math.max(1, Math.min(100, Number(options?.limit) || 30));
  const staleDays = Math.max(1, Math.min(365, Number(options?.staleDays) || 60));
  const res = await api.get(`/herd/pending?limit=${limit}&stale_days=${staleDays}`);
  return normalizePendingSnapshot(res);
}

export async function fetchHerdOnboardingSnapshot(options = {}) {
  const activityLimit = Math.max(5, Math.min(50, Number(options?.activityLimit) || 20));
  const [summaryRes, activityRes] = await Promise.allSettled([
    api.get("/herd/summary"),
    api.get(`/herd/activity?limit=${activityLimit}`),
  ]);

  if (summaryRes.status !== "fulfilled" && activityRes.status !== "fulfilled") {
    throw new Error("herd onboarding snapshot unavailable");
  }

  const summary = summaryRes.status === "fulfilled" && summaryRes.value && typeof summaryRes.value === "object"
    ? summaryRes.value
    : {};
  const activityItems = activityRes.status === "fulfilled" && Array.isArray(activityRes.value?.items)
    ? activityRes.value.items
    : [];

  const activeHeads = Number(summary?.total_active || 0);
  const hasAnyOp = activityItems.length > 0;
  const hasWeigh = activityItems.some((item) => String(item?.type || "").toLowerCase() === "weigh");

  return {
    activeHeads,
    hasAnimals: activeHeads > 0,
    hasAnyOp,
    hasWeigh,
    recentPct: Number(summary?.weighing_ok_pct || 0),
    noWeigh: Number(summary?.no_weigh_count || 0),
    staleWeigh: Number(summary?.stale_weigh_count || 0),
    vacOverdue: Number(summary?.overdue_vaccine_count || 0),
  };
}
