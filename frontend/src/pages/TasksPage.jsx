import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function ymd(v) {
  if (!v) return "—";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function nowYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignee: "",
    status: "aberta",
    priority: "media",
    due_date: nowYmd(),
    notify_before_hours: "24",
    unit: "hora",
  });

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const [t, n] = await Promise.all([
        api.get("/tasks?limit=500"),
        api.get("/notifications?unread_only=true&limit=1000"),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setUnreadCount(Array.isArray(n) ? n.length : 0);
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar tarefas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const statusCount = useMemo(() => {
    const out = { aberta: 0, em_andamento: 0, concluida: 0, cancelada: 0 };
    for (const t of tasks) {
      const s = String(t.status || "aberta");
      if (!(s in out)) out[s] = 0;
      out[s] += 1;
    }
    return out;
  }, [tasks]);

  async function saveTask(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/tasks", {
        ...form,
        notify_before_hours: Number(form.notify_before_hours || 24),
        due_date: form.due_date ? `${form.due_date}T12:00:00` : null,
      });
      setForm((p) => ({ ...p, title: "", description: "", assignee: "" }));
      await loadAll();
      setMsg("Tarefa cadastrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar tarefa.");
    }
  }

  async function completeTask(id) {
    setMsg("");
    try {
      await api.post(`/tasks/${id}/complete`, {});
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao concluir tarefa.");
    }
  }

  async function changeStatus(task, status) {
    setMsg("");
    try {
      await api.patch(`/tasks/${task.id}`, { status });
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao atualizar status.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="ROTINAS GERENCIAIS"
        title="Tarefas"
        subtitle="Responsável, prazo, status e notificação."
      />

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Total</span><b>{tasks.length}</b></div>
        <div className="kpi"><span>Abertas</span><b>{statusCount.aberta || 0}</b></div>
        <div className="kpi"><span>Em andamento</span><b>{statusCount.em_andamento || 0}</b></div>
        <div className="kpi"><span>Concluídas</span><b>{statusCount.concluida || 0}</b></div>
        <div className="kpi"><span>Notificações não lidas</span><b>{unreadCount}</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveTask}>
        <h4>Nova tarefa</h4>
        <div className="faz-fin-filters faz-fin-filters-4">
          <input className="faz-input" required placeholder="Título" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input className="faz-input" placeholder="Responsável" value={form.assignee} onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))} />
          <input className="faz-input" type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
          <select className="faz-input" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
        <div className="faz-fin-filters faz-fin-filters-4">
          <select className="faz-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="aberta">Aberta</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <input className="faz-input" inputMode="numeric" placeholder="Notificar antes (h)" value={form.notify_before_hours} onChange={(e) => setForm((p) => ({ ...p, notify_before_hours: e.target.value }))} />
          <input className="faz-input" placeholder="Unidade" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
          <input className="faz-input" placeholder="Descrição" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="faz-fin-switches">
          <button type="submit" className="btn-refresh">Salvar tarefa</button>
        </div>
      </form>

      <div className="faz-fin-tableWrap">
        <h4>Tarefas cadastradas</h4>
        <table className="faz-fin-table">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.assignee || "—"}</td>
                <td>{ymd(t.due_date)}</td>
                <td>{t.priority}</td>
                <td>{t.status}</td>
                <td>
                  {t.status !== "concluida" ? (
                    <button className="faz-btn" type="button" onClick={() => completeTask(t.id)}>Concluir</button>
                  ) : null}
                  {t.status !== "em_andamento" ? (
                    <button className="faz-btn" type="button" onClick={() => changeStatus(t, "em_andamento")}>Iniciar</button>
                  ) : (
                    <button className="faz-btn" type="button" onClick={() => changeStatus(t, "aberta")}>Reabrir</button>
                  )}
                </td>
              </tr>
            ))}
            {!tasks.length ? <tr><td colSpan={6}>{loading ? "Carregando..." : "Sem tarefas."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
