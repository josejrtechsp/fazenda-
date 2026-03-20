RUN_ALL — scripts para instalar e subir BACK + FRONT (macOS)

O que adiciona:
- run_all.sh (na raiz do projeto): sobe backend (8001) + frontend (5173)
- tools/setup_backend_312.sh: cria .venv com Python 3.12 e instala requirements.txt
- tools/setup_frontend.sh: npm install no frontend
- tools/kill_ports.sh: mata processos nas portas 8001 e 5173

Como aplicar (na raiz do seu projeto IDEAL_FAZENDA):
  unzip -o ~/Downloads/PATCH_IDEAL_FAZENDA_RUN_ALL_SCRIPTS_V1.zip -d .
  chmod +x run_all.sh tools/*.sh

Como usar:
  ./run_all.sh setup-back
  ./run_all.sh setup-front
  ./run_all.sh all
  ./run_all.sh back
  ./run_all.sh front
  ./run_all.sh kill
  FRONT_MODE=preview ./run_all.sh all

Smoke checks (com backend/front no ar):
  ./tools/checks_smoke.sh
  # opcional:
  API_BASE=http://127.0.0.1:8001 FRONT_BASE=http://127.0.0.1:5173 ./tools/checks_smoke.sh

Notas:
- Backend: http://127.0.0.1:8001/docs
- Frontend: http://127.0.0.1:5173
- Se o vite dev ficar instavel no iCloud, use `FRONT_MODE=preview` para servir build estatico.
