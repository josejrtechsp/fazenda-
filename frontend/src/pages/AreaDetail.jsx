import React, { useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";

function pill(label, tone = "soft"){
  const cls = "faz-pill" + (tone ? ` ${tone}` : "");
  return <span className={cls}>{label}</span>;
}

function fmtInt(n){
  try { return Number(n).toLocaleString("pt-BR"); } catch { return String(n); }
}

function statusMeta(area){
  const st = area?.status;
  if (st === "occupied") return { label: "Ocupada", tone: "ok", hint: "Tem lote dentro." };
  if (st === "rest") return { label: "Descanso", tone: "warn", hint: "Em descanso." };
  return { label: "Vazia", tone: "soft", hint: "Sem lote." };
}

export default function AreaDetail({
  area,
  onBack = () => {},
  onTransfer = () => {},
}){
  const meta = useMemo(() => statusMeta(area), [area]);
  const [evalPasto, setEvalPasto] = useState("medio");
  const [occText, setOccText] = useState("");

  // mocks: depois liga no backend (eventos por manga)
  const timeline = useMemo(() => {
    const code = area?.code ?? "—";
    const lot = area?.lot ? `${area.lot}` : "(sem lote)";
    return [
      { id: "t1", when: "Hoje 10:12", title: "Mudança de rebanho", desc: `${lot} entrou na ${area?.name || "manga"}.` },
      { id: "t2", when: "Ontem 16:40", title: "Trato", desc: `Ração 1 saco • ${area?.name || "Manga"}.` },
      { id: "t3", when: "Ontem 09:10", title: "Avaliação de pasto", desc: `Pasto médio • descanso ideal ${area?.restIdeal ?? "—"} dias.` },
      { id: "t4", when: "Há 3 dias", title: "Ocorrência", desc: `Rebolinhos 18 (configurável) • Manga ${code}.` },
    ];
  }, [area]);

  const photos = useMemo(() => ([
    { id: "p1", label: "Foto 1" },
    { id: "p2", label: "Foto 2" },
    { id: "p3", label: "Foto 3" },
  ]), []);

  function doTransfer(){
    onTransfer({
      mode: "lot_to_area",
      fromLotLabel: area?.lot || null,
      fromAreaId: area?.id || null,
      fromAreaLabel: area?.name || null,
      notes: `Origem: ${area?.name || "Manga"}`,
    });
  }

  function addOccurrence(){
    const t = (occText || "").trim();
    if (!t) return alert("Escreva a ocorrência.");
    alert(`V3 (mock): ocorrência registrada em ${area?.name}: ${t}`);
    setOccText("");
  }

  const subtitle = useMemo(() => {
    if (!area) return "";
    if (area.status === "occupied"){
      return `${area.lot || "Lote"} • ${fmtInt(area.heads || 0)} cabeças • Ocupação: ${area.daysOcc || 0} dias`;
    }
    return `Descanso: ${area.daysRest || 0} dias (ideal ${area.restIdeal || "—"})`;
  }, [area]);

  return (
    <div className="cras-stage-v2">
      <CrasPageHeader
        eyebrow="Operação"
        title={area?.name || "Manga"}
        subtitle={subtitle}
        actions={[
          { key: "back", label: "Voltar", tone: "soft" },
          { key: "transfer", label: "Transferir", tone: "primary" },
        ]}
        onAction={(k) => {
          if (k === "back") return onBack();
          if (k === "transfer") return doTransfer();
        }}
      />

      <div className="cras-stage-body">
        <div className="cras-enc-split" data-enc-view="todos">
          <div className="cras-enc-left">
            <div className="cras-enc-left-stack">
              <div className="card">
                <div className="card-header-row">
                  <div>
                    <div style={{ fontWeight: 900 }}>Status</div>
                    <div className="card-subtitle">Resumo para decisão rápida.</div>
                  </div>
                </div>

                <div className="faz-detail-status">
                  {pill(meta.label, meta.tone)}
                  <span className="faz-muted" style={{ fontWeight: 800 }}>{meta.hint}</span>
                </div>

                <div className="faz-detail-grid">
                  <div className="faz-mini">
                    <div className="k">Manga</div>
                    <div className="v">#{area?.code ?? "—"}</div>
                  </div>
                  <div className="faz-mini">
                    <div className="k">Lote</div>
                    <div className="v">{area?.lot || "—"}</div>
                  </div>
                  <div className="faz-mini">
                    <div className="k">Cabeças</div>
                    <div className="v">{fmtInt(area?.heads || 0)}</div>
                  </div>
                  <div className="faz-mini">
                    <div className="k">Ocupação</div>
                    <div className="v">{fmtInt(area?.daysOcc || 0)} d</div>
                  </div>
                  <div className="faz-mini">
                    <div className="k">Descanso</div>
                    <div className="v">{fmtInt(area?.daysRest || 0)} d</div>
                  </div>
                  <div className="faz-mini">
                    <div className="k">Ideal</div>
                    <div className="v">{fmtInt(area?.restIdeal || 0)} d</div>
                  </div>
                </div>

                <div className="faz-actions-row">
                  <button className="faz-btn primary" type="button" onClick={doTransfer}>Transferir</button>
                  <button className="faz-btn" type="button" onClick={() => alert("V4: registrar trato (ração/sal) já com custo por @.")}>Registrar trato</button>
                  <button className="faz-btn" type="button" onClick={() => alert("V4: abrir checklist de manejo da manga.")}>Checklist</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header-row">
                  <div>
                    <div style={{ fontWeight: 900 }}>Avaliação do pasto</div>
                    <div className="card-subtitle">1 clique (baixo/médio/alto) + foto (em seguida).</div>
                  </div>
                </div>

                <div className="faz-seg" style={{ marginTop: 10 }}>
                  <button className={evalPasto === "baixo" ? "btn-primario" : "btn-secundario"} type="button" onClick={() => setEvalPasto("baixo")}>Baixo</button>
                  <button className={evalPasto === "medio" ? "btn-primario" : "btn-secundario"} type="button" onClick={() => setEvalPasto("medio")}>Médio</button>
                  <button className={evalPasto === "alto" ? "btn-primario" : "btn-secundario"} type="button" onClick={() => setEvalPasto("alto")}>Alto</button>
                </div>

                <div className="texto-suave" style={{ marginTop: 10 }}>
                  Selecionado: <b>{evalPasto}</b>. (V4: anexar foto e salvar no histórico.)
                </div>
              </div>

              <div className="card">
                <div className="card-header-row">
                  <div>
                    <div style={{ fontWeight: 900 }}>Ocorrência</div>
                    <div className="card-subtitle">Texto simples. Pode virar alerta e entrar no WhatsApp.</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="form-label">O que aconteceu?</label>
                  <input className="input" value={occText} onChange={(e) => setOccText(e.target.value)} placeholder="Ex.: cerca caiu; bebedouro sem água; rebolinhos 18…" />
                </div>

                <div className="card-footer-right">
                  <button className="btn-secundario" type="button" onClick={() => setOccText("")}>Limpar</button>
                  <button className="btn-primario" type="button" onClick={addOccurrence}>Registrar</button>
                </div>
              </div>
            </div>
          </div>

          <div className="cras-enc-right">
            <div className="card">
              <div className="card-header-row">
                <div>
                  <div style={{ fontWeight: 900 }}>Histórico (mock)</div>
                  <div className="card-subtitle">Eventos da manga: entradas/saídas, trato, avaliações, ocorrências.</div>
                </div>
              </div>

              <div className="faz-timeline">
                {timeline.map((t) => (
                  <div key={t.id} className="faz-timeline-item">
                    <div className="when">{t.when}</div>
                    <div className="title">{t.title}</div>
                    <div className="desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header-row">
                <div>
                  <div style={{ fontWeight: 900 }}>Fotos</div>
                  <div className="card-subtitle">V4: anexar pelo WhatsApp ou pelo app.</div>
                </div>
              </div>

              <div className="faz-photos">
                {photos.map((p) => (
                  <div key={p.id} className="faz-photo">{p.label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
