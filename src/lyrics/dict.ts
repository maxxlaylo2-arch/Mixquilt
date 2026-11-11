// Rhymes and syllables from the CMU Pronouncing Dictionary (BSD-2-Clause; notice in /licenses/CMUDICT-LICENSE.txt).
// Plain dictionary lookups, no AI.
import map from './phoneMap.json';

const decode = new Map<string, string>();
map.chars.split('').forEach((c: string, i: number) => decode.set(c, map.symbols[i]));
const isVowel = (sym: string) => /\d$/.test(sym);

let words: Map<string, string[]> | null = null;
const tiers = new Map<string, number>();
let rhymeIdx: Map<string, string[]> | null = null;
let vowelIdx: Map<string, string[]> | null = null;
let loading: Promise<void> | null = null;
export const dictReady = () => words !== null;

export function loadDict(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch(new URL('data/cmudict.txt', document.baseURI).href);
    const txt = await res.text();
    const w = new Map<string, string[]>();
    const ri = new Map<string, string[]>();
    const vi = new Map<string, string[]>();
    for (const line of txt.split('\n')) {
      const sp = line.indexOf(' ');
      if (sp < 0) continue;
      const word = line.slice(0, sp);
      tiers.set(word, Number(line[sp + 1]) || 4);
      const phones = Array.from(line.slice(sp + 2)).map((c) => decode.get(c)!);
      w.set(word, phones);
      const rk = rhymeKey(phones);
      if (rk) { push(ri, rk, word); push(vi, vowelKey(phones), word); }
    }
    words = w; rhymeIdx = ri; vowelIdx = vi;
  })();
  return loading;
}
const push = (m: Map<string, string[]>, k: string, v: string) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };

function rhymeStart(ph: string[]): number {
  let idx = -1;
  for (let i = ph.length - 1; i >= 0; i--) if (ph[i].endsWith('1')) { idx = i; break; }
  if (idx < 0) for (let i = ph.length - 1; i >= 0; i--) if (ph[i].endsWith('2')) { idx = i; break; }
  if (idx < 0) for (let i = ph.length - 1; i >= 0; i--) if (isVowel(ph[i])) { idx = i; break; }
  return idx;
}
function rhymeKey(ph: string[]): string {
  const i = rhymeStart(ph);
  return i < 0 ? '' : ph.slice(i).map((p) => p.replace(/\d/, '')).join(' ');
}
function vowelKey(ph: string[]): string {
  const i = rhymeStart(ph);
  return i < 0 ? '' : ph.slice(i).filter(isVowel).map((p) => p.replace(/\d/, '')).join(' ');
}

const clean = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');

export function syllables(word: string): number {
  const w = clean(word);
  if (!w) return 0;
  const ph = words?.get(w);
  if (ph) return ph.filter(isVowel).length;
  // fallback guess for words not in the dictionary
  const m = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
}
export const lineSyllables = (line: string) => line.split(/\s+/).reduce((a, w) => a + syllables(w), 0);
export const knownWord = (w: string) => !!words?.has(clean(w));

export interface RhymeResult { perfect: string[]; near: string[]; known: boolean; hiddenRare: number }
/** 1 = very common … 4 = rare word or name (SCOWL levels). */
export const commonness = (w: string) => tiers.get(w) ?? 4;
export function findRhymes(word: string, max = 80, includeRare = false): RhymeResult {
  const w = clean(word);
  const ph = words?.get(w);
  if (!ph || !rhymeIdx || !vowelIdx) return { perfect: [], near: [], known: false, hiddenRare: 0 };
  const rk = rhymeKey(ph);
  const bySyl = (a: string, b: string) => commonness(a) - commonness(b) || syllables(a) - syllables(b) || a.length - b.length || a.localeCompare(b);
  let hiddenRare = 0;
  const good = (x: string) => {
    if (x === w || x.includes("'") || x.length < 2 || (x.endsWith(w) && x.length - w.length <= 2)) return false;
    if (!includeRare && commonness(x) > 3) { hiddenRare++; return false; }
    return true;
  };
  const perfect = (rhymeIdx.get(rk) ?? []).filter(good).sort(bySyl).slice(0, max);
  const pset = new Set(perfect);
  const near = (vowelIdx.get(vowelKey(ph)) ?? []).filter((x) => good(x) && !pset.has(x) && rhymeKey(words!.get(x)!) !== rk).sort(bySyl).slice(0, max);
  return { perfect, near, known: true, hiddenRare };
}

/** True when two words share the same rhyme sound (or, if unknown, the same last 3 letters). */
export function sameRhyme(a: string, b: string): boolean {
  const x = clean(a), y = clean(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const px = words?.get(x), py = words?.get(y);
  if (px && py) return rhymeKey(px) === rhymeKey(py);
  return x.slice(-3) === y.slice(-3);
}
