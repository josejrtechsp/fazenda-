PATCH IDEAL Fazenda — BACK V6 (Rebanho mínimo + aplicar transferências)

O que entra:
- Tabelas Lot e Animal (brinco/ID) no models.py
- Router /herd com endpoints:
  - GET /herd/lots
  - GET /herd/animals?lot_id=10
  - POST /herd/seed-demo
  - POST /herd/animals/bulk
  - POST /herd/lots/{lot_id}/set-heads
- Router /events PATCH agora aplica automaticamente transferências aprovadas no rebanho:
  - transfer_mode=ear_tags => move Animal.ear_tag para o lote destino
  - transfer_mode=heads => ajusta Lot.heads_untagged

Como aplicar:
- unzip do patch na raiz do projeto
- rodar tools/verify_ideal_fazenda_back_v6_herd_apply.sh
- reiniciar backend
