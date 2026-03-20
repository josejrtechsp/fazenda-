import React from "react";
import EstoqueBase from "./EstoqueBase.jsx";

const columns = [
  { key: "nome", label: "Nome" },
  { key: "fabricante", label: "Fabricante" },
  { key: "quantidade", label: "Quantidade", align: "right" },
  { key: "precoUnitario", label: "Preço Unitário", align: "right" },
  { key: "lote", label: "Lote" },
  { key: "validade", label: "Validade" },
  { key: "local", label: "Local" },
  { key: "propriedade", label: "Propriedade" },
  { key: "valor", label: "Valor", align: "right" },
  { key: "ultimaMovimentacao", label: "Última Movimentação" },
];

function buildKpis(rows) {
  const totalItems = rows.length;
  const totalQty = rows.reduce((acc, row) => acc + Number(row.quantidade || 0), 0);
  const totalValue = rows.reduce((acc, row) => acc + Number(row.valor || 0), 0);
  return [
    { label: "Itens", value: totalItems.toLocaleString("pt-BR") },
    { label: "Quantidade total", value: totalQty.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    {
      label: "Valor total",
      value: totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
  ];
}

export default function EstoqueNutricional() {
  return (
    <EstoqueBase
      kind="nutricional"
      title="Nutricional"
      subtitle="Estoque de insumos nutricionais sincronizado com itens e compras."
      tabs={["Inventário", "Receitas", "Itens", "Catálogo"]}
      activeTab="Inventário"
      columns={columns}
      buildKpis={buildKpis}
      enableNutritionSync
      seedItems={[]}
    />
  );
}
