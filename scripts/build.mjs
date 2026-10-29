// Gera README.md e claude-rules.md a partir de catalog.json (decisões) e stars.json (lista atual).
// Uso: node scripts/build.mjs   (rode depois do sync.mjs)
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = 'catmaitachi/skills';
// Download pelo commit, nunca por `main`: a URL por branch fica minutos em cache depois de um push.
const GET = `https://raw.githubusercontent.com/${REPO}/<commit>/<arquivo>`;
const LIST_URL = 'https://github.com/stars/catmaitachi/lists/skills';
const catalog = JSON.parse(readFileSync('catalog.json', 'utf8'));
const stars = JSON.parse(readFileSync('stars.json', 'utf8'));
const { marketplace: MKT, owner: OWNER } = catalog;

const LEVELS = {
  core: { badge: 'CORE', color: '2ea44f', legend: '🟢 <b>CORE</b> sempre ativo' },
  complemento: { badge: 'COMPLEMENTO', color: '0969da', legend: '🔵 <b>COMPLEMENTO</b> só o que a regra diz' },
  'sob-demanda': { badge: 'SOB_DEMANDA', color: 'd4a72c', legend: '🟡 <b>SOB DEMANDA</b> ligado por projeto' },
  catalogo: { badge: 'CAT%C3%81LOGO', color: '8b949e', legend: '⚪ <b>CATÁLOGO</b> não instalo' },
  descartado: { badge: 'DESCARTADO', color: 'cf222e', legend: '🔴 <b>DESCARTADO</b> concorre com um core' },
};
const TYPES = { plugin: '🔌 plugin', hook: '🪝 binário + hook', ferramenta: '🛠️ ferramenta externa' };

// --- HTML puro e centralizado: align (GitHub) + style (outros visualizadores) ---
const A = 'align="center" style="text-align:center"';
const md = (s = '') => s.replace(/`([^`]+)`/g, '<code>$1</code>');
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const badge = (text, color, style = 'for-the-badge') =>
  `<img alt="${decodeURIComponent(text).replace(/_/g, ' ').toLowerCase()}" src="https://img.shields.io/badge/${text}-${color}?style=${style}">`;
const link = (repo, name) => `<a href="https://github.com/${repo}"><b>${name}</b></a>`;
const td = (s, extra = '') => `<td ${A}${extra}>${s}</td>`;
const table = (head, rows) =>
  `<table ${A}>\n<thead><tr>${head.map((h) => `<th ${A}>${h}</th>`).join('')}</tr></thead>\n<tbody>\n${rows.join('\n')}\n</tbody>\n</table>`;
const grouped = (groups) =>
  groups.flatMap(({ cell, rows }) =>
    rows.map((r, i) => `<tr>${i === 0 ? td(cell, ` rowspan="${rows.length}" valign="middle"`) : ''}${r.map((c) => td(c)).join('')}</tr>`),
  );

const kindOf = (repo) => stars.find((s) => s.repo.toLowerCase() === repo.toLowerCase());
const id = (i) => (i.type === 'plugin' ? `${i.name}@${MKT}` : null);

// --- Tabela principal: decisões do catalog.json ---
const main = grouped(
  Object.entries(LEVELS).map(([level, l]) => ({
    cell: badge(l.badge, l.color),
    rows: catalog.items
      .filter((i) => i.level === level)
      .map((i) => [
        `${link(i.repo, i.name)}<br><sub>${TYPES[i.type]}${id(i) ? ` · <code>${id(i)}</code>` : ''}</sub>`,
        i.layer,
        md(i.purpose),
        md(i.rule) || '—',
      ]),
  })).filter((g) => g.rows.length),
);

// --- Tabela secundária: o que está na lista e não entrou no fluxo ---
const known = new Set(catalog.items.map((i) => i.repo.toLowerCase()));
const pending = stars.filter((s) => !known.has(s.repo.toLowerCase()));
const out = catalog.items.filter((i) => i.level === 'fora');
const row = (repo, desc, kind) => [link(repo, repo.split('/')[1]), esc(desc).slice(0, 110) || '—', kind ?? '—'];
const secondary = grouped([
  {
    cell: badge('N%C3%83O_VALIDADO', '8250df'),
    rows: pending.length ? pending.map((s) => row(s.repo, s.description, s.kind)) : [['—', '<i>Nenhum repo novo na lista desde a última revisão</i>', '—']],
  },
  ...(out.length
    ? [{ cell: badge('FORA_DO_FLUXO', '6e7781'), rows: out.map((i) => row(i.repo, kindOf(i.repo)?.description ?? '', kindOf(i.repo)?.kind)) }]
    : []),
]);

// --- Bloco de regras do CLAUDE.md (determinístico) ---
const line = (i) => `- \`${i.name}\`${i.type === 'plugin' ? '' : ` (${TYPES[i.type].split(' ').slice(1).join(' ')})`}: ${[i.purpose, i.rule].filter(Boolean).join('. ')}`;
const pick = (level) => catalog.items.filter((i) => i.level === level);
const rules = `<!-- ${OWNER}:start -->
## Fluxo de ${OWNER}

Gerado de https://github.com/${REPO} (catalog.json). Não edite aqui: mude o catálogo e rode o setup de novo.

**Sempre (CORE)**
${pick('core').map(line).join('\n')}

**Complemento (só o que a regra diz)**
${pick('complemento').map(line).join('\n')}

**Sob demanda**: ficam desligados. Quando a tarefa pedir um deles, sugira ligar só naquele projeto, em \`.claude/settings.json\` → \`enabledPlugins\` (ex.: \`"${pick('sob-demanda').find((i) => i.type === 'plugin').name}@${MKT}": true\`), nunca globalmente.
${pick('sob-demanda').map(line).join('\n')}

**Não usar nem sugerir instalar:** ${[...pick('catalogo'), ...pick('descartado'), ...out].map((i) => `\`${i.name}\``).join(', ')}.

**Atualizações**: o hook de início de sessão roda \`~/.claude/${OWNER}/check-updates.mjs\` (no máximo 1x por dia, sem saída quando não há nada). Se ele listar atualizações, pergunte uma vez se quero atualizar e só atualize com o meu ok.
<!-- ${OWNER}:end -->
`;

// --- Prompt de setup ---
const prompt = `Configure meu Claude Code com o fluxo de https://github.com/${REPO}.

Fontes: pegue o commit atual com \`git ls-remote https://github.com/${REPO} HEAD\` e baixe cada arquivo com curl de ${GET}. Pelo commit, e não por "main", você nunca recebe uma versão em cache. Não use busca na web nem resuma.
- catalog.json: o que instalar, ligar e desligar
- claude-rules.md: o bloco de regras, pronto

0. Aviso e consentimento, antes de qualquer outra ação: em poucas linhas e do jeito que achar mais claro para mim, explique o que é este setup (o fluxo de skills de ${REPO}), o que ele vai mexer no meu computador (plugins do Claude Code, o binário do RTK com seu hook, ~/.claude/settings.json, ~/.claude/CLAUDE.md e um verificador diário de atualizações) e que haverá backup e nada será desinstalado. Pergunte se eu entendo e concordo. Se eu não concordar, pare sem mudar nada.

Depois do meu sim, faça um levantamento só de leitura (o que já está instalado, ligado ou faltando). Se houver itens fora do fluxo (passo 4), faça a pergunta desse passo nesse momento. Só então, antes de alterar qualquer coisa, me mostre o plano concreto (o que vai instalar, ligar, desligar e gravar) e espere meu ok. Faça uma cópia .bak de cada arquivo antes de alterá-lo. Nunca desinstale nada: só ligue ou desligue. Depois de cada comando do CLI, confira se o estado ficou como esperado; se não, pare e me avise.

1. Sistema: detecte se é windows, macos ou linux. Nos campos "install", use a chave do sistema (ou "any").
2. Marketplace: se "${MKT}" não aparecer em \`claude plugin marketplace list\`, rode \`claude plugin marketplace add ${REPO}\`. Se houver um marketplace antigo deste mesmo repo com outro nome (ex.: "nice-skills"), me avise e proponha migrar: instalar os mesmos plugins pelo id novo e só depois remover o antigo, com o meu ok.
3. Plugins do fluxo (type "plugin"), sempre pelo id <name>@${MKT}:
   - core e complemento: instale se faltar (\`claude plugin install\`) e deixe ligados.
   - sob-demanda, catalogo e fora: não instale; se já estiverem instalados, desligue (\`claude plugin disable\`).
   - descartado: se estiver instalado, desligue e me avise.
   - Campo "requires": só instale a dependência se o plugin for ficar ligado.
   - Se ~/.claude/${OWNER}/choices.json tiver uma decisão minha para esse id, ela vale mais que o catálogo: não mude, me avise da diferença e pergunte uma vez se quero seguir o catálogo.
4. Fora do fluxo: liste os plugins ligados que não estão no catalog.json (de qualquer marketplace) e as skills avulsas em ~/.claude/skills. Leia ~/.claude/${OWNER}/choices.json, se existir: o que já tem decisão lá não entra na pergunta, só reaplique a decisão gravada. Se sobrar algum item sem decisão, faça UMA pergunta com três opções (se houver um "modo" gravado, ofereça-o como recomendado):
   a) desativar todos: plugins com \`claude plugin disable\`; skills avulsas movidas para ~/.claude/skills-off/ (reversível, nada é apagado);
   b) manter como estão;
   c) decidir por mim, um a um: proponha para cada item um nível do fluxo (core, complemento, sob-demanda ou desligar) com o motivo em uma linha, numa tabela, e só aplique depois que eu aprovar ou ajustar. No relatório, liste essas decisões como sugestões para o catalog.json.
   Grave o resultado em ~/.claude/${OWNER}/choices.json, sem perder decisões anteriores: {"modo": "a" | "b" | "c", "items": {"plugin:<id>" ou "skill:<nome>": "ligado" ou "desligado"}}. É por esse arquivo que o verificador diário sabe o que você escolheu.
   O que não dá para desativar localmente (ex.: skills vindas da conta ou do app desktop), só liste.
5. Ferramentas e hooks (type "hook" ou "ferramenta"):
   - core: rode "verify"; se falhar, instale com o comando do sistema e depois rode "setup".
   - rtk: se o \`rtk init -g\` não gravar o hook em ~/.claude/settings.json (acontece sem terminal interativo), adicione em hooks.PreToolUse: {"matcher": "Bash", "hooks": [{"type": "command", "command": "rtk hook claude"}]}. Nunca ligue o plugin "rtk".
   - sob-demanda: não instale; só liste no relatório.
6. Regras: em ~/.claude/CLAUDE.md, troque o trecho entre <!-- ${OWNER}:start --> e <!-- ${OWNER}:end --> pelo conteúdo de claude-rules.md, sem mudar uma vírgula. Se o trecho não existir, adicione no fim. Não toque no resto do arquivo (ex.: @RTK.md).
7. Atualizações: baixe scripts/check-updates.mjs (pelo mesmo commit das fontes) para ~/.claude/${OWNER}/check-updates.mjs (sobrescreva se existir). Em ~/.claude/settings.json, registre em hooks.SessionStart: {"hooks": [{"type": "command", "command": "node \\"<caminho absoluto do script>\\""}]}, sem duplicar se já houver um com esse script. Ele só lê e avisa; quem atualiza é você, com o meu ok.
8. Verificação:
   - \`node <caminho do script> --force\` roda sem erro (listar atualizações é normal);
   - \`rtk --version\` e \`rtk gain\` respondem (e não "command not found");
   - o hook reescreve: envie {"tool_name":"Bash","tool_input":{"command":"git status"}} para \`rtk hook claude\` e confira "rtk git status" na saída;
   - \`claude plugin list\` mostra ligados exatamente os plugins core e complemento;
   - o bloco de regras está no CLAUDE.md;
   - os itens fora do fluxo ficaram como escolhi no passo 4.
9. Relatório: o que mudou, o que falhou e o que exige reiniciar o Claude Code.`;

const readme = `<!-- Gerado por scripts/build.mjs a partir de catalog.json e stars.json. Não edite à mão: mude o catalog.json. -->

<h1 ${A}>🧰 skills</h1>

<p ${A}><b>Meu marketplace de plugins para o Claude Code, classificado pelo que eu realmente uso.</b></p>

<p ${A}><code>/plugin marketplace add ${REPO}</code></p>

<p ${A}><sub>${Object.values(LEVELS).map((l) => l.legend).join(' · ')}</sub></p>

${table(['Nível', 'Plugin', 'Camada', 'Para quê', 'Regra'], main)}

<h2 ${A}>🆕 Ainda fora do fluxo</h2>

<p ${A}>Repos da <a href="${LIST_URL}">lista de estrelas</a> sem decisão minha. Atualiza sozinha: estrela nova aparece aqui como <b>não validado</b> até entrar no <code>catalog.json</code>.</p>

${table(['Status', 'Repositório', 'Descrição', 'Como entra'], secondary)}

<h2 ${A}>📋 Aplicar este fluxo no meu computador</h2>

<p ${A}>Copie o prompt e cole no Claude Code. Ele instala e liga os plugins do fluxo, instala o RTK com o hook, grava as regras em <code>~/.claude/CLAUDE.md</code>, liga a verificação diária de atualizações (por script, sem gastar tokens) e confere tudo no final. Pede seu ok antes de mudar qualquer coisa e pode ser rodado de novo para atualizar.</p>

\`\`\`text
${prompt}
\`\`\`

<p ${A}><sub>Fonte das decisões: <a href="catalog.json"><code>catalog.json</code></a> · <a href="scripts/sync.mjs"><code>sync.mjs</code></a> lê a lista a cada 6h e <a href="scripts/build.mjs"><code>build.mjs</code></a> gera este README e o <a href="claude-rules.md"><code>claude-rules.md</code></a></sub></p>
`;

writeFileSync('README.md', readme);
writeFileSync('claude-rules.md', rules);
console.log(`README.md: ${catalog.items.length - out.length} decididos, ${pending.length} não validados, ${out.length} fora do fluxo`);
