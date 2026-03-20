ZIP DO SISTEMA — IDEAL_FAZENDA (macOS)

Este pacote adiciona um script para gerar um ZIP do projeto sem pastas pesadas (node_modules, .venv etc.).

Como aplicar (na raiz do projeto):
  unzip -o ~/Downloads/PATCH_IDEAL_FAZENDA_ZIP_SYSTEM_V1.zip -d .
  chmod +x tools/zip_system.sh

Como usar:
  tools/zip_system.sh light   # recomendado
  tools/zip_system.sh full    # inclui mais arquivos (ainda exclui node_modules/.venv)

Saída:
  ~/Downloads/IDEAL_FAZENDA_SYSTEM_<YYYYMMDD_HHMMSS>_<mode>.zip
