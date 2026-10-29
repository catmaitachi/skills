// Gera .claude-plugin/marketplace.json a partir de uma lista de Stars do GitHub.
// Uso: node scripts/sync.mjs   (token: STARS_TOKEN, GITHUB_TOKEN ou `gh auth token`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OWNER = process.env.LIST_OWNER ?? 'catmaitachi';
const LIST = process.env.LIST_SLUG ?? 'skills';
const NAME = 'nice-skills'; // ID do marketplace: os plugins instalados são <plugin>@nice-skills
const OUT = '.claude-plugin/marketplace.json';

const token =
  process.env.STARS_TOKEN || process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token']).toString().trim();

const api = async (url, body) => {
  const res = await fetch(`https://api.github.com${url}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'skills-marketplace-sync' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    lists(first: 100) { nodes { slug name items(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ... on Repository { nameWithOwner description defaultBranchRef { name } } }
    } } }
  }
}`;

// Lê todos os repos da lista (paginando os itens).
async function listRepos() {
  const repos = [];
  let after = null;
  for (;;) {
    const { data, errors } = await api('/graphql', { query: QUERY, variables: { login: OWNER, after } });
    if (errors) throw new Error(JSON.stringify(errors));
    const list = data.user.lists.nodes.find((l) => l.slug === LIST);
    if (!list) throw new Error(`Lista "${LIST}" não encontrada em ${OWNER} (privada? token sem acesso?)`);
    repos.push(...list.items.nodes.filter((r) => r.nameWithOwner));
    if (!list.items.pageInfo.hasNextPage) return repos;
    after = list.items.pageInfo.endCursor;
  }
}

// Plugin válido (plugin.json) entra como está; repo só com SKILL.md vira plugin sintético (strict:false).
async function toEntry(r, taken) {
  const branch = r.defaultBranchRef?.name ?? 'HEAD';
  const { tree } = await api(`/repos/${r.nameWithOwner}/git/trees/${branch}?recursive=1`);
  const paths = tree.map((t) => t.path);
  const [owner, repo] = r.nameWithOwner.split('/');
  const name = taken.has(repo) ? `${owner}-${repo}` : repo;
  const entry = {
    name,
    source: { source: 'github', repo: r.nameWithOwner },
    ...(r.description && { description: r.description }),
  };
  if (paths.includes('.claude-plugin/plugin.json')) return entry;

  const skills = paths
    .filter((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'))
    .map((p) => (p === 'SKILL.md' ? './' : `./${p.slice(0, -'/SKILL.md'.length)}`));
  if (!skills.length) return null;
  return { ...entry, strict: false, skills: skills.sort() };
}

const entries = [];
const taken = new Set();
for (const r of (await listRepos()).sort((a, b) => a.nameWithOwner.localeCompare(b.nameWithOwner))) {
  const e = await toEntry(r, taken).catch((err) => (console.warn(`! ${r.nameWithOwner}: ${err.message}`), null));
  if (!e) {
    console.warn(`- ${r.nameWithOwner}: sem plugin.json nem SKILL.md, ignorado`);
    continue;
  }
  taken.add(e.name);
  entries.push(e);
}

const json =
  JSON.stringify(
    {
      name: NAME,
      owner: { name: OWNER },
      metadata: { description: `Plugins/skills da lista github.com/stars/${OWNER}/lists/${LIST} (gerado automaticamente)` },
      plugins: entries,
    },
    null,
    2,
  ) + '\n';

let current = '';
try { current = readFileSync(OUT, 'utf8'); } catch {}
if (json === current) {
  console.log(`Sem mudanças (${entries.length} plugins).`);
} else {
  mkdirSync('.claude-plugin', { recursive: true });
  writeFileSync(OUT, json);
  console.log(`${OUT} atualizado (${entries.length} plugins).`);
}
