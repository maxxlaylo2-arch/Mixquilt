import type { Chord, SectionType } from './theory';
import { STRUCTURES } from './theory';

export const DRUM_ROWS = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'clap', label: 'Clap' },
  { id: 'hat', label: 'Hi-hat' },
  { id: 'open', label: 'Open hat' },
  { id: 'perc', label: 'Perc' },
  { id: 'bass', label: 'Bass note' },
] as const;
export type DrumRow = (typeof DRUM_ROWS)[number]['id'];
/** 0 off, 1 hit, 2 soft (ghost), 3 roll (hats) */
export type StepVal = 0 | 1 | 2 | 3;
export type Pattern = Record<DrumRow, StepVal[]>;
export const STEPS = 16;

export interface Note { t: number; d: number; m: number; v: number } // beats, beats, midi, velocity 0..1

export type TrackId = 'drums' | 'bass' | 'chords' | 'melody' | 'vocals';
export const TRACKS: { id: TrackId; label: string }[] = [
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass' },
  { id: 'chords', label: 'Chords' },
  { id: 'melody', label: 'Melody' },
  { id: 'vocals', label: 'Vocals' },
];
export interface MixTrack { vol: number; mute: boolean; solo: boolean; inst?: string; tone?: number; drive?: number; character?: number }

export interface Section {
  id: string;
  type: SectionType;
  bars: number;
  layers: Record<TrackId, boolean>;
  beat: 'A' | 'B';
  part: string; // melody part key
  transpose: number;
}

export interface Recipe {
  mood: string;
  blend: [string, string];
  key: string;
  mode: string;
  bpm: number;
  groove: string;
  progression: string; // id or 'custom'
  structure: string;
  palette: string;
  twist: string;
}
export type RecipeField = keyof Recipe;

export interface Take {
  id: string;
  name: string;
  createdAt: string;
  start: number; // song seconds where the first sample lands (after latency compensation)
  duration: number;
  sampleRate: number;
  active: boolean;
  section?: string;
  /** Voice Polish settings (non-AI DSP). null = untouched raw take. The raw audio is never modified. */
  polish: null | { kind: 'pitch-timing'; settings: Record<string, number | string | boolean>; processedAudioKey?: string };
}

export interface LogEntry { ts: string; kind: string; text: string; count?: number; last?: string }
export interface Version { id: string; ts: string; label: string; hash: string; data: string }

export interface LyricBlock { key: string; text: string }

export interface Song {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  recipe: Recipe;
  locks: Partial<Record<RecipeField, boolean>>;
  chords: Chord[];
  chordStyle: 'sustain' | 'stabs' | 'offbeat' | 'halves' | 'arp';
  beats: { A: Pattern; B: Pattern };
  parts: Record<string, Note[]>; // melody parts, key = part name
  partBars: number;
  sections: Section[];
  mix: Record<TrackId, MixTrack> & { master: number; finish?: 'off' | 'stream' | 'chart' | 'club' };
  lyrics: LyricBlock[];
  takes: Take[];
  log: LogEntry[];
  versions: Version[];
  credits: { author: string };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const emptyPattern = (): Pattern => {
  const p = {} as Pattern;
  for (const r of DRUM_ROWS) p[r.id] = Array(STEPS).fill(0);
  return p;
};

export const defaultLayers = (type: SectionType): Record<TrackId, boolean> => ({
  drums: type !== 'Intro' && type !== 'Interlude',
  bass: type !== 'Intro' && type !== 'Interlude',
  chords: true,
  melody: type === 'Hook' || type === 'Post-hook' || type === 'Intro' || type === 'Outro',
  vocals: true,
});

export function makeSection(type: SectionType, bars: number): Section {
  return { id: uid(), type, bars, layers: defaultLayers(type), beat: type === 'Beat switch' ? 'B' : 'A', part: type, transpose: 0 };
}
export function sectionsFromStructure(structureId: string): Section[] {
  const s = STRUCTURES.find((x) => x.id === structureId) ?? STRUCTURES[0];
  return s.parts.map(([t, b]) => makeSection(t, b));
}

/** "Verse 1", "Verse 2", but one shared "Hook" etc. */
export function lyricKeys(sections: Section[]): string[] {
  let v = 0;
  return sections.map((s) => (s.type === 'Verse' ? `Verse ${++v}` : s.type));
}

/** Shift every recorded melody note by `semitones`, clamped to the MIDI range. */
export function transposeMelodyParts(parts: Record<string, Note[]>, semitones: number) {
  if (!semitones) return;
  for (const notes of Object.values(parts)) {
    for (const n of notes) n.m = Math.max(0, Math.min(127, n.m + semitones));
  }
}

/** Keep vocal takes locked to the same beat when tempo changes. `Take.start` is in seconds. */
export function rescaleTakeStarts(takes: Take[], fromBpm: number, toBpm: number) {
  if (!fromBpm || !toBpm || fromBpm === toBpm) return;
  const scale = fromBpm / toBpm;
  for (const t of takes) t.start *= scale;
}

export function newSong(title = 'Untitled song'): Song {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    mood: 'chill', blend: ['Lo-fi', 'Jazz'], key: 'E♭', mode: 'dorian', bpm: 90, groove: 'swung',
    progression: 'jazz-251', structure: 'classic', palette: 'dusty', twist: 'lift',
  };
  const sections = sectionsFromStructure(recipe.structure);
  const keys = Array.from(new Set(lyricKeys(sections)));
  return {
    id: uid(), title, createdAt: now, updatedAt: now, recipe, locks: {},
    chords: [{ deg: 1, seventh: true }, { deg: 4, seventh: true }, { deg: 0, seventh: true }, { deg: 0, seventh: true }],
    chordStyle: 'sustain',
    beats: { A: emptyPattern(), B: emptyPattern() },
    parts: {}, partBars: 4,
    sections,
    mix: {
      drums: { vol: 0.8, mute: false, solo: false, tone: 0.5, drive: 0.2, character: 0.5 },
      bass: { vol: 0.75, mute: false, solo: false, tone: 0.5, drive: 0.2, character: 0.5 },
      chords: { vol: 0.6, mute: false, solo: false, tone: 0.5, drive: 0.2, character: 0.5 },
      melody: { vol: 0.7, mute: false, solo: false, tone: 0.5, drive: 0.2, character: 0.5 },
      vocals: { vol: 0.9, mute: false, solo: false, tone: 0.5, drive: 0.2, character: 0.5 },
      master: 0.85,
    },
    lyrics: keys.map((k) => ({ key: k, text: '' })),
    takes: [], log: [{ ts: now, kind: 'create', text: `Song "${title}" created` }], versions: [],
    credits: { author: '' },
  };
}
