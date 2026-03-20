from __future__ import annotations

from sqlmodel import Session
from ..core.db import engine

def get_session():
    with Session(engine) as session:
        yield session
