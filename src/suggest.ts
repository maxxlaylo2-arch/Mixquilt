// "Surprise me": a rule-based suggester for building blocks only (never melodies, lyrics or beats).
// Variety comes from explicit choices + a no-repeat memory + a wildness dial.
import type { Recipe, RecipeField } from './model';
import { GENRES, GENRE_TEMPO, GROOVES, KEYS, MODES, MOODS, PALETTES, PROGRESSIONS, STRUCTURES, TWISTS, modeById } from './theory';

const MEM_KEY = 'mq.suggestMemory';
type Memory = Partial<Record<RecipeField, string[]>>;
const loadMem = (): Memory => { try { return JSON.parse(localStorage.getItem(MEM_KEY) || '{}'); } catch { return {}; } };
const saveMem = (m: Memory) => localStorage.setItem(MEM_KEY, JSON.stringify(m));
export function remember(field: RecipeField, value: unknown) {
  const m = loadMem(); const v = JSON.stringify(value);
  m[field] = [v, ...(m[field] ?? []).filter((x) => x !== v)].slice(0, 6); saveMem(m);
}

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
function pickFresh<T>(field: RecipeField, options: T[], current: T): T {
  const recent = new Set(loadMem()[field] ?? []);
  recent.add(JSON.stringify(current));
  const fresh = options.filter((o) => !recent.has(JSON.stringify(o)));
  return rand(fresh.length ? fresh : options.filter((o) => JSON.stringify(o) !== JSON.stringify(current)).length ? options.filter((o) => JSON.stringify(o) !== JSON.stringify(current)) : options);
}

export type Wildness = 0 | 1 | 2; // Safe, Spicy, Wild

export function suggest(r: Recipe, locks: Partial<Record<RecipeField, boolean>>, wild: Wildness): Partial<Recipe> {
  const mood = MOODS.find((m) => m.id === r.mood);
  const out: Partial<Recipe> = {};
  const free = (f: RecipeField) => !locks[f];
  const widen = <T,>(narrow: T[], all: T[]) => (wild === 0 ? narrow : wild === 1 ? Array.from(new Set([...narrow, ...narrow, ...all.slice(0, Math.ceil(all.length / 2))])) : all);

  if (free('blend')) {
    const pool = widen(mood?.genres ?? GENRES, GENRES);
    const a = pickFresh('blend', pool, r.blend[0]);
    const bPool = (wild === 0 ? pool : GENRES).filter((g) => g !== a);
    out.blend = [a, rand(bPool)];
  }
  const blend = out.blend ?? r.blend;
  if (free('key')) out.key = pickFresh('key', KEYS, r.key);
  if (free('mode')) out.mode = pickFresh('mode', widen(mood?.modes ?? MODES.map((m) => m.id), MODES.map((m) => m.id)), r.mode);
  if (free('bpm')) {
    const [lo, hi] = GENRE_TEMPO[blend[0]] ?? mood?.bpm ?? [80, 130];
    const spread = wild === 2 ? 14 : wild === 1 ? 6 : 0;
    const lo2 = Math.max(50, lo - spread), hi2 = Math.min(190, hi + spread);
    let bpm = Math.round(lo2 + Math.random() * (hi2 - lo2));
    if (bpm === r.bpm) bpm += 2;
    out.bpm = bpm;
  }
  if (free('groove')) out.groove = pickFresh('groove', widen(mood?.grooves ?? GROOVES.map((g) => g.id), GROOVES.map((g) => g.id)), r.groove);
  if (free('progression')) {
    const mode = modeById(out.mode ?? r.mode);
    const tone = mode.bright > 0 ? 'bright' : mode.bright < 0 ? 'dark' : 'any';
    const fit = PROGRESSIONS.filter((p) => (p.tone === 'any' || p.tone === tone || tone === 'any') && (!mood || p.moods.includes(mood.id)));
    out.progression = pickFresh('progression', widen(fit.length ? fit.map((p) => p.id) : PROGRESSIONS.map((p) => p.id), PROGRESSIONS.map((p) => p.id)), r.progression);
  }
  if (free('structure')) out.structure = pickFresh('structure', STRUCTURES.map((s) => s.id), r.structure);
  if (free('palette')) out.palette = pickFresh('palette', widen(mood?.palettes ?? PALETTES.map((p) => p.id), PALETTES.map((p) => p.id)), r.palette);
  if (free('twist')) out.twist = pickFresh('twist', TWISTS.map((t) => t.id), r.twist);
  return out;
}
