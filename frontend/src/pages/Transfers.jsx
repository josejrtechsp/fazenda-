import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/transfers.css";

const MODES = [
  { key: "lot_to_lot", label: "Lote → Lote" },
  { key: "lot_to_area", label: "Lote → Manga" },
  { key: "animal", label: "Animal (brinco)" },
];

function parseEarTags(text){
  const raw = (text || "").toString().trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,;\n\t ]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/[^0-9A-Za-z]/g, "").toUpperCase())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts){
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out;
}

function fmtInt(n){
  try { return Number(n).toLocaleString("pt-BR"); } catch { return String(n); }
}

function prettyWhen(iso){
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso || "";
  }
}

export default function Transfers({
  prefill = null,
  onPrefillConsumed = () => {},
  onGoWhatsApp = () => {},
}){
  const [mode, setMode] = useState("lot_to_lot");
  const [fromLot, setFromLot] = useState("lot_10");
  const [toLot, setToLot] = useState("lot_15");
  const [toArea, setToArea] = useState("area_30");
  const [qty, setQty] = useState(30);
  const [earTagsText, setEarTagsText] = useState("");
  const [notes, setNotes] = useState("");

  const lots = useMemo(() => ([
    { id: "lot_10", label: "Lote 10" },
    { id: "lot_15", label: "Lote 15" },
    { id: "lot_nov", label: "Novilhas" },
    { id: "lot_bez", label: "Bezerros" },
  ]), []);

  const areas = useMemo(() => ([
    { id: "area_30", label: "Manga 30" },
    { id: "area_12", label: "Manga 12" },
    { id: "area_7", label: "Manga 7" },
    { id: "area_4", label: "Manga 4" },
  ]), []);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const parsedEarTags = useMemo(() => parseEarTags(earTagsText), [earTagsText]);

  function lotLabel(id){
    return lots.find(l => l.id === id)?.label || id;
  }
  function areaLabel(id){
    return areas.find(a => a.id === id)?.label || id;
  }

  async function loadHistory(){
    setLoading(true);
    try {
      const res = await api.get("/events?type=transfer&limit=80");
      const rows = (res || []).map(ev => ({
        id: ev.id,
        when: prettyWhen(ev.occurred_at || ev.created_at),
        summary: ev.raw_text || "Transferência",
        status: ev.status,
      }));
      setHistory(rows);
    } catch {
      // mantém vazio
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  // Aplica prefill uma única vez (vindo de Mangas/Rebanho)
  useEffect(() => {
    if (!prefill) return;
    const nextMode = prefill.mode || mode;
    if (nextMode) setMode(nextMode);

    if (prefill.fromLot) setFromLot(prefill.fromLot);
    if (prefill.toLot) setToLot(prefill.toLot);
    if (typeof prefill.qty !== "undefined" && prefill.qty !== null) setQty(prefill.qty);
    if (prefill.toArea) setToArea(prefill.toArea);

    if (Array.isArray(prefill.earTags) && prefill.earTags.length) {
      setEarTagsText(prefill.earTags.join(" "));
    }
    if (typeof prefill.earTagsText === "string") {
      setEarTagsText(prefill.earTagsText);
    }
    if (typeof prefill.notes === "string") {
      setNotes(prefill.notes);
    }

    onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const modeHelp = useMemo(() => {
    if (mode === "lot_to_lot") {
      return {
        title: "Guia rápido",
        summary: "Movimente o gado entre lotes (inclusive parcial).",
        what: "Use quando você precisa separar uma parte do lote (ex.: 30 cabeças do Lote 10 para o Lote 15).",
        steps: [
          "Escolha lote de origem e destino.",
          "Informe a quantidade OU os brincos (se tiver).",
          "Se for só quantidade, fica como 'pendente de identificação'.",
        ],
        after: "Você pode completar os brincos depois.",
      };
    }
    if (mode === "lot_to_area") {
      return {
        title: "Guia rápido",
        summary: "Mude o lote de manga (rotação de pasto).",
        what: "Use quando o lote vai entrar em outra manga.",
        steps: ["Escolha o lote.", "Escolha a manga de destino.", "Registre observação (opcional)."],
        after: "Isso alimenta o mapa de pasto.",
      };
    }
    return {
      title: "Guia rápido",
      summary: "Mova 1+ animais por brinco (numérico ou alfanumérico).",
      what: "Use quando você precisa mover animais específicos (apartação fina, sanidade, descarte).",
      steps: ["Informe os brincos (ex.: 7812 A2391).", "Escolha o destino (lote ou manga).", "Registre."],
      after: "Movimentação rastreável.",
    };
  }, [mode]);

  const stats = useMemo(() => {
    const total = history.length;
    const pending = history.filter((h) => String(h.summary).toLowerCase().includes("pendente")).length;
    const lotMoves = history.filter((h) => String(h.summary).includes("→") || String(h.summary).includes("->")).length;
    return {
      total,
      pending,
      lotMoves,
      tagsNow: parsedEarTags.length,
    };
  }, [history, parsedEarTags.length]);

  async function submit(){
    const tags = parseEarTags(earTagsText);
    const qnum = Number(qty) || 0;

    if (mode === "lot_to_lot") {
      if (!fromLot || !toLot) return alert("Escolha lote de origem e destino.");
      if (fromLot === toLot) return alert("Origem e destino não podem ser iguais.");
      if (tags.length === 0 && qnum <= 0) return alert("Informe a quantidade ou os brincos.");

      const headCount = tags.length > 0 ? tags.length : qnum;
      const pending = tags.length === 0;
      const notePart = notes ? ` • ${notes}` : "";
      const raw_text = `Transferência — ${fmtInt(headCount)} cabeça(s) — ${lotLabel(fromLot)} → ${lotLabel(toLot)}${pending ? " (pendente de brincos)" : ""}${notePart}`;

      try {
        await api.post("/events", {
          source: "app",
          status: "approved",
          type: "transfer",
          raw_text,
          payload: {
            mode: "lot_to_lot",
            from_lot: fromLot,
            to_lot: toLot,
            head_count: headCount,
            ear_tags: tags,
            pending_identification: pending,
            notes: notes || null,
          }
        });
        setNotes("");
        setEarTagsText("");
        await loadHistory();
      } catch (e){
        alert(e?.message || "Falha ao registrar");
      }
      return;
    }

    if (mode === "lot_to_area") {
      if (!fromLot || !toArea) return alert("Escolha o lote e a manga de destino.");
      const notePart = notes ? ` • ${notes}` : "";
      const raw_text = `Mudança de rebanho — ${lotLabel(fromLot)} → ${areaLabel(toArea)}${notePart}`;
      try {
        await api.post("/events", {
          source: "app",
          status: "approved",
          type: "transfer",
          raw_text,
          payload: {
            mode: "lot_to_area",
            from_lot: fromLot,
            to_area: toArea,
            notes: notes || null,
          }
        });
        setNotes("");
        await loadHistory();
      } catch (e){
        alert(e?.message || "Falha ao registrar");
      }
      return;
    }

    // animal
    if (tags.length === 0) return alert("Informe ao menos 1 brinco.");
    const dest = toLot ? `→ ${lotLabel(toLot)}` : (toArea ? `→ ${areaLabel(toArea)}` : "");
    if (!dest) return alert("Escolha destino (lote ou manga). ");
    const notePart = notes ? ` • ${notes}` : "";
    const raw_text = `Movimentação individual — ${tags.join(", ")} ${dest}${notePart}`;

    try {
      await api.post("/events", {
        source: "app",
        status: "approved",
        type: "transfer",
        raw_text,
        payload: {
          mode: "animal",
          ear_tags: tags,
          to_lot: toLot || null,
          to_area: toArea || null,
          notes: notes || null,
        }
      });
      setEarTagsText("");
      setNotes("");
      await loadHistory();
    } catch (e){
      alert(e?.message || "Falha ao registrar");
    }
  }

  return (
    <div className="cras-stage-v2 transfers-page">
      <CrasPageHeader
        eyebrow="Operação"
        title="Transferências"
        subtitle="Lote ↔ lote • parcial • por brinco • lote ↔ manga. (Entrada via WhatsApp entra na fila de validações.)"
        help={modeHelp}
        actions={[{ key: "wpp", label: "Ver validações WhatsApp", tone: "primary" }, { key: "reload", label: loading ? "Atualizando…" : "Atualizar", tone: "soft" }]}
        onAction={(a) => {
          if (a?.key === "wpp") onGoWhatsApp();
          if (a?.key === "reload") loadHistory();
        }}
      />

      <div className="cras-stage-body">
        <div className="tp-shell tp-summaryShell">
          <div className="tp-summaryHead">
            <div>
              <div className="tp-eyebrow">Resumo do dia</div>
              <h3>Movimentações rápidas e rastreáveis</h3>
            </div>
            <button className="faz-btn" type="button" onClick={loadHistory}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
          <div className="tp-kpiGrid">
            <div className="tp-kpi">
              <div className="k">Movimentações</div>
              <div className="v">{stats.total}</div>
              <div className="s">Últimos registros</div>
            </div>
            <div className="tp-kpi">
              <div className="k">Pendentes</div>
              <div className="v">{stats.pending}</div>
              <div className="s">Sem identificação completa</div>
            </div>
            <div className="tp-kpi">
              <div className="k">Lote ↔ destino</div>
              <div className="v">{stats.lotMoves}</div>
              <div className="s">Com origem e destino</div>
            </div>
            <div className="tp-kpi">
              <div className="k">Brincos no campo</div>
              <div className="v">{stats.tagsNow}</div>
              <div className="s">Prontos para registrar</div>
            </div>
          </div>
        </div>

        <div className="tp-layout">
          <section className="card tp-shell tp-panel">
                <div className="tp-head">
                  <div>
                    <div className="tp-eyebrow">Nova movimentação</div>
                    <h3>Registro direto de curral</h3>
                    <div className="card-subtitle">Escolha o tipo, preencha e registre.</div>
                  </div>
                </div>

                <div className="tp-modeRow">
                  {MODES.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      className={mode === m.key ? "faz-chip on" : "faz-chip"}
                      onClick={() => setMode(m.key)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {mode === "lot_to_lot" ? (
                  <div className="faz-form-grid">
                    <div>
                      <label className="form-label">Origem (lote)</label>
                      <select className="input" value={fromLot} onChange={(e) => setFromLot(e.target.value)}>
                        {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Destino (lote)</label>
                      <select className="input" value={toLot} onChange={(e) => setToLot(e.target.value)}>
                        {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Quantidade (opcional se informar brincos)</label>
                      <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Brincos (opcional)</label>
                      <textarea className="input" rows={3} value={earTagsText} onChange={(e) => setEarTagsText(e.target.value)} placeholder="Ex.: 7812 A2391 A2392" />
                      <div className="texto-suave" style={{ marginTop: 6 }}>
                        Se informar só quantidade, fica <b>pendente de identificação</b>.
                      </div>
                    </div>
                  </div>
                ) : null}

                {mode === "lot_to_area" ? (
                  <div className="faz-form-grid">
                    <div>
                      <label className="form-label">Lote</label>
                      <select className="input" value={fromLot} onChange={(e) => setFromLot(e.target.value)}>
                        {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Manga de destino</label>
                      <select className="input" value={toArea} onChange={(e) => setToArea(e.target.value)}>
                        <option value="">—</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>
                ) : null}

                {mode === "animal" ? (
                  <div className="faz-form-grid">
                    <div>
                      <label className="form-label">Brincos (numérico ou alfanumérico)</label>
                      <textarea className="input" rows={3} value={earTagsText} onChange={(e) => setEarTagsText(e.target.value)} placeholder="Ex.: 7812 A2391 A2392" />
                      <div className="texto-suave" style={{ marginTop: 6 }}>
                        Aceita <b>7812</b> e <b>A2391</b> misturados.
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Destino (lote)</label>
                      <select className="input" value={toLot} onChange={(e) => setToLot(e.target.value)}>
                        <option value="">—</option>
                        {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Ou destino (manga)</label>
                      <select className="input" value={toArea} onChange={(e) => setToArea(e.target.value)}>
                        <option value="">—</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <label className="form-label">Observação (opcional)</label>
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: apartação, venda, sanidade, rotação…" />
                </div>

                <div className="card-footer-right tp-actions">
                  <button className="btn-secundario" type="button" onClick={() => { setEarTagsText(""); setNotes(""); }}>Limpar</button>
                  <button className="btn-primario" type="button" onClick={submit}>Registrar</button>
                </div>
          </section>

          <section className="card tp-shell tp-panel">
              <div className="card-header-row tp-head">
                <div>
                  <div className="tp-eyebrow">Histórico</div>
                  <h3>Últimas movimentações</h3>
                  <div className="card-subtitle">Carregado do backend (events type=transfer).</div>
                </div>
              </div>

              <div className="faz-history">
                {history.map(h => (
                  <div key={h.id} className={"faz-history-item" + (String(h.summary).includes("pendente") ? " is-pending" : "")}
                  >
                    <div className="when">{h.when}</div>
                    <div className="txt">{h.summary}</div>
                    {String(h.summary).includes("pendente") ? <div className="tag">Pendente de brincos</div> : null}
                  </div>
                ))}
                {!history.length ? (
                  <div className="faz-muted" style={{ marginTop: 8 }}>
                    Nenhuma transferência registrada.
                  </div>
                ) : null}
              </div>
          </section>

          <section className="card tp-shell tp-panel tp-dictionary">
            <div className="card-header-row tp-head">
              <div>
                <div className="tp-eyebrow">Atalhos de mensagem</div>
                <h3>Dicionário WhatsApp</h3>
                <div className="card-subtitle">Frases que o vaqueiro manda por áudio/texto para cair já pronto na validação.</div>
              </div>
            </div>

            <div className="faz-wpp-list">
              <div className="faz-wpp-item"><span className="chip">Transferência</span> “Passei 30 do l10 pro l15”</div>
              <div className="faz-wpp-item"><span className="chip">Lote → Manga</span> “l15 → m30”</div>
              <div className="faz-wpp-item"><span className="chip">Brinco</span> “A2391 pro lote 15”</div>
              <div className="faz-wpp-item"><span className="chip">Resumo</span> “R$/@ do mês”</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
