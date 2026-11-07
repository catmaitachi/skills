// node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = fileURLToPath(new URL('./fluxo-guard.mjs', import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'guard-'));
const vazio = join(home, 'vazio.jsonl');
writeFileSync(vazio, '');

// Sessão vazia: nenhuma skill chamada, então só passa o que a trava isenta.
const editar = (file_path) => {
  const saida = execFileSync(process.execPath, [GUARD], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path }, transcript_path: vazio }),
    env: { ...process.env, HOME: home, USERPROFILE: home },
  }).toString();
  return saida.includes('"deny"');
};

test('arquivo em ~/.claude passa, no separador do sistema', () => {
  assert.equal(editar(join(home, '.claude', 'x.md')), false);
});

test('arquivo em ~/.claude passa, com barra normal', () => {
  assert.equal(editar(join(home, '.claude', 'x.md').replaceAll('\\', '/')), false);
});

test('arquivo fora de ~/.claude é negado sem skill', () => {
  assert.equal(editar(join(home, 'projeto', 'x.md')), true);
});
