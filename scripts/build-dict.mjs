// Converts the CMU Pronouncing Dictionary (BSD-2-Clause, notice kept in public/licenses/) into a compact file.
// Each phone (with stress) is mapped to one printable character. First pronunciation only.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./cmudict.dict', import.meta.url), 'utf8');
const vowels = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'];
const cons = ['B','CH','D','DH','F','G','HH','JH','K','L','M','N','NG','P','R','S','SH','T','TH','V','W','Y','Z','ZH'];
const symbols = [];
for (const v of vowels) for (const s of ['0','1','2']) symbols.push(v + s);
symbols.push(...cons);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,-./:;<=>?@[]^_{|}~';
if (symbols.length > chars.length) throw new Error('too many symbols');
const map = new Map(symbols.map((s, i) => [s, chars[i]]));
// Commonness tiers from SCOWL word lists (Copyright Kevin Atkinson, permissive license; notice in public/licenses/SCOWL-COPYRIGHT.txt).
const tier = new Map();
for (const [lvl, t] of [[50, 3], [35, 2], [20, 1], [10, 1]]) {
  for (const w of fs.readFileSync(new URL(`./scowl/level-${lvl}.txt`, import.meta.url), 'utf8').split('\n')) if (w) tier.set(w, t);
}
const out = [];
const seen = new Set();
for (const line of src.split('\n')) {
  const clean = line.split('#')[0].trim();
  if (!clean) continue;
  const [w, ...ph] = clean.split(/\s+/);
  if (w.includes('(')) continue;
  if (!/^[a-z][a-z']*$/.test(w)) continue;
  if (seen.has(w)) continue;
  seen.add(w);
  out.push(w + ' ' + (tier.get(w) ?? 4) + ph.map((p) => { const c = map.get(p); if (!c) throw new Error('unknown ' + p); return c; }).join(''));
}
fs.mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../public/data/cmudict.txt', import.meta.url), out.join('\n'));
fs.writeFileSync(new URL('../src/lyrics/phoneMap.json', import.meta.url), JSON.stringify({ chars: chars.slice(0, symbols.length), symbols }));
console.log('words', out.length);
