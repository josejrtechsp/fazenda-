from __future__ import annotations

from typing import Dict, List, Tuple

from sqlalchemy import text
from sqlmodel import SQLModel


def _sqlite_table_columns(conn, table: str) -> List[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})"))
    return [r[1] for r in rows]


def ensure_sqlite_schema(engine) -> None:
    """Guarantees minimum SQLite schema for existing deployments.

    SQLModel.metadata.create_all creates missing tables but does not alter
    existing ones. This helper adds missing columns required by newer versions.
    """

    SQLModel.metadata.create_all(engine)

    required: Dict[str, List[Tuple[str, str]]] = {
        "finance_approval_policy": [
            ("enabled", "INTEGER"),
            ("payable_threshold_brl", "REAL"),
            ("receivable_threshold_brl", "REAL"),
            ("payable_required_by", "TEXT"),
            ("receivable_required_by", "TEXT"),
            ("payable_tiers_json", "TEXT"),
            ("receivable_tiers_json", "TEXT"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
        ],
        "finance_month_close": [
            ("month", "TEXT"),
            ("actor", "TEXT"),
            ("note", "TEXT"),
            ("snapshot", "JSON"),
            ("net_settled_brl", "REAL"),
            ("net_open_brl", "REAL"),
            ("payable_open_brl", "REAL"),
            ("receivable_open_brl", "REAL"),
            ("created_at", "TEXT"),
        ],
        "finance_month_state": [
            ("month", "TEXT"),
            ("is_locked", "INTEGER"),
            ("locked_by", "TEXT"),
            ("locked_by_role", "TEXT"),
            ("locked_at", "TEXT"),
            ("note", "TEXT"),
            ("updated_at", "TEXT"),
        ],
        "herd_lots": [
            ("id", "INTEGER"),
            ("name", "TEXT"),
            ("category", "TEXT"),
            ("area_name", "TEXT"),
            ("heads", "INTEGER"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
        ],
        "herd_animals": [
            ("ear_tag", "TEXT"),
            ("status", "TEXT"),
            ("sex", "TEXT"),
            ("category", "TEXT"),
            ("lot_id", "INTEGER"),
            ("area_name", "TEXT"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
        ],
        "herd_weighings": [
            ("id", "INTEGER"),
            ("animal_ear_tag", "TEXT"),
            ("weighed_at", "TEXT"),
            ("weight_kg", "REAL"),
            ("note", "TEXT"),
        ],
        "people": [
            ("document_type", "TEXT"),
            ("zip_code", "TEXT"),
            ("street", "TEXT"),
            ("number", "TEXT"),
            ("district", "TEXT"),
            ("supplier_category_id", "INTEGER"),
            ("supplier_tags_csv", "TEXT"),
            ("bank_name", "TEXT"),
            ("bank_branch", "TEXT"),
            ("bank_account", "TEXT"),
            ("pix_key", "TEXT"),
            ("pix_type", "TEXT"),
        ],
    }

    with engine.begin() as conn:
        for table, cols in required.items():
            try:
                existing = set(_sqlite_table_columns(conn, table))
            except Exception:
                existing = set()

            for col, col_type in cols:
                if col in existing:
                    continue
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                except Exception:
                    # Ignore race or unsupported alter cases on older snapshots.
                    pass
