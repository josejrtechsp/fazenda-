import React, { useEffect, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function nowYmd() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyNow() {
  return new Date().toISOString().slice(0, 7);
}

function brl(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function kg(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0 kg";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

function ha(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0 ha";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

function q(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR");
}

function ymd(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function queryOf(month, propertyName) {
  const p = new URLSearchParams();
  if (month) p.set("month", month);
  if (propertyName) p.set("property_name", propertyName);
  return p.toString();
}

export default function PecuariaPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [month, setMonth] = useState(monthKeyNow());
  const [propertyName, setPropertyName] = useState("");

  const [movementSummary, setMovementSummary] = useState({
    total_events: 0,
    entered_heads: 0,
    exited_heads: 0,
    net_heads: 0,
    total_value_brl: 0,
  });
  const [stockSummary, setStockSummary] = useState({
    total_heads: 0,
    avg_weight_kg: 0,
    total_weight_kg: 0,
  });
  const [areaSummary, setAreaSummary] = useState({ total_area_ha: 0 });
  const [reproSummary, setReproSummary] = useState({ total_events: 0, total_heads_involved: 0 });

  const [movements, setMovements] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [areasRows, setAreasRows] = useState([]);
  const [reproRows, setReproRows] = useState([]);

  const [movementForm, setMovementForm] = useState({
    occurred_at: nowYmd(),
    movement_type: "NASCIMENTO",
    property_name: "Fazenda",
    lot_from: "",
    lot_to: "",
    category: "",
    heads: "",
    avg_weight_kg: "",
    value_brl: "",
    notes: "",
  });

  const [stockForm, setStockForm] = useState({
    reference_month: monthKeyNow(),
    property_name: "Fazenda",
    category: "",
    heads: "",
    avg_weight_kg: "",
    total_weight_kg: "",
    notes: "",
  });

  const [areaForm, setAreaForm] = useState({
    reference_month: monthKeyNow(),
    property_name: "Fazenda",
    area_type: "PASTAGEM",
    area_ha: "",
    notes: "",
  });

  const [reproForm, setReproForm] = useState({
    occurred_at: nowYmd(),
    event_type: "IATF",
    property_name: "Fazenda",
    lot_name: "",
    animal_ear_tag: "",
    heads_involved: "",
    protocol: "",
    semen: "",
    result: "",
    status: "registrado",
    notes: "",
  });

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const qs = queryOf(month, propertyName);
      const [mRows, mSum, sRows, sSum, aRows, aSum, rRows, rSum] = await Promise.all([
        api.get(`/livestock/movements?limit=150${qs ? `&${qs}` : ""}`),
        api.get(`/livestock/movements/summary${qs ? `?${qs}` : ""}`),
        api.get(`/livestock/monthly-stock?limit=200${qs ? `&${qs}` : ""}`),
        api.get(`/livestock/monthly-stock/summary${qs ? `?${qs}` : ""}`),
        api.get(`/livestock/monthly-areas?limit=200${qs ? `&${qs}` : ""}`),
        api.get(`/livestock/monthly-areas/summary${qs ? `?${qs}` : ""}`),
        api.get(`/livestock/reproduction?limit=200${qs ? `&${qs}` : ""}`),
        api.get(`/livestock/reproduction/summary${qs ? `?${qs}` : ""}`),
      ]);

      setMovements(Array.isArray(mRows) ? mRows : []);
      setMovementSummary(mSum || {});
      setStockRows(Array.isArray(sRows) ? sRows : []);
      setStockSummary(sSum || {});
      setAreasRows(Array.isArray(aRows) ? aRows : []);
      setAreaSummary(aSum || {});
      setReproRows(Array.isArray(rRows) ? rRows : []);
      setReproSummary(rSum || {});
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar modulo de pecuaria.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, propertyName]);

  async function saveMovement(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/livestock/movements", {
        ...movementForm,
        occurred_at: movementForm.occurred_at ? `${movementForm.occurred_at}T12:00:00` : undefined,
        heads: Number(movementForm.heads || 0),
        avg_weight_kg: Number(String(movementForm.avg_weight_kg || "0").replace(",", ".")),
        value_brl: Number(String(movementForm.value_brl || "0").replace(",", ".")),
      });
      setMovementForm((p) => ({
        ...p,
        occurred_at: nowYmd(),
        lot_from: "",
        lot_to: "",
        category: "",
        heads: "",
        avg_weight_kg: "",
        value_brl: "",
        notes: "",
      }));
      await loadAll();
      setMsg("Movimentacao pecuaria registrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar movimentacao.");
    }
  }

  async function saveStock(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/livestock/monthly-stock", {
        ...stockForm,
        heads: Number(stockForm.heads || 0),
        avg_weight_kg: Number(String(stockForm.avg_weight_kg || "0").replace(",", ".")),
        total_weight_kg: Number(String(stockForm.total_weight_kg || "0").replace(",", ".")),
      });
      setStockForm((p) => ({ ...p, category: "", heads: "", avg_weight_kg: "", total_weight_kg: "", notes: "" }));
      await loadAll();
      setMsg("Efetivo mensal atualizado.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar efetivo mensal.");
    }
  }

  async function saveArea(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/livestock/monthly-areas", {
        ...areaForm,
        area_ha: Number(String(areaForm.area_ha || "0").replace(",", ".")),
      });
      setAreaForm((p) => ({ ...p, area_ha: "", notes: "" }));
      await loadAll();
      setMsg("Area produtiva mensal atualizada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar area mensal.");
    }
  }

  async function saveRepro(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/livestock/reproduction", {
        ...reproForm,
        occurred_at: reproForm.occurred_at ? `${reproForm.occurred_at}T12:00:00` : undefined,
        heads_involved: Number(reproForm.heads_involved || 0),
      });
      setReproForm((p) => ({
        ...p,
        occurred_at: nowYmd(),
        lot_name: "",
        animal_ear_tag: "",
        heads_involved: "",
        protocol: "",
        semen: "",
        result: "",
        notes: "",
      }));
      await loadAll();
      setMsg("Evento de reproducao registrado.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar evento de reproducao.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="PECUARIA"
        title="Movimentacoes, Efetivo, Areas e Reproducao"
        subtitle="Modulo de fechamento pecuario alinhado ao escopo Inttegra."
      />

      <div className="faz-fin-filters faz-fin-filters-4" style={{ marginBottom: 12 }}>
        <input className="faz-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <input
          className="faz-input"
          placeholder="Propriedade (opcional)"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
        />
      </div>

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Eventos pecuarios</span><b>{q(movementSummary?.total_events || 0)}</b></div>
        <div className="kpi"><span>Saldo cabecas</span><b>{q(movementSummary?.net_heads || 0)}</b></div>
        <div className="kpi"><span>Efetivo mensal</span><b>{q(stockSummary?.total_heads || 0)}</b></div>
        <div className="kpi"><span>Peso total</span><b>{kg(stockSummary?.total_weight_kg || 0)}</b></div>
        <div className="kpi"><span>Area produtiva</span><b>{ha(areaSummary?.total_area_ha || 0)}</b></div>
        <div className="kpi"><span>Eventos reproducao</span><b>{q(reproSummary?.total_events || 0)}</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <div className="faz-fin-launch-grid">
        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveMovement}>
          <h4>Movimentacao pecuaria</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" type="date" value={movementForm.occurred_at} onChange={(e) => setMovementForm((p) => ({ ...p, occurred_at: e.target.value }))} />
            <select className="faz-input" value={movementForm.movement_type} onChange={(e) => setMovementForm((p) => ({ ...p, movement_type: e.target.value }))}>
              <option value="NASCIMENTO">Nascimento</option>
              <option value="COMPRA">Compra</option>
              <option value="TRANSFERENCIA_ENTRADA">Transferencia entrada</option>
              <option value="ESTOQUE_PARTIDA">Estoque de partida</option>
              <option value="ABATE">Abate</option>
              <option value="VENDA_PE">Venda em pe</option>
              <option value="TRANSFERENCIA_SAIDA">Transferencia saida</option>
              <option value="MORTE">Morte</option>
              <option value="CONSUMO">Consumo</option>
              <option value="DOACAO">Doacao</option>
              <option value="DESMAME">Desmame</option>
              <option value="CONFINAMENTO">Confinamento</option>
              <option value="SEMICONFINAMENTO">Semiconfinamento</option>
              <option value="TIP">TIP</option>
              <option value="RIP">RIP</option>
            </select>
            <input className="faz-input" required placeholder="Cabecas" value={movementForm.heads} onChange={(e) => setMovementForm((p) => ({ ...p, heads: e.target.value }))} />
            <input className="faz-input" placeholder="Categoria" value={movementForm.category} onChange={(e) => setMovementForm((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" placeholder="Lote origem" value={movementForm.lot_from} onChange={(e) => setMovementForm((p) => ({ ...p, lot_from: e.target.value }))} />
            <input className="faz-input" placeholder="Lote destino" value={movementForm.lot_to} onChange={(e) => setMovementForm((p) => ({ ...p, lot_to: e.target.value }))} />
            <input className="faz-input" placeholder="Peso medio (kg)" value={movementForm.avg_weight_kg} onChange={(e) => setMovementForm((p) => ({ ...p, avg_weight_kg: e.target.value }))} />
            <input className="faz-input" placeholder="Valor (R$)" value={movementForm.value_brl} onChange={(e) => setMovementForm((p) => ({ ...p, value_brl: e.target.value }))} />
          </div>
          <div className="faz-fin-filters">
            <input className="faz-input" placeholder="Observacoes" value={movementForm.notes} onChange={(e) => setMovementForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Salvar movimentacao</button>
          </div>
        </form>

        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveStock}>
          <h4>Efetivo pecuario mensal</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" type="month" value={stockForm.reference_month} onChange={(e) => setStockForm((p) => ({ ...p, reference_month: e.target.value }))} />
            <input className="faz-input" required placeholder="Categoria" value={stockForm.category} onChange={(e) => setStockForm((p) => ({ ...p, category: e.target.value }))} />
            <input className="faz-input" required placeholder="Cabecas" value={stockForm.heads} onChange={(e) => setStockForm((p) => ({ ...p, heads: e.target.value }))} />
            <input className="faz-input" placeholder="Peso medio (kg)" value={stockForm.avg_weight_kg} onChange={(e) => setStockForm((p) => ({ ...p, avg_weight_kg: e.target.value }))} />
          </div>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" placeholder="Peso total (kg, opcional)" value={stockForm.total_weight_kg} onChange={(e) => setStockForm((p) => ({ ...p, total_weight_kg: e.target.value }))} />
            <input className="faz-input" placeholder="Observacoes" value={stockForm.notes} onChange={(e) => setStockForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Salvar efetivo</button>
          </div>
        </form>

        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveArea}>
          <h4>Area produtiva mensal</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" type="month" value={areaForm.reference_month} onChange={(e) => setAreaForm((p) => ({ ...p, reference_month: e.target.value }))} />
            <select className="faz-input" value={areaForm.area_type} onChange={(e) => setAreaForm((p) => ({ ...p, area_type: e.target.value }))}>
              <option value="PASTAGEM">Pastagem</option>
              <option value="ILP">ILP</option>
              <option value="VOLUMOSO">Volumoso</option>
              <option value="REFORMA">Reforma</option>
              <option value="ALAGADA">Alagada</option>
              <option value="OUTRA">Outra</option>
            </select>
            <input className="faz-input" required placeholder="Area (ha)" value={areaForm.area_ha} onChange={(e) => setAreaForm((p) => ({ ...p, area_ha: e.target.value }))} />
            <input className="faz-input" placeholder="Observacoes" value={areaForm.notes} onChange={(e) => setAreaForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Salvar area mensal</button>
          </div>
        </form>

        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveRepro}>
          <h4>Reproducao (IATF, parto, desmame)</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" type="date" value={reproForm.occurred_at} onChange={(e) => setReproForm((p) => ({ ...p, occurred_at: e.target.value }))} />
            <select className="faz-input" value={reproForm.event_type} onChange={(e) => setReproForm((p) => ({ ...p, event_type: e.target.value }))}>
              <option value="IATF">IATF</option>
              <option value="RESYNC">Resync</option>
              <option value="DIAGNOSTICO_PRENHEZ">Diagnostico prenhez</option>
              <option value="PARTO">Parto</option>
              <option value="DESMAME">Desmame</option>
              <option value="ABORTO">Aborto</option>
              <option value="SECAGEM">Secagem</option>
              <option value="OUTRO">Outro</option>
            </select>
            <input className="faz-input" placeholder="Lote" value={reproForm.lot_name} onChange={(e) => setReproForm((p) => ({ ...p, lot_name: e.target.value }))} />
            <input className="faz-input" placeholder="Brinco (opcional)" value={reproForm.animal_ear_tag} onChange={(e) => setReproForm((p) => ({ ...p, animal_ear_tag: e.target.value }))} />
          </div>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" placeholder="Cabecas envolvidas" value={reproForm.heads_involved} onChange={(e) => setReproForm((p) => ({ ...p, heads_involved: e.target.value }))} />
            <input className="faz-input" placeholder="Protocolo" value={reproForm.protocol} onChange={(e) => setReproForm((p) => ({ ...p, protocol: e.target.value }))} />
            <input className="faz-input" placeholder="Semen" value={reproForm.semen} onChange={(e) => setReproForm((p) => ({ ...p, semen: e.target.value }))} />
            <input className="faz-input" placeholder="Resultado" value={reproForm.result} onChange={(e) => setReproForm((p) => ({ ...p, result: e.target.value }))} />
          </div>
          <div className="faz-fin-filters">
            <input className="faz-input" placeholder="Observacoes" value={reproForm.notes} onChange={(e) => setReproForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Salvar evento</button>
          </div>
        </form>
      </div>

      <div className="faz-fin-tableWrap" style={{ marginTop: 12 }}>
        <h4>Ultimos eventos pecuarios</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Cabecas</th>
              <th>Peso total</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((r) => (
              <tr key={r.id}>
                <td>{ymd(r.occurred_at)}</td>
                <td>{r.movement_type}</td>
                <td>{r.category || "—"}</td>
                <td>{q(r.heads)}</td>
                <td>{kg(r.total_weight_kg)}</td>
                <td>{brl(r.value_brl)}</td>
              </tr>
            ))}
            {!movements.length ? (
              <tr><td colSpan={6}>{loading ? "Carregando..." : "Sem eventos no periodo."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="faz-fin-tableWrap" style={{ marginTop: 12 }}>
        <h4>Efetivo mensal por categoria</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Categoria</th>
              <th>Cabecas</th>
              <th>Peso medio</th>
              <th>Peso total</th>
            </tr>
          </thead>
          <tbody>
            {stockRows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference_month}</td>
                <td>{r.category}</td>
                <td>{q(r.heads)}</td>
                <td>{kg(r.avg_weight_kg)}</td>
                <td>{kg(r.total_weight_kg)}</td>
              </tr>
            ))}
            {!stockRows.length ? (
              <tr><td colSpan={5}>{loading ? "Carregando..." : "Sem efetivo mensal no periodo."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="faz-fin-tableWrap" style={{ marginTop: 12 }}>
        <h4>Area produtiva e reproducao</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Area tipo</th>
              <th>Area (ha)</th>
              <th>Reproducao</th>
              <th>Cabecas</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(areasRows.length, reproRows.length) }).map((_, idx) => {
              const a = areasRows[idx];
              const rr = reproRows[idx];
              return (
                <tr key={`${a?.id || "a"}_${rr?.id || "r"}_${idx}`}>
                  <td>{a?.reference_month || rr?.reference_month || "—"}</td>
                  <td>{a?.area_type || "—"}</td>
                  <td>{a ? ha(a.area_ha) : "—"}</td>
                  <td>{rr?.event_type || "—"}</td>
                  <td>{rr ? q(rr.heads_involved || 0) : "—"}</td>
                </tr>
              );
            })}
            {!areasRows.length && !reproRows.length ? (
              <tr><td colSpan={5}>{loading ? "Carregando..." : "Sem registros de area/reproducao no periodo."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
