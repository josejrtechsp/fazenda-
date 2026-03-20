import React, { useEffect, useMemo, useState } from "react";
import FazendaTopHeader from "./components/FazendaTopHeader.jsx";
import CrasSidebarNav from "./components/CrasSidebarNav.jsx";
import OnboardingOverlay from "./components/OnboardingOverlay.jsx";

import ProducerDashboard from "./pages/ProducerDashboard.jsx";
import StartPage from "./pages/StartPage.jsx";
import WhatsAppValidations from "./pages/WhatsAppValidations.jsx";
import Financeiro from "./pages/Financeiro.jsx";
import FinanceiroCadastros from "./pages/FinanceiroCadastros.jsx";
import NutricaoComprasItens from "./pages/NutricaoComprasItens.jsx";
import EstoqueFarmacia from "./pages/EstoqueFarmacia.jsx";
import EstoqueSemenEmbrioes from "./pages/EstoqueSemenEmbrioes.jsx";
import EstoqueNutricional from "./pages/EstoqueNutricional.jsx";
import AreasPasture from "./pages/AreasPasture.jsx";
import Transfers from "./pages/Transfers.jsx";
import AreaDetail from "./pages/AreaDetail.jsx";
import Herd from "./pages/Herd.jsx";
import { fetchPendingSnapshot, getOperationalPendingCount, readPendingCountLocal } from "./lib/herdSignals.js";
import { bootstrapLegacyInventoryToBackend } from "./lib/inventorySignals.js";
import "./styles/ideal_brand_lockup.css";

function currentMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const LS_APP = {
  monthKey: "fazenda_month_key",
  mode: "fazenda_mode_v1",
  active: "fazenda_active_v1",
};

const VAQUEIRO_ALLOWED = new Set(["herd", "areas", "moves", "start"]);

function flattenMenuItems(groups = []) {
  const out = [];
  const walk = (item) => {
    out.push(item);
    (item.children || []).forEach(walk);
  };
  (groups || []).forEach((g) => (g.items || []).forEach(walk));
  return out;
}

export default function FazendaApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");

  // -----------------------------
  // Onboarding (Primeiros 5 minutos)
  // -----------------------------
  const [onbOpen, setOnbOpen] = useState(false);
  const [onbDone, setOnbDone] = useState(() => {
    try {
      return localStorage.getItem("fazenda_onboarding_v1_done") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readDone = () => {
      try {
        return localStorage.getItem("fazenda_onboarding_v1_done") === "1";
      } catch {
        return false;
      }
    };

    const maybeAutoOpen = () => {
      try {
        if (readDone()) return;
        const raw = localStorage.getItem("fazenda_onboarding_v1_state");
        const st = raw ? JSON.parse(raw) : null;
        const dismissed = !!st?.dismissed;
        const seen = !!st?.seen;
        if (!dismissed && !seen) {
          setOnbOpen(true);
          localStorage.setItem(
            "fazenda_onboarding_v1_state",
            JSON.stringify({ ...(st || {}), seen: true })
          );
        }
      } catch {
        // se falhar, não trava
      }
    };

    maybeAutoOpen();

    const onOpen = () => setOnbOpen(true);
    const onUpdate = () => setOnbDone(readDone());

    window.addEventListener("fazenda_onboarding_open", onOpen);
    window.addEventListener("fazenda_onboarding_updated", onUpdate);
    window.addEventListener("storage", onUpdate);

    return () => {
      window.removeEventListener("fazenda_onboarding_open", onOpen);
      window.removeEventListener("fazenda_onboarding_updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

// -----------------------------
// Pendências (badge global do Rebanho)
// -----------------------------
const [pendingCount, setPendingCount] = useState(() => {
  return readPendingCountLocal();
});

useEffect(() => {
  if (typeof window === "undefined") return;
  let alive = true;
  const refresh = async () => {
    try {
      const snapshot = await fetchPendingSnapshot({ limit: 1, staleDays: 60 });
      if (alive) setPendingCount(getOperationalPendingCount(snapshot));
    } catch {
      if (alive) setPendingCount(readPendingCountLocal());
    }
  };
  const on = () => { void refresh(); };
  on();
  window.addEventListener("focus", on);
  window.addEventListener("fazenda_pending_updated", on);
  window.addEventListener("storage", on);
  return () => {
    alive = false;
    window.removeEventListener("focus", on);
    window.removeEventListener("fazenda_pending_updated", on);
    window.removeEventListener("storage", on);
  };
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;
  let cancelled = false;

  const syncInventory = async () => {
    try {
      await bootstrapLegacyInventoryToBackend();
    } catch {
      // sem bloquear a navegação principal
    }
  };

  void syncInventory();
  const onFocus = () => {
    if (!cancelled) void syncInventory();
  };
  window.addEventListener("focus", onFocus);
  return () => {
    cancelled = true;
    window.removeEventListener("focus", onFocus);
  };
}, []);


  // -----------------------------
  // Modo (Produtor x Vaqueiro)
  // -----------------------------
  const initialMode = (() => {
    try {
      const saved = (localStorage.getItem(LS_APP.mode) || "").toLowerCase();
      if (saved === "vaqueiro" || saved === "produtor") return saved;
    } catch {}
    // padrao novo: vaqueiro (operacao)
    return "vaqueiro";
  })();

  const [mode, setMode] = useState(initialMode);

  const initialActive = (() => {
    try {
      const saved = (localStorage.getItem(LS_APP.active) || "").toString();
      if (saved) {
        if (initialMode === "vaqueiro" && !VAQUEIRO_ALLOWED.has(saved) && saved !== "home") return "herd";
        return saved;
      }
    } catch {}
    return initialMode === "vaqueiro" ? "herd" : "home";
  })();

  const [active, setActive] = useState(initialActive);

  useEffect(() => {
    try {
      localStorage.setItem(LS_APP.mode, mode);
    } catch {}
  }, [mode, pendingCount]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_APP.active, active);
    } catch {}
  }, [active]);

  function changeMode(next) {
    const m = next === "produtor" ? "produtor" : "vaqueiro";
    setMode(m);
    setQuery("");
    // Ao trocar o modo, muda a tela padrao (reduz friccao)
    if (m === "vaqueiro") setActive("herd");
    else setActive("home");
    if (navOpen) setNavOpen(false);
  }

  // -----------------------------
  // Mes do produtor
  // -----------------------------
  const [monthKey, setMonthKey] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_APP.monthKey) || "";
      return saved || currentMonthKey();
    } catch {
      return currentMonthKey();
    }
  });

  function setMonth(k) {
    setMonthKey(k);
    try {
      localStorage.setItem(LS_APP.monthKey, k);
    } catch {}
  }

  // -----------------------------
  // Navegacao contextual
  // -----------------------------
  const [areaFocus, setAreaFocus] = useState(null);
  const [transferPrefill, setTransferPrefill] = useState(null);

  // UX — Drawer: fecha ao ampliar tela / ESC
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 980px)");
    const sync = () => {
      if (!mq.matches) setNavOpen(false);
    };
    sync();
    const onChange = () => sync();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => {
      if (e && e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // -----------------------------
  // Menu (muda por modo)
  // -----------------------------
  const groups = useMemo(() => {
    if (mode === "vaqueiro") {
      return [
        {
          title: "Início",
          items: [{ key: "start", title: "Início", sub: "Começar / Atalhos", icon: "home" }],
        },
        {
          title: "Operacao rapida",
          items: [
            { key: "herd", title: "Rebanho", sub: "Brinco → registrar", icon: "grid", badge: pendingCount > 0 ? (pendingCount > 99 ? "99+" : String(pendingCount)) : null },
            { key: "moves", title: "Movimentacoes", sub: "Transferencias", icon: "shuffle" },
            { key: "areas", title: "Mangas & Pasto", sub: "Ocupacao", icon: "map" },
          ],
        },
        {
          title: "Produtor",
          items: [{ key: "home", title: "Visao do produtor", sub: "R$/@ e resumo", icon: "home" }],
        },
      ];
    }

    return [
      {
        title: "Início",
        items: [{ key: "start", title: "Atalhos", sub: "Começar / Ações rápidas", icon: "home" }],
      },
      {
        title: "Visao do produtor",
        items: [
          { key: "home", title: "Inicio (Mes)", sub: "R$/@ e resumo", icon: "home" },
          { key: "reports", title: "Relatorios", sub: "Exportacoes", icon: "file" },
        ],
      },
      {
        title: "Operacao",
        items: [
          { key: "herd", title: "Rebanho", sub: "Lotes e animais", icon: "grid", badge: pendingCount > 0 ? (pendingCount > 99 ? "99+" : String(pendingCount)) : null },
          { key: "areas", title: "Mangas & Pasto", sub: "Ocupacao e descanso", icon: "map" },
          { key: "moves", title: "Movimentacoes", sub: "Transferencias", icon: "shuffle" },
          {
            key: "stock",
            title: "Estoque",
            sub: "Inventário da fazenda",
            icon: "package",
            children: [
              { key: "stock_farmacia", title: "Farmácia", icon: "package" },
              { key: "stock_semen", title: "Sêmen e Embriões", icon: "package" },
              { key: "stock_nutricional", title: "Nutricional", icon: "package" },
            ],
          },
          { key: "health", title: "Sanidade", sub: "Protocolos", icon: "shield" },
        ],
      },
      {
        title: "Integracao",
        items: [{ key: "whatsapp", title: "WhatsApp", sub: "Validacoes", icon: "message" }],
      },
      {
        title: "Financeiro",
        items: [
          { key: "finance", title: "Custos & Receitas", sub: "Sempre por @", icon: "bar" },
          { key: "settings", title: "Configuracoes", sub: "Fazenda e dicionario", icon: "settings" },
        ],
      },
    ];
  }, [mode, pendingCount]);

  const activeLabel = useMemo(() => {
    const items = flattenMenuItems(groups);
    const found = items.find((x) => x.key === active);
    return found?.title || found?.label || "—";
  }, [groups, active]);

  // Se estiver no modo vaqueiro e cair em algo fora do permitido, puxa para Rebanho
  useEffect(() => {
    if (mode !== "vaqueiro") return;
    if (VAQUEIRO_ALLOWED.has(active) || active === "home") return;
    setActive("herd");
  }, [mode, active]);


  // Navegação central (usada pelo onboarding)
  const goTo = (opts) => {
    const o = opts || {};
    const targetMode = o.mode;
    const targetActive = o.active;
    const hint = o.hint;

    try {
      if (hint && targetActive === "herd") {
        localStorage.setItem("fazenda_nav_herd_open_v1", JSON.stringify(hint));
        window.dispatchEvent(new Event("fazenda_nav_herd_open_v1"));
      }
    } catch {}

    if (targetMode) setMode(String(targetMode));
    if (targetActive) setActive(String(targetActive));
    if (navOpen) setNavOpen(false);
  };

  const page = useMemo(() => {
    switch (active) {
      case "start":
        return (
          <StartPage
            mode={mode}
            onGoVaqueiro={() => {
              changeMode("vaqueiro");
              setActive("herd");
            }}
            onGoProdutor={() => {
              changeMode("produtor");
              setActive("home");
            }}
            onNavigate={(k) => setActive(k)}
          />
        );
      case "home":
        return <ProducerDashboard monthKey={monthKey} onMonthChange={setMonth} onNavigate={setActive} />;
      case "reports":
        return <Financeiro />;
      case "feed":
        return <NutricaoComprasItens />;
      case "stock_farmacia":
        return <EstoqueFarmacia />;
      case "stock_semen":
        return <EstoqueSemenEmbrioes />;
      case "stock_nutricional":
        return <EstoqueNutricional />;
      case "finance":
        return <Financeiro />;
      case "settings":
        return <FinanceiroCadastros />;
      case "areas":
        return areaFocus ? (
          <AreaDetail
            area={areaFocus}
            onBack={() => setAreaFocus(null)}
            onTransfer={(prefill) => {
              setTransferPrefill(prefill);
              setAreaFocus(null);
              setActive("moves");
            }}
          />
        ) : (
          <AreasPasture
            onOpenArea={(a) => setAreaFocus(a)}
            onTransferFromArea={(prefill) => {
              setTransferPrefill(prefill);
              setActive("moves");
            }}
          />
        );
      case "moves":
        return (
          <div className="fazAppFrame">
            <div className="fazAppFrameInner">
              <Transfers
                prefill={transferPrefill}
                onPrefillConsumed={() => setTransferPrefill(null)}
                onGoWhatsApp={() => setActive("whatsapp")}
              />
            </div>
          </div>
        );
      case "herd":
        return (
          <Herd
            mode={mode}
            onTransfer={(prefill) => {
              setTransferPrefill(prefill);
              setActive("moves");
            }}
          />
        );
      case "whatsapp":
        return <WhatsAppValidations />;
      default:
        return (
          <div className="cras-stage-v2">
            <div className="faz-panel">
              <h3>Em construcao</h3>
              <div className="faz-muted" style={{ marginTop: 6 }}>
                Esta tela entra no proximo patch. (Voce esta em: <b>{active}</b>)
              </div>
            </div>
          </div>
        );
    }
  }, [active, areaFocus, transferPrefill, monthKey, mode]);

  const titleTag = mode === "vaqueiro" ? "MODO VAQUEIRO" : "MODO PRODUTOR";
  const contextRight = mode === "produtor" ? monthKey : "";

  return (
    <div className={"cras-ui-v2 fazenda-system-shell" + (navOpen ? " nav-open" : "")}>
      <FazendaTopHeader
        onToggleNav={() => {
          setNavOpen((v) => !v);
          setCollapsed(false);
        }}
        navOpen={navOpen}
        titleTag={titleTag}
        titleRight="FAZENDA IDEAL"
        subtitle={mode === "vaqueiro" ? "Operacao rapida por brinco (campo)." : "Relatorios claros e gestao por R$/@."}
        contextLeft={activeLabel}
        contextRight={contextRight}
        mode={mode}
        onModeChange={changeMode}
      />

      <div className="cras-nav-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />

      <div className="cras-shell-v2">
        <CrasSidebarNav
          groups={groups}
          activeKey={active}
          onChange={(k) => {
            setActive(k);
            if (navOpen) setNavOpen(false);
          }}
          collapsed={collapsed}
          onToggleCollapsed={() => {
            if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 980px)").matches) {
              setNavOpen(false);
              setCollapsed(false);
              return;
            }
            setCollapsed((v) => !v);
          }}
          query={query}
          setQuery={setQuery}
          municipioNome="Januaria • MG"
          unidadeNome={mode === "vaqueiro" ? "Operacao" : "Visao do produtor"}
          topBadge="IDEAL"
        />

        <div className="cras-stage-v2">{page}</div>
      </div>

      <OnboardingOverlay
        open={onbOpen}
        onClose={() => setOnbOpen(false)}
        onCompleted={() => {
          try {
            localStorage.setItem("fazenda_onboarding_v1_done", "1");
          } catch {}
          setOnbDone(true);
          setOnbOpen(false);
        }}
        goTo={goTo}
        mode={mode}
        active={active}
      />

      {!onbDone ? (
        <button
          type="button"
          className="faz-onb-fab"
          onClick={() => setOnbOpen(true)}
          aria-label="Abrir guia de primeiros passos"
        >
          Guia
        </button>
      ) : null}
    </div>
  );
}
