import React, { useEffect, useMemo, useState } from "react";

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
  const stroke = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path {...stroke} d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <path {...stroke} d="M9 5h6" />
          <path {...stroke} d="M9 3h6a2 2 0 0 1 2 2v16H7V5a2 2 0 0 1 2-2Z" />
          <path {...stroke} d="M9 7h6" />
        </svg>
      );
    case "cases":
      return (
        <svg {...common}>
          <path {...stroke} d="M8 7V6a4 4 0 0 1 8 0v1" />
          <path {...stroke} d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path {...stroke} d="M22 2 11 13" />
          <path {...stroke} d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
      );
    case "tasks":
      return (
        <svg {...common}>
          <path {...stroke} d="M9 11l3 3L22 4" />
          <path {...stroke} d="M2 12h6" />
          <path {...stroke} d="M2 6h10" />
          <path {...stroke} d="M2 18h10" />
        </svg>
      );
    case "id":
      return (
        <svg {...common}>
          <path {...stroke} d="M4 7h16v10H4V7Z" />
          <path {...stroke} d="M8 11h4" />
          <path {...stroke} d="M8 14h7" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path {...stroke} d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <path {...stroke} d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path {...stroke} d="M22 21v-2a3 3 0 0 0-2-2.83" />
          <path {...stroke} d="M16 3.17a4 4 0 0 1 0 7.66" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <path {...stroke} d="M10 3H3v7h7V3Z" />
          <path {...stroke} d="M21 3h-7v7h7V3Z" />
          <path {...stroke} d="M21 14h-7v7h7v-7Z" />
          <path {...stroke} d="M10 14H3v7h7v-7Z" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path {...stroke} d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
          <path {...stroke} d="M9 3v15" />
          <path {...stroke} d="M15 6v15" />
        </svg>
      );
    case "shuffle":
      return (
        <svg {...common}>
          <path {...stroke} d="M16 3h5v5" />
          <path {...stroke} d="M4 20l5-5" />
          <path {...stroke} d="M15 20h6v-6" />
          <path {...stroke} d="M4 4l7 7" />
          <path {...stroke} d="M15 4l6 6" />
          <path {...stroke} d="M9 15l2 2" />
        </svg>
      );
    case "package":
      return (
        <svg {...common}>
          <path {...stroke} d="M21 16V8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16Z" />
          <path {...stroke} d="M3.3 7.2 12 12l8.7-4.8" />
          <path {...stroke} d="M12 22V12" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4Z" />
          <path {...stroke} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path {...stroke} d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
        </svg>
      );
    case "bar":
      return (
        <svg {...common}>
          <path {...stroke} d="M4 20V10" />
          <path {...stroke} d="M10 20V4" />
          <path {...stroke} d="M16 20v-8" />
          <path {...stroke} d="M22 20V7" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path {...stroke} d="M19.4 15a7.7 7.7 0 0 0 .1-1l2-1.5-2-3.5-2.4.5a7.3 7.3 0 0 0-1.7-1L15 4h-6L8.6 8.5a7.3 7.3 0 0 0-1.7 1L4.5 9 2.5 12.5l2 1.5a7.7 7.7 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.5a7.3 7.3 0 0 0 1.7 1L9 22h6l.4-4.5a7.3 7.3 0 0 0 1.7-1l2.4.5 2-3.5-2-1.5Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <path {...stroke} d="M8 2v3" />
          <path {...stroke} d="M16 2v3" />
          <path {...stroke} d="M3 9h18" />
          <path {...stroke} d="M5 5h14a2 2 0 0 1 2 2v14H3V7a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path {...stroke} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
          <path {...stroke} d="M14 2v6h6" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path {...stroke} d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <path {...stroke} d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path {...stroke} d="M14 3v6h6" />
          <path {...stroke} d="M9 13h6" />
          <path {...stroke} d="M9 17h6" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path {...stroke} d="M3 3v18h18" />
          <path {...stroke} d="M7 15v3" />
          <path {...stroke} d="M12 11v7" />
          <path {...stroke} d="M17 7v11" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle {...stroke} cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function flattenItems(groups = []) {
  const out = [];
  const walk = (it, group) => {
    if (!it) return;
    out.push({ ...it, group });
    (it.children || []).forEach((child) => walk(child, group));
  };
  (groups || []).forEach((g) => (g.items || []).forEach((it) => walk(it, g.title)));
  return out;
}

function hasDescendantWithKey(item, key) {
  if (!item || !Array.isArray(item.children) || !item.children.length) return false;
  return item.children.some((child) => child.key === key || hasDescendantWithKey(child, key));
}

function normalizeText(v) {
  return (v || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function itemMatchesQuery(item, queryNorm) {
  const hay = [item.label, item.title, item.sub, item.group].map(normalizeText).join(" ");
  return hay.includes(queryNorm);
}

export default function CrasSidebarNav({
  groups = [],
  activeKey = "",
  onChange = () => {},
  collapsed = false,
  onToggleCollapsed = () => {},
  query = "",
  setQuery = () => {},
  municipioNome = "Município",
  unidadeNome = "CRAS",
  topBadge = null,
}) {
  const flat = useMemo(() => flattenItems(groups), [groups]);

  const activeLabel = useMemo(() => {
    const found = flat.find((x) => x.key === activeKey);
    return found?.label || found?.title || "—";
  }, [flat, activeKey]);

  const q = (query || "").trim();
  const qNorm = normalizeText(q);

  const filteredGroups = useMemo(() => {
    if (!qNorm) return groups;

    const filterItem = (item) => {
      const selfMatches = itemMatchesQuery(item, qNorm);
      const children = (item.children || []).map(filterItem).filter(Boolean);
      if (selfMatches || children.length) {
        return { ...item, children: selfMatches ? (children.length ? children : item.children || []) : children };
      }
      return null;
    };

    const out = [];
    for (const g of groups || []) {
      const items = (g.items || []).map(filterItem).filter(Boolean);
      if (items.length) out.push({ ...g, items });
    }
    return out;
  }, [groups, qNorm]);

  const [openParents, setOpenParents] = useState(() => {
    const next = {};
    (groups || []).forEach((g) => {
      (g.items || []).forEach((it) => {
        if (Array.isArray(it.children) && it.children.length) {
          next[it.key] = true;
        }
      });
    });
    return next;
  });

  useEffect(() => {
    const next = {};
    (groups || []).forEach((g) => {
      (g.items || []).forEach((it) => {
        if (Array.isArray(it.children) && it.children.length) {
          next[it.key] = Object.prototype.hasOwnProperty.call(openParents, it.key)
            ? openParents[it.key]
            : true;
        }
      });
    });
    setOpenParents(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  useEffect(() => {
    const parent = flat.find((it) => Array.isArray(it.children) && it.children.some((child) => child.key === activeKey || hasDescendantWithKey(child, activeKey)));
    if (!parent) return;
    setOpenParents((prev) => ({ ...prev, [parent.key]: true }));
  }, [activeKey, flat]);

  const badgeText = (topBadge || unidadeNome || "CRAS").toString();

  const renderItem = (it, groupTitle, level = 0) => {
    const hasChildren = Array.isArray(it.children) && it.children.length > 0;
    const isActive = it.key === activeKey;
    const parentActive = hasChildren ? hasDescendantWithKey(it, activeKey) : false;
    const expanded = !!openParents[it.key];
    const label = it.label || it.title || "";

    if (hasChildren) {
      const titleText = collapsed ? `${groupTitle} · ${label}` : undefined;
      return (
        <div key={it.key} className="cras-sidebar-v2-parentWrap">
          <button
            type="button"
            className={"cras-sidebar-v2-item is-parent" + (parentActive ? " is-active" : "")}
            onClick={() => {
              if (collapsed) {
                const firstChild = it.children.find((child) => !child.disabled);
                if (firstChild) onChange(firstChild.key);
                return;
              }
              setOpenParents((prev) => ({ ...prev, [it.key]: !prev[it.key] }));
            }}
            title={titleText}
            aria-expanded={!collapsed ? expanded : undefined}
            aria-current={parentActive ? "page" : undefined}
          >
            <span className="cras-sidebar-v2-icon"><Icon name={it.icon} /></span>
            {!collapsed ? (
              <span className="cras-sidebar-v2-text">
                <span className="cras-sidebar-v2-label">{label}</span>
                {it.sub ? <span className="cras-sidebar-v2-subline">{it.sub}</span> : null}
              </span>
            ) : null}
            {!collapsed ? <span className={"cras-sidebar-v2-caret" + (expanded ? " is-open" : "")}>▾</span> : null}
          </button>

          {!collapsed && expanded ? (
            <div className="cras-sidebar-v2-subitems">
              {it.children.map((child) => renderItem(child, groupTitle, level + 1))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <button
        key={it.key}
        type="button"
        className={
          "cras-sidebar-v2-item" +
          (level > 0 ? " is-child" : "") +
          (isActive ? " is-active" : "") +
          (it.disabled ? " is-disabled" : "")
        }
        onClick={() => {
          if (it.disabled) return;
          onChange(it.key);
        }}
        title={collapsed ? `${groupTitle} · ${label}${it.sub ? " — " + it.sub : ""}` : undefined}
        aria-current={isActive ? "page" : undefined}
        disabled={!!it.disabled}
      >
        <span className="cras-sidebar-v2-icon"><Icon name={it.icon} /></span>
        {!collapsed ? (
          <span className="cras-sidebar-v2-text">
            <span className="cras-sidebar-v2-label">{label}</span>
            {it.sub ? <span className="cras-sidebar-v2-subline">{it.sub}</span> : null}
          </span>
        ) : null}
        {it.badge ? <span className="cras-sidebar-v2-badge">{it.badge}</span> : null}
      </button>
    );
  };

  return (
    <aside className={"cras-sidebar-v2" + (collapsed ? " is-collapsed" : "")}>
      <div className="cras-sidebar-v2-head">
        <div className="cras-sidebar-v2-title">
          <div className="cras-sidebar-v2-muni">{badgeText}</div>
          <div className="cras-sidebar-v2-sub">{activeLabel}</div>
        </div>

        <button type="button" className="cras-sidebar-v2-toggle" onClick={onToggleCollapsed} aria-label="Recolher/expandir menu">
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed ? (
        <input
          className="cras-sidebar-v2-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar aba…"
        />
      ) : null}

      <nav className="cras-sidebar-v2-nav" aria-label="Navegação CRAS">
        {(filteredGroups || []).map((g) => (
          <div key={g.title} className="cras-sidebar-v2-group">
            {!collapsed ? <div className="cras-sidebar-v2-group-title">{g.title}</div> : null}
            {(g.items || []).map((it) => renderItem(it, g.title, 0))}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="cras-sidebar-v2-foot">
          <div className="cras-sidebar-v2-foot-strong">{unidadeNome}</div>
          <div className="cras-sidebar-v2-foot-soft" style={{ marginTop: 6 }}>{municipioNome}</div>
          <div className="cras-sidebar-v2-foot-soft">Dica: use a busca para localizar uma aba rapidamente.</div>
        </div>
      ) : null}
    </aside>
  );
}
