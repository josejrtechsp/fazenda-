import React, { useEffect, useMemo, useRef, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/herd_rebanho_fix.css";

/**
 * REBANHO (REWRITE CLEAN V2.1)
 * Objetivo: estabilizar 100% o front (sem erro), com UX "modo vaqueiro" por BRINCO + fila (scanner),
 * mantendo integração opcional com a tela de Transferências (prop onTransfer).
 *
 * Dados locais (localStorage) — depois plugamos no backend.
 */

const LS = {
  lots: "faz_rebanho_lots_v3",
  animals: "faz_rebanho_animals_v3",
  weighs: "faz_rebanho_weighs_v3",
  log: "faz_rebanho_opslog_v3",
  health: "faz_rebanho_health_v3",
};
const FIXED_COST_CAP_PER_HEAD = 90;

function todayIso() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function startOfDayIso(dateIso) {
  const iso = String(dateIso || "").trim();
  return iso ? `${iso}T00:00:00` : undefined;
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

function fmtArroba(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  } catch {
    return String(n);
  }
}

function fmtKg1(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return `${Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} kg`;
  } catch {
    return `${String(n)} kg`;
  }
}

function fmtKgDay(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    const v = Number(n);
    const txt = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${v > 0 ? "+" : ""}${txt} kg`;
  } catch {
    return String(n);
  }
}

function fmtBRL(n) {
  if (n == null || Number.isNaN(Number(n))) return "R$ 0,00";
  try {
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${String(n)}`;
  }
}

function currentMonthKey() {
  try {
    return new Date().toISOString().slice(0, 7);
  } catch {
    return "";
  }
}

function fmtMonthLabel(monthKey) {
  const m = String(monthKey || "");
  const hit = m.match(/^(\d{4})-(\d{2})$/);
  if (!hit) return m || "—";
  const y = Number(hit[1]);
  const mm = Number(hit[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return m;
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${labels[mm - 1]}/${y}`;
}

function normEar(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

function profileToHealthState(profile, prev = null) {
  const base = prev && typeof prev === "object" ? prev : {};
  const vacPrev = base.vac && typeof base.vac === "object" ? base.vac : {};
  const sheetPrev = base.sheet && typeof base.sheet === "object" ? base.sheet : {};
  const raw = profile && typeof profile === "object" ? profile : {};
  const rawSheet = raw.sheet && typeof raw.sheet === "object" ? raw.sheet : {};
  return {
    ...base,
    birth: raw.birth || base.birth || "",
    pregStatus: String(raw.preg_status || raw.pregStatus || base.pregStatus || "ND").toUpperCase(),
    pregStart: raw.preg_start || raw.pregStart || base.pregStart || "",
    note: raw.note || base.note || "",
    vac: {
      ...vacPrev,
      name: raw.vac_name || raw.vacName || vacPrev.name || "",
      date: raw.vac_date || raw.vacDate || vacPrev.date || "",
      next: raw.vac_next || raw.vacNext || vacPrev.next || "",
    },
    sheet: {
      ...sheetPrev,
      ...rawSheet,
    },
    updatedAt: raw.updated_at || raw.updatedAt || base.updatedAt || todayIso(),
  };
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

function logSortKey(item) {
  return String(item?.at || item?.date || "");
}

function logFingerprint(item) {
  const kg = Number(item?.kg);
  return [
    String(item?.type || ""),
    normEar(item?.ear),
    String(item?.date || ""),
    Number.isFinite(kg) ? kg.toFixed(2) : "",
    String(item?.to || ""),
    String(item?.reason || ""),
  ].join("|");
}

function mergeActivityLogs(backendItems, localItems) {
  const merged = [
    ...(Array.isArray(backendItems) ? backendItems : []),
    ...(Array.isArray(localItems) ? localItems : []),
  ].filter(Boolean);
  merged.sort((a, b) => logSortKey(b).localeCompare(logSortKey(a), "pt-BR"));

  const seen = new Set();
  const out = [];
  for (const item of merged) {
    const key = logFingerprint(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 120) break;
  }
  return out;
}

function calcAnimalGmdFromHistory(animal, weighsMap) {
  const ear = normEar(animal?.ear || animal?.ear_tag);
  const hist = Array.isArray(weighsMap?.[ear]) ? weighsMap[ear] : [];
  if (hist.length >= 2) {
    for (let i = 0; i < hist.length - 1; i += 1) {
      const now = hist[i];
      const prev = hist[i + 1];
      if (!now?.date || !prev?.date) continue;
      const dn = new Date(`${now.date}T00:00:00`);
      const dp = new Date(`${prev.date}T00:00:00`);
      const days = (dn.getTime() - dp.getTime()) / 86400000;
      if (!Number.isFinite(days) || days < 1) continue;
      const kgNow = Number(now?.kg);
      const kgPrev = Number(prev?.kg);
      if (!Number.isFinite(kgNow) || !Number.isFinite(kgPrev)) continue;
      return (kgNow - kgPrev) / days;
    }
  }
  const fromAnimal = Number(animal?.gmdKgDay ?? animal?.gmd_kg_day ?? animal?.gmd);
  return Number.isFinite(fromAnimal) ? fromAnimal : null;
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

function normalizeHeaderToken(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asText(v) {
  return String(v ?? "").trim();
}

function numOrNull(v) {
  const n = parseFloatPt(asText(v));
  return Number.isFinite(n) ? Number(n) : null;
}

function intOrNull(v) {
  const n = Number(asText(v));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeSexValue(v) {
  const t = normalizeHeaderToken(v);
  if (!t) return "";
  if (t.startsWith("m") || t.includes("macho")) return "M";
  if (t.startsWith("f") || t.includes("femea") || t.includes("fem")) return "F";
  return "";
}

function normalizeCategoryValue(v) {
  const t = normalizeHeaderToken(v);
  if (!t) return "";
  if (t.includes("bezerra")) return "BEZERRA";
  if (t.includes("bezerro")) return "BEZERRO";
  if (t.includes("novilha")) return "NOVILHA";
  if (t.includes("vaca")) return "VACA";
  if (t.includes("touro")) return "TOURO";
  if (t.includes("boi")) return "BOI";
  return String(v || "").trim().toUpperCase();
}

function normalizePregValue(v) {
  const t = normalizeHeaderToken(v);
  if (!t) return "ND";
  if (t.includes("prenha")) return "PRENHA";
  if (t.includes("vazia")) return "VAZIA";
  return "ND";
}

function normalizeIsoDate(v) {
  const s = asText(v);
  if (!s) return "";
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return s;
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

const CURRAL_VACCINES = [
  { name: "Aftosa", nextDays: 180 },
  { name: "Raiva", nextDays: 365 },
  { name: "Clostridiose", nextDays: 180 },
  { name: "Brucelose", nextDays: 365 },
  { name: "Vermífugo", nextDays: 120 },
];

export default function Herd({ onTransfer = null, mode = "produtor" }) {
  // -----------------------------
  // Dados locais (rebanho)
  // -----------------------------
  const [lots, setLots] = useState(() => loadLS(LS.lots, []));
  const [animals, setAnimals] = useState(() => loadLS(LS.animals, []));
  const [weighs, setWeighs] = useState(() => loadLS(LS.weighs, {})); // { EAR: [{date,kg}] }
  const [opsLog, setOpsLog] = useState(() => loadLS(LS.log, []));
  const [health, setHealth] = useState(() => loadLS(LS.health, {})); // dados extras (idade, prenhez, vacinas)
  const [pendingData, setPendingData] = useState(null);

  useEffect(() => saveLS(LS.lots, lots), [lots]);
  useEffect(() => saveLS(LS.animals, animals), [animals]);
  useEffect(() => saveLS(LS.weighs, weighs), [weighs]);
  useEffect(() => saveLS(LS.log, opsLog), [opsLog]);
  useEffect(() => saveLS(LS.health, health), [health]);

  const lastOp = useMemo(() => {
    return Array.isArray(opsLog) && opsLog.length ? opsLog[0] : null;
  }, [opsLog]);

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

  // --- Export CSV (Log) — centro de confianca
  const exportLogCsv = () => {
    try {
      const rows = [["id","tipo","brinco","kg","data","destino","motivo","flag"]];
      const list = Array.isArray(opsLog) ? opsLog.slice().reverse() : [];
      for (const it of list) {
        rows.push([
          it?.id || "",
          it?.type || "",
          it?.ear || "",
          (it?.kg ?? ""),
          it?.date || "",
          it?.to || "",
          it?.reason || "",
          it?.flag || ""
        ]);
      }
      const csv = toCsv(rows);
      downloadText(`rebanho_log_${todayIso()}.csv`, csv, "text/csv;charset=utf-8");
    } catch (e) {
      console.warn("exportLogCsv falhou", e);
    }
  };

  const activeAnimals = useMemo(() => {
    return (Array.isArray(animals) ? animals : []).filter((a) => a.status !== "inactive");
  }, [animals]);

  const totalPesoVivoKg = useMemo(() => {
    return activeAnimals.reduce((sum, a) => {
      const kg = Number(a?.lastWeightKg);
      return Number.isFinite(kg) && kg > 0 ? sum + kg : sum;
    }, 0);
  }, [activeAnimals]);

  const totalArrobas = useMemo(() => totalPesoVivoKg / 15, [totalPesoVivoKg]);

  // -----------------------------
  // Navegação interna (subtabs)
  // -----------------------------
  const [tab, setTab] = useState(() =>
    String(mode || "").toLowerCase() === "vaqueiro" ? "operate" : "dashboard"
  );
  const [opSub, setOpSub] = useState("basic"); // basic | curral | lista
  const [lotsSearch, setLotsSearch] = useState("");
  const [lotsCategory, setLotsCategory] = useState("ALL");
  const [lotsCostMonth, setLotsCostMonth] = useState(() => currentMonthKey());
  const [lotsIncludeInvestment, setLotsIncludeInvestment] = useState(false);
  const [lotsCostMeta, setLotsCostMeta] = useState(() => ({
    month: currentMonthKey(),
    includeInvestment: false,
    unallocated: { animals: 0, purchase: 0, nutrition: 0 },
  }));

  // -----------------------------
  // Log (centro de confiança)
  // -----------------------------
  const [logRange, setLogRange] = useState("today"); // today | 7d | all | pending
  const [logType, setLogType] = useState("ALL"); // ALL | weigh | move | baixa
  const [logSearch, setLogSearch] = useState("");
  const [pendingFocus, setPendingFocus] = useState("ALL"); // ALL | SUSPECT | NOWEIGH | STALE | VACCINE

  // -----------------------------
  // Onboarding signals (auto-detect)
  // -----------------------------
  useEffect(() => {
    try {
      localStorage.setItem("fazenda_onb_seen_herd_v1", "1");
      window.dispatchEvent(new Event("fazenda_onboarding_signal"));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (tab === "log") {
        localStorage.setItem("fazenda_onb_seen_log_v1", "1");
        window.dispatchEvent(new Event("fazenda_onboarding_signal"));
      }
    } catch {}
  }, [tab]);

  // -----------------------------
  // Operar (modo vaqueiro)
  // -----------------------------
  const earRef = useRef(null);
  const kgRef = useRef(null);
  const quickKgRef = useRef(null);
  const filaRef = useRef(null);

  const [earQ, setEarQ] = useState("");
  const [kgQ, setKgQ] = useState("");
  const [scannerFocus, setScannerFocus] = useState(true); // após ler brinco, ir direto pro peso (curral)
  const [confirmPeso, setConfirmPeso] = useState(null); // {ear,kg,date}
  const [repeatGuard, setRepeatGuard] = useState(true); // evita repetir pesagem por engano (2 min)
  const [lastWeigh, setLastWeigh] = useState(null); // {ear,ts}
  const [confirmRepeat, setConfirmRepeat] = useState(null); // {ear,kg,date,prevTs}
  const [curralDayOpen, setCurralDayOpen] = useState(false);
  const [curralDayFieldMode, setCurralDayFieldMode] = useState(true);
  const [curralDayEar, setCurralDayEar] = useState("");
  const [curralDayKg, setCurralDayKg] = useState("");
  const [curralDayDate, setCurralDayDate] = useState(() => todayIso());
  const [curralDayMsg, setCurralDayMsg] = useState("");
  const [curralDayLast, setCurralDayLast] = useState(null); // { ear, prevKg, newKg, date }
  const [curralDayVac, setCurralDayVac] = useState(() => {
    const o = {};
    CURRAL_VACCINES.forEach((v) => { o[v.name] = false; });
    return o;
  });
  const curralDayEarRef = useRef(null);
  const curralDayKgRef = useRef(null);

  const [opDate, setOpDate] = useState(() => todayIso());
  const [destLotId, setDestLotId] = useState("__KEEP__");
  const [baixaMotivo, setBaixaMotivo] = useState("morte");
  const [opAdvancedOpen, setOpAdvancedOpen] = useState(false);
  const [opMsg, setOpMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const autoSyncRef = useRef(false);

// Feedback do curral (opcional): flash + som ao registrar
const [okFlashEnabled, setOkFlashEnabled] = useState(() => loadLS("faz_rebanho_flash_ok_v1", true));
const [okBeepEnabled, setOkBeepEnabled] = useState(() => loadLS("faz_rebanho_beep_ok_v1", false));
const [okPulseOn, setOkPulseOn] = useState(false);
const okPulseTimerRef = useRef(null);
const audioCtxRef = useRef(null);

useEffect(() => saveLS("faz_rebanho_flash_ok_v1", okFlashEnabled), [okFlashEnabled]);
useEffect(() => saveLS("faz_rebanho_beep_ok_v1", okBeepEnabled), [okBeepEnabled]);

useEffect(() => {
  return () => {
    try {
      if (okPulseTimerRef.current) clearTimeout(okPulseTimerRef.current);
    } catch {}
  };
}, []);

function playBeep(freq = 880, durationMs = 70, volume = 0.045) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = volume;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + durationMs / 1000);
  } catch {}
}

function pulseOk() {
  try {
    if (okFlashEnabled) {
      setOkPulseOn(true);
      if (okPulseTimerRef.current) clearTimeout(okPulseTimerRef.current);
      okPulseTimerRef.current = setTimeout(() => setOkPulseOn(false), 180);
    }
    if (okBeepEnabled) playBeep(880, 70, 0.045);
  } catch {}
}

  function focusEar(select = true) {
    requestAnimationFrame(() => {
      try {
        if (!earRef?.current) return;
        earRef.current.focus();
        if (select && typeof earRef.current.select === "function") earRef.current.select();
      } catch {}
    });
  }

  function focusKg(select = true) {
    requestAnimationFrame(() => {
      try {
        if (!kgRef?.current) return;
        kgRef.current.focus();
        if (select && typeof kgRef.current.select === "function") kgRef.current.select();
      } catch {}
    });
  }

  function focusFila() {
    requestAnimationFrame(() => {
      try {
        if (!filaRef?.current) return;
        filaRef.current.focus();
      } catch {}
    });
  }

  function focusAfterEarInput() {
    if (opSub === "curral") {
      if (scannerFocus) focusKg(true);
      else focusEar(true);
      return;
    }
    focusKg(true);
  }


  // Cadastro rápido (quando brinco não existe)
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickCat, setQuickCat] = useState("BOI");
  const [quickSex, setQuickSex] = useState("M");
  const [quickLotId, setQuickLotId] = useState("");
  const earNorm = useMemo(() => normEar(earQ), [earQ]);


  // Ao abrir o cadastro rápido, focar no peso (curral)
  useEffect(() => {
    if (!quickAddOpen) return;
    requestAnimationFrame(() => {
      try {
        quickKgRef?.current?.focus();
        if (typeof quickKgRef?.current?.select === "function") quickKgRef.current.select();
      } catch {}
    });
  }, [quickAddOpen]);

  useEffect(() => {
    if (tab !== "operate") setQuickAddOpen(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== "operate" || quickAddOpen) return;
    if (opSub === "lista") {
      focusFila();
      return;
    }
    if (opSub === "curral" && earNorm) {
      focusAfterEarInput();
      return;
    }
    focusEar(false);
  }, [tab, opSub, quickAddOpen, earNorm, scannerFocus]);

  // Carregar lista de brincos (carga inicial)
  const [importOpen, setImportOpen] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [importLotId, setImportLotId] = useState("");
  const [importCat, setImportCat] = useState("BOI");
  const [importSex, setImportSex] = useState("M");
  const [importWeight, setImportWeight] = useState("");
  const [importDate, setImportDate] = useState(() => todayIso());
  const [importIgnoreExisting, setImportIgnoreExisting] = useState(true);
  const [importUseFileWeight, setImportUseFileWeight] = useState(false);
  const [importFileRows, setImportFileRows] = useState([]); // [{ ear, kg|null }]
  const [importMsg, setImportMsg] = useState("");
  const importFileRef = useRef(null);

  useEffect(() => {
    // Se limpar o brinco, fecha o cadastro rápido
    if (!normEar(earQ)) setQuickAddOpen(false);
  }, [earQ]);

  const kgNum = useMemo(() => parseFloatPt(kgQ), [kgQ]);
  const kgIsValid = Number.isFinite(kgNum) && kgNum > 0;

  useEffect(() => {
    try {
      const ear = normEar(earQ);
      if (ear && ear.length >= 2) {
        localStorage.setItem("fazenda_onb_signal_brinco_v1", "1");
        window.dispatchEvent(new Event("fazenda_onboarding_signal"));
      }
    } catch {}
  }, [earQ]);

  const animalExact = useMemo(() => {
    if (!earNorm) return null;
    return activeAnimals.find((a) => normEar(a.ear) === earNorm) || null;
  }, [activeAnimals, earNorm]);
  const curralDayAnimal = useMemo(() => {
    const ear = normEar(curralDayEar);
    if (!ear) return null;
    return activeAnimals.find((a) => normEar(a?.ear) === ear) || null;
  }, [activeAnimals, curralDayEar]);
  const curralDayAnimalHealth = useMemo(() => {
    const ear = normEar(curralDayEar);
    if (!ear) return null;
    const h = (health && typeof health === "object" ? health[ear] : null) || {};
    const vac = (h && typeof h.vac === "object" ? h.vac : {}) || {};
    return {
      vacName: vac.name || "",
      vacDate: vac.date || "",
    };
  }, [health, curralDayEar]);

  useEffect(() => { setConfirmPeso(null); setConfirmRepeat(null); }, [earQ]);
  useEffect(() => { setConfirmPeso(null); setConfirmRepeat(null); }, [kgQ]);

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

  function vacNextByName(name, dateIso) {
    const hit = CURRAL_VACCINES.find((v) => v.name === name);
    if (!hit || !dateIso) return "";
    return addDaysIso(dateIso, hit.nextDays || 0);
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
  // Cadastro rápido (curral)
  // - Se o brinco não existe, cadastra o básico e já libera a pesagem
  // -----------------------------
  function ensureLotIdForQuickAdd(preferred) {
    const pref = preferred != null ? Number(preferred) : NaN;
    const hasPref = Number.isFinite(pref);
    const list = Array.isArray(lotsSorted) ? lotsSorted : [];
    if (hasPref && list.some((l) => Number(l.id) === pref)) return pref;
    if (list.length) return Number(list[0].id);
    const id = 1;
    // cria uma manga padrão para não travar o curral
    setLots([{ id, name: "Manga 01" }]);
    return id;
  }

  async function persistLotsBatch(lotRows) {
    const rows = (Array.isArray(lotRows) ? lotRows : [])
      .map((row) => ({
        id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
        name: String(row?.name || "").trim(),
        category: String(row?.category || "").trim().toUpperCase(),
        area_name: String(row?.areaName || row?.area_name || "").trim(),
        heads: Number.isFinite(Number(row?.heads)) ? Number(row.heads) : undefined,
      }))
      .filter((row) => row.name);
    if (!rows.length) return [];
    const res = await api.post("/herd/lots/upsert-batch", { lots: rows });
    return Array.isArray(res?.lots) ? res.lots : [];
  }

  async function persistAnimalsBatch(animalRows, createWeighings = true) {
    const rows = (Array.isArray(animalRows) ? animalRows : [])
      .map((row) => {
        const payload = {
          ear_tag: normEar(row?.ear_tag || row?.ear),
          sex: String(row?.sex || "").trim().toUpperCase(),
          category: String(row?.category || "").trim().toUpperCase(),
          lot_id: Number.isFinite(Number(row?.lot_id ?? row?.lotId)) ? Number(row?.lot_id ?? row?.lotId) : null,
          area_name: String(row?.area_name || row?.areaName || "").trim(),
          status: String(row?.status || "active").trim().toLowerCase(),
        };
        const lastWeight = Number(row?.last_weight_kg ?? row?.lastWeightKg);
        if (Number.isFinite(lastWeight) && lastWeight > 0) payload.last_weight_kg = lastWeight;
        const lastDate = String(row?.last_weighed_at || row?.lastWeighedAt || "").trim();
        if (lastDate) payload.last_weighed_at = lastDate;
        if (row?.profile && typeof row.profile === "object") payload.profile = row.profile;
        return payload;
      })
      .filter((row) => row.ear_tag);
    if (!rows.length) return [];
    const res = await api.post("/herd/animals/upsert-batch", {
      animals: rows,
      create_weighings: !!createWeighings,
    });
    return Array.isArray(res?.animals) ? res.animals : [];
  }

  async function loadBackendActivity(limit = 120) {
    const res = await api.get(`/herd/activity?limit=${Number(limit) || 120}`);
    const items = Array.isArray(res?.items) ? res.items : [];
    setOpsLog((prev) => mergeActivityLogs(items, prev));
    return items;
  }

  function applyPendingSnapshot(raw) {
    const counts = raw?.counts && typeof raw.counts === "object" ? raw.counts : {};
    const suspectWeighs = Array.isArray(raw?.suspect_weighs) ? raw.suspect_weighs : [];
    const noWeigh = Array.isArray(raw?.no_weigh) ? raw.no_weigh : [];
    const staleWeigh = Array.isArray(raw?.stale_weigh) ? raw.stale_weigh : [];
    const overdueVaccine = Array.isArray(raw?.overdue_vaccine) ? raw.overdue_vaccine : [];
    const snapshot = {
      counts: {
        suspectWeighs: Number(counts?.suspect_weighs || suspectWeighs.length || 0),
        noWeigh: Number(counts?.no_weigh || noWeigh.length || 0),
        staleWeigh: Number(counts?.stale_weigh || staleWeigh.length || 0),
        overdueVaccine: Number(counts?.overdue_vaccine || overdueVaccine.length || 0),
        operationalTotal: Number(
          counts?.operational_total ||
          Number(counts?.suspect_weighs || suspectWeighs.length || 0) +
          Number(counts?.no_weigh || noWeigh.length || 0) +
          Number(counts?.stale_weigh || staleWeigh.length || 0)
        ),
      },
      suspectWeighs,
      noWeigh,
      staleWeigh,
      overdueVaccine,
      staleDays: Number(raw?.stale_days || 60),
    };
    setPendingData(snapshot);
    return snapshot;
  }

  async function loadBackendPending(limit = 30, staleDays = 60) {
    const res = await api.get(`/herd/pending?limit=${Number(limit) || 30}&stale_days=${Number(staleDays) || 60}`);
    return applyPendingSnapshot(res);
  }

  function openQuickAdd() {
    const ear = earNorm;
    if (!ear) {
      setOpMsg("Informe o brinco.");
      return;
    }

    const preferredLot = destLotId && destLotId !== "__KEEP__" ? destLotId : null;
    const lotId = ensureLotIdForQuickAdd(preferredLot);

    setQuickLotId(String(lotId));
    setQuickCat("BOI");
    setQuickSex("M");
    setQuickAddOpen(true);
    requestAnimationFrame(() => {
      try {
        if (quickKgRef?.current) quickKgRef.current.focus();
      } catch {}
    });
  }

  function openCurralDay() {
    const ear = earNorm || "";
    setCurralDayOpen(true);
    setCurralDayEar(ear);
    setCurralDayKg("");
    setCurralDayDate(opDate || todayIso());
    setCurralDayMsg("");
    setCurralDayLast(null);
    setCurralDayVac(() => {
      const o = {};
      CURRAL_VACCINES.forEach((v) => { o[v.name] = false; });
      return o;
    });
  }

  useEffect(() => {
    if (!curralDayOpen) return;
    requestAnimationFrame(() => {
      try {
        if (!curralDayEarRef?.current) return;
        curralDayEarRef.current.focus();
        if (typeof curralDayEarRef.current.select === "function") curralDayEarRef.current.select();
      } catch {}
    });
  }, [curralDayOpen]);

  async function quickAddAnimal() {
    const ear = earNorm;
    if (!ear) {
      setOpMsg("Informe o brinco.");
      return;
    }

    const lotIdNum = Number(quickLotId);
    const lotId = Number.isFinite(lotIdNum) && lotIdNum > 0 ? lotIdNum : ensureLotIdForQuickAdd(null);
    const lotName = lotLabelById(lotId);

    try {
      await persistLotsBatch([{ id: lotId, name: lotName }]);
      await persistAnimalsBatch(
        [
          {
            ear_tag: ear,
            sex: quickSex,
            category: quickCat,
            lot_id: lotId,
            status: "active",
          },
        ],
        false,
      );
    } catch (e) {
      setOpMsg(`Falha ao cadastrar no backend: ${e?.message || "erro desconhecido"}`);
      return;
    }

    // Upsert (se já existia inativo, reativa)
    setAnimals((prev) => {
      const list = Array.isArray(prev) ? prev.slice() : [];
      const i = list.findIndex((x) => normEar(x.ear) === ear);
      const patch = {
        ear,
        sex: quickSex,
        category: quickCat,
        lotId,
        status: "active",
      };
      if (i >= 0) {
        list[i] = { ...list[i], ...patch };
        return list;
      }
      list.unshift({
        ...patch,
        lastWeightKg: null,
        lastWeighedAt: null,
      });
      return list;
    });

    pushLog({
      id: uid("c"),
      type: "cad",
      ear,
      kg: null,
      date: opDate || todayIso(),
      to: lotName,
      reason: `${quickCat}${quickSex ? `/${quickSex}` : ""}`,
    });

    setQuickAddOpen(false);
    setOpMsg(`✅ ${ear} cadastrado. Pode registrar o peso.`);
    focusKg(true);
  }


  async function quickAddAndWeigh() {
    const ear = earNorm;
    if (!ear) {
      setOpMsg("Informe o brinco.");
      return;
    }

    const kg = kgNum;
    if (!Number.isFinite(kg) || kg <= 0) {
      setOpMsg("Peso inválido.");
      return;
    }

    const dateIso = opDate || todayIso();

    // Confirmação para valores fora do intervalo típico
    const inRange = kg >= 80 && kg <= 900;
    const alreadyConfirmed =
      confirmPeso &&
      confirmPeso.ear === ear &&
      Number(confirmPeso.kg) === Number(kg) &&
      confirmPeso.date === dateIso;

    if (!inRange && !alreadyConfirmed) {
      setConfirmPeso({ ear, kg, date: dateIso });
      setOpMsg(`⚠️ Peso fora do padrão (${Math.round(kg)} kg). Confirme.`);
      return;
    }

    const lotIdNum = Number(quickLotId);
    const lotId = Number.isFinite(lotIdNum) && lotIdNum > 0 ? lotIdNum : ensureLotIdForQuickAdd(null);
    const lotName = lotLabelById(lotId);

    try {
      await persistLotsBatch([{ id: lotId, name: lotName }]);
      await persistAnimalsBatch(
        [
          {
            ear_tag: ear,
            sex: quickSex,
            category: quickCat,
            lot_id: lotId,
            status: "active",
            last_weight_kg: kg,
            last_weighed_at: dateIso,
          },
        ],
        true,
      );
    } catch (e) {
      setOpMsg(`Falha ao cadastrar/pesar no backend: ${e?.message || "erro desconhecido"}`);
      return;
    }

    // Upsert animal já com última pesagem
    setAnimals((prev) => {
      const list = Array.isArray(prev) ? prev.slice() : [];
      const i = list.findIndex((x) => normEar(x.ear) === ear);
      const patch = {
        ear,
        sex: quickSex,
        category: quickCat,
        lotId,
        status: "active",
        lastWeightKg: kg,
        lastWeighedAt: dateIso,
      };
      if (i >= 0) {
        list[i] = { ...list[i], ...patch };
        return list;
      }
      list.unshift(patch);
      return list;
    });

    appendWeigh(ear, dateIso, kg);

    // registra cadastro + pesagem no Caderno de Campo
    pushLog({
      id: uid("c"),
      type: "cad",
      ear,
      kg: null,
      date: dateIso,
      to: lotName,
      reason: `${quickCat}${quickSex ? `/${quickSex}` : ""}`,
    });

    pushLog({
      id: uid("w"),
      type: "weigh",
      ear,
      kg,
      date: dateIso,
      to: null,
      flag: inRange ? null : "out_of_range",
    });

    try {
      setLastWeigh({ ear, ts: Date.now() });
    } catch {}

    setQuickAddOpen(false);
    setOpMsg(`✅ ${ear} cadastrado e pesado. Próximo brinco?`);
    pulseOk();
    afterRegisterAdvance();
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
      focusAfterEarInput();
    } else {
      setOpMsg("Cole a lista de brincos.");
      focusFila();
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
    focusAfterEarInput();
  }

  function afterRegisterAdvance() {
    setKgQ("");
    if (filaIsOn && filaIdx < filaTotal - 1) {
      const next = filaIdx + 1;
      setFilaIdx(next);
      setEarQ(fila[next] || "");
      focusAfterEarInput();
      return;
    }
    // sai do modo fila
    setEarQ("");
    focusEar(false);
  }

  async function registerWeigh() {
    setOpMsg("");
    if (!animalExact) {
      const ear = earNorm;
      if (!ear) {
        setOpMsg("Informe o brinco.");
        return;
      }
      setOpMsg(`${ear} não cadastrado. Abra cadastro rápido.`);
      openQuickAdd();
      return;
    }
    const kg = parseFloatPt(kgQ);

if (!Number.isFinite(kg) || kg <= 0) {
  setOpMsg("Peso inválido.");
  return;
}

const dateIso = opDate || todayIso();

// Evitar repetir pesagem por engano (curral)
const nowTs = Date.now();
const recentSame =
  repeatGuard &&
  lastWeigh &&
  normEar(lastWeigh.ear) === normEar(animalExact?.ear || "") &&
  (nowTs - Number(lastWeigh.ts || 0)) < 120000;

const alreadyRepeatConfirmed =
  confirmRepeat &&
  confirmRepeat.ear === (animalExact?.ear || "") &&
  Number(confirmRepeat.kg) === Number(kg) &&
  confirmRepeat.date === dateIso &&
  Number(confirmRepeat.prevTs || 0) === Number(lastWeigh?.ts || 0);

if (recentSame && !alreadyRepeatConfirmed) {
  setConfirmRepeat({ ear: animalExact?.ear || "", kg, date: dateIso, prevTs: lastWeigh?.ts || 0 });
  setOpMsg("⚠️ Brinco já pesado agora. Enter novamente para confirmar.");
  return;
}


// Confirmação para valores fora do intervalo típico
const inRange = kg >= 80 && kg <= 900;
const alreadyConfirmed =
  confirmPeso &&
  confirmPeso.ear === (animalExact?.ear || "") &&
  Number(confirmPeso.kg) === Number(kg) &&
  confirmPeso.date === dateIso;

if (!inRange && !alreadyConfirmed) {
  setConfirmPeso({ ear: animalExact?.ear || "", kg, date: dateIso });
  setOpMsg(`⚠️ Peso fora do padrão (${kg} kg). Enter novamente para confirmar.`);
  return;
}
    try {
      await api.post("/herd/weighings", {
        ear_tag: animalExact.ear,
        weight_kg: kg,
        weighed_at: startOfDayIso(dateIso),
        note: "operar",
      });
      await loadBackendActivity();
      await loadBackendPending();
    } catch (e) {
      setOpMsg(`Falha ao registrar pesagem: ${e?.message || "erro desconhecido"}`);
      return;
    }

    appendWeigh(animalExact.ear, dateIso, kg);
    updateAnimal(animalExact.ear, { lastWeightKg: kg, lastWeighedAt: dateIso });

    setLastWeigh({ ear: animalExact.ear, ts: nowTs });
    setConfirmRepeat(null);

    setOpMsg("✅ Pesagem registrada. Próximo brinco?");
    pulseOk();
    afterRegisterAdvance();
  }

  async function applyCurralDay() {
    const ear = normEar(curralDayEar);
    if (!ear) {
      setCurralDayMsg("Informe o número do gado (brinco).");
      return;
    }

    const animal = activeAnimals.find((a) => normEar(a?.ear) === ear) || null;
    if (!animal) {
      setCurralDayMsg(`${ear} não cadastrado. Faça cadastro rápido antes de pesar no curral.`);
      return;
    }

    const kg = parseFloatPt(curralDayKg);
    if (!Number.isFinite(kg) || kg <= 0) {
      setCurralDayMsg("Informe um peso novo válido.");
      return;
    }

    const dateIso = curralDayDate || todayIso();
    const selectedVac = CURRAL_VACCINES.map((v) => v.name).filter((name) => !!curralDayVac[name]);
    const healthPayload = selectedVac.map((name) => ({
      kind: "vaccine",
      code: String(name || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
      name,
      dose: "",
      batch: "",
      note: "dia_curral",
    }));
    const currentHealth = healthFor(ear);
    try {
      await api.post("/herd/weighings", {
        ear_tag: ear,
        weight_kg: kg,
        weighed_at: startOfDayIso(dateIso),
        note: "dia_curral",
        health: healthPayload,
      });

      if (selectedVac.length) {
        const firstVac = selectedVac[0];
        const nextIso = vacNextByName(firstVac, dateIso);
        const profileRes = await api.patch(`/herd/animals/${encodeURIComponent(ear)}/profile`, {
          birth: currentHealth.birth || "",
          preg_status: currentHealth.pregStatus || "ND",
          preg_start: currentHealth.pregStart || "",
          note: currentHealth.note || "",
          vac_name: firstVac,
          vac_date: dateIso,
          vac_next: nextIso || "",
          sheet: currentHealth.sheet || {},
        });
        const savedProfile = profileRes?.profile && typeof profileRes.profile === "object" ? profileRes.profile : null;
        if (savedProfile) {
          setHealth((prev) => {
            const p = prev && typeof prev === "object" ? prev : {};
            return {
              ...p,
              [ear]: profileToHealthState(savedProfile, p[ear]),
            };
          });
        }
      }
      await loadBackendActivity();
      await loadBackendPending();
    } catch (e) {
      setCurralDayMsg(`Falha ao registrar no backend: ${e?.message || "erro desconhecido"}`);
      return;
    }

    appendWeigh(ear, dateIso, kg);
    updateAnimal(ear, { lastWeightKg: kg, lastWeighedAt: dateIso });

    if (selectedVac.length) {
      setHealth((prev) => {
        const p = prev && typeof prev === "object" ? prev : {};
        const prevEar = p[ear] && typeof p[ear] === "object" ? p[ear] : {};
        const prevVac = prevEar.vac && typeof prevEar.vac === "object" ? prevEar.vac : {};
        const prevHist = Array.isArray(prevEar.vacHistory) ? prevEar.vacHistory.slice() : [];
        const firstVac = selectedVac[0];
        const nextIso = vacNextByName(firstVac, dateIso);
        const hist = [{ date: dateIso, items: selectedVac }, ...prevHist].slice(0, 60);
        return {
          ...p,
          [ear]: {
            ...prevEar,
            vac: {
              ...prevVac,
              name: firstVac,
              date: dateIso,
              next: nextIso || prevVac.next || "",
            },
            vacHistory: hist,
            updatedAt: dateIso,
          },
        };
      });
    }

    setLastWeigh({ ear, ts: Date.now() });
    setCurralDayLast({ ear, prevKg: animal?.lastWeightKg, newKg: kg, date: dateIso });
    setOpMsg(`✅ Dia do curral: ${ear} registrado (${fmtKg(animal?.lastWeightKg)} → ${fmtKg(kg)}).`);
    pulseOk();
    setEarQ("");
    setKgQ("");
    focusEar(false);

    if (curralDayFieldMode) {
      setCurralDayMsg(`✅ ${ear} registrado. Próximo brinco.`);
      setCurralDayEar("");
      setCurralDayKg("");
      requestAnimationFrame(() => {
        try {
          if (!curralDayEarRef?.current) return;
          curralDayEarRef.current.focus();
          if (typeof curralDayEarRef.current.select === "function") curralDayEarRef.current.select();
        } catch {}
      });
      return;
    }

    setCurralDayOpen(false);
    setCurralDayMsg("");
    setCurralDayEar("");
    setCurralDayKg("");
  }

  async function registerMoveLocal() {
    setOpMsg("");
    if (!animalExact) {
      setOpMsg("Brinco inválido.");
      return;
    }
    if (destLotId === "__KEEP__") {
      setOpMsg("Selecione a manga destino.");
      return;
    }
    const toId = Number(destLotId);
    const toName = lotLabelById(toId);

    try {
      await api.post("/herd/move", {
        from_lot_id: Number.isFinite(Number(animalExact?.lotId)) ? Number(animalExact.lotId) : null,
        to_lot_id: toId,
        ear_tags: [animalExact.ear],
        reason: "operar",
      });
      await loadBackendActivity();
      await loadBackendPending();
    } catch (e) {
      setOpMsg(`Falha ao mover animal: ${e?.message || "erro desconhecido"}`);
      return;
    }

    updateAnimal(animalExact.ear, { lotId: toId });

    setOpMsg(`✅ Movido para ${toName}. Próximo brinco?`);
    pulseOk();
    setDestLotId("__KEEP__");
    setEarQ("");
    focusEar(false);
  }

  function openTransferScreen() {
    if (!onTransfer || typeof onTransfer !== "function") {
      setOpMsg("Transferências indisponível.");
      return;
    }
    if (!animalExact) {
      setOpMsg("Brinco inválido.");
      return;
    }
    if (destLotId === "__KEEP__") {
      setOpMsg("Selecione a manga destino.");
      return;
    }
    onTransfer({
      mode: "animal",
      earTags: [animalExact.ear],
      toLotId: Number(destLotId),
      notes: `Mover ${animalExact.ear} para ${lotLabelById(Number(destLotId))}`,
    });
  }

  async function baixaAnimal() {
    setOpMsg("");
    if (!animalExact) {
      setOpMsg("Brinco inválido.");
      return;
    }
    try {
      await api.post(`/herd/animals/${encodeURIComponent(animalExact.ear)}/baixa`, {
        kind: baixaMotivo,
        occurred_at: startOfDayIso(opDate || todayIso()),
        weight_kg: Number.isFinite(Number(animalExact?.lastWeightKg)) ? Number(animalExact.lastWeightKg) : null,
      });
      await loadBackendActivity();
      await loadBackendPending();
    } catch (e) {
      setOpMsg(`Falha ao registrar baixa: ${e?.message || "erro desconhecido"}`);
      return;
    }
    updateAnimal(animalExact.ear, { status: "inactive" });
    setOpMsg("✅ Baixa registrada. Próximo brinco?");
    pulseOk();
    setEarQ("");
    focusEar(false);
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

  const dashboardSummary = useMemo(() => {
    let female = 0;
    let prenha = 0;
    let vazia = 0;
    let noPasto = 0;

    const byLot = new Map();
    for (const a of activeAnimals) {
      const isFemale = String(a?.sex || "").toUpperCase() === "F";
      if (isFemale) {
        female += 1;
        const h = healthFor(a?.ear);
        const preg = String(h?.pregStatus || "ND").toUpperCase();
        if (preg === "PRENHA") prenha += 1;
        if (preg === "VAZIA") vazia += 1;
      }

      const lotId = Number(a?.lotId);
      if (Number.isFinite(lotId) && lotId > 0) {
        noPasto += 1;
        const key = String(lotId);
        byLot.set(key, (byLot.get(key) || 0) + 1);
      }
    }

    const lotRows = Array.from(byLot.entries())
      .map(([lotId, heads]) => ({
        lotId: Number(lotId),
        lotName: lotLabelById(Number(lotId)),
        heads,
      }))
      .sort((a, b) => b.heads - a.heads)
      .slice(0, 8);

    return {
      total: activeAnimals.length,
      totalArrobas,
      totalPesoVivoKg,
      female,
      prenha,
      vazia,
      noPasto,
      semPasto: Math.max(0, activeAnimals.length - noPasto),
      lotRows,
    };
  }, [activeAnimals, totalArrobas, totalPesoVivoKg, health, lots]);

  const reproductiveSummary = useMemo(() => {
    const byLot = new Map();
    let matrices = 0;
    let prenhas = 0;
    let vazias = 0;
    let paridas = 0;
    let semInfo = 0;

    for (const a of Array.isArray(activeAnimals) ? activeAnimals : []) {
      const sex = normalizeSexValue(a?.sex);
      if (sex !== "F") continue;

      matrices += 1;
      const h = healthFor(a?.ear);
      const preg = String(h?.pregStatus || "ND").toUpperCase();
      const situacaoTexto = String(h?.sheet?.situacaoReprodutiva || "").trim().toUpperCase();
      const isParida = situacaoTexto.includes("PARIDA");
      const lotId = Number(a?.lotId);
      const lotKey = Number.isFinite(lotId) && lotId > 0 ? String(lotId) : "0";
      const current = byLot.get(lotKey) || {
        lotId: Number.isFinite(lotId) && lotId > 0 ? lotId : 0,
        lotName: Number.isFinite(lotId) && lotId > 0 ? lotLabelById(lotId) : "Sem lote",
        matrices: 0,
        prenhas: 0,
        vazias: 0,
        paridas: 0,
        semInfo: 0,
      };
      current.matrices += 1;

      if (isParida) {
        paridas += 1;
        current.paridas += 1;
      }

      if (preg === "PRENHA") {
        prenhas += 1;
        current.prenhas += 1;
      } else if (preg === "VAZIA") {
        vazias += 1;
        current.vazias += 1;
      } else {
        semInfo += 1;
        current.semInfo += 1;
      }

      byLot.set(lotKey, current);
    }

    const taxaPrenhez = matrices > 0 ? (prenhas / matrices) * 100 : 0;
    const taxaVazias = matrices > 0 ? (vazias / matrices) * 100 : 0;
    const rows = Array.from(byLot.values())
      .map((row) => ({
        ...row,
        taxaPrenhez: row.matrices > 0 ? (row.prenhas / row.matrices) * 100 : 0,
        taxaVazias: row.matrices > 0 ? (row.vazias / row.matrices) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.vazias !== a.vazias) return b.vazias - a.vazias;
        if (b.matrices !== a.matrices) return b.matrices - a.matrices;
        return String(a.lotName).localeCompare(String(b.lotName), "pt-BR");
      })
      .slice(0, 8);

    return {
      matrices,
      prenhas,
      vazias,
      paridas,
      semInfo,
      taxaPrenhez,
      taxaVazias,
      rows,
    };
  }, [activeAnimals, health]);

  const herdRiskSummary = useMemo(() => {
    let clinicalAttention = 0;
    let clinicalTreatment = 0;
    let clinicalDiscard = 0;
    let lowBodyScore = 0;
    let overdueVaccine = 0;
    let semStatus = 0;
    let vazias = 0;
    const animals = [];

    for (const a of Array.isArray(activeAnimals) ? activeAnimals : []) {
      const h = healthFor(a?.ear);
      const sheet = h?.sheet && typeof h.sheet === "object" ? h.sheet : {};
      const clinicalStatus = String(sheet?.clinicalStatus || "ESTAVEL").toUpperCase();
      const bodyScore = Number(sheet?.bodyScore);
      const pregStatus = String(h?.pregStatus || "ND").toUpperCase();
      const vacOverdue = !!(h?.vacNext && isoBefore(h.vacNext, todayIso()));
      const lowScore = Number.isFinite(bodyScore) && bodyScore < 2.5;

      if (clinicalStatus === "ATENCAO") clinicalAttention += 1;
      if (clinicalStatus === "TRATAMENTO") clinicalTreatment += 1;
      if (clinicalStatus === "DESCARTE") clinicalDiscard += 1;
      if (lowScore) lowBodyScore += 1;
      if (vacOverdue) overdueVaccine += 1;
      if (pregStatus === "ND") semStatus += 1;
      if (pregStatus === "VAZIA") vazias += 1;

      const reasons = [];
      if (clinicalStatus !== "ESTAVEL") reasons.push(`Clínica ${asText(sheet?.clinicalStatus || clinicalStatus)}`);
      if (lowScore) reasons.push(`Escore ${bodyScore.toFixed(1)}`);
      if (vacOverdue) reasons.push(`Vacina vence/venceu em ${fmtDateShort(h.vacNext)}`);
      if (pregStatus === "ND") reasons.push("Sem status reprodutivo");
      if (pregStatus === "VAZIA") reasons.push("Matriz vazia");

      if (reasons.length) {
        const priority =
          (clinicalStatus === "DESCARTE" ? 40 : 0) +
          (clinicalStatus === "TRATAMENTO" ? 30 : 0) +
          (clinicalStatus === "ATENCAO" ? 20 : 0) +
          (vacOverdue ? 15 : 0) +
          (lowScore ? 12 : 0) +
          (pregStatus === "VAZIA" ? 8 : 0) +
          (pregStatus === "ND" ? 6 : 0);
        animals.push({
          ear: String(a?.ear || ""),
          lot: animalLotLabel(a),
          priority,
          reasons,
        });
      }
    }

    animals.sort((x, y) => y.priority - x.priority || String(x.ear).localeCompare(String(y.ear), "pt-BR"));

    return {
      clinicalAttention,
      clinicalTreatment,
      clinicalDiscard,
      lowBodyScore,
      overdueVaccine,
      semStatus,
      vazias,
      animals: animals.slice(0, 6),
    };
  }, [activeAnimals, health]);

  const lotCategories = useMemo(() => {
    const set = new Set();
    lotsSorted.forEach((l) => {
      const c = String(l?.category || "").trim().toUpperCase();
      if (c) set.add(c);
    });
    activeAnimals.forEach((a) => {
      const c = String(a?.category || "").trim().toUpperCase();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lotsSorted, activeAnimals]);

  const lotsTableRows = useMemo(() => {
    const byLot = new Map();
    lotsSorted.forEach((l) => byLot.set(Number(l.id), []));
    activeAnimals.forEach((a) => {
      const lid = Number(a?.lotId);
      if (!Number.isFinite(lid) || lid <= 0) return;
      if (!byLot.has(lid)) byLot.set(lid, []);
      byLot.get(lid).push(a);
    });

    return Array.from(byLot.entries())
      .map(([lotId, animalsInLot]) => {
        const lot = lotById.get(Number(lotId)) || {};
        const name = String(lot?.name || lot?.label || `Lote ${lotId}`);
        const heads = animalsInLot.length;

        let totalWeightKg = 0;
        let withWeight = 0;
        for (const a of animalsInLot) {
          const kg = Number(a?.lastWeightKg);
          if (!Number.isFinite(kg) || kg <= 0) continue;
          totalWeightKg += kg;
          withWeight += 1;
        }
        const avgWeightKg = withWeight > 0 ? totalWeightKg / withWeight : null;
        const arrobas = totalWeightKg > 0 ? totalWeightKg / 15 : 0;

        const gmdValues = animalsInLot
          .map((a) => calcAnimalGmdFromHistory(a, weighs))
          .filter((v) => Number.isFinite(v));
        const gmdAvg = gmdValues.length
          ? gmdValues.reduce((sum, v) => sum + Number(v), 0) / gmdValues.length
          : null;

        const areaFromAnimal = animalsInLot.find((a) => String(a?.areaName || "").trim())?.areaName || "";
        const areaName = String(lot?.areaName || lot?.area_name || areaFromAnimal || "—");
        const category = String(
          lot?.category || animalsInLot.find((a) => String(a?.category || "").trim())?.category || "—"
        ).toUpperCase();

        const entryRaw =
          lot?.startedAt ||
          lot?.entryDate ||
          lot?.entry_date ||
          lot?.createdAt ||
          lot?.created_at ||
          "";
        let entryDate = fmtDateShort(entryRaw);
        if (entryDate === "—") {
          const dates = animalsInLot
            .map((a) => String(a?.lastWeighedAt || "").slice(0, 10))
            .filter(Boolean)
            .sort();
          entryDate = dates.length ? fmtDateShort(dates[0]) : "—";
        }

        const costAnimals = Number(lot?.costAnimals ?? lot?.cost_animals ?? 0);
        const costCom = Number(lot?.costCom ?? lot?.cost_purchase ?? lot?.custo_compras ?? 0);
        const costNutrition = Number(lot?.costNutrition ?? lot?.cost_nutrition ?? lot?.custo_nutricao ?? 0);
        const fixedCostTotal = (Number.isFinite(costCom) ? costCom : 0) + (Number.isFinite(costNutrition) ? costNutrition : 0);
        const fixedCostPerHead = heads > 0 ? fixedCostTotal / heads : null;
        const fixedCapExceeded = Number.isFinite(fixedCostPerHead) && Number(fixedCostPerHead) > FIXED_COST_CAP_PER_HEAD;

        return {
          lotId: Number(lotId),
          name,
          heads,
          category,
          entryDate,
          areaName,
          totalWeightKg,
          avgWeightKg,
          arrobas,
          gmdAvg,
          costAnimals: Number.isFinite(costAnimals) ? costAnimals : 0,
          costCom: Number.isFinite(costCom) ? costCom : 0,
          costNutrition: Number.isFinite(costNutrition) ? costNutrition : 0,
          fixedCostTotal,
          fixedCostPerHead,
          fixedCapExceeded,
        };
      })
      .sort((a, b) => b.heads - a.heads || String(a.name).localeCompare(String(b.name), "pt-BR"));
  }, [activeAnimals, lotById, lotsSorted, weighs]);

  const lotsRowsFiltered = useMemo(() => {
    const q = String(lotsSearch || "").trim().toLowerCase();
    return lotsTableRows.filter((r) => {
      if (lotsCategory !== "ALL" && String(r.category || "").toUpperCase() !== String(lotsCategory || "").toUpperCase()) {
        return false;
      }
      if (!q) return true;
      const bag = `${r.name} ${r.areaName} ${r.category}`.toLowerCase();
      return bag.includes(q);
    });
  }, [lotsTableRows, lotsSearch, lotsCategory]);

  const lotsKpis = useMemo(() => {
    const rows = lotsRowsFiltered.length ? lotsRowsFiltered : lotsTableRows;
    const totalHeads = rows.reduce((sum, r) => sum + Number(r?.heads || 0), 0);
    const totalWeightKg = rows.reduce((sum, r) => sum + Number(r?.totalWeightKg || 0), 0);
    const fixedCostTotal = rows.reduce((sum, r) => sum + Number(r?.fixedCostTotal || 0), 0);
    const avgWeightKg = totalHeads > 0 ? totalWeightKg / totalHeads : null;
    const fixedCostPerHeadAvg = totalHeads > 0 ? fixedCostTotal / totalHeads : null;
    const fixedCapExceededLots = rows.filter((r) => r?.fixedCapExceeded).length;
    const gmdRows = rows
      .map((r) => Number(r?.gmdAvg))
      .filter((v) => Number.isFinite(v));
    const gmdAvg = gmdRows.length ? gmdRows.reduce((sum, v) => sum + v, 0) / gmdRows.length : null;
    return {
      totalHeads,
      totalWeightKg,
      avgWeightKg,
      gmdAvg,
      totalArrobas: totalWeightKg / 15,
      fixedCostTotal,
      fixedCostPerHeadAvg,
      fixedCapExceededLots,
    };
  }, [lotsRowsFiltered, lotsTableRows]);

  const bovinosDash = useMemo(() => {
    const rows = (Array.isArray(lotsTableRows) ? lotsTableRows : []).map((r) => ({
      lotId: Number(r?.lotId || 0),
      name: String(r?.name || "Lote"),
      heads: Number(r?.heads || 0),
      totalWeightKg: Number(r?.totalWeightKg || 0),
      gmdAvg: Number.isFinite(Number(r?.gmdAvg)) ? Number(r.gmdAvg) : null,
    }));

    const semLoteAnimals = activeAnimals.filter((a) => {
      const lid = Number(a?.lotId);
      return !Number.isFinite(lid) || lid <= 0;
    });
    if (semLoteAnimals.length > 0) {
      const semWeightKg = semLoteAnimals.reduce((sum, a) => {
        const kg = Number(a?.lastWeightKg);
        return Number.isFinite(kg) && kg > 0 ? sum + kg : sum;
      }, 0);
      const semGmdVals = semLoteAnimals
        .map((a) => calcAnimalGmdFromHistory(a, weighs))
        .filter((v) => Number.isFinite(v));
      const semGmdAvg = semGmdVals.length
        ? semGmdVals.reduce((sum, v) => sum + Number(v), 0) / semGmdVals.length
        : null;
      rows.push({
        lotId: 0,
        name: "Sem lote",
        heads: semLoteAnimals.length,
        totalWeightKg: semWeightKg,
        gmdAvg: semGmdAvg,
      });
    }

    const rowsByPeso = rows
      .slice()
      .sort((a, b) => Number(b.totalWeightKg || 0) - Number(a.totalWeightKg || 0))
      .slice(0, 10);
    const rowsByHeads = rows
      .slice()
      .sort((a, b) => Number(b.heads || 0) - Number(a.heads || 0))
      .slice(0, 10);

    const maxPesoKg = rowsByPeso.reduce((m, r) => Math.max(m, Number(r.totalWeightKg || 0)), 0);
    const maxHeads = rowsByHeads.reduce((m, r) => Math.max(m, Number(r.heads || 0)), 0);

    const gmdAnimalVals = activeAnimals
      .map((a) => calcAnimalGmdFromHistory(a, weighs))
      .filter((v) => Number.isFinite(v));
    const gmdUltimoPeso = gmdAnimalVals.length
      ? gmdAnimalVals.reduce((sum, v) => sum + Number(v), 0) / gmdAnimalVals.length
      : null;

    const gmdLoteVals = rows
      .map((r) => Number(r?.gmdAvg))
      .filter((v) => Number.isFinite(v));
    const gmdMedioGeral = gmdLoteVals.length
      ? gmdLoteVals.reduce((sum, v) => sum + Number(v), 0) / gmdLoteVals.length
      : null;

    return {
      totalAnimais: activeAnimals.length,
      lotesComAnimais: rows.filter((r) => Number(r?.lotId) > 0 && Number(r?.heads) > 0).length,
      pesoTotalKg: totalPesoVivoKg,
      pesoMedioKg: activeAnimals.length > 0 ? totalPesoVivoKg / activeAnimals.length : null,
      pesoTotalArrobas: totalArrobas,
      gmdUltimoPeso,
      gmdMedioGeral,
      rowsByPeso,
      rowsByHeads,
      maxPesoKg,
      maxHeads,
    };
  }, [lotsTableRows, activeAnimals, weighs, totalPesoVivoKg, totalArrobas]);

  const lotsCapAlertRows = useMemo(() => {
    const rows = lotsRowsFiltered.length ? lotsRowsFiltered : lotsTableRows;
    return rows.filter((r) => r?.fixedCapExceeded);
  }, [lotsRowsFiltered, lotsTableRows]);

  const exportLotsCsv = () => {
    try {
      const rows = [
        ["Nome", "Animais Hoje", "Entrada na Area", "Area", "Peso Total (kg)", "Peso Medio (kg)", "Peso @", "Custo Animais", "Custo Compra", "Custo Nutricao", "Custo Fixo/Cabeca", "Status Teto 90"],
      ];
      lotsRowsFiltered.forEach((r) => {
        rows.push([
          r.name,
          r.heads,
          r.entryDate === "—" ? "" : r.entryDate,
          r.areaName,
          Number(r.totalWeightKg || 0).toFixed(2),
          Number(r.avgWeightKg || 0).toFixed(2),
          Number(r.arrobas || 0).toFixed(2),
          Number(r.costAnimals || 0).toFixed(2),
          Number(r.costCom || 0).toFixed(2),
          Number(r.costNutrition || 0).toFixed(2),
          Number(r.fixedCostPerHead || 0).toFixed(2),
          r.fixedCapExceeded ? "Acima" : "OK",
        ]);
      });
      const csv = toCsv(rows);
      downloadText(`rebanho_lotes_${todayIso()}.csv`, csv, "text/csv;charset=utf-8");
    } catch (e) {
      console.warn("exportLotsCsv falhou", e);
    }
  };

  // -----------------------------
  // Demo / limpar
  // -----------------------------
  async function seedDemo() {
    try {
      await api.post("/herd/seed-demo", {});
      await syncFromBackend(true, {
        allowEmptyReplace: true,
        month: lotsCostMonth,
        includeInvestment: lotsIncludeInvestment,
      });
      setOpMsg("✅ Demo carregado do backend.");
      setTab("dashboard");
      requestAnimationFrame(() => earRef?.current?.focus());
    } catch (e) {
      setOpMsg(`Falha ao carregar demo: ${e?.message || "erro desconhecido"}`);
    }
  }

  function clearLocalData() {
    setLots([]);
    setAnimals([]);
    setWeighs({});
    setOpsLog([]);
    setHealth({});
    setPendingData(null);
    try {
      localStorage.removeItem(LS.lots);
      localStorage.removeItem(LS.animals);
      localStorage.removeItem(LS.weighs);
      localStorage.removeItem(LS.log);
      localStorage.removeItem(LS.health);
      localStorage.removeItem("fazenda_pending_count_v1");
    } catch {}
    setOpMsg("Dados locais apagados.");
  }

  async function syncFromBackend(silent = false, opts = {}) {
    if (syncing) return;
    setSyncing(true);
    try {
      const monthParam =
        typeof opts?.month === "string" && /^\d{4}-\d{2}$/.test(String(opts.month))
          ? String(opts.month)
          : lotsCostMonth;
      const includeInv =
        typeof opts?.includeInvestment === "boolean" ? opts.includeInvestment : lotsIncludeInvestment;
      const lotsUrl = `/herd/lots?month=${encodeURIComponent(monthParam)}&include_investment=${includeInv ? "true" : "false"}`;

      const [lotsRes, animalsRes, activityRes, weighsRes, pendingRes] = await Promise.all([
        api.get(lotsUrl),
        api.get("/herd/animals?status=active&limit=1200"),
        api.get("/herd/activity?limit=120"),
        api.get("/herd/weighings-map?status=active&limit_per_animal=8&limit_animals=2000"),
        api.get("/herd/pending?limit=30&stale_days=60"),
      ]);

      const lotsIn = Array.isArray(lotsRes?.lots) ? lotsRes.lots : [];
      const animalsIn = Array.isArray(animalsRes?.animals) ? animalsRes.animals : [];

      const mappedLots = lotsIn.map((l) => ({
        id: Number(l.id),
        name: l.name || l.label || `Manga ${String(l.id).padStart(2, "0")}`,
        category: l.category || "",
        areaName: l.area_name || "",
        heads: Number(l.heads || 0),
        startedAt: l.started_at || l.entry_date || l.entry_at || l.created_at || "",
        costAnimals: Number(l.cost_animals_brl ?? l.cost_animals ?? l.custo_animais ?? 0),
        costCom: Number(l.cost_purchase_brl ?? l.cost_purchase ?? l.cost_compras ?? l.custo_compras ?? 0),
        costNutrition: Number(l.cost_nutrition_brl ?? l.cost_nutrition ?? l.custo_nutricao ?? 0),
      }));

      const mappedAnimals = animalsIn.map((a) => ({
        ear: a.ear_tag || a.ear || a.brinco || "",
        sex: a.sex || "",
        category: a.category || a.cat || "",
        lotId: Number(a.lot_id ?? a.lote_id ?? 0) || null,
        areaName: a.area_name || "",
        status: (a.status || "active").toLowerCase() === "active" ? "active" : "inactive",
        lastWeightKg: Number(a.last_weight_kg),
        lastWeighedAt: a.last_weighed_at || "",
        gmdKgDay: Number(a.gmd_kg_day ?? a.gmd),
      }));
      const mappedHealth = animalsIn.reduce((acc, a) => {
        const ear = normEar(a.ear_tag || a.ear || a.brinco || "");
        if (!ear) return acc;
        const profile = a.profile && typeof a.profile === "object"
          ? a.profile
          : {
              birth: a.birth_date || "",
              preg_status: a.preg_status || "ND",
              preg_start: a.preg_start_date || "",
              note: a.animal_note || "",
              vac_name: a.vac_name || "",
              vac_date: a.vac_date || "",
              vac_next: a.vac_next || "",
              sheet: a.sheet && typeof a.sheet === "object" ? a.sheet : {},
            };
        const hasProfileData = Boolean(
          profile.birth ||
          profile.preg_status ||
          profile.preg_start ||
          profile.note ||
          profile.vac_name ||
          profile.vac_date ||
          profile.vac_next ||
          (profile.sheet && Object.keys(profile.sheet).length)
        );
        if (!hasProfileData) return acc;
        acc[ear] = profile;
        return acc;
      }, {});
      const mappedWeighs = {};
      const rawWeighs = weighsRes?.weighs && typeof weighsRes.weighs === "object" ? weighsRes.weighs : {};
      Object.entries(rawWeighs).forEach(([earRaw, items]) => {
        const ear = normEar(earRaw);
        if (!ear) return;
        const rows = Array.isArray(items) ? items : [];
        mappedWeighs[ear] = rows
          .map((row) => ({
            date: String(row?.date || row?.weighed_at || "").slice(0, 10),
            kg: Number(row?.kg),
          }))
          .filter((row) => row.date && Number.isFinite(row.kg))
          .slice(0, 200);
      });

      const hasLocalAnimals = Array.isArray(animals) && animals.length > 0;
      const replaceWithEmpty =
        Boolean(opts?.allowEmptyReplace) || (Array.isArray(mappedAnimals) && mappedAnimals.length > 0);
      if (!replaceWithEmpty && hasLocalAnimals) {
        if (!silent) setOpMsg("Backend sem animais. Dados locais mantidos.");
        return;
      }

      setLots(mappedLots);
      setAnimals(mappedAnimals);
      setWeighs(mappedWeighs);
      setOpsLog((prev) => mergeActivityLogs(Array.isArray(activityRes?.items) ? activityRes.items : [], prev));
      setHealth((prev) => {
        const base = prev && typeof prev === "object" ? prev : {};
        const next = { ...base };
        Object.entries(mappedHealth).forEach(([ear, profile]) => {
          next[ear] = profileToHealthState(profile, base[ear]);
        });
        return next;
      });
      applyPendingSnapshot(pendingRes);
      setLotsCostMeta({
        month: String(lotsRes?.costs?.month || monthParam || currentMonthKey()),
        includeInvestment: Boolean(lotsRes?.costs?.include_investment ?? includeInv),
        unallocated: {
          animals: Number(lotsRes?.costs?.unallocated_brl?.animals || 0),
          purchase: Number(lotsRes?.costs?.unallocated_brl?.purchase || 0),
          nutrition: Number(lotsRes?.costs?.unallocated_brl?.nutrition || 0),
        },
      });

      if (!silent) setOpMsg(`✅ Rebanho sincronizado do backend (${mappedAnimals.length} animais).`);
    } catch (e) {
      if (!silent) setOpMsg(`Falha ao sincronizar backend: ${e?.message || "erro desconhecido"}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (autoSyncRef.current) return;
    autoSyncRef.current = true;
    syncFromBackend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // UI: Header (subtabs + actions)
  // -----------------------------
  const subtabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "operate", label: "Operar" },
    { key: "log", label: "Caderno de Campo" },
    { key: "lots", label: "Lotes" },
    { key: "overview", label: "Visão geral" },
    { key: "cadastro", label: "Cadastro geral" },
  ];

  const isVaqueiro = String(mode || "").toLowerCase() === "vaqueiro";
  const actions = [
    { key: "fieldday", label: "Dia de campo", variant: "primary" },
    { key: "pending", label: "Pendências", variant: "ghost" },
    { key: "sync", label: syncing ? "Sincronizando..." : "Sync backend", variant: "ghost" },
    ...(isVaqueiro ? [] : [{ key: "demo", label: "Demo", variant: "ghost" }]),
    ...(isVaqueiro ? [] : [{ key: "clear", label: "Limpar (local)", variant: "ghost" }]),
  ];

  function onAction(a) {
    const k = a?.key || a;
    if (k === "fieldday") {
      setTab("operate");
      setOpSub("curral");
      setOpAdvancedOpen(false);
      openCurralDay();
      return;
    }
    if (k === "pending") {
      goPending("ALL");
      return;
    }
    if (k === "sync") {
      syncFromBackend(false);
      return;
    }
    if (k === "demo") seedDemo();
    if (k === "clear") clearLocalData();
  }

  // -----------------------------
  // Cadastro geral (idade, prenhez, vacinas)
  // -----------------------------
  const [gSearch, setGSearch] = useState("");
  const [gCat, setGCat] = useState("ALL");
  const [gPreg, setGPreg] = useState("ALL"); // ALL | PRENHA | VAZIA | ND
  const [gVac, setGVac] = useState("ALL"); // ALL | DUE | MISSING

  const [editOpen, setEditOpen] = useState(false);
  const [editEar, setEditEar] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editPreg, setEditPreg] = useState("ND");
  const [editPregStart, setEditPregStart] = useState("");
  const [editVacName, setEditVacName] = useState("");
  const [editVacDate, setEditVacDate] = useState("");
  const [editVacNext, setEditVacNext] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editClinicalStatus, setEditClinicalStatus] = useState("ESTAVEL");
  const [editBodyScore, setEditBodyScore] = useState("");
  const [editLocomotionScore, setEditLocomotionScore] = useState("");
  const [editClinicalDate, setEditClinicalDate] = useState("");
  const [editClinicalNote, setEditClinicalNote] = useState("");
  const [editReproProtocol, setEditReproProtocol] = useState("");
  const [editTreatmentDate, setEditTreatmentDate] = useState("");
  const [editTreatmentReason, setEditTreatmentReason] = useState("");
  const [editTreatmentConduct, setEditTreatmentConduct] = useState("");
  const [editTreatmentObservation, setEditTreatmentObservation] = useState("");
  const [editView, setEditView] = useState("resumo");

  useEffect(() => {
    if (!editOpen) return;
    const onEsc = (evt) => {
      if (evt?.key === "Escape") setEditOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [editOpen]);

  // Compatibilidade: qualquer link antigo para "Animais" abre Cadastro geral.
  useEffect(() => {
    if (tab !== "animals") return;
    setTab("cadastro");
    setGSearch("");
    setGCat("ALL");
    setGPreg("ALL");
    setGVac("ALL");
  }, [tab]);

  function addDaysIso(iso, days) {
    try {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      d.setDate(d.getDate() + Number(days || 0));
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function dppIso(pregStartIso) {
    return addDaysIso(pregStartIso, 283);
  }

  function isoBefore(a, b) {
    try {
      if (!a || !b) return false;
      // ISO YYYY-MM-DD compara bem por string
      return String(a) < String(b);
    } catch {
      return false;
    }
  }

  function ageLabel(birthIso) {
    try {
      if (!birthIso) return "—";
      const b = new Date(birthIso);
      if (Number.isNaN(b.getTime())) return "—";
      const now = new Date();
      let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
      if (now.getDate() < b.getDate()) months -= 1;
      months = Math.max(0, months);
      const y = Math.floor(months / 12);
      const m = months % 12;
      if (y <= 0) return `${m}m`;
      if (m === 0) return `${y}a`;
      return `${y}a ${m}m`;
    } catch {
      return "—";
    }
  }

  function ageMonths(birthIso) {
    try {
      if (!birthIso) return null;
      const b = new Date(birthIso);
      if (Number.isNaN(b.getTime())) return null;
      const now = new Date();
      let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
      if (now.getDate() < b.getDate()) months -= 1;
      return Math.max(0, months);
    } catch {
      return null;
    }
  }

  function healthFor(ear) {
    const k = normEar(ear);
    const h = (health && typeof health === "object" ? health[k] : null) || {};
    const vac = (h && typeof h.vac === "object" ? h.vac : {}) || {};
    const sheet = (h && typeof h.sheet === "object" ? h.sheet : {}) || {};
    return {
      birth: h.birth || "",
      pregStatus: String(h.pregStatus || "ND").toUpperCase(),
      pregStart: h.pregStart || "",
      vacName: vac.name || "",
      vacDate: vac.date || "",
      vacNext: vac.next || "",
      note: h.note || "",
      sheet: {
        sexoLabel: asText(sheet.sexoLabel || ""),
        loteLabel: asText(sheet.loteLabel || ""),
        pesoArroba: numOrNull(sheet.pesoArroba),
        dataPeso: normalizeIsoDate(sheet.dataPeso || ""),
        gmdGeral: numOrNull(sheet.gmdGeral),
        categoriaLabel: asText(sheet.categoriaLabel || ""),
        raca: asText(sheet.raca || ""),
        idadeMeses: intOrNull(sheet.idadeMeses),
        situacaoReprodutiva: asText(sheet.situacaoReprodutiva || ""),
        numeroMae: asText(sheet.numeroMae || ""),
        clinicalStatus: asText(sheet.clinicalStatus || ""),
        clinicalDate: normalizeIsoDate(sheet.clinicalDate || ""),
        clinicalNote: asText(sheet.clinicalNote || ""),
        reproProtocol: asText(sheet.reproProtocol || ""),
        bodyScore: numOrNull(sheet.bodyScore),
        locomotionScore: numOrNull(sheet.locomotionScore),
        treatmentDate: normalizeIsoDate(sheet.treatmentDate || ""),
        treatmentReason: asText(sheet.treatmentReason || ""),
        treatmentConduct: asText(sheet.treatmentConduct || ""),
        treatmentObservation: asText(sheet.treatmentObservation || ""),
      },
    };
  }

  function pregLabel(h) {
    const st = String(h?.pregStatus || "ND").toUpperCase();
    if (st === "VAZIA") return "Vazia";
    if (st === "PRENHA") {
      const ds = daysSinceIso(h?.pregStart);
      const dpp = h?.pregStart ? addDaysIso(h.pregStart, 283) : "";
      if (ds == null) return "Prenha";
      return `${ds}d • DPP ${fmtDateShort(dpp)}`;
    }
    return "—";
  }

  function vacLabel(h) {
    if (!h?.vacName && !h?.vacDate) return "—";
    const base = `${h?.vacName || "Vacina"} • ${fmtDateShort(h?.vacDate)}`;
    if (h?.vacNext && isoBefore(h.vacNext, todayIso())) return base + " • ATRASADA";
    return base;
  }

  const cadastroRows = useMemo(() => {
    const q = normEar(gSearch);
    return activeAnimals
      .filter((a) => (gCat === "ALL" ? true : String(a.category || "").toUpperCase() === String(gCat).toUpperCase()))
      .filter((a) => (!q ? true : normEar(a.ear).includes(q)))
      .filter((a) => {
        const h = healthFor(a.ear);
        if (gPreg === "ALL") return true;
        if (gPreg === "PRENHA") return h.pregStatus === "PRENHA";
        if (gPreg === "VAZIA") return h.pregStatus === "VAZIA";
        if (gPreg === "ND") return h.pregStatus !== "PRENHA" && h.pregStatus !== "VAZIA";
        return true;
      })
      .filter((a) => {
        const h = healthFor(a.ear);
        if (gVac === "ALL") return true;
        const missing = !h.vacDate;
        const overdue = h.vacNext && isoBefore(h.vacNext, todayIso());
        if (gVac === "MISSING") return missing;
        if (gVac === "DUE") return overdue;
        return true;
      })
      .sort((x, y) => String(x.ear).localeCompare(String(y.ear), "pt-BR"));
  }, [activeAnimals, gSearch, gCat, gPreg, gVac, health]);

  const editAnimalData = useMemo(() => {
    const ear = normEar(editEar);
    if (!ear) return null;
    const animal =
      (Array.isArray(activeAnimals) ? activeAnimals : []).find((item) => normEar(item?.ear) === ear) ||
      (Array.isArray(animals) ? animals : []).find((item) => normEar(item?.ear) === ear) ||
      null;
    const h = healthFor(ear);
    const sheet = h.sheet || {};
    const sexoRaw = normalizeSexValue(sheet.sexoLabel || animal?.sex) || String(animal?.sex || "").toUpperCase() || "";
    const sexoLabel = sexoRaw === "F" ? "Fêmea" : sexoRaw === "M" ? "Macho" : sexoRaw || "—";
    const loteLabel = asText(sheet.loteLabel || (animal ? animalLotLabel(animal) : "") || "Sem lote");
    const pesoKg = Number.isFinite(Number(animal?.lastWeightKg)) ? Number(animal.lastWeightKg) : null;
    const pesoArroba = Number.isFinite(Number(sheet.pesoArroba))
      ? Number(sheet.pesoArroba)
      : Number.isFinite(pesoKg)
      ? Number((pesoKg / 15).toFixed(2))
      : null;
    const dataPeso = normalizeIsoDate(sheet.dataPeso || animal?.lastWeighedAt || "");
    const gmdBase = animal ? calcAnimalGmdFromHistory(animal, weighs) : null;
    const gmdGeral = Number.isFinite(Number(sheet.gmdGeral)) ? Number(sheet.gmdGeral) : gmdBase;
    const categoriaLabel = asText(sheet.categoriaLabel || animal?.category || "Sem categoria");
    const idadeMeses = Number.isFinite(Number(sheet.idadeMeses))
      ? Number(sheet.idadeMeses)
      : ageMonths(h.birth);
    const idadeAtual = h.birth ? ageLabel(h.birth) : idadeMeses == null ? "—" : `${idadeMeses}m`;
    const pregStatus = String(h.pregStatus || "ND").toUpperCase();
    const situacaoReprodutiva = asText(
      sheet.situacaoReprodutiva ||
      (pregStatus === "PRENHA" ? "Prenha" : pregStatus === "VAZIA" ? "Vazia" : "")
    );
    const dpp = pregStatus === "PRENHA" ? dppIso(h.pregStart) : "";
    const bodyScore = Number.isFinite(Number(sheet.bodyScore)) ? Number(sheet.bodyScore) : null;
    const locomotionScore = Number.isFinite(Number(sheet.locomotionScore)) ? Number(sheet.locomotionScore) : null;
    const clinicalStatus = asText(sheet.clinicalStatus || "Estável");
    const clinicalDate = normalizeIsoDate(sheet.clinicalDate || "");
    const clinicalNote = asText(sheet.clinicalNote || "—");
    const reproProtocol = asText(sheet.reproProtocol || "—");
    const treatmentDate = normalizeIsoDate(sheet.treatmentDate || "");
    const treatmentReason = asText(sheet.treatmentReason || "—");
    const treatmentConduct = asText(sheet.treatmentConduct || "—");
    const treatmentObservation = asText(sheet.treatmentObservation || "—");
    return {
      ear,
      animal,
      health: h,
      sheet,
      sexoLabel,
      loteLabel,
      pesoKg,
      pesoArroba,
      dataPeso,
      gmdGeral,
      categoriaLabel,
      raca: asText(sheet.raca || "—"),
      idadeMeses,
      idadeAtual,
      situacaoReprodutiva: situacaoReprodutiva || "—",
      numeroMae: asText(sheet.numeroMae || "—"),
      dpp,
      vacStatus: h.vacNext && isoBefore(h.vacNext, todayIso()) ? "Atrasada" : h.vacDate ? "Em dia" : "Sem vacina",
      bodyScore,
      locomotionScore,
      clinicalStatus,
      clinicalDate,
      clinicalNote,
      reproProtocol,
      treatmentDate,
      treatmentReason,
      treatmentConduct,
      treatmentObservation,
    };
  }, [activeAnimals, animals, editEar, health, weighs]);

  const editAnimalHistory = useMemo(() => {
    const ear = normEar(editEar);
    if (!ear) return { weighs: [], timeline: [], clinical: [], reproduction: [] };
    const weighRows = (Array.isArray(weighs?.[ear]) ? weighs[ear] : [])
      .slice()
      .filter((row) => row && row.date)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""), "pt-BR"))
      .map((row, idx, arr) => {
        const currentKg = Number(row?.kg);
        const prevKg = Number(arr[idx + 1]?.kg);
        const delta = Number.isFinite(currentKg) && Number.isFinite(prevKg) ? currentKg - prevKg : null;
        return {
          key: `weigh-${row.date}-${idx}`,
          date: row.date,
          kg: Number.isFinite(currentKg) ? currentKg : null,
          arroba: Number.isFinite(currentKg) ? Number((currentKg / 15).toFixed(2)) : null,
          delta,
        };
      });

    const opsRows = (Array.isArray(opsLog) ? opsLog : [])
      .filter((item) => normEar(item?.ear) === ear)
      .map((item, idx) => ({
        key: `op-${String(item?.type || "log")}-${String(item?.date || item?.at || "")}-${idx}`,
        type: String(item?.type || "log"),
        date: String(item?.date || item?.at || "").slice(0, 10),
        label:
          item?.type === "move"
            ? `Movido para ${item?.to || "outro lote"}`
            : item?.type === "baixa"
            ? `Baixa registrada${item?.reason ? ` • ${item.reason}` : ""}`
            : item?.type === "weigh"
            ? `Pesagem operacional${Number.isFinite(Number(item?.kg)) ? ` • ${fmtKg(item.kg)}` : ""}`
            : "Registro operacional",
        detail:
          item?.type === "move"
            ? item?.from && item?.to
              ? `${item.from} → ${item.to}`
              : item?.to || ""
            : item?.note || item?.reason || "",
      }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""), "pt-BR"));

    const h = healthFor(ear);
    const sheet = h?.sheet && typeof h.sheet === "object" ? h.sheet : {};
    const clinicalRows = [
      sheet?.clinicalDate
        ? {
            key: "clinical-status",
            main: fmtDateShort(sheet.clinicalDate),
            sub: `Status ${asText(sheet.clinicalStatus || "Estável")}${sheet?.clinicalNote ? ` • ${sheet.clinicalNote}` : ""}`,
            value: asText(sheet.clinicalStatus || "Estável"),
          }
        : null,
      Number.isFinite(Number(sheet?.bodyScore))
        ? {
            key: "clinical-body-score",
            main: "Escore corporal",
            sub: Number.isFinite(Number(sheet?.locomotionScore))
              ? `Locomoção ${Number(sheet.locomotionScore).toFixed(1)}`
              : "Sem escore de locomoção",
            value: Number(sheet.bodyScore).toFixed(1),
          }
        : null,
      sheet?.reproProtocol
        ? {
            key: "clinical-protocol",
            main: "Protocolo associado",
            sub: asText(sheet.reproProtocol),
            value: h?.pregStart ? fmtDateShort(h.pregStart) : "Sem data",
          }
        : null,
      sheet?.treatmentDate || sheet?.treatmentReason || sheet?.treatmentConduct
        ? {
            key: "clinical-treatment",
            main: sheet?.treatmentDate ? fmtDateShort(sheet.treatmentDate) : "Tratamento registrado",
            sub: [asText(sheet.treatmentReason || ""), asText(sheet.treatmentConduct || ""), asText(sheet.treatmentObservation || "")]
              .filter((part) => part && part !== "—")
              .join(" • "),
            value: asText(sheet?.clinicalStatus || "Tratamento"),
          }
        : null,
    ].filter(Boolean);

    const reproductionRows = [
      h?.pregStart
        ? {
            key: "repro-preg",
            main: String(h?.pregStatus || "").toUpperCase() === "PRENHA" ? "Cobertura / IA registrada" : "Última revisão reprodutiva",
            sub:
              String(h?.pregStatus || "").toUpperCase() === "PRENHA"
                ? `DPP estimada ${fmtDateShort(dppIso(h.pregStart))}`
                : asText(h?.note || "Sem observação reprodutiva"),
            value: fmtDateShort(h.pregStart),
          }
        : null,
      sheet?.reproProtocol
        ? {
            key: "repro-protocol",
            main: "Protocolo reprodutivo",
            sub: asText(sheet.reproProtocol),
            value: asText(sheet?.situacaoReprodutiva || h?.pregStatus || "ND"),
          }
        : null,
      h?.note
        ? {
            key: "repro-note",
            main: "Observação do manejo",
            sub: asText(h.note),
            value: asText(sheet?.numeroMae || "—"),
          }
        : null,
    ].filter(Boolean);

    const manualEvents = [
      h?.birth
        ? { key: "birth", type: "birth", date: h.birth, label: "Nascimento informado", detail: fmtDateShort(h.birth) }
        : null,
      h?.pregStart && String(h?.pregStatus || "").toUpperCase() === "PRENHA"
        ? { key: "preg", type: "preg", date: h.pregStart, label: "Cobertura / IA registrada", detail: `DPP estimada ${fmtDateShort(dppIso(h.pregStart))}` }
        : null,
      h?.vacDate
        ? { key: "vac", type: "vac", date: h.vacDate, label: `Vacina: ${h.vacName || "Aplicada"}`, detail: h?.vacNext ? `Próxima: ${fmtDateShort(h.vacNext)}` : "" }
        : null,
    ].filter(Boolean);

    const timeline = [...manualEvents, ...opsRows]
      .filter((item) => item?.date)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""), "pt-BR"))
      .slice(0, 8);

    return {
      weighs: weighRows.slice(0, 6),
      timeline,
      clinical: clinicalRows,
      reproduction: reproductionRows,
    };
  }, [editEar, weighs, opsLog, health]);

  function openEdit(ear) {
    const k = normEar(ear);
    if (!k) return;
    if (editOpen && normEar(editEar) === k) {
      setEditOpen(false);
      return;
    }
    const h = healthFor(k);
    setEditEar(k);
    setEditBirth(h.birth || "");
    setEditPreg(h.pregStatus || "ND");
    setEditPregStart(h.pregStart || "");
    setEditVacName(h.vacName || "");
    setEditVacDate(h.vacDate || "");
    setEditVacNext(h.vacNext || "");
    setEditNote(h.note || "");
    setEditClinicalStatus(String(h?.sheet?.clinicalStatus || "ESTAVEL").toUpperCase());
    setEditBodyScore(
      Number.isFinite(Number(h?.sheet?.bodyScore)) ? String(Number(h.sheet.bodyScore)) : ""
    );
    setEditLocomotionScore(
      Number.isFinite(Number(h?.sheet?.locomotionScore)) ? String(Number(h.sheet.locomotionScore)) : ""
    );
    setEditClinicalDate(String(h?.sheet?.clinicalDate || ""));
    setEditClinicalNote(String(h?.sheet?.clinicalNote || ""));
    setEditReproProtocol(String(h?.sheet?.reproProtocol || ""));
    setEditTreatmentDate(String(h?.sheet?.treatmentDate || ""));
    setEditTreatmentReason(String(h?.sheet?.treatmentReason || ""));
    setEditTreatmentConduct(String(h?.sheet?.treatmentConduct || ""));
    setEditTreatmentObservation(String(h?.sheet?.treatmentObservation || ""));
    setEditView("resumo");
    setEditOpen(true);
  }

  function handleOpenEdit(evt, ear) {
    try {
      evt?.preventDefault?.();
      evt?.stopPropagation?.();
    } catch {}
    openEdit(ear);
  }

  async function saveEdit() {
    const ear = normEar(editEar);
    if (!ear) {
      setEditOpen(false);
      return;
    }
    const pregStatus = String(editPreg || "ND").toUpperCase();
    const baseSheet = editAnimalData?.sheet && typeof editAnimalData.sheet === "object" ? editAnimalData.sheet : {};
    const next = {
      birth: editBirth || "",
      pregStatus: pregStatus === "PRENHA" ? "PRENHA" : pregStatus === "VAZIA" ? "VAZIA" : "ND",
      pregStart: pregStatus === "PRENHA" ? (editPregStart || "") : "",
      note: editNote || "",
      vac: {
        name: (editVacName || "").trim(),
        date: editVacDate || "",
        next: editVacNext || "",
      },
      sheet: {
        ...baseSheet,
        clinicalStatus: String(editClinicalStatus || "ESTAVEL").toUpperCase(),
        bodyScore: editBodyScore === "" ? "" : Number(editBodyScore),
        locomotionScore: editLocomotionScore === "" ? "" : Number(editLocomotionScore),
        clinicalDate: editClinicalDate || "",
        clinicalNote: editClinicalNote || "",
        reproProtocol: editReproProtocol || "",
        treatmentDate: editTreatmentDate || "",
        treatmentReason: editTreatmentReason || "",
        treatmentConduct: editTreatmentConduct || "",
        treatmentObservation: editTreatmentObservation || "",
      },
      updatedAt: todayIso(),
    };
    try {
      const res = await api.patch(`/herd/animals/${encodeURIComponent(ear)}/profile`, {
        birth: next.birth,
        preg_status: next.pregStatus,
        preg_start: next.pregStart,
        note: next.note,
        vac_name: next.vac.name,
        vac_date: next.vac.date,
        vac_next: next.vac.next,
        sheet: next.sheet,
      });
      const savedProfile = res?.profile && typeof res.profile === "object"
        ? res.profile
        : {
            birth: next.birth,
            preg_status: next.pregStatus,
            preg_start: next.pregStart,
            note: next.note,
            vac_name: next.vac.name,
            vac_date: next.vac.date,
            vac_next: next.vac.next,
          };
      setHealth((prev) => {
        const p = prev && typeof prev === "object" ? prev : {};
        return {
          ...p,
          [ear]: profileToHealthState(savedProfile, p[ear]),
        };
      });
      setOpMsg(`✅ Cadastro geral atualizado para ${ear}.`);
      setEditOpen(false);
    } catch (e) {
      setOpMsg(`Falha ao salvar cadastro geral: ${e?.message || "erro desconhecido"}`);
    }
  }

  // -----------------------------
  // Carregar lista de brincos (carga inicial)
  // - Cola lista (um por linha) e cria animais localmente
  // -----------------------------
  function guessSexByCategory(cat) {
    const C = String(cat || "").toUpperCase();
    if (C === "BEZERRA" || C === "NOVILHA" || C === "VACA") return "F";
    if (C === "BEZERRO" || C === "BOI" || C === "TOURO") return "M";
    return "M";
  }

  function parseImportRowsFromAoa(aoa) {
    const rows = Array.isArray(aoa) ? aoa : [];
    if (!rows.length) return [];
    let headerRow = -1;
    let col = {
      ear: 0,
      sexo: -1,
      lote: -1,
      pesoKg: -1,
      pesoArroba: -1,
      data: -1,
      gmdGeral: -1,
      categoria: -1,
      raca: -1,
      nascimento: -1,
      idadeMeses: -1,
      situacaoReprodutiva: -1,
      numeroMae: -1,
    };

    const detectHeader = (headers) => {
      const raw = headers.map((h) => asText(h).toLowerCase());
      const norm = headers.map((h) => normalizeHeaderToken(h));
      const findRaw = (re) => raw.findIndex((h) => re.test(h));
      const findNorm = (re) => norm.findIndex((h) => re.test(h));
      return {
        ear: (() => {
          const idx = findRaw(/^n[uú]mero$/);
          if (idx >= 0) return idx;
          const b = findNorm(/brinco|ear|animal|numero/);
          return b >= 0 ? b : 0;
        })(),
        sexo: findNorm(/^sexo$/),
        lote: findNorm(/^lote$/),
        pesoKg: (() => {
          const idx = raw.findIndex((h) => h.trim() === "peso");
          if (idx >= 0) return idx;
          return findNorm(/^peso$/);
        })(),
        pesoArroba: raw.findIndex((h) => h.includes("@") || /peso\s*@/.test(h)),
        data: findNorm(/^data$/),
        gmdGeral: findNorm(/gmd.*geral|gmd/),
        categoria: findNorm(/^categoria$/),
        raca: findRaw(/ra[cç]a/),
        nascimento: findNorm(/nascimento/),
        idadeMeses: findNorm(/idade.*mes/),
        situacaoReprodutiva: findRaw(/situa[cç][aã]o reprodutiva/),
        numeroMae: findRaw(/n[uú]mero m[aã]e/),
      };
    };

    for (let i = 0; i < Math.min(rows.length, 8); i += 1) {
      const r = Array.isArray(rows[i]) ? rows[i] : [];
      const raw = r.map((h) => asText(h).toLowerCase());
      const hasNumero = raw.some((x) => x === "número" || x === "numero");
      const hasPeso = raw.some((x) => x === "peso");
      if (!hasNumero && !hasPeso) continue;
      headerRow = i;
      col = detectHeader(r);
      break;
    }
    if (headerRow < 0) {
      col = detectHeader(rows[0] || []);
      headerRow = 0;
    }

    const out = [];
    for (let i = headerRow + 1; i < rows.length; i += 1) {
      const r = Array.isArray(rows[i]) ? rows[i] : [];
      const ear = normEar(r[col.ear] ?? r[0] ?? "");
      if (!ear) continue;
      const pesoKg = numOrNull(col.pesoKg >= 0 ? r[col.pesoKg] : r[1]);
      const pesoArroba = numOrNull(col.pesoArroba >= 0 ? r[col.pesoArroba] : "");
      const data = normalizeIsoDate(col.data >= 0 ? r[col.data] : "");
      const nascimento = normalizeIsoDate(col.nascimento >= 0 ? r[col.nascimento] : "");
      const rec = {
        ear,
        kg: Number.isFinite(pesoKg) && pesoKg > 0 ? Number(pesoKg) : null,
        meta: {
          sexoLabel: asText(col.sexo >= 0 ? r[col.sexo] : ""),
          loteLabel: asText(col.lote >= 0 ? r[col.lote] : ""),
          pesoArroba,
          dataPeso: data,
          gmdGeral: numOrNull(col.gmdGeral >= 0 ? r[col.gmdGeral] : ""),
          categoriaLabel: asText(col.categoria >= 0 ? r[col.categoria] : ""),
          raca: asText(col.raca >= 0 ? r[col.raca] : ""),
          nascimento,
          idadeMeses: intOrNull(col.idadeMeses >= 0 ? r[col.idadeMeses] : ""),
          situacaoReprodutiva: asText(col.situacaoReprodutiva >= 0 ? r[col.situacaoReprodutiva] : ""),
          numeroMae: asText(col.numeroMae >= 0 ? r[col.numeroMae] : ""),
        },
      };
      out.push(rec);
    }
    return out;
  }

  function parseImportRowsFromText(text) {
    const lines = String(text || "").replace(/\r/g, "\n").split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return [];
    const hasStructured = lines.some((line) => /[;,\t|]/.test(line));
    if (!hasStructured) {
      return lines
        .map((line) => ({ ear: normEar(line), kg: null, meta: {} }))
        .filter((row) => !!row.ear);
    }

    const delimiters = [";", "\t", ",", "|"];
    const top = lines.slice(0, 10);
    let bestDelim = ";";
    let bestScore = -1;
    for (const d of delimiters) {
      const score = top.reduce((acc, line) => acc + Math.max(0, line.split(d).length - 1), 0);
      if (score > bestScore) {
        bestScore = score;
        bestDelim = d;
      }
    }
    const aoa = lines.map((line) => line.split(bestDelim).map((part) => String(part || "").trim()));
    const parsed = parseImportRowsFromAoa(aoa);
    if (parsed.length) return parsed;

    const fallback = [];
    for (const line of lines) {
      const parts = line.split(/[;,|\t]+/g).map((x) => String(x || "").trim());
      const ear = normEar(parts[0] || "");
      if (!ear) continue;
      const kgNum = parseFloatPt(parts[1] || "");
      fallback.push({ ear, kg: Number.isFinite(kgNum) && kgNum > 0 ? Number(kgNum) : null, meta: {} });
    }
    return fallback;
  }

  async function loadImportSpreadsheet(file) {
    const fileName = String(file?.name || "").toLowerCase();
    if (!file) return;
    try {
      let parsed = [];
      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        const txt = await file.text();
        parsed = parseImportRowsFromText(txt);
      } else {
        const XLSX = await import("xlsx");
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const wsName = Array.isArray(wb?.SheetNames) && wb.SheetNames.length ? wb.SheetNames[0] : null;
        if (!wsName) {
          setImportMsg("Planilha sem abas válidas.");
          return;
        }
        const ws = wb.Sheets[wsName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        parsed = parseImportRowsFromAoa(aoa);
      }

      if (!parsed.length) {
        setImportMsg("Nenhum brinco válido encontrado na planilha.");
        return;
      }

      const map = new Map();
      parsed.forEach((row) => {
        const ear = normEar(row?.ear);
        if (!ear) return;
        const kg = Number(row?.kg);
        const item = {
          ear,
          kg: Number.isFinite(kg) && kg > 0 ? kg : null,
          meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
        };
        if (!map.has(ear)) {
          map.set(ear, item);
        } else {
          const prev = map.get(ear);
          const merged = {
            ear,
            kg: prev?.kg ?? item.kg,
            meta: { ...(prev?.meta || {}), ...(item?.meta || {}) },
          };
          if (merged.kg == null && item.kg != null) merged.kg = item.kg;
          map.set(ear, merged);
        }
      });
      const cleanRows = Array.from(map.values());
      setImportFileRows(cleanRows);
      setImportRaw(cleanRows.map((r) => r.ear).join("\n"));

      const weighted = cleanRows.filter((r) => Number.isFinite(Number(r.kg)) && Number(r.kg) > 0);
      if (weighted.length) {
        setImportUseFileWeight(true);
        const firstKg = Number(weighted[0].kg);
        const sameKg = weighted.every((r) => Math.abs(Number(r.kg) - firstKg) < 0.0001);
        if (sameKg) setImportWeight(String(Math.round(firstKg)));
      } else {
        setImportUseFileWeight(false);
      }

      setImportMsg(`✅ Planilha carregada: ${cleanRows.length} brincos detectados.`);
      setImportOpen(true);
    } catch (err) {
      setImportMsg(`Falha ao ler planilha: ${err?.message || "arquivo inválido."}`);
    }
  }

  function openImportFilePicker() {
    if (!importOpen) openImportAnimals();
    requestAnimationFrame(() => {
      try {
        if (!importFileRef?.current) return;
        importFileRef.current.value = "";
        importFileRef.current.click();
      } catch {}
    });
  }

  async function onImportFileChange(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    await loadImportSpreadsheet(file);
  }

  function openImportAnimals() {
    // usa filtros da aba Lotes como padrão (quando fizer sentido)
    const prefCat = lotsCategory && lotsCategory !== "ALL" ? lotsCategory : "BOI";
    const prefSex = guessSexByCategory(prefCat);
    const lotId = ensureLotIdForQuickAdd(null);

    setImportCat(prefCat);
    setImportSex(prefSex);
    setImportLotId(String(lotId));
    setImportWeight("");
    setImportDate(opDate || todayIso());
    setImportIgnoreExisting(true);
    setImportUseFileWeight(false);
    setImportFileRows([]);
    setImportMsg("");
    setImportOpen(true);
  }

  async function importAnimalsNow() {
    const list = parseQueue(importRaw);
    if (!list.length) {
      setImportMsg("Cole a lista de brincos (um por linha, ou separados por vírgula).");
      return;
    }

    const defaultLotId = ensureLotIdForQuickAdd(importLotId || null);
    const defaultCat = normalizeCategoryValue(importCat || "BOI") || "BOI";
    const defaultSex = String(importSex || "M").toUpperCase() === "F" ? "F" : "M";
    const ignoreExisting = !!importIgnoreExisting;
    const kgRaw = parseFloatPt(importWeight);
    const hasUniformWeight = Number.isFinite(kgRaw) && kgRaw > 0;
    const uniformWeightKg = hasUniformWeight ? Number(kgRaw) : null;
    const dateIso = importDate || opDate || todayIso();
    const fileRowsMap = new Map(
      (Array.isArray(importFileRows) ? importFileRows : [])
        .filter((r) => normEar(r?.ear))
        .map((r) => [normEar(r.ear), r])
    );
    const fileWeightMap = new Map(
      Array.from(fileRowsMap.values()).map((r) => [normEar(r.ear), Number(r?.kg)])
    );
    const useFileWeight = !!importUseFileWeight && fileWeightMap.size > 0;
    const resolveWeight = (ear) => {
      if (useFileWeight) {
        const w = fileWeightMap.get(ear);
        if (Number.isFinite(w) && w > 0) return Number(w);
      }
      if (hasUniformWeight) return uniformWeightKg;
      return null;
    };
    const normalizeLotName = (name) => normalizeHeaderToken(name || "");

    let nextLots = Array.isArray(lots) ? lots.slice() : [];
    const originalLotsCount = nextLots.length;
    if (!nextLots.some((l) => Number(l?.id) === Number(defaultLotId))) {
      nextLots.push({
        id: Number(defaultLotId),
        name: `Manga ${String(defaultLotId).padStart(2, "0")}`,
      });
    }
    const lotIdByName = new Map();
    nextLots.forEach((l) => {
      const key = normalizeLotName(l?.name || `Lote ${l?.id}`);
      if (key) lotIdByName.set(key, Number(l.id));
    });
    let nextLotIdSeed = nextLots.reduce((acc, l) => Math.max(acc, Number(l?.id) || 0), 0) + 1;
    let createdLots = 0;
    const resolveLotId = (ear) => {
      const meta = fileRowsMap.get(ear)?.meta || {};
      const lotLabel = asText(meta.loteLabel || "");
      if (!lotLabel) return Number(defaultLotId);
      const key = normalizeLotName(lotLabel);
      if (key && lotIdByName.has(key)) return Number(lotIdByName.get(key));
      const id = nextLotIdSeed;
      nextLotIdSeed += 1;
      nextLots.push({ id, name: lotLabel });
      if (key) lotIdByName.set(key, id);
      createdLots += 1;
      return id;
    };

    const current = Array.isArray(animals) ? animals.slice() : [];
    const indexByEar = new Map();
    current.forEach((a, idx) => indexByEar.set(normEar(a?.ear), idx));
    const updatesByIndex = new Map();
    const toAdd = [];
    const weighRows = [];
    const logBatch = [];
    const healthPatchByEar = new Map();
    const backendAnimals = [];
    let dup = 0;
    let updated = 0;
    let metaUpdatedOnly = 0;

    for (const ear of list) {
      const E = normEar(ear);
      if (!E) continue;
      const fileMeta = fileRowsMap.get(E)?.meta || {};
      const rowSex = normalizeSexValue(fileMeta.sexoLabel || "");
      const rowCat = normalizeCategoryValue(fileMeta.categoriaLabel || "");
      const sex = rowSex || defaultSex;
      const cat = rowCat || defaultCat;
      const lotId = resolveLotId(E);
      const weightForEar = resolveWeight(E);
      const weighDateIso = normalizeIsoDate(fileMeta.dataPeso || "") || dateIso;
      const patchBirth = normalizeIsoDate(fileMeta.nascimento || "");
      const patchPregRaw = asText(fileMeta.situacaoReprodutiva || "");
      const patchPreg = patchPregRaw ? normalizePregValue(patchPregRaw) : "";
      const patchSheet = {
        sexoLabel: asText(fileMeta.sexoLabel || ""),
        loteLabel: asText(fileMeta.loteLabel || lotLabelById(lotId)),
        pesoArroba:
          numOrNull(fileMeta.pesoArroba) ??
          (Number.isFinite(weightForEar) && weightForEar > 0
            ? Number((Number(weightForEar) / 15).toFixed(2))
            : null),
        dataPeso: weighDateIso || "",
        gmdGeral: numOrNull(fileMeta.gmdGeral),
        categoriaLabel: asText(fileMeta.categoriaLabel || cat),
        raca: asText(fileMeta.raca || ""),
        idadeMeses: intOrNull(fileMeta.idadeMeses),
        situacaoReprodutiva: patchPregRaw,
        numeroMae: asText(fileMeta.numeroMae || ""),
      };

      const idx = indexByEar.get(E);
      if (Number.isInteger(idx)) {
        dup += 1;
        if (ignoreExisting) {
          healthPatchByEar.set(E, {
            birth: patchBirth,
            pregStatus: patchPreg,
            updatedAt: weighDateIso,
            sheet: patchSheet,
          });
          backendAnimals.push({
            ear_tag: E,
            sex,
            category: cat,
            lot_id: Number(lotId),
            status: "active",
            profile: {
              birth: patchBirth,
              preg_status: patchPreg || undefined,
              sheet: patchSheet,
            },
          });
          metaUpdatedOnly += 1;
          continue;
        }
        const patch = {
          category: cat,
          sex: sex,
          lotId: Number(lotId),
          status: "active",
          ...(Number.isFinite(weightForEar) ? { lastWeightKg: weightForEar, lastWeighedAt: weighDateIso } : {}),
        };
        updatesByIndex.set(idx, patch);
        healthPatchByEar.set(E, {
          birth: patchBirth,
          pregStatus: patchPreg,
          updatedAt: weighDateIso,
          sheet: patchSheet,
        });
        backendAnimals.push({
          ear_tag: E,
          sex,
          category: cat,
          lot_id: Number(lotId),
          status: "active",
          last_weight_kg: Number.isFinite(weightForEar) ? weightForEar : undefined,
          last_weighed_at: Number.isFinite(weightForEar) ? weighDateIso : undefined,
          profile: {
            birth: patchBirth,
            preg_status: patchPreg || undefined,
            sheet: patchSheet,
          },
        });
        updated += 1;
        const inRange = !Number.isFinite(weightForEar) || (weightForEar >= 80 && weightForEar <= 900);
        if (Number.isFinite(weightForEar) && weightForEar > 0) {
          weighRows.push({ ear: E, kg: weightForEar, inRange, date: weighDateIso });
          logBatch.push({
            id: uid("w"),
            type: "weigh",
            ear: E,
            kg: weightForEar,
            date: weighDateIso,
            to: null,
            flag: inRange ? null : "out_of_range",
          });
        }
        continue;
      }
      toAdd.push({
        ear: E,
        sex,
        category: cat,
        lotId: Number(lotId),
        status: "active",
        lastWeightKg: Number.isFinite(weightForEar) ? weightForEar : null,
        lastWeighedAt: Number.isFinite(weightForEar) ? weighDateIso : "",
      });
      healthPatchByEar.set(E, {
        birth: patchBirth,
        pregStatus: patchPreg,
        updatedAt: weighDateIso,
        sheet: patchSheet,
      });
      backendAnimals.push({
        ear_tag: E,
        sex,
        category: cat,
        lot_id: Number(lotId),
        status: "active",
        last_weight_kg: Number.isFinite(weightForEar) ? weightForEar : undefined,
        last_weighed_at: Number.isFinite(weightForEar) ? weighDateIso : undefined,
        profile: {
          birth: patchBirth,
          preg_status: patchPreg || undefined,
          sheet: patchSheet,
        },
      });
      logBatch.push({
        id: uid("c"),
        type: "cad",
        ear: E,
        kg: null,
        date: weighDateIso,
        to: lotLabelById(lotId),
        reason: `${cat}${sex ? `/${sex}` : ""}`,
      });
      const inRange = !Number.isFinite(weightForEar) || (weightForEar >= 80 && weightForEar <= 900);
      if (Number.isFinite(weightForEar) && weightForEar > 0) {
        weighRows.push({ ear: E, kg: weightForEar, inRange, date: weighDateIso });
        logBatch.push({
          id: uid("w"),
          type: "weigh",
          ear: E,
          kg: weightForEar,
          date: weighDateIso,
          to: null,
          flag: inRange ? null : "out_of_range",
        });
      }
    }

    const changed = toAdd.length + updated;
    if (!changed && healthPatchByEar.size === 0) {
      setImportMsg(dup ? `Nenhum novo brinco. ${dup} já existiam.` : "Nenhum brinco válido encontrado.");
      return;
    }

    try {
      await persistLotsBatch(nextLots);
      await persistAnimalsBatch(backendAnimals, true);
    } catch (e) {
      setImportMsg(`Falha ao importar no backend: ${e?.message || "erro desconhecido"}`);
      return;
    }

    const nextAnimals = current.map((a, idx) =>
      updatesByIndex.has(idx) ? { ...a, ...updatesByIndex.get(idx) } : a
    );
    if (toAdd.length) nextAnimals.unshift(...toAdd);
    if (createdLots > 0 || nextLots.length !== originalLotsCount) setLots(nextLots);
    setAnimals(nextAnimals);

    if (weighRows.length) {
      setWeighs((prev) => {
        const obj = prev && typeof prev === "object" ? { ...prev } : {};
        for (const row of weighRows) {
          const E = normEar(row?.ear);
          if (!E) continue;
          const arr = Array.isArray(obj[E]) ? obj[E].slice() : [];
          arr.unshift({ date: row?.date || dateIso, kg: Number(row?.kg) });
          obj[E] = arr.slice(0, 200);
        }
        return obj;
      });
    }

    if (logBatch.length) {
      setOpsLog((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        return [...logBatch, ...base].slice(0, 60);
      });
    }

    if (healthPatchByEar.size) {
      setHealth((prev) => {
        const p = prev && typeof prev === "object" ? { ...prev } : {};
        for (const [earKey, patch] of healthPatchByEar.entries()) {
          const prevEar = p[earKey] && typeof p[earKey] === "object" ? p[earKey] : {};
          const prevSheet = prevEar.sheet && typeof prevEar.sheet === "object" ? prevEar.sheet : {};
          const nextEar = {
            ...prevEar,
            sheet: { ...prevSheet, ...(patch?.sheet || {}) },
            updatedAt: patch?.updatedAt || todayIso(),
          };
          if (patch?.birth) nextEar.birth = patch.birth;
          if (patch?.pregStatus) {
            nextEar.pregStatus = patch.pregStatus;
            if (patch.pregStatus !== "PRENHA") nextEar.pregStart = "";
          }
          p[earKey] = nextEar;
        }
        return p;
      });
    }

    const weighed = weighRows.length;
    const outOfRange = weighRows.filter((r) => !r.inRange).length;
    if (!changed && healthPatchByEar.size > 0) {
      setImportMsg(
        `✅ Metadados da planilha aplicados em ${healthPatchByEar.size} animais` +
        `${dup ? ` (${dup} já existiam).` : "."}`
      );
    } else {
      setImportMsg(
        `✅ Lote concluído: ${toAdd.length} novos, ${updated} atualizados` +
        `${metaUpdatedOnly ? `, ${metaUpdatedOnly} com metadados atualizados` : ""}` +
        `${weighed ? `, ${weighed} pesagens lançadas` : ""}` +
        `${createdLots ? `, ${createdLots} lotes criados` : ""}` +
        `${outOfRange ? `, ${outOfRange} fora do padrão` : ""}.` +
        `${dup ? ` ${dup} já existiam.` : ""}`
      );
    }
    setImportRaw("");
  }

  // -----------------------------
  // Log: filtros e pendências (centro de confiança)
  // -----------------------------
  const logQ = useMemo(() => normEar(logSearch), [logSearch]);

  const logFiltered = useMemo(() => {
    const list = Array.isArray(opsLog) ? opsLog.slice() : [];
    return list.filter((it) => {
      if (!it) return false;
      if (logType !== "ALL" && String(it.type || "") !== logType) return false;
      if (logQ && !normEar(it.ear).includes(logQ)) return false;

      if (logRange === "today") return (it.date || "") === todayIso();
      if (logRange === "7d") {
        const ds = daysSinceIso(it.date);
        return ds != null && ds <= 7;
      }
      // all ou pending (pendências têm visão própria)
      return true;
    });
  }, [opsLog, logType, logQ, logRange]);

  const pendingWeighs = useMemo(() => {
    if (pendingData?.suspectWeighs) return pendingData.suspectWeighs;
    const list = Array.isArray(opsLog) ? opsLog.slice() : [];
    const seen = new Set();
    const out = [];
    for (const it of list) {
      if (!it || it.type !== "weigh") continue;
      if (it.flag !== "out_of_range") continue;
      const ear = normEar(it.ear);
      if (!ear || seen.has(ear)) continue;
      seen.add(ear);
      out.push(it);
    }
    return out.slice(0, 30);
  }, [opsLog, pendingData]);

  const pendingNoWeigh = useMemo(() => {
    if (pendingData?.noWeigh) return pendingData.noWeigh;
    return (Array.isArray(activeAnimals) ? activeAnimals : [])
      .filter((a) => !a?.lastWeighedAt)
      .slice()
      .sort((x, y) => String(x.ear).localeCompare(String(y.ear)));
  }, [activeAnimals, pendingData]);

  const pendingStale = useMemo(() => {
    if (pendingData?.staleWeigh) return pendingData.staleWeigh;
    const LIMIT_DAYS = Number(pendingData?.staleDays || 60);
    const list = Array.isArray(activeAnimals) ? activeAnimals.slice() : [];
    return list
      .map((a) => ({ a, ds: daysSinceIso(a?.lastWeighedAt) }))
      .filter((x) => x.ds != null && x.ds >= LIMIT_DAYS)
      .sort((x, y) => (y.ds || 0) - (x.ds || 0))
      .map((x) => x.a);
  }, [activeAnimals, pendingData]);

  const pendingVaccines = useMemo(() => {
    if (pendingData?.overdueVaccine) return pendingData.overdueVaccine;
    return cadastroRows
      .map((a) => {
        const h = healthFor(a.ear);
        return {
          ear: a.ear,
          lot_label: animalLotLabel(a),
          vac_name: h.vacName || "",
          vac_next: h.vacNext || "",
        };
      })
      .filter((row) => row.vac_next && isoBefore(row.vac_next, todayIso()))
      .sort((a, b) => String(a.vac_next || "").localeCompare(String(b.vac_next || "")))
      .slice(0, 30);
  }, [cadastroRows, pendingData, health]);

  const pendingCounts = useMemo(() => ({
    suspectWeighs: pendingData?.counts?.suspectWeighs != null ? Number(pendingData.counts.suspectWeighs) || 0 : pendingWeighs.length,
    noWeigh: pendingData?.counts?.noWeigh != null ? Number(pendingData.counts.noWeigh) || 0 : pendingNoWeigh.length,
    staleWeigh: pendingData?.counts?.staleWeigh != null ? Number(pendingData.counts.staleWeigh) || 0 : pendingStale.length,
    overdueVaccine: pendingData?.counts?.overdueVaccine != null ? Number(pendingData.counts.overdueVaccine) || 0 : pendingVaccines.length,
  }), [pendingData, pendingWeighs, pendingNoWeigh, pendingStale, pendingVaccines]);

const pendingTotal = useMemo(() => {
  if (pendingData?.counts?.operationalTotal != null) return Number(pendingData.counts.operationalTotal) || 0;
  return pendingCounts.suspectWeighs + pendingCounts.noWeigh + pendingCounts.staleWeigh;
}, [pendingData, pendingCounts]);

useEffect(() => {
  try {
    localStorage.setItem("fazenda_pending_count_v1", String(pendingTotal));
    window.dispatchEvent(new Event("fazenda_pending_updated"));
  } catch {}
}, [pendingTotal]);


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

  function goOperateEar(ear, kgPrefill = "") {
    setTab("operate");
    setOpAdvancedOpen(false);
    setOpSub("basic");
    setEarQ(ear || "");
    setKgQ(kgPrefill ? String(kgPrefill) : "");
    setOpMsg("");
    if (kgPrefill) focusKg(true);
    else focusEar(true);
  }

  function openTransferForEar(ear) {
    const tag = normEar(ear);
    if (!tag) return;
    setTRaw(tag);
    setTDest("");
    setTab("transfer");
    setEditOpen(false);
    setOpMsg(`Animal ${tag} preparado para transferência. Escolha a manga destino.`);
  }

  function openBaixaForEar(ear) {
    const tag = normEar(ear);
    if (!tag) return;
    setTab("operate");
    setOpSub("basic");
    setOpAdvancedOpen(true);
    setEarQ(tag);
    setKgQ("");
    setEditOpen(false);
    setOpMsg(`Animal ${tag} preparado para baixa. Confira o motivo e confirme no bloco operacional.`);
    focusEar(true);
  }

  function goPending(focus = "ALL") {
    setTab("log");
    setLogRange("pending");
    setLogType("ALL");
    setLogSearch("");
    setPendingFocus(String(focus || "ALL").toUpperCase());
  }

  // -----------------------------
  // Navegação externa (Painel do produtor → Rebanho)
  // - Usa localStorage + evento para abrir: Operar / Log / Pendências.
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const apply = (hint) => {
      if (!hint || typeof hint !== "object") return;

      // ações rápidas
      if (hint.action === "demo") {
        seedDemo();
        return;
      }
      if (hint.action === "pending") {
        goPending(hint.pendingFocus || "ALL");
        return;
      }

      const tabHint = hint.tab;
      if (tabHint === "log") {
        setTab("log");
        setLogRange(hint.logRange || "today");
        setLogType(hint.logType || "ALL");
        setLogSearch(hint.logSearch || "");
        if (String(hint.logRange || "").toLowerCase() === "pending") {
          setPendingFocus(String(hint.pendingFocus || "ALL").toUpperCase());
        } else {
          setPendingFocus("ALL");
        }
        return;
      }

      if (tabHint === "cadastro") {
        setTab("cadastro");
        if (typeof hint.search === "string") setGSearch(hint.search);
        if (typeof hint.category === "string") setGCat(hint.category);
        if (typeof hint.pregFilter === "string") setGPreg(String(hint.pregFilter).toUpperCase());
        if (typeof hint.vacFilter === "string") setGVac(String(hint.vacFilter).toUpperCase());
        if (typeof hint.ear === "string" && hint.ear.trim()) setGSearch(hint.ear.trim());
        return;
      }

      if (tabHint === "operate") {
        // abrir operação com brinco (opcional)
        const ear = hint.ear || "";
        const kg = hint.kg != null ? String(hint.kg) : "";
        const opSubHint = String(hint.opSub || "").toLowerCase();
        setTab("operate");
        if (opSubHint === "curral" || opSubHint === "lista" || opSubHint === "basic") setOpSub(opSubHint);
        else setOpSub("basic");
        setEarQ(ear);
        setKgQ(kg);
        setOpMsg("");
        setOpAdvancedOpen(false);
        requestAnimationFrame(() => {
          try {
            if (kg && kgRef?.current) kgRef.current.focus();
            else if (earRef?.current) earRef.current.focus();
          } catch {}
        });
        return;
      }

      // fallback: apenas abrir a aba
      if (tabHint) setTab(String(tabHint));
    };

    const readOnce = () => {
      try {
        const raw = localStorage.getItem("fazenda_nav_herd_open_v1");
        if (!raw) return;
        localStorage.removeItem("fazenda_nav_herd_open_v1");
        apply(JSON.parse(raw));
      } catch {}
    };

    readOnce();

    const on = () => readOnce();
    window.addEventListener("fazenda_nav_herd_open_v1", on);
    return () => window.removeEventListener("fazenda_nav_herd_open_v1", on);
  }, []);


  function resetLogFilters() {
    setLogRange("today");
    setLogType("ALL");
    setLogSearch("");
    setPendingFocus("ALL");
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

      {tab === "dashboard" && (
        <div className="herdDash">
          <div className="herdKpis">
            <div className="herdKpi">
              <div className="label">Gado ativo</div>
              <div className="value">{fmtInt(dashboardSummary.total)}</div>
              <div className="hint">Animais em produção</div>
            </div>
            <div className="herdKpi is-pos">
              <div className="label">Arrobas estimadas</div>
              <div className="value">{fmtArroba(dashboardSummary.totalArrobas)} @</div>
              <div className="hint">{fmtKg(dashboardSummary.totalPesoVivoKg)} de peso vivo</div>
            </div>
            <div className={"herdKpi" + (dashboardSummary.prenha > 0 ? " is-pos" : "")}>
              <div className="label">Fêmeas prenhas</div>
              <div className="value">{fmtInt(dashboardSummary.prenha)}</div>
              <div className="hint">De {fmtInt(dashboardSummary.female)} fêmeas ativas</div>
            </div>
            <div className={"herdKpi" + (dashboardSummary.vazia > 0 ? " is-warn" : "")}>
              <div className="label">Fêmeas vazias</div>
              <div className="value">{fmtInt(dashboardSummary.vazia)}</div>
              <div className="hint">Ponto de atenção reprodutiva</div>
            </div>
            <div className="herdKpi">
              <div className="label">No pasto</div>
              <div className="value">{fmtInt(dashboardSummary.noPasto)}</div>
              <div className="hint">Com manga/lote definido</div>
            </div>
            <div className={"herdKpi" + (dashboardSummary.semPasto > 0 ? " is-warn" : " is-pos")}>
              <div className="label">Sem manga</div>
              <div className="value">{fmtInt(dashboardSummary.semPasto)}</div>
              <div className="hint">Animais sem lote vinculado</div>
            </div>
          </div>

          <div className="herdGrid2">
            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Quantidade por tipo</div>
                  <div className="sub">Clique para abrir o Cadastro geral já filtrado.</div>
                </div>
              </div>

              <div className="herdChips">
                {Object.keys(byCategory)
                  .sort()
                  .map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="herdChip"
                      onClick={() => {
                        setGCat(cat);
                        setTab("cadastro");
                      }}
                    >
                      <span className="k">{cat}</span>
                      <span className="count">{fmtInt(byCategory[cat])}</span>
                    </button>
                  ))}
                {!Object.keys(byCategory).length ? (
                  <div className="faz-emptyNice">Sem animais ativos para exibir.</div>
                ) : null}
              </div>
            </section>

            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Distribuição por manga</div>
                  <div className="sub">Top mangas com mais cabeças.</div>
                </div>
              </div>

              <div className="faz-detail-grid" style={{ marginTop: 10 }}>
                {dashboardSummary.lotRows.map((row) => (
                  <div key={String(row.lotId)} className="faz-mini">
                    <div className="k">{row.lotName}</div>
                    <div className="v">{fmtInt(row.heads)}</div>
                  </div>
                ))}
                {!dashboardSummary.lotRows.length ? (
                  <div className="faz-emptyNice">Nenhuma manga com animais no momento.</div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="herdGrid2">
            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Radar reprodutivo</div>
                  <div className="sub">Leitura das matrizes ativas para decidir manejo e pressão sobre os lotes.</div>
                </div>
              </div>

              <div className="faz-detail-grid" style={{ marginTop: 10 }}>
                <div className="faz-mini">
                  <div className="k">Matrizes ativas</div>
                  <div className="v">{fmtInt(reproductiveSummary.matrices)}</div>
                </div>
                <div className={"faz-mini " + (reproductiveSummary.taxaPrenhez >= 50 ? "is-good" : reproductiveSummary.taxaPrenhez >= 30 ? "is-warn" : "is-bad")}>
                  <div className="k">Taxa prenhez</div>
                  <div className="v">{reproductiveSummary.taxaPrenhez.toFixed(1)}%</div>
                </div>
                <div className={"faz-mini " + (reproductiveSummary.vazias > 0 ? "is-warn" : "is-good")}>
                  <div className="k">Vazias</div>
                  <div className="v">{fmtInt(reproductiveSummary.vazias)}</div>
                </div>
                <div className="faz-mini">
                  <div className="k">Paridas</div>
                  <div className="v">{fmtInt(reproductiveSummary.paridas)}</div>
                </div>
                <div className={"faz-mini " + (reproductiveSummary.semInfo > 0 ? "is-warn" : "")}>
                  <div className="k">Sem status</div>
                  <div className="v">{fmtInt(reproductiveSummary.semInfo)}</div>
                </div>
              </div>

              <div className="herdQuick">
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGPreg("PRENHA");
                    setTab("cadastro");
                  }}
                >
                  Ver prenhas
                </button>
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGPreg("VAZIA");
                    setTab("cadastro");
                  }}
                >
                  Ver vazias
                </button>
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGPreg("ND");
                    setTab("cadastro");
                  }}
                >
                  Ver sem status
                </button>
              </div>
            </section>

            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Reprodução por lote</div>
                  <div className="sub">Mostra onde estão as matrizes e quais lotes concentram vazias.</div>
                </div>
              </div>

              <div className="herdMetricList">
                {reproductiveSummary.rows.map((row) => (
                  <div key={String(row.lotId)} className="herdMetricRow">
                    <div className="left">
                      <div className="name">{row.lotName}</div>
                      <div className="meta">
                        {fmtInt(row.matrices)} matrizes • {fmtInt(row.prenhas)} prenhas • {fmtInt(row.vazias)} vazias
                      </div>
                    </div>
                    <div className="right">
                      <span className={"pill " + (row.taxaPrenhez >= 50 ? "ok" : row.taxaPrenhez >= 30 ? "warn" : "bad")}>
                        {row.taxaPrenhez.toFixed(0)}% prenhez
                      </span>
                    </div>
                  </div>
                ))}
                {!reproductiveSummary.rows.length ? (
                  <div className="faz-emptyNice">Sem fêmeas ativas suficientes para montar o radar reprodutivo.</div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="herdGrid2">
            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Alertas clínicos e reprodutivos</div>
                  <div className="sub">Onde o rebanho está pedindo revisão imediata antes de virar problema maior.</div>
                </div>
              </div>

              <div className="faz-detail-grid" style={{ marginTop: 10 }}>
                <div className={"faz-mini " + (herdRiskSummary.clinicalTreatment > 0 ? "is-bad" : "is-good")}>
                  <div className="k">Em tratamento</div>
                  <div className="v">{fmtInt(herdRiskSummary.clinicalTreatment)}</div>
                </div>
                <div className={"faz-mini " + (herdRiskSummary.clinicalAttention > 0 ? "is-warn" : "is-good")}>
                  <div className="k">Em atenção</div>
                  <div className="v">{fmtInt(herdRiskSummary.clinicalAttention)}</div>
                </div>
                <div className={"faz-mini " + (herdRiskSummary.lowBodyScore > 0 ? "is-warn" : "is-good")}>
                  <div className="k">Escore baixo</div>
                  <div className="v">{fmtInt(herdRiskSummary.lowBodyScore)}</div>
                </div>
                <div className={"faz-mini " + (herdRiskSummary.overdueVaccine > 0 ? "is-bad" : "is-good")}>
                  <div className="k">Vacina atrasada</div>
                  <div className="v">{fmtInt(herdRiskSummary.overdueVaccine)}</div>
                </div>
                <div className={"faz-mini " + (herdRiskSummary.vazias > 0 ? "is-warn" : "is-good")}>
                  <div className="k">Matrizes vazias</div>
                  <div className="v">{fmtInt(herdRiskSummary.vazias)}</div>
                </div>
                <div className={"faz-mini " + (herdRiskSummary.semStatus > 0 ? "is-warn" : "is-good")}>
                  <div className="k">Sem status reprodutivo</div>
                  <div className="v">{fmtInt(herdRiskSummary.semStatus)}</div>
                </div>
              </div>

              <div className="herdQuick">
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGVac("DUE");
                    setTab("cadastro");
                  }}
                >
                  Ver vacinas atrasadas
                </button>
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGPreg("VAZIA");
                    setTab("cadastro");
                  }}
                >
                  Ver matrizes vazias
                </button>
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    setGPreg("ND");
                    setTab("cadastro");
                  }}
                >
                  Ver sem status
                </button>
              </div>
            </section>

            <section className="herdPanel">
              <div className="herdPanelHead">
                <div>
                  <div className="title">Animais prioritários</div>
                  <div className="sub">Lista curta para o gerente abrir a ficha e agir sem procurar no cadastro.</div>
                </div>
              </div>

              <div className="herdMetricList">
                {herdRiskSummary.animals.map((row) => (
                  <div key={row.ear} className="herdMetricRow">
                    <div className="left">
                      <div className="name">{row.ear}</div>
                      <div className="meta">
                        {row.lot} • {row.reasons.join(" • ")}
                      </div>
                    </div>
                    <div className="right">
                      <button className="faz-btn" type="button" onClick={() => openEdit(row.ear)}>
                        Abrir ficha
                      </button>
                    </div>
                  </div>
                ))}
                {!herdRiskSummary.animals.length ? (
                  <div className="faz-emptyNice">Sem alertas clínicos ou reprodutivos relevantes no momento.</div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="herdQuick">
            <button className="faz-btn primary" type="button" onClick={() => setTab("cadastro")}>
              Abrir cadastro geral
            </button>
            <button className="faz-btn" type="button" onClick={() => setTab("operate")}>
              Ir para operar
            </button>
            <button className="faz-btn" type="button" onClick={() => setTab("log")}>
              Ver caderno de campo
            </button>
          </div>
        </div>
      )}

      {tab === "operate" && (
        <div className="card">
          <div className={"faz-okbar" + (okPulseOn ? " is-on" : "")} aria-hidden="true" />
          <div className="card-header-row" style={{ alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Operar</div>
              <div className="card-subtitle">Brinco → peso → Enter.</div>
            </div>
            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button
                className={"faz-btn sm" + (opAdvancedOpen ? " primary" : "")}
                type="button"
                onClick={() => setOpAdvancedOpen((v) => !v)}
              >
                {opAdvancedOpen ? "Ocultar opções" : "Mais opções"}
              </button>
            </div>

            {lastOp ? (
              <span className={"faz-lastPill" + (lastOp.flag ? " is-alert" : "")}>
                Último: {lastOp.type === "weigh" ? "Pesagem" : lastOp.type === "move" ? "Movimento" : lastOp.type === "baixa" ? "Baixa" : "Registro"} • {lastOp.ear}
                {lastOp.type === "weigh" ? (
                  <> • {fmtKg(lastOp.kg)}</>
                ) : lastOp.type === "move" ? (
                  <> • {lastOp.to || "—"}</>
                ) : lastOp.reason ? (
                  <> • {lastOp.reason}</>
                ) : null}
              </span>
            ) : null}
          </div>

          <div className="faz-detail-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Brinco</label>
              <input
                ref={earRef}
                className="input"
                value={earQ}
                onChange={(e) => setEarQ(e.target.value)}
                onFocus={(e) => { try { e.target.select(); } catch {} }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEarQ("");
                    setKgQ("");
                    setOpMsg("");
                    setQuickAddOpen(false);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    // Curral: se o brinco não existe, já abre cadastro rápido (sem perder tempo)
                    if (!animalExact && earNorm) {
                      openQuickAdd();
                      return;
                    }
                    focusAfterEarInput();
                  }
                }}
                placeholder="Ex.: A2402, N901, 7812..."
              />
            </div>

            <div>
              <label className="form-label">Peso (kg)</label>
              <input
                ref={kgRef}
                className="input"
                inputMode="decimal"
                value={kgQ}
                onChange={(e) => setKgQ(e.target.value)}
                onFocus={(e) => { try { e.target.select(); } catch {} }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setKgQ("");
                    setOpMsg("");
                    focusEar(true);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    registerWeigh();
                  }
                }}
                placeholder="Ex.: 212"
              />
            </div>

            {opAdvancedOpen ? (
              <>
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
                </div>

                <div>
                  <label className="form-label">Data</label>
                  <input className="input" type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} />
                </div>
              </>
            ) : null}
          </div>

          {/* Subabas (mantém a tela simples) */}
          <div className="faz-subtabs" style={{ marginTop: 12 }}>
            <button type="button" className={"faz-subtab" + (opSub === "basic" ? " is-active" : "")} onClick={() => setOpSub("basic")}>
              Pesar
            </button>
            <button type="button" className={"faz-subtab" + (opSub === "curral" ? " is-active" : "")} onClick={() => setOpSub("curral")}>
              Curral
            </button>
            <button type="button" className={"faz-subtab" + (opSub === "lista" ? " is-active" : "")} onClick={() => setOpSub("lista")}>
              Lista
            </button>
          </div>

          {opSub === "curral" ? (
            <div className="faz-subpanel">
              <div className="texto-suave">
                Curral (ordem aleatória): <b>brinco</b> → Enter/Tab → <b>peso</b> → Enter.
              </div>

              <div className="texto-suave" style={{ marginTop: 8 }}>
                Atalhos: Enter = registrar • Tab = ir para peso • Esc = limpar.
              </div>

              <div className="faz-rowActions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
                <button className="faz-btn primary" type="button" onClick={openCurralDay}>
                  Dia do curral
                </button>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={scannerFocus} onChange={(e) => setScannerFocus(e.target.checked)} />
                  Ir direto no peso
                </label>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={repeatGuard} onChange={(e) => setRepeatGuard(e.target.checked)} />
                  Evitar repetir (2 min)
                </label>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={okFlashEnabled} onChange={(e) => setOkFlashEnabled(e.target.checked)} />
                  Flash
                </label>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={okBeepEnabled} onChange={(e) => setOkBeepEnabled(e.target.checked)} />
                  Som
                </label>
              </div>

              <div className="texto-suave" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <b>Últimos:</b>
                {(Array.isArray(opsLog) ? opsLog.slice(0, 3) : []).map((it) => (
                  <span key={it.id} className="pill">
                    {it.type === "weigh" ? "Pesagem" : it.type === "move" ? "Movimento" : "Baixa"} • {it.ear}
                    {it.type === "weigh"
                      ? ` • ${fmtKg(it.kg)}`
                      : it.type === "move"
                      ? ` • ${it.to || "—"}`
                      : it.reason
                      ? ` • ${it.reason}`
                      : ""}
                  </span>
                ))}
                {(!Array.isArray(opsLog) || opsLog.length === 0) ? <span className="pill">—</span> : null}
              </div>
            </div>
          ) : null}

          {opSub === "lista" ? (
            <div className="faz-subpanel">
              <div className="texto-suave">
                Use quando tiver a lista do lote (conferência).
              </div>

              <div className="faz-rowActions" style={{ justifyContent: "flex-start", marginTop: 10, marginBottom: 10 }}>
                <button className="faz-btn" type="button" onClick={startFila}>Iniciar</button>
                <button className="faz-btn" type="button" onClick={nextFila} disabled={!filaIsOn}>Próximo</button>
                <button className="faz-btn" type="button" onClick={clearFila}>Limpar</button>
              </div>

              <textarea
                ref={filaRef}
                className="input"
                rows={3}
                value={filaRaw}
                onChange={(e) => setFilaRaw(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    startFila();
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    clearFila();
                  }
                }}
                placeholder={"Cole aqui os brincos (um por linha).\nEx:\nA2402\nA2403\nN901"}
              />

              {filaIsOn ? (
                <div className="texto-suave" style={{ marginTop: 10 }}>
                  <b>Fila:</b> {filaPos}/{filaTotal} • <b>Atual:</b> {filaCurrent || "—"} • <b>Próximo:</b> {filaNext || "—"}
                </div>
              ) : null}
            </div>
          ) : null}

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
                  {opAdvancedOpen ? (
                    <>
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
                    </>
                  ) : null}
                </div>
              </div>

              {opMsg ? <div className="texto-suave" style={{ marginTop: 10 }}>{opMsg}</div> : null}
            </div>
          ) : (earNorm || opMsg) ? (
            <div className="faz-emptyNice" style={{ marginTop: 12 }}>
              {earNorm ? (
                <>
                  <div style={{ fontWeight: 900 }}>Brinco <b>{earNorm}</b> não cadastrado.</div>
                  <div className="texto-suave" style={{ marginTop: 6 }}>
                    No curral é comum. Cadastre rápido e siga.
                  </div>

                  <div className="faz-rowActions" style={{ marginTop: 10, justifyContent: "flex-start" }}>
                    <button className="faz-btn primary" type="button" onClick={openQuickAdd}>
                      Cadastrar
                    </button>
                    <button className="faz-btn" type="button" onClick={seedDemo}>
                      Demo
                    </button>
                  </div>
                </>
              ) : null}

              {opMsg ? <div style={{ marginTop: 8 }}>{opMsg}</div> : null}
            </div>
          ) : null}

          {/* Cadastro rápido (modal) */}
          {quickAddOpen ? (
            <div className="faz-modalBack" onMouseDown={() => setQuickAddOpen(false)}>
              <div className="faz-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="faz-modalHead">
                  <div>
                    <div className="faz-modalTitle">Cadastro rápido</div>
                    <div className="faz-modalSub">Só o básico para pesar agora.</div>
                  </div>
                  <button className="faz-btn" type="button" onClick={() => setQuickAddOpen(false)}>
                    Fechar
                  </button>
                </div>

                <div className="faz-modalGrid">
                  <div>
                    <label className="form-label">Categoria</label>
                    <select className="input" value={quickCat} onChange={(e) => setQuickCat(e.target.value)}>
                      <option value="BEZERRO">Bezerro</option>
                      <option value="BEZERRA">Bezerra</option>
                      <option value="NOVILHA">Novilha</option>
                      <option value="VACA">Vaca</option>
                      <option value="BOI">Boi</option>
                      <option value="TOURO">Touro</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Sexo</label>
                    <select className="input" value={quickSex} onChange={(e) => setQuickSex(e.target.value)}>
                      <option value="M">Macho</option>
                      <option value="F">Fêmea</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Manga</label>
                    {lotsSorted.length ? (
                      <select className="input" value={quickLotId} onChange={(e) => setQuickLotId(e.target.value)}>
                        {lotsSorted.map((l) => (
                          <option key={String(l.id)} value={String(l.id)}>
                            {l.name || `Manga ${String(l.id).padStart(2, "0")}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="texto-suave" style={{ marginTop: 6 }}>
                        Sem mangas cadastradas. Ao cadastrar, cria automaticamente <b>Manga 01</b>.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Peso (kg)</label>
                    <input
                      ref={quickKgRef}
                      className="input"
                      value={kgQ}
                      onChange={(e) => setKgQ(e.target.value)}
                      onFocus={(e) => { try { e.target.select(); } catch {} }}
                      placeholder="Ex.: 320"
                      inputMode="decimal"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setQuickAddOpen(false);
                          requestAnimationFrame(() => earRef?.current?.focus());
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = parseFloatPt(e.currentTarget.value);
                          if (Number.isFinite(v) && v > 0) quickAddAndWeigh();
                          else setOpMsg("Informe um peso válido (kg) para usar ‘Cadastrar e pesar’." );
                        }
                      }}
                    />
                    <div className="texto-suave" style={{ marginTop: 6 }}>
                      Dica: digite o peso aqui e use <b>Cadastrar e pesar</b>.
                    </div>
                  </div>
                </div>

                <div className="faz-modalActions">
                  <button className="faz-btn primary" type="button" onClick={quickAddAndWeigh} disabled={!kgIsValid}>
                    Cadastrar e pesar
                  </button>
                  <button className="faz-btn" type="button" onClick={quickAddAnimal}>
                    Só cadastrar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {curralDayOpen ? (
            <div className="faz-modalBack" onMouseDown={() => setCurralDayOpen(false)}>
              <div className={"faz-modal" + (curralDayFieldMode ? " is-campo" : "")} onMouseDown={(e) => e.stopPropagation()}>
                <div className="faz-modalHead">
                  <div>
                    <div className="faz-modalTitle">Dia do curral</div>
                    <div className="faz-modalSub">Pesagem com peso anterior + vacinas do dia.</div>
                  </div>
                  <div className="faz-rowActions" style={{ justifyContent: "flex-end" }}>
                    <label className="pill" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={curralDayFieldMode} onChange={(e) => setCurralDayFieldMode(e.target.checked)} />
                      Modo campo
                    </label>
                    <button className="faz-btn" type="button" onClick={() => setCurralDayOpen(false)}>
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="faz-modalGrid">
                  <div>
                    <label className="form-label">Número do gado (brinco)</label>
                    <input
                      ref={curralDayEarRef}
                      className="input"
                      value={curralDayEar}
                      onChange={(e) => setCurralDayEar(e.target.value)}
                      placeholder="Ex.: A2402"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setCurralDayOpen(false);
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          requestAnimationFrame(() => curralDayKgRef?.current?.focus());
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="form-label">Data do curral</label>
                    <input className="input" type="date" value={curralDayDate} onChange={(e) => setCurralDayDate(e.target.value)} />
                  </div>

                  <div>
                    <label className="form-label">Peso anterior</label>
                    <input
                      className="input"
                      value={curralDayAnimal && Number.isFinite(Number(curralDayAnimal.lastWeightKg)) ? `${Math.round(Number(curralDayAnimal.lastWeightKg))} kg` : "Sem peso anterior"}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="form-label">Peso novo (kg)</label>
                    <input
                      ref={curralDayKgRef}
                      className="input"
                      inputMode="decimal"
                      value={curralDayKg}
                      onChange={(e) => setCurralDayKg(e.target.value)}
                      placeholder="Ex.: 392"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setCurralDayOpen(false);
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCurralDay();
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="form-label">Última vacina</label>
                    <input
                      className="input"
                      value={curralDayAnimalHealth?.vacName ? `${curralDayAnimalHealth.vacName}` : "Sem registro"}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="form-label">Data última vacina</label>
                    <input
                      className="input"
                      value={curralDayAnimalHealth?.vacDate ? fmtDateShort(curralDayAnimalHealth.vacDate) : "Sem registro"}
                      readOnly
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="form-label">Vacinas aplicadas no dia</label>
                  <div className="faz-rowActions" style={{ justifyContent: "flex-start" }}>
                    {CURRAL_VACCINES.map((v) => (
                      <label key={v.name} className="pill" style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!curralDayVac[v.name]}
                          onChange={(e) => setCurralDayVac((prev) => ({ ...prev, [v.name]: e.target.checked }))}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                </div>

                {curralDayMsg ? <div className="texto-suave" style={{ marginTop: 10 }}>{curralDayMsg}</div> : null}
                {curralDayLast ? (
                  <div className="texto-suave" style={{ marginTop: 6 }}>
                    Último: <b>{curralDayLast.ear}</b> • {fmtKg(curralDayLast.prevKg)} → <b>{fmtKg(curralDayLast.newKg)}</b> • {fmtDateShort(curralDayLast.date)}
                  </div>
                ) : null}

                <div className="faz-modalActions">
                  <button className="faz-btn primary" type="button" onClick={applyCurralDay}>
                    Registrar dia do curral
                  </button>
                </div>
              </div>
            </div>
          ) : null}


        </div>
      )}


      {tab === "log" && (
        <div className="card faz-log-card">
          <div className="card-header-row faz-log-header">
            <div>
              <div style={{ fontWeight: 900 }}>Caderno de Campo</div>
              <div className="card-subtitle">Centro de confiança: backend + pendências operacionais.</div>
            </div>

            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={() => setTab("operate")}>
                Operar
              </button>
              <button className="faz-btn" type="button" onClick={exportLogCsv}>
                Exportar CSV
              </button>
              <button className="faz-btn" type="button" onClick={() => setOpsLog([])}>
                Limpar
              </button>
            </div>
          </div>

          <div className="faz-detail-grid faz-log-filters" style={{ marginTop: 12 }}>
            <div className="faz-log-filterBlock">
              <label className="form-label">Buscar brinco</label>
              <input
                className="input"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Ex.: A2402"
              />
            </div>

            <div className="faz-log-filterBlock">
              <label className="form-label">Tipo</label>
              <select className="input" value={logType} onChange={(e) => setLogType(e.target.value)}>
                <option value="ALL">Todos</option>
                <option value="weigh">Pesagens</option>
                <option value="move">Movimentos</option>
                <option value="baixa">Baixas</option>
              </select>
            </div>

            <div className="faz-log-filterBlock">
              <label className="form-label">Período</label>
              <div className="faz-rowActions" style={{ justifyContent: "flex-start" }}>
                <button
                  className={"faz-btn" + (logRange === "today" ? " primary" : "")}
                  type="button"
                  onClick={() => setLogRange("today")}
                >
                  Hoje
                </button>
                <button
                  className={"faz-btn" + (logRange === "7d" ? " primary" : "")}
                  type="button"
                  onClick={() => setLogRange("7d")}
                >
                  7 dias
                </button>
                <button
                  className={"faz-btn" + (logRange === "all" ? " primary" : "")}
                  type="button"
                  onClick={() => setLogRange("all")}
                >
                  Tudo
                </button>
                <button
                  className={"faz-btn" + (logRange === "pending" ? " primary" : "")}
                  type="button"
                  onClick={() => setLogRange("pending")}
                >
                  Pendências
                </button>
              </div>
              <div className="texto-suave" style={{ marginTop: 6 }}>
                Dica: use Pendências para ir direto resolver no Operar.
              </div>
            </div>

            <div className="faz-log-filterBlock">
              <label className="form-label">Resumo</label>
              <div className="faz-rowActions" style={{ justifyContent: "flex-start" }}>
                <span className="faz-pill">{fmtInt(Array.isArray(opsLog) ? opsLog.length : 0)} operações</span>
                <span className="faz-pill">{fmtInt(pendingCounts.suspectWeighs)} pesos suspeitos</span>
                <span className="faz-pill">{fmtInt(pendingCounts.noWeigh + pendingCounts.staleWeigh)} pendências pesagem</span>
                <span className="faz-pill">{fmtInt(pendingCounts.overdueVaccine)} vacinas atrasadas</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="faz-btn" type="button" onClick={resetLogFilters}>
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          {logRange === "pending" ? (
            <div className="faz-pending-shell" style={{ marginTop: 12 }}>
              <div className="faz-pending-title" style={{ fontWeight: 900 }}>Pendências (acionáveis)</div>
              <div className="card-subtitle">Clique em Revisar/Pesar para abrir o Operar já no brinco.</div>
              <div className="faz-rowActions faz-pending-focus" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                <button className={"faz-btn" + (pendingFocus === "ALL" ? " primary" : "")} type="button" onClick={() => setPendingFocus("ALL")}>
                  Todas
                </button>
                <button className={"faz-btn" + (pendingFocus === "SUSPECT" ? " primary" : "")} type="button" onClick={() => setPendingFocus("SUSPECT")}>
                  Suspeitos
                </button>
                <button className={"faz-btn" + (pendingFocus === "NOWEIGH" ? " primary" : "")} type="button" onClick={() => setPendingFocus("NOWEIGH")}>
                  Nunca pesados
                </button>
                <button className={"faz-btn" + (pendingFocus === "STALE" ? " primary" : "")} type="button" onClick={() => setPendingFocus("STALE")}>
                  60+ dias
                </button>
                <button className={"faz-btn" + (pendingFocus === "VACCINE" ? " primary" : "")} type="button" onClick={() => setPendingFocus("VACCINE")}>
                  Vacina atrasada
                </button>
              </div>

              {(pendingFocus === "ALL" || pendingFocus === "SUSPECT") ? (
              <div className="faz-pending-block" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900 }}>1) Pesos suspeitos</div>
                {pendingWeighs.length === 0 ? (
                  <div className="texto-suave" style={{ marginTop: 8 }}>
                    Nenhum peso suspeito no log.
                  </div>
                ) : (
                  <div className="faz-animals faz-pending-list" style={{ marginTop: 10 }}>
                    {pendingWeighs.map((it) => (
                      <div key={it.id} className={"faz-animal-row is-alert"}>
                        <div className="meta">
                          <span className="ear">{it.ear}</span> • Pesagem {fmtInt(it.kg)}kg • {it.date || "—"}
                        </div>
                        <button className="faz-btn primary" type="button" onClick={() => goOperateEar(it.ear, it.kg)}>
                          Revisar
                        </button>
                        <span className="pill">SUSPEITO</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : null}

              {(pendingFocus === "ALL" || pendingFocus === "NOWEIGH" || pendingFocus === "STALE") ? (
              <div className="faz-pending-block" style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900 }}>2) Sem pesagem</div>
                <div className="texto-suave" style={{ marginTop: 6 }}>
                  Regra simples: <b>{fmtInt(Number(pendingData?.staleDays || 60))} dias</b> sem pesagem vira pendência.
                </div>

                {pendingNoWeigh.length + pendingStale.length === 0 ? (
                  <div className="texto-suave" style={{ marginTop: 8 }}>
                    Nenhuma pendência de pesagem.
                  </div>
                ) : (
                  <div className="faz-animals faz-pending-list" style={{ marginTop: 10 }}>
                    {(pendingFocus === "ALL" || pendingFocus === "NOWEIGH") ? pendingNoWeigh.slice(0, 20).map((a) => (
                      <div key={a.ear} className={"faz-animal-row is-alert"}>
                        <div className="meta">
                          <span className="ear">{a.ear}</span> • {a.lot_label || animalLotLabel(a)} • Nunca pesado
                        </div>
                        <button className="faz-btn primary" type="button" onClick={() => goOperateEar(a.ear, "")}>
                          Pesar agora
                        </button>
                        <span className="pill">PENDENTE</span>
                      </div>
                    )) : null}

                    {(pendingFocus === "ALL" || pendingFocus === "STALE") ? pendingStale
                      .filter((a) => !!(a?.last_weighed_at || a?.lastWeighedAt))
                      .slice(0, 20)
                      .map((a) => {
                        const lastWeighedAt = a?.last_weighed_at || a?.lastWeighedAt || "";
                        const ds = Number.isFinite(Number(a?.days_since_weigh)) ? Number(a.days_since_weigh) : daysSinceIso(lastWeighedAt);
                        return (
                          <div key={a.ear} className={"faz-animal-row is-alert"}>
                            <div className="meta">
                              <span className="ear">{a.ear}</span> • {a.lot_label || animalLotLabel(a)} • Última: {fmtDateShort(lastWeighedAt)} • {ds != null ? `${ds}d` : "—"}
                            </div>
                            <button className="faz-btn" type="button" onClick={() => goOperateEar(a.ear, "")}>
                              Pesar
                            </button>
                            <span className="pill">60+ DIAS</span>
                          </div>
                        );
                      }) : null}
                  </div>
                )}
              </div>
              ) : null}

              {(pendingFocus === "ALL" || pendingFocus === "VACCINE") ? (
              <div className="faz-pending-block" style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900 }}>3) Vacina atrasada</div>
                <div className="texto-suave" style={{ marginTop: 6 }}>
                  Sanidade pendente vinda do perfil oficial do animal.
                </div>

                {pendingVaccines.length === 0 ? (
                  <div className="texto-suave" style={{ marginTop: 8 }}>
                    Nenhuma vacina atrasada.
                  </div>
                ) : (
                  <div className="faz-animals faz-pending-list" style={{ marginTop: 10 }}>
                    {pendingVaccines.map((a) => (
                      <div key={`vac_${a.ear}`} className={"faz-animal-row is-alert"}>
                        <div className="meta">
                          <span className="ear">{a.ear}</span> • {a.lot_label || "Sem lote"} • {a.vac_name || "Vacina"} • vence em {fmtDateShort(a.vac_next)}
                        </div>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            setTab("cadastro");
                            setGSearch(a.ear || "");
                            setGVac("DUE");
                          }}
                        >
                          Abrir cadastro
                        </button>
                        <span className="pill">ATRASADA</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {logFiltered.length === 0 ? (
                <div className="texto-suave">Nenhuma operação encontrada nesse filtro.</div>
              ) : (
                <div className="faz-animals">
                  {logFiltered.slice(0, 60).map((it) => {
                    const isWarn = it?.type === "weigh" && it?.flag === "out_of_range";
                    const label =
                      it.type === "weigh"
                        ? `Pesagem ${fmtInt(it.kg)}kg`
                        : it.type === "move"
                          ? `Mover → ${it.to || "—"}`
                          : it.type === "baixa"
                            ? `Baixa${it.reason ? ` • ${it.reason}` : ""}`
                            : String(it.type || "—");
                    return (
                      <div key={it.id} className={"faz-animal-row" + (isWarn ? " is-alert" : "")}>
                        <div className="meta">
                          <span className="ear">{it.ear}</span> • {label} • {it.date || "—"}
                        </div>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => goOperateEar(it.ear, it.type === "weigh" ? it.kg : "")}
                        >
                          Ir
                        </button>
                        {isWarn ? <span className="pill">SUSPEITO</span> : <span className="pill">{String(it.type || "").toUpperCase()}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "overview" && (
        <div className="card faz-block-shell">
          <div className="card-header-row faz-block-head">
            <div>
              <div style={{ fontWeight: 900 }}>Visão geral</div>
              <div className="card-subtitle">Contagem e alertas básicos (front).</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{fmtArroba(totalArrobas)} @</div>
              <div className="texto-suave">{fmtInt(activeAnimals.length)} ativos</div>
            </div>
          </div>

          <div className="faz-detail-grid faz-block-grid" style={{ marginTop: 12 }}>
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
        <div className="card faz-block-shell">
          <div className="card-header-row faz-block-head">
            <div>
              <div style={{ fontWeight: 900 }}>Lotes</div>
              <div className="card-subtitle">Visão operacional por lote: cabeças, peso e custo.</div>
            </div>
            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={() => setTab("operate")}>
                Operar
              </button>
              <button className="faz-btn" type="button" onClick={openImportFilePicker}>
                Importar planilha
              </button>
              <button className="faz-btn" type="button" onClick={openImportAnimals}>
                Carregar lista
              </button>
              <button className="faz-btn" type="button" onClick={exportLotsCsv}>
                Exportar CSV
              </button>
              <button className="faz-btn" type="button" onClick={seedDemo}>
                Demo
              </button>
            </div>
          </div>

          <div className="herdLotsDash" style={{ marginTop: 12 }}>
            <div className="herdLotsCostBar">
              <div className="left">
                <span className="faz-pill">
                  Custos do mês: <b>{fmtMonthLabel(lotsCostMeta.month || lotsCostMonth)}</b>
                </span>
                <span className={"faz-pill" + (lotsCostMeta.includeInvestment ? "" : " is-ok")}>
                  Investimento: <b>{lotsCostMeta.includeInvestment ? "incluído" : "ignorado"}</b>
                </span>
                <span className="faz-pill">
                  Rateio sem lote: <b>{fmtBRL(
                    Number(lotsCostMeta?.unallocated?.animals || 0) +
                    Number(lotsCostMeta?.unallocated?.purchase || 0) +
                    Number(lotsCostMeta?.unallocated?.nutrition || 0)
                  )}</b>
                </span>
              </div>
              <div className="right">
                <input
                  type="month"
                  className="faz-input"
                  value={lotsCostMonth}
                  onChange={(e) => setLotsCostMonth(e.target.value)}
                />
                <label className={"faz-toggle" + (lotsIncludeInvestment ? " is-on" : "")}>
                  <input
                    type="checkbox"
                    checked={lotsIncludeInvestment}
                    onChange={(e) => setLotsIncludeInvestment(e.target.checked)}
                  />
                  Incluir investimento
                </label>
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => syncFromBackend(false, { month: lotsCostMonth, includeInvestment: lotsIncludeInvestment })}
                >
                  Atualizar custos
                </button>
              </div>
            </div>

            <div className="herdKpis herdKpis--lots">
              <div className="herdKpi is-pos">
                <div className="label">Peso total</div>
                <div className="value">{fmtKg(lotsKpis.totalWeightKg)}</div>
                <div className="hint">{fmtArroba(lotsKpis.totalArrobas)} @ no rebanho filtrado</div>
              </div>
              <div className="herdKpi">
                <div className="label">Peso médio</div>
                <div className="value">{fmtKg1(lotsKpis.avgWeightKg)}</div>
                <div className="hint">Média por cabeça</div>
              </div>
              <div className={"herdKpi" + (Number(lotsKpis.gmdAvg) >= 0 ? " is-pos" : " is-warn")}>
                <div className="label">GMD médio dos lotes</div>
                <div className="value">{fmtKgDay(lotsKpis.gmdAvg)}</div>
                <div className="hint">Ganho médio diário</div>
              </div>
              <div className={"herdKpi" + ((Number(lotsKpis.fixedCostPerHeadAvg) > FIXED_COST_CAP_PER_HEAD) ? " is-bad" : " is-pos")}>
                <div className="label">Custo fixo/cabeça</div>
                <div className="value">{fmtBRL(lotsKpis.fixedCostPerHeadAvg || 0)}</div>
                <div className="hint">
                  Limite {fmtBRL(FIXED_COST_CAP_PER_HEAD)} • {fmtInt(lotsKpis.fixedCapExceededLots)} lote(s) acima
                </div>
              </div>
              <div className="herdKpi">
                <div className="label">Total de animais</div>
                <div className="value">{fmtInt(lotsKpis.totalHeads)}</div>
                <div className="hint">{fmtInt(lotsRowsFiltered.length)} lotes exibidos</div>
              </div>
            </div>

            {lotsCapAlertRows.length > 0 ? (
              <div className="herdCapAlert">
                <b>Aviso:</b> {fmtInt(lotsCapAlertRows.length)} lote(s) com custo fixo acima de {fmtBRL(FIXED_COST_CAP_PER_HEAD)}/cabeça.
                {" "}
                {lotsCapAlertRows
                  .slice(0, 4)
                  .map((r) => `${r.name} (${fmtBRL(r.fixedCostPerHead)}/cab)`)
                  .join(" • ")}
                {lotsCapAlertRows.length > 4 ? " • ..." : ""}
              </div>
            ) : (
              <div className="herdCapOk">
                Custo fixo por cabeça dentro do teto de {fmtBRL(FIXED_COST_CAP_PER_HEAD)} nos lotes exibidos.
              </div>
            )}

            <div className="herdLotsToolbar">
              <div className="left">
                <input
                  className="faz-input"
                  value={lotsSearch}
                  onChange={(e) => setLotsSearch(e.target.value)}
                  placeholder="Buscar lote, área ou categoria..."
                />
                <select className="faz-input" value={lotsCategory} onChange={(e) => setLotsCategory(e.target.value)}>
                  <option value="ALL">Todas categorias</option>
                  {lotCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="right">
                <span className="faz-pill">{fmtInt(lotsRowsFiltered.length)} lotes</span>
                <button className="faz-btn" type="button" onClick={() => { setLotsSearch(""); setLotsCategory("ALL"); }}>
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="faz-tableWrap">
              <table className="faz-table herdLotTable">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Animais hoje</th>
                    <th>Entrada na área</th>
                    <th>Área</th>
                    <th>Peso total</th>
                    <th>Peso médio</th>
                    <th>Peso @</th>
                    <th>Custo dos animais</th>
                    <th>Custo de compra</th>
                    <th>Custo nutrição</th>
                    <th>Custo fixo/cabeça</th>
                    <th>Status teto</th>
                  </tr>
                </thead>
                <tbody>
                  {lotsRowsFiltered.length === 0 ? (
                    <tr>
                      <td className="tdEmpty" colSpan={12}>
                        Nenhum lote encontrado nesse filtro.
                      </td>
                    </tr>
                  ) : (
                    lotsRowsFiltered.map((r) => (
                      <tr key={String(r.lotId)}>
                        <td>
                          <button
                            className="link tdStrong"
                            type="button"
                            onClick={() => {
                              setTab("operate");
                              setDestLotId(String(r.lotId));
                              setOpMsg(`Lote selecionado: ${r.name}.`);
                            }}
                          >
                            {r.name}
                          </button>
                        </td>
                        <td className="tdStrong">{fmtInt(r.heads)}</td>
                        <td>{r.entryDate}</td>
                        <td>{r.areaName || "—"}</td>
                        <td>{fmtKg(r.totalWeightKg)}</td>
                        <td>{fmtKg1(r.avgWeightKg)}</td>
                        <td>{fmtArroba(r.arrobas)} @</td>
                        <td className="herdMoney">{fmtBRL(r.costAnimals)}</td>
                        <td className="herdMoney">{fmtBRL(r.costCom)}</td>
                        <td className="herdMoney">{fmtBRL(r.costNutrition)}</td>
                        <td className={"herdMoney " + (r.fixedCapExceeded ? "herdMoneyCapBad" : "")}>
                          {fmtBRL(r.fixedCostPerHead || 0)}
                        </td>
                        <td>
                          <span className={"chip " + (r.fixedCapExceeded ? "bad" : "ok")}>
                            {r.fixedCapExceeded ? "Acima" : "OK"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "cadastro" && (
        <div className="card faz-block-shell">
          <div className="card-header-row faz-block-head">
            <div>
              <div style={{ fontWeight: 900 }}>Bovinos</div>
              <div className="card-subtitle">Painel executivo + cadastro operacional em uma única tela.</div>
            </div>
            <div className="faz-rowActions" style={{ marginLeft: "auto" }}>
              <button className="faz-btn" type="button" onClick={seedDemo}>
                Demo
              </button>
            </div>
          </div>

          <section className="herdBovinosBoard" style={{ marginTop: 12 }}>
            <div className="herdBovinosKpis">
              <article className="herdBovinosKpiCard">
                <div className="k">Total de animais</div>
                <div className="v">{fmtInt(bovinosDash.totalAnimais)}</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">Lotes com animais</div>
                <div className="v">{fmtInt(bovinosDash.lotesComAnimais)}</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">Peso total</div>
                <div className="v">{fmtKg(bovinosDash.pesoTotalKg)}</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">Peso médio</div>
                <div className="v">{fmtKg1(bovinosDash.pesoMedioKg)}</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">Peso total @</div>
                <div className="v">{fmtArroba(bovinosDash.pesoTotalArrobas)} @</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">GMD médio último peso</div>
                <div className="v">{fmtKgDay(bovinosDash.gmdUltimoPeso)}</div>
              </article>
              <article className="herdBovinosKpiCard">
                <div className="k">GMD médio geral</div>
                <div className="v">{fmtKgDay(bovinosDash.gmdMedioGeral)}</div>
              </article>
            </div>

            <div className="herdBovinosDistGrid">
              <article className="herdBovinosDistCard">
                <h4>Peso / Lote</h4>
                <p>Animais distribuídos por peso por lote.</p>
                <div className="herdBovinosBarList">
                  {bovinosDash.rowsByPeso.length === 0 ? (
                    <div className="texto-suave">Sem dados de peso por lote.</div>
                  ) : (
                    bovinosDash.rowsByPeso.map((r) => {
                      const raw = Number(r?.totalWeightKg || 0);
                      const pct = bovinosDash.maxPesoKg > 0 ? Math.round((raw / bovinosDash.maxPesoKg) * 100) : 0;
                      const w = raw > 0 ? Math.max(5, pct) : 0;
                      return (
                        <div key={`peso-${r.lotId}-${r.name}`} className="herdBovinosBarRow">
                          <div className="lot">{r.name}</div>
                          <div className="barTrack">
                            <span style={{ width: `${w}%` }} />
                          </div>
                          <div className="val">{fmtKg(raw)}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>

              <article className="herdBovinosDistCard">
                <h4>Cabeças / Lote</h4>
                <p>Animais distribuídos por lote.</p>
                <div className="herdBovinosBarList">
                  {bovinosDash.rowsByHeads.length === 0 ? (
                    <div className="texto-suave">Sem dados de cabeças por lote.</div>
                  ) : (
                    bovinosDash.rowsByHeads.map((r) => {
                      const raw = Number(r?.heads || 0);
                      const pct = bovinosDash.maxHeads > 0 ? Math.round((raw / bovinosDash.maxHeads) * 100) : 0;
                      const w = raw > 0 ? Math.max(5, pct) : 0;
                      return (
                        <div key={`head-${r.lotId}-${r.name}`} className="herdBovinosBarRow">
                          <div className="lot">{r.name}</div>
                          <div className="barTrack">
                            <span style={{ width: `${w}%` }} />
                          </div>
                          <div className="val">{fmtInt(raw)}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </div>
          </section>

          <div className="faz-detail-grid faz-block-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="form-label">Buscar brinco</label>
              <input className="input" value={gSearch} onChange={(e) => setGSearch(e.target.value)} placeholder="Ex.: A2402" />
            </div>

            <div>
              <label className="form-label">Categoria</label>
              <select className="input" value={gCat} onChange={(e) => setGCat(e.target.value)}>
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

            <div>
              <label className="form-label">Gestação</label>
              <select className="input" value={gPreg} onChange={(e) => setGPreg(e.target.value)}>
                <option value="ALL">Todas</option>
                <option value="PRENHA">Prenha</option>
                <option value="VAZIA">Vazia</option>
                <option value="ND">Não informado</option>
              </select>
            </div>

            <div>
              <label className="form-label">Vacina</label>
              <select className="input" value={gVac} onChange={(e) => setGVac(e.target.value)}>
                <option value="ALL">Todas</option>
                <option value="DUE">Atrasada</option>
                <option value="MISSING">Sem registro</option>
              </select>
            </div>
          </div>

          <div className="faz-tableWrap" style={{ marginTop: 12 }}>
            <table className="faz-table faz-cadastro-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Sexo</th>
                  <th>Lote</th>
                  <th>Peso (kg)</th>
                  <th>Peso (@)</th>
                  <th>Data</th>
                  <th>GMD geral</th>
                  <th>Categoria</th>
                  <th>Raça</th>
                  <th>Nascimento</th>
                  <th>Idade (meses)</th>
                  <th>Situação reprodutiva</th>
                  <th>Número mãe</th>
                  <th style={{ width: 220 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cadastroRows.length === 0 ? (
                  <tr>
                    <td className="tdEmpty" colSpan={14}>
                      Nenhum animal encontrado.
                    </td>
                  </tr>
                ) : (
                  cadastroRows.map((a) => {
                    const h = healthFor(a.ear);
                    const sheet = h.sheet || {};
                    const ear = normEar(a.ear);
                    const sexo = normalizeSexValue(sheet.sexoLabel || a.sex) || String(a.sex || "").toUpperCase() || "—";
                    const lote = asText(sheet.loteLabel || animalLotLabel(a) || "—");
                    const gmdBase = calcAnimalGmdFromHistory(a, weighs);
                    const gmdGeral = Number.isFinite(Number(sheet.gmdGeral)) ? Number(sheet.gmdGeral) : gmdBase;
                    const pesoKg = Number.isFinite(Number(a.lastWeightKg)) ? Number(a.lastWeightKg) : null;
                    const pesoArroba = Number.isFinite(Number(sheet.pesoArroba))
                      ? Number(sheet.pesoArroba)
                      : Number.isFinite(pesoKg)
                      ? Number((pesoKg / 15).toFixed(2))
                      : null;
                    const dataPeso = sheet.dataPeso || a.lastWeighedAt || "";
                    const categoria = asText(sheet.categoriaLabel || a.category || "");
                    const idadeMeses = Number.isFinite(Number(sheet.idadeMeses))
                      ? Number(sheet.idadeMeses)
                      : ageMonths(h.birth);
                    const pregSt = String(h.pregStatus || "").toUpperCase();
                    const situacaoRep = asText(
                      sheet.situacaoReprodutiva ||
                      (pregSt === "PRENHA" ? "Prenha" : pregSt === "VAZIA" ? "Vazia" : "")
                    );
                    return (
                      <React.Fragment key={a.ear}>
                        <tr
                          onClick={() => openEdit(a.ear)}
                          style={{ cursor: "pointer" }}
                          title={`Abrir cadastro do animal ${ear}`}
                        >
                          <td>
                            <div className="cad-main">{ear}</div>
                          </td>
                          <td>
                            <div className="cad-main">{sexo === "F" ? "Fêmea" : sexo === "M" ? "Macho" : sexo}</div>
                          </td>
                          <td>
                            <div className="cad-main">{lote || "—"}</div>
                          </td>
                          <td>
                            <div className="cad-main">{fmtKg(pesoKg)}</div>
                          </td>
                          <td>
                            <div className="cad-main">{pesoArroba == null ? "—" : `${fmtArroba(pesoArroba)} @`}</div>
                          </td>
                          <td>
                            <div className="cad-main">{fmtDateShort(dataPeso)}</div>
                          </td>
                          <td>
                            {gmdGeral == null ? (
                              <div className="cad-main">—</div>
                            ) : (
                              <div className={"cad-main " + (gmdGeral >= 0 ? "is-pos" : "is-neg")}>
                                {gmdGeral > 0 ? "+" : ""}{gmdGeral.toFixed(2)} kg/dia
                              </div>
                            )}
                          </td>
                          <td><div className="cad-main">{categoria || "—"}</div></td>
                          <td><div className="cad-main">{sheet.raca || "—"}</div></td>
                          <td><div className="cad-main">{h.birth ? fmtDateShort(h.birth) : "—"}</div></td>
                          <td><div className="cad-main">{idadeMeses == null ? "—" : String(idadeMeses)}</div></td>
                          <td><div className="cad-main">{situacaoRep || "—"}</div></td>
                          <td><div className="cad-main">{sheet.numeroMae || "—"}</div></td>
                          <td>
                            <div className="faz-rowActions cad-actions" style={{ justifyContent: "flex-start" }}>
                              <button className="faz-btn" type="button" onClick={(evt) => handleOpenEdit(evt, a.ear)}>
                                Mais informações
                              </button>
                              <button
                                className="faz-btn"
                                type="button"
                                onClick={(evt) => {
                                  evt?.preventDefault?.();
                                  evt?.stopPropagation?.();
                                  goOperateEar(a.ear, "");
                                }}
                              >
                                Pesar
                              </button>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editOpen ? (
        <div className="faz-modalBack" role="dialog" aria-modal="true" onClick={() => setEditOpen(false)}>
          <div className="faz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="faz-modalHead">
              <div>
                <div className="faz-modalTitle">Cadastro do animal • {editEar}</div>
                <div className="faz-modalSub">Ficha rápida do animal com dados operacionais, reprodução e vacina.</div>
              </div>
              <div className="faz-rowActions">
                <button
                  className="faz-btn"
                  type="button"
                  onClick={() => {
                    if (editEar) goOperateEar(editEar, "");
                  }}
                >
                  Pesar agora
                </button>
                <button className="faz-btn" type="button" onClick={() => setEditOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>

            <div className="faz-subtabs faz-modalTabs" style={{ marginTop: 12 }}>
              <button type="button" className={"faz-subtab" + (editView === "resumo" ? " is-active" : "")} onClick={() => setEditView("resumo")}>
                Resumo
              </button>
              <button type="button" className={"faz-subtab" + (editView === "reproducao" ? " is-active" : "")} onClick={() => setEditView("reproducao")}>
                Reprodução
              </button>
              <button type="button" className={"faz-subtab" + (editView === "clinica" ? " is-active" : "")} onClick={() => setEditView("clinica")}>
                Clínica
              </button>
              <button type="button" className={"faz-subtab" + (editView === "sanidade" ? " is-active" : "")} onClick={() => setEditView("sanidade")}>
                Sanidade
              </button>
              <button type="button" className={"faz-subtab" + (editView === "pesagens" ? " is-active" : "")} onClick={() => setEditView("pesagens")}>
                Pesagens
              </button>
            </div>

            {editAnimalData ? (
              <>
                {editView === "resumo" ? (
                  <>
                    <div className="faz-modalSummary">
                      <div className="faz-stat">
                        <div className="k">Brinco</div>
                        <div className="v">{editAnimalData.ear}</div>
                        <div className="s">{editAnimalData.sexoLabel}</div>
                      </div>
                      <div className="faz-stat">
                        <div className="k">Lote</div>
                        <div className="v">{editAnimalData.loteLabel}</div>
                        <div className="s">{editAnimalData.categoriaLabel}</div>
                      </div>
                      <div className="faz-stat">
                        <div className="k">Peso atual</div>
                        <div className="v">{fmtKg(editAnimalData.pesoKg)}</div>
                        <div className="s">
                          {editAnimalData.pesoArroba == null ? "Sem arroba calculada" : `${fmtArroba(editAnimalData.pesoArroba)} @`}
                        </div>
                      </div>
                      <div className={"faz-stat " + (editAnimalData.gmdGeral != null && editAnimalData.gmdGeral >= 0 ? "is-pos" : "")}>
                        <div className="k">GMD geral</div>
                        <div className="v">
                          {editAnimalData.gmdGeral == null ? "—" : `${editAnimalData.gmdGeral > 0 ? "+" : ""}${editAnimalData.gmdGeral.toFixed(2)} kg`}
                        </div>
                        <div className="s">por dia</div>
                      </div>
                      <div className="faz-stat">
                        <div className="k">Idade</div>
                        <div className="v">{editAnimalData.idadeAtual}</div>
                        <div className="s">
                          {editAnimalData.health.birth ? fmtDateShort(editAnimalData.health.birth) : "Nascimento não informado"}
                        </div>
                      </div>
                      <div className={"faz-stat " + (editAnimalData.vacStatus === "Atrasada" ? "is-warn" : "")}>
                        <div className="k">Vacina</div>
                        <div className="v">{editAnimalData.vacStatus}</div>
                        <div className="s">
                          {editAnimalData.health.vacName
                            ? `${editAnimalData.health.vacName} • ${fmtDateShort(editAnimalData.health.vacDate)}`
                            : "Sem registro"}
                        </div>
                      </div>
                    </div>

                    <div className="faz-modalFacts">
                      <div className="faz-modalSection">
                        <div className="faz-modalSectionTitle">Leitura operacional</div>
                        <div className="faz-modalInfoGrid">
                          <div className="faz-modalInfoItem">
                            <span className="lbl">Raça</span>
                            <strong>{editAnimalData.raca}</strong>
                          </div>
                          <div className="faz-modalInfoItem">
                            <span className="lbl">Data da última pesagem</span>
                            <strong>{fmtDateShort(editAnimalData.dataPeso)}</strong>
                          </div>
                          <div className="faz-modalInfoItem">
                            <span className="lbl">Situação reprodutiva</span>
                            <strong>{editAnimalData.situacaoReprodutiva}</strong>
                          </div>
                          <div className="faz-modalInfoItem">
                            <span className="lbl">Número da mãe</span>
                            <strong>{editAnimalData.numeroMae}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="faz-modalSection">
                        <div className="faz-modalSectionTitle">Ações rápidas</div>
                        <div className="faz-rowActions" style={{ justifyContent: "flex-start", marginBottom: 10 }}>
                          <button
                            className="faz-btn"
                            type="button"
                            onClick={() => {
                              if (editAnimalData.ear) goOperateEar(editAnimalData.ear, "");
                              setEditOpen(false);
                            }}
                          >
                            Abrir no operar
                          </button>
                          <button
                            className="faz-btn"
                            type="button"
                            onClick={() => openTransferForEar(editAnimalData.ear)}
                          >
                            Mover de lote
                          </button>
                          <button
                            className="faz-btn"
                            type="button"
                            onClick={() => setEditView("sanidade")}
                          >
                            Registrar vacina
                          </button>
                          <button
                            className="faz-btn danger"
                            type="button"
                            onClick={() => openBaixaForEar(editAnimalData.ear)}
                          >
                            Dar baixa
                          </button>
                        </div>
                        <div className="texto-suave">
                          As ações abrem o fluxo correto já com o brinco preparado, para evitar retrabalho e reduzir erro operacional.
                        </div>
                      </div>

                      <div className="faz-modalSection">
                        <div className="faz-modalSectionTitle">Alertas e próximos passos</div>
                        <div className="faz-badges">
                          <span className={"faz-badge " + (editAnimalData.situacaoReprodutiva === "Prenha" ? "is-ok" : "is-warn")}>
                            Reprodução: {editAnimalData.situacaoReprodutiva}
                          </span>
                          <span className={"faz-badge " + (editAnimalData.vacStatus === "Atrasada" ? "is-bad" : "is-ok")}>
                            Vacina: {editAnimalData.vacStatus}
                          </span>
                          {String(editAnimalData.clinicalStatus || "").toUpperCase() !== "ESTAVEL" ? (
                            <span className={"faz-badge " + (String(editAnimalData.clinicalStatus || "").toUpperCase() === "TRATAMENTO" ? "is-bad" : "is-warn")}>
                              Clínica: {editAnimalData.clinicalStatus}
                            </span>
                          ) : null}
                          {editAnimalData.bodyScore != null && editAnimalData.bodyScore < 2.5 ? (
                            <span className="faz-badge is-warn">
                              Escore corporal baixo: {editAnimalData.bodyScore.toFixed(1)}
                            </span>
                          ) : null}
                          <span className="faz-badge">
                            Última pesagem: {fmtDateShort(editAnimalData.dataPeso)}
                          </span>
                          {editAnimalData.dpp ? (
                            <span className="faz-badge is-ok">DPP estimada: {fmtDateShort(editAnimalData.dpp)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {editView === "reproducao" ? (
                  <div className="faz-modalFacts">
                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Situação reprodutiva</div>
                      <div className="faz-modalInfoGrid">
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Situação atual</span>
                          <strong>{editAnimalData.situacaoReprodutiva}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Número da mãe</span>
                          <strong>{editAnimalData.numeroMae}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Cobertura / IA</span>
                          <strong>{fmtDateShort(editPregStart)}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">DPP estimada</span>
                          <strong>{fmtDateShort(editPregStart ? dppIso(editPregStart) : "")}</strong>
                        </div>
                      </div>

                      <div className="faz-rowActions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            setEditPreg("PRENHA");
                            if (!editPregStart) setEditPregStart(todayIso());
                          }}
                        >
                          Marcar prenha
                        </button>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            setEditPreg("VAZIA");
                            setEditPregStart("");
                          }}
                        >
                          Marcar vazia
                        </button>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            if (!editReproProtocol) setEditReproProtocol("IATF");
                            if (!editPregStart) setEditPregStart(todayIso());
                            setEditView("clinica");
                          }}
                        >
                          Abrir protocolo
                        </button>
                      </div>
                      <div className="texto-suave" style={{ marginTop: 8 }}>
                        Esses atalhos preparam a ficha para o manejo reprodutivo sem obrigar o operador a preencher tudo do zero.
                      </div>
                    </div>

                    <div className="faz-modalGrid">
                      <div>
                        <label className="form-label">Situação reprodutiva</label>
                        <select className="input" value={editPreg} onChange={(e) => setEditPreg(e.target.value)}>
                          <option value="ND">Não informado</option>
                          <option value="VAZIA">Vazia</option>
                          <option value="PRENHA">Prenha</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Data IA/Cobertura</label>
                        <input
                          className="input"
                          type="date"
                          value={editPregStart}
                          onChange={(e) => setEditPregStart(e.target.value)}
                          disabled={String(editPreg || "").toUpperCase() !== "PRENHA"}
                        />
                        <div className="texto-suave" style={{ marginTop: 6 }}>
                          Se estiver prenha, o sistema calcula DPP em 283 dias.
                        </div>
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="form-label">Observação reprodutiva</label>
                        <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ex.: confirmar prenhez no próximo manejo" />
                      </div>
                    </div>

                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Histórico reprodutivo</div>
                      {editAnimalHistory.reproduction.length ? (
                        <div className="faz-historyList">
                          {editAnimalHistory.reproduction.map((row) => (
                            <div key={row.key} className="faz-historyRow">
                              <div>
                                <div className="main">{row.main}</div>
                                <div className="sub">{row.sub}</div>
                              </div>
                              <div className="value">{row.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="texto-suave">Ainda não há histórico reprodutivo suficiente para este animal.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {editView === "clinica" ? (
                  <div className="faz-modalFacts">
                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Leitura clínica</div>
                      <div className="faz-modalInfoGrid">
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Status clínico</span>
                          <strong>{editAnimalData.clinicalStatus}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Escore corporal</span>
                          <strong>{editAnimalData.bodyScore == null ? "—" : editAnimalData.bodyScore.toFixed(1)}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Locomoção</span>
                          <strong>{editAnimalData.locomotionScore == null ? "—" : editAnimalData.locomotionScore.toFixed(1)}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Última avaliação</span>
                          <strong>{fmtDateShort(editAnimalData.clinicalDate)}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Protocolo reprodutivo</span>
                          <strong>{editAnimalData.reproProtocol}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Observação clínica</span>
                          <strong>{editAnimalData.clinicalNote}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Último tratamento</span>
                          <strong>{fmtDateShort(editAnimalData.treatmentDate)}</strong>
                        </div>
                        <div className="faz-modalInfoItem">
                          <span className="lbl">Motivo / conduta</span>
                          <strong>
                            {[editAnimalData.treatmentReason, editAnimalData.treatmentConduct]
                              .filter((part) => part && part !== "—")
                              .join(" • ") || "—"}
                          </strong>
                        </div>
                      </div>

                      <div className="faz-rowActions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            setEditClinicalStatus("ATENCAO");
                            if (!editClinicalDate) setEditClinicalDate(todayIso());
                          }}
                        >
                          Marcar atenção
                        </button>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => {
                            setEditClinicalStatus("TRATAMENTO");
                            if (!editClinicalDate) setEditClinicalDate(todayIso());
                            if (!editTreatmentDate) setEditTreatmentDate(todayIso());
                          }}
                        >
                          Registrar tratamento
                        </button>
                        <button
                          className="faz-btn danger"
                          type="button"
                          onClick={() => {
                            setEditClinicalStatus("DESCARTE");
                            if (!editClinicalDate) setEditClinicalDate(todayIso());
                          }}
                        >
                          Avaliar descarte
                        </button>
                        <button
                          className="faz-btn"
                          type="button"
                          onClick={() => setEditView("sanidade")}
                        >
                          Abrir sanidade
                        </button>
                      </div>
                      <div className="texto-suave" style={{ marginTop: 8 }}>
                        Use os atalhos para registrar o contexto clínico primeiro e ajustar o detalhe fino logo abaixo.
                      </div>
                    </div>

                    <div className="faz-modalGrid">
                      <div>
                        <label className="form-label">Status clínico</label>
                        <select className="input" value={editClinicalStatus} onChange={(e) => setEditClinicalStatus(e.target.value)}>
                          <option value="ESTAVEL">Estável</option>
                          <option value="ATENCAO">Atenção</option>
                          <option value="TRATAMENTO">Em tratamento</option>
                          <option value="DESCARTE">Avaliar descarte</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Escore corporal</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          value={editBodyScore}
                          onChange={(e) => setEditBodyScore(e.target.value)}
                          placeholder="1 a 5"
                        />
                      </div>

                      <div>
                        <label className="form-label">Locomoção</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          value={editLocomotionScore}
                          onChange={(e) => setEditLocomotionScore(e.target.value)}
                          placeholder="1 a 5"
                        />
                      </div>

                      <div>
                        <label className="form-label">Data da avaliação</label>
                        <input className="input" type="date" value={editClinicalDate} onChange={(e) => setEditClinicalDate(e.target.value)} />
                      </div>

                      <div>
                        <label className="form-label">Protocolo reprodutivo</label>
                        <input
                          className="input"
                          value={editReproProtocol}
                          onChange={(e) => setEditReproProtocol(e.target.value)}
                          placeholder="Ex.: IATF lote A"
                        />
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="form-label">Observação clínica</label>
                        <input
                          className="input"
                          value={editClinicalNote}
                          onChange={(e) => setEditClinicalNote(e.target.value)}
                          placeholder="Ex.: casco sensível, revisar no próximo manejo"
                        />
                      </div>
                    </div>

                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Fluxo de tratamento</div>
                      <div className="faz-modalGrid" style={{ marginTop: 0 }}>
                        <div>
                          <label className="form-label">Data do tratamento</label>
                          <input className="input" type="date" value={editTreatmentDate} onChange={(e) => setEditTreatmentDate(e.target.value)} />
                        </div>

                        <div>
                          <label className="form-label">Motivo</label>
                          <input
                            className="input"
                            value={editTreatmentReason}
                            onChange={(e) => setEditTreatmentReason(e.target.value)}
                            placeholder="Ex.: claudicação, mastite, queda de escore"
                          />
                        </div>

                        <div>
                          <label className="form-label">Conduta</label>
                          <input
                            className="input"
                            value={editTreatmentConduct}
                            onChange={(e) => setEditTreatmentConduct(e.target.value)}
                            placeholder="Ex.: antibiótico, observação, manejo separado"
                          />
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="form-label">Observação do tratamento</label>
                          <input
                            className="input"
                            value={editTreatmentObservation}
                            onChange={(e) => setEditTreatmentObservation(e.target.value)}
                            placeholder="Ex.: responder em 72h, revisar casco no próximo curral"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Histórico clínico</div>
                      {editAnimalHistory.clinical.length ? (
                        <div className="faz-historyList">
                          {editAnimalHistory.clinical.map((row) => (
                            <div key={row.key} className="faz-historyRow">
                              <div>
                                <div className="main">{row.main}</div>
                                <div className="sub">{row.sub}</div>
                              </div>
                              <div className="value">{row.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="texto-suave">Ainda não há histórico clínico registrado para este animal.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {editView === "sanidade" ? (
                  <div className="faz-modalFacts">
                    <div className="faz-modalSection">
                      <div className="faz-modalSectionTitle">Status sanitário</div>
                      <div className="faz-badges">
                        <span className={"faz-badge " + (editAnimalData.vacStatus === "Atrasada" ? "is-bad" : "is-ok")}>
                          Vacina: {editAnimalData.vacStatus}
                        </span>
                        <span className="faz-badge">
                          Última aplicação: {fmtDateShort(editVacDate)}
                        </span>
                        <span className="faz-badge">
                          Próxima dose: {fmtDateShort(editVacNext)}
                        </span>
                      </div>
                    </div>

                    <div className="faz-modalGrid">
                      <div>
                        <label className="form-label">Vacina (nome)</label>
                        <input className="input" value={editVacName} onChange={(e) => setEditVacName(e.target.value)} placeholder="Ex.: Aftosa" />
                      </div>

                      <div>
                        <label className="form-label">Data da vacina</label>
                        <input className="input" type="date" value={editVacDate} onChange={(e) => setEditVacDate(e.target.value)} />
                      </div>

                      <div>
                        <label className="form-label">Próxima vacina</label>
                        <input className="input" type="date" value={editVacNext} onChange={(e) => setEditVacNext(e.target.value)} />
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="form-label">Observação sanitária</label>
                        <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ex.: reforçar vacina no lote todo" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {editView === "pesagens" ? (
                  <div className="faz-ficha-grid faz-modalPanels">
                    <div className="faz-panel">
                      <div className="faz-modalSectionTitle">Pesagens recentes</div>
                      {editAnimalHistory.weighs.length ? (
                        <div className="faz-historyList">
                          {editAnimalHistory.weighs.map((row) => (
                            <div key={row.key} className="faz-historyRow">
                              <div>
                                <div className="main">{fmtDateShort(row.date)}</div>
                                <div className="sub">
                                  {row.arroba == null ? "Sem arroba" : `${fmtArroba(row.arroba)} @`}
                                  {row.delta == null ? "" : ` • ${row.delta >= 0 ? "+" : ""}${fmtKg1(row.delta)}`}
                                </div>
                              </div>
                              <div className="value">{fmtKg(row.kg)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="faz-emptyNice">Ainda não há histórico de pesagem para este animal.</div>
                      )}
                    </div>

                    <div className="faz-panel">
                      <div className="faz-modalSectionTitle">Linha do tempo</div>
                      {editAnimalHistory.timeline.length ? (
                        editAnimalHistory.timeline.map((item) => (
                          <div key={item.key} className="faz-timeline-row">
                            <span className="dot" />
                            <div>
                              <div style={{ fontWeight: 900 }}>{item.label}</div>
                              <div className="texto-suave">
                                {fmtDateShort(item.date)}
                                {item.detail ? ` • ${item.detail}` : ""}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="faz-emptyNice">Sem eventos registrados ainda para este animal.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {editView === "resumo" ? (
              <div className="faz-modalGrid">
                <div>
                  <label className="form-label">Data de nascimento</label>
                  <input className="input" type="date" value={editBirth} onChange={(e) => setEditBirth(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Observação geral</label>
                  <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ex.: confirmar dados no próximo manejo" />
                </div>
              </div>
            ) : null}

            <div className="faz-modalActions">
              <button className="faz-btn primary" type="button" onClick={saveEdit}>
                Salvar
              </button>
              <button className="faz-btn" type="button" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {importOpen ? (
        <div className="faz-modalBack" role="dialog" aria-modal="true" onClick={() => setImportOpen(false)}>
          <div className="faz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="faz-modalHead">
              <div>
                <div className="faz-modalTitle">Carregar lista de brincos</div>
                <div className="faz-modalSub">Importe por planilha com os campos do animal ou cole só os brincos.</div>
              </div>
              <button className="faz-btn" type="button" onClick={() => setImportOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="faz-modalGrid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Brincos (um por linha)</label>
                <textarea
                  className="input"
                  rows={7}
                  value={importRaw}
                  onChange={(e) => setImportRaw(e.target.value)}
                  placeholder={"001\n002\n003\n004"}
                />
                <div className="faz-rowActions" style={{ marginTop: 8, justifyContent: "flex-start" }}>
                  <button className="faz-btn" type="button" onClick={openImportFilePicker}>
                    Escolher planilha (.xlsx/.csv)
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">Categoria</label>
                <select className="input" value={importCat} onChange={(e) => setImportCat(e.target.value)}>
                  <option value="BEZERRO">Bezerro</option>
                  <option value="BEZERRA">Bezerra</option>
                  <option value="NOVILHA">Novilha</option>
                  <option value="VACA">Vaca</option>
                  <option value="BOI">Boi</option>
                  <option value="TOURO">Touro</option>
                </select>
              </div>

              <div>
                <label className="form-label">Sexo</label>
                <select className="input" value={importSex} onChange={(e) => setImportSex(e.target.value)}>
                  <option value="M">Macho</option>
                  <option value="F">Fêmea</option>
                </select>
              </div>

              <div>
                <label className="form-label">Manga</label>
                <select className="input" value={importLotId} onChange={(e) => setImportLotId(e.target.value)}>
                  {lotsSorted.map((l) => (
                    <option key={String(l.id)} value={String(l.id)}>
                      {l.name || `Manga ${String(l.id).padStart(2, "0")}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Data da pesagem</label>
                <input className="input" type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)} />
              </div>

              <div>
                <label className="form-label">Peso único (kg) para todos</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={importWeight}
                  onChange={(e) => setImportWeight(e.target.value)}
                  placeholder="Ex.: 30"
                />
                <div className="texto-suave" style={{ marginTop: 6 }}>
                  Se deixar vazio, cadastra sem peso.
                </div>
                {importFileRows.length ? (
                  <label className="pill" style={{ cursor: "pointer", marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={importUseFileWeight}
                      onChange={(e) => setImportUseFileWeight(e.target.checked)}
                    />
                    Usar peso da planilha (quando existir)
                  </label>
                ) : null}
              </div>

              <div>
                <label className="form-label">Duplicados</label>
                <label className="pill" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={importIgnoreExisting}
                    onChange={(e) => setImportIgnoreExisting(e.target.checked)}
                  />
                  Ignorar brincos já existentes
                </label>
              </div>
            </div>

            {!Number.isFinite(parseFloatPt(importWeight)) || parseFloatPt(importWeight) <= 0 ? null : (
              <div className="texto-suave" style={{ marginTop: 10 }}>
                Observação: peso fora de 80–900 kg será marcado como fora do padrão no caderno de campo.
              </div>
            )}

            {importMsg ? <div className="texto-suave" style={{ marginTop: 10 }}>{importMsg}</div> : null}

            <div className="faz-modalActions">
              <button className="faz-btn primary" type="button" onClick={importAnimalsNow}>
                Importar lote
              </button>
              <button className="faz-btn" type="button" onClick={() => setImportOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        style={{ display: "none" }}
        onChange={onImportFileChange}
      />
    </div>
  );
}
