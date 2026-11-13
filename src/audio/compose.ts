// Turns the user's song data into timed note events. Pure functions: this only plays back
// what the user placed (grid steps, chosen chords, recorded notes). It never invents notes.
import type { Section, Song, StepVal } from '../model';
import { DRUM_ROWS, STEPS } from '../model';
import { chordMidis, degreeToMidi, grooveById } from '../theory';
import { TAKE_PREROLL_SEC, takeLookupTime } from './takeTiming';
export { TAKE_PREROLL_SEC, TAKE_SECTION_SLOP_SEC, takeLookupTime, trimTakeToSection, trimTakeToSectionFloor } from './takeTiming';

export type Ev =
  | { kind: 'drum'; row: string; t: number; v: number }
  | { kind: 'bass' | 'chords' | 'melody'; notes: number[]; t: number; d: number; v: number };

export type PlayMode =
  | { kind: 'song' }
  | { kind: 'loop'; beat: 'A' | 'B'; part: string; bars: number; layers?: Partial<Record<string, boolean>> };

export const songBeats = (s: Song) => s.sections.reduce((a, x) => a + x.bars * 4, 0);
export const secPerBeat = (s: Song) => 60 / s.recipe.bpm;
export function sectionStartBeat(s: Song, idx: number) { let b = 0; for (let i = 0; i < idx; i++) b += s.sections[i].bars * 4; return b; }
export function sectionAtBeat(s: Song, beat: number): { section: Section; index: number; start: number } | null {
  let b = 0;
  for (let i = 0; i < s.sections.length; i++) {
    const len = s.sections[i].bars * 4;
    if (beat < b + len) return { section: s.sections[i], index: i, start: b };
    b += len;
  }
  return null;
}

/** Transpose (semitones) of the section a vocal take sits in.
 *  Takes recorded with “Start at <section>” can be saved up to TAKE_PREROLL_SEC
 *  before the section, so we look up by time after ignoring that pre-roll,
 *  plus a small slop so a floor-rounded sample trim still lands in the section.
 *  Matching is by section time range (index), never by repeated names like Hook/Hook. */
export function takeSectionTranspose(t: { start: number; section?: string }, s: Song): number {
  const beat = takeLookupTime(t.start) / secPerBeat(s);
  const at = sectionAtBeat(s, beat);
  if (at) return at.section.transpose || 0;
  if (s.sections.length) return s.sections[s.sections.length - 1].transpose || 0;
  return 0;
}

function loopSection(m: Extract<PlayMode, { kind: 'loop' }>): Section {
  return {
    id: 'loop', type: 'Verse', bars: m.bars, beat: m.beat, part: m.part, transpose: 0,
    layers: { drums: true, bass: true, chords: true, melody: true, vocals: false, ...(m.layers as any) },
  };
}

/** Events that start inside [beat, beat+1) in absolute beats. */
export function eventsForBeat(s: Song, mode: PlayMode, beat: number): { evs: Ev[]; section: Section | null } {
  let section: Section | null; let secStart: number;
  if (mode.kind === 'song') {
    const at = sectionAtBeat(s, beat);
    if (!at) return { evs: [], section: null };
    section = at.section; secStart = at.start;
  } else {
    section = loopSection(mode);
    const len = mode.bars * 4;
    secStart = Math.floor(beat / len) * len;
  }
  const evs: Ev[] = [];
  const inSec = beat - secStart; // beat index within section
  const bar = Math.floor(inSec / 4);
  const beatInBar = inSec % 4;
  const swing = grooveById(s.recipe.groove).swing;
  const tr = section.transpose || 0;
  const { key, mode: modeId } = s.recipe;
  const chord = s.chords.length ? s.chords[bar % s.chords.length] : null;
  const pat = s.beats[section.beat];
  const stepTime = (step: number) => { const k = step % 4; return beat + k * 0.25 + (k % 2 === 1 ? (swing - 0.5) * 0.5 : 0); };

  if (section.layers.drums) {
    for (const r of DRUM_ROWS) {
      if (r.id === 'bass') continue;
      for (let k = 0; k < 4; k++) {
        const step = beatInBar * 4 + k;
        const v: StepVal = pat[r.id][step] ?? 0;
        if (!v) continue;
        const t = stepTime(step);
        if (v === 3) for (let j = 0; j < 3; j++) evs.push({ kind: 'drum', row: r.id, t: t + j / 12, v: j === 0 ? 0.85 : 0.55 });
        else evs.push({ kind: 'drum', row: r.id, t, v: v === 2 ? 0.35 : 0.9 });
      }
    }
  }
  if (section.layers.bass && chord) {
    const row = pat.bass;
    const root = degreeToMidi(key, modeId, chord.deg, 36) + tr;
    const rootN = root > 47 ? root - 12 : root;
    for (let k = 0; k < 4; k++) {
      const step = beatInBar * 4 + k;
      const v = row[step];
      if (!v) continue;
      let gap = 1;
      while (gap < STEPS && !row[(step + gap) % STEPS]) gap++;
      const d = Math.min(Math.max(gap * 0.25, 0.25), 2) * 0.95;
      evs.push({ kind: 'bass', notes: [rootN], t: stepTime(step), d, v: v === 2 ? 0.45 : 0.9 });
    }
  }
  if (section.layers.chords && chord) {
    let notes = chordMidis(key, modeId, chord, 48).map((n) => n + tr);
    while (notes[0] > 57) notes = notes.map((n) => n - 12);
    const st = s.chordStyle;
    if (st === 'sustain' && beatInBar === 0) evs.push({ kind: 'chords', notes, t: beat, d: 3.9, v: 0.6 });
    if (st === 'halves' && beatInBar % 2 === 0) evs.push({ kind: 'chords', notes, t: beat, d: 1.85, v: 0.6 });
    if (st === 'stabs') evs.push({ kind: 'chords', notes, t: beat, d: 0.4, v: beatInBar === 0 ? 0.7 : 0.55 });
    if (st === 'offbeat') evs.push({ kind: 'chords', notes, t: beat + 0.5 + (swing - 0.5), d: 0.3, v: 0.6 });
    if (st === 'arp') {
      const seq = [notes[0], notes[1], notes[2], notes[notes.length - 1] + (notes.length > 3 ? 0 : 12)];
      for (let k = 0; k < 2; k++) {
        const i = (beatInBar * 2 + k) % seq.length;
        evs.push({ kind: 'chords', notes: [seq[i]], t: beat + k * 0.5 + (k === 1 ? (swing - 0.5) : 0), d: 0.45, v: 0.55 });
      }
    }
  }
  if (section.layers.melody) {
    const notes = s.parts[section.part] ?? [];
    const clip = s.partBars * 4;
    const pos = inSec % clip;
    const base = beat - pos;
    for (const n of notes) {
      if (n.t >= pos && n.t < pos + 1) evs.push({ kind: 'melody', notes: [n.m + tr], t: base + n.t, d: n.d, v: n.v });
    }
  }
  return { evs, section };
}
