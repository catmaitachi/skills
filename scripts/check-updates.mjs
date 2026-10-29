#!/usr/bin/env node
// Verifica atualizações do fluxo: plugins ligados, binário do RTK, regras do CLAUDE.md e este próprio script.
// Feito para o hook SessionStart do Claude Code: silencioso quando não há nada (zero tokens),
// roda no máximo 1x por dia. `--force` ignora o limite. Só lê; nunca atualiza nada.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'catmaitachi/skills';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const MKT = 'nice-skills';
const OWNER = 'luuspz';
const DAY = 24 * 60 * 60 * 1000;

const run = promisify(execFile);
const claude = join(homedir(), '.claude');
const stateFile = join(claude, OWNER, 'state.json');
const json = (f, fallback) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fallback; } };
const text = (f) => { try { return readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };

const state = json(stateFile, {});
if (!process.argv.includes('--force') && Date.now() - (state.lastCheck ?? 0) < DAY) process.exit(0);

const remoteHead = async (repo) =>
  (await run('git', ['ls-remote', `https://github.com/${repo}`, 'HEAD'], { timeout: 15000 })).stdout.split(/\s/)[0];
const raw = async (path) => {
  const res = await fetch(`${RAW}/${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.text()).replace(/\r\n/g, '\n');
};
const semver = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

const found = [];
const checks = [];

// Plugins ligados deste marketplace: commit instalado x HEAD do repo.
const installed = json(join(claude, 'plugins', 'installed_plugins.json'), { plugins: {} }).plugins;
const enabled = json(join(claude, 'settings.json'), {}).enabledPlugins ?? {};
const location = json(join(claude, 'plugins', 'known_marketplaces.json'), {})[MKT]?.installLocation ?? '';
const manifest = json(join(location, '.claude-plugin', 'marketplace.json'), { plugins: [] });
for (const [id, [record]] of Object.entries(installed)) {
  if (!id.endsWith(`@${MKT}`) || !enabled[id] || !record?.gitCommitSha) continue;
  const repo = manifest.plugins.find((p) => p.name === id.split('@')[0])?.source?.repo;
  if (!repo) continue;
  checks.push(
    remoteHead(repo).then((sha) => {
      if (sha && sha !== record.gitCommitSha) found.push(`- plugin \`${id}\`: há versão nova em ${repo}`);
    }),
  );
}

// Binário do RTK: versão local x maior tag vX.Y.Z do repo.
checks.push(
  (async () => {
    let local;
    try {
      local = (await run('rtk', ['--version'], { timeout: 5000 })).stdout.match(/\d+\.\d+\.\d+/)?.[0];
    } catch {
      return; // RTK não instalado: nada a comparar
    }
    const { stdout } = await run('git', ['ls-remote', '--tags', '--refs', 'https://github.com/rtk-ai/rtk'], { timeout: 15000 });
    const latest = [...stdout.matchAll(/refs\/tags\/v(\d+\.\d+\.\d+)$/gm)].map((m) => m[1]).sort(semver).at(-1);
    if (local && latest && semver(latest, local) > 0) found.push(`- RTK: ${local} → ${latest}`);
  })(),
);

// Regras do fluxo: bloco do CLAUDE.md x claude-rules.md publicado.
checks.push(
  raw('claude-rules.md').then((rules) => {
    const block = text(join(claude, 'CLAUDE.md')).match(new RegExp(`<!-- ${OWNER}:start -->[\\s\\S]*?<!-- ${OWNER}:end -->`));
    if (block?.[0].trim() !== rules.trim()) found.push('- fluxo: as regras publicadas mudaram e o bloco do CLAUDE.md está desatualizado');
  }),
);

// Este script x versão publicada.
checks.push(
  raw('scripts/check-updates.mjs').then((latest) => {
    if (latest !== text(fileURLToPath(import.meta.url))) found.push('- verificador: `check-updates.mjs` tem versão nova');
  }),
);

const results = await Promise.allSettled(checks);
if (results.every((r) => r.status === 'rejected')) process.exit(0); // sem rede: tenta na próxima sessão

mkdirSync(join(claude, OWNER), { recursive: true });
writeFileSync(stateFile, JSON.stringify({ lastCheck: Date.now() }) + '\n');

if (found.length) {
  console.log(
    [
      `Atualizações disponíveis no fluxo ${OWNER}:`,
      ...found.sort(),
      '',
      'Pergunte ao usuário uma vez, em uma frase, se ele quer atualizar. Não atualize nada sem o ok dele.',
      `Como atualizar: plugins → \`claude plugin marketplace update ${MKT}\` e \`claude plugin update <id>\` (exige reiniciar); ` +
        'RTK → `winget upgrade rtk-ai.rtk` (Windows) ou `brew upgrade rtk`; ' +
        `fluxo e verificador → rodar de novo o prompt de setup do README de https://github.com/${REPO}.`,
    ].join('\n'),
  );
}
