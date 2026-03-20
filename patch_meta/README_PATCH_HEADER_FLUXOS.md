# PATCH — Header (Fluxos → IDEAL Fazenda)

Este patch substitui o componente **FazendaTopHeader** para reutilizar a estrutura/classe do cabeçalho padrão dos fluxos (SuasTopHeader/App.css):

- `.app-header`, `.app-header-inner`, `.app-header-title`
- Tag + Título com gradiente + Subtitle
- Bloco direita com usuário/perfil e linhas: **Fazenda** + **Período**

## Aplicar

```bash
FAZ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$FAZ" || exit 1
unzip -o /caminho/para/PATCH_IDEAL_FAZENDA_FRONT_HEADER_FLUXOS_20260118.zip -d .

bash tools/verify_ideal_fazenda_front_header_fluxos.sh
```
