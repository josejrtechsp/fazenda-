from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlmodel import Session, select

from app.db.session import ENGINE
from app.models.herd import HerdAnimal, HerdLot, HerdWeighing
from app.models.nutrition import NutritionItem, NutritionPurchase
from app.models.event import Event

SIM_TAG = "SIM300_V1"


def ensure_lots(session: Session) -> list[HerdLot]:
    target = [
        {"id": 10, "name": "Vacas", "category": "VACA", "area_name": "Manga 7", "heads": 0},
        {"id": 15, "name": "Boiada", "category": "BOI", "area_name": "Manga 30", "heads": 0},
        {"id": 18, "name": "Novilhas", "category": "NOVILHA", "area_name": "Manga 18", "heads": 0},
        {"id": 21, "name": "Bezerros", "category": "BEZERRO", "area_name": "Manga 21", "heads": 0},
    ]
    out = []
    for cfg in target:
        lot = session.get(HerdLot, cfg["id"])
        if not lot:
            lot = HerdLot(**cfg)
            session.add(lot)
        else:
            lot.name = cfg["name"]
            lot.category = cfg["category"]
            lot.area_name = cfg["area_name"]
            lot.updated_at = datetime.utcnow()
        out.append(lot)
    return out


def ensure_animals_and_weighings(session: Session) -> int:
    random.seed(42)
    lot_plan = [
        (10, "VACA", "F", 95, (380, 510)),
        (15, "BOI", "M", 110, (420, 560)),
        (18, "NOVILHA", "F", 55, (300, 430)),
        (21, "BEZERRO", "M", 40, (170, 290)),
    ]

    created_count = 0
    idx = 1

    for lot_id, category, sex, amount, (wmin, wmax) in lot_plan:
        lot = session.get(HerdLot, lot_id)
        if not lot:
            continue

        for _ in range(amount):
            ear = f"S{idx:04d}"
            idx += 1

            animal = session.get(HerdAnimal, ear)
            if not animal:
                animal = HerdAnimal(
                    ear_tag=ear,
                    sex=sex,
                    category=category,
                    status="active",
                    lot_id=lot_id,
                    area_name=lot.area_name or "",
                )
                session.add(animal)
                created_count += 1

            ws = session.exec(
                select(HerdWeighing)
                .where(HerdWeighing.animal_ear_tag == ear)
                .order_by(HerdWeighing.weighed_at.asc())
            ).all()

            if len(ws) < 2:
                base = random.uniform(wmin, wmax)
                gmd = random.uniform(0.45, 1.05)
                d1 = datetime.utcnow() - timedelta(days=random.randint(45, 70))
                d2 = d1 + timedelta(days=random.randint(18, 32))
                w1 = round(base, 1)
                w2 = round(base + gmd * (d2 - d1).days, 1)

                if len(ws) == 0:
                    session.add(HerdWeighing(animal_ear_tag=ear, weighed_at=d1, weight_kg=w1, note=SIM_TAG))
                    session.add(HerdWeighing(animal_ear_tag=ear, weighed_at=d2, weight_kg=w2, note=SIM_TAG))
                elif len(ws) == 1:
                    session.add(HerdWeighing(animal_ear_tag=ear, weighed_at=d2, weight_kg=w2, note=SIM_TAG))

    for lot_id, *_ in lot_plan:
        lot = session.get(HerdLot, lot_id)
        if not lot:
            continue
        animals = session.exec(select(HerdAnimal).where(HerdAnimal.lot_id == lot_id)).all()
        lot.heads = sum(1 for a in animals if (a.status or "active").lower() in ("active", "ativo", ""))
        lot.updated_at = datetime.utcnow()

    return created_count


def get_or_create_item(session: Session, name: str, default_unit: str) -> NutritionItem:
    item = session.exec(select(NutritionItem).where(NutritionItem.name == name).limit(1)).first()
    if item:
        return item
    item = NutritionItem(
        name=name,
        category="NUTRICAO",
        is_volumoso=False,
        default_unit=default_unit,
        aliases=name.lower(),
        is_active=True,
    )
    session.add(item)
    session.flush()
    return item


def ensure_purchases_and_costs(session: Session) -> int:
    today = datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0)

    plans = [
        {"name": "Ração concentrada", "qty": 180.0, "unit": "saco", "unit_price": 122.0},
        {"name": "Sal mineral", "qty": 60.0, "unit": "saco", "unit_price": 168.0},
        {"name": "Sal proteinado", "qty": 40.0, "unit": "saco", "unit_price": 192.0},
    ]

    created = 0
    for i, p in enumerate(plans):
        item = get_or_create_item(session, p["name"], p["unit"])

        stamp_date = (today - timedelta(days=(2 - i))).date()
        note = f"{SIM_TAG}:{p['name']}:{stamp_date.isoformat()}"

        existing_purchase = session.exec(
            select(NutritionPurchase)
            .where(NutritionPurchase.item_id == item.id)
            .where(NutritionPurchase.notes == note)
            .limit(1)
        ).first()

        if not existing_purchase:
            total = round(p["qty"] * p["unit_price"], 2)
            session.add(
                NutritionPurchase(
                    item_id=item.id,
                    purchased_at=today - timedelta(days=(2 - i)),
                    qty=p["qty"],
                    unit=p["unit"],
                    unit_price_brl=p["unit_price"],
                    total_brl=total,
                    supplier="Fornecedor Simulado",
                    notes=note,
                )
            )
            created += 1

        existing_cost_event = session.exec(
            select(Event)
            .where(Event.type == "cost")
            .where(Event.raw_text == note)
            .limit(1)
        ).first()

        if not existing_cost_event:
            total = round(p["qty"] * p["unit_price"], 2)
            payload = {
                "group": "nutricao",
                "category": p["name"],
                "value_brl": total,
                "unit": p["unit"],
                "qty": p["qty"],
                "unit_price_brl": p["unit_price"],
                "payment_status": "paid",
                "notes": f"Compra simulada {p['name']}",
            }
            session.add(
                Event(
                    source="sim",
                    status="approved",
                    type="cost",
                    occurred_at=today - timedelta(days=(2 - i)),
                    raw_text=note,
                    payload=payload,
                )
            )
            created += 1

    return created


def main() -> None:
    with Session(ENGINE) as session:
        ensure_lots(session)
        animals_created = ensure_animals_and_weighings(session)
        records_created = ensure_purchases_and_costs(session)
        session.commit()

    print("SIMULACAO_OK")
    print(f"animals_created={animals_created}")
    print(f"records_created={records_created}")


if __name__ == "__main__":
    main()
