// Builds THIRD-PARTY-NOTICES.txt (repo root + public/licenses/) from every package that ships in the
// app bundle or service worker, with each package's full license text, plus the bundled data notices.
// Fails the build if a copyleft, non-commercial or unknown license shows up.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = /^(MIT|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|Zlib|CC0-1\.0|Unlicense|BlueOak-1\.0\.0)$/;
// Packages compiled into the service worker / registration code by vite-plugin-pwa (dev deps that still ship).
const SHIPPED_DEV = ['workbox-window', 'workbox-core', 'workbox-precaching', 'workbox-routing', 'workbox-strategies'];

const tree = JSON.parse(execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const pkgs = new Map();
const walk = (deps) => { for (const [name, d] of Object.entries(deps || {})) { if (!d.version || pkgs.has(name + '@' + d.version)) continue; pkgs.set(name + '@' + d.version, name); walk(d.dependencies); } };
walk(tree.dependencies);
const addTree = (name) => { const pj = JSON.parse(readFileSync(join('node_modules', name, 'package.json'), 'utf8')); if (!pkgs.has(name + '@' + pj.version)) { pkgs.set(name + '@' + pj.version, name); for (const dep of Object.keys(pj.dependencies || {})) if (existsSync(join('node_modules', dep))) addTree(dep); } };
SHIPPED_DEV.forEach(addTree);

const pickLicense = (expr) => {
  // For dual "A OR B" licenses, record the permissive option we elect.
  const parts = String(expr).replace(/[()]/g, '').split(/\s+OR\s+/i).map((x) => x.trim());
  const ok = parts.find((p) => p.split(/\s+AND\s+/i).every((q) => ALLOWED.test(q)));
  return ok ? (parts.length > 1 ? `${ok} (elected from ${expr})` : ok) : null;
};

const problems = [];
const entries = [...pkgs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, name]) => {
  const dir = join('node_modules', name);
  const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const lic = typeof pj.license === 'string' ? pj.license : pj.license?.type || (pj.licenses || []).map((l) => l.type).join(' OR ') || 'UNKNOWN';
  const elected = pickLicense(lic);
  if (!elected) problems.push(`${id}: ${lic}`);
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f));
  const text = files.map((f) => readFileSync(join(dir, f), 'utf8').trim()).join('\n\n') || `(No license file in the package; package.json declares ${lic}.)`;
  const repo = typeof pj.repository === 'string' ? pj.repository : pj.repository?.url || pj.homepage || '';
  return { id, lic: elected || lic, repo: repo.replace(/^git\+/, ''), text };
});
if (problems.length) { console.error('Disallowed or unknown licenses:\n' + problems.join('\n')); process.exit(1); }

const read = (p) => readFileSync(p, 'utf8').trim();
const bar = '='.repeat(78);
let out = `MIXQUILT: THIRD-PARTY NOTICES

Mixquilt is Copyright (c) 2026 Stephen Curran III. All rights reserved (see LICENSE).
The app includes the third-party software and data listed below. Each component is used
under its own license, reproduced in full here. None of them is copyleft (GPL/LGPL/AGPL),
non-commercial, or of unknown license.

Contents
  1. Data: CMU Pronouncing Dictionary (rhymes and syllables)
  2. Data: SCOWL word lists (word commonness ranking)
  3. Software packages bundled in the app (${entries.length})

Sounds, icons and fonts: all instrument sounds are synthesized in the app at runtime
(no samples or loops are included). The app icons are original artwork made for Mixquilt.
The app uses the device's built-in system fonts and bundles no font files.

${bar}
1. CMU Pronouncing Dictionary
   Source: http://www.speech.cs.cmu.edu/cgi-bin/cmudict (github.com/cmusphinx/cmudict)
   License: BSD-2-Clause
${bar}
${read('public/licenses/CMUDICT-LICENSE.txt')}

${bar}
2. SCOWL (Spell Checker Oriented Word Lists)
   Source: http://wordlist.aspell.net/
   License: permissive (MIT-like), as below
${bar}
${read('public/licenses/SCOWL-COPYRIGHT.txt')}

${bar}
3. Software packages
${bar}
`;
for (const e of entries) out += `\n${'-'.repeat(78)}\n${e.id}\nLicense: ${e.lic}${e.repo ? `\nSource: ${e.repo}` : ''}\n${'-'.repeat(78)}\n${e.text}\n`;
writeFileSync('THIRD-PARTY-NOTICES.txt', out);
writeFileSync('public/licenses/THIRD-PARTY-NOTICES.txt', out);
console.log(`notices: ${entries.length} packages, all permissive -> THIRD-PARTY-NOTICES.txt`);
