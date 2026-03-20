import React, { useEffect, useMemo, useState } from "react";
import FazendaTopHeader from "./components/FazendaTopHeader.jsx";
import CrasSidebarNav from "./components/CrasSidebarNav.jsx";

import ProducerDashboard from "./pages/ProducerDashboard.jsx";
import WhatsAppValidations from "./pages/WhatsAppValidations.jsx";
import Financeiro from "./pages/Financeiro.jsx";
import NutricaoComprasItens from "./pages/NutricaoComprasItens.jsx";
import AreasPasture from "./pages/AreasPasture.jsx";
import Transfers from "./pages/Transfers.jsx";
import AreaDetail from "./pages/AreaDetail.jsx";
import Herd from "./pages/Herd.jsx";
import "./styles/ideal_brand_lockup.css";

function currentMonthKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

export default function FazendaApp(){
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("home");

  // mês padrão do produtor: MÊS
  const [monthKey, setMonthKey] = useState(() => {
    try {
      const saved = localStorage.getItem("fazenda_month_key") || "";
      return saved || currentMonthKey();
    } catch {
      return currentMonthKey();
    }
  });

  function setMonth(k){
    setMonthKey(k);
    try { localStorage.setItem("fazenda_month_key", k); } catch {}
  }

  // navegação contextual (sem misturar com roteador)
  const [areaFocus, setAreaFocus] = useState(null);
  const [transferPrefill, setTransferPrefill] = useState(null);

  // UX V3 — Drawer (iPad/mobile): fecha ao ampliar tela / ESC
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

  const groups = useMemo(() => ([
    {
      title: "Visão do produtor",
      items: [
        { key: "home", title: "Início (Mês)", sub: "R$/@ e resumo", icon: "home" },
        { key: "reports", title: "Relatórios", sub: "Exportações", icon: "file" },
      ]
    },
    {
      title: "Operação",
      items: [
        { key: "herd", title: "Rebanho", sub: "Lotes e animais", icon: "grid" },
        { key: "areas", title: "Mangas & Pasto", sub: "Ocupação e descanso", icon: "map" },
        { key: "moves", title: "Movimentações", sub: "Transferências", icon: "shuffle" },
        { key: "feed", title: "Nutrição", sub: "Ração / sal / mineral", icon: "package" },
        { key: "health", title: "Sanidade", sub: "Protocolos", icon: "shield" },
      ]
    },
    {
      title: "Integração",
      items: [
        { key: "whatsapp", title: "WhatsApp", sub: "Validações", icon: "message" },
      ]
    },
    {
      title: "Financeiro",
      items: [
        { key: "finance", title: "Custos & Receitas", sub: "Sempre por @", icon: "bar" },
        { key: "settings", title: "Configurações", sub: "Fazenda e dicionário", icon: "settings" },
      ]
    }
  ]), []);

  const page = useMemo(() => {
    switch(active){
      case "home":
        return <ProducerDashboard monthKey={monthKey} onMonthChange={setMonth} onNavigate={setActive} />;
      case "feed":
        return <NutricaoComprasItens />;
      case "finance":
        return <Financeiro />;
      case "areas":
        return areaFocus ? (
          <AreaDetail
            area={areaFocus}
            onBack={() => setAreaFocus(null)}
            onTransfer={(prefill) => { setTransferPrefill(prefill); setAreaFocus(null); setActive("moves"); }}
          />
        ) : (
          <AreasPasture
            onOpenArea={(a) => setAreaFocus(a)}
            onTransferFromArea={(prefill) => { setTransferPrefill(prefill); setActive("moves"); }}
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
            onTransfer={(prefill) => { setTransferPrefill(prefill); setActive("moves"); }}
          />
        );
      case "whatsapp":
        return <WhatsAppValidations />;
      default:
        return (
          <div className="cras-stage-v2">
            <div className="faz-panel">
              <h3>Em construção</h3>
              <div className="faz-muted" style={{ marginTop: 6 }}>
                Esta tela entra no próximo patch. (Você está em: <b>{active}</b>)
              </div>
            </div>
          </div>
        );
    }
  }, [active, areaFocus, transferPrefill, monthKey]);

  return (
    <div className={"cras-ui-v2" + (navOpen ? " nav-open" : "")}> 
      <FazendaTopHeader
        onToggleNav={() => { setNavOpen(v => !v); setCollapsed(false); }}
        navOpen={navOpen}
        brand="IDEAL"
        module="Fazenda"
        contextLeft="Modo Produtor"
        contextRight={monthKey}
        userName="José Antônio"
        farmName="SOFTWARE FAZENDA"
      />

      <div className="cras-nav-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />

      <div className="cras-shell-v2">
        <CrasSidebarNav
          groups={groups}
          activeKey={active}
          onChange={(k) => { setActive(k); if (navOpen) setNavOpen(false); }}
          collapsed={collapsed}
          onToggleCollapsed={() => {
            if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 980px)").matches) {
              setNavOpen(false);
              setCollapsed(false);
              return;
            }
            setCollapsed(v => !v);
          }}
          query={query}
          setQuery={setQuery}
          municipioNome="Januária • MG"
          unidadeNome="IDEAL Fazenda"
          topBadge="IDEAL"
        />

        <div className="cras-stage-v2">
          {page}
        </div>
      </div>
    </div>
  );
}
