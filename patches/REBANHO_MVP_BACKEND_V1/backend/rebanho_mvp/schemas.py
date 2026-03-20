from __future__ import annotations

from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel
from .models import Sexo, Categoria, StatusAnimal, TipoMovimentacao


class MangaCreate(SQLModel):
    codigo: str
    nome: str
    area_ha: Optional[float] = None
    tem_agua: bool = True
    observacao: Optional[str] = None


class MangaUpdate(SQLModel):
    codigo: Optional[str] = None
    nome: Optional[str] = None
    area_ha: Optional[float] = None
    tem_agua: Optional[bool] = None
    observacao: Optional[str] = None


class MangaRead(SQLModel):
    id: int
    codigo: str
    nome: str
    area_ha: Optional[float]
    tem_agua: bool
    observacao: Optional[str]


class AnimalCreate(SQLModel):
    brinco: str
    marca_fogo: Optional[str] = None
    sexo: Sexo
    categoria: Categoria
    status: StatusAnimal = StatusAnimal.ativo
    dt_nascimento: Optional[date] = None
    origem: Optional[str] = None
    observacao: Optional[str] = None
    manga_atual_id: Optional[int] = None


class AnimalUpdate(SQLModel):
    brinco: Optional[str] = None
    marca_fogo: Optional[str] = None
    sexo: Optional[Sexo] = None
    categoria: Optional[Categoria] = None
    status: Optional[StatusAnimal] = None
    dt_nascimento: Optional[date] = None
    origem: Optional[str] = None
    observacao: Optional[str] = None
    manga_atual_id: Optional[int] = None


class AnimalRead(SQLModel):
    id: int
    brinco: str
    marca_fogo: Optional[str]
    sexo: Sexo
    categoria: Categoria
    status: StatusAnimal
    dt_nascimento: Optional[date]
    origem: Optional[str]
    observacao: Optional[str]
    manga_atual_id: Optional[int]
    criado_em: datetime
    atualizado_em: datetime


class AnimalResumo(SQLModel):
    animal: AnimalRead
    ultima_pesagem_data: Optional[date] = None
    ultimo_peso_kg: Optional[float] = None
    gmd_periodo: Optional[float] = None  # kg/dia
    gmd_inicio: Optional[date] = None
    gmd_fim: Optional[date] = None


class PesagemCreate(SQLModel):
    animal_id: int
    data: date
    peso_kg: float
    observacao: Optional[str] = None


class PesagemUpdate(SQLModel):
    data: Optional[date] = None
    peso_kg: Optional[float] = None
    observacao: Optional[str] = None


class PesagemRead(SQLModel):
    id: int
    animal_id: int
    data: date
    peso_kg: float
    observacao: Optional[str]
    criado_em: datetime


class MovimentacaoCreate(SQLModel):
    animal_id: int
    data: date
    tipo: TipoMovimentacao
    origem_manga_id: Optional[int] = None
    destino_manga_id: Optional[int] = None
    motivo: Optional[str] = None
    responsavel: Optional[str] = None
    observacao: Optional[str] = None


class MovimentacaoRead(SQLModel):
    id: int
    animal_id: int
    data: date
    tipo: TipoMovimentacao
    origem_manga_id: Optional[int]
    destino_manga_id: Optional[int]
    motivo: Optional[str]
    responsavel: Optional[str]
    observacao: Optional[str]
    criado_em: datetime


class TimelineItem(SQLModel):
    tipo: str  # "pesagem" | "movimentacao"
    data: date
    payload: dict
