from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field, Relationship


class Sexo(str, Enum):
    macho = "macho"
    femea = "femea"


class Categoria(str, Enum):
    bezerro = "bezerro"
    bezerra = "bezerra"
    novilha = "novilha"
    vaca = "vaca"
    boi = "boi"
    touro = "touro"
    outro = "outro"


class StatusAnimal(str, Enum):
    ativo = "ativo"
    inativo = "inativo"
    vendido = "vendido"
    morto = "morto"
    descarte = "descarte"


class TipoMovimentacao(str, Enum):
    transferencia_manga = "transferencia_manga"
    compra = "compra"
    venda = "venda"
    morte = "morte"
    descarte = "descarte"
    outro = "outro"


class Manga(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(index=True)
    nome: str
    area_ha: Optional[float] = None
    tem_agua: bool = True
    observacao: Optional[str] = None

    animais: list["Animal"] = Relationship(back_populates="manga_atual")


class Animal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    brinco: str = Field(index=True)
    marca_fogo: Optional[str] = Field(default=None, index=True)

    sexo: Sexo
    categoria: Categoria
    status: StatusAnimal = Field(default=StatusAnimal.ativo, index=True)

    dt_nascimento: Optional[date] = None
    origem: Optional[str] = None
    observacao: Optional[str] = None

    manga_atual_id: Optional[int] = Field(default=None, foreign_key="manga.id", index=True)

    criado_em: datetime = Field(default_factory=datetime.utcnow, index=True)
    atualizado_em: datetime = Field(default_factory=datetime.utcnow, index=True)

    manga_atual: Optional[Manga] = Relationship(back_populates="animais")
    pesagens: list["Pesagem"] = Relationship(back_populates="animal")
    movimentacoes: list["Movimentacao"] = Relationship(back_populates="animal")


class Pesagem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    animal_id: int = Field(foreign_key="animal.id", index=True)
    data: date = Field(index=True)
    peso_kg: float
    observacao: Optional[str] = None
    criado_em: datetime = Field(default_factory=datetime.utcnow, index=True)

    animal: Animal = Relationship(back_populates="pesagens")


class Movimentacao(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    animal_id: int = Field(foreign_key="animal.id", index=True)
    data: date = Field(index=True)

    tipo: TipoMovimentacao = Field(index=True)

    origem_manga_id: Optional[int] = Field(default=None, foreign_key="manga.id", index=True)
    destino_manga_id: Optional[int] = Field(default=None, foreign_key="manga.id", index=True)

    motivo: Optional[str] = None
    responsavel: Optional[str] = None
    observacao: Optional[str] = None
    criado_em: datetime = Field(default_factory=datetime.utcnow, index=True)

    animal: Animal = Relationship(back_populates="movimentacoes")
