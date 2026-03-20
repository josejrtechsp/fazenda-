import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/estoque_pages.css";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function brl(v) {
  const n = toNumber(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function qtyFmt(v) {
  return toNumber(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function normalizeDate(v) {
  if (!v) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(v))) return String(v);
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function normalizeRow(row = {}) {
  const qty = Math.max(0, toNumber(row.quantidade));
  const unitPrice = Math.max(0, toNumber(row.precoUnitario));
  return {
    id: row.id || `${String(row.nome || "item").toLowerCase()}_${Date.now()}`,
    nome: String(row.nome || "").trim(),
    tipo: row.tipo || "",
    fabricante: row.fabricante || "—",
    quantidade: qty,
    unidade: row.unidade || row.un || "un",
    precoUnitario: unitPrice,
    lote: row.lote || row.partida || "—",
    validade: row.validade || "—",
    local: row.local || "—",
    propriedade: row.propriedade || "Fazenda da Estrela",
    ultimaMovimentacao: row.ultimaMovimentacao || row.data || row.purchased_at || "—",
  };
}

function normalizeBackendRow(row = {}) {
  return normalizeRow({
    id: row.id,
    nome: row.name,
    tipo: row.item_type,
    fabricante: row.manufacturer,
    quantidade: row.quantity,
    unidade: row.unit,
    precoUnitario: row.unit_price_brl,
    lote: row.batch,
    validade: row.expires_on,
    local: row.location,
    propriedade: row.property_name,
    ultimaMovimentacao: row.last_movement_at,
  });
}

function toBackendPayload(row = {}) {
  const normalized = normalizeRow(row);
  return {
    name: normalized.nome,
    item_type: normalized.tipo,
    manufacturer: normalized.fabricante === "—" ? "" : normalized.fabricante,
    quantity: toNumber(normalized.quantidade),
    unit: normalized.unidade || "un",
    unit_price_brl: toNumber(normalized.precoUnitario),
    batch: normalized.lote === "—" ? "" : normalized.lote,
    expires_on: normalized.validade === "—" ? "" : normalized.validade,
    location: normalized.local === "—" ? "" : normalized.local,
    property_name: normalized.propriedade || "Fazenda da Estrela",
    last_movement_at: normalized.ultimaMovimentacao === "—" ? "" : normalized.ultimaMovimentacao,
  };
}

function parseInputNumber(v) {
  if (v == null) return NaN;
  const s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function defaultsByKind(kind) {
  if (kind === "farmacia") {
    return { tipoItem: "Medicamento", local: "Farmácia", unidade: "un" };
  }
  if (kind === "semen") {
    return { tipoItem: "Sêmen", local: "Reprodução", unidade: "dose" };
  }
  return { tipoItem: "Insumo nutricional", local: "Nutricional", unidade: "kg" };
}

function createMovementState(kind) {
  const base = defaultsByKind(kind);
  return {
    tipoMov: "entrada",
    nome: "",
    tipoItem: base.tipoItem,
    fabricante: "",
    quantidade: "",
    unidade: base.unidade,
    precoUnitario: "",
    lote: "",
    validade: "",
    local: base.local,
    propriedade: "Fazenda da Estrela",
    data: isoToday(),
  };
}

async function loadNutritionFromApi() {
  const [itemsRaw, purchasesRaw] = await Promise.all([
    api.get("/nutrition/items"),
    api.get("/nutrition/purchases?limit=700"),
  ]);

  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  const purchases = Array.isArray(purchasesRaw) ? purchasesRaw : [];

  const byId = new Map();
  const byName = new Map();

  for (const it of items) {
    const name = String(it?.name || "").trim();
    if (!name) continue;
    const base = {
      id: `nutrition_${it.id || name}`,
      nome: name,
      tipo: "Insumo nutricional",
      fabricante: it?.manufacturer || "—",
      quantidade: 0,
      unidade: it?.default_unit || "kg",
      precoUnitario: 0,
      lote: "—",
      validade: "—",
      local: "Nutricional",
      propriedade: "Fazenda da Estrela",
      ultimaMovimentacao: "—",
      _latestTs: 0,
    };
    byId.set(Number(it.id), base);
    byName.set(name.toLowerCase(), base);
  }

  for (const p of purchases) {
    const pid = Number(p?.item_id);
    const fallbackName = String(p?.item_name || p?.name || p?.item || "").trim();
    const date = p?.purchased_at || p?.date || p?.created_at || "";
    const ts = date ? new Date(date).getTime() || 0 : 0;

    let row = byId.get(pid);
    if (!row && fallbackName) {
      row = byName.get(fallbackName.toLowerCase()) || {
        id: `nutrition_name_${fallbackName}`,
        nome: fallbackName,
        tipo: "Insumo nutricional",
        fabricante: "—",
        quantidade: 0,
        unidade: p?.unit || "kg",
        precoUnitario: 0,
        lote: "—",
        validade: "—",
        local: "Nutricional",
        propriedade: "Fazenda da Estrela",
        ultimaMovimentacao: "—",
        _latestTs: 0,
      };
      byName.set(fallbackName.toLowerCase(), row);
    }
    if (!row) continue;

    row.quantidade += Math.max(0, toNumber(p?.qty));
    if (!row.unidade || row.unidade === "un") row.unidade = p?.unit || row.unidade || "kg";
    if (ts >= (row._latestTs || 0)) {
      row._latestTs = ts;
      row.precoUnitario = Math.max(0, toNumber(p?.unit_price_brl));
      row.ultimaMovimentacao = date || row.ultimaMovimentacao;
    }
  }

  const merged = [...new Set([...byId.values(), ...byName.values()])]
    .map((row) => {
      const clean = normalizeRow(row);
      return { ...clean, valor: clean.quantidade * clean.precoUnitario };
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  return merged;
}

export default function EstoqueBase({
  kind,
  title,
  subtitle,
  tabs = [],
  activeTab = "Inventário",
  columns = [],
  seedItems = [],
  buildKpis = () => [],
  enableNutritionSync = false,
}) {
  const storageKey = `faz_estoque_${kind}_v1`;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveErr, setMoveErr] = useState("");
  const [movement, setMovement] = useState(() => createMovementState(kind));

  function readLocalRows() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeRow) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(next) {
    const normalized = (next || []).map(normalizeRow);
    setRows(normalized);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      // ignore quota/storage lock
    }
    return normalized;
  }

  function loadLocalOrSeed() {
    const localRows = readLocalRows();
    if (localRows.length) {
      setRows(localRows);
      return localRows;
    }
    if (seedItems.length) {
      return saveLocal(seedItems);
    }
    setRows([]);
    return [];
  }

  async function loadRowsFromBackend() {
    const data = await api.get(`/inventory/items?kind=${encodeURIComponent(kind)}`);
    return Array.isArray(data) ? data.map(normalizeBackendRow) : [];
  }

  async function syncRowsToBackend(next) {
    const normalized = (next || []).map(normalizeRow);
    await api.put(`/inventory/items/bulk/${encodeURIComponent(kind)}`, {
      items: normalized.map(toBackendPayload),
    });
    return normalized;
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    const localRows = readLocalRows();

    try {
      if (enableNutritionSync) {
        const nutriRows = await loadNutritionFromApi();
        const normalized = saveLocal(nutriRows);
        await syncRowsToBackend(normalized);
      } else {
        const remoteRows = await loadRowsFromBackend();
        if (remoteRows.length || !localRows.length) {
          saveLocal(remoteRows);
        } else {
          const fallbackRows = loadLocalOrSeed();
          if (fallbackRows.length) {
            await syncRowsToBackend(fallbackRows);
          }
        }
      }
    } catch (e) {
      const fallbackRows = loadLocalOrSeed();
      if (!enableNutritionSync && fallbackRows.length) {
        try {
          await syncRowsToBackend(fallbackRows);
        } catch {
          // local already restored; keep original error for visibility
        }
      }
      setErr(
        String(
          e?.message ||
            e ||
            (enableNutritionSync
              ? "Falha ao atualizar estoque nutricional"
              : "Falha ao atualizar inventário oficial")
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, enableNutritionSync]);

  useEffect(() => {
    if (!moveOpen) {
      setMovement(createMovementState(kind));
      setMoveErr("");
    }
  }, [kind, moveOpen]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const text = `${r.nome} ${r.tipo} ${r.fabricante} ${r.local} ${r.propriedade}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, query]);

  const prepared = useMemo(() => filtered.map((r) => ({ ...r, valor: r.quantidade * r.precoUnitario })), [filtered]);
  const kpis = useMemo(() => buildKpis(prepared), [prepared, buildKpis]);
  const itemNames = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => String(r.nome || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );

  function openMovementModal() {
    setMovement(createMovementState(kind));
    setMoveErr("");
    setMoveOpen(true);
  }

  function closeMovementModal() {
    setMoveOpen(false);
    setMoveErr("");
  }

  async function submitMovement(e) {
    e?.preventDefault?.();
    setMoveErr("");

    const nome = String(movement.nome || "").trim();
    const quantidadeAbs = parseInputNumber(movement.quantidade);
    const precoMaybe = String(movement.precoUnitario || "").trim();
    const precoUnitario = precoMaybe ? parseInputNumber(precoMaybe) : NaN;

    if (!nome) {
      setMoveErr("Informe o item da movimentação.");
      return;
    }
    if (!Number.isFinite(quantidadeAbs) || quantidadeAbs <= 0) {
      setMoveErr("Informe uma quantidade válida maior que zero.");
      return;
    }
    if (precoMaybe && (!Number.isFinite(precoUnitario) || precoUnitario < 0)) {
      setMoveErr("Preço unitário inválido.");
      return;
    }

    const delta = movement.tipoMov === "saida" ? -quantidadeAbs : quantidadeAbs;
    const now = movement.data || isoToday();
    const lc = nome.toLowerCase();
    const current = rows.find((r) => String(r.nome || "").trim().toLowerCase() === lc);

    if (!current && delta < 0) {
      setMoveErr("Não existe estoque para saída desse item. Faça uma entrada primeiro.");
      return;
    }

    if (current && delta < 0 && quantidadeAbs > toNumber(current.quantidade)) {
      setMoveErr("Saída maior que o estoque disponível para esse item.");
      return;
    }

    if (!current) {
      const created = normalizeRow({
        id: `${kind}_${Date.now()}`,
        nome,
        tipo: movement.tipoItem || defaultsByKind(kind).tipoItem,
        fabricante: movement.fabricante || "—",
        quantidade: delta,
        unidade: movement.unidade || defaultsByKind(kind).unidade,
        precoUnitario: Number.isFinite(precoUnitario) ? precoUnitario : 0,
        lote: movement.lote || "—",
        validade: movement.validade || "—",
        local: movement.local || defaultsByKind(kind).local,
        propriedade: movement.propriedade || "Fazenda da Estrela",
        ultimaMovimentacao: now,
      });
      const nextRows = [created, ...rows];
      saveLocal(nextRows);
      try {
        await syncRowsToBackend(nextRows);
        setErr("");
      } catch (syncErr) {
        setErr(String(syncErr?.message || syncErr || "Movimentação salva localmente, mas falhou ao sincronizar com o backend."));
      }
      closeMovementModal();
      return;
    }

    const next = rows.map((r) => {
      if (r.id !== current.id) return r;
      const updatedQty = toNumber(r.quantidade) + delta;
      return normalizeRow({
        ...r,
        nome,
        tipo: movement.tipoItem || r.tipo,
        fabricante: movement.fabricante || r.fabricante,
        quantidade: updatedQty,
        unidade: movement.unidade || r.unidade,
        precoUnitario: Number.isFinite(precoUnitario) ? precoUnitario : r.precoUnitario,
        lote: movement.lote || r.lote,
        validade: movement.validade || r.validade,
        local: movement.local || r.local,
        propriedade: movement.propriedade || r.propriedade,
        ultimaMovimentacao: now,
      });
    });
    saveLocal(next);
    try {
      await syncRowsToBackend(next);
      setErr("");
    } catch (syncErr) {
      setErr(String(syncErr?.message || syncErr || "Movimentação salva localmente, mas falhou ao sincronizar com o backend."));
    }
    closeMovementModal();
  }

  return (
    <div className="cras-stage-v2 faz-stock">
      <CrasPageHeader
        eyebrow="Estoque"
        title={title}
        subtitle={subtitle}
        actions={[
          { key: "move", label: "Movimentação", tone: "primary" },
          { key: "reload", label: loading ? "Atualizando..." : "Atualizar", tone: "soft" },
        ]}
        onAction={(a) => {
          if (a?.key === "move") openMovementModal();
          if (a?.key === "reload") refresh();
        }}
      />

      <div className="cras-stage-body">
        {tabs.length ? (
          <div className="stock-tabs" role="tablist" aria-label="Navegação do estoque">
            {tabs.map((tab) => (
              <span key={tab} className={"stock-tab" + (tab === activeTab ? " is-active" : "")}>{tab}</span>
            ))}
          </div>
        ) : null}

        <div className="stock-kpis">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="stock-kpi">
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="stock-toolbar">
          <input
            className="stock-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome, fabricante ou local"
          />
          <div className="stock-toolbar-count">{prepared.length} item(ns)</div>
        </div>

        {err ? <div className="stock-alert">{err}</div> : null}

        <div className="stock-tableWrap">
          <table className="stock-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prepared.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => {
                    let value = row[col.key];
                    if (col.key === "precoUnitario" || col.key === "valor") value = brl(value);
                    if (col.key === "quantidade") value = `${qtyFmt(value)} ${row.unidade || ""}`.trim();
                    if (col.key === "ultimaMovimentacao" || col.key === "validade") value = normalizeDate(value);
                    return (
                      <td key={`${row.id}_${col.key}`} style={col.align ? { textAlign: col.align } : undefined}>
                        {value == null || value === "" ? "—" : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!prepared.length ? <div className="stock-empty">Nenhum resultado encontrado.</div> : null}
        </div>

        {moveOpen ? (
          <div className="stock-modal-backdrop" onClick={closeMovementModal}>
            <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
              <div className="stock-modal-head">
                <div>
                  <div className="stock-modal-eyebrow">Estoque</div>
                  <h3>Registrar movimentação</h3>
                </div>
                <button type="button" className="stock-modal-close" onClick={closeMovementModal} aria-label="Fechar">
                  ×
                </button>
              </div>

              <form className="stock-modal-form" onSubmit={submitMovement}>
                <div className="stock-field">
                  <label>Tipo</label>
                  <select
                    value={movement.tipoMov}
                    onChange={(e) => setMovement((prev) => ({ ...prev, tipoMov: e.target.value }))}
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>

                <div className="stock-field stock-field-span2">
                  <label>Item</label>
                  <input
                    list={`stock-items-${kind}`}
                    value={movement.nome}
                    onChange={(e) => setMovement((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex.: Sal mineral"
                  />
                  <datalist id={`stock-items-${kind}`}>
                    {itemNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div className="stock-field">
                  <label>Categoria/Tipo</label>
                  <input
                    value={movement.tipoItem}
                    onChange={(e) => setMovement((prev) => ({ ...prev, tipoItem: e.target.value }))}
                    placeholder="Ex.: Medicamento, Sêmen, Insumo"
                  />
                </div>

                <div className="stock-field">
                  <label>Fabricante</label>
                  <input
                    value={movement.fabricante}
                    onChange={(e) => setMovement((prev) => ({ ...prev, fabricante: e.target.value }))}
                    placeholder="Ex.: Ourofino"
                  />
                </div>

                <div className="stock-field">
                  <label>Quantidade</label>
                  <input
                    value={movement.quantidade}
                    onChange={(e) => setMovement((prev) => ({ ...prev, quantidade: e.target.value }))}
                    placeholder="Ex.: 50"
                  />
                </div>

                <div className="stock-field">
                  <label>Unidade</label>
                  <input
                    value={movement.unidade}
                    onChange={(e) => setMovement((prev) => ({ ...prev, unidade: e.target.value }))}
                    placeholder="kg, saco, dose, un"
                  />
                </div>

                <div className="stock-field">
                  <label>Preço unitário (R$)</label>
                  <input
                    value={movement.precoUnitario}
                    onChange={(e) => setMovement((prev) => ({ ...prev, precoUnitario: e.target.value }))}
                    placeholder="Ex.: 122,00"
                  />
                </div>

                <div className="stock-field">
                  <label>Data</label>
                  <input
                    type="date"
                    value={movement.data}
                    onChange={(e) => setMovement((prev) => ({ ...prev, data: e.target.value }))}
                  />
                </div>

                <div className="stock-field">
                  <label>Lote/Partida</label>
                  <input
                    value={movement.lote}
                    onChange={(e) => setMovement((prev) => ({ ...prev, lote: e.target.value }))}
                    placeholder="Ex.: Lote A23"
                  />
                </div>

                <div className="stock-field">
                  <label>Validade</label>
                  <input
                    type="date"
                    value={movement.validade}
                    onChange={(e) => setMovement((prev) => ({ ...prev, validade: e.target.value }))}
                  />
                </div>

                <div className="stock-field">
                  <label>Local</label>
                  <input
                    value={movement.local}
                    onChange={(e) => setMovement((prev) => ({ ...prev, local: e.target.value }))}
                    placeholder="Ex.: Almoxarifado A"
                  />
                </div>

                <div className="stock-field stock-field-span2">
                  <label>Propriedade</label>
                  <input
                    value={movement.propriedade}
                    onChange={(e) => setMovement((prev) => ({ ...prev, propriedade: e.target.value }))}
                    placeholder="Ex.: Fazenda da Estrela"
                  />
                </div>

                {moveErr ? <div className="stock-modal-error">{moveErr}</div> : null}

                <div className="stock-modal-actions">
                  <button type="button" className="stock-btn stock-btn-soft" onClick={closeMovementModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="stock-btn stock-btn-primary">
                    Salvar movimentação
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
