# PATCH IDEAL FAZENDA FRONT – V4 FIX4 (Refazer Resumos)

Este patch refaz:
- **Resumo** da tela **Mangas & Pasto** (card grande à esquerda) para um layout compacto e claro.
- **Resumo do mês** e **Evolução do custo** do **Início (Mês)** para um layout mais bonito e com empty state correto.

## Aplicação (Terminal)
1) Pare o Vite (`Ctrl+C`)
2) `unzip -o PATCH...zip -d .`
3) `python3 tools/apply_ideal_fazenda_front_v4_fix4.py`
4) `bash tools/verify_ideal_fazenda_front_v4_fix4.sh`
5) `cd frontend && rm -rf .vite && npm run dev`
