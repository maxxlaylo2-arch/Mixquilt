import * as Tone from 'tone';
import type { Song, Take } from '../model';
import { getSong } from '../store';
import { Rig, rigSignature } from './rig';
import { eventsForBeat, songBeats, type Ev, type PlayMode } from './compose';
import { loadTakeBuffer } from './takes';
import { degreeToMidi } from '../theory';

let native: AudioContext | null = null;
let rig: Rig | null = null;
let repeatId: number | null = null;
let players: Tone.Player[] = [];
let mode: PlayMode = { kind: 'song' };
let playing = false;
let startedAt = 0, startOffset = 0;
const listeners = new Set<() => void>();
export const settings = { metronome: false, countIn: true };
export const isPlaying = () => playing;
export const currentMode = () => mode;
export const onEngine = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => listeners.forEach((l) => l());

export function nativeContext(): AudioContext {
  if (!native) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    native = new AC({ latencyHint: 'interactive' });
    Tone.setContext(new Tone.Context({ context: native, lookAhead: 0.06 } as any));
  }
  return native;
}

/** Must be called from a user gesture the first time (browser autoplay rules). */
export async function ensureAudio(song: Song = getSong()): Promise<Rig> {
  nativeContext();
  await Tone.start();
  if (rig && rig.signature !== rigSignature(song) && !playing) { rig.dispose(); rig = null; }
  if (!rig) { rig = new Rig(song); await rig.ready(); }
  return rig;
}
export function refreshMix() { const s = getSong(); rig?.applyMix(s); }
export async function refreshInstruments() { if (!playing) await ensureAudio(); }

export function playEvent(r: Rig, ev: Ev, time: number, spb: number) {
  if (ev.kind === 'drum') r.kit.hit(ev.row, time, ev.v);
  else if (ev.kind === 'bass') r.bass.trigger(ev.notes, ev.d * spb, time, ev.v);
  else if (ev.kind === 'chords') r.chords.trigger(ev.notes, ev.d * spb, time, ev.v);
  else r.lead.trigger(ev.notes, Math.max(0.05, ev.d * spb), time, ev.v);
}

/** Schedules the beat-by-beat player on a transport. Reads the live song each beat, so edits are heard right away. */
export function attachScheduler(transport: ReturnType<typeof Tone.getTransport>, r: Rig, getMode: () => PlayMode, opts: { live: boolean; onEnd?: () => void; song?: Song; only?: string[] }) {
  return transport.scheduleRepeat((time) => {
    const s = opts.song ?? getSong();
    const spb = 60 / s.recipe.bpm;
    const beat = Math.round(transport.getTicksAtTime(time) / transport.PPQ);
    const m = getMode();
    if (m.kind === 'song' && beat >= songBeats(s)) { opts.onEnd?.(); return; }
    const { evs, section } = eventsForBeat(s, m, beat);
    if (section) r.vocalGate.gain.setValueAtTime(section.layers.vocals ? 1 : 0, time);
    for (const ev of evs.sort((a, b) => a.t - b.t)) {
      if (opts.only && !opts.only.includes(ev.kind === 'drum' ? 'drums' : ev.kind)) continue;
      playEvent(r, ev, time + (ev.t - beat) * spb, spb);
    }
    if (opts.live && settings.metronome) r.tick(time, beat % 4 === 0);
  }, '4n', 0);
}

async function buildVocalPlayers(s: Song, r: Rig) {
  players.forEach((p) => p.dispose());
  players = [];
  for (const t of s.takes.filter((x) => x.active)) {
    const buf = await loadTakeBuffer(t, s);
    if (!buf) continue;
    const p = new Tone.Player(new Tone.ToneAudioBuffer(buf)).connect(r.vocalGate);
    if (t.start >= 0) p.sync().start(t.start); else p.sync().start(0, -t.start);
    players.push(p);
  }
}

export interface StartOpts { fromBeat?: number; countInBeats?: number; onStarted?: (ctxTime: number, songSec: number) => void }

export async function play(m: PlayMode, o: StartOpts = {}) {
  const s = getSong();
  await stop();
  const r = await ensureAudio(s);
  r.applyMix(s);
  mode = m;
  const tr = Tone.getTransport();
  tr.cancel(0);
  tr.bpm.value = s.recipe.bpm;
  tr.position = 0;
  if (m.kind === 'song') await buildVocalPlayers(s, r);
  repeatId = attachScheduler(tr, r, () => mode, { live: true, onEnd: () => { Tone.getDraw().schedule(() => stop(), Tone.now()); } });
  const spb = 60 / s.recipe.bpm;
  const startBeat = o.fromBeat ?? 0;
  const now = Tone.now() + 0.05;
  const ci = o.countInBeats ?? 0;
  for (let i = 0; i < ci; i++) r.tick(now + i * spb, i % 4 === 0);
  const startAt = now + ci * spb;
  // start offset must line up with whole beats so the per-beat scheduler hits beat boundaries
  tr.start(startAt, startBeat * spb);
  startedAt = startAt; startOffset = startBeat * spb;
  playing = true;
  o.onStarted?.(startAt, startBeat * spb);
  emit();
}

export async function stop() {
  const tr = Tone.getTransport();
  if (repeatId !== null) { tr.clear(repeatId); repeatId = null; }
  if (playing) { tr.stop(); tr.cancel(0); }
  players.forEach((p) => { p.unsync(); p.stop(); p.dispose(); });
  players = [];
  if (playing) { playing = false; emit(); }
}

/** Current song position in beats, as the listener hears it (output latency removed). */
export function heardBeat(): number {
  if (!playing || !native) return 0;
  const tr = Tone.getTransport();
  const lat = (native.outputLatency || 0) + (native.baseLatency || 0);
  const t = native.currentTime - lat;
  const spb = 60 / getSong().recipe.bpm;
  if (t < startedAt) return Math.max(0, startOffset / spb);
  let sec: number;
  try { sec = tr.getSecondsAtTime(t); } catch { sec = startOffset + (t - startedAt); }
  return Math.max(0, sec / spb);
}

/** Play a note right now (pads, keyboard, MIDI). */
export async function liveNote(midis: number[], durSec = 0.4, vel = 0.85, target: 'lead' | 'chords' = 'lead') {
  const r = await ensureAudio();
  const t = native!.currentTime + 0.005;
  (target === 'lead' ? r.lead : r.chords).trigger(midis, durSec, t, vel);
}
/** Hold a lead note (pads, keyboard, MIDI). */
export async function noteOn(m: number, vel = 0.85) { const r = await ensureAudio(); r.lead.attack?.(m, native!.currentTime + 0.003, vel); }
export function noteOff(m: number) { if (rig && native) rig.lead.release?.(m, native.currentTime + 0.01); }
export function allNotesOff() { rig?.lead.releaseAll?.(); }

export async function liveDrum(row: string) {
  const r = await ensureAudio();
  const t = native!.currentTime + 0.005;
  if (row === 'bass') { const s = getSong(); r.bass.trigger([degreeToMidi(s.recipe.key, s.recipe.mode, 0, 36)], 0.3, t, 0.9); } else r.kit.hit(row, t, 0.9);
}
export function previewTake(_t: Take) { /* handled in takes.ts */ }
export const getRig = () => rig;
