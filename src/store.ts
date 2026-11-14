import { useEffect, useState } from 'preact/hooks';
import { db } from './db';
import type { Song } from './model';
import { newSong } from './model';
import { LEGACY_MACROS, MACRO_TRACKS, mixHasMacros } from './audio/macros';
import { forgetPolish } from './audio/voicePolish';

type Listener = () => void;
const listeners = new Set<Listener>();
let song: Song = newSong();
let songs: { id: string; title: string; updatedAt: string }[] = [];
let saveTimer: number | undefined;
let saveChain: Promise<void> = Promise.resolve();
let rev = 0;
let persistWired = false;
let storageWarned = false;

export const getSong = () => song;
export const getSongs = () => songs;
const emit = () => { rev++; listeners.forEach((l) => l()); };

export function useSong(): Song {
  const [, set] = useState(0);
  useEffect(() => { const l = () => set((x) => x + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return song;
}
export function subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }

/** Append to the authorship log. Repeated edits of the same kind within 2 minutes are merged. */
export function logAction(s: Song, kind: string, text: string) {
  const now = new Date().toISOString();
  const last = s.log[s.log.length - 1];
  if (last && last.kind === kind && last.text === text && Date.now() - Date.parse(last.last ?? last.ts) < 120000) {
    last.count = (last.count ?? 1) + 1;
    last.last = now;
  } else {
    s.log.push({ ts: now, kind, text });
    if (s.log.length > 3000) s.log.splice(0, s.log.length - 3000);
  }
}

/** Mutate the current song. Pass a log entry for every human creative edit. */
export function update(fn: (s: Song) => void, log?: [kind: string, text: string]) {
  fn(song);
  if (log) logAction(song, log[0], log[1]);
  song.updatedAt = new Date().toISOString();
  emit();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void saveNow(); }, 400);
}

/** Single-flight save so overlapping puts don't race. */
export async function saveNow() {
  clearTimeout(saveTimer);
  const snap = JSON.parse(JSON.stringify(song)) as Song;
  const id = snap.id;
  saveChain = saveChain.then(async () => {
    try {
      await db.put('songs', snap);
      await db.put('meta', id, 'lastSong');
      await refreshList();
    } catch (e) {
      console.warn('Save failed', e);
      throw e;
    }
  }).catch(() => { /* keep chain alive */ });
  await saveChain;
}

async function refreshList() {
  const all = await db.getAll<Song>('songs');
  songs = all.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  emit();
}

function wirePersistFlush() {
  if (persistWired || typeof window === 'undefined') return;
  persistWired = true;
  const flush = () => { void saveNow(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Ask the browser to keep site data when space is tight (best-effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch { return false; }
}

/** Returns used/quota bytes when the browser supports it. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    if (e.quota == null || e.usage == null) return null;
    return { usage: e.usage, quota: e.quota };
  } catch { return null; }
}

/** Warn once per session if IndexedDB-ish usage is above ~85% of quota. */
export async function maybeWarnStorage(toastFn?: (msg: string) => void) {
  const e = await storageEstimate();
  if (!e || storageWarned) return e;
  if (e.quota > 0 && e.usage / e.quota >= 0.85) {
    storageWarned = true;
    toastFn?.('This device is low on storage for Mixquilt. Export a full backup soon so you do not lose vocals.');
  }
  return e;
}

export async function initStore() {
  wirePersistFlush();
  try {
    const last = await db.get<string>('meta', 'lastSong');
    const s = last ? await db.get<Song>('songs', last) : undefined;
    if (s) song = migrate(s);
    else await saveNow();
    await refreshList();
  } catch (e) {
    console.warn('IndexedDB unavailable, working in memory', e);
  }
  emit();
}

export function migrate(s: Song): Song {
  const d = newSong();
  const legacy = !mixHasMacros(s.mix);
  const mix = { ...d.mix, ...s.mix } as Song['mix'];
  for (const id of MACRO_TRACKS) {
    mix[id] = { ...d.mix[id], ...(s.mix?.[id] ?? {}) };
    if (legacy) mix[id] = { ...mix[id], ...LEGACY_MACROS };
  }
  const sections = (s.sections ?? d.sections).map((sec) => ({
    ...sec,
    layers: { ...d.sections[0].layers, ...(sec.layers ?? {}) },
    beat: sec.beat === 'B' ? 'B' as const : 'A' as const,
    part: sec.part || sec.type,
    transpose: typeof sec.transpose === 'number' ? sec.transpose : 0,
  }));
  return {
    ...d,
    ...s,
    mix,
    sections,
    beats: s.beats ?? d.beats,
    chords: s.chords ?? d.chords,
    parts: s.parts ?? {},
    lyrics: s.lyrics ?? d.lyrics,
    takes: Array.isArray(s.takes) ? s.takes : [],
    log: Array.isArray(s.log) ? s.log : d.log,
    versions: Array.isArray(s.versions) ? s.versions : [],
    locks: s.locks ?? {},
    credits: s.credits ?? d.credits,
    recipe: { ...d.recipe, ...(s.recipe ?? {}) },
  };
}

async function purgeTakeAudio(t: { id: string; polish?: { processedAudioKey?: string } | null }) {
  await db.del('audio', t.id).catch(() => {});
  if (t.polish?.processedAudioKey) await db.del('audio', t.polish.processedAudioKey).catch(() => {});
  await forgetPolish(t.id).catch(() => {});
}

export async function openSong(id: string) {
  await saveNow();
  const s = await db.get<Song>('songs', id);
  if (s) { song = migrate(s); await db.put('meta', id, 'lastSong'); emit(); }
}
export async function createSong(title?: string) {
  await saveNow();
  song = newSong(title || 'Untitled song');
  await saveNow();
}
export async function deleteSong(id: string) {
  const s = await db.get<Song>('songs', id);
  if (s) for (const t of s.takes) await purgeTakeAudio(t);
  await db.del('songs', id);
  if (id === song.id) {
    await refreshList();
    if (songs[0]) await openSong(songs[0].id); else await createSong();
  } else await refreshList();
}
/** Replace the in-memory song after persisting the current one (avoids losing unsaved edits). */
export async function replaceSong(s: Song) {
  await saveNow();
  song = migrate(s);
  await saveNow();
  emit();
}
export const storeRev = () => rev;
