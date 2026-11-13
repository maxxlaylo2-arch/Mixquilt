import type { Song, Take } from '../model';
import { takeSectionTranspose } from './compose';
import { db } from '../db';
import { nativeContext } from './engine';
import { applyVoicePolish, forgetPolish } from './voicePolish';

const cache = new Map<string, AudioBuffer>();

export async function saveTakeAudio(id: string, data: Float32Array) { await db.put('audio', data, id); }
export async function deleteTakeAudio(id: string) { cache.delete(id); await forgetPolish(id); await db.del('audio', id); }

export async function rawTakeBuffer(t: Take): Promise<AudioBuffer | null> {
  if (cache.has(t.id)) return cache.get(t.id)!;
  const data = await db.get<Float32Array>('audio', t.id);
  if (!data) return null;
  const buf = new AudioBuffer({ length: Math.max(1, data.length), sampleRate: t.sampleRate, numberOfChannels: 1 });
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  cache.set(t.id, buf);
  return buf;
}

/** The buffer used for playback and export. Runs Voice Polish when the take has it on (and not bypassed). */
export async function loadTakeBuffer(t: Take, s: Song): Promise<AudioBuffer | null> {
  const raw = await rawTakeBuffer(t);
  if (!raw) return null;
  return applyVoicePolish(raw, t.polish, { ...polishContext(t, s), sampleRate: raw.sampleRate });
}

export const polishContext = (t: Take, s: Song) => ({
  key: s.recipe.key, mode: s.recipe.mode, bpm: s.recipe.bpm,
  sampleRate: t.sampleRate, takeStart: t.start, takeId: t.id,
  transpose: takeSectionTranspose(t, s),
});

let previewSrc: AudioBufferSourceNode | null = null;
export async function previewTake(t: Take, s: Song) {
  stopPreview();
  const ctx = nativeContext();
  await ctx.resume();
  const buf = await loadTakeBuffer(t, s);
  if (!buf) return;
  previewSrc = ctx.createBufferSource();
  previewSrc.buffer = buf;
  previewSrc.connect(ctx.destination);
  previewSrc.start();
}
export function stopPreview() { try { previewSrc?.stop(); } catch { /* already stopped */ } previewSrc = null; }
