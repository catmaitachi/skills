# Fluxo de luuspz

Gerado de https://github.com/catmaitachi/skills (catalog.json) e carregado pelo `@luuspz.md` do `~/.claude/CLAUDE.md`. Não edite aqui: mude o catálogo e rode o setup de novo.

## Skills

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
- `security-audit-skill`: Auditoria de segurança em várias fases. Polimento: depois da verificação, em código sensível (auth, entrada do usuário, segredos, rede, dependências) ou antes de release/PR
- `codex-plugin-cc`: Segunda opinião e delegação via Codex. Opcional: só se o `codex` estiver instalado e logado. Revisa o plano antes de executar, e só quando eu escolher, porque gasta tokens da conta OpenAI
- `founder-skill`: 11 skills para validar uma ideia de negócio. Valida e monta planos de produto/negócio no Aprofundar (`founder-board`, `founder-consumer`, `founder-cfo`; `founder-plan` consolida)
- `vercel-labs-skills`: Descobrir skills novas. Só o `find-skills`, no Aprofundar de tarefa complexa. Skill achada só entra se agregar valor real e passar o mínimo: ≥1K instalações no skills.sh ou repo com ≥100 estrelas, commit nos últimos 6 meses e SKILL.md lido inteiro, sem script que baixa código, pede credencial ou mexe fora do projeto. Instala só no projeto (sem `-g`) e com meu ok

**Sob demanda**: ficam desligados. Quando a tarefa pedir um deles, sugira ligar só naquele projeto, em `.claude/settings.json` → `enabledPlugins` (ex.: `"Understand-Anything@luuspz-flow": true`), nunca globalmente.
- `headroom` (ferramenta externa): Comprime saídas, logs e arquivos (proxy/MCP). Alternativa ao RTK: nunca os dois
- `Understand-Anything`: Grafo e painel interativo do repositório. Só em repo grande ou desconhecido: a 1ª análise gasta muitos tokens
- `diagram-design`: Diagramas editoriais em HTML/SVG
- `taste-skill`: Direção de arte com checagem no navegador. Alternativa ao hallmark: um de cada vez
- `logo-generator-skill`: Geração de logos
- `last30days-skill`: O que se disse nos últimos 30 dias (Reddit, X, YouTube, HN)

**Não usar nem sugerir instalar:** `caveman`, `OmniRoute`, `graphify`, `hyperframes`, `rea`, `agent-skills`, `gstack`, `ai-job-search`, `linkedin-skills`.

## Aprofundar antes de executar

Quando eu trouxer uma **tarefa nova**, antes de qualquer ação (inclusive ler arquivos ou planejar), pergunte em uma linha se quero aprofundar o pedido. Saídas: aprofundar, executar como está.

Não pergunte quando a tarefa for trivial (um comando, uma pergunta factual, uma edição pontual), for ajuste ou continuação do que já está em andamento, ou quando eu disser "direto" / "sem aprofundar".

Se eu aceitar, a meta é uma versão **mais profunda, não maior**. Um tópico curto por ponto, nesta ordem:

1. **O que um profissional de alto nível faria aqui que eu não pedi.** Específico para este caso, no máximo 3 itens, o que mais muda o resultado primeiro.
2. **Material bruto.** De onde ele partiria (dado primário, fonte original, código, log, medição) em vez de resumo, relatório ou conclusão já processada. Diga onde está (caminho, comando, URL) ou que ainda não existe.
3. **Métodos e ferramentas**, com nome (técnica, biblioteca, comando, skill), não categorias genéricas. Inclua a **rota de skills**: as do fluxo na ordem em que vão entrar, marcando as desligadas. Em tarefa complexa, rode antes o `find-skills` e diga em uma linha o que achou e por que entra ou não (regra do `vercel-labs-skills`).
4. **Quem ou o que, fora de nós dois, comprovaria o resultado**: teste, medição, gabarito, documentação oficial, especialista, usuário real. Diga qual resultado provaria que está errado. Ideia ou plano de produto/negócio: as `founder-*` são o gabarito. Plano de código: a revisão do Codex, se ele estiver instalado.
5. **O prompt reescrito**, pronto para copiar, pedindo exatamente isso. Mesmo escopo do original: aprofunda, não acrescenta entregáveis. É a única parte longa.

Separe o que você sabe do que está supondo. Se uma regra do projeto (CLAUDE.md local) impede alguma sugestão, diga.

Depois pare e espere eu escolher, numa linha só: usar o reescrito · usar o reescrito + revisão do Codex (só se o `codex` estiver instalado; gasta tokens) · ajustar · seguir o original. Esta checagem vem antes do brainstorm do superpowers; o prompt escolhido vira a entrada dele.

## Ordem do fluxo

1. **Aprofundar** (acima): `find-skills` em tarefa complexa; `founder-*` para validar ideia ou plano de negócio.
2. **Plano**: `superpowers:brainstorming` → `superpowers:writing-plans`. Em plano de negócio, `founder-plan` consolida.
3. **Revisão do plano**, só se eu escolhi: agente `codex:codex-rescue` pedindo crítica ao arquivo do plano, só leitura e sem editar nada. Traga até 3 tópicos do que muda no plano.
4. **Execução**: `superpowers:test-driven-development` e `ponytail`; interface com `impeccable`, ou `hallmark` + `ui-ux-pro-max`.
5. **Verificação**: `superpowers:verification-before-completion`.
6. **Polimento**: `security-audit` em código sensível (auth, entrada do usuário, segredos, rede, dependências) ou antes de release/PR.

Tarefa pequena (até ~2 arquivos e sem decisão de design) vai direto da execução para a verificação.

## Hand-off enxuto

Quando eu precisar ler e responder, seja breve:
- pergunta em uma linha, com as opções no fim;
- tópicos curtos, sem parágrafo;
- retorno do Codex, do `find-skills` e das `founder-*`: até 3 tópicos com o que muda, nunca na íntegra;
- escolhas juntas numa lista só, no fim.

## Skills à vista

- Antes de chamar uma skill, diga em uma linha qual e por quê (ex.: `→ superpowers:brainstorming: tarefa nova com decisão de design`).
- Ao fim de cada turno o hook mostra as skills chamadas; não repita essa lista na resposta.

## Atualizações

O hook de início de sessão roda `~/.claude/luuspz/check-updates.mjs` (no máximo 1x por dia, sem saída quando não há nada). Se ele listar atualizações, pergunte uma vez se quero atualizar e só atualize com o meu ok.

## Trava e lembretes

O hook `~/.claude/luuspz/fluxo-guard.mjs` roda em quatro momentos:
- início da sessão: confere se este arquivo existe e está importado no CLAUDE.md; se o import falhar, injeta estas regras e avisa;
- cada prompt: lembrete curto do Aprofundar e do hand-off enxuto;
- antes de editar ou commitar: nega quando falta a skill. Editar arquivo exige uma do `superpowers`; editar interface (html, css, tsx…) exige `impeccable`, ou `hallmark` + `ui-ux-pro-max`; `git commit` exige `superpowers:verification-before-completion` depois da última edição. Arquivos em `~/.claude` e subagentes ficam de fora;
- fim do turno: mostra as skills chamadas.

Se ela negar, chame a skill que a mensagem pede; não contorne.
