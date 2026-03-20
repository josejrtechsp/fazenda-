# PATCH IDEAL_FAZENDA BACK V8 — Nutrição (Itens + Compras + Preço automático)

## O que adiciona
- Catálogo de itens de nutrição (concentrado, mineral, aditivos e volumosos)
- Compras (preço unitário por data)
- Motor de preço vigente (última compra <= data do evento)
- Integração com WhatsApp ingest/parse (nutrição sem preço do vaqueiro)

## Como aplicar
Na raiz do projeto IDEAL_FAZENDA:

```bash
unzip -o PATCH_IDEAL_FAZENDA_BACK_V8_NUTRITION.zip -d .
bash tools/apply_ideal_fazenda_back_v8_nutrition.sh
bash tools/verify_ideal_fazenda_back_v8_nutrition.sh
```

Reinicie o backend.
