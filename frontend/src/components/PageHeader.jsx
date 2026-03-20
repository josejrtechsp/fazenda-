import React from "react";

/**
 * PageHeader (padrão IDEAL/CRAS)
 * - Simples, robusto e sem dependências externas.
 * - Usado por páginas como Mangas & Pasto.
 */
export default function PageHeader({
  kicker,
  title,
  subtitle,
  right,
  children,
  className = "",
}) {
  return (
    <div className={`fazPageHeader ${className}`.trim()}>
      <div className="fazPageHeader__main">
        {kicker ? <div className="fazPageHeader__kicker">{kicker}</div> : null}
        {title ? <h1 className="fazPageHeader__title">{title}</h1> : null}
        {subtitle ? <div className="fazPageHeader__sub">{subtitle}</div> : null}
        {children ? <div className="fazPageHeader__chips">{children}</div> : null}
      </div>
      {right ? <div className="fazPageHeader__right">{right}</div> : null}
    </div>
  );
}
