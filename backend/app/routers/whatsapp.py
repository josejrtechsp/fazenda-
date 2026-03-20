from __future__ import annotations

import json
import os
import urllib.request

import re
import unicodedata
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlmodel import Session, select

from app.config import WA_VERIFY_TOKEN
from app.db.session import get_session
from app.models import Event
from app.models.nutrition import NutritionItem, NutritionPurchase
from app.routers.events import _apply_transfer

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

_VAQUEIRO_TEMPLATES: Dict[str, Any] = {
    "version": "v1",
    "title": "Mensagens prontas do vaqueiro",
    "quick_rules": [
        "Sempre informar manga/lote com número (ex: manga 10, lote 2).",
        "Para nutrição: dizer quantidade + unidade + local (ex: 2 sacos de ração na manga 10).",
        "Para transferência: dizer origem e destino (ex: do lote 2 para a manga 5).",
        "Uma ação por mensagem para reduzir erro.",
    ],
    "categories": [
        {
            "key": "transfer",
            "title": "Transferência de gado",
            "examples": [
                "coloquei o lote 2 na manga 5",
                "mudei 30 cabeças do lote 10 para o lote 15",
                "passei 25 do lote 3 para a manga 12",
                "brincos 7812 A2391 do lote 10 para lote 15",
            ],
        },
        {
            "key": "nutrition",
            "title": "Nutrição e trato",
            "examples": [
                "coloquei 2 sacos de ração na manga 10",
                "dei meio saco de sal mineral na manga 12",
                "botei 30 kg de capim no lote 2",
                "forneci 1 saco de proteinado na manga 7",
            ],
        },
        {
            "key": "occurrence",
            "title": "Ocorrências de campo",
            "examples": [
                "peguei 18 rebolinhos na manga 4",
                "achei 2 animais mancando no lote 8",
                "rompeu cerca da manga 5",
            ],
        },
        {
            "key": "exit",
            "title": "Venda ou abate",
            "examples": [
                "vendi 120 arrobas por 36000 reais",
                "abati 80 arrobas",
            ],
        },
    ],
}


# -----------------------------
# Helpers: parsing (NLP simples)
# -----------------------------

_PT_MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

_UNIT_ALIASES = {
    "saco": "saco",
    "sacos": "saco",
    "sc": "saco",
    "kg": "kg",
    "quilo": "kg",
    "quilos": "kg",
    "g": "g",
    "grama": "g",
    "gramas": "g",
    "l": "l",
    "litro": "l",
    "litros": "l",
    "@": "@",
    "arroba": "@",
    "arrobas": "@",
    "cabeca": "cabeca",
    "cabeça": "cabeca",
    "cabeças": "cabeca",
    "cabecas": "cabeca",
    "ton": "ton",
    "t": "ton",
    "tonelada": "ton",
    "toneladas": "ton",
    "fardo": "fardo",
    "fardos": "fardo",
    "rolo": "rolo",
    "rolos": "rolo",
    "dose": "dose",
    "doses": "dose",
    "lote": "saco",
    "lotes": "saco",
    "saca": "saco",
    "sacas": "saco",
    "pct": "pacote",
    "pacote": "pacote",
    "pacotes": "pacote",

}

_COST_GROUP_BY_ITEM = {
    "racao": "Nutrição",
    "ração": "Nutrição",
    "sal": "Nutrição",
    "mineral": "Nutrição",
    "suplemento": "Nutrição",
    "protein": "Nutrição",
    "proteico": "Nutrição",
    "silagem de milho": "Nutrição",
    "silagem milho": "Nutrição",
    "silagem": "Nutrição",
    "feno": "Nutrição",
    "capim": "Nutrição",
    "volumoso": "Nutrição",
    "cana": "Nutrição",
    "pre secado": "Nutrição",
    "pré secado": "Nutrição",
    "pré-secado": "Nutrição",

}

_PT_WORD_NUM = {
    "zero": 0.0,
    "um": 1.0,
    "uma": 1.0,
    "dois": 2.0,
    "duas": 2.0,
    "tres": 3.0,
    "três": 3.0,
    "quatro": 4.0,
    "cinco": 5.0,
    "seis": 6.0,
    "sete": 7.0,
    "oito": 8.0,
    "nove": 9.0,
    "dez": 10.0,
    "onze": 11.0,
    "doze": 12.0,
    "treze": 13.0,
    "quatorze": 14.0,
    "catorze": 14.0,
    "quinze": 15.0,
    "dezesseis": 16.0,
    "dezessete": 17.0,
    "dezoito": 18.0,
    "dezenove": 19.0,
    "vinte": 20.0,
    "trinta": 30.0,
    "quarenta": 40.0,
    "cinquenta": 50.0,
    "sessenta": 60.0,
    "setenta": 70.0,
    "oitenta": 80.0,
    "noventa": 90.0,
    "cem": 100.0,
    "cento": 100.0,
    "meio": 0.5,
    "meia": 0.5,
}

_SPELL_FIXES = {
    "mangga": "manga",
    "mangua": "manga",
    "mangaa": "manga",
    "mng": "manga",
    "ltoe": "lote",
    "loti": "lote",
    "lte": "lote",
    "rassao": "racao",
    "ração": "racao",
    "racaoo": "racao",
    "racoa": "racao",
    "racão": "racao",
    "minarau": "mineral",
    "minaral": "mineral",
    "proteinadoo": "proteinado",
}

def _norm(s: str) -> str:
    base = (s or "").strip().lower()
    # remove acentos e normaliza variações comuns do vaqueiro
    base = unicodedata.normalize("NFD", base)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn")
    base = re.sub(r"[^a-z0-9@#\s.,:/-]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    tokens = []
    for tok in base.split(" "):
        if not tok:
            continue
        tokens.append(_SPELL_FIXES.get(tok, tok))
    return " ".join(tokens)

def _to_float_pt(v: str) -> Optional[float]:
    """
    Converte "1.234,56" ou "1234,56" ou "1234.56" para float.
    """
    if not v:
        return None
    s = v.strip()
    # remove espaços
    s = s.replace(" ", "")
    # padrão pt: . milhar e , decimal
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None

def _extract_money_brl(text: str) -> Optional[float]:
    """Extrai um valor em BRL **somente** quando houver contexto de moeda.

    Evita confundir quantidade (ex: '1 saco') com valor (R$).

    Aceita exemplos:
    - 'R$ 120,00'
    - '120 reais' / '120 real'
    - 'R$120'
    """
    # 1) Prefixo R$
    m = re.search(r"r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2})?)", text, re.IGNORECASE)
    if m:
        return _to_float_pt(m.group(1))

    # 2) Sufixo 'real/reais'
    m = re.search(r"(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2})?)\s*(?:reais|real)\b", text, re.IGNORECASE)
    if m:
        return _to_float_pt(m.group(1))

    return None

def _extract_int(text: str) -> Optional[int]:
    m = re.search(r"\b(\d{1,6})\b", text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None

def _extract_qty_and_unit(text: str) -> Tuple[Optional[float], Optional[str]]:
    """
    Extrai algo como "1 saco", "2 sacos", "30 cabecas", "10kg".
    Retorna (qty, unit_norm).
    """
    # 10kg / 10 kg / 1 saco / 30 cabeças
    m = re.search(r"\b(\d+(?:[.,]\d+)?)\s*([a-zA-Z@çÇãÃõÕ]+)\b", text)
    if not m:
        # "dois sacos", "meio saco"
        t = _norm(text)
        m2 = re.search(r"\b([a-zA-ZçÇãÃõÕéÉêÊ]+)\s+([a-zA-Z@çÇãÃõÕ]+)\b", t)
        if not m2:
            return None, None
        qty = _PT_WORD_NUM.get((m2.group(1) or "").strip().lower())
        if qty is None:
            return None, None
        unit_raw = (m2.group(2) or "").strip().lower()
        unit = _UNIT_ALIASES.get(unit_raw, unit_raw)
        return qty, unit
    qty = _to_float_pt(m.group(1))
    unit_raw = m.group(2).strip().lower()
    unit = _UNIT_ALIASES.get(unit_raw, unit_raw)
    return qty, unit

def _extract_area(text: str) -> Optional[int]:
    # "manga 30" | "m30" | "manga #30"
    m = re.search(r"\b(?:manga|m)\s*#?\s*(\d{1,4})\b", text, re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None

def _extract_lot(text: str) -> Optional[int]:
    # "lote 10" | "l10" | "lote #10"
    m = re.search(r"\b(?:lote|l)\s*#?\s*(\d{1,4})\b", text, re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None

def _extract_ear_tags(text: str) -> List[str]:
    """Extrai brincos/IDs individuais para transferência.

    Exemplos suportados:
      - "brinco 30" / "brincos 30 31 32" / "brincos: A12, B33"
      - "gado 30 do lote 10 para o lote 15" (pega 30 como ID)

    Retorna lista de strings (normalizadas), sem duplicados.
    """
    t = (text or "").strip()
    if not t:
        return []

    stop = {"do", "da", "de", "para", "pra", "pro", "na", "no", "nos", "nas", "lote", "manga", "cabeça", "cabeca", "cabeças", "cabecas", "cabeças", "cabecas", "cabeças"}

    def clean(tok: str) -> str:
        s = re.sub(r"[^A-Za-z0-9\-]", "", tok or "").strip()
        return s.upper()

    out: List[str] = []
    seen = set()

    # 1) Após 'brinco(s)'
    for m in re.finditer(r"\bbrincos?\b\s*[:#\-]?\s*([^\n]{0,120})", t, flags=re.IGNORECASE):
        chunk = m.group(1) or ""
        # corta em conectores comuns (evita pegar 'do lote ...')
        chunk = re.split(r"\b(?:do|da|de|para|pra)\b", chunk, maxsplit=1, flags=re.IGNORECASE)[0]
        chunk = chunk.replace(",", " ").replace(";", " ")
        for tok in chunk.split():
            if tok.lower() in stop:
                break
            tag = clean(tok)
            if not tag:
                continue
            if tag not in seen:
                seen.add(tag)
                out.append(tag)

    # 2) Padrões 'gado/animal/boi/vaca/bezerro X'
    for m in re.finditer(r"\b(?:gado|animal|boi|vaca|bezerro|bezerra)\b\s*#?\s*([A-Za-z0-9\-]{1,12})\b", t, flags=re.IGNORECASE):
        tag = clean(m.group(1))
        if tag and tag not in seen:
            seen.add(tag)
            out.append(tag)

    return out

def _extract_transfer(text: str) -> Dict[str, Any]:
    """
    Tenta extrair:
    - qty cabeças (opcional)
    - origem (lote/manga)
    - destino (lote/manga)
    """
    t = text

    # qty: "30 cabeças"
    qty = None
    m_qty = re.search(r"\b(\d{1,6})\s*(?:cabe[cç]as|cabecas|cabeca)\b", t, re.IGNORECASE)
    if m_qty:
        qty = int(m_qty.group(1))
    if qty is None:
        # "passei 30 do lote 2 para o lote 5"
        m_qty2 = re.search(r"\b(\d{1,6})\s+(?:do|da)\s+(?:lote|l)\s*#?\s*\d{1,4}\b", t, re.IGNORECASE)
        if m_qty2:
            qty = int(m_qty2.group(1))

    # origem/destino por padrões "do X para Y"
    origin = {}
    dest = {}

    # "do lote 10 para o lote 15" / "da manga 30 pra manga 12"
    m = re.search(
        r"\b(?:do|da)\s+(lote|l|manga|m)\s*#?\s*(\d{1,4})\s+(?:para|pra)\s+(?:o|a)?\s*(lote|l|manga|m)\s*#?\s*(\d{1,4})\b",
        t,
        re.IGNORECASE
    )
    if m:
        a1, n1, a2, n2 = m.group(1).lower(), int(m.group(2)), m.group(3).lower(), int(m.group(4))
        if a1 in ("manga", "m"):
            origin["area_id"] = n1
        else:
            origin["lot_id"] = n1
        if a2 in ("manga", "m"):
            dest["area_id"] = n2
        else:
            dest["lot_id"] = n2
    else:
        # fallback: primeira manga/lote é destino; se tiver 2, usa ambos
        areas = re.findall(r"\b(?:manga|m)\s*#?\s*(\d{1,4})\b", t, re.IGNORECASE)
        lots = re.findall(r"\b(?:lote|l)\s*#?\s*(\d{1,4})\b", t, re.IGNORECASE)
        # heurística simples
        if len(lots) >= 2:
            origin["lot_id"] = int(lots[0])
            dest["lot_id"] = int(lots[1])
        elif len(areas) >= 2:
            origin["area_id"] = int(areas[0])
            dest["area_id"] = int(areas[1])
        elif len(lots) == 1 and len(areas) == 1:
            # "lote 10 na manga 30" => origem lote, destino manga
            origin["lot_id"] = int(lots[0])
            dest["area_id"] = int(areas[0])

    ear_tags = _extract_ear_tags(text)
    # Evita confundir quantidade com brinco em frases tipo "gado 30 do lote..."
    if qty is not None and ear_tags:
        ear_tags = [x for x in ear_tags if not (x.isdigit() and int(x) == int(qty))]

    transfer_mode = "ear_tags" if ear_tags else "heads"
    # "coloquei o lote 2 na manga 5" => mover lote para manga sem exigir qty
    if (not ear_tags) and qty is None and origin.get("lot_id") and dest.get("area_id"):
        transfer_mode = "lot_move"

    return {
        "qty_heads": qty,
        "ear_tags": ear_tags or None,
        "transfer_mode": transfer_mode,
        "origin": origin or None,
        "destination": dest or None,
    }

def _parse_intent(text: str) -> Dict[str, Any]:
    """
    Retorna dict com:
      intent: "cost"|"transfer"|"exit"|"occurrence"|"unknown"
      confidence: float
      fields: dict
      missing_fields: list[str]
      ambiguities: list[str]
    """
    t = _norm(text)
    missing: List[str] = []
    ambiguities: List[str] = []
    fields: Dict[str, Any] = {}

    # 1) Transferência
    # OBS: se tiver palavra de nutrição (silagem, ração, feno, etc), não trata como transferência.
    if (
        any(w in t for w in ["transferi", "transferencia", "mudei", "passei", "levei", "coloquei", "joguei", "botei", "pus", "mandei"])
        and (("lote" in t) or ("manga" in t) or re.search(r"\bl\d+\b", t) or re.search(r"\bm\d+\b", t))
        and not any(k in t for k in _COST_GROUP_BY_ITEM.keys())
    ):
        tr = _extract_transfer(text)
        fields.update(tr)
        # checa mínimos
        if not tr.get("origin") or not tr.get("destination"):
            ambiguities.append("transfer_missing_origin_or_destination")
        if tr.get("transfer_mode") != "lot_move" and tr.get("qty_heads") is None and not (tr.get("ear_tags") or []):
            missing.append("qty_heads_or_ear_tags")
        return {
            "intent": "transfer",
            "confidence": 0.82 if not ambiguities and not missing else 0.58,
            "fields": fields,
            "missing_fields": missing,
            "ambiguities": ambiguities,
        }

    # 2) Ocorrência (ex: rebolinhos)
    if "rebolinho" in t or "rebolinhos" in t:
        qty = _extract_int(text)
        if qty is None:
            missing.append("qty")
        fields.update({"kind": "rebolinho", "qty": qty})
        return {
            "intent": "occurrence",
            "confidence": 0.7 if qty else 0.55,
            "fields": fields,
            "missing_fields": missing,
            "ambiguities": ambiguities,
        }

    # 3) Saída / venda / abate
    if any(w in t for w in ["vendi", "venda", "abati", "abate", "saída", "saida", "mandei pro abate"]):
        # tenta @ e valor
        arrobas = None
        m_ar = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(?:@|arroba|arrobas)\b", text, re.IGNORECASE)
        if m_ar:
            arrobas = _to_float_pt(m_ar.group(1))
        value = _extract_money_brl(text)
        if arrobas is None:
            missing.append("arrobas")
        if value is None:
            missing.append("value_brl")
        fields.update({"arrobas": arrobas, "value_brl": value})
        return {
            "intent": "exit",
            "confidence": 0.68 if not missing else 0.52,
            "fields": fields,
            "missing_fields": missing,
            "ambiguities": ambiguities,
        }

    # 4) Custo / Nutrição (inclui volumosos: silagem/feno/capim etc)
    # Regra: vaqueiro informa QUANTIDADE + LOCAL (manga/lote). Preço vem da última compra (catálogo).
    qty_probe, unit_probe = _extract_qty_and_unit(text)
    area_probe = _extract_area(text)
    lot_probe = _extract_lot(text)
    if any(k in t for k in _COST_GROUP_BY_ITEM.keys()) and (
        any(w in t for w in ["dei", "forneci", "coloquei", "joguei", "entreguei", "botei", "usei", "pus", "apliquei"])
        or (qty_probe is not None and (area_probe is not None or lot_probe is not None))
    ):
        item = None
        best_len = 0
        for k in _COST_GROUP_BY_ITEM.keys():
            if k in t and len(k) > best_len:
                item = k
                best_len = len(k)

        qty, unit = qty_probe, unit_probe
        area = area_probe
        lot = lot_probe

        # custo
        value = None
        # tenta capturar "R$ x" ou "x reais"
        value = _extract_money_brl(text)

        # unit price pattern: "a 120" / "por 120" etc (opcional)
        unit_price = None
        m_up = re.search(r"\b(?:a|por)\s+r?\$?\s*(\d+(?:[.,]\d{2})?)\b", text, re.IGNORECASE)
        if m_up:
            unit_price = _to_float_pt(m_up.group(1))

        if value is None and unit_price is not None and qty is not None:
            value = round(unit_price * qty, 2)

        group = _COST_GROUP_BY_ITEM.get(item or "", "Nutrição")

        fields.update({
            "group": group,
            "item": item or "nutricao",
            "qty": qty,
            "unit": unit,
            "area_id": area,
            "lot_id": lot,
            "unit_price_brl": unit_price,
            "value_brl": value,
        })

        if qty is None:
            missing.append("qty")
        if unit is None:
            missing.append("unit")
        if area is None and lot is None:
            missing.append("area_or_lot")
        # Para Nutrição, não exige value_brl (vem da última compra).
        if value is None and group.lower() not in ("nutrição", "nutricao"):
            missing.append("value_brl")

        return {
            "intent": "cost",
            "confidence": 0.84 if not missing else 0.56,
            "fields": fields,
            "missing_fields": missing,
            "ambiguities": ambiguities,
        }

    # 5) Custo genérico (se falar "gastei", "paguei", etc)
    if any(w in t for w in ["gastei", "paguei", "pagar", "custo", "despesa"]):
        value = _extract_money_brl(text)
        if value is None:
            missing.append("value_brl")
        fields.update({"group": "Máquinas/Infra/Outros", "value_brl": value})
        return {
            "intent": "cost",
            "confidence": 0.55 if value else 0.45,
            "fields": fields,
            "missing_fields": missing,
            "ambiguities": ambiguities,
        }

    return {
        "intent": "unknown",
        "confidence": 0.2,
        "fields": {},
        "missing_fields": [],
        "ambiguities": [],
    }


def _can_auto_approve(ev_type: str, nlp: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    if ev_type not in ("transfer", "cost", "occurrence", "exit"):
        return False
    missing = nlp.get("missing_fields") or []
    ambiguities = nlp.get("ambiguities") or []
    confidence = float(nlp.get("confidence") or 0.0)
    if ambiguities:
        return False
    if confidence < 0.75:
        return False
    # proteção extra para transferências
    if ev_type == "transfer":
        mode = (payload.get("transfer_mode") or "").strip().lower()
        if mode == "ear_tags":
            return bool(payload.get("ear_tags"))
        if mode == "lot_move":
            o = payload.get("origin") or {}
            d = payload.get("destination") or {}
            return bool(o.get("lot_id")) and bool(d.get("area_id"))
        return payload.get("qty_heads") is not None
    if ev_type == "cost":
        group = str(payload.get("group") or "").strip().lower()
        if group in ("nutrição", "nutricao"):
            # Para nutrição, deixa passar sem preço do catálogo para não travar o vaqueiro.
            allowed_missing = {"value_brl", "unit_price_brl", "nutrition_item"}
            if any(m not in allowed_missing for m in missing):
                return False
            has_qty = payload.get("qty") is not None
            has_unit = bool(payload.get("unit"))
            has_place = payload.get("area_id") is not None or payload.get("lot_id") is not None
            return has_qty and has_unit and has_place and confidence >= 0.70
        # custos fora de nutrição exigem completude
        return not missing

    return not missing



# --------------------------------
# Helpers: Nutrição (catálogo + preço)
# --------------------------------

def _norm_key(s: str) -> str:
    """Normaliza texto para matching: lowercase, sem acento, só [a-z0-9 ]"""
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(s.split())
    return s


def _find_best_nutrition_item(session: Session, text: str) -> Optional[NutritionItem]:
    key = _norm_key(text)
    if not key:
        return None

    items = session.exec(select(NutritionItem).where(NutritionItem.is_active == True)).all()  # noqa
    best: Optional[NutritionItem] = None
    best_score = 0

    for it in items:
        candidates: List[str] = [it.name]
        if it.aliases:
            candidates += [a.strip() for a in str(it.aliases).split(";") if a.strip()]

        for cand in candidates:
            ck = _norm_key(cand)
            if not ck:
                continue
            if ck in key:
                score = len(ck)
                if score > best_score:
                    best = it
                    best_score = score

    return best


def _latest_purchase(session: Session, item_id: int, at: datetime) -> Optional[NutritionPurchase]:
    q = (
        select(NutritionPurchase)
        .where(NutritionPurchase.item_id == int(item_id))
        .where(NutritionPurchase.purchased_at <= at)
        .order_by(NutritionPurchase.purchased_at.desc())
        .limit(1)
    )
    return session.exec(q).first()


def _norm_unit(u: Optional[str]) -> str:
    u = (u or "").strip().lower()
    return _UNIT_ALIASES.get(u, u)


def _convert_unit_price(item: NutritionItem, purchase: NutritionPurchase, desired_unit: str) -> Optional[float]:
    pu = _norm_unit(purchase.unit)
    du = _norm_unit(desired_unit)

    if not du:
        return None

    if pu == du:
        return float(purchase.unit_price_brl)

    # direct conversion kg<->ton
    if pu == "ton" and du == "kg":
        return float(purchase.unit_price_brl) / 1000.0
    if pu == "kg" and du == "ton":
        return float(purchase.unit_price_brl) * 1000.0

    # direct conversion g<->kg
    if pu == "kg" and du == "g":
        return float(purchase.unit_price_brl) / 1000.0
    if pu == "g" and du == "kg":
        return float(purchase.unit_price_brl) * 1000.0

    # kg_per_unit conversions
    if item.kg_per_unit:
        kpu = float(item.kg_per_unit)
        if pu == "kg" and du in ("saco", "fardo", "rolo", "carga", "carreta"):
            return float(purchase.unit_price_brl) * kpu
        if du == "kg" and pu in ("saco", "fardo", "rolo", "carga", "carreta"):
            return float(purchase.unit_price_brl) / kpu

    return None


def _enrich_nutrition_cost(session: Session, text: str, at: datetime, payload: Dict[str, Any]) -> None:
    """Se for custo de Nutrição, tenta:
    - identificar item do catálogo
    - puxar último preço de compra
    - calcular total (qty * unit_price)

    Atualiza payload e payload['nlp'] in-place.
    """
    group = (payload.get("group") or "").strip().lower()
    if group not in ("nutrição", "nutricao"):
        return

    qty = payload.get("qty")
    unit = payload.get("unit")

    # garante estrutura NLP
    nlp = payload.get("nlp") or {}
    nlp_fields = dict(nlp.get("fields") or {})
    missing = list(nlp.get("missing_fields") or [])

    item = _find_best_nutrition_item(session, text)
    if item:
        payload["nutrition_item_id"] = item.id
        payload["nutrition_item_name"] = item.name
        payload["item_raw"] = payload.get("item")
        payload["item"] = item.name

        nlp_fields["nutrition_item_id"] = item.id
        nlp_fields["nutrition_item_name"] = item.name
        nlp_fields["item"] = item.name

        p = _latest_purchase(session, int(item.id), at)
        if p and qty is not None and unit:
            unit_price = _convert_unit_price(item, p, str(unit))
            if unit_price is not None:
                total = float(qty) * float(unit_price)
                payload["unit_price_brl"] = round(float(unit_price), 6)
                payload["value_brl"] = round(total, 2)

                nlp_fields["unit_price_brl"] = payload["unit_price_brl"]
                nlp_fields["value_brl"] = payload["value_brl"]

                # remove flags de missing se existirem
                missing = [m for m in missing if m not in ("unit_price_brl", "value_brl")]

                nlp["fields"] = nlp_fields
                nlp["missing_fields"] = missing
                payload["nlp"] = nlp
                return

        # Se item existe mas não achou preço
        if "unit_price_brl" not in missing:
            missing.append("unit_price_brl")
    else:
        if "nutrition_item" not in missing:
            missing.append("nutrition_item")

    nlp["fields"] = nlp_fields
    nlp["missing_fields"] = missing
    payload["nlp"] = nlp


# --------------------------------
# Helpers: áudio WhatsApp -> transcrição
# --------------------------------

def _is_enabled(env_name: str, default: bool = True) -> bool:
    raw = (os.getenv(env_name) or "").strip().lower()
    if not raw:
        return default
    return raw not in ("0", "false", "no", "off")


def _wa_graph_get(path: str) -> Dict[str, Any]:
    token = (os.getenv("WA_ACCESS_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("WA_ACCESS_TOKEN não configurado")

    url = f"https://graph.facebook.com/v18.0/{str(path or '').lstrip('/')}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        raise RuntimeError(f"Falha ao consultar mídia no Graph API: {e}")

    try:
        return json.loads(raw)
    except Exception:
        raise RuntimeError("Graph API retornou JSON inválido para mídia")


def _wa_download_media_bytes(url: str) -> Tuple[bytes, str]:
    token = (os.getenv("WA_ACCESS_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("WA_ACCESS_TOKEN não configurado")
    if not url:
        raise RuntimeError("URL da mídia ausente")

    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            data = resp.read()
            ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            return data, ctype
    except Exception as e:
        raise RuntimeError(f"Falha ao baixar mídia do WhatsApp: {e}")


def _guess_audio_ext(mime_type: str) -> str:
    mt = (mime_type or "").lower()
    if "ogg" in mt:
        return "ogg"
    if "mpeg" in mt or "mp3" in mt:
        return "mp3"
    if "wav" in mt:
        return "wav"
    if "mp4" in mt or "m4a" in mt:
        return "m4a"
    if "webm" in mt:
        return "webm"
    return "bin"


def _multipart_form_data(
    fields: Dict[str, str],
    *,
    file_field: str,
    filename: str,
    file_bytes: bytes,
    file_content_type: str,
) -> Tuple[bytes, str]:
    boundary = f"----fazenda-{uuid.uuid4().hex}"
    chunks: List[bytes] = []

    for k, v in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(v).encode("utf-8"))
        chunks.append(b"\r\n")

    safe_name = (filename or "audio.bin").replace('"', "")
    chunks.append(f"--{boundary}\r\n".encode("utf-8"))
    chunks.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{safe_name}"\r\n'.encode("utf-8")
    )
    chunks.append(f"Content-Type: {file_content_type or 'application/octet-stream'}\r\n\r\n".encode("utf-8"))
    chunks.append(file_bytes or b"")
    chunks.append(b"\r\n")

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), boundary


def _openai_transcribe_audio(
    *,
    audio_bytes: bytes,
    mime_type: str,
    filename: str,
) -> Dict[str, Any]:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY não configurado")

    model = (os.getenv("OPENAI_AUDIO_MODEL") or "gpt-4o-mini-transcribe").strip()
    language = (os.getenv("OPENAI_AUDIO_LANGUAGE") or "pt").strip()
    prompt = (
        os.getenv("OPENAI_AUDIO_PROMPT")
        or "Transcreva em português do Brasil. Contexto: operação de fazenda (gado, lote, manga, ração, sal mineral)."
    ).strip()
    base = (os.getenv("OPENAI_API_BASE") or "https://api.openai.com/v1").rstrip("/")
    url = f"{base}/audio/transcriptions"

    body, boundary = _multipart_form_data(
        {
            "model": model,
            "language": language,
            "prompt": prompt,
        },
        file_field="file",
        filename=filename,
        file_bytes=audio_bytes,
        file_content_type=mime_type or "application/octet-stream",
    )

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        raise RuntimeError(f"Falha na transcrição OpenAI: {e}")

    transcript = ""
    try:
        data = json.loads(raw)
        transcript = (
            (data.get("text") if isinstance(data, dict) else None)
            or (data.get("transcript") if isinstance(data, dict) else None)
            or ""
        )
    except Exception:
        transcript = str(raw or "").strip()
        data = {"raw": raw}

    transcript = str(transcript or "").strip()
    if not transcript:
        raise RuntimeError("A transcrição retornou vazia")

    return {
        "provider": "openai",
        "model": model,
        "text": transcript,
        "raw": data,
    }


def _transcribe_whatsapp_audio(media_id: str) -> Dict[str, Any]:
    mid = str(media_id or "").strip()
    if not mid:
        raise RuntimeError("media_id ausente")

    meta = _wa_graph_get(mid)
    media_url = str(meta.get("url") or "").strip()
    mime_type = str(meta.get("mime_type") or "").strip().lower()
    if not media_url:
        raise RuntimeError("Graph API não retornou URL da mídia")

    audio_bytes, downloaded_content_type = _wa_download_media_bytes(media_url)
    if downloaded_content_type and downloaded_content_type != "application/octet-stream":
        mime_type = downloaded_content_type
    mime_type = (mime_type or "audio/ogg").lower()

    max_mb = float((os.getenv("WA_AUDIO_MAX_MB") or "20").strip() or "20")
    if len(audio_bytes) > int(max_mb * 1024 * 1024):
        raise RuntimeError(f"Áudio excede limite de {max_mb:.0f} MB")

    ext = _guess_audio_ext(mime_type)
    filename = f"wa-{mid[:16]}.{ext}"
    tx = _openai_transcribe_audio(audio_bytes=audio_bytes, mime_type=mime_type, filename=filename)
    return {
        **tx,
        "mime_type": mime_type,
        "file_size": len(audio_bytes),
    }


# --------------------------------
# Helpers: WhatsApp Cloud extraction
# --------------------------------

def _extract_cloud_messages(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extrai mensagens do payload do WhatsApp Cloud API (Meta).
    Retorna lista de dicts com: from, name, type, text, timestamp, wa_message_id, media_id
    """
    out: List[Dict[str, Any]] = []
    try:
        entries = payload.get("entry") or []
        for e in entries:
            changes = e.get("changes") or []
            for ch in changes:
                val = (ch.get("value") or {})
                contacts = val.get("contacts") or []
                contact_name = None
                wa_id = None
                if contacts:
                    wa_id = contacts[0].get("wa_id")
                    contact_name = (contacts[0].get("profile") or {}).get("name")
                messages = val.get("messages") or []
                for m in messages:
                    mtype = m.get("type")
                    frm = m.get("from") or wa_id
                    ts = m.get("timestamp")
                    mid = m.get("id")
                    text = None
                    media_id = None
                    if mtype == "text":
                        text = ((m.get("text") or {}).get("body") or "").strip()
                    elif mtype in ("audio", "image", "document", "video"):
                        media_id = (m.get(mtype) or {}).get("id")
                    out.append({
                        "from": frm,
                        "name": contact_name,
                        "type": mtype,
                        "text": text,
                        "timestamp": ts,
                        "wa_message_id": mid,
                        "media_id": media_id,
                    })
    except Exception:
        return []
    return out


def _coerce_occurred_at(ts: Optional[str]) -> datetime:
    # Cloud API timestamp é unix (segundos) string
    if not ts:
        return datetime.utcnow()
    try:
        sec = int(ts)
        return datetime.utcfromtimestamp(sec)
    except Exception:
        return datetime.utcnow()


def _create_event_from_text(
    session: Session,
    text: str,
    *,
    source: str = "whatsapp",
    contact_phone: Optional[str] = None,
    contact_name: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
    meta: Optional[Dict[str, Any]] = None,
    raw_payload: Optional[Dict[str, Any]] = None,
    target_event: Optional[Event] = None,
) -> Event:
    nlp = _parse_intent(text)
    intent = nlp.get("intent") or "unknown"
    fields = nlp.get("fields") or {}

    ev_type = "whatsapp_raw"
    payload: Dict[str, Any] = {
        "nlp": nlp,
        "meta": {
            "contact_phone": contact_phone,
            "contact_name": contact_name,
            **(meta or {}),
        },
    }
    if raw_payload is not None:
        payload["raw"] = raw_payload

    # Mapeia intenção -> type + payload
    if intent == "cost":
        ev_type = "cost"
        payload.update(fields)
        # Se for Nutrição, tenta puxar preço automaticamente do catálogo de compras
        _enrich_nutrition_cost(session, text, occurred_at or datetime.utcnow(), payload)
    elif intent == "exit":
        ev_type = "exit"
        payload.update(fields)
    elif intent == "transfer":
        ev_type = "transfer"
        payload.update(fields)
    elif intent == "occurrence":
        ev_type = "occurrence"
        payload.update(fields)
    else:
        ev_type = "whatsapp_raw"
        payload.update({"raw_kind": "unknown"})

    auto_applied = False
    auto_error = None
    status = "pending"

    if _can_auto_approve(ev_type, nlp, payload):
        status = "approved"

    if target_event is None:
        ev = Event(
            source=source,
            status=status,
            type=ev_type,
            occurred_at=occurred_at or datetime.utcnow(),
            raw_text=text,
            payload=payload,
        )
        session.add(ev)
    else:
        ev = target_event
        ev.source = source
        ev.status = status
        ev.type = ev_type
        ev.occurred_at = occurred_at or ev.occurred_at or datetime.utcnow()
        ev.raw_text = text
        ev.payload = payload

    if status == "approved" and ev_type == "transfer":
        try:
            _apply_transfer(session, ev)
            auto_applied = True
        except Exception as e:  # fallback seguro: não derruba ingest
            auto_error = str(e)
            ev.status = "pending"

    # marca metadados de automação
    if isinstance(ev.payload, dict):
        meta_obj = ev.payload.get("meta") if isinstance(ev.payload.get("meta"), dict) else {}
        meta_obj = dict(meta_obj or {})
        meta_obj["auto_approved"] = bool(ev.status == "approved")
        meta_obj["auto_applied"] = bool(auto_applied)
        if auto_error:
            meta_obj["auto_error"] = auto_error
        ev.payload["meta"] = meta_obj

    session.commit()
    session.refresh(ev)
    return ev


# -----------------------------
# Public endpoints
# -----------------------------

@router.get("/webhook")
def verify_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
):
    # Meta WhatsApp Cloud API verification handshake
    if not WA_VERIFY_TOKEN:
        raise HTTPException(status_code=500, detail="WA_VERIFY_TOKEN not configured")
    if hub_mode == "subscribe" and hub_verify_token == WA_VERIFY_TOKEN:
        return int(hub_challenge or 0)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request, session: Session = Depends(get_session)):
    """
    Recebe payload do WhatsApp Cloud API.
    - Se houver mensagem de texto, cria Event pendente já interpretado (cost/transfer/exit/occurrence).
    - Se não conseguir extrair texto (ex: áudio), salva como whatsapp_raw com payload completo.
    """
    body: Dict[str, Any] = await request.json()

    msgs = _extract_cloud_messages(body)
    if not msgs:
        # fallback: armazena bruto
        ev = Event(
            source="whatsapp",
            status="pending",
            type="whatsapp_raw",
            raw_text=None,
            payload={"raw": body, "nlp": {"intent": "unknown", "confidence": 0.0, "fields": {}, "missing_fields": ["text"], "ambiguities": []}},
        )
        session.add(ev)
        session.commit()
        session.refresh(ev)
        return {"ok": True, "mode": "raw", "event_id": ev.id}

    created_ids: List[int] = []
    for m in msgs:
        mtype = m.get("type")
        occurred = _coerce_occurred_at(m.get("timestamp"))
        frm = m.get("from")
        name = m.get("name")
        if mtype == "text" and (m.get("text") or "").strip():
            ev = _create_event_from_text(
                session,
                m["text"],
                contact_phone=frm,
                contact_name=name,
                occurred_at=occurred,
                meta={"wa_message_id": m.get("wa_message_id")},
            )
            created_ids.append(ev.id)
        elif mtype == "audio":
            transcript = None
            tx_meta: Dict[str, Any] = {}
            if _is_enabled("WA_AUDIO_AUTO_TRANSCRIBE", default=True):
                try:
                    tx = _transcribe_whatsapp_audio(str(m.get("media_id") or ""))
                    transcript = str(tx.get("text") or "").strip()
                    tx_meta = {
                        "audio_transcribed": True,
                        "transcript_provider": tx.get("provider"),
                        "transcript_model": tx.get("model"),
                        "audio_mime_type": tx.get("mime_type"),
                        "audio_bytes": tx.get("file_size"),
                    }
                except Exception as e:
                    tx_meta = {
                        "audio_transcribed": False,
                        "transcription_error": str(e),
                    }
            else:
                tx_meta = {
                    "audio_transcribed": False,
                    "transcription_error": "auto_transcribe_disabled",
                }

            if transcript:
                ev = _create_event_from_text(
                    session,
                    transcript,
                    contact_phone=frm,
                    contact_name=name,
                    occurred_at=occurred,
                    meta={
                        "wa_message_id": m.get("wa_message_id"),
                        "media_type": mtype,
                        "media_id": m.get("media_id"),
                        "from_audio": True,
                        **tx_meta,
                    },
                )
                created_ids.append(ev.id)
                continue

            ev = Event(
                source="whatsapp",
                status="pending",
                type="whatsapp_raw",
                occurred_at=occurred,
                raw_text=None,
                payload={
                    "raw": body,
                    "meta": {
                        "contact_phone": frm,
                        "contact_name": name,
                        "wa_message_id": m.get("wa_message_id"),
                        "media_type": mtype,
                        "media_id": m.get("media_id"),
                        **tx_meta,
                    },
                    "nlp": {"intent": "unknown", "confidence": 0.0, "fields": {}, "missing_fields": ["transcript_or_text"], "ambiguities": []},
                },
            )
            session.add(ev)
            session.commit()
            session.refresh(ev)
            created_ids.append(ev.id)
        else:
            # áudio/mídia: salva bruto (pendente) para alguém transcrever
            ev = Event(
                source="whatsapp",
                status="pending",
                type="whatsapp_raw",
                occurred_at=occurred,
                raw_text=None,
                payload={
                    "raw": body,
                    "meta": {
                        "contact_phone": frm,
                        "contact_name": name,
                        "wa_message_id": m.get("wa_message_id"),
                        "media_type": mtype,
                        "media_id": m.get("media_id"),
                    },
                    "nlp": {"intent": "unknown", "confidence": 0.0, "fields": {}, "missing_fields": ["transcript_or_text"], "ambiguities": []},
                },
            )
            session.add(ev)
            session.commit()
            session.refresh(ev)
            created_ids.append(ev.id)

    return {"ok": True, "mode": "cloud", "event_ids": created_ids}


@router.post("/transcribe/{event_id}")
def transcribe_audio_event(
    event_id: int,
    payload_in: Optional[Dict[str, Any]] = None,
    session: Session = Depends(get_session),
):
    """
    Transcreve um evento WhatsApp de áudio (whatsapp_raw) e reaplica o parser no mesmo registro.
    Útil para reprocessar quando a transcrição automática falhou/desativada.
    """
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.source != "whatsapp":
        raise HTTPException(status_code=400, detail="Only WhatsApp events are supported")
    if ev.type != "whatsapp_raw":
        raise HTTPException(status_code=400, detail="Event already interpreted")

    payload = ev.payload if isinstance(ev.payload, dict) else {}
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}

    manual_text = str((payload_in or {}).get("text") or "").strip()
    if manual_text:
        next_meta = {
            "wa_message_id": meta.get("wa_message_id"),
            "media_type": meta.get("media_type"),
            "media_id": meta.get("media_id"),
            "from_audio": True,
            "audio_transcribed": True,
            "transcript_provider": "manual",
            "transcript_model": "manual_input",
            "manual_transcript": True,
        }
        updated = _create_event_from_text(
            session,
            manual_text,
            source="whatsapp",
            contact_phone=meta.get("contact_phone"),
            contact_name=meta.get("contact_name"),
            occurred_at=ev.occurred_at,
            meta=next_meta,
            raw_payload=payload.get("raw") if isinstance(payload, dict) else None,
            target_event=ev,
        )
        return {
            "ok": True,
            "mode": "manual_text",
            "event_id": updated.id,
            "type": updated.type,
            "status": updated.status,
            "transcript": updated.raw_text,
        }

    media_type = str(meta.get("media_type") or "").strip().lower()
    media_id = str(meta.get("media_id") or "").strip()
    if media_type != "audio" or not media_id:
        raise HTTPException(status_code=400, detail="Event is not an audio message with media_id")

    try:
        tx = _transcribe_whatsapp_audio(media_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

    transcript = str(tx.get("text") or "").strip()
    if not transcript:
        raise HTTPException(status_code=502, detail="Transcription returned empty text")

    next_meta = {
        "wa_message_id": meta.get("wa_message_id"),
        "media_type": media_type,
        "media_id": media_id,
        "from_audio": True,
        "audio_transcribed": True,
        "transcript_provider": tx.get("provider"),
        "transcript_model": tx.get("model"),
        "audio_mime_type": tx.get("mime_type"),
        "audio_bytes": tx.get("file_size"),
    }

    updated = _create_event_from_text(
        session,
        transcript,
        source="whatsapp",
        contact_phone=meta.get("contact_phone"),
        contact_name=meta.get("contact_name"),
        occurred_at=ev.occurred_at,
        meta=next_meta,
        raw_payload=payload.get("raw") if isinstance(payload, dict) else None,
        target_event=ev,
    )

    return {
        "ok": True,
        "mode": "auto_audio",
        "event_id": updated.id,
        "type": updated.type,
        "status": updated.status,
        "transcript": updated.raw_text,
    }


@router.post("/parse")
async def parse_text(payload: Dict[str, Any]):
    """
    Parse-only (não salva).
    Body: { "text": "..." }
    """
    text = (payload or {}).get("text") or ""
    if not str(text).strip():
        raise HTTPException(status_code=400, detail="text is required")
    return _parse_intent(str(text))


@router.post("/ingest")
async def ingest_text(payload: Dict[str, Any], session: Session = Depends(get_session)):
    """
    Ingest simples para teste/integração.
    Body:
      { "text": "...", "contact_phone": "...", "contact_name": "...", "occurred_at": "ISO optional" }
    """
    text = (payload or {}).get("text") or ""
    if not str(text).strip():
        raise HTTPException(status_code=400, detail="text is required")

    contact_phone = (payload or {}).get("contact_phone")
    contact_name = (payload or {}).get("contact_name")

    occurred_at = None
    if (payload or {}).get("occurred_at"):
        try:
            occurred_at = datetime.fromisoformat((payload or {})["occurred_at"])
        except Exception:
            occurred_at = None

    ev = _create_event_from_text(
        session,
        str(text),
        contact_phone=str(contact_phone) if contact_phone else None,
        contact_name=str(contact_name) if contact_name else None,
        occurred_at=occurred_at,
        meta={"channel": "ingest"},
    )
    return {"ok": True, "event": ev}


@router.post("/simulate")
async def simulate(payload: Dict[str, Any], session: Session = Depends(get_session)):
    """
    Atalho para desenvolvimento local.
    Body: { "text": "...", "who": "Vaqueiro" }
    """
    text = (payload or {}).get("text") or ""
    who = (payload or {}).get("who") or "WhatsApp"
    if not str(text).strip():
        raise HTTPException(status_code=400, detail="text is required")
    ev = _create_event_from_text(
        session,
        str(text),
        contact_name=str(who),
        contact_phone="simulado",
        meta={"channel": "simulate"},
    )
    return {"ok": True, "event_id": ev.id, "type": ev.type}


@router.get("/templates")
def whatsapp_templates():
    """
    Frases curtas para o vaqueiro copiar no dia a dia.
    Útil para treinamento e padronização da operação via WhatsApp.
    """
    return _VAQUEIRO_TEMPLATES


def _wa_env_status() -> Dict[str, bool]:
    has_verify_token = bool(WA_VERIFY_TOKEN)
    has_access_token = bool((os.getenv("WA_ACCESS_TOKEN") or "").strip())
    has_phone_number_id = bool((os.getenv("WA_PHONE_NUMBER_ID") or "").strip())
    return {
        "has_verify_token": has_verify_token,
        "has_access_token": has_access_token,
        "has_phone_number_id": has_phone_number_id,
        "webhook_ready": has_verify_token,
        "send_enabled": has_access_token and has_phone_number_id,
    }


@router.get("/status")
def whatsapp_status():
    """
    Retorna estado da integração sem expor segredos.
    """
    st = _wa_env_status()
    return {
        **st,
        "audio_auto_transcribe": _is_enabled("WA_AUDIO_AUTO_TRANSCRIBE", default=True),
    }

# --------------------------------
# Follow-up: perguntas e envio (opcional)
# --------------------------------

def _questions_for_event(ev: Event) -> List[str]:
    p = ev.payload or {}
    nlp = (p.get("nlp") or {}) if isinstance(p, dict) else {}
    missing = nlp.get("missing_fields") or []
    ambiguities = nlp.get("ambiguities") or []
    intent = nlp.get("intent") or ev.type or "unknown"

    qs: List[str] = []

    for a in ambiguities:
        if a == "transfer_missing_origin_or_destination":
            qs.append("De onde e para onde foi a transferência? (ex: do lote 10 para o lote 15)")
        else:
            qs.append(f"Preciso confirmar: {a}")

    for m in missing:
        if m == "qty":
            qs.append("Qual foi a quantidade?")
        elif m == "unit":
            qs.append("Qual unidade? (saco, kg, etc.)")
        elif m == "area_or_lot":
            qs.append("Em qual manga ou lote foi?")
        elif m == "value_brl":
            qs.append("Qual foi o valor (R$)?")
        elif m == "arrobas":
            qs.append("Quantas arrobas (@) foram vendidas/abatidas?")
        elif m == "qty_heads_or_ear_tags":
            qs.append("Quantas cabeças foram transferidas? (ou envie os brincos/IDs: ex: brincos 30, 31, A12)")
        elif m == "transcript_or_text":
            qs.append("Pode mandar o texto do áudio (ou escrever de novo em uma frase)?")

    if intent == "cost" and "value_brl" in missing:
        qs.append("Esse valor é o total ou foi por unidade (por saco/kg)?")

    # de-dup
    uniq: List[str] = []
    seen = set()
    for q in qs:
        k = (q or "").strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        uniq.append(q)

    return uniq[:5]


@router.get("/questions/{event_id}")
def whatsapp_questions(event_id: int, session: Session = Depends(get_session)):
    """
    Gera perguntas (follow-up) para um evento pendente/ambíguo.
    Útil para o operador copiar e colar no WhatsApp (ou usar /send).
    """
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    p = ev.payload or {}
    meta = (p.get("meta") or {}) if isinstance(p, dict) else {}
    contact_name = meta.get("contact_name")
    contact_phone = meta.get("contact_phone")

    qs = _questions_for_event(ev)
    if not qs:
        msg = "Tudo certo por aqui — sem pendências."
    else:
        who = (contact_name or "Oi").strip()
        prefix = f"{who}, só para confirmar rapidinho:"
        msg = prefix + "\n- " + "\n- ".join(qs) + "\n\nResponda aqui mesmo."

    return {
        "event_id": ev.id,
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "questions": qs,
        "recommended_message": msg,
    }


def _wa_send_text(to: str, message: str, *, phone_number_id: Optional[str] = None) -> Dict[str, Any]:
    clean_to = re.sub(r"\D+", "", str(to or ""))
    if not clean_to:
        raise HTTPException(status_code=400, detail="invalid destination phone")

    token = os.getenv("WA_ACCESS_TOKEN") or ""
    pid = phone_number_id or (os.getenv("WA_PHONE_NUMBER_ID") or "")
    if not token or not pid:
        raise HTTPException(status_code=500, detail="WA_ACCESS_TOKEN/WA_PHONE_NUMBER_ID not configured")

    url = f"https://graph.facebook.com/v18.0/{pid}/messages"
    body = {
        "messaging_product": "whatsapp",
        "to": clean_to,
        "type": "text",
        "text": {"body": message},
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {"ok": True, "raw": raw}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send WhatsApp message: {e}")


@router.post("/send")
def whatsapp_send(payload: Dict[str, Any]):
    """
    Envio opcional via WhatsApp Cloud API (Meta).
    Requer env:
      - WA_ACCESS_TOKEN
      - WA_PHONE_NUMBER_ID
    Body:
      { "to": "55DDDNUMERO", "message": "..." }
    """
    to = (payload or {}).get("to")
    message = (payload or {}).get("message")
    if not to or not str(to).strip():
        raise HTTPException(status_code=400, detail="to is required")
    if not message or not str(message).strip():
        raise HTTPException(status_code=400, detail="message is required")

    return _wa_send_text(str(to).strip(), str(message).strip())


@router.post("/send-for-event/{event_id}")
def whatsapp_send_for_event(event_id: int, payload: Dict[str, Any], session: Session = Depends(get_session)):
    """
    Envia a mensagem sugerida de follow-up para o contato do evento.
    - Se o body trouxer 'message', usa ela.
    - Caso contrário, usa o recommended_message do /questions/{event_id}.
    """
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    p = ev.payload or {}
    meta = (p.get("meta") or {}) if isinstance(p, dict) else {}
    to = (meta.get("contact_phone") or "").strip()
    if not to:
        raise HTTPException(status_code=400, detail="event has no contact_phone in payload.meta")

    msg = (payload or {}).get("message")
    if not msg:
        qs = _questions_for_event(ev)
        if not qs:
            raise HTTPException(status_code=400, detail="no pending questions for this event")
        name = (meta.get("contact_name") or "Oi").strip()
        msg = f"{name}, só para confirmar rapidinho:\n- " + "\n- ".join(qs) + "\n\nResponda aqui mesmo."

    return _wa_send_text(to, str(msg).strip())
