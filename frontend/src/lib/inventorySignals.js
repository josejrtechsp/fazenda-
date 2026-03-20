import { api } from "./api.js";

const INVENTORY_KINDS = [
  { kind: "farmacia", storageKey: "faz_estoque_farmacia_v1" },
  { kind: "semen", storageKey: "faz_estoque_semen_v1" },
  { kind: "nutricional", storageKey: "faz_estoque_nutricional_v1" },
];

function safeParseJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeLegacyRow(row = {}) {
  return {
    name: String(row?.nome || row?.name || "").trim(),
    item_type: String(row?.tipo || row?.item_type || "").trim(),
    manufacturer: String(row?.fabricante || row?.manufacturer || "").trim(),
    quantity: Math.max(0, toNumber(row?.quantidade ?? row?.quantity)),
    unit: String(row?.unidade || row?.unit || row?.un || "un").trim() || "un",
    unit_price_brl: Math.max(0, toNumber(row?.precoUnitario ?? row?.unit_price_brl)),
    batch: String(row?.lote || row?.batch || row?.partida || "").trim(),
    expires_on: String(row?.validade || row?.expires_on || "").trim(),
    location: String(row?.local || row?.location || "").trim(),
    property_name: String(row?.propriedade || row?.property_name || "Fazenda da Estrela").trim() || "Fazenda da Estrela",
    last_movement_at: String(row?.ultimaMovimentacao || row?.last_movement_at || row?.data || row?.purchased_at || "").trim(),
  };
}

export function readLegacyInventoryRows(kind) {
  if (typeof window === "undefined") return [];
  const config = INVENTORY_KINDS.find((item) => item.kind === kind);
  if (!config) return [];
  const parsed = safeParseJson(localStorage.getItem(config.storageKey) || "[]", []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeLegacyRow)
    .filter((item) => item.name);
}

export async function fetchInventoryAlerts(limitPerKind = 2) {
  return api.get(`/inventory/alerts?limit_per_kind=${encodeURIComponent(limitPerKind)}`);
}

export async function bootstrapLegacyInventoryToBackend() {
  const summary = await fetchInventoryAlerts(1);
  const byKind = new Map(
    (Array.isArray(summary?.kinds) ? summary.kinds : []).map((item) => [
      String(item?.kind || "").trim().toLowerCase(),
      Number(item?.total_items || 0),
    ])
  );

  let changed = false;
  for (const config of INVENTORY_KINDS) {
    const remoteCount = Math.max(0, Number(byKind.get(config.kind) || 0));
    if (remoteCount > 0) continue;
    const localRows = readLegacyInventoryRows(config.kind);
    if (!localRows.length) continue;
    await api.put(`/inventory/items/bulk/${encodeURIComponent(config.kind)}`, {
      items: localRows,
    });
    changed = true;
  }

  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fazenda_inventory_updated"));
  }
  return changed;
}
