import React, { useEffect, useMemo, useRef, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import { api } from "../lib/api.js";
import "../styles/financeiro_cadastros.css";

const ROLE_OPTIONS = [
  { key: "is_customer", label: "Cliente" },
  { key: "is_supplier", label: "Fornecedor" },
  { key: "is_employee", label: "Colaborador" },
  { key: "is_carrier", label: "Transportadora" },
  { key: "is_owner", label: "Proprietario" },
];

const DOC_TYPE_OPTIONS = ["CPF", "CNPJ", "OUTRO"];
const ACCOUNT_CATEGORY_OPTIONS = ["RECEITA", "DESPESA", "OUTROS"];
const BANK_ACCOUNT_TYPES = ["CORRENTE", "POUPANCA", "CAIXA", "OUTRA"];
const PAYMENT_METHOD_TYPES = ["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CARTAO", "BARTER"];
const SETTINGS_FOCUS_OPTIONS = [
  "accounts",
  "people",
  "supplier_categories",
  "supplier_tags",
  "cost_centers",
  "bank_accounts",
  "payment_methods",
  "approval_policy",
];
const APPROVER_ROLE_OPTIONS = [
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Admin" },
  { value: "financeiro", label: "Financeiro" },
  { value: "rh", label: "RH" },
];
const LS_FINANCE_SETTINGS_HINT = "fazenda_nav_finance_settings_v1";

function roleLabel(role) {
  if (role === "customer") return "Cliente";
  if (role === "supplier") return "Fornecedor";
  if (role === "employee") return "Colaborador";
  if (role === "carrier") return "Transportadora";
  if (role === "owner") return "Proprietario";
  return String(role || "").trim();
}

function asId(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeSettingsHint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const accCategory = ["ALL", ...ACCOUNT_CATEGORY_OPTIONS].includes(String(raw?.accCategory || "").trim())
    ? String(raw.accCategory || "").trim()
    : "";
  const accLevel = ["ALL", "1", "2", "3", "4"].includes(String(raw?.accLevel || "").trim())
    ? String(raw.accLevel || "").trim()
    : "";
  const peopleTab = ["cadastro", "lista"].includes(String(raw?.peopleTab || "").trim())
    ? String(raw.peopleTab || "").trim()
    : "";
  const showAccountsPanel = typeof raw?.showAccountsPanel === "boolean" ? raw.showAccountsPanel : undefined;
  const focusSection = SETTINGS_FOCUS_OPTIONS.includes(String(raw?.focusSection || "").trim())
    ? String(raw.focusSection || "").trim()
    : "";

  if (!accCategory && !accLevel && !peopleTab && typeof showAccountsPanel !== "boolean" && !focusSection) return null;
  return { accCategory, accLevel, peopleTab, showAccountsPanel, focusSection };
}

export default function FinanceiroCadastros({
  embedded = false,
  hideHeader = false,
  showAccounts = true,
  showPeople = true,
  accountsHiddenByDefault = false,
  personDraft = null,
  onPersonCreated = null,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [seedMsg, setSeedMsg] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [people, setPeople] = useState([]);
  const [supplierCategories, setSupplierCategories] = useState([]);
  const [supplierTags, setSupplierTags] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [approvalPolicy, setApprovalPolicy] = useState({
    enabled: false,
    payable_threshold_brl: "0",
    receivable_threshold_brl: "0",
    payable_required_by: "gestor",
    receivable_required_by: "gestor",
    payable_tiers: [],
    receivable_tiers: [],
  });

  const [peopleTab, setPeopleTab] = useState("cadastro");
  const [showAccountsPanel, setShowAccountsPanel] = useState(!accountsHiddenByDefault);
  const [focusedSection, setFocusedSection] = useState("");
  const sectionRefs = useRef({});

  const [msg, setMsg] = useState({
    people: "",
    category: "",
    tag: "",
    costCenter: "",
    bank: "",
    payment: "",
    policy: "",
  });

  const [accQ, setAccQ] = useState("");
  const [accCategory, setAccCategory] = useState("ALL");
  const [accLevel, setAccLevel] = useState("ALL");

  const [personForm, setPersonForm] = useState({
    name: "",
    legal_name: "",
    document_type: "CPF",
    document: "",
    phone: "",
    email: "",
    zip_code: "",
    street: "",
    number: "",
    district: "",
    city: "",
    state: "MG",
    supplier_category_id: "",
    supplier_tags_csv: "",
    bank_name: "",
    bank_branch: "",
    bank_account: "",
    pix_key: "",
    pix_type: "",
    is_customer: false,
    is_supplier: true,
    is_employee: false,
    is_carrier: false,
    is_owner: false,
    is_active: true,
  });

  const [categoryForm, setCategoryForm] = useState({ name: "", parent_id: "", is_active: true });
  const [tagForm, setTagForm] = useState({ name: "", is_active: true });
  const [costCenterForm, setCostCenterForm] = useState({ code: "", name: "", parent_id: "", is_active: true });
  const [bankForm, setBankForm] = useState({
    name: "",
    bank_name: "",
    branch: "",
    account_number: "",
    account_type: "CORRENTE",
    opening_balance: "0",
    is_active: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    name: "",
    method_type: "PIX",
    fee_percent: "0",
    term_days: "0",
    default_bank_account_id: "",
    is_active: true,
  });

  function setLocalMsg(key, value) {
    setMsg((prev) => ({ ...prev, [key]: String(value || "") }));
  }

  function setSectionRef(key) {
    return (node) => {
      if (node) sectionRefs.current[key] = node;
      else delete sectionRefs.current[key];
    };
  }

  function sectionClass(baseClass, key) {
    return `${baseClass} faz-fin-sectionFocus${focusedSection === key ? " is-focused" : ""}`;
  }

  async function loadAll() {
    setLoading(true);
    setErr("");

    const reqs = await Promise.allSettled([
      api.get("/accounts?include_inactive=false&limit=5000"),
      api.get("/people?include_inactive=false&limit=1200"),
      api.get("/supplier-categories?include_inactive=false&limit=1200"),
      api.get("/supplier-tags?include_inactive=false&limit=1200"),
      api.get("/cost-centers?include_inactive=false&limit=1200"),
      api.get("/bank-accounts?include_inactive=false&limit=600"),
      api.get("/payment-methods?include_inactive=false&limit=600"),
      api.get("/finance/approval-policy"),
    ]);

    const errs = [];

    if (reqs[0].status === "fulfilled") setAccounts(Array.isArray(reqs[0].value) ? reqs[0].value : []);
    else errs.push(reqs[0].reason?.message || "contas");

    if (reqs[1].status === "fulfilled") setPeople(Array.isArray(reqs[1].value) ? reqs[1].value : []);
    else errs.push(reqs[1].reason?.message || "pessoas");

    if (reqs[2].status === "fulfilled") setSupplierCategories(Array.isArray(reqs[2].value) ? reqs[2].value : []);
    else errs.push(reqs[2].reason?.message || "categorias");

    if (reqs[3].status === "fulfilled") setSupplierTags(Array.isArray(reqs[3].value) ? reqs[3].value : []);
    else errs.push(reqs[3].reason?.message || "tags");

    if (reqs[4].status === "fulfilled") setCostCenters(Array.isArray(reqs[4].value) ? reqs[4].value : []);
    else errs.push(reqs[4].reason?.message || "centros");

    if (reqs[5].status === "fulfilled") setBankAccounts(Array.isArray(reqs[5].value) ? reqs[5].value : []);
    else errs.push(reqs[5].reason?.message || "contas bancarias");

    if (reqs[6].status === "fulfilled") setPaymentMethods(Array.isArray(reqs[6].value) ? reqs[6].value : []);
    else errs.push(reqs[6].reason?.message || "formas de pagamento");

    if (reqs[7].status === "fulfilled") {
      const item = reqs[7].value?.item || {};
      setApprovalPolicy({
        enabled: !!item.enabled,
        payable_threshold_brl: String(item.payable_threshold_brl ?? "0"),
        receivable_threshold_brl: String(item.receivable_threshold_brl ?? "0"),
        payable_required_by: String(item.payable_required_by || "gestor"),
        receivable_required_by: String(item.receivable_required_by || "gestor"),
        payable_tiers: Array.isArray(item.payable_tiers)
          ? item.payable_tiers.map((t) => ({
              min_brl: String(t?.min_brl ?? ""),
              required_by: String(t?.required_by || "gestor"),
            }))
          : [],
        receivable_tiers: Array.isArray(item.receivable_tiers)
          ? item.receivable_tiers.map((t) => ({
              min_brl: String(t?.min_brl ?? ""),
              required_by: String(t?.required_by || "gestor"),
            }))
          : [],
      });
    } else {
      errs.push(reqs[7].reason?.message || "politica de aprovacao");
    }

    if (errs.length) setErr(`Falha ao carregar parte dos cadastros: ${errs.join(" | ")}`);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setShowAccountsPanel(!accountsHiddenByDefault);
  }, [accountsHiddenByDefault]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const applyHint = (raw) => {
      const hint = normalizeSettingsHint(raw);
      if (!hint) return;
      if (typeof hint.showAccountsPanel === "boolean") setShowAccountsPanel(hint.showAccountsPanel);
      if (hint.accCategory) setAccCategory(hint.accCategory);
      if (hint.accLevel) setAccLevel(hint.accLevel);
      if (hint.peopleTab) setPeopleTab(hint.peopleTab);
      if (hint.focusSection === "accounts") setShowAccountsPanel(true);
      if (hint.focusSection) setFocusedSection(hint.focusSection);
    };

    const consumeStoredHint = () => {
      try {
        const raw = window.localStorage.getItem(LS_FINANCE_SETTINGS_HINT);
        if (!raw) return;
        window.localStorage.removeItem(LS_FINANCE_SETTINGS_HINT);
        applyHint(JSON.parse(raw));
      } catch {
        try {
          window.localStorage.removeItem(LS_FINANCE_SETTINGS_HINT);
        } catch {}
      }
    };

    consumeStoredHint();
    const onHint = () => consumeStoredHint();
    window.addEventListener(LS_FINANCE_SETTINGS_HINT, onHint);
    return () => window.removeEventListener(LS_FINANCE_SETTINGS_HINT, onHint);
  }, []);

  useEffect(() => {
    if (!focusedSection || typeof window === "undefined") return undefined;
    const node = sectionRefs.current[focusedSection];
    if (!node) return undefined;

    const scrollTimer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, 80);
    const clearTimer = window.setTimeout(() => {
      setFocusedSection((current) => (current === focusedSection ? "" : current));
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedSection, peopleTab, showAccountsPanel]);

  useEffect(() => {
    if (!personDraft || typeof personDraft !== "object") return;
    setPeopleTab("cadastro");
    setFocusedSection("people");
    setPersonForm((prev) => ({
      ...prev,
      name: String(personDraft.name || ""),
      legal_name: String(personDraft.legal_name || ""),
      document_type: String(personDraft.document_type || prev.document_type || "OUTRO").toUpperCase(),
      document: String(personDraft.document || ""),
      phone: String(personDraft.phone || ""),
      email: String(personDraft.email || ""),
      supplier_category_id: "",
      supplier_tags_csv: "",
      is_customer: !!personDraft.is_customer,
      is_supplier: !!personDraft.is_supplier,
      is_employee: false,
      is_carrier: false,
      is_owner: false,
      is_active: true,
    }));
    if (personDraft.note) {
      setLocalMsg("people", String(personDraft.note));
    }
  }, [personDraft]);

  const categoriesById = useMemo(() => {
    const map = {};
    supplierCategories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [supplierCategories]);

  const levelStats = useMemo(() => {
    const m = { 1: 0, 2: 0, 3: 0, 4: 0 };
    accounts.forEach((a) => {
      const lv = Number(a?.level || 0);
      if (lv >= 1 && lv <= 4) m[lv] += 1;
    });
    return m;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = String(accQ || "").trim().toLowerCase();
    return accounts
      .filter((a) => (accCategory === "ALL" ? true : String(a?.category || "") === accCategory))
      .filter((a) => (accLevel === "ALL" ? true : Number(a?.level || 0) === Number(accLevel)))
      .filter((a) => (!q ? true : `${a?.code || ""} ${a?.name || ""}`.toLowerCase().includes(q)))
      .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || ""), "pt-BR"));
  }, [accounts, accCategory, accLevel, accQ]);

  async function seedAccounts(reset) {
    setSeedMsg("");
    try {
      const res = await api.post(`/accounts/seed-inttegra?reset=${reset ? "true" : "false"}`, {});
      setSeedMsg(
        `Plano atualizado: ${res?.seed_items || 0} contas (${res?.created || 0} criadas, ${res?.updated || 0} atualizadas).`
      );
      await loadAll();
    } catch (e) {
      setSeedMsg(e?.message || "Falha ao popular plano de contas.");
    }
  }

  async function seedSupplierCatalog() {
    setLocalMsg("category", "");
    setLocalMsg("tag", "");
    try {
      const [cats, tags] = await Promise.all([
        api.post("/supplier-categories/seed-defaults", {}),
        api.post("/supplier-tags/seed-defaults", {}),
      ]);
      setLocalMsg("category", `Categorias populadas: ${cats?.created || 0}.`);
      setLocalMsg("tag", `Tags populadas: ${tags?.created || 0}.`);
      await loadAll();
    } catch (e) {
      const m = e?.message || "Falha ao popular catalogo de fornecedor.";
      setLocalMsg("category", m);
      setLocalMsg("tag", m);
    }
  }

  async function seedCostCenters() {
    setLocalMsg("costCenter", "");
    try {
      const res = await api.post("/cost-centers/seed-defaults", {});
      setLocalMsg("costCenter", `Centros populados: ${res?.created || 0}.`);
      await loadAll();
    } catch (e) {
      setLocalMsg("costCenter", e?.message || "Falha ao popular centros de custo.");
    }
  }

  async function seedPaymentMethods() {
    setLocalMsg("payment", "");
    try {
      const res = await api.post("/payment-methods/seed-defaults", {});
      setLocalMsg("payment", `Formas populadas: ${res?.created || 0}.`);
      await loadAll();
    } catch (e) {
      setLocalMsg("payment", e?.message || "Falha ao popular formas de pagamento.");
    }
  }

  function updateApprovalPolicyField(key, value) {
    setApprovalPolicy((prev) => ({ ...prev, [key]: value }));
  }

  function updateApprovalTier(kind, index, key, value) {
    const field = kind === "payable" ? "payable_tiers" : "receivable_tiers";
    setApprovalPolicy((prev) => {
      const rows = Array.isArray(prev[field]) ? [...prev[field]] : [];
      rows[index] = { ...(rows[index] || {}), [key]: value };
      return { ...prev, [field]: rows };
    });
  }

  function addApprovalTier(kind) {
    const field = kind === "payable" ? "payable_tiers" : "receivable_tiers";
    setApprovalPolicy((prev) => {
      const rows = Array.isArray(prev[field]) ? [...prev[field]] : [];
      rows.push({ min_brl: "", required_by: "gestor" });
      return { ...prev, [field]: rows };
    });
  }

  function removeApprovalTier(kind, index) {
    const field = kind === "payable" ? "payable_tiers" : "receivable_tiers";
    setApprovalPolicy((prev) => {
      const rows = Array.isArray(prev[field]) ? [...prev[field]] : [];
      rows.splice(index, 1);
      return { ...prev, [field]: rows };
    });
  }

  function normalizeTiers(rows, label) {
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((t, i) => {
      const min = Number(t?.min_brl ?? "");
      const required_by = String(t?.required_by || "gestor").toLowerCase();
      if (!Number.isFinite(min)) {
        throw new Error(`${label}: faixa ${i + 1} com valor invalido.`);
      }
      if (min < 0) {
        throw new Error(`${label}: faixa ${i + 1} nao pode ser negativa.`);
      }
      out.push({ min_brl: min, required_by });
    });
    out.sort((a, b) => a.min_brl - b.min_brl);
    return out;
  }

  async function saveApprovalPolicy(e) {
    e?.preventDefault?.();
    setLocalMsg("policy", "");

    try {
      const payload = {
        enabled: !!approvalPolicy.enabled,
        payable_threshold_brl: Number(approvalPolicy.payable_threshold_brl || 0),
        receivable_threshold_brl: Number(approvalPolicy.receivable_threshold_brl || 0),
        payable_required_by: String(approvalPolicy.payable_required_by || "gestor"),
        receivable_required_by: String(approvalPolicy.receivable_required_by || "gestor"),
        payable_tiers: normalizeTiers(approvalPolicy.payable_tiers, "Despesa"),
        receivable_tiers: normalizeTiers(approvalPolicy.receivable_tiers, "Receita"),
      };

      if (!Number.isFinite(payload.payable_threshold_brl) || payload.payable_threshold_brl < 0) {
        throw new Error("Limite de despesa invalido.");
      }
      if (!Number.isFinite(payload.receivable_threshold_brl) || payload.receivable_threshold_brl < 0) {
        throw new Error("Limite de receita invalido.");
      }

      const res = await api.put("/finance/approval-policy", payload);
      const item = res?.item || {};
      setApprovalPolicy({
        enabled: !!item.enabled,
        payable_threshold_brl: String(item.payable_threshold_brl ?? payload.payable_threshold_brl),
        receivable_threshold_brl: String(item.receivable_threshold_brl ?? payload.receivable_threshold_brl),
        payable_required_by: String(item.payable_required_by || payload.payable_required_by),
        receivable_required_by: String(item.receivable_required_by || payload.receivable_required_by),
        payable_tiers: Array.isArray(item.payable_tiers)
          ? item.payable_tiers.map((t) => ({
              min_brl: String(t?.min_brl ?? ""),
              required_by: String(t?.required_by || "gestor"),
            }))
          : [],
        receivable_tiers: Array.isArray(item.receivable_tiers)
          ? item.receivable_tiers.map((t) => ({
              min_brl: String(t?.min_brl ?? ""),
              required_by: String(t?.required_by || "gestor"),
            }))
          : [],
      });
      setLocalMsg("policy", "Politica de aprovacao atualizada.");
    } catch (e2) {
      setLocalMsg("policy", e2?.message || "Falha ao salvar politica de aprovacao.");
    }
  }

  function toggleRole(key) {
    setPersonForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function createPerson(e) {
    e?.preventDefault?.();
    setLocalMsg("people", "");
    try {
      const created = await api.post("/people", {
        ...personForm,
        document_type: String(personForm.document_type || "OUTRO").toUpperCase(),
        supplier_category_id: asId(personForm.supplier_category_id),
        supplier_tags_csv: String(personForm.supplier_tags_csv || "").trim(),
        state: String(personForm.state || "").toUpperCase(),
      });
      setLocalMsg("people", "Pessoa cadastrada.");
      setPersonForm((prev) => ({
        ...prev,
        name: "",
        legal_name: "",
        document: "",
        phone: "",
        email: "",
        zip_code: "",
        street: "",
        number: "",
        district: "",
        city: "",
        state: "MG",
        supplier_category_id: "",
        supplier_tags_csv: "",
        bank_name: "",
        bank_branch: "",
        bank_account: "",
        pix_key: "",
        pix_type: "",
      }));
      await loadAll();
      if (typeof onPersonCreated === "function") {
        onPersonCreated(created);
      }
    } catch (e2) {
      setLocalMsg("people", e2?.message || "Falha ao cadastrar pessoa.");
    }
  }

  async function createSupplierCategory(e) {
    e?.preventDefault?.();
    setLocalMsg("category", "");
    try {
      await api.post("/supplier-categories", {
        name: String(categoryForm.name || "").trim(),
        parent_id: asId(categoryForm.parent_id),
        is_active: !!categoryForm.is_active,
      });
      setLocalMsg("category", "Categoria cadastrada.");
      setCategoryForm({ name: "", parent_id: "", is_active: true });
      await loadAll();
    } catch (e2) {
      setLocalMsg("category", e2?.message || "Falha ao cadastrar categoria.");
    }
  }

  async function createSupplierTag(e) {
    e?.preventDefault?.();
    setLocalMsg("tag", "");
    try {
      await api.post("/supplier-tags", {
        name: String(tagForm.name || "").trim(),
        is_active: !!tagForm.is_active,
      });
      setLocalMsg("tag", "Tag cadastrada.");
      setTagForm({ name: "", is_active: true });
      await loadAll();
    } catch (e2) {
      setLocalMsg("tag", e2?.message || "Falha ao cadastrar tag.");
    }
  }

  async function createCostCenter(e) {
    e?.preventDefault?.();
    setLocalMsg("costCenter", "");
    try {
      await api.post("/cost-centers", {
        code: String(costCenterForm.code || "").trim().toUpperCase(),
        name: String(costCenterForm.name || "").trim(),
        parent_id: asId(costCenterForm.parent_id),
        is_active: !!costCenterForm.is_active,
      });
      setLocalMsg("costCenter", "Centro de custo cadastrado.");
      setCostCenterForm({ code: "", name: "", parent_id: "", is_active: true });
      await loadAll();
    } catch (e2) {
      setLocalMsg("costCenter", e2?.message || "Falha ao cadastrar centro de custo.");
    }
  }

  async function createBankAccount(e) {
    e?.preventDefault?.();
    setLocalMsg("bank", "");
    try {
      await api.post("/bank-accounts", {
        name: String(bankForm.name || "").trim(),
        bank_name: String(bankForm.bank_name || "").trim(),
        branch: String(bankForm.branch || "").trim(),
        account_number: String(bankForm.account_number || "").trim(),
        account_type: String(bankForm.account_type || "CORRENTE").toUpperCase(),
        opening_balance: Number(bankForm.opening_balance || 0),
        is_active: !!bankForm.is_active,
      });
      setLocalMsg("bank", "Conta bancaria cadastrada.");
      setBankForm({
        name: "",
        bank_name: "",
        branch: "",
        account_number: "",
        account_type: "CORRENTE",
        opening_balance: "0",
        is_active: true,
      });
      await loadAll();
    } catch (e2) {
      setLocalMsg("bank", e2?.message || "Falha ao cadastrar conta bancaria.");
    }
  }

  async function createPaymentMethod(e) {
    e?.preventDefault?.();
    setLocalMsg("payment", "");
    try {
      await api.post("/payment-methods", {
        name: String(paymentForm.name || "").trim(),
        method_type: String(paymentForm.method_type || "PIX").toUpperCase(),
        fee_percent: Number(paymentForm.fee_percent || 0),
        term_days: Number(paymentForm.term_days || 0),
        default_bank_account_id: asId(paymentForm.default_bank_account_id),
        is_active: !!paymentForm.is_active,
      });
      setLocalMsg("payment", "Forma de pagamento cadastrada.");
      setPaymentForm({
        name: "",
        method_type: "PIX",
        fee_percent: "0",
        term_days: "0",
        default_bank_account_id: "",
        is_active: true,
      });
      await loadAll();
    } catch (e2) {
      setLocalMsg("payment", e2?.message || "Falha ao cadastrar forma de pagamento.");
    }
  }

  async function seedPeopleDemo() {
    setLocalMsg("people", "");
    try {
      const res = await api.post("/people/seed-demo", {});
      setLocalMsg("people", `Cadastro demo executado: ${res?.created || 0} pessoa(s) criada(s).`);
      await loadAll();
    } catch (e) {
      setLocalMsg("people", e?.message || "Falha ao popular pessoas demo.");
    }
  }

  const content = (
    <div className="faz-fin-cad">
      {!hideHeader ? (
        <CrasPageHeader
          eyebrow="FINANCEIRO"
          title="Configuracoes e dicionario"
          subtitle="Plano de contas Inttegra + pessoas, fornecedores, centros de custo, contas e formas de pagamento."
        />
      ) : null}

      {err ? <div className="faz-fin-cad-alert">{err}</div> : null}

      {showAccounts ? (
        <>
          <div className="faz-fin-cad-switches">
            <button
              type="button"
              className={`chip ${showAccountsPanel ? "rec" : ""}`}
              onClick={() => setShowAccountsPanel((v) => !v)}
            >
              {showAccountsPanel ? "Ocultar plano de contas" : "Mostrar plano de contas"}
            </button>
          </div>
          {showAccountsPanel ? (
            <section ref={setSectionRef("accounts")} className={sectionClass("faz-fin-cad-card", "accounts")}>
              <div className="faz-fin-cad-head">
                <div>
                  <h3>Plano de Contas Inttegra</h3>
                  <p>Estrutura em niveis 1 a 4 para classificacao de receitas e despesas.</p>
                </div>
                <div className="faz-fin-cad-actions">
                  <button type="button" className="faz-btn" onClick={() => seedAccounts(false)}>
                    Atualizar seed
                  </button>
                  <button type="button" className="faz-btn primary" onClick={() => seedAccounts(true)}>
                    Recriar seed
                  </button>
                  <button type="button" className="faz-btn" onClick={loadAll} disabled={loading}>
                    {loading ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>
              </div>

              <div className="faz-fin-cad-kpis">
                <div className="kpi"><span>Total contas</span><b>{accounts.length}</b></div>
                <div className="kpi"><span>Nivel 1</span><b>{levelStats[1]}</b></div>
                <div className="kpi"><span>Nivel 2</span><b>{levelStats[2]}</b></div>
                <div className="kpi"><span>Nivel 3</span><b>{levelStats[3]}</b></div>
                <div className="kpi"><span>Nivel 4</span><b>{levelStats[4]}</b></div>
              </div>

              <div className="faz-fin-cad-filters">
                <input
                  className="faz-input"
                  placeholder="Buscar por codigo ou nome..."
                  value={accQ}
                  onChange={(e) => setAccQ(e.target.value)}
                />
                <select className="faz-input" value={accCategory} onChange={(e) => setAccCategory(e.target.value)}>
                  <option value="ALL">Todas categorias</option>
                  {ACCOUNT_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="faz-input" value={accLevel} onChange={(e) => setAccLevel(e.target.value)}>
                  <option value="ALL">Todos niveis</option>
                  <option value="1">Nivel 1</option>
                  <option value="2">Nivel 2</option>
                  <option value="3">Nivel 3</option>
                  <option value="4">Nivel 4</option>
                </select>
              </div>

              {seedMsg ? <div className="faz-fin-cad-note">{seedMsg}</div> : null}

              <div className="faz-fin-cad-tableWrap">
                <table className="faz-fin-cad-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Conta</th>
                      <th>Nivel</th>
                      <th>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((a) => (
                      <tr key={a.code}>
                        <td>{a.code}</td>
                        <td>{a.name}</td>
                        <td>{a.level}</td>
                        <td>{a.category}</td>
                      </tr>
                    ))}
                    {!filteredAccounts.length ? (
                      <tr><td colSpan={4}>Nenhuma conta encontrada.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {showPeople ? (
        <section ref={setSectionRef("people")} className={sectionClass("faz-fin-cad-card", "people")}>
          <div className="faz-fin-cad-head">
            <div>
              <h3>Pessoas e empresas</h3>
              <p>Clientes, fornecedores, colaboradores, transportadoras e proprietario.</p>
            </div>
            <div className="faz-fin-cad-actions">
              <button type="button" className="faz-btn" onClick={seedPeopleDemo}>Popular demo</button>
              <button type="button" className="faz-btn" onClick={seedSupplierCatalog}>Popular categorias/tags</button>
              <button type="button" className="faz-btn" onClick={seedCostCenters}>Popular centros</button>
              <button type="button" className="faz-btn" onClick={seedPaymentMethods}>Popular pagamentos</button>
            </div>
          </div>

          <div className="faz-fin-cad-subtabs" role="tablist" aria-label="Pessoas e empresas">
            <button
              type="button"
              className={`subtab ${peopleTab === "cadastro" ? "active" : ""}`}
              onClick={() => setPeopleTab("cadastro")}
              role="tab"
              aria-selected={peopleTab === "cadastro"}
            >
              Cadastro
            </button>
            <button
              type="button"
              className={`subtab ${peopleTab === "lista" ? "active" : ""}`}
              onClick={() => setPeopleTab("lista")}
              role="tab"
              aria-selected={peopleTab === "lista"}
            >
              Lista cadastrada
            </button>
          </div>

          {peopleTab === "cadastro" ? (
            <>
              <form onSubmit={createPerson} className="faz-fin-cad-form faz-fin-cad-form-person">
                <input
                  className="faz-input"
                  placeholder="Nome"
                  value={personForm.name}
                  onChange={(e) => setPersonForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="faz-input"
                  placeholder="Razao social (opcional)"
                  value={personForm.legal_name}
                  onChange={(e) => setPersonForm((p) => ({ ...p, legal_name: e.target.value }))}
                />
                <select
                  className="faz-input"
                  value={personForm.document_type}
                  onChange={(e) => setPersonForm((p) => ({ ...p, document_type: e.target.value }))}
                >
                  {DOC_TYPE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  className="faz-input"
                  placeholder="Documento"
                  value={personForm.document}
                  onChange={(e) => setPersonForm((p) => ({ ...p, document: e.target.value }))}
                />

                <input
                  className="faz-input"
                  placeholder="Telefone"
                  value={personForm.phone}
                  onChange={(e) => setPersonForm((p) => ({ ...p, phone: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="E-mail"
                  value={personForm.email}
                  onChange={(e) => setPersonForm((p) => ({ ...p, email: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="CEP"
                  value={personForm.zip_code}
                  onChange={(e) => setPersonForm((p) => ({ ...p, zip_code: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Rua"
                  value={personForm.street}
                  onChange={(e) => setPersonForm((p) => ({ ...p, street: e.target.value }))}
                />

                <input
                  className="faz-input"
                  placeholder="Numero"
                  value={personForm.number}
                  onChange={(e) => setPersonForm((p) => ({ ...p, number: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Bairro"
                  value={personForm.district}
                  onChange={(e) => setPersonForm((p) => ({ ...p, district: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Cidade"
                  value={personForm.city}
                  onChange={(e) => setPersonForm((p) => ({ ...p, city: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="UF"
                  maxLength={2}
                  value={personForm.state}
                  onChange={(e) => setPersonForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                />

                <select
                  className="faz-input"
                  value={personForm.supplier_category_id}
                  onChange={(e) => setPersonForm((p) => ({ ...p, supplier_category_id: e.target.value }))}
                >
                  <option value="">Categoria fornecedor (opcional)</option>
                  {supplierCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  className="faz-input"
                  placeholder="Tags fornecedor (csv: nutricao,frete)"
                  value={personForm.supplier_tags_csv}
                  onChange={(e) => setPersonForm((p) => ({ ...p, supplier_tags_csv: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Banco"
                  value={personForm.bank_name}
                  onChange={(e) => setPersonForm((p) => ({ ...p, bank_name: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Agencia"
                  value={personForm.bank_branch}
                  onChange={(e) => setPersonForm((p) => ({ ...p, bank_branch: e.target.value }))}
                />

                <input
                  className="faz-input"
                  placeholder="Conta"
                  value={personForm.bank_account}
                  onChange={(e) => setPersonForm((p) => ({ ...p, bank_account: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Chave PIX"
                  value={personForm.pix_key}
                  onChange={(e) => setPersonForm((p) => ({ ...p, pix_key: e.target.value }))}
                />
                <select
                  className="faz-input"
                  value={personForm.pix_type}
                  onChange={(e) => setPersonForm((p) => ({ ...p, pix_type: e.target.value }))}
                >
                  <option value="">Tipo PIX</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">EMAIL</option>
                  <option value="PHONE">PHONE</option>
                  <option value="RANDOM">RANDOM</option>
                </select>

                <div className="faz-fin-cad-roles">
                  {ROLE_OPTIONS.map((r) => (
                    <label key={r.key} className="role-chip">
                      <input
                        type="checkbox"
                        checked={!!personForm[r.key]}
                        onChange={() => toggleRole(r.key)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                <button type="submit" className="faz-btn primary">Cadastrar pessoa</button>
              </form>

              {msg.people ? <div className="faz-fin-cad-note">{msg.people}</div> : null}
            </>
          ) : (
            <div className="faz-fin-cad-tableWrap">
              <table className="faz-fin-cad-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipos</th>
                    <th>Categoria</th>
                    <th>Tags</th>
                    <th>Documento</th>
                    <th>Cidade/UF</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{(Array.isArray(p.roles) ? p.roles : []).map(roleLabel).join(", ") || "-"}</td>
                      <td>{categoriesById[p.supplier_category_id]?.name || "-"}</td>
                      <td>{Array.isArray(p.supplier_tags) ? p.supplier_tags.join(", ") : (p.supplier_tags_csv || "-")}</td>
                      <td>{[p.document_type || "", p.document || ""].filter(Boolean).join(": ") || "-"}</td>
                      <td>{[p.city || "", p.state || ""].filter(Boolean).join("/") || "-"}</td>
                    </tr>
                  ))}
                  {!people.length ? (
                    <tr><td colSpan={6}>Nenhuma pessoa cadastrada.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="faz-fin-cad-grid4">
            <section
              ref={setSectionRef("supplier_categories")}
              className={sectionClass("faz-fin-mini-card", "supplier_categories")}
            >
              <h4>Categorias de fornecedor</h4>
              <form onSubmit={createSupplierCategory} className="faz-fin-mini-form">
                <input
                  className="faz-input"
                  placeholder="Nome da categoria"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <select
                  className="faz-input"
                  value={categoryForm.parent_id}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, parent_id: e.target.value }))}
                >
                  <option value="">Sem categoria pai</option>
                  {supplierCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="submit" className="faz-btn">Cadastrar categoria</button>
              </form>
              {msg.category ? <div className="faz-fin-cad-note">{msg.category}</div> : null}
              <div className="faz-fin-mini-list">
                {supplierCategories.slice(0, 12).map((c) => (
                  <div key={c.id} className="mini-row">
                    <span>{c.name}</span>
                    <small>{c.parent_id ? `pai #${c.parent_id}` : "raiz"}</small>
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={setSectionRef("supplier_tags")}
              className={sectionClass("faz-fin-mini-card", "supplier_tags")}
            >
              <h4>Tags de fornecedor</h4>
              <form onSubmit={createSupplierTag} className="faz-fin-mini-form">
                <input
                  className="faz-input"
                  placeholder="Nome da tag"
                  value={tagForm.name}
                  onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <button type="submit" className="faz-btn">Cadastrar tag</button>
              </form>
              {msg.tag ? <div className="faz-fin-cad-note">{msg.tag}</div> : null}
              <div className="faz-fin-mini-list">
                {supplierTags.slice(0, 16).map((t) => (
                  <div key={t.id} className="mini-row">
                    <span>{t.name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={setSectionRef("cost_centers")}
              className={sectionClass("faz-fin-mini-card", "cost_centers")}
            >
              <h4>Centros de custo</h4>
              <form onSubmit={createCostCenter} className="faz-fin-mini-form">
                <input
                  className="faz-input"
                  placeholder="Codigo"
                  value={costCenterForm.code}
                  onChange={(e) => setCostCenterForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
                <input
                  className="faz-input"
                  placeholder="Nome"
                  value={costCenterForm.name}
                  onChange={(e) => setCostCenterForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <select
                  className="faz-input"
                  value={costCenterForm.parent_id}
                  onChange={(e) => setCostCenterForm((p) => ({ ...p, parent_id: e.target.value }))}
                >
                  <option value="">Sem centro pai</option>
                  {costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
                <button type="submit" className="faz-btn">Cadastrar centro</button>
              </form>
              {msg.costCenter ? <div className="faz-fin-cad-note">{msg.costCenter}</div> : null}
              <div className="faz-fin-mini-list">
                {costCenters.slice(0, 12).map((c) => (
                  <div key={c.id} className="mini-row">
                    <span>{c.code} - {c.name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={setSectionRef("bank_accounts")}
              className={sectionClass("faz-fin-mini-card", "bank_accounts")}
            >
              <h4>Contas bancarias</h4>
              <form onSubmit={createBankAccount} className="faz-fin-mini-form">
                <input
                  className="faz-input"
                  placeholder="Nome da conta"
                  value={bankForm.name}
                  onChange={(e) => setBankForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="faz-input"
                  placeholder="Banco"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Agencia"
                  value={bankForm.branch}
                  onChange={(e) => setBankForm((p) => ({ ...p, branch: e.target.value }))}
                />
                <input
                  className="faz-input"
                  placeholder="Conta"
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))}
                />
                <select
                  className="faz-input"
                  value={bankForm.account_type}
                  onChange={(e) => setBankForm((p) => ({ ...p, account_type: e.target.value }))}
                >
                  {BANK_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="faz-input"
                  type="number"
                  step="0.01"
                  placeholder="Saldo inicial"
                  value={bankForm.opening_balance}
                  onChange={(e) => setBankForm((p) => ({ ...p, opening_balance: e.target.value }))}
                />
                <button type="submit" className="faz-btn">Cadastrar conta</button>
              </form>
              {msg.bank ? <div className="faz-fin-cad-note">{msg.bank}</div> : null}
              <div className="faz-fin-mini-list">
                {bankAccounts.slice(0, 10).map((b) => (
                  <div key={b.id} className="mini-row">
                    <span>{b.name} ({b.bank_name || "Banco"})</span>
                    <small>{b.account_type}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section
            ref={setSectionRef("payment_methods")}
            className={sectionClass("faz-fin-mini-card", "payment_methods")}
          >
            <h4>Formas de pagamento e recebimento</h4>
            <form onSubmit={createPaymentMethod} className="faz-fin-mini-form faz-fin-mini-form-payment">
              <input
                className="faz-input"
                placeholder="Nome"
                value={paymentForm.name}
                onChange={(e) => setPaymentForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <select
                className="faz-input"
                value={paymentForm.method_type}
                onChange={(e) => setPaymentForm((p) => ({ ...p, method_type: e.target.value }))}
              >
                {PAYMENT_METHOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                className="faz-input"
                type="number"
                step="0.01"
                placeholder="Taxa (%)"
                value={paymentForm.fee_percent}
                onChange={(e) => setPaymentForm((p) => ({ ...p, fee_percent: e.target.value }))}
              />
              <input
                className="faz-input"
                type="number"
                step="1"
                placeholder="Prazo (dias)"
                value={paymentForm.term_days}
                onChange={(e) => setPaymentForm((p) => ({ ...p, term_days: e.target.value }))}
              />
              <select
                className="faz-input"
                value={paymentForm.default_bank_account_id}
                onChange={(e) => setPaymentForm((p) => ({ ...p, default_bank_account_id: e.target.value }))}
              >
                <option value="">Conta padrao (opcional)</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button type="submit" className="faz-btn">Cadastrar forma</button>
            </form>
            {msg.payment ? <div className="faz-fin-cad-note">{msg.payment}</div> : null}
            <div className="faz-fin-mini-list faz-fin-mini-list-grid">
              {paymentMethods.map((p) => (
                <div key={p.id} className="mini-row">
                  <span>{p.name} ({p.method_type})</span>
                  <small>taxa {Number(p.fee_percent || 0).toFixed(2)}% | prazo {Number(p.term_days || 0)}d</small>
                </div>
              ))}
              {!paymentMethods.length ? <div className="mini-row"><span>Nenhuma forma cadastrada.</span></div> : null}
            </div>
          </section>

          <section
            ref={setSectionRef("approval_policy")}
            className={sectionClass("faz-fin-mini-card", "approval_policy")}
          >
            <h4>Alcada de aprovacao financeira</h4>
            <p className="faz-fin-mini-hint">
              Quando ativo, lancamentos entram como <b>pendente aprovacao</b> conforme as faixas por valor.
            </p>
            <form onSubmit={saveApprovalPolicy} className="faz-fin-mini-form faz-fin-mini-form-policy">
              <label className="role-chip">
                <input
                  type="checkbox"
                  checked={!!approvalPolicy.enabled}
                  onChange={(e) => updateApprovalPolicyField("enabled", e.target.checked)}
                />
                Ativar aprovacao por alcada
              </label>

              <div className="faz-fin-policy-grid">
                <div className="faz-fin-policy-col">
                  <div className="faz-fin-policy-title">Faixas de despesa (R$)</div>
                  <div className="faz-fin-policy-rows">
                    {(approvalPolicy.payable_tiers || []).map((row, idx) => (
                      <div key={`payable-tier-${idx}`} className="faz-fin-policy-row">
                        <input
                          className="faz-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Valor minimo"
                          value={row.min_brl}
                          onChange={(e) => updateApprovalTier("payable", idx, "min_brl", e.target.value)}
                        />
                        <select
                          className="faz-input"
                          value={row.required_by || "gestor"}
                          onChange={(e) => updateApprovalTier("payable", idx, "required_by", e.target.value)}
                        >
                          {APPROVER_ROLE_OPTIONS.map((opt) => (
                            <option key={`payable-role-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="faz-btn ghost" onClick={() => removeApprovalTier("payable", idx)}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="faz-btn ghost" onClick={() => addApprovalTier("payable")}>
                    + Faixa despesa
                  </button>
                </div>

                <div className="faz-fin-policy-col">
                  <div className="faz-fin-policy-title">Faixas de receita (R$)</div>
                  <div className="faz-fin-policy-rows">
                    {(approvalPolicy.receivable_tiers || []).map((row, idx) => (
                      <div key={`receivable-tier-${idx}`} className="faz-fin-policy-row">
                        <input
                          className="faz-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Valor minimo"
                          value={row.min_brl}
                          onChange={(e) => updateApprovalTier("receivable", idx, "min_brl", e.target.value)}
                        />
                        <select
                          className="faz-input"
                          value={row.required_by || "gestor"}
                          onChange={(e) => updateApprovalTier("receivable", idx, "required_by", e.target.value)}
                        >
                          {APPROVER_ROLE_OPTIONS.map((opt) => (
                            <option key={`receivable-role-${opt.value}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="faz-btn ghost" onClick={() => removeApprovalTier("receivable", idx)}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="faz-btn ghost" onClick={() => addApprovalTier("receivable")}>
                    + Faixa receita
                  </button>
                </div>
              </div>

              <div className="faz-fin-policy-fallback">
                <div className="faz-fin-policy-title">Fallback por limite unico (compatibilidade)</div>
                <input
                  className="faz-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Limite despesa (R$)"
                  value={approvalPolicy.payable_threshold_brl}
                  onChange={(e) => updateApprovalPolicyField("payable_threshold_brl", e.target.value)}
                />
                <select
                  className="faz-input"
                  value={approvalPolicy.payable_required_by}
                  onChange={(e) => updateApprovalPolicyField("payable_required_by", e.target.value)}
                >
                  {APPROVER_ROLE_OPTIONS.map((opt) => (
                    <option key={`payable-threshold-role-${opt.value}`} value={opt.value}>
                      Aprovar despesa: {opt.label}
                    </option>
                  ))}
                </select>

                <input
                  className="faz-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Limite receita (R$)"
                  value={approvalPolicy.receivable_threshold_brl}
                  onChange={(e) => updateApprovalPolicyField("receivable_threshold_brl", e.target.value)}
                />
                <select
                  className="faz-input"
                  value={approvalPolicy.receivable_required_by}
                  onChange={(e) => updateApprovalPolicyField("receivable_required_by", e.target.value)}
                >
                  {APPROVER_ROLE_OPTIONS.map((opt) => (
                    <option key={`receivable-threshold-role-${opt.value}`} value={opt.value}>
                      Aprovar receita: {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="faz-btn">Salvar alcada</button>
            </form>
            {msg.policy ? <div className="faz-fin-cad-note">{msg.policy}</div> : null}
          </section>
        </section>
      ) : null}
    </div>
  );

  if (embedded) return content;
  return <div className="cras-stage-v2">{content}</div>;
}
