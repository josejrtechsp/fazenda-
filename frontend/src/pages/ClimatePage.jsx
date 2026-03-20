import React, { useEffect, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function nowMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ClimatePage() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total_mm: 0, series: [] });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    reference_month: nowMonth(),
    property_name: "Fazenda da Estrela",
    rain_mm: "",
    notes: "",
  });

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const [r, s] = await Promise.all([
        api.get("/climate?limit=240"),
        api.get("/climate/summary?months=12"),
      ]);
      setRecords(Array.isArray(r) ? r : []);
      setSummary(s || { total_mm: 0, series: [] });
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar módulo de clima.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveRecord(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/climate", {
        ...form,
        rain_mm: Number(String(form.rain_mm || "0").replace(",", ".")),
      });
      setForm((p) => ({ ...p, rain_mm: "", notes: "" }));
      await loadAll();
      setMsg("Lançamento de chuva salvo.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar lançamento.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="CLIMA"
        title="Lançamentos de chuva (mm)"
        subtitle="Série mensal por propriedade."
      />

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Lançamentos</span><b>{records.length}</b></div>
        <div className="kpi"><span>Acumulado (12 meses)</span><b>{Number(summary?.total_mm || 0).toFixed(1)} mm</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveRecord}>
        <h4>Novo lançamento</h4>
        <div className="faz-fin-filters faz-fin-filters-4">
          <input className="faz-input" type="month" required value={form.reference_month} onChange={(e) => setForm((p) => ({ ...p, reference_month: e.target.value }))} />
          <input className="faz-input" required placeholder="Propriedade" value={form.property_name} onChange={(e) => setForm((p) => ({ ...p, property_name: e.target.value }))} />
          <input className="faz-input" required inputMode="decimal" placeholder="mm de chuva" value={form.rain_mm} onChange={(e) => setForm((p) => ({ ...p, rain_mm: e.target.value }))} />
          <input className="faz-input" placeholder="Observações" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="faz-fin-switches">
          <button type="submit" className="btn-refresh">Salvar clima</button>
        </div>
      </form>

      <div className="faz-fin-tableWrap">
        <h4>Histórico</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Propriedade</th>
              <th>Chuva (mm)</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.reference_month}</td>
                <td>{r.property_name}</td>
                <td>{Number(r.rain_mm || 0).toFixed(1)}</td>
                <td>{r.notes || "—"}</td>
              </tr>
            ))}
            {!records.length ? (
              <tr><td colSpan={4}>{loading ? "Carregando..." : "Sem lançamentos de clima."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
