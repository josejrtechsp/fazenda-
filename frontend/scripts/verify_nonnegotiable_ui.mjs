import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function ensureContains(content, token, file, errors) {
  if (!content.includes(token)) {
    errors.push(`${file}: ausente -> ${token}`);
  }
}

const errors = [];

const mainJsx = read("src/main.jsx");
ensureContains(mainJsx, "ui_nonnegotiable_lock.css", "src/main.jsx", errors);

const fazendaApp = read("src/FazendaApp.jsx");
ensureContains(fazendaApp, "cras-ui-v2 fazenda-system-shell", "src/FazendaApp.jsx", errors);
ensureContains(fazendaApp, "FazendaTopHeader", "src/FazendaApp.jsx", errors);
ensureContains(fazendaApp, "CrasSidebarNav", "src/FazendaApp.jsx", errors);

const headerComponent = read("src/components/FazendaTopHeader.jsx");
ensureContains(headerComponent, "app-header app-header-fazenda", "src/components/FazendaTopHeader.jsx", errors);
ensureContains(headerComponent, "app-header-inner app-header-inner-fazenda", "src/components/FazendaTopHeader.jsx", errors);

const sidebarComponent = read("src/components/CrasSidebarNav.jsx");
ensureContains(sidebarComponent, "cras-sidebar-v2", "src/components/CrasSidebarNav.jsx", errors);
ensureContains(sidebarComponent, "cras-sidebar-v2-item", "src/components/CrasSidebarNav.jsx", errors);
ensureContains(sidebarComponent, "cras-sidebar-v2-nav", "src/components/CrasSidebarNav.jsx", errors);

const lockCss = read("src/styles/ui_nonnegotiable_lock.css");
ensureContains(lockCss, ".cras-ui-v2.fazenda-system-shell .app-header.app-header-fazenda", "src/styles/ui_nonnegotiable_lock.css", errors);
ensureContains(lockCss, ".cras-ui-v2.fazenda-system-shell .cras-sidebar-v2", "src/styles/ui_nonnegotiable_lock.css", errors);
ensureContains(lockCss, ".cras-ui-v2.fazenda-system-shell .cras-shell-v2", "src/styles/ui_nonnegotiable_lock.css", errors);

if (errors.length) {
  console.error("Falha na blindagem de UI inegociavel:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log("OK: blindagem de UI inegociavel validada.");
