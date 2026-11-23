// Project backup / restore: song JSON + vocal PCM (and polish caches) in one zip.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Song } from '../model';
import { uid } from '../model';
import { db } from '../db';
import { migrate } from '../store';
import { safeName } from './export';

export const BACKUP_FORMAT = 'mixquilt-backup';
export const BACKUP_VERSION = 2;

function f32ToBytes(data: Float32Array): Uint8Array {
  return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
function bytesToF32(bytes: Uint8Array): Float32Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/** Full project zip: song.json + audio/<takeId>.f32 (+ polish caches when present). */
export async function exportProjectZip(s: Song, onProgress?: (msg: string) => void): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const song = JSON.parse(JSON.stringify(s)) as Song;
  files['manifest.json'] = strToU8(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, title: s.title, exportedAt: new Date().toISOString() }));
  files['song.json'] = strToU8(JSON.stringify(song));
  for (const t of s.takes) {
    onProgress?.(`Packing take ${t.name}…`);
    const raw = await db.get<Float32Array>('audio', t.id);
    if (raw) files[`audio/${t.id}.f32`] = f32ToBytes(raw);
    const pk = t.polish?.processedAudioKey;
    if (pk) {
      const polished = await db.get<{ data: Float32Array; report: unknown }>('audio', pk);
      if (polished?.data) {
        files[`audio/polish/${encodeURIComponent(pk)}.f32`] = f32ToBytes(polished.data);
        files[`audio/polish/${encodeURIComponent(pk)}.json`] = strToU8(JSON.stringify(polished.report ?? {}));
      }
    }
  }
  files['README.txt'] = strToU8(
    `Mixquilt full project backup for "${s.title}".\n` +
    `Contains song data and vocal audio. Open Mixquilt → Song → Export → Import backup and choose this .zip.\n`,
  );
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

export type ImportResult = { song: Song; audioCount: number; kind: 'full' | 'json-only' };

function looksLikeSong(d: unknown): d is Song {
  return !!d && typeof d === 'object' && !!(d as Song).recipe && Array.isArray((d as Song).sections);
}

/** Import a v2 zip or legacy JSON (no audio). Always assigns a new song id. */
export async function importProjectFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip') || file.type === 'application/zip') {
    const buf = new Uint8Array(await file.arrayBuffer());
    const files = unzipSync(buf);
    const songRaw = files['song.json'];
    if (!songRaw) throw new Error('missing song.json');
    const parsed = JSON.parse(strFromU8(songRaw)) as Song;
    if (!looksLikeSong(parsed)) throw new Error('bad song');
    const manifest = files['manifest.json'] ? JSON.parse(strFromU8(files['manifest.json'])) as { format?: string } : null;
    if (manifest && manifest.format && manifest.format !== BACKUP_FORMAT) throw new Error('bad format');

    const song = migrate({ ...parsed, id: uid(), versions: parsed.versions ?? [], log: parsed.log ?? [] });
    song.log.push({ ts: new Date().toISOString(), kind: 'import', text: `Imported full backup ${file.name}` });

    let audioCount = 0;
    for (const [path, bytes] of Object.entries(files)) {
      if (path.startsWith('audio/') && path.endsWith('.f32') && !path.includes('/polish/')) {
        const id = path.slice('audio/'.length, -'.f32'.length);
        await db.put('audio', bytesToF32(bytes), id);
        audioCount++;
      } else if (path.startsWith('audio/polish/') && path.endsWith('.f32')) {
        const enc = path.slice('audio/polish/'.length, -'.f32'.length);
        const key = decodeURIComponent(enc);
        const reportPath = `audio/polish/${enc}.json`;
        const report = files[reportPath] ? JSON.parse(strFromU8(files[reportPath])) : {};
        await db.put('audio', { data: bytesToF32(bytes), report }, key);
      }
    }
    return { song, audioCount, kind: 'full' };
  }

  const d = JSON.parse(await file.text()) as Song;
  if (!looksLikeSong(d)) throw new Error('bad');
  const song = migrate({ ...d, id: uid(), takes: [], versions: d.versions ?? [], log: d.log ?? [] });
  song.log.push({ ts: new Date().toISOString(), kind: 'import', text: `Imported JSON backup ${file.name} (no audio in file)` });
  return { song, audioCount: 0, kind: 'json-only' };
}

export const backupFileName = (title: string) => `${safeName(title)}.mixquilt.zip`;
