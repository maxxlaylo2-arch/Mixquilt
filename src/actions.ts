import type { Recipe, RecipeField, Song } from './model';
import { lyricKeys, rescaleTakeStarts, sectionsFromStructure, transposeMelodyParts } from './model';
import { update } from './store';
import { remember } from './suggest';
import { GROOVES, KEYS, MODES, PALETTES, PROGRESSIONS, STRUCTURES, TWISTS, keySemitoneDelta, modeById } from './theory';

export function syncLyrics(s: Song) {
  for (const k of Array.from(new Set(lyricKeys(s.sections)))) if (!s.lyrics.find((l) => l.key === k)) s.lyrics.push({ key: k, text: '' });
}

export function describe(field: RecipeField, v: any): string {
  switch (field) {
    case 'blend': return `${v[0]} × ${v[1]}`;
    case 'mode': return `${modeById(v).name} (${modeById(v).feel})`;
    case 'bpm': return `${v} BPM`;
    case 'groove': return GROOVES.find((g) => g.id === v)?.label ?? v;
    case 'progression': return PROGRESSIONS.find((p) => p.id === v)?.label ?? 'Custom chords';
    case 'structure': return STRUCTURES.find((p) => p.id === v)?.label ?? 'Custom arrangement';
    case 'palette': return PALETTES.find((p) => p.id === v)?.label ?? v;
    case 'twist': return TWISTS.find((p) => p.id === v)?.label ?? v;
    case 'mood': return v;
    default: return String(v);
  }
}
export const FIELD_LABEL: Record<RecipeField, string> = {
  mood: 'Mood', blend: 'Genre blend', key: 'Key', mode: 'Mode', bpm: 'Tempo', groove: 'Groove', progression: 'Chord progression',
  structure: 'Song structure', palette: 'Sound palette', twist: 'Twist idea',
};

/** Apply a tempo change and rescale vocal take start times so they stay on the same beat. */
export function applyTempo(bpm: number, logText = 'Adjusted tempo') {
  update((s) => {
    const next = Math.min(190, Math.max(50, Math.round(bpm)));
    if (next === s.recipe.bpm) return;
    rescaleTakeStarts(s.takes, s.recipe.bpm, next);
    s.recipe.bpm = next;
  }, ['recipe', logText]);
}

/** Apply recipe choices. `how` records whether the user picked it or accepted a suggestion. */
export function applyRecipe(p: Partial<Recipe>, how: 'chose' | 'accepted suggestion') {
  update((s) => {
    const prevKey = s.recipe.key;
    const prevBpm = s.recipe.bpm;
    for (const [k, v] of Object.entries(p) as [RecipeField, any][]) {
      (s.recipe as any)[k] = v;
      remember(k, v);
      const verb = how === 'chose' ? 'Chose' : 'Accepted suggested';
      const entry = `${verb} ${FIELD_LABEL[k].toLowerCase()}: ${describe(k, v)}`;
      s.log.push({ ts: new Date().toISOString(), kind: 'recipe', text: entry });
      if (k === 'progression') {
        const prog = PROGRESSIONS.find((x) => x.id === v);
        if (prog) s.chords = prog.chords.map((c) => ({ ...c }));
      }
      if (k === 'structure') { s.sections = sectionsFromStructure(v); syncLyrics(s); }
      if (k === 'palette') { s.mix.drums.inst = undefined; s.mix.bass.inst = undefined; s.mix.chords.inst = undefined; s.mix.melody.inst = undefined; }
    }
    if (p.key && p.key !== prevKey) transposeMelodyParts(s.parts, keySemitoneDelta(prevKey, p.key));
    if (p.bpm != null && p.bpm !== prevBpm) rescaleTakeStarts(s.takes, prevBpm, s.recipe.bpm);
  });
}
export const allKeys = KEYS;
export const allModes = MODES;
