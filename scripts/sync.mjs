// Lê a lista de Stars do GitHub e grava:
//   .claude-plugin/marketplace.json  plugins instaláveis (sem os descartados do catalog.json)
//   stars.json                       todos os repos da lista, para o README achar os ainda não validados
// Uso: node scripts/sync.mjs   (token: STARS_TOKEN, GITHUB_TOKEN ou `gh auth token`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OWNER = process.env.LIST_OWNER ?? 'catmaitachi';
const LIST = process.env.LIST_SLUG ?? 'skills';
const catalog = JSON.parse(readFileSync('catalog.json', 'utf8'));
const byRepo = new Map(catalog.items.map((i) => [i.repo.toLowerCase(), i]));

const token =
  process.env.STARS_TOKEN || process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token']).toString().trim();

const api = async (url, body) => {
  const res = await fetch(`https://api.github.com${url}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'skills-sync' },
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
  if (paths.includes('.claude-plugin/plugin.json')) return { kind: 'plugin', entry };

  const skills = paths
    .filter((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'))
    .map((p) => (p === 'SKILL.md' ? './' : `./${p.slice(0, -'/SKILL.md'.length)}`));
  if (!skills.length) return { kind: 'sem skills', entry: null };
  return { kind: 'skills soltas', entry: { ...entry, strict: false, skills: skills.sort() } };
}

const plugins = [];
const stars = [];
const taken = new Set();
for (const r of (await listRepos()).sort((a, b) => a.nameWithOwner.localeCompare(b.nameWithOwner))) {
  const { kind, entry } = await toEntry(r, taken).catch((err) => {
    console.warn(`! ${r.nameWithOwner}: ${err.message}`);
    return { kind: 'erro', entry: null };
  });
  stars.push({ repo: r.nameWithOwner, description: r.description ?? '', kind });
  const item = byRepo.get(r.nameWithOwner.toLowerCase());
  // Descartados e o que não é plugin (ex.: rtk, que vale como binário) ficam fora do marketplace.
  if (!entry || item?.level === 'descartado' || (item && item.type !== 'plugin')) continue;
  taken.add(entry.name);
  plugins.push(entry);
}

const write = (file, data) => {
  const json = JSON.stringify(data, null, 2) + '\n';
  let current = '';
  try { current = readFileSync(file, 'utf8'); } catch {}
  if (json === current) return console.log(`${file}: sem mudanças`);
  writeFileSync(file, json);
  console.log(`${file}: atualizado`);
};

mkdirSync('.claude-plugin', { recursive: true });
write('.claude-plugin/marketplace.json', {
  name: catalog.marketplace,
  owner: { name: OWNER },
  metadata: { description: `Plugins/skills da lista github.com/stars/${OWNER}/lists/${LIST} (gerado automaticamente)` },
  plugins,
});
write('stars.json', stars);
console.log(`${stars.length} repos na lista, ${plugins.length} no marketplace.`);
