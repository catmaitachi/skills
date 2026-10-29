<!-- luuspz:start -->
## Fluxo de luuspz

Gerado de https://github.com/catmaitachi/skills (catalog.json). Não edite aqui: mude o catálogo e rode o setup de novo.

**Sempre (CORE)**
- `superpowers`: Brainstorm → plano → TDD → verificação. Único mestre. Tarefa pequena (até ~2 arquivos e sem decisão de design) pula o fluxo completo
- `rtk` (binário + hook): Condensa a saída dos comandos Bash antes de o modelo ler. Usar o binário com hook, nunca o plugin `rtk`
- `ponytail`: Menor solução que resolve; revisão anti-excesso. Não verifica correção: isso é do superpowers
- `impeccable`: `audit`, `critique` e `polish` de interface. Em UI existente, ou depois de criar com hallmark
- `hallmark`: Páginas novas que não parecem geradas. Só design novo, nunca em design existente
- `ui-ux-pro-max-skill`: Repertório de estilos, paletas e fontes. Junto com o hallmark ao criar
- `humanizer`: Tira o jeito de texto de IA. Só texto para o usuário final. Para dev (comentário, resposta, commit): direto e conciso, sem skill

**Complemento (só o que a regra diz)**
- `skills`: Skills de engenharia do Matt Pocock. Só `grilling`, `to-spec` e `domain-modeling`; TDD e review ficam com o superpowers

**Sob demanda**: ficam desligados. Quando a tarefa pedir um deles, sugira ligar só naquele projeto, em `.claude/settings.json` → `enabledPlugins` (ex.: `"security-audit-skill@luuspz-flow": true`), nunca globalmente.
- `headroom` (ferramenta externa): Comprime saídas, logs e arquivos (proxy/MCP). Alternativa ao RTK: nunca os dois
- `security-audit-skill`: Auditoria de segurança em várias fases. Antes de release ou em código sensível
- `codex-plugin-cc`: Segunda opinião e delegação via Codex
- `Understand-Anything`: Grafo e painel interativo do repositório. Só em repo grande ou desconhecido: a 1ª análise gasta muitos tokens
- `diagram-design`: Diagramas editoriais em HTML/SVG
- `taste-skill`: Direção de arte com checagem no navegador. Alternativa ao hallmark: um de cada vez
- `logo-generator-skill`: Geração de logos
- `last30days-skill`: O que se disse nos últimos 30 dias (Reddit, X, YouTube, HN)
- `founder-skill`: 11 skills para validar uma ideia de negócio
- `vercel-labs-skills`: Descobrir skills novas. Só o `find-skills`; `triage` e `pr-labeling` são do repo deles

**Não usar nem sugerir instalar:** `caveman`, `OmniRoute`, `graphify`, `hyperframes`, `rea`, `agent-skills`, `gstack`, `ai-job-search`, `linkedin-skills`.

**Atualizações**: o hook de início de sessão roda `~/.claude/luuspz/check-updates.mjs` (no máximo 1x por dia, sem saída quando não há nada). Se ele listar atualizações, pergunte uma vez se quero atualizar e só atualize com o meu ok.
<!-- luuspz:end -->
