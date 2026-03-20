import React from "react";
import EstoqueBase from "./EstoqueBase.jsx";

const columns = [
  { key: "nome", label: "Nome" },
  { key: "tipo", label: "Tipo" },
  { key: "fabricante", label: "Fabricante" },
  { key: "quantidade", label: "Quantidade", align: "right" },
  { key: "precoUnitario", label: "Preço Unitário", align: "right" },
  { key: "lote", label: "Partida" },
  { key: "local", label: "Local" },
  { key: "propriedade", label: "Propriedade" },
  { key: "valor", label: "Valor", align: "right" },
  { key: "ultimaMovimentacao", label: "Última Movimentação" },
];

function buildKpis(rows) {
  const totalDoses = rows.reduce((acc, row) => acc + Number(row.quantidade || 0), 0);
  const semen = rows
    .filter((row) => String(row.tipo || "").toLowerCase().includes("sêmen") || String(row.tipo || "").toLowerCase().includes("semen"))
    .reduce((acc, row) => acc + Number(row.quantidade || 0), 0);
  const ovulos = rows
    .filter((row) => String(row.tipo || "").toLowerCase().includes("óvulo") || String(row.tipo || "").toLowerCase().includes("ovulo"))
    .reduce((acc, row) => acc + Number(row.quantidade || 0), 0);
  const embrioes = rows
    .filter((row) => String(row.tipo || "").toLowerCase().includes("embri"))
    .reduce((acc, row) => acc + Number(row.quantidade || 0), 0);
  const totalValue = rows.reduce((acc, row) => acc + Number(row.valor || 0), 0);

  return [
    { label: "Doses totais", value: totalDoses.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    { label: "Sêmens", value: semen.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    { label: "Óvulos", value: ovulos.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    { label: "Embriões", value: embrioes.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
    {
      label: "Valor total",
      value: totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
  ];
}

export default function EstoqueSemenEmbrioes() {
  return (
    <EstoqueBase
      kind="semen"
      title="Sêmen, Óvulos e Embriões"
      subtitle="Controle de doses, partidas e movimentações de reprodução."
      columns={columns}
      buildKpis={buildKpis}
      seedItems={[]}
    />
  );
}
