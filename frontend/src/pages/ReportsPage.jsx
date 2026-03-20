import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api, getApiBase } from "../lib/api.js";
import "../styles/financeiro.css";
import "../styles/reports_print.css";

function nowYear() {
  return new Date().getFullYear();
}

function currentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function currentSemester() {
  return new Date().getMonth() < 6 ? 1 : 2;
}

function brl(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function num(v, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function qOf({ periodType, year, periodIndex, propertyName }) {
  const p = new URLSearchParams();
  p.set("period_type", periodType);
  p.set("year", String(year));
  p.set("period_index", String(periodIndex));
  if (propertyName && String(propertyName).trim()) p.set("property_name", String(propertyName).trim());
  return p.toString();
}

function filenameFromContentDisposition(cd, fallback) {
  const txt = String(cd || "");
  const m = txt.match(/filename="?([^"]+)"?/i);
  return m && m[1] ? m[1] : fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [periodType, setPeriodType] = useState("trimestral");
  const [year, setYear] = useState(nowYear());
  const [periodIndex, setPeriodIndex] = useState(currentQuarter());
  const [propertyName, setPropertyName] = useState("");
  const [exportModule, setExportModule] = useState("all");
  const [report, setReport] = useState(null);

  const maxIndex = periodType === "semestral" ? 2 : 4;

  useEffect(() => {
    if (periodIndex <= maxIndex) return;
    setPeriodIndex(maxIndex);
  }, [periodType, periodIndex, maxIndex]);

  async function loadReport() {
    setLoading(true);
    setMsg("");
    try {
      const qs = qOf({ periodType, year, periodIndex, propertyName });
      const data = await api.get(`/reports/overview?${qs}`);
      setReport(data || null);
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar painel de consultas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, year, periodIndex, propertyName]);

  async function exportCsv() {
    setMsg("");
    try {
      const qs = qOf({ periodType, year, periodIndex, propertyName });
      const modulePart = exportModule && exportModule !== "all" ? `&module=${encodeURIComponent(exportModule)}` : "";
      const base = getApiBase().replace(/\/$/, "");
      const url = `${base}/reports/export/csv?${qs}${modulePart}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Falha no export CSV (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const fallback = `relatorio_${periodType}_${year}_P${periodIndex}.csv`;
      const filename = filenameFromContentDisposition(res.headers.get("content-disposition"), fallback);
      downloadBlob(blob, filename);
    } catch (e) {
      setMsg(e?.message || "Falha ao exportar CSV.");
    }
  }

  function exportPdf() {
    setMsg("Use a janela de impressão para salvar em PDF.");
    window.print();
  }

  const periodLabel = useMemo(() => {
    if (!report?.period?.label) return periodType === "semestral" ? `Semestre ${periodIndex}/${year}` : `Trimestre ${periodIndex}/${year}`;
    return report.period.label;
  }, [report, periodType, periodIndex, year]);
  const generatedAt = useMemo(() => {
    try {
      return new Date().toLocaleString("pt-BR");
    } catch {
      return "";
    }
  }, [report, periodType, year, periodIndex, propertyName]);

  const ov = report?.overview || {};
  const md = report?.modules || {};
  const climateSeries = Array.isArray(md?.climate?.series) ? md.climate.series : [];
  const stockByMonth = Array.isArray(md?.stock?.heads_by_month) ? md.stock.heads_by_month : [];
  const areaByMonth = Array.isArray(md?.areas?.by_month) ? md.areas.by_month : [];
  const months = report?.period?.months || [];

  return (
    <div className="cras-stage-v2 faz-financeiro-v2 reports-page">
      <CrasPageHeader
        eyebrow="PAINEL DE CONSULTAS"
        title="Fechamento Trimestral/Semestral"
        subtitle="Consolidação por módulo com exportação CSV e PDF."
      />

      <section className="reports-print-cover reports-print-only">
        <h1>Fechamento Gerencial</h1>
        <p className="reports-print-subtitle">Sistema Fazenda Ideal - Painel de Consultas</p>
        <div className="reports-print-meta">
          <div><b>Periodo:</b> {periodLabel}</div>
          <div><b>Ano:</b> {year}</div>
          <div><b>Tipo:</b> {periodType}</div>
          <div><b>Propriedade:</b> {propertyName?.trim() || "Todas"}</div>
          <div><b>Gerado em:</b> {generatedAt}</div>
        </div>
      </section>

      <div className="faz-fin-filters faz-fin-filters-4 reports-no-print" style={{ marginBottom: 10 }}>
        <select
          className="faz-input"
          value={periodType}
          onChange={(e) => {
            const next = e.target.value;
            setPeriodType(next);
            setPeriodIndex(next === "semestral" ? currentSemester() : currentQuarter());
          }}
        >
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
        </select>
        <input
          className="faz-input"
          inputMode="numeric"
          placeholder="Ano"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value || nowYear()))}
        />
        <select className="faz-input" value={String(periodIndex)} onChange={(e) => setPeriodIndex(Number(e.target.value || 1))}>
          {Array.from({ length: maxIndex }).map((_, idx) => (
            <option key={idx + 1} value={idx + 1}>{periodType === "semestral" ? `Semestre ${idx + 1}` : `Trimestre ${idx + 1}`}</option>
          ))}
        </select>
        <input
          className="faz-input"
          placeholder="Propriedade (opcional)"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
        />
      </div>

      <div className="faz-fin-filters faz-fin-filters-4 reports-no-print" style={{ marginBottom: 12 }}>
        <select className="faz-input" value={exportModule} onChange={(e) => setExportModule(e.target.value)}>
          <option value="all">Exportar todos os módulos</option>
          <option value="overview">Overview</option>
          <option value="finance">Financeiro</option>
          <option value="machines">Máquinas</option>
          <option value="climate">Clima</option>
          <option value="livestock">Pecuária</option>
          <option value="stock">Efetivo</option>
          <option value="areas">Áreas</option>
          <option value="reproduction">Reprodução</option>
          <option value="nutrition">Nutrição</option>
          <option value="tasks">Tarefas</option>
          <option value="notifications">Notificações</option>
        </select>
        <button type="button" className="btn-refresh" onClick={loadReport}>Atualizar painel</button>
        <button type="button" className="btn-refresh" onClick={exportCsv}>Exportar CSV</button>
        <button type="button" className="btn-refresh" onClick={exportPdf}>Exportar PDF</button>
      </div>

      <div className="faz-fin-note reports-period-note">
        Período selecionado: <b>{periodLabel}</b>
      </div>
      {msg ? <div className="faz-fin-note reports-no-print">{msg}</div> : null}

      <div className="faz-fin-kpis reports-print-section">
        <div className="kpi"><span>Receita</span><b>{brl(ov.revenue_brl || 0)}</b></div>
        <div className="kpi"><span>Despesa</span><b>{brl(ov.cost_brl || 0)}</b></div>
        <div className="kpi"><span>Margem</span><b>{brl(ov.margin_brl || 0)}</b></div>
        <div className="kpi"><span>Custo Máquinas</span><b>{brl(ov.machine_cost_brl || 0)}</b></div>
        <div className="kpi"><span>Compras Nutrição</span><b>{brl(ov.nutrition_brl || 0)}</b></div>
        <div className="kpi"><span>Saldo Pecuária</span><b>{num(ov.livestock_net_heads || 0)} cab</b></div>
        <div className="kpi"><span>Efetivo médio</span><b>{num(ov.stock_avg_heads || 0, 1)} cab</b></div>
        <div className="kpi"><span>Área média</span><b>{num(ov.areas_avg_ha || 0, 2)} ha</b></div>
        <div className="kpi"><span>Chuva total</span><b>{num(ov.rain_mm || 0, 2)} mm</b></div>
        <div className="kpi"><span>Tarefas criadas</span><b>{num(ov.tasks_created || 0)}</b></div>
        <div className="kpi"><span>Tarefas vencidas</span><b>{num(ov.tasks_overdue || 0)}</b></div>
        <div className="kpi"><span>Notificações não lidas</span><b>{num(ov.notifications_unread || 0)}</b></div>
      </div>

      <div className="faz-fin-tableWrap reports-print-section" style={{ marginTop: 12 }}>
        <h4>Resumo por módulo</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Métrica 1</th>
              <th>Métrica 2</th>
              <th>Métrica 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Financeiro</td>
              <td>Receitas: {brl(md?.finance?.total_revenue_brl || 0)}</td>
              <td>Despesas: {brl(md?.finance?.total_cost_brl || 0)}</td>
              <td>Margem: {brl(md?.finance?.margin_brl || 0)}</td>
            </tr>
            <tr>
              <td>Pecuária</td>
              <td>Eventos: {num(md?.livestock?.events || 0)}</td>
              <td>Entradas: {num(md?.livestock?.entered_heads || 0)} cab</td>
              <td>Saídas: {num(md?.livestock?.exited_heads || 0)} cab</td>
            </tr>
            <tr>
              <td>Efetivo</td>
              <td>Registros: {num(md?.stock?.records || 0)}</td>
              <td>Média: {num(md?.stock?.avg_heads_period || 0, 1)} cab</td>
              <td>Último mês: {num(md?.stock?.latest_heads || 0)} cab</td>
            </tr>
            <tr>
              <td>Áreas</td>
              <td>Total: {num(md?.areas?.total_area_ha || 0, 2)} ha</td>
              <td>Média mensal: {num(md?.areas?.avg_area_ha_month || 0, 2)} ha</td>
              <td>Registros: {num(md?.areas?.records || 0)}</td>
            </tr>
            <tr>
              <td>Máquinas</td>
              <td>Eventos: {num(md?.machines?.events || 0)}</td>
              <td>Total: {brl(md?.machines?.total_brl || 0)}</td>
              <td>Tipos: {num((md?.machines?.by_type || []).length)}</td>
            </tr>
            <tr>
              <td>Clima</td>
              <td>Registros: {num(md?.climate?.records || 0)}</td>
              <td>Chuva total: {num(md?.climate?.total_rain_mm || 0, 2)} mm</td>
              <td>Meses: {num((md?.climate?.series || []).length)}</td>
            </tr>
            <tr>
              <td>Reprodução</td>
              <td>Eventos: {num(md?.reproduction?.events || 0)}</td>
              <td>Cabeças: {num(md?.reproduction?.heads_involved || 0)}</td>
              <td>Tipos: {num((md?.reproduction?.by_type || []).length)}</td>
            </tr>
            <tr>
              <td>Tarefas/Notificações</td>
              <td>Criadas: {num(md?.tasks?.created || 0)}</td>
              <td>Concluídas: {num(md?.tasks?.completed || 0)}</td>
              <td>Não lidas: {num(md?.notifications?.unread_total || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="faz-fin-tableWrap reports-print-section reports-print-break-before" style={{ marginTop: 12 }}>
        <h4>Série do período ({months.join(", ") || "—"})</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Chuva (mm)</th>
              <th>Efetivo (cab)</th>
              <th>Área (ha)</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const rain = climateSeries.find((x) => x.month === m)?.rain_mm || 0;
              const heads = stockByMonth.find((x) => x.month === m)?.heads || 0;
              const area = areaByMonth.find((x) => x.month === m)?.area_ha || 0;
              return (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{num(rain, 2)}</td>
                  <td>{num(heads)}</td>
                  <td>{num(area, 2)}</td>
                </tr>
              );
            })}
            {!months.length ? (
              <tr><td colSpan={4}>{loading ? "Carregando..." : "Sem dados no período."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
