// Regression test for notice generation against npm's physical clean-install tree.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputs = [
  join(root, 'THIRD-PARTY-NOTICES.txt'),
  join(root, 'public/licenses/THIRD-PARTY-NOTICES.txt'),
];
const originals = outputs.map((file) => readFileSync(file));

try {
  const result = spawnSync(process.execPath, ['scripts/gen-notices.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const notice = readFileSync(outputs[0], 'utf8');
  assert.equal(notice, readFileSync(outputs[1], 'utf8'));
  assert.match(notice, /\ntone@/);
  assert.match(notice, /\nworkbox-window@/);
  assert.doesNotMatch(notice, /@img\/sharp-wasm32|@emnapi\/runtime/);
  console.log('PASS notices include shipped dependencies and exclude npm extraneous subtrees');
} finally {
  outputs.forEach((file, index) => writeFileSync(file, originals[index]));
}
