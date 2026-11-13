import { useEffect, useState } from 'preact/hooks';
import { db } from './db';
import type { Song } from './model';
import { newSong } from './model';

type Listener = () => void;
const listeners = new Set<Listener>();
let song: Song = newSong();
let songs: { id: string; title: string; updatedAt: string }[] = [];
let saveTimer: number | undefined;
let rev = 0;

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
  saveTimer = window.setTimeout(saveNow, 400);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  await db.put('songs', JSON.parse(JSON.stringify(song)));
  await db.put('meta', song.id, 'lastSong');
  await refreshList();
}
async function refreshList() {
  const all = await db.getAll<Song>('songs');
  songs = all.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  emit();
}

export async function initStore() {
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
function migrate(s: Song): Song {
  const d = newSong();
  const mix = { ...d.mix, ...s.mix } as Song['mix'];
  for (const id of ['drums', 'bass', 'chords', 'melody', 'vocals'] as const) {
    mix[id] = { ...d.mix[id], ...mix[id] };
  }
  return { ...d, ...s, mix, credits: s.credits ?? d.credits };
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
  if (s) for (const t of s.takes) await db.del('audio', t.id);
  await db.del('songs', id);
  if (id === song.id) {
    await refreshList();
    if (songs[0]) await openSong(songs[0].id); else await createSong();
  } else await refreshList();
}
export async function replaceSong(s: Song) { song = migrate(s); await saveNow(); emit(); }
export const storeRev = () => rev;
