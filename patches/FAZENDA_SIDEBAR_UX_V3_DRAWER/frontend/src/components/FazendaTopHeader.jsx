import React from "react";
import "../styles/fazenda_header_overrides.css";

/**
 * FazendaTopHeader (padrao Fluxos)
 *
 * FIX11:
 * - Remove (por enquanto) o lockup da direita (logo + texto "IDEAL - SOLUCOES PARA PECUARIA").
 * - Mantem o cabecalho no estilo do topo dos fluxos (.app-header / .app-header-inner).
 */
export default function FazendaTopHeader(props) {
  const onToggleNav = typeof props.onToggleNav === "function" ? props.onToggleNav : null;
  const navOpen = !!props.navOpen;

  const titleTag = props.titleTag ?? "PLATAFORMA DE GESTAO DA PECUARIA";
  const titleRight = props.titleRight ?? "FAZENDA IDEAL";
  const subtitle =
    props.subtitle ??
    "Gestao simples no campo (WhatsApp) e relatorios claros em R$/@.";

  const tabs = props.tabs ?? [];
  const activeTab = props.activeTab ?? "";
  const setActiveTab =
    typeof props.setActiveTab === "function" ? props.setActiveTab : () => {};

  return (
    <header className="app-header app-header-fazenda">
      <div className="app-header-inner app-header-inner-fazenda">
        {onToggleNav ? (
          <button
            type="button"
            className="app-header-menuBtn"
            onClick={onToggleNav}
            aria-label={navOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={navOpen ? "true" : "false"}
          >
            <svg className="app-header-menuIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="app-header-menuText">Menu</span>
          </button>
        ) : null}

        <div className="app-header-title">
          <div className="app-title-tag">{titleTag}</div>

          <h1 className="app-title">
            <span className="app-title-prefix">Sistema</span>
            <span className="app-title-highlight">{titleRight}</span>
          </h1>

          <p className="app-subtitle">{subtitle}</p>
        </div>

        {Array.isArray(tabs) && tabs.length > 0 ? (
          <nav className="app-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={
                  "app-tab" + (activeTab === t.key ? " app-tab-active" : "")
                }
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
