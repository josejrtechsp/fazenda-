import React, { useEffect, useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";

const TABS = [
  { key: "pending", label: "Pendentes" },
  { key: "ambiguous", label: "Ambíguos" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Rejeitados" },
  { key: "all", label: "Todos" },
];

const COST_GROUPS = [
  "Pasto",
  "Nutrição",
  "Sanidade/Reprodução",
  "Operação",
  "Máquinas/Infra/Outros",
];

const UNITS = ["saco", "kg", "g", "l", "@", "cabeca"];

const TEMPLATES_FALLBACK = {
  version: "v1",
  title: "Mensagens prontas do vaqueiro",
  quick_rules: [
    "Sempre informar manga/lote com número (ex: manga 10, lote 2).",
    "Para nutrição: quantidade + unidade + local.",
    "Para transferência: origem e destino.",
    "Uma ação por mensagem.",
  ],
  categories: [
    {
      key: "transfer",
      title: "Transferência de gado",
      examples: [
        "coloquei o lote 2 na manga 5",
        "mudei 30 cabeças do lote 10 para o lote 15",
      ],
    },
    {
      key: "nutrition",
      title: "Nutrição e trato",
      examples: [
        "coloquei 2 sacos de ração na manga 10",
        "dei meio saco de sal mineral na manga 12",
      ],
    },
  ],
};

function Pill({ children, tone = "default" }) {
  const style = {
    marginRight: 8,
    marginBottom: 6,
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(226,232,240,.95)",
    background: "rgba(248,250,252,.8)",
    color: "rgba(15,23,42,1)",
  };

  if (tone === "warn") {
    style.border = "1px solid rgba(251,146,60,.45)";
    style.background = "rgba(255,247,237,.9)";
    style.color = "rgba(124,45,18,1)";
  }
  if (tone === "ok") {
    style.border = "1px solid rgba(34,197,94,.35)";
    style.background = "rgba(240,253,244,.95)";
    style.color = "rgba(20,83,45,1)";
  }

  return <span style={style}>{children}</span>;
}

function Card({ children }) {
  return (
    <div className="card" style={{ borderRadius: 18, padding: 14, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function prettyWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso || "";
  }
}

function summarizeEvent(ev) {
  const type = ev.type || "evento";
  const rt = (ev.raw_text || "").trim();
  if (rt) return rt;

  // fallback: compact payload
  try {
    const p = ev.payload || {};
    if (type === "whatsapp_raw") return "WhatsApp (raw) — sem texto/transcrição";
    if (type === "transfer") return "Transferência";
    if (type === "cost") return `Custo (${p.group || "—"})`;
    if (type === "exit") return "Saída (venda/abate)";
    if (type === "occurrence") return "Ocorrência";
    return type;
  } catch {
    return type;
  }
}

function toNumber(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
}

function sanitizePhone(v) {
  return String(v || "").replace(/\D+/g, "").trim();
}

function parseEarTagsText(text) {
  const raw = String(text || "")
    .replace(/[;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];
  const parts = raw.split(" ");
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const cleaned = p.replace(/[^A-Za-z0-9\-]/g, "").trim();
    if (!cleaned) continue;
    const up = cleaned.toUpperCase();
    if (seen.has(up)) continue;
    seen.add(up);
    out.push(up);
    if (out.length >= 200) break;
  }
  return out;
}


function InputRow({ label, help, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center", padding: "8px 0" }}>
      <div>
        <div style={{ fontWeight: 950, color: "rgba(15,23,42,1)" }}>{label}</div>
        {help ? <div className="faz-muted" style={{ fontSize: 12, marginTop: 2 }}>{help}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,.55)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "36px 18px",
        overflow: "auto",
      }}
      onMouseDown={(e) => {
        // click fora fecha
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="card"
        style={{
          width: "min(920px, 100%)",
          borderRadius: 18,
          padding: 16,
          boxShadow: "0 30px 120px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18, color: "rgba(15,23,42,1)" }}>{title}</div>
            {subtitle ? <div className="faz-muted" style={{ marginTop: 4 }}>{subtitle}</div> : null}
          </div>
          <button className="faz-btn" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function buildDraftFromEvent(ev) {
  const p = ev?.payload || {};
  const nlp = p?.nlp || {};
  const fields = nlp?.fields || {};

  const type = ev?.type || (nlp?.intent && nlp.intent !== "unknown" ? nlp.intent : "whatsapp_raw");

  const draft = {
    type,
    status: ev?.status || "pending",

    // comum
    occurred_at: ev?.occurred_at || ev?.created_at || "",
    raw_text: ev?.raw_text || "",

    // cost
    group: p.group ?? fields.group ?? "Nutrição",
    value_brl: p.value_brl ?? fields.value_brl ?? "",
    qty: p.qty ?? fields.qty ?? "",
    unit: p.unit ?? fields.unit ?? "saco",
    unit_price_brl: p.unit_price_brl ?? fields.unit_price_brl ?? "",
    area_id: p.area_id ?? fields.area_id ?? "",
    lot_id: p.lot_id ?? fields.lot_id ?? "",
    item: p.item ?? fields.item ?? "nutricao",
    // transfer
    transfer_mode: p.transfer_mode ?? fields.transfer_mode ?? ((p.ear_tags || fields.ear_tags) ? "ear_tags" : "heads"),
    qty_heads: p.qty_heads ?? fields.qty_heads ?? "",
    ear_tags_text: Array.isArray(p.ear_tags || fields.ear_tags) ? (p.ear_tags || fields.ear_tags).join("\n") : ((p.ear_tags || fields.ear_tags) ? String(p.ear_tags || fields.ear_tags) : ""),
    origin_lot_id: p.origin?.lot_id ?? fields.origin?.lot_id ?? "",
    origin_area_id: p.origin?.area_id ?? fields.origin?.area_id ?? "",
    dest_lot_id: p.destination?.lot_id ?? fields.destination?.lot_id ?? "",
    dest_area_id: p.destination?.area_id ?? fields.destination?.area_id ?? "",

    // exit
    arrobas: p.arrobas ?? fields.arrobas ?? "",
    exit_value_brl: p.value_brl ?? fields.value_brl ?? "",

    // occurrence
    kind: p.kind ?? fields.kind ?? "rebolinho",
    occ_qty: p.qty ?? fields.qty ?? "",
  };

  return draft;
}

function questionsFromMissing(rawEvent) {
  const p = rawEvent?.payload || {};
  const nlp = p?.nlp || {};
  const missing = Array.isArray(nlp?.missing_fields) ? nlp.missing_fields : [];
  const amb = Array.isArray(nlp?.ambiguities) ? nlp.ambiguities : [];
  const intent = nlp?.intent || rawEvent?.type || "unknown";

  const qs = [];

  // ambiguidades
  for (const a of amb) {
    if (a === "transfer_missing_origin_or_destination") {
      qs.push("De onde e para onde foi a transferência? (ex: do lote 10 para o lote 15)");
    } else {
      qs.push(`Preciso confirmar: ${a}`);
    }
  }

  // faltantes
  for (const m of missing) {
    if (m === "qty") qs.push("Qual foi a quantidade?");
    if (m === "unit") qs.push("Qual unidade? (saco, kg, etc.)");
    if (m === "area_or_lot") qs.push("Em qual manga ou lote foi?");
    if (m === "value_brl") qs.push("Qual foi o valor (R$)?");
    if (m === "arrobas") qs.push("Quantas arrobas (@) foram vendidas/abatidas?");
    if (m === "transfer_missing_origin_or_destination") qs.push("De onde e para onde foi?");
    if (m === "transcript_or_text") qs.push("Pode mandar o texto do áudio (ou escrever de novo em uma frase)?");
  }

  // refinamento por intent
  if (intent === "cost" && missing.includes("value_brl")) {
    qs.push("Esse valor é o total ou foi por unidade (por saco/kg)?");
  }
  if (intent === "transfer" && !missing.includes("qty_heads")) {
    qs.push("Quantas cabeças foram transferidas? (se não souber, pode mandar 'sem contagem')"); // opcional
  }

  // remove duplicadas
  const uniq = [];
  const seen = new Set();
  for (const q of qs) {
    const key = q.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(q);
  }
  return uniq.slice(0, 5);
}

export default function WhatsAppValidations({ onGoHerd } = {}) {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [waStatus, setWaStatus] = useState(null);
  const [waStatusErr, setWaStatusErr] = useState(null);
  const [sendingById, setSendingById] = useState({});

  const [resolveOpen, setResolveOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesErr, setTemplatesErr] = useState(null);
  const [templatesData, setTemplatesData] = useState(null);

  async function loadWaStatus() {
    try {
      const res = await api.get("/whatsapp/status");
      setWaStatus(res || null);
      setWaStatusErr(null);
    } catch (e) {
      // Compatibilidade com versões antigas do backend sem /whatsapp/status.
      if (e?.status === 404) {
        setWaStatus(null);
        setWaStatusErr(null);
        return;
      }
      setWaStatus(null);
      setWaStatusErr(e?.message || "Falha ao verificar integração WhatsApp.");
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get("/events?limit=400");
      // Normaliza
      const norm = (res || []).map((ev) => {
        const p = ev.payload || {};
        const nlp = p?.nlp || {};
        const meta = p?.meta || {};
        const ambiguities = nlp?.ambiguities || [];
        const missing = nlp?.missing_fields || [];
        const isAmb = Array.isArray(ambiguities) && ambiguities.length > 0;
        const isMissing = Array.isArray(missing) && missing.length > 0;
        const autoApproved = !!meta?.auto_approved;
        const autoApplied = !!meta?.auto_applied;
        const audioTranscribed = !!meta?.audio_transcribed;
        const transcriptProvider = String(meta?.transcript_provider || "").trim() || null;
        const contactPhone = String(meta?.contact_phone || "").trim();
        const canTranscribe = ev?.source === "whatsapp"
          && ev?.type === "whatsapp_raw"
          && String(meta?.media_type || "").toLowerCase() === "audio"
          && !!meta?.media_id;
        const transcriptionError = meta?.transcription_error || null;

        return {
          id: ev.id,
          status: isAmb || isMissing ? "ambiguous" : ev.status || "pending",
          mode: ev.source === "whatsapp" ? "WhatsApp" : "App",
          who: p?.meta?.contact_name || (ev.source === "whatsapp" ? "WhatsApp" : "Operador"),
          when: prettyWhen(ev.occurred_at || ev.created_at),
          contactPhone,
          transcript: ev.raw_text || (typeof p === "object" ? JSON.stringify(p).slice(0, 160) : String(p || "")),
          interpreted: summarizeEvent(ev),
          tags: [
            `Tipo: ${ev.type}`,
            `Status: ${ev.status}`,
            ev.source === "whatsapp" ? "Origem: WhatsApp" : "Origem: App",
            ...(autoApproved ? ["Auto: aprovado"] : []),
            ...(autoApplied ? ["Auto: aplicado"] : []),
            ...(audioTranscribed ? ["Áudio: transcrito"] : []),
            ...(audioTranscribed && transcriptProvider ? [`Transcrição: ${transcriptProvider}`] : []),
            ...(!audioTranscribed && canTranscribe ? ["Áudio: pendente"] : []),
          ],
          raw: ev,
          ambiguities,
          missing,
          autoApproved,
          autoApplied,
          canTranscribe,
          transcriptionError,
        };
      });
      setItems(norm);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar eventos");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadWaStatus();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "pending") return items.filter((i) => i.raw?.status === "pending" && i.raw?.source === "whatsapp" && i.status !== "ambiguous");
    if (tab === "ambiguous") return items.filter((i) => i.status === "ambiguous");
    if (tab === "approved") return items.filter((i) => i.raw?.status === "approved");
    if (tab === "rejected") return items.filter((i) => i.raw?.status === "rejected");
    return items;
  }, [tab, items]);

  async function setStatus(eventId, status) {
    try {
      const updated = await api.patch(`/events/${eventId}`, { status });

      // Se for transferência aprovada, o backend aplica no rebanho automaticamente.
      if (status === "approved" && updated?.type === "transfer") {
        const p = updated?.payload || {};
        const mode = p.transfer_mode ?? p?.nlp?.fields?.transfer_mode ?? ((p.ear_tags || p?.nlp?.fields?.ear_tags) ? "ear_tags" : "heads");
        const originLot = p.origin?.lot_id ?? p?.nlp?.fields?.origin?.lot_id;
        const destLot = p.destination?.lot_id ?? p?.nlp?.fields?.destination?.lot_id;
        const earTags = Array.isArray(p.ear_tags) ? p.ear_tags : (Array.isArray(p?.nlp?.fields?.ear_tags) ? p?.nlp?.fields?.ear_tags : []);
        const qty = p.qty_heads ?? p?.nlp?.fields?.qty_heads;

        const detail = mode === "ear_tags"
          ? `Brincos/IDs: ${earTags.slice(0, 8).join(", ")}${earTags.length > 8 ? " …" : ""}`
          : `Cabeças: ${qty ?? "—"}`;

        const msg = `Transferência aprovada e aplicada no rebanho.
${detail}
Lote ${originLot ?? "—"} → Lote ${destLot ?? "—"}`;

        if (typeof onGoHerd === "function") {
          if (confirm(`${msg}

Abrir Rebanho agora?`)) onGoHerd();
        } else {
          alert(msg);
        }
      }

      await load();
    } catch (e) {
      alert(e?.message || "Falha ao atualizar status");
    }
  }

  async function simulate() {
    const text = prompt(
      "Simular mensagem do WhatsApp (texto):\n\nExemplos:\n- hoje eu dei 1 saco de ração na manga 30 R$ 120,00\n- mudei 30 cabeças do lote 10 para o lote 15\n- peguei 18 rebolinhos\n",
      "hoje eu dei 1 saco de ração na manga 30 R$ 120,00"
    );
    if (!text) return;

    try {
      await api.post("/whatsapp/ingest", { text, contact_name: "Vaqueiro" });
      setTab("pending");
      await load();
    } catch (e) {
      alert(e?.message || "Falha ao simular");
    }
  }

  async function transcribeAudio(it) {
    const ev = it?.raw;
    const id = ev?.id;
    if (!id) return;
    try {
      await api.post(`/whatsapp/transcribe/${id}`, {});
      await load();
      alert("Áudio transcrito e evento atualizado.");
    } catch (e) {
      const fallback = prompt(
        "Falhou a transcrição automática. Cole o texto do áudio para processar manualmente:",
        ""
      );
      if (!fallback || !String(fallback).trim()) {
        alert(e?.message || "Falha ao transcrever áudio");
        return;
      }
      try {
        await api.post(`/whatsapp/transcribe/${id}`, { text: String(fallback).trim() });
        await load();
        alert("Transcrição manual aplicada e evento atualizado.");
      } catch (e2) {
        alert(e2?.message || "Falha ao aplicar transcrição manual");
      }
    }
  }

  function formatTemplatesText(data) {
    const d = data || TEMPLATES_FALLBACK;
    const out = [];
    out.push((d.title || "Mensagens prontas do vaqueiro").trim());
    out.push("");
    const rules = Array.isArray(d.quick_rules) ? d.quick_rules : [];
    if (rules.length) {
      out.push("Regras rápidas:");
      for (const r of rules) out.push(`- ${r}`);
      out.push("");
    }
    const cats = Array.isArray(d.categories) ? d.categories : [];
    for (const c of cats) {
      out.push(`${c.title}:`);
      const ex = Array.isArray(c.examples) ? c.examples : [];
      for (const x of ex) out.push(`- ${x}`);
      out.push("");
    }
    return out.join("\n").trim();
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      alert("Texto copiado.");
    } catch {
      prompt("Copie o texto:", value);
    }
  }

  async function openTemplates() {
    setTemplatesOpen(true);
    if (templatesData || templatesLoading) return;
    setTemplatesLoading(true);
    setTemplatesErr(null);
    try {
      const res = await api.get("/whatsapp/templates");
      setTemplatesData(res || TEMPLATES_FALLBACK);
    } catch (e) {
      setTemplatesData(TEMPLATES_FALLBACK);
      setTemplatesErr(e?.message || "Falha ao carregar modelos do servidor.");
    } finally {
      setTemplatesLoading(false);
    }
  }

  function openResolve(it) {
    setActive(it);
    setDraft(buildDraftFromEvent(it?.raw));
    setResolveOpen(true);
  }

  async function saveDraft({ approve = false } = {}) {
    if (!active?.raw?.id) return;
    const ev = active.raw;
    const oldPayload = ev.payload || {};
    const type = draft?.type || ev.type || "whatsapp_raw";

    const nextPayload = { ...(typeof oldPayload === "object" && oldPayload ? oldPayload : {}) };

    // sempre preserva nlp/meta/raw
    // aplica campos conforme tipo escolhido
    if (type === "cost") {
      nextPayload.group = String(draft.group || "Nutrição");
      nextPayload.value_brl = toNumber(draft.value_brl);
      nextPayload.qty = toNumber(draft.qty);
      nextPayload.unit = String(draft.unit || "").trim() || null;
      nextPayload.unit_price_brl = toNumber(draft.unit_price_brl);
      nextPayload.area_id = toInt(draft.area_id);
      nextPayload.lot_id = toInt(draft.lot_id);
      nextPayload.item = String(draft.item || "nutricao");
    } else if (type === "transfer") {
      const mode = String(draft.transfer_mode || "heads");
      const earTags = parseEarTagsText(draft.ear_tags_text);

      nextPayload.transfer_mode = mode;
      if (mode === "ear_tags") {
        nextPayload.ear_tags = earTags;
        // se não informou cabeças, usa contagem dos brincos
        nextPayload.qty_heads = toInt(draft.qty_heads) ?? (earTags.length ? earTags.length : null);
      } else {
        nextPayload.qty_heads = toInt(draft.qty_heads);
        nextPayload.ear_tags = null;
      }

      nextPayload.origin = {
        lot_id: toInt(draft.origin_lot_id),
        area_id: toInt(draft.origin_area_id),
      };
      nextPayload.destination = {
        lot_id: toInt(draft.dest_lot_id),
        area_id: toInt(draft.dest_area_id),
      };
    } else if (type === "exit") {
      nextPayload.arrobas = toNumber(draft.arrobas);
      nextPayload.value_brl = toNumber(draft.exit_value_brl);
    } else if (type === "occurrence") {
      nextPayload.kind = String(draft.kind || "ocorrencia");
      nextPayload.qty = toNumber(draft.occ_qty);
    } else {
      // whatsapp_raw: mantém payload
    }

    const patch = {
      type,
      payload: nextPayload,
      ...(approve ? { status: "approved" } : {}),
    };

    try {
      await api.patch(`/events/${ev.id}`, patch);
      setResolveOpen(false);
      setActive(null);
      setDraft(null);
      await load();
    } catch (e) {
      alert(e?.message || "Falha ao salvar");
    }
  }

  async function copyQuestions(it) {
    const ev = it?.raw;
    const id = ev?.id || it?.id;
    if (!id) return;

    // 1) tenta backend (mensagem recomendada)
    try {
      const resp = await api.get(`/whatsapp/questions/${id}`);
      const msg = String(resp?.recommended_message || "").trim();
      if (msg) {
        try {
          await navigator.clipboard?.writeText(msg);
          alert("Mensagem copiada. Cole no WhatsApp e envie para o vaqueiro.");
        } catch {
          prompt("Copie e envie no WhatsApp:", msg);
        }
        return;
      }
    } catch {
      // ignora e cai no fallback
    }

    // 2) fallback local (se o endpoint não existir)
    const qs = questionsFromMissing(ev);
    if (!qs.length) {
      alert("Este item não tem pendências (faltando/ambíguo) para perguntar.");
      return;
    }

    const msg = `Oi! Só para confirmar:
- ${qs.join("\n- ")}

Responda aqui mesmo.`;
    try {
      await navigator.clipboard?.writeText(msg);
      alert("Mensagem copiada. Cole no WhatsApp e envie para o vaqueiro.");
    } catch {
      prompt("Copie e envie no WhatsApp:", msg);
    }
  }

  async function getRecommendedMessage(id, rawEvent) {
    try {
      const resp = await api.get(`/whatsapp/questions/${id}`);
      const msg = String(resp?.recommended_message || "").trim();
      if (msg) return msg;
    } catch {
      // segue fallback local
    }

    const qs = questionsFromMissing(rawEvent);
    if (!qs.length) return "";
    return `Oi! Só para confirmar:\n- ${qs.join("\n- ")}\n\nResponda aqui mesmo.`;
  }

  function promptPhoneForSend(defaultPhone = "") {
    const preset = sanitizePhone(defaultPhone);
    const input = prompt(
      "Informe o número WhatsApp (com DDI + DDD). Ex: 5531999998888",
      preset || "55"
    );
    const to = sanitizePhone(input || "");
    if (!to) return null;
    if (to.length < 12) {
      alert("Número inválido. Use DDI + DDD + número (ex: 5531999998888).");
      return null;
    }
    return to;
  }

  async function askOnWhatsApp(it) {
    const id = it?.raw?.id || it?.id;
    if (!id) return;

    const hasSend = !!waStatus?.send_enabled;
    if (!hasSend) {
      await copyQuestions(it);
      return;
    }

    setSendingById((prev) => ({ ...prev, [id]: true }));
    try {
      const msg = await getRecommendedMessage(id, it?.raw);
      if (!msg) {
        alert("Esse item não tem pendências para perguntar.");
        return;
      }

      const eventPhone = sanitizePhone(it?.contactPhone);
      if (eventPhone) {
        await api.post(`/whatsapp/send-for-event/${id}`, { message: msg });
        alert(`Pergunta enviada para ${eventPhone}.`);
        return;
      }

      const to = promptPhoneForSend("");
      if (!to) return;
      await api.post("/whatsapp/send", { to, message: msg });
      alert(`Pergunta enviada para ${to}.`);
    } catch (e) {
      const msg = String(e?.message || "").trim();
      if (msg) {
        alert(`Falha ao enviar. ${msg}\n\nVou abrir a versão de copiar e colar.`);
      }
      await copyQuestions(it);
    } finally {
      setSendingById((prev) => {
        const next = { ...(prev || {}) };
        delete next[id];
        return next;
      });
    }
  }

  return (
    <div className="cras-stage-v2">
      <CrasPageHeader
        eyebrow="WhatsApp"
        title="Validações"
        subtitle="Entrada por áudio/texto — aprovar, ajustar ou resolver ambiguidades."
        subtabs={TABS}
        activeSubtabKey={tab}
        onSubtab={(k) => setTab(k)}
        actions={[
          { key: "templates", label: "Modelos vaqueiro", variant: "ghost" },
          { key: "simulate", label: "Simular mensagem", variant: "ghost" },
          { key: "sync", label: loading ? "Sincronizando…" : "Atualizar", variant: "primary" },
        ]}
        onAction={(a) => {
          if (a?.key === "templates") return openTemplates();
          if (a?.key === "simulate") return simulate();
          if (a?.key === "sync") {
            load();
            loadWaStatus();
            return;
          }
          return load();
        }}
      />

      <div className="cras-stage-body">
        <div
          className="faz-panel"
          style={{
            marginBottom: 10,
            borderColor: waStatus?.send_enabled ? "rgba(34,197,94,.35)" : "rgba(226,232,240,.92)",
            background: waStatus?.send_enabled ? "rgba(240,253,244,.75)" : "rgba(248,250,252,.72)",
          }}
        >
          <h3 style={{ marginBottom: 6 }}>Status da integração WhatsApp</h3>
          <div className="faz-muted">
            {waStatus?.send_enabled
              ? "Envio automático ativo. O botão de pergunta envia direto para o contato do evento."
              : "Envio automático não configurado. O botão de pergunta vai copiar a mensagem para colar no WhatsApp."}
          </div>
          {waStatusErr ? <div className="faz-muted" style={{ marginTop: 6 }}>Observação: {waStatusErr}</div> : null}
        </div>

        {err ? (
          <div className="faz-panel" style={{ borderColor: "rgba(185,28,28,.35)" }}>
            <h3>API indisponível</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              {err}
            </div>
          </div>
        ) : null}

        {filtered.map((it) => (
          <Card key={it.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, color: "rgba(15,23,42,1)" }}>
                {it.who} <span style={{ color: "rgba(100,116,139,1)", fontWeight: 800 }}>• {it.mode}</span>
              </div>
              <div style={{ color: "rgba(100,116,139,1)", fontWeight: 800 }}>{it.when}</div>
            </div>

            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap" }}>
              {it.tags.map((t, idx) => (
                <Pill key={idx}>{t}</Pill>
              ))}
              {(it.missing || []).length ? <Pill tone="warn">Faltando: {(it.missing || []).join(", ")}</Pill> : null}
              {(it.ambiguities || []).length ? <Pill tone="warn">Ambíguo</Pill> : null}
              {it.raw?.type === "transfer" && it.raw?.status === "approved" ? <Pill tone="ok">Rebanho atualizado</Pill> : null}
            </div>

            <div style={{ marginTop: 12, color: "rgba(100,116,139,1)", fontWeight: 900, fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase" }}>
              Conteúdo
            </div>
            <div style={{ marginTop: 6, fontWeight: 800, color: "rgba(15,23,42,1)", whiteSpace: "pre-wrap" }}>{it.transcript}</div>

            <div style={{ marginTop: 12, color: "rgba(100,116,139,1)", fontWeight: 900, fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase" }}>
              Resumo
            </div>
            <div style={{ marginTop: 6, fontWeight: 900, color: "rgba(15,23,42,1)" }}>{it.interpreted}</div>

{it.raw?.type === "transfer" ? (
  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <div style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(226,232,240,.92)", background: "rgba(248,250,252,.65)" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".12em" }}>
        Origem → Destino
      </div>
      <div style={{ marginTop: 6, fontWeight: 950, color: "rgba(15,23,42,1)" }}>
        Lote {it.raw?.payload?.origin?.lot_id ?? it.raw?.payload?.nlp?.fields?.origin?.lot_id ?? "—"} → Lote {it.raw?.payload?.destination?.lot_id ?? it.raw?.payload?.nlp?.fields?.destination?.lot_id ?? "—"}
      </div>
    </div>

    <div style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(226,232,240,.92)", background: "rgba(248,250,252,.65)" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(100,116,139,1)", textTransform: "uppercase", letterSpacing: ".12em" }}>
        {(it.raw?.payload?.transfer_mode ?? it.raw?.payload?.nlp?.fields?.transfer_mode) === "ear_tags" ? "Brincos/IDs" : "Cabeças"}
      </div>
      <div style={{ marginTop: 6, fontWeight: 950, color: "rgba(15,23,42,1)", whiteSpace: "pre-wrap" }}>
        {(() => {
          const p = it.raw?.payload || {};
          const mode = p.transfer_mode ?? p?.nlp?.fields?.transfer_mode ?? ((p.ear_tags || p?.nlp?.fields?.ear_tags) ? "ear_tags" : "heads");
          if (mode === "ear_tags") {
            const tags = Array.isArray(p.ear_tags) ? p.ear_tags : (Array.isArray(p?.nlp?.fields?.ear_tags) ? p?.nlp?.fields?.ear_tags : []);
            const shown = tags.slice(0, 8);
            return shown.join(", ") + (tags.length > shown.length ? " …" : "");
          }
          return String(p.qty_heads ?? p?.nlp?.fields?.qty_heads ?? "—");
        })()}
      </div>
    </div>
  </div>
) : null}


            {(it.missing || []).length || (it.ambiguities || []).length ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px dashed rgba(226,232,240,.92)", background: "rgba(248,250,252,.75)" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Atenção antes de aprovar</div>
                <div className="faz-muted">
                  Este evento está <b>incompleto/ambíguo</b>. Clique em <b>Resolver</b> e complete os campos.
                </div>
                <div className="faz-muted" style={{ marginTop: 8 }}>
                  Dica: para custos, garanta <code>group</code> e <code>value_brl</code>. Para saída, garanta <code>arrobas</code> e (opcional) <code>value_brl</code>.
                </div>
              </div>
            ) : null}
            {it.transcriptionError ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid rgba(251,146,60,.45)", background: "rgba(255,247,237,.9)", color: "rgba(124,45,18,1)", fontWeight: 800 }}>
                Falha de transcrição: {String(it.transcriptionError)}
              </div>
            ) : null}

            {it.contactPhone ? (
              <div className="faz-muted" style={{ marginTop: 8 }}>
                Contato do evento: <b>{it.contactPhone}</b>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button className="faz-btn primary" type="button" onClick={() => ((it.missing || []).length || (it.ambiguities || []).length) ? openResolve(it) : setStatus(it.id, "approved")}>
                Aprovar
              </button>
              <button className="faz-btn" type="button" onClick={() => openResolve(it)}>
                Resolver
              </button>
              {it.canTranscribe ? (
                <button className="faz-btn" type="button" onClick={() => transcribeAudio(it)}>
                  Transcrever áudio
                </button>
              ) : null}
              <button
                className="faz-btn"
                type="button"
                onClick={() => askOnWhatsApp(it)}
                disabled={!!sendingById[it.id]}
              >
                {!!sendingById[it.id]
                  ? "Enviando..."
                  : (waStatus?.send_enabled ? "Perguntar e enviar" : "Perguntar no WhatsApp")}
              </button>
              <button className="faz-btn" type="button" onClick={() => setStatus(it.id, "rejected")}>
                Rejeitar
              </button>
            </div>
          </Card>
        ))}

        {filtered.length === 0 ? (
          <div className="faz-panel">
            <h3>Nenhum item neste filtro</h3>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              Quando chegar mensagem do WhatsApp (ou quando você criar eventos), eles aparecem aqui para validação.
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={templatesOpen}
        title="Modelos de mensagem do vaqueiro"
        subtitle="Frases curtas para padronizar o WhatsApp e reduzir erro de interpretação."
        onClose={() => setTemplatesOpen(false)}
      >
        {templatesLoading ? (
          <div className="faz-muted">Carregando modelos...</div>
        ) : (
          <>
            {templatesErr ? (
              <div
                style={{
                  marginBottom: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(251,146,60,.45)",
                  background: "rgba(255,247,237,.9)",
                  color: "rgba(124,45,18,1)",
                  fontWeight: 800,
                }}
              >
                {templatesErr}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div className="faz-muted">
                Use as frases abaixo para orientar o vaqueiro no dia a dia.
              </div>
              <button
                className="faz-btn"
                type="button"
                onClick={() => copyText(formatTemplatesText(templatesData || TEMPLATES_FALLBACK))}
              >
                Copiar playbook completo
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {((templatesData || TEMPLATES_FALLBACK).quick_rules || []).length ? (
                <div
                  style={{
                    border: "1px solid rgba(226,232,240,.92)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(248,250,252,.7)",
                  }}
                >
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Regras rápidas</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {((templatesData || TEMPLATES_FALLBACK).quick_rules || []).map((r, idx) => (
                      <div key={`${idx}_${r}`} style={{ fontWeight: 800, color: "rgba(15,23,42,1)" }}>
                        - {r}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {((templatesData || TEMPLATES_FALLBACK).categories || []).map((cat) => (
                <div
                  key={cat.key || cat.title}
                  style={{
                    border: "1px solid rgba(226,232,240,.92)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(255,255,255,.95)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 950, color: "rgba(15,23,42,1)" }}>{cat.title}</div>
                    <button
                      className="faz-btn"
                      type="button"
                      onClick={() => copyText((cat.examples || []).join("\n"))}
                    >
                      Copiar exemplos
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {(cat.examples || []).map((ex, idx) => (
                      <div
                        key={`${cat.key || "cat"}_${idx}`}
                        style={{
                          fontWeight: 800,
                          color: "rgba(15,23,42,1)",
                          border: "1px dashed rgba(226,232,240,.92)",
                          borderRadius: 10,
                          padding: "8px 10px",
                          background: "rgba(248,250,252,.7)",
                        }}
                      >
                        {ex}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={resolveOpen}
        title="Resolver evento do WhatsApp"
        subtitle="Complete os campos de forma simples. Depois, Salvar e/ou Aprovar."
        onClose={() => {
          setResolveOpen(false);
          setActive(null);
          setDraft(null);
        }}
      >
        {active?.raw ? (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Pill tone={(active.missing || []).length || (active.ambiguities || []).length ? "warn" : "ok"}>Status: {active.raw.status}</Pill>
              <Pill>Tipo atual: {active.raw.type}</Pill>
              {(active.missing || []).length ? <Pill tone="warn">Faltando: {(active.missing || []).join(", ")}</Pill> : null}
              {(active.ambiguities || []).length ? <Pill tone="warn">Ambiguidades: {(active.ambiguities || []).join(", ")}</Pill> : null}
            </div>

            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(226,232,240,.92)", background: "rgba(248,250,252,.65)" }}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Mensagem original</div>
              <div style={{ whiteSpace: "pre-wrap", fontWeight: 800, color: "rgba(15,23,42,1)" }}>
                {active.raw.raw_text || "(sem texto — áudio/raw)"}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <InputRow label="Tipo do evento" help="Selecione o tipo correto (o sistema tenta adivinhar).">
                <select
                  className="faz-input"
                  style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                  value={draft?.type || "whatsapp_raw"}
                  onChange={(e) => setDraft((d) => ({ ...(d || {}), type: e.target.value }))}
                >
                  <option value="whatsapp_raw">WhatsApp (raw)</option>
                  <option value="cost">Custo</option>
                  <option value="transfer">Transferência</option>
                  <option value="exit">Saída (venda/abate)</option>
                  <option value="occurrence">Ocorrência</option>
                </select>
              </InputRow>

              {/* COST */}
              {draft?.type === "cost" ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 8 }}>Custo</div>

                  <InputRow label="Grupo" help="Sempre entra no relatório como top 5.">
                    <select
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.group || "Nutrição"}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), group: e.target.value }))}
                    >
                      {COST_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </InputRow>

                  <InputRow label="Valor total (R$)" help="Ex: 120,00">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.value_brl ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), value_brl: e.target.value }))}
                      placeholder="120,00"
                    />
                  </InputRow>

                  <InputRow label="Quantidade" help="Ex: 1">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.qty ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), qty: e.target.value }))}
                      placeholder="1"
                    />
                  </InputRow>

                  <InputRow label="Unidade" help="saco / kg / etc.">
                    <select
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.unit ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), unit: e.target.value }))}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </InputRow>

                  <InputRow label="Preço unitário (R$)" help="Opcional (se souber por saco/kg).">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.unit_price_brl ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), unit_price_brl: e.target.value }))}
                      placeholder="120,00"
                    />
                  </InputRow>

                  <InputRow label="Manga" help="Opcional (se o custo foi para uma manga).">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.area_id ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), area_id: e.target.value }))}
                      placeholder="30"
                    />
                  </InputRow>

                  <InputRow label="Lote" help="Opcional (se o custo foi para um lote).">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.lot_id ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), lot_id: e.target.value }))}
                      placeholder="10"
                    />
                  </InputRow>
                </div>
              ) : null}

              {/* TRANSFER */}
              {draft?.type === "transfer" ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 8 }}>Transferência</div>

                  <InputRow label="Modo" help="Use 'Brincos' para mover animal por animal (ex: gado 30).">
                    <select
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.transfer_mode || "heads"}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), transfer_mode: e.target.value }))}
                    >
                      <option value="heads">Cabeças (quantidade)</option>
                      <option value="ear_tags">Brincos/IDs (individual)</option>
                    </select>
                  </InputRow>

                  {String(draft.transfer_mode || "heads") === "ear_tags" ? (
                    <div style={{ marginTop: 2 }}>
                      <InputRow label="Brincos/IDs" help="Cole separado por espaço, vírgula ou um por linha (ex: 30 31 A12).">
                        <textarea
                          className="faz-input"
                          style={{ width: "100%", borderRadius: 12, padding: "10px 12px", minHeight: 90 }}
                          value={draft.ear_tags_text ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d || {}), ear_tags_text: e.target.value }))}
                          placeholder={"30\n31\nA12"}
                        />
                      </InputRow>
                      <div className="faz-muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Detectados: <b>{parseEarTagsText(draft.ear_tags_text).length}</b>
                      </div>
                    </div>
                  ) : null}


                  <InputRow label="Cabeças" help="Opcional (se souber) — se usar Brincos, pode deixar em branco.">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.qty_heads ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), qty_heads: e.target.value }))}
                      placeholder="30"
                    />
                  </InputRow>

                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(226,232,240,.92)", background: "rgba(248,250,252,.65)" }}>
                      <div style={{ fontWeight: 950, marginBottom: 8 }}>Origem</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          className="faz-input"
                          style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                          value={draft.origin_lot_id ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d || {}), origin_lot_id: e.target.value }))}
                          placeholder="Lote (ex: 10)"
                        />
                        <input
                          className="faz-input"
                          style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                          value={draft.origin_area_id ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d || {}), origin_area_id: e.target.value }))}
                          placeholder="Manga (ex: 30)"
                        />
                      </div>
                    </div>

                    <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(226,232,240,.92)", background: "rgba(248,250,252,.65)" }}>
                      <div style={{ fontWeight: 950, marginBottom: 8 }}>Destino</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          className="faz-input"
                          style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                          value={draft.dest_lot_id ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d || {}), dest_lot_id: e.target.value }))}
                          placeholder="Lote (ex: 15)"
                        />
                        <input
                          className="faz-input"
                          style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                          value={draft.dest_area_id ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d || {}), dest_area_id: e.target.value }))}
                          placeholder="Manga (ex: 12)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* EXIT */}
              {draft?.type === "exit" ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 8 }}>Saída (venda/abate)</div>

                  <InputRow label="Arrobas (@)" help="Obrigatório para calcular R$/@ no mês.">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.arrobas ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), arrobas: e.target.value }))}
                      placeholder="10"
                    />
                  </InputRow>

                  <InputRow label="Valor total (R$)" help="Opcional (se quiser preço médio).">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.exit_value_brl ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), exit_value_brl: e.target.value }))}
                      placeholder="2550,00"
                    />
                  </InputRow>
                </div>
              ) : null}

              {/* OCCURRENCE */}
              {draft?.type === "occurrence" ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 8 }}>Ocorrência</div>

                  <InputRow label="Tipo" help="Ex: rebolinho">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.kind ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), kind: e.target.value }))}
                      placeholder="rebolinho"
                    />
                  </InputRow>

                  <InputRow label="Quantidade" help="Ex: 18">
                    <input
                      className="faz-input"
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px" }}
                      value={draft.occ_qty ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...(d || {}), occ_qty: e.target.value }))}
                      placeholder="18"
                    />
                  </InputRow>
                </div>
              ) : null}

              {draft?.type === "whatsapp_raw" ? (
                <div className="faz-muted" style={{ marginTop: 10 }}>
                  Este item está como <b>raw</b>. Se for um custo/transferência/saída, selecione o tipo acima e preencha os campos.
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, justifyContent: "flex-end" }}>
              <button className="faz-btn" type="button" onClick={() => saveDraft({ approve: false })}>
                Salvar
              </button>
              <button className="faz-btn primary" type="button" onClick={() => saveDraft({ approve: true })}>
                Salvar e aprovar
              </button>
              <button
                className="faz-btn"
                type="button"
                onClick={() => {
                  setResolveOpen(false);
                  setActive(null);
                  setDraft(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <div className="faz-muted">Sem item selecionado.</div>
        )}
      </Modal>
    </div>
  );
}
