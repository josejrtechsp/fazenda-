import React, { useEffect, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro.css";

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function PlanningPage() {
  const [tab, setTab] = useState("goals");
  const [msg, setMsg] = useState("");
  const [goals, setGoals] = useState([]);
  const [goalSummary, setGoalSummary] = useState({ total: 0, status: {}, avg_progress_pct: 0 });
  const [disc, setDisc] = useState([]);
  const [cultural, setCultural] = useState([]);

  const [goalForm, setGoalForm] = useState({
    title: "",
    season: "2025/2026",
    area: "Pecuária",
    period_type: "trimestral",
    unit: "%",
    target_value: "",
    current_value: "",
    status: "aberta",
    notes: "",
  });

  const [discForm, setDiscForm] = useState({
    respondent_name: "",
    season: "2025/2026",
    dominance: "25",
    influence: "25",
    stability: "25",
    conformity: "25",
    notes: "",
  });

  const [culturalForm, setCulturalForm] = useState({
    leader_name: "",
    season: "2025/2026",
    culture_score: "0",
    management_score: "0",
    team_score: "0",
    notes: "",
  });

  async function loadAll() {
    setMsg("");
    try {
      const [g, gs, d, c] = await Promise.all([
        api.get("/planning/goals?limit=300"),
        api.get("/planning/goals/summary"),
        api.get("/planning/disc?limit=120"),
        api.get("/planning/cultural-map?limit=120"),
      ]);
      setGoals(Array.isArray(g) ? g : []);
      setGoalSummary(gs || { total: 0, status: {}, avg_progress_pct: 0 });
      setDisc(Array.isArray(d) ? d : []);
      setCultural(Array.isArray(c) ? c : []);
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar planejamento.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveGoal(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/planning/goals", {
        ...goalForm,
        target_value: Number(String(goalForm.target_value || "0").replace(",", ".")),
        current_value: Number(String(goalForm.current_value || "0").replace(",", ".")),
      });
      setGoalForm((p) => ({ ...p, title: "", target_value: "", current_value: "", notes: "" }));
      await loadAll();
      setMsg("Meta cadastrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao cadastrar meta.");
    }
  }

  async function updateGoalStatus(goal, status) {
    setMsg("");
    try {
      await api.patch(`/planning/goals/${goal.id}`, { status });
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao atualizar meta.");
    }
  }

  async function saveDisc(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/planning/disc", {
        ...discForm,
        dominance: Number(String(discForm.dominance || "0").replace(",", ".")),
        influence: Number(String(discForm.influence || "0").replace(",", ".")),
        stability: Number(String(discForm.stability || "0").replace(",", ".")),
        conformity: Number(String(discForm.conformity || "0").replace(",", ".")),
      });
      setDiscForm((p) => ({ ...p, respondent_name: "", notes: "" }));
      await loadAll();
      setMsg("Resultado DISC salvo.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar DISC.");
    }
  }

  async function saveCultural(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/planning/cultural-map", {
        ...culturalForm,
        culture_score: Number(String(culturalForm.culture_score || "0").replace(",", ".")),
        management_score: Number(String(culturalForm.management_score || "0").replace(",", ".")),
        team_score: Number(String(culturalForm.team_score || "0").replace(",", ".")),
      });
      setCulturalForm((p) => ({ ...p, leader_name: "", notes: "" }));
      await loadAll();
      setMsg("Mapa cultural salvo.");
    } catch (err) {
      setMsg(err?.message || "Falha ao salvar mapa cultural.");
    }
  }

  return (
    <div className="cras-stage-v2 faz-financeiro-v2">
      <CrasPageHeader
        eyebrow="PLANEJAMENTO"
        title="DISC, Mapa Cultural e Metas"
        subtitle="Acompanhamento trimestral e fechamento de safra."
      />

      <div className="faz-fin-kpis">
        <div className="kpi"><span>Metas</span><b>{goalSummary?.total || 0}</b></div>
        <div className="kpi"><span>Progresso médio</span><b>{pct(goalSummary?.avg_progress_pct || 0)}%</b></div>
        <div className="kpi"><span>DISC lançados</span><b>{disc.length}</b></div>
        <div className="kpi"><span>Mapas culturais</span><b>{cultural.length}</b></div>
      </div>

      {msg ? <div className="faz-fin-note">{msg}</div> : null}

      <div className="faz-fin-switches">
        <button type="button" className={`chip ${tab === "goals" ? "rec" : ""}`} onClick={() => setTab("goals")}>Metas</button>
        <button type="button" className={`chip ${tab === "disc" ? "rec" : ""}`} onClick={() => setTab("disc")}>DISC</button>
        <button type="button" className={`chip ${tab === "cultural" ? "rec" : ""}`} onClick={() => setTab("cultural")}>Mapa Cultural</button>
      </div>

      {tab === "goals" ? (
        <>
          <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveGoal}>
            <h4>Nova meta</h4>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" required placeholder="Título da meta" value={goalForm.title} onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))} />
              <input className="faz-input" placeholder="Safra" value={goalForm.season} onChange={(e) => setGoalForm((p) => ({ ...p, season: e.target.value }))} />
              <input className="faz-input" placeholder="Área" value={goalForm.area} onChange={(e) => setGoalForm((p) => ({ ...p, area: e.target.value }))} />
              <select className="faz-input" value={goalForm.period_type} onChange={(e) => setGoalForm((p) => ({ ...p, period_type: e.target.value }))}>
                <option value="trimestral">Trimestral</option>
                <option value="safra">Safra</option>
              </select>
            </div>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" inputMode="decimal" required placeholder="Valor alvo" value={goalForm.target_value} onChange={(e) => setGoalForm((p) => ({ ...p, target_value: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Valor atual" value={goalForm.current_value} onChange={(e) => setGoalForm((p) => ({ ...p, current_value: e.target.value }))} />
              <input className="faz-input" placeholder="Unidade" value={goalForm.unit} onChange={(e) => setGoalForm((p) => ({ ...p, unit: e.target.value }))} />
              <select className="faz-input" value={goalForm.status} onChange={(e) => setGoalForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
            <div className="faz-fin-filters">
              <input className="faz-input" placeholder="Observações" value={goalForm.notes} onChange={(e) => setGoalForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="faz-fin-switches">
              <button type="submit" className="btn-refresh">Salvar meta</button>
            </div>
          </form>

          <div className="faz-fin-tableWrap">
            <h4>Metas cadastradas</h4>
            <table className="faz-fin-table">
              <thead>
                <tr>
                  <th>Meta</th>
                  <th>Safra</th>
                  <th>Área</th>
                  <th>Progresso</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const target = Number(g.target_value || 0);
                  const current = Number(g.current_value || 0);
                  const p = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
                  return (
                    <tr key={g.id}>
                      <td>{g.title}</td>
                      <td>{g.season || "—"}</td>
                      <td>{g.area || "—"}</td>
                      <td>{pct(p)}%</td>
                      <td>{g.status}</td>
                      <td>
                        {g.status !== "concluida" ? (
                          <button className="faz-btn" type="button" onClick={() => updateGoalStatus(g, "concluida")}>Concluir</button>
                        ) : (
                          <button className="faz-btn" type="button" onClick={() => updateGoalStatus(g, "aberta")}>Reabrir</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!goals.length ? <tr><td colSpan={6}>Sem metas cadastradas.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "disc" ? (
        <>
          <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveDisc}>
            <h4>Novo resultado DISC</h4>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" required placeholder="Nome do respondente" value={discForm.respondent_name} onChange={(e) => setDiscForm((p) => ({ ...p, respondent_name: e.target.value }))} />
              <input className="faz-input" placeholder="Safra" value={discForm.season} onChange={(e) => setDiscForm((p) => ({ ...p, season: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Dominância" value={discForm.dominance} onChange={(e) => setDiscForm((p) => ({ ...p, dominance: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Influência" value={discForm.influence} onChange={(e) => setDiscForm((p) => ({ ...p, influence: e.target.value }))} />
            </div>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" inputMode="decimal" placeholder="Estabilidade" value={discForm.stability} onChange={(e) => setDiscForm((p) => ({ ...p, stability: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Conformidade" value={discForm.conformity} onChange={(e) => setDiscForm((p) => ({ ...p, conformity: e.target.value }))} />
              <input className="faz-input" placeholder="Observações" value={discForm.notes} onChange={(e) => setDiscForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="faz-fin-switches"><button type="submit" className="btn-refresh">Salvar DISC</button></div>
          </form>

          <div className="faz-fin-tableWrap">
            <table className="faz-fin-table">
              <thead>
                <tr>
                  <th>Respondente</th>
                  <th>Safra</th>
                  <th>D</th>
                  <th>I</th>
                  <th>S</th>
                  <th>C</th>
                </tr>
              </thead>
              <tbody>
                {disc.map((d) => (
                  <tr key={d.id}>
                    <td>{d.respondent_name}</td>
                    <td>{d.season || "—"}</td>
                    <td>{pct(d.dominance)}</td>
                    <td>{pct(d.influence)}</td>
                    <td>{pct(d.stability)}</td>
                    <td>{pct(d.conformity)}</td>
                  </tr>
                ))}
                {!disc.length ? <tr><td colSpan={6}>Sem resultados DISC.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "cultural" ? (
        <>
          <form className="faz-fin-tableWrap faz-fin-launch-card" onSubmit={saveCultural}>
            <h4>Novo mapa cultural</h4>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" required placeholder="Líder" value={culturalForm.leader_name} onChange={(e) => setCulturalForm((p) => ({ ...p, leader_name: e.target.value }))} />
              <input className="faz-input" placeholder="Safra" value={culturalForm.season} onChange={(e) => setCulturalForm((p) => ({ ...p, season: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Cultural" value={culturalForm.culture_score} onChange={(e) => setCulturalForm((p) => ({ ...p, culture_score: e.target.value }))} />
              <input className="faz-input" inputMode="decimal" placeholder="Gestão" value={culturalForm.management_score} onChange={(e) => setCulturalForm((p) => ({ ...p, management_score: e.target.value }))} />
            </div>
            <div className="faz-fin-filters faz-fin-filters-4">
              <input className="faz-input" inputMode="decimal" placeholder="Equipe" value={culturalForm.team_score} onChange={(e) => setCulturalForm((p) => ({ ...p, team_score: e.target.value }))} />
              <input className="faz-input" placeholder="Observações" value={culturalForm.notes} onChange={(e) => setCulturalForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="faz-fin-switches"><button type="submit" className="btn-refresh">Salvar mapa cultural</button></div>
          </form>

          <div className="faz-fin-tableWrap">
            <table className="faz-fin-table">
              <thead>
                <tr>
                  <th>Líder</th>
                  <th>Safra</th>
                  <th>Cultural</th>
                  <th>Gestão</th>
                  <th>Equipe</th>
                </tr>
              </thead>
              <tbody>
                {cultural.map((c) => (
                  <tr key={c.id}>
                    <td>{c.leader_name}</td>
                    <td>{c.season || "—"}</td>
                    <td>{pct(c.culture_score)}</td>
                    <td>{pct(c.management_score)}</td>
                    <td>{pct(c.team_score)}</td>
                  </tr>
                ))}
                {!cultural.length ? <tr><td colSpan={5}>Sem resultados de mapa cultural.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
