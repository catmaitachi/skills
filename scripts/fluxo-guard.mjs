#!/usr/bin/env node
// Trava e lembretes do fluxo luuspz (~/.claude/luuspz.md). Um script, quatro eventos do Claude Code:
//   SessionStart     → confere se luuspz.md existe e está importado no CLAUDE.md; se o import faltar, injeta as regras
//   UserPromptSubmit → lembrete curto do Aprofundar e do hand-off enxuto
//   PreToolUse       → bloqueia a ação quando a skill que o fluxo exige não foi chamada nesta sessão:
//                        1. editar qualquer arquivo      → exige uma skill superpowers:*
//                        2. editar interface (html/css…) → exige impeccable, ou hallmark + ui-ux-pro-max
//                        3. git commit                   → exige superpowers:verification-before-completion depois da última edição
//                      Arquivos em ~/.claude (memória, settings, este hook) e subagentes ficam de fora.
//   Stop             → mostra ao usuário as skills chamadas no turno (systemMessage: não gasta tokens do modelo)
// shortcut: humanizer não é checado (não dá para saber, pelo caminho, se um texto é para usuário final).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OWNER = 'luuspz';
const EDICAO = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);
const UI = /\.(html?|css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/i;
// No Windows o caminho chega com \ ou /, e maiúsculas não importam: compara tudo normalizado.
const normal = (p) => { const s = String(p).replaceAll('\\', '/'); return process.platform === 'win32' ? s.toLowerCase() : s; };
const CLAUDE_DIR = normal(join(homedir(), '.claude')) + '/';
const naClaude = (p) => normal(p).startsWith(CLAUDE_DIR);
const COMANDO = /<command-name>\/?([^<\s]+)<\/command-name>/g;

const sair = (saida) => {
  if (saida) process.stdout.write(JSON.stringify(saida));
  process.exit(0);
};
const ler = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

let entrada;
try { entrada = JSON.parse(readFileSync(0, 'utf8')); } catch { sair(); }
const evento = entrada.hook_event_name ?? 'PreToolUse';

// Lê a sessão: skills chamadas (em ordem), a última edição e onde começa o turno atual (último prompt do usuário).
function lerSessao(caminho) {
  const linhas = ler(caminho)?.split('\n');
  if (!linhas) return null;
  const skills = []; // [{ nome, pos }]
  let ultimaEdicao = -1, inicioTurno = 0, pos = 0;
  for (const linha of linhas) {
    if (!linha) continue;
    let ev; try { ev = JSON.parse(linha); } catch { continue; }
    const conteudo = ev.message?.content;
    const prompt = ev.type === 'user' && !ev.isMeta &&
      (typeof conteudo === 'string' || (Array.isArray(conteudo) && conteudo.some((b) => b.type === 'text') && !conteudo.some((b) => b.type === 'tool_result')));
    if (prompt) inicioTurno = pos;
    if (typeof conteudo === 'string') {
      for (const m of conteudo.matchAll(COMANDO)) skills.push({ nome: m[1], pos: pos++ });
      continue;
    }
    if (!Array.isArray(conteudo)) continue;
    for (const b of conteudo) {
      if (b.type === 'text' && ev.type === 'user')
        for (const m of b.text.matchAll(COMANDO)) skills.push({ nome: m[1], pos: pos++ });
      if (b.type !== 'tool_use') continue;
      if (b.name === 'Skill' && b.input?.skill) skills.push({ nome: b.input.skill, pos: pos++ });
      else if (EDICAO.has(b.name) && !naClaude(b.input?.file_path || b.input?.notebook_path || '')) ultimaEdicao = pos++;
    }
  }
  return { skills, ultimaEdicao, inicioTurno };
}

if (evento === 'SessionStart') {
  const regras = ler(join(homedir(), '.claude', `${OWNER}.md`));
  if (regras === null)
    sair({ systemMessage: `fluxo ${OWNER}: ~/.claude/${OWNER}.md não existe. Rode de novo o prompt de setup de https://github.com/catmaitachi/skills.` });
  const importado = new RegExp(`^@(~/\\.claude/)?${OWNER}\\.md\\s*$`, 'm').test(ler(join(homedir(), '.claude', 'CLAUDE.md')) ?? '');
  if (importado) sair();
  sair({
    systemMessage: `fluxo ${OWNER}: o ~/.claude/CLAUDE.md não importa @${OWNER}.md; as regras foram injetadas nesta sessão. Rode o setup de novo para corrigir.`,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: regras },
  });
}

if (evento === 'UserPromptSubmit') {
  const prompt = String(entrada.prompt ?? '').trim();
  if (prompt.startsWith('/') || /\b(direto|sem aprofundar)\b/i.test(prompt)) sair();
  sair({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `Fluxo ${OWNER}: se for tarefa nova e não trivial, faça a pergunta do Aprofundar (${OWNER}.md) antes de qualquer ação. Anuncie cada skill em uma linha antes de chamar. Hand-off enxuto.`,
    },
  });
}

if (evento === 'Stop') {
  const sessao = lerSessao(entrada.transcript_path);
  const nomes = [...new Set(sessao?.skills.filter((s) => s.pos >= sessao.inicioTurno).map((s) => s.nome) ?? [])];
  sair(nomes.length ? { systemMessage: `Skills neste turno: ${nomes.join(' → ')}` } : undefined);
}

if (evento !== 'PreToolUse') sair();

// --- PreToolUse: a trava ---
const negar = (motivo) =>
  sair({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } });

const { tool_name: ferramenta, tool_input: dados = {}, transcript_path: caminho, agent_id } = entrada;
if (agent_id) sair(); // subagente: o fluxo é cobrado da sessão principal

const arquivo = dados.file_path || dados.notebook_path || '';
const ehCommit = ferramenta === 'Bash' && /\bgit\s+commit\b/.test(dados.command || '');
if (!(EDICAO.has(ferramenta) || ehCommit)) sair();
if (naClaude(arquivo)) sair();

const sessao = lerSessao(caminho);
if (!sessao) sair({ systemMessage: 'fluxo-guard: transcript ilegível, trava não aplicada.' });
const { skills, ultimaEdicao } = sessao;
const plugin = (s) => s.nome.split(':')[0];
const tem = (p) => skills.some((s) => plugin(s) === p || s.nome === p);

if (ehCommit) {
  const verif = Math.max(-1, ...skills.filter((s) => /verification-before-completion$/.test(s.nome)).map((s) => s.pos));
  if (verif < ultimaEdicao || verif < 0)
    negar('Fluxo luuspz: antes de commitar, chame a skill superpowers:verification-before-completion (depois da última edição) e rode a verificação que ela pede.');
  sair();
}

if (!tem('superpowers'))
  negar('Fluxo luuspz: nenhuma skill do superpowers foi chamada nesta sessão. Chame a que cabe (brainstorming para algo novo, systematic-debugging para defeito, writing-plans/executing-plans, test-driven-development) antes de editar.');

if (UI.test(arquivo) && !tem('impeccable') && !(tem('hallmark') && tem('ui-ux-pro-max')))
  negar('Fluxo luuspz: arquivo de interface. Chame impeccable (interface existente) ou hallmark + ui-ux-pro-max (página nova) antes de editar.');

sair();
