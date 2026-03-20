import React, { useEffect, useMemo, useRef, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import "../styles/herd_rebanho_fix.css";

/**
 * REBANHO (REWRITE CLEAN V2.1)
 * Objetivo: estabilizar 100% o front (sem erro), com UX "modo vaqueiro" por BRINCO + fila (scanner),
 * mantendo integração opcional com a tela de Transferências (prop onTransfer).
 *
 * Dados locais (localStorage) — depois plugamos no backend.
 */

const LS = {
  lots: "faz_rebanho_lots_v1",
  animals: "faz_rebanho_animals_v1",
  weighs: "faz_rebanho_weighs_v1",
  log: "faz_rebanho_opslog_v1",
};

function todayIso() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function safeJsonParse(s, fallback) {
  try {
    const x = JSON.parse(s);
    return x == null ? fallback : x;
  } catch {
    return fallback;
  }
}

function loadLS(key, fallback) {
  try {
    return safeJsonParse(localStorage.getItem(key) || "", fallback);
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function fmtInt(n) {
  try {
    return Number(n).toLocaleString("pt-BR");
  } catch {
    return String(n);
  }
}

function fmtKg(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${fmtInt(Math.round(Number(n)))} kg`;
}

function normEar(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

function fmtDateShort(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function daysSinceIso(iso) {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const ms = Date.now() - d.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

function parseFloatPt(s) {
  const x = Number(String(s || "").replace(",", "."));
  return Number.isFinite(x) ? x : NaN;
}

function parseQueue(raw) {
  // aceita linhas, vírgula, ponto-e-vírgula e espaços
  const txt = String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[;,]+/g, "\n")
    .replace(/\s+/g, "\n");
  const arr = txt
    .split("\n")
    .map((x) => normEar(x))
    .filter(Boolean);

  // remove duplicados preservando ordem
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}


function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    const needsQuote =
      s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r");
    if (needsQuote) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function downloadText(filename, content, mime = "text/plain;charset=utf-8") {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {}
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function Herd({ onTransfer = null }) {
  // -----------------------------
  // Dados locais (rebanho)
  // -----------------------------
  const [lots, setLots] = useState(() => loadLS(LS.lots, []));
  const [animals, setAnimals] = useState(() => loadLS(LS.animals, []));
  const [weighs, setWeighs] = useState(() => loadLS(LS.weighs, {})); // { EAR: [{date,kg}] }
  const [opsLog, setOpsLog] = useState(() => loadLS(LS.log, []));

  useEffect(() => saveLS(LS.lots, lots), [lots]);
  useEffect(() => saveLS(LS.animals, animals), [animals]);
  useEffect(() => saveLS(LS.weighs, weighs), [weighs]);
  useEffect(() => saveLS(LS.log, opsLog), [opsLog]);

  const lotById = useMemo(() => {
    const m = new Map();
    (Array.isArray(lots) ? lots : []).forEach((l) => m.set(Number(l.id), l));
    return m;
  }, [lots]);

  const lotsSorted = useMemo(() => {
    const list = Array.isArray(lots) ? lots.slice() : [];
    list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    return list;
  }, [lots]);

  const activeAnimals = useMemo(() => {
    return (Array.isArray(animals) ? animals : []).filter((a) => a.status !== "inactive");
  }, [animals]);

  // -----------------------------
  // Navegação interna (subtabs)
  // -----------------------------
  const [tab, setTab] = useState("operate");

  // -----------------------------
  // Operar (modo vaqueiro)
  // -----------------------------
  const earRef = useRef(null);
  const kgRef = useRef(null);

  const [earQ, setEarQ] = useState("");
  const [kgQ, setKgQ] = useState("");
  const [scannerFocus, setScannerFocus] = useState(true); // mantém foco no peso durante a fila
  const [confirmPeso, setConfirmPeso] = useState(null); // {ear,kg,date}
  const [opDate, setOpDate] = useState(() => todayIso());
  const [destLotId, setDestLotId] = useState("__KEEP__");
  const [baixaMotivo, setBaixaMotivo] = useState("morte");
  const [opMsg, setOpMsg] = useState("");

  const earNorm = useMemo(() => normEar(earQ), [earQ]);

  const animalExact = useMemo(() => {
    if (!earNorm) return null;
    return activeAnimals.find((a) => normEar(a.ear) === earNorm) || null;
  }, [activeAnimals, earNorm]);

  useEffect(() => { setConfirmPeso(null); }, [earQ]);
  useEffect(() => { setConfirmPeso(null); }, [kgQ]);

  function lotLabelById(lotId) {
    const l = lotById.get(Number(lotId));
    return l?.name || (lotId != null ? `Manga ${String(lotId).padStart(2, "0")}` : "—");
  }

  function animalLotLabel(a) {
    return lotLabelById(a?.lotId);
  }

  function animalLastInfo(a) {
    const ds = daysSinceIso(a?.lastWeighedAt);
    const d = fmtDateShort(a?.lastWeighedAt);
    if (ds == null) return d;
    return `${d} • ${ds}d`;
  }

  function pushLog(item) {
    const next = [item, ...(Array.isArray(opsLog) ? opsLog : [])].slice(0, 60);
    setOpsLog(next);
  }

  function updateAnimal(ear, patch) {
    setAnimals((prev) => {
      const list = Array.isArray(prev) ? prev.slice() : [];
      const i = list.findIndex((x) => normEar(x.ear) === normEar(ear));
      if (i >= 0) list[i] = { ...list[i], ...patch };
      return list;
    });
  }

  function appendWeigh(ear, dateIso, kg) {
    const E = normEar(ear);
    setWeighs((prev) => {
      const obj = prev && typeof prev === "object" ? { ...prev } : {};
      const arr = Array.isArray(obj[E]) ? obj[E].slice() : [];
      arr.unshift({ date: dateIso, kg: kg });
      obj[E] = arr.slice(0, 200);
      return obj;
    });
  }

  // -----------------------------
  // Scanner (fila)
  // -----------------------------
  const [filaRaw, setFilaRaw] = useState("");
  const [fila, setFila] = useState([]);
  const [filaIdx, setFilaIdx] = useState(0);

  const filaIsOn = Array.isArray(fila) && fila.length > 0;
  const filaTotal = filaIsOn ? fila.length : 0;
  const filaPos = filaIsOn ? filaIdx + 1 : 0;
  const filaCurrent = filaIsOn ? fila[filaIdx] || "" : "";
  const filaNext = filaIsOn ? fila[filaIdx + 1] || "" : "";

  function startFila() {
    const arr = parseQueue(filaRaw);
    setFila(arr);
    setFilaIdx(0);
    if (arr.length) {
      setEarQ(arr[0]);
      setOpMsg("");
      requestAnimationFrame(() => (scannerFocus ? kgRef?.current?.focus() : earRef?.current?.focus()));
    } else {
      setOpMsg("Cole uma lista de brincos (um por linha).");
      requestAnimationFrame(() => earRef?.current?.focus());
    }
  }

  function clearFila() {
    setFilaRaw("");
    setFila([]);
    setFilaIdx(0);
  }

  function nextFila() {
    if (!filaIsOn) return;
    const next = Math.min(filaIdx + 1, filaTotal - 1);
    setFilaIdx(next);
    setEarQ(fila[next] || "");
    requestAnimationFrame(() => (scannerFocus ? kgRef?.current?.focus() : earRef?.current?.focus()));
  }

  function afterRegisterAdvance() {
    setKgQ("");
    if (filaIsOn && filaIdx < filaTotal - 1) {
      const next = filaIdx + 1;
      setFilaIdx(next);
      setEarQ(fila[next] || "");
      requestAnimationFrame(() => (scannerFocus ? kgRef?.current?.focus() : earRef?.current?.focus()));
      return;
    }
    // sai do modo fila
    setEarQ("");
    requestAnimationFrame(() => earRef?.current?.focus());
  }

  function registerWeigh() {
    setOpMsg("");
    if (!animalExact) {
      setOpMsg("Informe um brinco válido (use Demo se necessário).");
      return;
    }
    const kg = parseFloatPt(kgQ);

if (!Number.isFinite(kg) || kg <= 0) {
  setOpMsg("Informe um peso válido (kg).");
  return;
}

const dateIso = opDate || todayIso();

// Confirmação para valores fora do intervalo típico
const inRange = kg >= 80 && kg <= 900;
const alreadyConfirmed =
  confirmPeso &&
  confirmPeso.ear === (animalExact?.ear || "") &&
  Number(confirmPeso.kg) === Number(kg) &&
  confirmPeso.date === dateIso;

if (!inRange && !alreadyConfirmed) {
  setConfirmPeso({ ear: animalExact?.ear || "", kg, date: dateIso });
  setOpMsg(`⚠️ Peso fora do normal (${kg} kg). Clique em "Confirmar" para registrar.`);
  return;
}


    appendWeigh(animalExact.ear, dateIso, kg);
    updateAnimal(animalExact.ear, { lastWeightKg: kg, lastWeighedAt: dateIso });

    pushLog({
      id: uid("w"),
      type: "weigh",
      ear: animalExact.ear,
      kg,
      date: dateIso,
      to: null,
    });

    setOpMsg("✅ Pesagem registrada (local).");
    afterRegisterAdvance();
  }

  function registerMoveLocal() {
    setOpMsg("");
    if (!animalExact) {
      setOpMsg("Informe um brinco válido (use Demo se necessário).");
      return;
    }
    if (destLotId === "__KEEP__") {
      setOpMsg("Selecione uma manga destino (ou mantenha a atual).");
      return;
    }
    const toId = Number(destLotId);
    const toName = lotLabelById(toId);

    updateAnimal(animalExact.ear, { lotId: toId });

    pushLog({
      id: uid("m"),
      type: "move",
      ear: animalExact.ear,
      kg: null,
      date: opDate || todayIso(),
      to: toName,
    });

    setOpMsg(`✅ Movimentação registrada (local): ${toName}.`);
    setDestLotId("__KEEP__");
    setEarQ("");
    requestAnimationFrame(() => earRef?.current?.focus());
  }

  function openTransferScreen() {
    if (!onTransfer || typeof onTransfer !== "function") {
      setOpMsg("Tela de Transferências não disponível.");
      return;
    }
    if (!animalExact) {
      setOpMsg("Informe um brinco válido para enviar para Transferências.");
      return;
    }
    if (destLotId === "__KEEP__") {
      setOpMsg("Selecione uma manga destino para enviar para Transferências.");
      return;
    }
    onTransfer({
      mode: "animal",
      earTags: [animalExact.ear],
      toLotId: Number(destLotId),
      notes: `Mover ${animalExact.ear} para ${lotLabelById(Number(destLotId))}`,
    });
  }

  function baixaAnimal() {
    setOpMsg("");
    if (!animalExact) {
      setOpMsg("Informe um brinco válido.");
      return;
    }
    updateAnimal(animalExact.ear, { status: "inactive" });
    pushLog({
      id: uid("b"),
      type: "baixa",
      ear: animalExact.ear,
      kg: null,
      date: opDate || todayIso(),
      to: null,
      reason: baixaMotivo,
    });
    setOpMsg("✅ Animal baixado (inativo).");
    setEarQ("");
    requestAnimationFrame(() => earRef?.current?.focus());
  }

  // -----------------------------
  // Resumo/animais/lotes
  // -----------------------------
  const byCategory = useMemo(() => {
    const m = {};
    activeAnimals.forEach((a) => {
      const k = String(a.category || "—").toUpperCase();
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [activeAnimals]);

  // -----------------------------
  // Demo / limpar
  // -----------------------------
  function seedDemo() {
    const demoLots = [
      { id: 3, name: "Manga 03" },
      { id: 7, name: "Manga 07" },
      { id: 12, name: "Manga 12" },
      { id: 18, name: "Manga 18" },
      { id: 30, name: "Manga 30" },
    ];
    const d0 = todayIso();
    const demoAnimals = [
      { ear: "A2402", sex: "M", category: "BOI", lotId: 30, status: "active", lastWeightKg: 510, lastWeighedAt: d0 },
      { ear: "A2403", sex: "M", category: "BOI", lotId: 30, status: "active", lastWeightKg: 495, lastWeighedAt: d0 },
      { ear: "N901", sex: "F", category: "NOVILHA", lotId: 18, status: "active", lastWeightKg: 380, lastWeighedAt: d0 },
      { ear: "7812", sex: "F", category: "VACA", lotId: 7, status: "active", lastWeightKg: 450, lastWeighedAt: d0 },
      { ear: "A2391", sex: "F", category: "VACA", lotId: 7, status: "active", lastWeightKg: 420, lastWeighedAt: d0 },
    ];
    setLots(demoLots);
    setAnimals(demoAnimals);
    setWeighs({});
    setOpsLog([]);
    setOpMsg("✅ Demo carregado.");
    setTab("operate");
    requestAnimationFrame(() => earRef?.current?.focus());
  }

  function clearLocalData() {
    setLots([]);
    setAnimals([]);
    setWeighs({});
    setOpsLog([]);
    try {
      localStorage.removeItem(LS.lots);
      localStorage.removeItem(LS.animals);
      localStorage.removeItem(LS.weighs);
      localStorage.removeItem(LS.log);
    } catch {}
    setOpMsg("Dados locais apagados.");
  }

  // -----------------------------
  // UI: Header (subtabs + actions)
  // -----------------------------
  const subtabs = [
    { key: "operate", label: "Operar" },
    { key: "overview", label: "Visão geral" },
    { key: "lots", label: "Mangas" },
    { key: "animals", label: "Animais" },
    { key: "transfer", label: "Transferir" },
  ];

  const actions = [
    { key: "demo", label: "Demo", variant: "ghost" },
    { key: "clear", label: "Limpar (local)", variant: "ghost" },
  ];

  function onAction(a) {
    const k = a?.key || a;
    if (k === "demo") seedDemo();
    if (k === "clear") clearLocalData();
  }

  // -----------------------------
  // Animais tab (filtros simples)
  // -----------------------------
  const [aSearch, setASearch] = useState("");
  const [aLot, setALot] = useState("ALL");
  const [aCat, setACat] = useState("ALL");

  const animalsFiltered = useMemo(() => {
    const q = normEar(aSearch);
    return activeAnimals
      .filter((a) => (aLot === "ALL" ? true : Number(a.lotId) === Number(aLot)))
      .filter((a) => (aCat === "ALL" ? true : String(a.category || "").toUpperCase() === String(aCat).toUpperCase()))
      .filter((a) => (!q ? true : normEar(a.ear).includes(q)))
      .sort((x, y) => String(x.ear).localeCompare(String(y.ear)));
  }, [activeAnimals, aSearch, aLot, aCat]);

  // -----------------------------
  // Transfer tab (cola lista -> abre Transfers)
  // -----------------------------
  const [tRaw, setTRaw] = useState("");
  const [tDest, setTDest] = useState("");

  function sendToTransfers() {
    if (!onTransfer || typeof onTransfer !== "function") {
      setOpMsg("Tela de Transferências não disponível.");
      return;
    }
    const list = parseQueue(tRaw);
    if (!list.length) {
      setOpMsg("Cole uma lista de brincos para transferir.");
      return;
    }
    if (!tDest) {
      setOpMsg("Selecione a manga destino.");
      return;
    }
    onTransfer({
      mode: "animal",
      earTags: list,
      toLotId: Number(tDest),
      notes: `Transferir ${list.length} animais para ${lotLabelById(Number(tDest))}`,
    });
  }

  return (
    <div className="faz-herd">
      <CrasPageHeader
        eyebrow="OPERAÇÃO"
        title="Rebanho"
        subtitle="Simples no dia a dia. Estável. Sem quebrar build."
        subtabs={subtabs}
        activeSubtabKey={tab}
        onSubtab={(k) => setTab(k)}
        actions={actions}
        onAction={onAction}
      />

      {tab === "operate" && (
        <div className="card">
          <div className="card-header-row" style={{ alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Operar (modo vaqueiro)</div>
              <div className="card-subtitle">Brinco → peso → registrar. Rápido, sem tabelas.</div>
            </div>

            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={() => setTab("animals")}>
                Animais
              </button>
              <button className="faz-btn" type="button" onClick={() => setTab("lots")}>
                Mangas
              </button>
              <button className="faz-btn" type="button" onClick={seedDemo}>
                Demo
              </button>
            </div>
          </div>

          <div className="faz-detail-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Brinco</label>
              <input
                ref={earRef}
                className="input"
                value={earQ}
                onChange={(e) => setEarQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEarQ("");
                    setKgQ("");
                    setOpMsg("");
                    return;
                  }
                  if (e.key === "Enter") {
                    requestAnimationFrame(() => (scannerFocus ? kgRef?.current?.focus() : earRef?.current?.focus()));
                  }
                }}
                placeholder="Ex.: A2402, N901, 7812..."
              />
              <div className="texto-suave" style={{ marginTop: 6 }}>
                Enter = ir para peso • Esc = limpar
              </div>
            </div>

            <div>
              <label className="form-label">Manga (destino)</label>
              <select className="input" value={destLotId} onChange={(e) => setDestLotId(e.target.value)}>
                <option value="__KEEP__">Manter manga atual</option>
                {lotsSorted.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name || `Manga ${String(l.id).padStart(2, "0")}`}
                  </option>
                ))}
              </select>
              <div className="texto-suave" style={{ marginTop: 6 }}>
                Use para mover rapidamente (local) ou enviar para Transferências.
              </div>
            </div>

            <div>
              <label className="form-label">Peso (kg)</label>
              <input
                ref={kgRef}
                className="input"
                inputMode="decimal"
                value={kgQ}
                onChange={(e) => setKgQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setKgQ("");
                    setOpMsg("");
                    requestAnimationFrame(() => earRef?.current?.focus());
                    return;
                  }
                  if (e.key === "Enter") registerWeigh();
                }}
                placeholder="Ex.: 212"
              />
              <div className="texto-suave" style={{ marginTop: 6 }}>
                Enter = registrar pesagem (local) e avançar na fila (se ligada).
              </div>
            </div>

            <div>
              <label className="form-label">Data</label>
              <input className="input" type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} />
              <div className="texto-suave" style={{ marginTop: 6 }}>
                Padrão: hoje
              </div>
            </div>
          </div>

          {/* Scanner */}
          <div className="card" style={{ marginTop: 12, border: "1px solid rgba(226,232,240,.92)" }}>
            <div className="card-header-row">
              <div>
                <div style={{ fontWeight: 900 }}>Modo scanner (fila de brincos)</div>
                <div className="card-subtitle">Cole a lista e pese um por um (Enter para avançar).</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={scannerFocus} onChange={(e) => setScannerFocus(e.target.checked)} />
                  Só peso
                </label>
                <button className="faz-btn" type="button" onClick={startFila}>
                  Iniciar fila
                </button>
                <button className="faz-btn" type="button" onClick={nextFila} disabled={!filaIsOn}>
                  Próximo
                </button>
                <button className="faz-btn" type="button" onClick={clearFila}>
                  Limpar fila
                </button>
              </div>
            </div>

            <textarea
              className="input"
              rows={3}
              value={filaRaw}
              onChange={(e) => setFilaRaw(e.target.value)}
              placeholder={"Cole aqui os brincos (um por linha).\nEx:\nA2402\nA2403\nN901"}
            />

            {filaIsOn ? (
              <div className="texto-suave" style={{ marginTop: 10 }}>
                <b>Fila:</b> {filaPos}/{filaTotal} • <b>Atual:</b> {filaCurrent || "—"} • <b>Próximo:</b>{" "}
                {filaNext || "—"}
              </div>
            ) : (
              <div className="texto-suave" style={{ marginTop: 10 }}>
                Dica: você pode colar separado por vírgula, ponto-e-vírgula ou espaços.
              </div>
            )}
          </div>

          {/* Animal card */}
          {animalExact ? (
            <div className="card" style={{ marginTop: 12, border: "1px solid rgba(226,232,240,.92)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="pill" style={{ fontWeight: 950 }}>
                  {animalExact.ear}
                </span>
                <span className="pill">{animalExact.category || "—"}</span>
                <span className="pill">{animalLotLabel(animalExact)}</span>
                <span className="pill">{fmtKg(animalExact.lastWeightKg)}</span>
                <span className="pill">{animalLastInfo(animalExact)}</span>

                <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
                  <button className="faz-btn" type="button" onClick={registerWeigh}>
                    Registrar
                  </button>
                  <button className="faz-btn" type="button" onClick={registerMoveLocal}>
                    Mover (local)
                  </button>
                  <button className="faz-btn" type="button" onClick={openTransferScreen}>
                    Mover (transferências)
                  </button>
                  <select className="input" value={baixaMotivo} onChange={(e) => setBaixaMotivo(e.target.value)} style={{ width: 170, minWidth: 170 }}>
                    <option value="morte">Baixa: morte</option>
                    <option value="descarte">Baixa: descarte</option>
                    <option value="venda">Baixa: venda</option>
                    <option value="outro">Baixa: outro</option>
                  </select>
                  <button className="faz-btn" type="button" onClick={baixaAnimal}>
                    Baixa
                  </button>
                </div>
              </div>

              {opMsg ? <div className="texto-suave" style={{ marginTop: 10 }}>{opMsg}</div> : null}
            </div>
          ) : (
            <div className="faz-emptyNice" style={{ marginTop: 12 }}>
              Digite um brinco para carregar o animal. Se não tiver dados, clique em <b>Demo</b>.
              {opMsg ? <div style={{ marginTop: 8 }}>{opMsg}</div> : null}
            </div>
          )}

          {/* Log */}
          <div className="card" style={{ marginTop: 12, border: "1px solid rgba(226,232,240,.92)" }}>
            <div className="card-header-row">
              <div>
                <div style={{ fontWeight: 900 }}>Log do dia (local)</div>
                <div className="card-subtitle">Fica salvo no navegador (sincroniza depois).</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="faz-btn" type="button" onClick={exportLogCsv}>
                  Exportar CSV
                </button>
                <button className="faz-btn" type="button" onClick={() => setOpsLog([])}>
                  Limpar
                </button>
              </div>
            </div>

            {opsLog.length === 0 ? (
              <div className="texto-suave">Nenhuma operação registrada ainda.</div>
            ) : (
              <div className="faz-animals" style={{ marginTop: 10 }}>
                {opsLog.slice(0, 12).map((it) => (
                  <div key={it.id} className="faz-animal-row">
                    <div className="meta">
                      <span className="ear">{it.ear}</span>
                      {" • "}
                      {it.type === "weigh"
                        ? `Pesagem ${it.kg}kg`
                        : it.type === "move"
                          ? `Mover para ${it.to || "—"}`
                          : "Baixa"}
                      {" • "}
                      {it.date || "—"}{it.reason ? ` • ${it.reason}` : ""}
                    </div>
                    <span className="pill">{String(it.type || "").toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "overview" && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <div style={{ fontWeight: 900 }}>Visão geral</div>
              <div className="card-subtitle">Contagem e alertas básicos (front).</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{fmtInt(activeAnimals.length)}</div>
              <div className="texto-suave">ativos</div>
            </div>
          </div>

          <div className="faz-detail-grid" style={{ marginTop: 12 }}>
            {Object.keys(byCategory)
              .sort()
              .map((k) => (
                <div key={k} className="faz-mini">
                  <div className="k">{k}</div>
                  <div className="v">{fmtInt(byCategory[k])}</div>
                </div>
              ))}
          </div>

          <div className="texto-suave" style={{ marginTop: 12 }}>
            Dica: a experiência do vaqueiro está na aba <b>Operar</b>.
          </div>
        </div>
      )}

      {tab === "lots" && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <div style={{ fontWeight: 900 }}>Mangas</div>
              <div className="card-subtitle">Lista simples + animais por manga.</div>
            </div>
            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={() => setTab("operate")}>
                Operar
              </button>
              <button className="faz-btn" type="button" onClick={seedDemo}>
                Demo
              </button>
            </div>
          </div>

          {lotsSorted.length === 0 ? (
            <div className="faz-emptyNice" style={{ marginTop: 12 }}>
              Sem mangas cadastradas. Clique em <b>Demo</b>.
            </div>
          ) : (
            <div className="faz-detail-grid" style={{ marginTop: 12 }}>
              {lotsSorted.map((l) => {
                const count = activeAnimals.filter((a) => Number(a.lotId) === Number(l.id)).length;
                return (
                  <div key={String(l.id)} className="faz-mini">
                    <div className="k">{l.name || `Manga ${String(l.id).padStart(2, "0")}`}</div>
                    <div className="v">{fmtInt(count)}</div>
                    <div className="s">cabeças</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "animals" && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <div style={{ fontWeight: 900 }}>Animais</div>
              <div className="card-subtitle">Busca e filtros simples (front).</div>
            </div>
            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={() => setTab("operate")}>
                Operar
              </button>
              <button className="faz-btn" type="button" onClick={seedDemo}>
                Demo
              </button>
            </div>
          </div>

          <div className="faz-detail-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Buscar brinco</label>
              <input className="input" value={aSearch} onChange={(e) => setASearch(e.target.value)} placeholder="Ex.: A2402" />
            </div>

            <div>
              <label className="form-label">Manga</label>
              <select className="input" value={aLot} onChange={(e) => setALot(e.target.value)}>
                <option value="ALL">Todas</option>
                {lotsSorted.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name || `Manga ${String(l.id).padStart(2, "0")}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Categoria</label>
              <select className="input" value={aCat} onChange={(e) => setACat(e.target.value)}>
                <option value="ALL">Todas</option>
                {Object.keys(byCategory)
                  .sort()
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {animalsFiltered.length === 0 ? (
            <div className="faz-emptyNice" style={{ marginTop: 12 }}>
              Nenhum animal encontrado.
            </div>
          ) : (
            <div className="faz-animals" style={{ marginTop: 12 }}>
              {animalsFiltered.map((a) => (
                <div key={a.ear} className="faz-animal-row">
                  <div className="meta">
                    <span className="ear">{a.ear}</span>
                    {" • "}{a.category || "—"}
                    {" • "}{animalLotLabel(a)}
                    {" • "}{fmtKg(a.lastWeightKg)}
                    {" • "}{animalLastInfo(a)}
                  </div>
                  <button className="faz-btn" type="button" onClick={() => { setTab("operate"); setEarQ(a.ear); requestAnimationFrame(() => (scannerFocus ? kgRef?.current?.focus() : earRef?.current?.focus())); }}>
                    Operar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "transfer" && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <div style={{ fontWeight: 900 }}>Transferir (atalho)</div>
              <div className="card-subtitle">Cola brincos + manga destino e abre a tela de Transferências.</div>
            </div>
          </div>

          <div className="faz-detail-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Brincos (um por linha)</label>
              <textarea className="input" rows={4} value={tRaw} onChange={(e) => setTRaw(e.target.value)} placeholder={"A2402\nA2403\nN901"} />
            </div>

            <div>
              <label className="form-label">Manga destino</label>
              <select className="input" value={tDest} onChange={(e) => setTDest(e.target.value)}>
                <option value="">Selecione</option>
                {lotsSorted.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name || `Manga ${String(l.id).padStart(2, "0")}`}
                  </option>
                ))}
              </select>

              <div className="faz-rowActions" style={{ marginTop: 10 }}>
                <button className="faz-btn" type="button" onClick={sendToTransfers}>
                  Abrir Transferências
                </button>
              </div>

              <div className="texto-suave" style={{ marginTop: 10 }}>
                Se a tela de Transferências não estiver habilitada, use a aba <b>Operar</b> e faça mover local.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
