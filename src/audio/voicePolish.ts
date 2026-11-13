// VOICE POLISH: non-destructive pitch + timing touch-up and a "sit in the mix" chain for vocal takes.
// Classic DSP only (YIN pitch detection, TD-PSOLA pitch shifting, onset-based timing, filters,
// compressor, simple echo/reverb). No AI or machine learning. The raw take is never changed: the
// processed audio is cached separately (in memory + IndexedDB) and rebuilt whenever settings,
// key, scale, tempo or the take's position change. Playback and WAV/stem exports both use it.
import { db } from '../db';
import { keyIndex, modeById } from '../theory';
import type { PolishParams, PolishReport, Space } from './polishDsp';
import { runPolish } from './polishClient';

export interface PolishContext { key: string; mode: string; bpm: number; sampleRate: number; takeStart: number; takeId: string; transpose?: number }
export interface VoicePolishSettings extends PolishParams { preset: PresetId | 'custom'; bypass: boolean }
export type PresetId = 'natural' | 'polished' | 'tuned';

export const PRESETS: Record<PresetId, { label: string; blurb: string; p: PolishParams }> = {
  natural: { label: 'Natural', blurb: 'Gentle pitch help, keeps your vibrato', p: { tune: 0.35, humanize: 0.75, timing: 0.25, grid: 0.25, mix: true, space: 'room' } },
  polished: { label: 'Polished', blurb: 'Radio-ready: in tune, tight, with space', p: { tune: 0.65, humanize: 0.4, timing: 0.5, grid: 0.25, mix: true, space: 'both' } },
  tuned: { label: 'Tuned', blurb: 'Hard, robotic snap to each note', p: { tune: 1, humanize: 0, timing: 0.6, grid: 0.25, mix: true, space: 'echo' } },
};
export const presetSettings = (id: PresetId): VoicePolishSettings => ({ ...PRESETS[id].p, preset: id, bypass: false });
export const voicePolishAvailable = () => true;

export function describeSettings(s: VoicePolishSettings): string {
  const name = s.preset === 'custom' ? 'Custom' : PRESETS[s.preset].label;
  const space: Record<Space, string> = { none: 'no space', room: 'room', echo: 'echo', both: 'room + echo' };
  return `${name}: tuning ${Math.round(s.tune * 100)}%, humanize ${Math.round(s.humanize * 100)}%, timing ${Math.round(s.timing * 100)}% to 1/${Math.round(4 / s.grid)} notes, mix chain ${s.mix ? 'on' : 'off'}, ${space[s.space]}`;
}

const mem = new Map<string, { buf: AudioBuffer; report: PolishReport }>();
const inflight = new Map<string, Promise<{ buf: AudioBuffer; report: PolishReport }>>();
const lastKeyByTake = new Map<string, string>();

function cacheKey(s: VoicePolishSettings, c: PolishContext) {
  const { bypass, preset, ...p } = s;
  return `polish:${c.takeId}:${JSON.stringify(p)}:${c.key}:${c.mode}:${c.bpm}:${c.transpose ?? 0}:${c.takeStart.toFixed(3)}`;
}
export const scalePitchClasses = (key: string, mode: string, transpose = 0) => modeById(mode).steps.map((st) => (st + keyIndex(key) + transpose % 12 + 120) % 12);

/** Returns the polished buffer (processing in a Worker on first use). */
export async function polishedBuffer(raw: AudioBuffer, settings: VoicePolishSettings, c: PolishContext, progress?: (f: number, stage: string) => void) {
  const key = cacheKey(settings, c);
  const hit = mem.get(key); if (hit) return hit;
  if (inflight.has(key)) return inflight.get(key)!;
  const job = (async () => {
    const stored = await db.get<{ data: Float32Array; report: PolishReport }>('audio', key).catch(() => undefined);
    let data: Float32Array, report: PolishReport;
    if (stored) ({ data, report } = stored);
    else {
      const res = await runPolish({ data: raw.getChannelData(0), sr: raw.sampleRate, scale: scalePitchClasses(c.key, c.mode, c.transpose ?? 0), bpm: c.bpm, takeStart: c.takeStart, params: settings }, progress);
      data = res.data; report = res.report;
      await db.put('audio', { data, report }, key).catch(() => {});
    }
    const prev = lastKeyByTake.get(c.takeId);
    if (prev && prev !== key) { mem.delete(prev); db.del('audio', prev).catch(() => {}); }
    lastKeyByTake.set(c.takeId, key);
    const buf = new AudioBuffer({ length: Math.max(1, data.length), sampleRate: raw.sampleRate, numberOfChannels: 1 });
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    const out = { buf, report };
    mem.set(key, out);
    return out;
  })();
  inflight.set(key, job);
  try { return await job; } finally { inflight.delete(key); }
}

/** Hook used by takes.ts for playback and export. */
export async function applyVoicePolish(raw: AudioBuffer, polish: { settings: Record<string, unknown>; processedAudioKey?: string } | null, c: PolishContext): Promise<AudioBuffer> {
  if (!polish) return raw;
  const s = polish.settings as unknown as VoicePolishSettings;
  if (s.bypass) return raw;
  try {
    const res = await polishedBuffer(raw, s, c);
    // remember which processed copy belongs to this take so stale copies get cleaned up across sessions
    const key = cacheKey(s, c);
    if (polish.processedAudioKey && polish.processedAudioKey !== key) db.del('audio', polish.processedAudioKey).catch(() => {});
    polish.processedAudioKey = key;
    return res.buf;
  }
  catch (e) { console.warn('Voice Polish failed, using the original take', e); return raw; }
}
export async function forgetPolish(takeId: string) {
  const prev = lastKeyByTake.get(takeId);
  if (prev) { mem.delete(prev); await db.del('audio', prev).catch(() => {}); lastKeyByTake.delete(takeId); }
}
