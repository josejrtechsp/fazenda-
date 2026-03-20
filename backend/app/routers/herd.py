from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.herd import HerdLot, HerdAnimal, HerdAnimalProfile, HerdWeighing
from app.models.event import Event

router = APIRouter(prefix="/herd", tags=["herd"])


@router.get("/ping")
def ping() -> Dict[str, Any]:
    return {"ok": True, "module": "herd"}


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def _to_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _parse_month_window(month: Optional[str]) -> Dict[str, Any]:
    now = datetime.utcnow()
    y = now.year
    m = now.month

    raw = str(month or "").strip()
    if raw:
        hit = re.match(r"^(\d{4})-(\d{2})$", raw)
        if hit:
            y = int(hit.group(1))
            m = int(hit.group(2))
            if m < 1 or m > 12:
                y = now.year
                m = now.month

    start = datetime(y, m, 1)
    if m == 12:
        end = datetime(y + 1, 1, 1)
    else:
        end = datetime(y, m + 1, 1)
    return {
        "key": f"{y:04d}-{m:02d}",
        "start": start,
        "end": end,
    }


def _is_investment_cost(payload: Dict[str, Any]) -> bool:
    p = payload or {}
    kind = _norm_text(p.get("cost_kind") or p.get("kind") or "")
    if kind in {"investment", "investimento", "capex", "asset", "imobilizado"}:
        return True

    blob = _norm_text(
        " ".join(
            [
                str(p.get("group") or ""),
                str(p.get("simple_group") or ""),
                str(p.get("category") or ""),
                str(p.get("notes") or ""),
            ]
        )
    )
    return any(
        t in blob
        for t in [
            "investimento",
            "capex",
            "imobilizado",
            "bens imobilizados",
            "material de construcao",
            "construcao",
        ]
    )


def _cost_bucket(payload: Dict[str, Any]) -> str:
    p = payload or {}
    txt = _norm_text(
        " ".join(
            [
                str(p.get("group") or ""),
                str(p.get("simple_group") or ""),
                str(p.get("category") or ""),
                str(p.get("notes") or ""),
            ]
        )
    )
    if any(t in txt for t in ["nutricao", "racao", "silagem", "feno", "capim", "sal mineral", "sal proteinado", "trato"]):
        return "nutrition"
    if any(t in txt for t in ["animal", "bovino", "gado", "boi", "vaca", "novilha", "bezerro", "bezerra", "rebanho", "compra de animais", "aquisicao de animais"]):
        return "animals"
    return "purchase"


def _cost_value_brl(payload: Dict[str, Any]) -> float:
    p = payload or {}
    return _to_float(
        p.get("value_brl")
        or p.get("total_brl")
        or p.get("valor_brl")
        or p.get("valor")
        or p.get("value")
    )


def _extract_lot_id_from_payload(payload: Dict[str, Any], valid_lot_ids: set[int], lot_name_to_id: Dict[str, int]) -> Optional[int]:
    p = payload or {}

    def _coerce_id(v: Any) -> Optional[int]:
        if isinstance(v, bool) or v is None:
            return None
        try:
            n = int(str(v).strip())
            return n if n in valid_lot_ids else None
        except Exception:
            pass
        s = _norm_text(v)
        if not s:
            return None
        if s in lot_name_to_id:
            lid = lot_name_to_id[s]
            if lid in valid_lot_ids:
                return lid
        m = re.search(r"\b(?:lote|lot|l)\s*#?\s*(\d{1,6})\b", s)
        if m:
            n = int(m.group(1))
            return n if n in valid_lot_ids else None
        m = re.search(r"\bmanga\s*#?\s*(\d{1,6})\b", s)
        if m:
            n = int(m.group(1))
            return n if n in valid_lot_ids else None
        return None

    candidates = [
        p.get("lot_id"),
        p.get("lote_id"),
        p.get("lot"),
        p.get("lote"),
        p.get("lot_name"),
        p.get("center_cost"),
        p.get("cost_center"),
        p.get("center"),
        p.get("farm"),
        p.get("unit"),
        p.get("notes"),
        p.get("description"),
    ]
    for c in candidates:
        lid = _coerce_id(c)
        if lid is not None:
            return lid
    return None


@router.get("/lots")
def list_lots(
    session: Session = Depends(get_session),
    month: Optional[str] = Query(default=None, description="Período de custo no formato YYYY-MM (padrão: mês atual)"),
    include_investment: bool = Query(default=False, description="Incluir lançamentos de investimento/capex"),
) -> Dict[str, Any]:
    stmt = select(HerdLot).order_by(HerdLot.id)
    lots = session.exec(stmt).all()

    lot_ids: set[int] = {int(l.id) for l in lots if l.id is not None}
    lot_name_to_id: Dict[str, int] = {}
    for l in lots:
        if l.id is None:
            continue
        name_norm = _norm_text(l.name)
        if name_norm:
            lot_name_to_id[name_norm] = int(l.id)
        default_label = _norm_text(f"Lote {int(l.id)}")
        lot_name_to_id.setdefault(default_label, int(l.id))

    # animais ativos por lote (base para "heads" e rateio de custo sem lote explícito)
    active_animals = session.exec(select(HerdAnimal).where(HerdAnimal.status == "active")).all()
    heads_by_lot: Dict[int, int] = defaultdict(int)
    started_at_by_lot: Dict[int, datetime] = {}
    for a in active_animals:
        if a.lot_id is None:
            continue
        lid = int(a.lot_id)
        if lid not in lot_ids:
            continue
        heads_by_lot[lid] += 1
        created = a.created_at or datetime.utcnow()
        prev_dt = started_at_by_lot.get(lid)
        if prev_dt is None or created < prev_dt:
            started_at_by_lot[lid] = created

    # custos aprovados no período
    win = _parse_month_window(month)
    cost_stmt = (
        select(Event)
        .where(Event.type == "cost")
        .where(Event.status == "approved")
        .where(Event.occurred_at >= win["start"])
        .where(Event.occurred_at < win["end"])
        .order_by(Event.occurred_at.asc())
    )
    cost_events = session.exec(cost_stmt).all()

    costs_by_lot: Dict[int, Dict[str, float]] = {
        lid: {"animals": 0.0, "purchase": 0.0, "nutrition": 0.0} for lid in lot_ids
    }
    unallocated_costs = {"animals": 0.0, "purchase": 0.0, "nutrition": 0.0}

    lots_for_share = [lid for lid in lot_ids]
    heads_total = sum(max(0, int(heads_by_lot.get(lid, 0))) for lid in lots_for_share)

    for ev in cost_events:
        payload = ev.payload if isinstance(ev.payload, dict) else {}
        if not include_investment and _is_investment_cost(payload):
            continue

        value = _cost_value_brl(payload)
        if value <= 0:
            continue

        bucket = _cost_bucket(payload)
        lot_id = _extract_lot_id_from_payload(payload, lot_ids, lot_name_to_id)

        if lot_id is not None and lot_id in costs_by_lot:
            costs_by_lot[lot_id][bucket] += value
            continue

        # fallback: custo sem lote explícito -> rateia por cabeças ativas do período
        if not lots_for_share:
            unallocated_costs[bucket] += value
            continue

        if heads_total > 0:
            for lid in lots_for_share:
                h = max(0, int(heads_by_lot.get(lid, 0)))
                if h <= 0:
                    continue
                costs_by_lot[lid][bucket] += value * (h / heads_total)
        else:
            share = value / float(len(lots_for_share))
            for lid in lots_for_share:
                costs_by_lot[lid][bucket] += share
        unallocated_costs[bucket] += value

    return {
        "lots": [
            {
                "id": l.id,
                "label": f"Lote {l.id}" if l.id is not None else l.name,
                "name": l.name,
                "category": l.category,
                "area_name": l.area_name,
                "heads": int(heads_by_lot.get(int(l.id), l.heads or 0)) if l.id is not None else int(l.heads or 0),
                "started_at": (
                    started_at_by_lot.get(int(l.id), l.created_at).isoformat()
                    if l.id is not None and started_at_by_lot.get(int(l.id), l.created_at)
                    else None
                ),
                "cost_animals_brl": round(costs_by_lot.get(int(l.id), {}).get("animals", 0.0), 2) if l.id is not None else 0.0,
                "cost_purchase_brl": round(costs_by_lot.get(int(l.id), {}).get("purchase", 0.0), 2) if l.id is not None else 0.0,
                "cost_nutrition_brl": round(costs_by_lot.get(int(l.id), {}).get("nutrition", 0.0), 2) if l.id is not None else 0.0,
            }
            for l in lots
        ],
        "costs": {
            "month": win["key"],
            "start": win["start"].isoformat(),
            "end": win["end"].isoformat(),
            "include_investment": bool(include_investment),
            "unallocated_brl": {
                "animals": round(unallocated_costs["animals"], 2),
                "purchase": round(unallocated_costs["purchase"], 2),
                "nutrition": round(unallocated_costs["nutrition"], 2),
            },
        },
    }


def _last_weighing_map(session: Session, ear_tags: List[str]) -> Dict[str, HerdWeighing]:
    if not ear_tags:
        return {}
    stmt = (
        select(HerdWeighing)
        .where(HerdWeighing.animal_ear_tag.in_(ear_tags))
        .order_by(HerdWeighing.weighed_at.desc())
    )
    rows = session.exec(stmt).all()
    out: Dict[str, HerdWeighing] = {}
    for w in rows:
        if w.animal_ear_tag not in out:
            out[w.animal_ear_tag] = w
    return out


def _last_weighings_map(session: Session, ear_tags: List[str], max_per_animal: int = 8) -> Dict[str, List[HerdWeighing]]:
    """Retorna, para cada brinco, as últimas pesagens (desc), até `max_per_animal`.
    Mantemos mais que 2 para conseguir ignorar pesagens duplicadas/no mesmo dia na hora de calcular GMD.
    """
    if not ear_tags:
        return {}
    stmt = (
        select(HerdWeighing)
        .where(HerdWeighing.animal_ear_tag.in_(ear_tags))
        .order_by(HerdWeighing.weighed_at.desc())
    )
    rows = session.exec(stmt).all()
    out: Dict[str, List[HerdWeighing]] = {}
    for w in rows:
        arr = out.get(w.animal_ear_tag)
        if arr is None:
            out[w.animal_ear_tag] = [w]
        elif len(arr) < max_per_animal:
            arr.append(w)
    return out

def _compute_gmd_from_desc(ws_desc: List[HerdWeighing], min_days: float = 1.0) -> Optional[float]:
    """Calcula GMD a partir de uma lista DESC (mais recente primeiro).
    Procura o último par válido (diferença de datas >= min_days).
    """
    if not ws_desc or len(ws_desc) < 2:
        return None
    for i in range(len(ws_desc) - 1):
        lw = ws_desc[i]
        pw = ws_desc[i + 1]
        if not (lw.weighed_at and pw.weighed_at):
            continue
        d = (lw.weighed_at - pw.weighed_at).total_seconds() / 86400.0
        if d < min_days:
            # ignora pesagens no mesmo dia/intervalo muito curto
            continue
        try:
            return (float(lw.weight_kg) - float(pw.weight_kg)) / d
        except Exception:
            return None
    return None


def _serialize_profile(obj: Optional[HerdAnimalProfile]) -> Dict[str, Any]:
    if not obj:
        return {
            "birth": "",
            "preg_status": "ND",
            "preg_start": "",
            "vac_name": "",
            "vac_date": "",
            "vac_next": "",
            "note": "",
            "sheet": {},
            "updated_at": None,
        }

    sheet = obj.sheet_json if isinstance(obj.sheet_json, dict) else {}
    return {
        "birth": str(obj.birth_date or ""),
        "preg_status": str(obj.preg_status or "ND").upper() or "ND",
        "preg_start": str(obj.preg_start_date or ""),
        "vac_name": str(obj.last_vaccine_name or ""),
        "vac_date": str(obj.last_vaccine_date or ""),
        "vac_next": str(obj.next_vaccine_date or ""),
        "note": str(obj.note or ""),
        "sheet": sheet,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def _profiles_by_ear(session: Session, ear_tags: List[str]) -> Dict[str, HerdAnimalProfile]:
    keys = [str(x or "").strip().upper() for x in ear_tags if str(x or "").strip()]
    if not keys:
        return {}
    rows = list(session.exec(select(HerdAnimalProfile).where(HerdAnimalProfile.ear_tag.in_(keys))).all())
    return {str(r.ear_tag or "").strip().upper(): r for r in rows}


def _clean_iso_day(v: Any) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    raise HTTPException(status_code=422, detail="datas devem usar YYYY-MM-DD")


def _clean_preg_status(v: Any) -> str:
    s = str(v or "ND").strip().upper()
    if s in {"PRENHA", "VAZIA", "ND"}:
        return s
    raise HTTPException(status_code=422, detail="preg_status invalido. Use PRENHA, VAZIA ou ND")

def _compute_gmd_from_asc(ws_asc: List[HerdWeighing], min_days: float = 1.0) -> Optional[float]:
    """Calcula GMD a partir de uma lista ASC (mais antiga primeiro), usando o último trecho válido."""
    if not ws_asc or len(ws_asc) < 2:
        return None
    for i in range(len(ws_asc) - 1, 0, -1):
        last = ws_asc[i]
        prev = ws_asc[i - 1]
        if not (last.weighed_at and prev.weighed_at):
            continue
        d = (last.weighed_at - prev.weighed_at).total_seconds() / 86400.0
        if d < min_days:
            continue
        try:
            return (float(last.weight_kg) - float(prev.weight_kg)) / d
        except Exception:
            return None
    return None


def _animal_pending_card(
    animal: HerdAnimal,
    *,
    lot_map: Dict[int, HerdLot],
    last_weighing: Optional[HerdWeighing],
    profile: Optional[HerdAnimalProfile],
    now: datetime,
) -> Dict[str, Any]:
    lot = lot_map.get(int(animal.lot_id)) if animal.lot_id is not None else None
    lot_label = str((lot.name if lot else "") or "").strip()
    if not lot_label and animal.lot_id is not None:
        lot_label = f"Lote {int(animal.lot_id)}"

    last_weighed_at = last_weighing.weighed_at.isoformat() if (last_weighing and last_weighing.weighed_at) else None
    days_since = None
    if last_weighing and last_weighing.weighed_at:
        try:
            days_since = max(0, int((now - last_weighing.weighed_at).total_seconds() // 86400))
        except Exception:
            days_since = None

    profile_payload = _serialize_profile(profile)
    return {
        "ear": str(animal.ear_tag or "").strip().upper(),
        "sex": str(animal.sex or "").strip().upper(),
        "category": str(animal.category or "").strip().upper(),
        "lot_id": int(animal.lot_id) if animal.lot_id is not None else None,
        "lot_label": lot_label or "Sem lote",
        "area_name": str(animal.area_name or "").strip(),
        "last_weight_kg": float(last_weighing.weight_kg or 0.0) if last_weighing and last_weighing.weight_kg is not None else None,
        "last_weighed_at": last_weighed_at,
        "days_since_weigh": days_since,
        "preg_status": str(profile_payload.get("preg_status") or "ND").upper(),
        "vac_name": str(profile_payload.get("vac_name") or "").strip(),
        "vac_date": str(profile_payload.get("vac_date") or "").strip(),
        "vac_next": str(profile_payload.get("vac_next") or "").strip(),
    }



@router.get("/animals")
def list_animals(
    session: Session = Depends(get_session),
    lot_id: Optional[str] = Query(default=None, description="ID do lote (numérico) ou nome"),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default="active", description="active/sold/dead/all"),
    limit: int = Query(default=500, ge=1, le=2000),
) -> Dict[str, Any]:
    st = (status or "").strip().lower()
    stmt = select(HerdAnimal)
    if st and st not in ("all", "*"):
        stmt = stmt.where(HerdAnimal.status == st)

    # filtro por lote (aceita id numérico ou nome)
    if lot_id:
        raw = lot_id.strip()
        lot_pk: Optional[int] = None
        if raw.isdigit():
            lot_pk = int(raw)
        else:
            lot = session.exec(select(HerdLot).where(HerdLot.name == raw).limit(1)).first()
            if not lot:
                # tentativa case-insensitive
                try:
                    lot = session.exec(select(HerdLot).where(HerdLot.name.ilike(raw)).limit(1)).first()
                except Exception:
                    lot = None
            if lot and lot.id is not None:
                lot_pk = int(lot.id)
        if lot_pk is not None:
            stmt = stmt.where(HerdAnimal.lot_id == lot_pk)

    if search:
        s = search.strip()
        if s:
            stmt = stmt.where(HerdAnimal.ear_tag.like(f"%{s}%"))

    animals = session.exec(stmt.order_by(HerdAnimal.ear_tag).limit(limit)).all()

    # mapa lot_id -> nome
    lot_ids = sorted({a.lot_id for a in animals if a.lot_id is not None})
    lot_name: Dict[int, str] = {}
    if lot_ids:
        lots = session.exec(select(HerdLot).where(HerdLot.id.in_(lot_ids))).all()
        lot_name = {int(l.id): (l.name or f"Lote {l.id}") for l in lots if l.id is not None}

    tags = [a.ear_tag for a in animals]
    last_two = _last_weighings_map(session, tags)
    now = datetime.utcnow()

    profiles = _profiles_by_ear(session, tags)

    items: List[Dict[str, Any]] = []
    for a in animals:
        arr = last_two.get(a.ear_tag, [])
        lw = arr[0] if len(arr) >= 1 else None
        pw = arr[1] if len(arr) >= 2 else None
        days = None
        wkg = None
        last_iso = None
        gmd = None

        if lw and lw.weighed_at:
            dt = lw.weighed_at
            days = int((now - dt).total_seconds() // 86400)
            wkg = lw.weight_kg
            last_iso = dt.isoformat()

        gmd = _compute_gmd_from_desc(arr, min_days=1.0)

        gmd_label = None
        if gmd is not None:
            if gmd > 0.05:
                gmd_label = "pos"
            elif gmd < -0.05:
                gmd_label = "neg"
            else:
                gmd_label = "neutro"

        lid = int(a.lot_id) if a.lot_id is not None else None
        lot_label = lot_name.get(lid, f"Lote {lid}" if lid is not None else "")
        profile_payload = _serialize_profile(profiles.get(str(a.ear_tag or "").strip().upper()))

        items.append(
            {
                # chaves canônicas
                "ear_tag": a.ear_tag,
                "sex": a.sex,
                "category": a.category,
                "lot_id": lid,
                "area_name": a.area_name,
                "last_weight_kg": wkg,
                "last_weighed_at": last_iso,
                "days_since_weigh": days,
                "gmd_kg_day": gmd,
                "gmd_label": gmd_label,
                "status": a.status,
                # aliases de compat (front)
                "brinco": a.ear_tag,
                "ear": a.ear_tag,
                "categoria": a.category,
                "cat": a.category,
                "lote": lot_label,
                "lote_id": lid,
                "lot_label": lot_label,
                "dias": days,
                "gmd": gmd,
                "gmd_label": gmd_label,
                "data": last_iso,
                "ultimo_peso": wkg,
                # perfil canônico do cadastro geral
                "profile": profile_payload,
                "birth_date": profile_payload["birth"],
                "preg_status": profile_payload["preg_status"],
                "preg_start_date": profile_payload["preg_start"],
                "vac_name": profile_payload["vac_name"],
                "vac_date": profile_payload["vac_date"],
                "vac_next": profile_payload["vac_next"],
                "animal_note": profile_payload["note"],
                "sheet": profile_payload["sheet"],
            }
        )

    return {"animals": items, "count": len(items)}


@router.get("/animal/{ear_tag}")
def get_animal(
    ear_tag: str,
    session: Session = Depends(get_session),
    weigh_limit: int = Query(default=50, ge=1, le=500),
) -> Dict[str, Any]:
    a = session.get(HerdAnimal, ear_tag)
    if not a:
        raise HTTPException(status_code=404, detail="animal not found")

    lot = session.get(HerdLot, a.lot_id) if a.lot_id is not None else None
    profile = session.get(HerdAnimalProfile, ear_tag)

    w_stmt = (
        select(HerdWeighing)
        .where(HerdWeighing.animal_ear_tag == ear_tag)
        .order_by(HerdWeighing.weighed_at.asc())
        .limit(weigh_limit)
    )
    ws = session.exec(w_stmt).all()

    weighings = [
        {
            "id": w.id,
            "weighed_at": w.weighed_at.isoformat() if w.weighed_at else None,
            "weight_kg": w.weight_kg,
            "note": w.note,
        }
        for w in ws
    ]

    last = ws[-1] if ws else None
    last_weight = last.weight_kg if last else None
    last_date = last.weighed_at.isoformat() if (last and last.weighed_at) else None
    gmd = _compute_gmd_from_asc(ws, min_days=1.0)

    return {
        "animal": {
            "ear_tag": a.ear_tag,
            "status": a.status,
            "sex": a.sex,
            "category": a.category,
            "lot_id": a.lot_id,
            "area_name": a.area_name,
            "profile": _serialize_profile(profile),
        },
        "lot": (
            {
                "id": lot.id,
                "name": lot.name,
                "category": lot.category,
                "area_name": lot.area_name,
                "heads": lot.heads,
            }
            if lot
            else None
        ),
        "weighings": weighings,
        "last_weight_kg": last_weight,
        "last_weighed_at": last_date,
        "gmd_kg_day": gmd,
    }


@router.get("/weighings-map")
def get_weighings_map(
    session: Session = Depends(get_session),
    status: str = Query(default="active"),
    limit_per_animal: int = Query(default=8, ge=2, le=50),
    limit_animals: int = Query(default=2000, ge=1, le=5000),
) -> Dict[str, Any]:
    stmt = select(HerdAnimal).order_by(HerdAnimal.ear_tag.asc())
    status_norm = str(status or "").strip().lower()
    if status_norm and status_norm != "all":
        stmt = stmt.where(HerdAnimal.status == status_norm)
    stmt = stmt.limit(limit_animals)

    animals = list(session.exec(stmt).all())
    ear_tags = [str(row.ear_tag or "").strip().upper() for row in animals if str(row.ear_tag or "").strip()]
    rows_map = _last_weighings_map(session, ear_tags, max_per_animal=limit_per_animal)

    weighs: Dict[str, List[Dict[str, Any]]] = {}
    for ear in ear_tags:
        arr = rows_map.get(ear) or []
        if not arr:
            continue
        weighs[ear] = [
            {
                "id": row.id,
                "date": row.weighed_at.date().isoformat() if row.weighed_at else "",
                "kg": float(row.weight_kg or 0.0),
                "weighed_at": row.weighed_at.isoformat() if row.weighed_at else None,
                "note": str(row.note or ""),
            }
            for row in arr
        ]

    return {
        "weighs": weighs,
        "count": len(weighs),
        "animal_count": len(ear_tags),
        "limit_per_animal": limit_per_animal,
    }


class HealthItem(BaseModel):
    kind: str = ""
    code: str = ""
    name: str = ""
    dose: str = ""
    batch: str = ""
    note: str = ""


class ReproItem(BaseModel):
    code: str = ""
    name: str = ""


class WeighingCreate(BaseModel):
    ear_tag: str
    weight_kg: float
    weighed_at: Optional[datetime] = None
    note: str = ""
    # Sanidade / Reprodução (opcionais) — lançadas no curral junto com a pesagem
    health: Optional[List[HealthItem]] = None
    repro: Optional[List[ReproItem]] = None
    repro_semen: str = ""
    repro_protocol: str = ""
    repro_note: str = ""


class AnimalProfilePatch(BaseModel):
    birth: Optional[str] = None
    preg_status: Optional[str] = None
    preg_start: Optional[str] = None
    note: Optional[str] = None
    vac_name: Optional[str] = None
    vac_date: Optional[str] = None
    vac_next: Optional[str] = None
    sheet: Optional[Dict[str, Any]] = None


class LotUpsertItem(BaseModel):
    id: Optional[int] = None
    name: str
    category: str = ""
    area_name: str = ""
    heads: Optional[int] = None


class LotsUpsertBatch(BaseModel):
    lots: List[LotUpsertItem]


class AnimalUpsertItem(BaseModel):
    ear_tag: str
    sex: str = ""
    category: str = ""
    lot_id: Optional[int] = None
    area_name: str = ""
    status: str = "active"
    last_weight_kg: Optional[float] = None
    last_weighed_at: Optional[datetime] = None
    profile: Optional[AnimalProfilePatch] = None


class AnimalsUpsertBatch(BaseModel):
    animals: List[AnimalUpsertItem]
    create_weighings: bool = True


def _normalize_status(v: Any) -> str:
    raw = str(v or "active").strip().lower()
    if raw in {"active", "ativo"}:
        return "active"
    if raw in {"inactive", "inativo", "culled", "discarded", "descarte", "descartado"}:
        return "culled"
    if raw in {"sold", "vendido", "venda"}:
        return "sold"
    if raw in {"dead", "morto", "morte"}:
        return "dead"
    return "active"


def _apply_profile_patch(
    obj: HerdAnimalProfile,
    patch: AnimalProfilePatch,
    *,
    clear_blank: bool,
) -> HerdAnimalProfile:
    if clear_blank or str(patch.birth or "").strip():
        obj.birth_date = _clean_iso_day(patch.birth or "")

    if clear_blank or str(patch.preg_status or "").strip():
        preg_status = _clean_preg_status(patch.preg_status or "ND")
        obj.preg_status = preg_status
        if preg_status == "PRENHA":
            if clear_blank or str(patch.preg_start or "").strip():
                obj.preg_start_date = _clean_iso_day(patch.preg_start or "")
        else:
            obj.preg_start_date = ""

    if clear_blank or str(patch.note or "").strip():
        obj.note = str(patch.note or "").strip()
    if clear_blank or str(patch.vac_name or "").strip():
        obj.last_vaccine_name = str(patch.vac_name or "").strip()
    if clear_blank or str(patch.vac_date or "").strip():
        obj.last_vaccine_date = _clean_iso_day(patch.vac_date or "")
    if clear_blank or str(patch.vac_next or "").strip():
        obj.next_vaccine_date = _clean_iso_day(patch.vac_next or "")

    if clear_blank or patch.sheet is not None:
        incoming = patch.sheet if isinstance(patch.sheet, dict) else {}
        current = obj.sheet_json if isinstance(obj.sheet_json, dict) else {}
        obj.sheet_json = incoming if clear_blank else {**current, **incoming}

    obj.updated_at = datetime.utcnow()
    return obj


@router.post("/lots/upsert-batch")
def upsert_lots_batch(payload: LotsUpsertBatch, session: Session = Depends(get_session)) -> Dict[str, Any]:
    items = list(payload.lots or [])
    if not items:
        return {"ok": True, "lots": [], "count": 0}

    existing_rows = list(session.exec(select(HerdLot).order_by(HerdLot.id)).all())
    by_norm_name = {_norm_text(row.name): row for row in existing_rows if _norm_text(row.name)}
    saved: List[HerdLot] = []

    for item in items:
        name = str(item.name or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="nome do lote obrigatorio")

        obj: Optional[HerdLot] = None
        if item.id is not None:
            obj = session.get(HerdLot, int(item.id))
        if obj is None:
            obj = by_norm_name.get(_norm_text(name))
        if obj is None:
            obj = HerdLot()

        obj.name = name
        obj.category = str(item.category or obj.category or "").strip().upper()
        obj.area_name = str(item.area_name or obj.area_name or "").strip()
        if item.heads is not None:
            obj.heads = max(0, int(item.heads))
        obj.updated_at = datetime.utcnow()
        if item.id is not None and obj.id is None:
            obj.id = int(item.id)

        session.add(obj)
        session.flush()
        by_norm_name[_norm_text(obj.name)] = obj
        saved.append(obj)

    session.commit()
    return {
        "ok": True,
        "count": len(saved),
        "lots": [
            {
                "id": row.id,
                "name": row.name,
                "category": row.category,
                "area_name": row.area_name,
                "heads": row.heads,
            }
            for row in saved
        ],
    }


@router.post("/animals/upsert-batch")
def upsert_animals_batch(payload: AnimalsUpsertBatch, session: Session = Depends(get_session)) -> Dict[str, Any]:
    items = list(payload.animals or [])
    if not items:
        return {"ok": True, "animals": [], "count": 0, "weighings_created": 0}

    normalized_lot_ids = {
        int(item.lot_id)
        for item in items
        if item.lot_id is not None and int(item.lot_id) > 0
    }
    lots = (
        {int(row.id): row for row in session.exec(select(HerdLot).where(HerdLot.id.in_(normalized_lot_ids))).all() if row.id is not None}
        if normalized_lot_ids
        else {}
    )
    if len(lots) != len(normalized_lot_ids):
        missing = sorted(normalized_lot_ids - set(lots.keys()))
        raise HTTPException(status_code=422, detail=f"lotes inexistentes: {', '.join(str(x) for x in missing)}")

    weighings_created = 0
    saved_rows: List[Dict[str, Any]] = []
    for item in items:
        ear = str(item.ear_tag or "").strip().upper()
        if not ear:
            raise HTTPException(status_code=422, detail="ear_tag obrigatorio")

        obj = session.get(HerdAnimal, ear)
        if not obj:
            obj = HerdAnimal(ear_tag=ear)

        lot = lots.get(int(item.lot_id)) if item.lot_id is not None and int(item.lot_id) > 0 else None
        obj.sex = str(item.sex or obj.sex or "").strip().upper()
        obj.category = str(item.category or obj.category or "").strip().upper()
        obj.lot_id = int(item.lot_id) if item.lot_id is not None and int(item.lot_id) > 0 else None
        obj.area_name = str(item.area_name or (lot.area_name if lot else obj.area_name) or "").strip()
        obj.status = _normalize_status(item.status or obj.status)
        obj.updated_at = datetime.utcnow()
        session.add(obj)
        session.flush()

        profile_obj = session.get(HerdAnimalProfile, ear)
        if item.profile is not None:
            if not profile_obj:
                profile_obj = HerdAnimalProfile(ear_tag=ear)
            _apply_profile_patch(profile_obj, item.profile, clear_blank=False)
            session.add(profile_obj)

        weighing_created = False
        weight_kg = float(item.last_weight_kg) if item.last_weight_kg is not None else None
        if payload.create_weighings and weight_kg is not None and weight_kg > 0:
            weighed_at = item.last_weighed_at or datetime.utcnow()
            prev = session.exec(
                select(HerdWeighing)
                .where(HerdWeighing.animal_ear_tag == ear)
                .order_by(HerdWeighing.weighed_at.desc())
                .limit(1)
            ).first()
            is_duplicate = bool(
                prev
                and prev.weighed_at
                and prev.weighed_at.date() == weighed_at.date()
                and abs(float(prev.weight_kg or 0.0) - weight_kg) < 0.01
            )
            if not is_duplicate:
                session.add(
                    HerdWeighing(
                        animal_ear_tag=ear,
                        weighed_at=weighed_at,
                        weight_kg=weight_kg,
                        note="upsert_batch",
                    )
                )
                weighings_created += 1
                weighing_created = True

        session.flush()
        saved_rows.append(
            {
                "ear_tag": obj.ear_tag,
                "sex": obj.sex,
                "category": obj.category,
                "lot_id": obj.lot_id,
                "area_name": obj.area_name,
                "status": obj.status,
                "profile": _serialize_profile(profile_obj),
                "weighing_created": weighing_created,
            }
        )

    session.commit()
    return {
        "ok": True,
        "count": len(saved_rows),
        "weighings_created": weighings_created,
        "animals": saved_rows,
    }


@router.post("/weighings")
def create_weighing(payload: WeighingCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    a = session.get(HerdAnimal, payload.ear_tag)
    if not a:
        raise HTTPException(status_code=404, detail="animal not found")

    w = HerdWeighing(
        animal_ear_tag=payload.ear_tag,
        weight_kg=float(payload.weight_kg),
        weighed_at=payload.weighed_at or datetime.utcnow(),
        note=payload.note or "",
    )
    occurred = w.weighed_at or datetime.utcnow()

    try:
        session.add(w)

        # Sanidade (vacinas/verme/tratamento)
        if payload.health:
            items = [i.model_dump() for i in payload.health if i and (i.code or i.name)]
            if items:
                session.add(
                    Event(
                        source="manual",
                        status="approved",
                        type="sanidade",
                        occurred_at=occurred,
                        raw_text=None,
                        payload={
                            "ear_tag": a.ear_tag,
                            "lot_id": a.lot_id,
                            "area_name": a.area_name,
                            "items": items,
                        },
                    )
                )

        # Reprodução (IATF/Resync)
        if payload.repro:
            ritems = [i.model_dump() for i in payload.repro if i and (i.code or i.name)]
            has_meta = bool((payload.repro_semen or "").strip() or (payload.repro_protocol or "").strip() or (payload.repro_note or "").strip())
            if ritems or has_meta:
                session.add(
                    Event(
                        source="manual",
                        status="approved",
                        type="reproducao",
                        occurred_at=occurred,
                        raw_text=None,
                        payload={
                            "ear_tag": a.ear_tag,
                            "lot_id": a.lot_id,
                            "area_name": a.area_name,
                            "items": ritems,
                            "semen": payload.repro_semen or "",
                            "protocol": payload.repro_protocol or "",
                            "note": payload.repro_note or "",
                        },
                    )
                )

        session.commit()
        session.refresh(w)
        return {
            "ok": True,
            "id": w.id,
            "animal_ear_tag": w.animal_ear_tag,
            "weighed_at": w.weighed_at.isoformat() if w.weighed_at else None,
            "weight_kg": w.weight_kg,
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"weighing failed: {type(e).__name__}: {e}")


@router.patch("/animals/{ear_tag}/profile")
def patch_animal_profile(ear_tag: str, patch: AnimalProfilePatch, session: Session = Depends(get_session)) -> Dict[str, Any]:
    ear = str(ear_tag or "").strip().upper()
    if not ear:
        raise HTTPException(status_code=422, detail="ear_tag obrigatorio")

    animal = session.get(HerdAnimal, ear)
    if not animal:
        raise HTTPException(status_code=404, detail="animal not found")

    obj = session.get(HerdAnimalProfile, ear)
    if not obj:
        obj = HerdAnimalProfile(ear_tag=ear)

    preg_status = _clean_preg_status(patch.preg_status or "ND")
    preg_start = _clean_iso_day(patch.preg_start or "") if preg_status == "PRENHA" else ""
    obj.birth_date = _clean_iso_day(patch.birth or "")
    obj.preg_status = preg_status
    obj.preg_start_date = preg_start
    obj.note = str(patch.note or "").strip()
    obj.last_vaccine_name = str(patch.vac_name or "").strip()
    obj.last_vaccine_date = _clean_iso_day(patch.vac_date or "")
    obj.next_vaccine_date = _clean_iso_day(patch.vac_next or "")
    obj.sheet_json = patch.sheet if isinstance(patch.sheet, dict) else (obj.sheet_json if isinstance(obj.sheet_json, dict) else {})
    obj.updated_at = datetime.utcnow()

    session.add(obj)
    session.commit()
    session.refresh(obj)

    return {"ok": True, "ear_tag": ear, "profile": _serialize_profile(obj)}


class BaixaCreate(BaseModel):
    kind: str  # venda | morte | descarte
    occurred_at: Optional[datetime] = None
    note: str = ""
    value_brl: Optional[float] = None
    weight_kg: Optional[float] = None


@router.post("/animals/{ear_tag}/baixa")
def baixa_animal(ear_tag: str, payload: BaixaCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    a = session.get(HerdAnimal, ear_tag)
    if not a:
        raise HTTPException(status_code=404, detail="animal not found")

    k = (payload.kind or "").strip().lower()
    if k in ("venda", "vendido", "sale", "sold"):
        new_status = "sold"
    elif k in ("morte", "morto", "dead"):
        new_status = "dead"
    elif k in ("descarte", "descartado", "discard", "discarded"):
        new_status = "discarded"
    else:
        raise HTTPException(status_code=400, detail="invalid kind (use: venda | morte | descarte)")

    prev = a.status
    a.status = new_status
    a.updated_at = datetime.utcnow()

    occurred = payload.occurred_at or datetime.utcnow()
    ev = Event(
        source="manual",
        status="approved",
        type="baixa",
        occurred_at=occurred,
        raw_text=None,
        payload={
            "ear_tag": a.ear_tag,
            "lot_id": a.lot_id,
            "area_name": a.area_name,
            "prev_status": prev,
            "new_status": new_status,
            "kind": k,
            "note": payload.note or "",
            "value_brl": payload.value_brl,
            "weight_kg": payload.weight_kg,
        },
    )

    session.add(a)
    session.add(ev)
    session.commit()
    session.refresh(ev)

    return {"ok": True, "ear_tag": a.ear_tag, "status": a.status, "event_id": ev.id}


@router.get("/summary")
def summary(session: Session = Depends(get_session)) -> Dict[str, Any]:
    animals = session.exec(select(HerdAnimal).where(HerdAnimal.status == "active")).all()
    lots = session.exec(select(HerdLot)).all()
    total = len(animals)
    by_cat: Dict[str, int] = {}
    male_count = 0
    female_count = 0
    area_names: set[str] = set()
    lot_ids: set[int] = set()

    for a in animals:
        cat = str(a.category or "").strip() or "Sem categoria"
        by_cat[cat] = by_cat.get(cat, 0) + 1

        sex = str(a.sex or "").strip().upper()
        if sex == "M":
            male_count += 1
        elif sex == "F":
            female_count += 1

        if a.lot_id is not None:
            lot_ids.add(int(a.lot_id))
        area_name = str(a.area_name or "").strip()
        if area_name:
            area_names.add(area_name)

    for lot in lots:
        if lot.id is not None:
            lot_ids.add(int(lot.id))
        area_name = str(lot.area_name or "").strip()
        if area_name:
            area_names.add(area_name)

    # pesagem em dia: últimos 60 dias
    now = datetime.utcnow()
    cutoff = now - timedelta(days=60)
    tags = [a.ear_tag for a in animals]
    last_map = _last_weighing_map(session, tags)

    in_day = 0
    no_weigh = 0
    stale_weigh = 0
    total_weight_kg = 0.0
    for t in tags:
        lw = last_map.get(t)
        if not lw or not lw.weighed_at:
            no_weigh += 1
            continue
        if lw.weighed_at >= cutoff:
            in_day += 1
        else:
            stale_weigh += 1
        try:
            kg = float(lw.weight_kg or 0.0)
            if kg > 0:
                total_weight_kg += kg
        except Exception:
            pass

    profiles = _profiles_by_ear(session, tags)
    preg_count = 0
    empty_count = 0
    nd_preg_count = 0
    overdue_vaccine_count = 0
    no_vaccine_schedule_count = 0
    for ear in tags:
        profile = _serialize_profile(profiles.get(str(ear or "").strip().upper()))
        preg_status = str(profile.get("preg_status") or "ND").upper()
        if preg_status == "PRENHA":
            preg_count += 1
        elif preg_status == "VAZIA":
            empty_count += 1
        else:
            nd_preg_count += 1
        vac_next = str(profile.get("vac_next") or "").strip()
        if vac_next and vac_next < now.date().isoformat():
            overdue_vaccine_count += 1
        if not vac_next:
            no_vaccine_schedule_count += 1

    month_window = _parse_month_window(None)
    recent_health_events = list(
        session.exec(
            select(Event)
            .where(Event.type.in_(["sanidade", "reproducao"]))
            .where(Event.occurred_at >= month_window["start"])
            .where(Event.occurred_at < month_window["end"])
        ).all()
    )
    recent_health_count = 0
    recent_repro_count = 0
    for ev in recent_health_events:
        if ev.type == "sanidade":
            recent_health_count += 1
        elif ev.type == "reproducao":
            recent_repro_count += 1

    pct = round((in_day / total * 100.0), 1) if total else 0.0
    top_categories = [
        {
            "label": label,
            "value": count,
            "pct": round((count / total * 100.0), 1) if total else 0.0,
        }
        for label, count in sorted(by_cat.items(), key=lambda item: (-item[1], item[0]))[:3]
    ]

    property_count = 0
    try:
        from app.models.operations import Property

        property_count = len(list(session.exec(select(Property)).all()))
    except Exception:
        property_count = 0
    if property_count <= 0:
        property_count = 1

    return {
        "total_active": total,
        "by_category": by_cat,
        "top_categories": top_categories,
        "weighing_ok_pct": pct,
        "weighing_ok_count": in_day,
        "no_weigh_count": no_weigh,
        "stale_weigh_count": stale_weigh,
        "male_count": male_count,
        "female_count": female_count,
        "preg_count": preg_count,
        "empty_count": empty_count,
        "nd_preg_count": nd_preg_count,
        "overdue_vaccine_count": overdue_vaccine_count,
        "no_vaccine_schedule_count": no_vaccine_schedule_count,
        "lot_count": len(lots) if lots else len(lot_ids),
        "area_count": len(area_names),
        "property_count": property_count,
        "total_weight_kg": round(total_weight_kg, 1),
        "total_arrobas": round(total_weight_kg / 15.0, 1),
        "health_summary": {
            "preg_count": preg_count,
            "empty_count": empty_count,
            "nd_preg_count": nd_preg_count,
            "overdue_vaccine_count": overdue_vaccine_count,
            "no_vaccine_schedule_count": no_vaccine_schedule_count,
            "recent_health_events_month": recent_health_count,
            "recent_repro_events_month": recent_repro_count,
        },
    }


@router.get("/pending")
def pending(
    session: Session = Depends(get_session),
    limit: int = Query(default=30, ge=1, le=100),
    stale_days: int = Query(default=60, ge=1, le=365),
) -> Dict[str, Any]:
    animals = list(session.exec(select(HerdAnimal).where(HerdAnimal.status == "active")).all())
    lots = list(session.exec(select(HerdLot)).all())
    lot_map = {int(lot.id): lot for lot in lots if lot.id is not None}
    now = datetime.utcnow()
    tags = [str(a.ear_tag or "").strip().upper() for a in animals if str(a.ear_tag or "").strip()]

    last_map = _last_weighing_map(session, tags)
    profiles = _profiles_by_ear(session, tags)

    no_weigh_all: List[Dict[str, Any]] = []
    stale_all: List[Dict[str, Any]] = []
    overdue_vaccine_all: List[Dict[str, Any]] = []
    animals_by_ear = {str(a.ear_tag or "").strip().upper(): a for a in animals}

    for animal in animals:
        ear = str(animal.ear_tag or "").strip().upper()
        card = _animal_pending_card(
            animal,
            lot_map=lot_map,
            last_weighing=last_map.get(ear),
            profile=profiles.get(ear),
            now=now,
        )
        if not card.get("last_weighed_at"):
            no_weigh_all.append(card)
        elif int(card.get("days_since_weigh") or 0) >= stale_days:
            stale_all.append(card)

        vac_next = str(card.get("vac_next") or "").strip()
        if vac_next and vac_next < now.date().isoformat():
            overdue_vaccine_all.append(card)

    no_weigh_all.sort(key=lambda item: str(item.get("ear") or ""))
    stale_all.sort(key=lambda item: (-int(item.get("days_since_weigh") or 0), str(item.get("ear") or "")))
    overdue_vaccine_all.sort(key=lambda item: (str(item.get("vac_next") or "9999-99-99"), str(item.get("ear") or "")))

    suspect_rows = list(
        session.exec(
            select(HerdWeighing)
            .where(HerdWeighing.animal_ear_tag.in_(tags))
            .order_by(HerdWeighing.weighed_at.desc())
            .limit(max(limit * 20, 200))
        ).all()
    )
    suspect_all: List[Dict[str, Any]] = []
    seen_suspect: set[str] = set()
    for row in suspect_rows:
        ear = str(row.animal_ear_tag or "").strip().upper()
        if not ear or ear in seen_suspect:
            continue
        kg = float(row.weight_kg or 0.0)
        if 80.0 <= kg <= 900.0:
            continue
        seen_suspect.add(ear)
        animal = animals_by_ear.get(ear)
        lot = lot_map.get(int(animal.lot_id)) if animal and animal.lot_id is not None else None
        suspect_all.append(
            {
                "id": f"weigh_{row.id}",
                "ear": ear,
                "kg": kg,
                "date": row.weighed_at.date().isoformat() if row.weighed_at else "",
                "weighed_at": row.weighed_at.isoformat() if row.weighed_at else None,
                "lot_label": str((lot.name if lot else "") or "").strip() or "Sem lote",
                "flag": "out_of_range",
                "note": str(row.note or ""),
            }
        )

    return {
        "counts": {
            "suspect_weighs": len(suspect_all),
            "no_weigh": len(no_weigh_all),
            "stale_weigh": len(stale_all),
            "overdue_vaccine": len(overdue_vaccine_all),
            "operational_total": len(suspect_all) + len(no_weigh_all) + len(stale_all),
        },
        "suspect_weighs": suspect_all[:limit],
        "no_weigh": no_weigh_all[:limit],
        "stale_weigh": stale_all[:limit],
        "overdue_vaccine": overdue_vaccine_all[:limit],
        "stale_days": stale_days,
    }


def _activity_item_sort_key(item: Dict[str, Any]) -> str:
    return str(item.get("at") or item.get("date") or "")


@router.get("/activity")
def activity(
    session: Session = Depends(get_session),
    limit: int = Query(default=120, ge=1, le=500),
) -> Dict[str, Any]:
    weigh_limit = max(limit * 2, 60)
    event_limit = max(limit, 60)

    weigh_rows = session.exec(
        select(HerdWeighing).order_by(HerdWeighing.weighed_at.desc()).limit(weigh_limit)
    ).all()
    event_rows = session.exec(
        select(Event)
        .where(Event.type.in_(["transfer", "baixa", "sanidade", "reproducao"]))
        .order_by(Event.occurred_at.desc())
        .limit(event_limit)
    ).all()

    lot_ids: set[int] = set()
    for ev in event_rows:
        payload = ev.payload if isinstance(ev.payload, dict) else {}
        transfer = payload.get("transfer") if isinstance(payload.get("transfer"), dict) else {}
        to_lot_id = transfer.get("to_lot_id")
        from_lot_id = transfer.get("from_lot_id")
        try:
            if to_lot_id is not None:
                lot_ids.add(int(to_lot_id))
            if from_lot_id is not None:
                lot_ids.add(int(from_lot_id))
        except Exception:
            pass
    lot_name_by_id = {}
    if lot_ids:
        lot_rows = session.exec(select(HerdLot).where(HerdLot.id.in_(list(lot_ids)))).all()
        lot_name_by_id = {int(row.id): row.name for row in lot_rows if row.id is not None}

    items: List[Dict[str, Any]] = []
    for row in weigh_rows:
        at = row.weighed_at.isoformat() if row.weighed_at else None
        date = at[:10] if at else ""
        kg = float(row.weight_kg or 0.0)
        items.append(
            {
                "id": f"weigh_{row.id}",
                "type": "weigh",
                "ear": str(row.animal_ear_tag or "").strip().upper(),
                "kg": kg,
                "date": date,
                "at": at,
                "to": None,
                "reason": str(row.note or "").strip() or None,
                "flag": "out_of_range" if kg > 0 and (kg < 80 or kg > 900) else None,
            }
        )

    for ev in event_rows:
        payload = ev.payload if isinstance(ev.payload, dict) else {}
        at = ev.occurred_at.isoformat() if ev.occurred_at else None
        date = at[:10] if at else ""

        if ev.type == "transfer":
            transfer = payload.get("transfer") if isinstance(payload.get("transfer"), dict) else {}
            ear_tags = transfer.get("ear_tags") if isinstance(transfer.get("ear_tags"), list) else []
            to_lot_id = transfer.get("to_lot_id")
            try:
                to_lot_id = int(to_lot_id) if to_lot_id is not None else None
            except Exception:
                to_lot_id = None
            to_name = lot_name_by_id.get(to_lot_id, f"Lote {to_lot_id}" if to_lot_id is not None else "")
            for idx, ear in enumerate(ear_tags):
                norm_ear = _norm_ear_tag(str(ear))
                if not norm_ear:
                    continue
                items.append(
                    {
                        "id": f"event_{ev.id}_{idx}",
                        "type": "move",
                        "ear": norm_ear,
                        "kg": None,
                        "date": date,
                        "at": at,
                        "to": to_name or None,
                        "reason": str(transfer.get("reason") or transfer.get("note") or "").strip() or None,
                        "flag": None,
                    }
                )
            continue

        if ev.type == "baixa":
            ear = _norm_ear_tag(str(payload.get("ear_tag") or ""))
            if ear:
                kind = str(payload.get("kind") or "").strip()
                items.append(
                    {
                        "id": f"event_{ev.id}",
                        "type": "baixa",
                        "ear": ear,
                        "kg": payload.get("weight_kg"),
                        "date": date,
                        "at": at,
                        "to": None,
                        "reason": kind or str(payload.get("note") or "").strip() or None,
                        "flag": None,
                    }
                )
            continue

        if ev.type == "sanidade":
            ear = _norm_ear_tag(str(payload.get("ear_tag") or ""))
            if ear:
                raw_items = payload.get("items") if isinstance(payload.get("items"), list) else []
                labels = [
                    str(item.get("name") or item.get("code") or "").strip()
                    for item in raw_items
                    if isinstance(item, dict) and str(item.get("name") or item.get("code") or "").strip()
                ]
                items.append(
                    {
                        "id": f"event_{ev.id}",
                        "type": "health",
                        "ear": ear,
                        "kg": None,
                        "date": date,
                        "at": at,
                        "to": None,
                        "reason": f"Vacinas: {', '.join(labels)}" if labels else "Sanidade",
                        "flag": None,
                    }
                )
            continue

        if ev.type == "reproducao":
            ear = _norm_ear_tag(str(payload.get("ear_tag") or ""))
            if ear:
                items.append(
                    {
                        "id": f"event_{ev.id}",
                        "type": "repro",
                        "ear": ear,
                        "kg": None,
                        "date": date,
                        "at": at,
                        "to": None,
                        "reason": str(payload.get("protocol") or payload.get("note") or "Reprodução").strip(),
                        "flag": None,
                    }
                )

    items.sort(key=_activity_item_sort_key, reverse=True)
    return {"items": items[:limit], "count": min(len(items), limit)}



@router.post("/seed-demo")
def seed_demo(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """
    Preenche dados demo do Rebanho.

    É idempotente e "auto-corrige" casos em que o banco já tem lotes
    mas ainda não tem animais/pesagens (schema antigo / seed parcial).
    """
    try:
        from app.db.session import ENGINE
        from sqlmodel import SQLModel

        SQLModel.metadata.create_all(ENGINE)

        # 1) garante lotes (upsert por id)
        lots = [
            HerdLot(id=10, name="Vacas", category="VACA", area_name="Manga 7", heads=65),
            HerdLot(id=15, name="Boiada", category="BOI", area_name="Manga 30", heads=80),
            HerdLot(id=18, name="Novilhas", category="NOVILHA", area_name="Manga 18", heads=42),
            HerdLot(id=21, name="Bezerros", category="BEZERRO", area_name="Manga 21", heads=55),
        ]
        for l in lots:
            existing = session.get(HerdLot, l.id)
            if existing:
                existing.name = l.name
                existing.category = l.category
                existing.area_name = l.area_name
                existing.heads = l.heads
                existing.updated_at = datetime.utcnow()
            else:
                session.add(l)

        # 2) cria/atualiza animais (idempotente)
        animals = [
            HerdAnimal(ear_tag="A2402", sex="M", category="BOI", lot_id=15, area_name="Manga 30"),
            HerdAnimal(ear_tag="A2403", sex="M", category="BOI", lot_id=15, area_name="Manga 30"),
            HerdAnimal(ear_tag="7820", sex="M", category="BOI", lot_id=15, area_name="Manga 30"),
            HerdAnimal(ear_tag="B113", sex="F", category="VACA", lot_id=10, area_name="Manga 7"),
            HerdAnimal(ear_tag="B114", sex="F", category="VACA", lot_id=10, area_name="Manga 7"),
            HerdAnimal(ear_tag="N901", sex="F", category="NOVILHA", lot_id=18, area_name="Manga 18"),
            HerdAnimal(ear_tag="N902", sex="F", category="NOVILHA", lot_id=18, area_name="Manga 18"),
            HerdAnimal(ear_tag="BZ201", sex="M", category="BEZERRO", lot_id=21, area_name="Manga 21"),
            HerdAnimal(ear_tag="BZ202", sex="F", category="BEZERRA", lot_id=21, area_name="Manga 21"),
        ]
        for a in animals:
            ex = session.get(HerdAnimal, a.ear_tag)
            if ex:
                ex.sex = a.sex
                ex.category = a.category
                ex.lot_id = a.lot_id
                ex.area_name = a.area_name
                ex.status = ex.status or "active"
                ex.updated_at = datetime.utcnow()
            else:
                session.add(a)

        profiles = [
            HerdAnimalProfile(
                ear_tag="A2402",
                birth_date="2022-08-01",
                preg_status="ND",
                preg_start_date="",
                last_vaccine_name="Aftosa",
                last_vaccine_date="2026-01-10",
                next_vaccine_date="2026-07-10",
            ),
            HerdAnimalProfile(
                ear_tag="A2403",
                birth_date="2022-07-15",
                preg_status="ND",
                preg_start_date="",
                last_vaccine_name="",
                last_vaccine_date="",
                next_vaccine_date="",
            ),
            HerdAnimalProfile(
                ear_tag="N901",
                birth_date="2024-02-10",
                preg_status="VAZIA",
                preg_start_date="",
                last_vaccine_name="Brucelose",
                last_vaccine_date="2025-11-20",
                next_vaccine_date="",
            ),
            HerdAnimalProfile(
                ear_tag="B113",
                birth_date="2019-05-20",
                preg_status="PRENHA",
                preg_start_date="2025-10-01",
                last_vaccine_name="Aftosa",
                last_vaccine_date="2026-01-10",
                next_vaccine_date="2026-07-10",
            ),
            HerdAnimalProfile(
                ear_tag="B114",
                birth_date="2020-01-10",
                preg_status="VAZIA",
                preg_start_date="",
                last_vaccine_name="Raiva",
                last_vaccine_date="2025-12-05",
                next_vaccine_date="2026-12-05",
            ),
        ]
        for profile in profiles:
            ex_profile = session.get(HerdAnimalProfile, profile.ear_tag)
            if ex_profile:
                ex_profile.birth_date = profile.birth_date
                ex_profile.preg_status = profile.preg_status
                ex_profile.preg_start_date = profile.preg_start_date
                ex_profile.last_vaccine_name = profile.last_vaccine_name
                ex_profile.last_vaccine_date = profile.last_vaccine_date
                ex_profile.next_vaccine_date = profile.next_vaccine_date
                ex_profile.updated_at = datetime.utcnow()
            else:
                session.add(profile)

        now = datetime.utcnow()
        # 3) garante 2 pesagens por animal em parte do rebanho (GMD visível)
        seed_map = {
            "A2402": [(25, 495), (10, 510)],
            "A2403": [(45, 510), (21, 495)],  # GMD negativo
            "7820":  [(70, 450), (55, 460)],
            "B113":  [(60, 420), (35, 430)],
            "N901":  [(90, 350), (62, 360)],
            "BZ201": [(30, 200), (15, 210)],
        }

        def _find_row_by_day(rows: List[HerdWeighing], dt: datetime) -> Optional[HerdWeighing]:
            d = dt.date()
            for r in rows:
                if r.weighed_at and r.weighed_at.date() == d:
                    return r
            return None

        for ear, pairs in seed_map.items():

            rows = session.exec(
                select(HerdWeighing)
                .where(HerdWeighing.animal_ear_tag == ear)
                .order_by(HerdWeighing.weighed_at.asc())
            ).all()

            # upsert por dia: se já existe pesagem nesse dia, atualiza o peso (para garantir GMD visível no demo).
            for days_ago, kg in pairs:
                dt = now - timedelta(days=int(days_ago))
                exr = _find_row_by_day(rows, dt)
                if exr is None:
                    session.add(HerdWeighing(animal_ear_tag=ear, weighed_at=dt, weight_kg=float(kg)))
                else:
                    exr.weight_kg = float(kg)


        session.commit()
        return {"ok": True, "message": "seed ensured"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"seed failed: {type(e).__name__}: {e}")

# === REBANHO_TRANSFER_LOTE_V1 (clean) ===

import re


class HerdMoveReq(BaseModel):
    """Move animais entre lotes.

    Compatível com payloads antigos e novos:
    - antigo: {from_lot_id, to_lot_id, ear_tags, reason?, note?}
    - novo/compat: {from_lot, to_lot, ear_tags, reason?, note?}

    `from_lot*` é opcional (se vier, valida origem).
    `to_lot*` é obrigatório.
    """

    from_lot_id: Optional[int] = None
    to_lot_id: Optional[int] = None
    from_lot: Optional[str] = None
    to_lot: Optional[str] = None

    ear_tags: List[str]
    reason: Optional[str] = None
    note: Optional[str] = None


def _norm_ear_tag(v: str) -> str:
    s = (v or '').strip()
    s = re.sub(r'[^0-9A-Za-z]', '', s)
    return s.upper()


def _lot_id_from_any(v: Optional[str]) -> Optional[int]:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    if s.isdigit():
        return int(s)
    m = re.search(r'(\d+)', s)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _resolve_lot(session: Session, lot_id: Optional[int], lot_any: Optional[str]) -> Optional[HerdLot]:
    """Resolve lote por id (preferência), por string com id embutido (ex.: 'lot_15'), ou por name."""
    if lot_id is not None:
        return session.get(HerdLot, int(lot_id))

    lid = _lot_id_from_any(lot_any)
    if lid is not None:
        lot = session.get(HerdLot, int(lid))
        if lot:
            return lot

    if not lot_any:
        return None
    name = str(lot_any).strip()
    if not name:
        return None

    lot = session.exec(select(HerdLot).where(HerdLot.name == name).limit(1)).first()
    if not lot:
        # tentativa case-insensitive (sqlite pode não suportar ilike dependendo do driver)
        try:
            lot = session.exec(select(HerdLot).where(HerdLot.name.ilike(name)).limit(1)).first()
        except Exception:
            lot = None
    return lot


@router.post('/move')
@router.post('/move-lot')
@router.post('/transfer')
@router.post('/transfer-lot')
def herd_move_lot(req: HerdMoveReq, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Move animais ativos entre lotes.

    Regras:
    - Ignora brincos inexistentes.
    - Ignora animais com status != active.
    - Se `from_lot` vier, só move quem estiver na origem.
    - Atualiza `area_name` do animal para a área do lote destino (se houver).
    - Reconta `heads` dos lotes envolvidos.
    - Grava evento `transfer` (auditoria).
    """

    to_lot = _resolve_lot(session, req.to_lot_id, req.to_lot)
    if not to_lot or to_lot.id is None:
        raise HTTPException(status_code=400, detail='to_lot inválido')

    from_lot = None
    if req.from_lot_id is not None or (req.from_lot or '').strip():
        from_lot = _resolve_lot(session, req.from_lot_id, req.from_lot)
        if not from_lot or from_lot.id is None:
            raise HTTPException(status_code=400, detail='from_lot inválido')

    to_id = int(to_lot.id)
    from_id = int(from_lot.id) if (from_lot and from_lot.id is not None) else None

    if from_id is not None and from_id == to_id:
        raise HTTPException(status_code=400, detail='from_lot igual a to_lot')

    raw_tags = req.ear_tags or []
    clean: List[str] = []
    seen = set()
    for x in raw_tags:
        ear = _norm_ear_tag(str(x))
        if not ear or ear in seen:
            continue
        seen.add(ear)
        clean.append(ear)

    if not clean:
        raise HTTPException(status_code=400, detail='ear_tags vazio')

    moved = 0
    to_area = getattr(to_lot, 'area_name', '') or ''

    for ear in clean:
        a = session.get(HerdAnimal, ear)
        if not a:
            continue

        st = (getattr(a, 'status', 'active') or 'active').strip().lower()
        if st not in ('active', 'ativo', ''):
            continue

        if from_id is not None and getattr(a, 'lot_id', None) != from_id:
            continue

        a.lot_id = to_id
        if to_area:
            a.area_name = to_area
        a.updated_at = datetime.utcnow()
        session.add(a)
        moved += 1

    def _recount(lot_id: int) -> int:
        try:
            rows = session.exec(select(HerdAnimal).where(HerdAnimal.lot_id == lot_id)).all()
            c = 0
            for x in rows:
                st = (getattr(x, 'status', 'active') or 'active').strip().lower()
                if st in ('active', 'ativo', ''):
                    c += 1
            return c
        except Exception:
            return 0

    # atualiza heads dos lotes envolvidos
    for lid in [x for x in (from_id, to_id) if x is not None]:
        lot = session.get(HerdLot, int(lid))
        if lot:
            lot.heads = _recount(int(lid))
            lot.updated_at = datetime.utcnow()
            session.add(lot)

    # auditoria (evento)
    try:
        payload = {
            'transfer': {
                'from_lot_id': from_id,
                'to_lot_id': to_id,
                'ear_tags': clean,
                'reason': (req.reason or '').strip() or None,
                'note': (req.note or '').strip() or None,
            }
        }
        session.add(
            Event(
                source='app',
                status='approved',
                type='transfer',
                occurred_at=datetime.utcnow(),
                raw_text=None,
                payload=payload,
            )
        )
    except Exception:
        pass

    session.commit()

    return {
        'ok': True,
        'moved': moved,
        'from_lot_id': from_id,
        'to_lot_id': to_id,
        'to_lot_name': getattr(to_lot, 'name', '') or f'Lote {to_id}',
    }
