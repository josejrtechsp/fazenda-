import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function brl(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ymd(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function nowYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function MachinesPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [machines, setMachines] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ total_brl: 0, total_movements: 0, by_type: [] });

  const [machineForm, setMachineForm] = useState({
    name: "",
    machine_type: "MAQUINA",
    brand: "",
    model: "",
    plate: "",
    hour_meter: "",
    notes: "",
  });

  const [movementForm, setMovementForm] = useState({
    machine_id: "",
    occurred_at: nowYmd(),
    movement_type: "COMBUSTIVEL",
    description: "",
    value_brl: "",
    quantity: "",
    unit: "L",
    supplier: "",
    notes: "",
  });

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const [mRes, mvRes, sRes] = await Promise.all([
        api.get("/machines?include_inactive=false&limit=500"),
        api.get("/machines/movements?limit=300"),
        api.get("/machines/summary"),
      ]);
      const mList = Array.isArray(mRes) ? mRes : [];
      setMachines(mList);
      setMovements(Array.isArray(mvRes) ? mvRes : []);
      setSummary(sRes || { total_brl: 0, total_movements: 0, by_type: [] });
      if (!movementForm.machine_id && mList.length > 0) {
        setMovementForm((p) => ({ ...p, machine_id: String(mList[0].id || "") }));
      }
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar módulo de máquinas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMachine = useMemo(
    () => machines.find((m) => String(m?.id || "") === String(movementForm.machine_id || "")),
    [machines, movementForm.machine_id]
  );

  async function saveMachine(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/machines", {
        ...machineForm,
        hour_meter: Number(machineForm.hour_meter || 0),
      });
      setMachineForm({
        name: "",
        machine_type: "MAQUINA",
        brand: "",
        model: "",
        plate: "",
        hour_meter: "",
        notes: "",
      });
      await loadAll();
      setMsg("Máquina cadastrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao cadastrar máquina.");
    }
  }

  async function saveMovement(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/machines/movements", {
        ...movementForm,
        machine_id: Number(movementForm.machine_id),
        value_brl: Number(String(movementForm.value_brl || "0").replace(",", ".")),
        quantity: Number(String(movementForm.quantity || "0").replace(",", ".")),
        occurred_at: movementForm.occurred_at ? `${movementForm.occurred_at}T12:00:00` : undefined,
      });
      setMovementForm((p) => ({
        ...p,
        occurred_at: nowYmd(),
        description: "",
        value_brl: "",
        quantity: "",
        supplier: "",
        notes: "",
      }));
      await loadAll();
      setMsg("Movimentação registrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao registrar movimentação.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="MÁQUINAS"
        title="Cadastros e Movimentações"
        subtitle="Controle de máquinas, implementos e custos associados."
      />

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Máquinas ativas</span><b>{machines.length}</b></div>
        <div className="kpi"><span>Movimentações</span><b>{summary?.total_movements || 0}</b></div>
        <div className="kpi"><span>Total custos</span><b>{brl(summary?.total_brl || 0)}</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <div className="faz-fin-launch-grid">
        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveMachine}>
          <h4>Cadastro de máquina/implemento</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" required placeholder="Nome" value={machineForm.name} onChange={(e) => setMachineForm((p) => ({ ...p, name: e.target.value }))} />
            <select className="faz-input" value={machineForm.machine_type} onChange={(e) => setMachineForm((p) => ({ ...p, machine_type: e.target.value }))}>
              <option value="MAQUINA">Máquina</option>
              <option value="IMPLEMENTO">Implemento</option>
              <option value="OUTRO">Outro</option>
            </select>
            <input className="faz-input" placeholder="Marca" value={machineForm.brand} onChange={(e) => setMachineForm((p) => ({ ...p, brand: e.target.value }))} />
            <input className="faz-input" placeholder="Modelo" value={machineForm.model} onChange={(e) => setMachineForm((p) => ({ ...p, model: e.target.value }))} />
          </div>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" placeholder="Placa" value={machineForm.plate} onChange={(e) => setMachineForm((p) => ({ ...p, plate: e.target.value }))} />
            <input className="faz-input" inputMode="decimal" placeholder="Horímetro atual" value={machineForm.hour_meter} onChange={(e) => setMachineForm((p) => ({ ...p, hour_meter: e.target.value }))} />
            <input className="faz-input" placeholder="Observações" value={machineForm.notes} onChange={(e) => setMachineForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Salvar cadastro</button>
          </div>
        </form>

        <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveMovement}>
          <h4>Lançar movimentação de custos</h4>
          <div className="faz-fin-filters faz-fin-filters-4">
            <select className="faz-input" required value={movementForm.machine_id} onChange={(e) => setMovementForm((p) => ({ ...p, machine_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {machines.map((m) => (
                <option key={m.id} value={String(m.id)}>{m.name}</option>
              ))}
            </select>
            <input className="faz-input" type="date" value={movementForm.occurred_at} onChange={(e) => setMovementForm((p) => ({ ...p, occurred_at: e.target.value }))} />
            <select className="faz-input" value={movementForm.movement_type} onChange={(e) => setMovementForm((p) => ({ ...p, movement_type: e.target.value }))}>
              <option value="COMBUSTIVEL">Combustível</option>
              <option value="MANUTENCAO">Manutenção</option>
              <option value="SEGURO">Seguro</option>
              <option value="IMPOSTO">Imposto</option>
              <option value="MULTA">Multa</option>
              <option value="OUTRO">Outro</option>
            </select>
            <input className="faz-input" required inputMode="decimal" placeholder="Valor (R$)" value={movementForm.value_brl} onChange={(e) => setMovementForm((p) => ({ ...p, value_brl: e.target.value }))} />
          </div>
          <div className="faz-fin-filters faz-fin-filters-4">
            <input className="faz-input" placeholder="Descrição" value={movementForm.description} onChange={(e) => setMovementForm((p) => ({ ...p, description: e.target.value }))} />
            <input className="faz-input" inputMode="decimal" placeholder="Quantidade" value={movementForm.quantity} onChange={(e) => setMovementForm((p) => ({ ...p, quantity: e.target.value }))} />
            <input className="faz-input" placeholder="Unidade" value={movementForm.unit} onChange={(e) => setMovementForm((p) => ({ ...p, unit: e.target.value }))} />
            <input className="faz-input" placeholder="Fornecedor" value={movementForm.supplier} onChange={(e) => setMovementForm((p) => ({ ...p, supplier: e.target.value }))} />
          </div>
          <div className="faz-fin-filters">
            <input className="faz-input" placeholder="Observações" value={movementForm.notes} onChange={(e) => setMovementForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="faz-fin-note">
            Máquina selecionada: <b>{selectedMachine?.name || "—"}</b>
          </div>
          <div className="faz-fin-switches">
            <button type="submit" className="btn-refresh">Registrar movimentação</button>
          </div>
        </form>
      </div>

      <div className="faz-fin-tableWrap">
        <h4>Últimas movimentações</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Máquina</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{ymd(m.occurred_at)}</td>
                <td>{machines.find((x) => Number(x.id) === Number(m.machine_id))?.name || `#${m.machine_id}`}</td>
                <td>{m.movement_type}</td>
                <td>{m.description || "—"}</td>
                <td>{brl(m.value_brl)}</td>
              </tr>
            ))}
            {!movements.length ? (
              <tr><td colSpan={5}>{loading ? "Carregando..." : "Sem movimentações."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
