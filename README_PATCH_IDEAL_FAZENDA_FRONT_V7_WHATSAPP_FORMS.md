# PATCH IDEAL FAZENDA FRONT V7 — WhatsApp Validações (Resolver com formulários)

## O que muda
- Substitui o fluxo "Editar JSON" por um botão **Resolver** com formulário simples.
- Permite **Salvar** ou **Salvar e aprovar**.
- Botão **Perguntar no WhatsApp** agora copia uma mensagem sugerida com base em `missing_fields`/`ambiguities`.

## Arquivos
- frontend/src/pages/WhatsAppValidations.jsx
- tools/verify_ideal_fazenda_front_v7_whatsapp_forms.sh

## Aplicar
1) Pare o Vite (Ctrl+C)
2) Aplique o zip na raiz do projeto (IDEAL_FAZENDA)
3) Rode:
   bash tools/verify_ideal_fazenda_front_v7_whatsapp_forms.sh
4) Suba:
   cd frontend && npm run dev
