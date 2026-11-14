import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { zipSync } from 'fflate';
import type { Song, TrackId } from '../model';
import { TRACKS } from '../model';
import { Rig } from './rig';
import { attachScheduler } from './engine';
import { eventsForBeat, songBeats } from './compose';
import { loadTakeBuffer } from './takes';

const SR = 44100;

export function songSeconds(s: Song) {
  const spb = 60 / s.recipe.bpm;
  let end = songBeats(s) * spb;
  for (const t of s.takes) if (t.active) end = Math.max(end, t.start + t.duration);
  return end;
}

/** Offline render of the song. `only` = render just these tracks (stems). */
export async function renderSong(s: Song, only?: TrackId[]): Promise<AudioBuffer> {
  const dur = songSeconds(s) + 2.5;
  const t0 = performance.now();
  const buffers = new Map<string, AudioBuffer>();
  for (const t of s.takes.filter((x) => x.active)) { const b = await loadTakeBuffer(t, s); if (b) buffers.set(t.id, b); }
  const out = await Tone.Offline(async ({ transport }) => {
    const r = new Rig(s);
    await r.ready();
    r.applyMix(s, only);
    transport.bpm.value = s.recipe.bpm;
    for (const t of s.takes.filter((x) => x.active && (!only || only.includes('vocals')))) {
      const b = buffers.get(t.id); if (!b) continue;
      const p = new Tone.Player(new Tone.ToneAudioBuffer(b)).connect(r.vocalGate);
      if (t.start >= 0) p.sync().start(t.start); else p.sync().start(0, -t.start);
    }
    attachScheduler(transport as any, r, () => ({ kind: 'song' }), { live: false, song: s, only });
    transport.start(0);
  }, dur, 2, SR);
  console.info(`[mixquilt] rendered ${dur.toFixed(1)} s of audio${only ? ' (' + only.join(',') + ')' : ''} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  return out.get() as AudioBuffer;
}

export function encodeWav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate;
  const dataLen = len * ch * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, dataLen, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

export const safeName = (s: string) => (s.trim() || 'song').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'song';

export function hasContent(s: Song, id: TrackId): boolean {
  if (id === 'vocals') return s.takes.some((t) => t.active);
  if (id === 'melody') return Object.values(s.parts).some((p) => p.length > 0);
  if (id === 'chords') return s.chords.length > 0;
  const rows = id === 'bass' ? ['bass'] : ['kick', 'snare', 'clap', 'hat', 'open', 'perc'];
  return (['A', 'B'] as const).some((b) => rows.some((r) => (s.beats[b] as any)[r].some((x: number) => x)));
}

export async function exportStemsZip(s: Song, onProgress?: (msg: string) => void, signal?: AbortSignal): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const t of TRACKS) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    if (!hasContent(s, t.id)) continue;
    onProgress?.(`Rendering ${t.label}…`);
    const b = await renderSong(s, [t.id]);
    files[`${safeName(s.title)}-${t.id}.wav`] = new Uint8Array(await encodeWav(b).arrayBuffer());
  }
  files['README.txt'] = new TextEncoder().encode(`Stems for "${s.title}" made in Mixquilt. Each file starts at 0:00 and lines up with the others. ${s.recipe.bpm} BPM.\n`);
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

const DRUM_MIDI: Record<string, number> = { kick: 36, snare: 38, clap: 39, hat: 42, open: 46, perc: 37 };
export function exportMidi(s: Song): Blob {
  const midi = new Midi();
  midi.header.setTempo(s.recipe.bpm);
  midi.header.name = s.title;
  const spb = 60 / s.recipe.bpm;
  const tr: Record<string, any> = {};
  const mk = (id: string, name: string, channel: number, program?: number) => {
    const t = midi.addTrack(); t.name = name; t.channel = channel; if (program !== undefined) t.instrument.number = program; tr[id] = t;
  };
  mk('drum', 'Drums', 9); mk('bass', 'Bass', 0, 38); mk('chords', 'Chords', 1, 4); mk('melody', 'Melody', 2, 80);
  const total = songBeats(s);
  for (let b = 0; b < total; b++) {
    for (const ev of eventsForBeat(s, { kind: 'song' }, b).evs) {
      if (ev.kind === 'drum') tr.drum.addNote({ midi: DRUM_MIDI[ev.row] ?? 37, time: ev.t * spb, duration: 0.1, velocity: ev.v });
      else for (const n of ev.notes) tr[ev.kind].addNote({ midi: n, time: ev.t * spb, duration: Math.max(0.05, ev.d * spb), velocity: ev.v });
    }
  }
  midi.tracks = midi.tracks.filter((t) => t.notes.length > 0);
  return new Blob([midi.toArray() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
