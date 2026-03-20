import React, { useMemo, useState } from "react";
import CrasPageHeader from "../components/CrasPageHeader.jsx";
import "../styles/areas_pasture.css";

function toNum(v, fd = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  });
}

function kg(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${toNum(n, 0)} kg`;
}

function ha(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${toNum(n, 0)} ha`;
}

function mockRows() {
  return [
    {
      id: 1,
      nome: "FAZENDA",
      lotesIncluidos: "NOVILHAS 2 ANOS E MEIO",
      tamanhoHa: 300,
      animais: 245,
      ua: 195.418,
      piqueteAtivo: 0,
      piquetes: 0,
      ocupacaoPct: 0,
      taxaLotacaoUaHa: 0.651,
      pesoTotalKg: 87938,
      lotacaoMax: 0,
    },
    {
      id: 2,
      nome: "Manga 01",
      lotesIncluidos: "—",
      tamanhoHa: 0,
      animais: 0,
      ua: 0,
      piqueteAtivo: 0,
      piquetes: 0,
      ocupacaoPct: 0,
      taxaLotacaoUaHa: 0,
      pesoTotalKg: 0,
      lotacaoMax: 0,
    },
    {
      id: 3,
      nome: "Manga 02",
      lotesIncluidos: "—",
      tamanhoHa: 0,
      animais: 0,
      ua: 0,
      piqueteAtivo: 0,
      piquetes: 0,
      ocupacaoPct: 0,
      taxaLotacaoUaHa: 0,
      pesoTotalKg: 0,
      lotacaoMax: 0,
    },
  ];
}

export default function AreasPasture({ onOpenArea, onTransferFromArea }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => mockRows(), []);

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const text = `${r.nome} ${r.lotesIncluidos}`.toLowerCase();
      return text.includes(s);
    });
  }, [rows, q]);

  const summary = useMemo(() => {
    const areaTotal = rows.reduce((acc, r) => acc + (Number(r.tamanhoHa) || 0), 0);
    const totalAnimais = rows.reduce((acc, r) => acc + (Number(r.animais) || 0), 0);
    const pesoTotalKg = rows.reduce((acc, r) => acc + (Number(r.pesoTotalKg) || 0), 0);
    const totalUa = rows.reduce((acc, r) => acc + (Number(r.ua) || 0), 0);
    const totalLotes = rows.filter((r) => String(r.lotesIncluidos || "—") !== "—").length;
    const taxaMedia = areaTotal > 0 ? totalUa / areaTotal : 0;
    const cabecaHa = areaTotal > 0 ? totalAnimais / areaTotal : 0;
    return {
      areaTotal,
      areaUtil: areaTotal,
      areaReserva: 0,
      taxaMedia,
      totalAnimais,
      totalLotes,
      pesoTotalKg,
      totalUa,
      ocupacao: 0,
      cabecaHa,
      lotacaoMax: 0,
    };
  }, [rows]);

  function openDetail(row) {
    if (typeof onOpenArea === "function") {
      onOpenArea({
        id: row.id,
        code: row.id,
        name: row.nome,
        lot: row.lotesIncluidos === "—" ? "" : row.lotesIncluidos,
        heads: row.animais,
        status: Number(row.animais) > 0 ? "occupied" : "empty",
        daysOcc: Number(row.animais) > 0 ? 2 : 0,
        daysRest: Number(row.animais) > 0 ? 0 : 12,
        restIdeal: 21,
      });
    }
  }

  function openTransfer(row) {
    if (typeof onTransferFromArea === "function") {
      onTransferFromArea({
        from_area_id: row.id,
        from_area_name: row.nome,
      });
    }
  }

  return (
    <div className="cras-ui-v2 areas-page">
      <CrasPageHeader
        eyebrow="Operação"
        title="Áreas"
        subtitle="Visão rápida de ocupação e lotação da fazenda."
        actions={[{ key: "refresh", label: "Atualizar", tone: "soft" }]}
        onAction={() => {}}
      />

      <div className="areasHeroMap" aria-hidden="true">
        <div className="areasHeroShade" />
        <div className="areasMapTools">
          <button type="button">⤢</button>
          <button type="button">◎</button>
          <button type="button">⌖</button>
          <button type="button">⌕</button>
          <button type="button">⌂</button>
        </div>
      </div>

      <div className="areasKpiGrid">
        <div className="areasKpi"><span>ÁREA TOTAL</span><b>{ha(summary.areaTotal)}</b></div>
        <div className="areasKpi"><span>ÁREA UTILIZÁVEL</span><b>{ha(summary.areaUtil)}</b></div>
        <div className="areasKpi"><span>ÁREA DE RESERVA</span><b>{ha(summary.areaReserva)}</b></div>
        <div className="areasKpi"><span>TAXA DE LOTAÇÃO</span><b>{toNum(summary.taxaMedia, 2)} UA/ha</b></div>
        <div className="areasKpi"><span>TOTAL DE ANIMAIS</span><b>{toNum(summary.totalAnimais)}</b></div>
        <div className="areasKpi"><span>TOTAL DE LOTES</span><b>{toNum(summary.totalLotes)}</b></div>
        <div className="areasKpi"><span>PESO TOTAL</span><b>{kg(summary.pesoTotalKg)}</b></div>
        <div className="areasKpi"><span>TOTAL UA</span><b>{toNum(summary.totalUa, 2)} UA</b></div>
        <div className="areasKpi"><span>% DE OCUPAÇÃO</span><b>{toNum(summary.ocupacao, 0)}%</b></div>
        <div className="areasKpi"><span>CABEÇA / HA</span><b>{toNum(summary.cabecaHa, 2)}</b></div>
        <div className="areasKpi"><span>LOTAÇÃO MÁXIMA</span><b>{toNum(summary.lotacaoMax, 0)}</b></div>
      </div>

      <div className="areasToolbar">
        <button className="faz-btn" type="button">Filtro IA</button>
        <button className="faz-btn" type="button">Filtrar</button>
        <input
          className="faz-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar área ou lote..."
        />
      </div>

      <div className="areasTableWrap">
        <table className="areasTable">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Lotes Incluídos</th>
              <th>Tamanho</th>
              <th>Animais</th>
              <th>UA</th>
              <th>Piquete Ativo</th>
              <th>Piquetes</th>
              <th>% Ocupação</th>
              <th>Taxa de Lotação</th>
              <th>Peso total</th>
              <th>Lotação Máx.</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td>{r.lotesIncluidos || "—"}</td>
                <td>{ha(r.tamanhoHa)}</td>
                <td>{toNum(r.animais)}</td>
                <td>{toNum(r.ua, 3)}</td>
                <td>{toNum(r.piqueteAtivo)}</td>
                <td>{toNum(r.piquetes)}</td>
                <td>{toNum(r.ocupacaoPct, 0)}%</td>
                <td>{toNum(r.taxaLotacaoUaHa, 3)} UA/ha</td>
                <td>{kg(r.pesoTotalKg)}</td>
                <td>{toNum(r.lotacaoMax)}</td>
                <td>
                  <div className="areasRowActions">
                    <button className="faz-btn sm" type="button" onClick={() => openDetail(r)}>Detalhes</button>
                    <button className="faz-btn sm" type="button" onClick={() => openTransfer(r)}>Transferir</button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={12} className="areasEmpty">Nenhuma área encontrada para este filtro.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
