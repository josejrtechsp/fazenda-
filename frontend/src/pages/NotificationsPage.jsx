import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function when(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const res = await api.get("/notifications?limit=1000");
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const unread = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  async function markRead(id) {
    setMsg("");
    try {
      await api.patch(`/notifications/${id}/read`, {});
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao marcar notificação.");
    }
  }

  async function markAllRead() {
    setMsg("");
    try {
      await api.post("/notifications/read-all", {});
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao marcar todas.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="NOTIFICAÇÕES"
        title="Central de notificações"
        subtitle="Mudanças de tarefas e alertas operacionais."
      />

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Total</span><b>{rows.length}</b></div>
        <div className="kpi"><span>Não lidas</span><b>{unread}</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <div className="faz-fin-switches">
        <button type="button" className="btn-refresh" onClick={markAllRead}>Marcar todas como lidas</button>
      </div>

      <div className="faz-fin-tableWrap">
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Mensagem</th>
              <th>Tarefa</th>
              <th>Quando</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.notification_type}</td>
                <td>{r.message}</td>
                <td>{r.task_id ? `#${r.task_id}` : "—"}</td>
                <td>{when(r.created_at)}</td>
                <td>{r.is_read ? "Lida" : "Não lida"}</td>
                <td>
                  {!r.is_read ? (
                    <button className="faz-btn" type="button" onClick={() => markRead(r.id)}>Marcar lida</button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6}>{loading ? "Carregando..." : "Sem notificações."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
