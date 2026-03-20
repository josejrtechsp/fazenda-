import React, { useEffect, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import FinanceiroCadastros from "./FinanceiroCadastros.jsx";
import "../styles/cadastros_gerais.css";

export default function CadastrosGeraisPage({ initialSection = "fazenda" }) {
  const [properties, setProperties] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState(initialSection === "financeiro" ? "financeiro" : "fazenda");

  const [propertyForm, setPropertyForm] = useState({
    name: "",
    city: "",
    state: "MG",
    total_area_ha: "",
    notes: "",
  });

  const [seasonForm, setSeasonForm] = useState({
    name: "",
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 1,
    is_active: true,
  });

  useEffect(() => {
    setSection(initialSection === "financeiro" ? "financeiro" : "fazenda");
  }, [initialSection]);

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const [p, s] = await Promise.all([
        api.get("/setup/properties?limit=500"),
        api.get("/setup/seasons?include_inactive=true&limit=500"),
      ]);
      setProperties(Array.isArray(p) ? p : []);
      setSeasons(Array.isArray(s) ? s : []);
    } catch (e) {
      setMsg(e?.message || "Falha ao carregar cadastros gerais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveProperty(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/setup/properties", {
        ...propertyForm,
        total_area_ha: Number(String(propertyForm.total_area_ha || "0").replace(",", ".")),
      });
      setPropertyForm({ name: "", city: "", state: "MG", total_area_ha: "", notes: "" });
      await loadAll();
      setMsg("Propriedade cadastrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao cadastrar propriedade.");
    }
  }

  async function saveSeason(e) {
    e?.preventDefault?.();
    setMsg("");
    try {
      await api.post("/setup/seasons", {
        ...seasonForm,
        start_year: Number(seasonForm.start_year),
        end_year: Number(seasonForm.end_year),
      });
      setSeasonForm((p) => ({ ...p, name: "" }));
      await loadAll();
      setMsg("Safra cadastrada.");
    } catch (err) {
      setMsg(err?.message || "Falha ao cadastrar safra.");
    }
  }

  async function toggleSeason(season) {
    setMsg("");
    try {
      await api.patch(`/setup/seasons/${season.id}`, { is_active: !season.is_active });
      await loadAll();
    } catch (err) {
      setMsg(err?.message || "Falha ao atualizar safra.");
    }
  }

  return (
    <div className="cras-stage-v2 cad-gerais-page">
      <CrasPageHeader
        eyebrow="CADASTROS GERAIS"
        title="Central de cadastros"
        subtitle="Tudo em um único lugar: fazenda, financeiro e pessoas."
      />

      <div className="cg-tabs" role="tablist" aria-label="Seções de cadastro">
        <button
          type="button"
          className={`cg-tab ${section === "fazenda" ? "active" : ""}`}
          onClick={() => setSection("fazenda")}
          role="tab"
          aria-selected={section === "fazenda"}
        >
          Fazenda
        </button>
        <button
          type="button"
          className={`cg-tab ${section === "financeiro" ? "active" : ""}`}
          onClick={() => setSection("financeiro")}
          role="tab"
          aria-selected={section === "financeiro"}
        >
          Pessoas e empresas
        </button>
      </div>

      {section === "fazenda" ? (
        <>
          <div className="cg-kpis">
            <div className="kpi"><span>Propriedades</span><b>{properties.length}</b></div>
            <div className="kpi"><span>Safras</span><b>{seasons.length}</b></div>
            <div className="kpi"><span>Safras ativas</span><b>{seasons.filter((s) => !!s.is_active).length}</b></div>
          </div>

          {msg ? <div className="cg-note">{msg}</div> : null}

          <div className="cg-grid">
            <form className="cg-card" onSubmit={saveProperty}>
              <h4>Nova propriedade</h4>
              <div className="cg-form-grid cg-form-grid-4">
                <input className="faz-input" required placeholder="Nome" value={propertyForm.name} onChange={(e) => setPropertyForm((p) => ({ ...p, name: e.target.value }))} />
                <input className="faz-input" placeholder="Cidade" value={propertyForm.city} onChange={(e) => setPropertyForm((p) => ({ ...p, city: e.target.value }))} />
                <input className="faz-input" maxLength={2} placeholder="UF" value={propertyForm.state} onChange={(e) => setPropertyForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))} />
                <input className="faz-input" inputMode="decimal" placeholder="Área total (ha)" value={propertyForm.total_area_ha} onChange={(e) => setPropertyForm((p) => ({ ...p, total_area_ha: e.target.value }))} />
              </div>
              <div className="cg-form-grid">
                <input className="faz-input" placeholder="Observações" value={propertyForm.notes} onChange={(e) => setPropertyForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="cg-actions"><button type="submit" className="btn-refresh">Salvar propriedade</button></div>
            </form>

            <form className="cg-card" onSubmit={saveSeason}>
              <h4>Nova safra</h4>
              <div className="cg-form-grid cg-form-grid-4">
                <input className="faz-input" required placeholder="Nome da safra (ex: 2025/2026)" value={seasonForm.name} onChange={(e) => setSeasonForm((p) => ({ ...p, name: e.target.value }))} />
                <input className="faz-input" inputMode="numeric" placeholder="Ano inicial" value={seasonForm.start_year} onChange={(e) => setSeasonForm((p) => ({ ...p, start_year: e.target.value }))} />
                <input className="faz-input" inputMode="numeric" placeholder="Ano final" value={seasonForm.end_year} onChange={(e) => setSeasonForm((p) => ({ ...p, end_year: e.target.value }))} />
                <select className="faz-input" value={seasonForm.is_active ? "true" : "false"} onChange={(e) => setSeasonForm((p) => ({ ...p, is_active: e.target.value === "true" }))}>
                  <option value="true">Ativa</option>
                  <option value="false">Inativa</option>
                </select>
              </div>
              <div className="cg-actions"><button type="submit" className="btn-refresh">Salvar safra</button></div>
            </form>
          </div>

          <div className="cg-tableWrap">
            <h4>Propriedades</h4>
            <table className="cg-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade/UF</th>
                  <th>Área (ha)</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{[p.city, p.state].filter(Boolean).join("/") || "—"}</td>
                    <td>{Number(p.total_area_ha || 0).toFixed(1)}</td>
                  </tr>
                ))}
                {!properties.length ? <tr><td colSpan={3}>{loading ? "Carregando..." : "Sem propriedades."}</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="cg-tableWrap">
            <h4>Safras</h4>
            <table className="cg-table">
              <thead>
                <tr>
                  <th>Safra</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.start_year} - {s.end_year}</td>
                    <td>{s.is_active ? "Ativa" : "Inativa"}</td>
                    <td><button type="button" className="faz-btn" onClick={() => toggleSeason(s)}>{s.is_active ? "Desativar" : "Ativar"}</button></td>
                  </tr>
                ))}
                {!seasons.length ? <tr><td colSpan={4}>{loading ? "Carregando..." : "Sem safras."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <FinanceiroCadastros embedded hideHeader accountsHiddenByDefault />
      )}
    </div>
  );
}
