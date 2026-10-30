#!/usr/bin/env node
// Trava do fluxo luuspz (CLAUDE.md global): bloqueia a ação quando a skill que o fluxo exige
// não foi chamada nesta sessão. Lê o transcript (.jsonl) que o Claude Code passa no stdin.
//   1. editar qualquer arquivo      → exige uma skill superpowers:*
//   2. editar interface (html/css…) → exige impeccable, ou hallmark + ui-ux-pro-max
//   3. git commit                   → exige superpowers:verification-before-completion depois da última edição
// Arquivos em ~/.claude (memória, settings, este hook) ficam de fora.
// shortcut: humanizer não é checado (não dá para saber, pelo caminho, se um texto é para usuário final).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const EDICAO = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);
const UI = /\.(html?|css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/i;
const CLAUDE_DIR = homedir() + '/.claude/';

const negar = (motivo) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo },
  }));
  process.exit(0);
};

let entrada;
try { entrada = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const { tool_name: ferramenta, tool_input: dados = {}, transcript_path: caminho, agent_id } = entrada;
if (agent_id) process.exit(0); // subagente: o fluxo é cobrado da sessão principal

const arquivo = dados.file_path || dados.notebook_path || '';
const ehCommit = ferramenta === 'Bash' && /\bgit\s+commit\b/.test(dados.command || '');
if (!(EDICAO.has(ferramenta) || ehCommit)) process.exit(0);
if (arquivo.startsWith(CLAUDE_DIR)) process.exit(0);

// Lê a sessão: em que ordem as skills foram chamadas e onde está a última edição.
const skills = []; // [{ nome, pos }]
let ultimaEdicao = -1, pos = 0;
let linhas;
try { linhas = readFileSync(caminho, 'utf8').split('\n'); }
catch {
  process.stdout.write(JSON.stringify({ systemMessage: 'fluxo-guard: transcript ilegível, trava não aplicada.' }));
  process.exit(0);
}
for (const linha of linhas) {
  if (!linha) continue;
  let ev; try { ev = JSON.parse(linha); } catch { continue; }
  const conteudo = ev.message?.content;
  if (typeof conteudo === 'string') {
    for (const m of conteudo.matchAll(/<command-name>\/?([^<\s]+)<\/command-name>/g)) skills.push({ nome: m[1], pos: pos++ });
    continue;
  }
  if (!Array.isArray(conteudo)) continue;
  for (const b of conteudo) {
    if (b.type === 'text' && ev.type === 'user')
      for (const m of b.text.matchAll(/<command-name>\/?([^<\s]+)<\/command-name>/g)) skills.push({ nome: m[1], pos: pos++ });
    if (b.type !== 'tool_use') continue;
    if (b.name === 'Skill' && b.input?.skill) skills.push({ nome: b.input.skill, pos: pos++ });
    else if (EDICAO.has(b.name) && !String(b.input?.file_path || b.input?.notebook_path || '').startsWith(CLAUDE_DIR)) ultimaEdicao = pos++;
  }
}
const plugin = (s) => s.nome.split(':')[0];
const tem = (p) => skills.some((s) => plugin(s) === p || s.nome === p);

if (ehCommit) {
  const verif = Math.max(-1, ...skills.filter((s) => /verification-before-completion$/.test(s.nome)).map((s) => s.pos));
  if (verif < ultimaEdicao || verif < 0)
    negar('Fluxo luuspz: antes de commitar, chame a skill superpowers:verification-before-completion (depois da última edição) e rode a verificação que ela pede.');
  process.exit(0);
}

if (!tem('superpowers'))
  negar('Fluxo luuspz: nenhuma skill do superpowers foi chamada nesta sessão. Chame a que cabe (brainstorming para algo novo, systematic-debugging para defeito, writing-plans/executing-plans, test-driven-development) antes de editar.');

if (UI.test(arquivo) && !tem('impeccable') && !(tem('hallmark') && tem('ui-ux-pro-max')))
  negar('Fluxo luuspz: arquivo de interface. Chame impeccable (interface existente) ou hallmark + ui-ux-pro-max (página nova) antes de editar.');

process.exit(0);
