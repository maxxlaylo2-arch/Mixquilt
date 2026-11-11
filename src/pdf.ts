import { jsPDF } from 'jspdf';
import { describeSettings, type VoicePolishSettings } from './audio/voicePolish';
import type { Song } from './model';
import { lyricKeys } from './model';
import { KEYS, chordName, modeById, paletteById, PROGRESSIONS, STRUCTURES } from './theory';

export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';

const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export const pdfSafe = (t: string) => t.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[^\n\x20-\xff]/g, (c) => (WINANSI_EXTRA.includes(c) ? c : ''));

class Writer {
  doc = new jsPDF({ unit: 'pt', format: 'letter' });
  y = 56; m = 56; w = 612 - 112;
  ensure(h: number) { if (this.y + h > 792 - 56) { this.doc.addPage(); this.y = 56; } }
  text(t: string, size = 11, style: 'normal' | 'bold' | 'italic' = 'normal', gap = 4, color = 20) {
    this.doc.setFont('helvetica', style); this.doc.setFontSize(size); this.doc.setTextColor(color);
    const lines = this.doc.splitTextToSize(pdfSafe(t), this.w) as string[];
    for (const l of lines) { this.ensure(size + gap); this.doc.text(l, this.m, this.y); this.y += size + gap; }
  }
  space(h = 8) { this.y += h; }
  rule() { this.ensure(10); this.doc.setDrawColor(200); this.doc.line(this.m, this.y, this.m + this.w, this.y); this.y += 12; }
}

function header(w: Writer, s: Song, sub: string) {
  w.text(s.title || 'Untitled song', 22, 'bold', 6);
  w.text(sub, 11, 'normal', 4, 90);
  if (s.credits.author) w.text('Written by ' + s.credits.author, 11, 'normal', 4, 60);
  const r = s.recipe;
  w.text(`${KEYS.includes(r.key) ? r.key : r.key} ${modeById(r.mode).name} · ${r.bpm} BPM · chords: ${s.chords.map((c) => chordName(r.key, r.mode, c)).join(' – ')}`, 10, 'normal', 4, 90);
  w.rule();
}

export function lyricSheetPdf(s: Song): Blob {
  const w = new Writer();
  header(w, s, 'Lyric sheet');
  const keys = lyricKeys(s.sections);
  const printed = new Set<string>();
  keys.forEach((k) => {
    const block = s.lyrics.find((l) => l.key === k);
    w.text(k.toUpperCase(), 10, 'bold', 6, 110);
    if (printed.has(k)) { w.text(`(repeat ${k})`, 11, 'italic', 4, 120); w.space(8); return; }
    printed.add(k);
    const txt = block?.text.trim();
    if (txt) for (const line of txt.split('\n')) w.text(line || ' ', 12, 'normal', 5);
    else w.text('(no lyrics yet)', 11, 'italic', 4, 150);
    w.space(10);
  });
  w.space(10);
  w.text(`© ${new Date().getFullYear()} ${s.credits.author || '[author]'}. All rights reserved.`, 9, 'normal', 4, 120);
  return w.doc.output('blob');
}

export async function authorshipPdf(s: Song): Promise<Blob> {
  const w = new Writer();
  header(w, s, 'Authorship and version log');
  const state = JSON.stringify({ ...s, log: undefined, versions: undefined });
  const hash = await sha256(state);
  w.text('Statement', 13, 'bold', 6);
  w.text('This song was made by hand in Mixquilt, a song studio that contains no AI: it does not generate audio, vocals, lyrics, melodies, beats or arrangements. Every note, drum step, chord choice, lyric, recorded vocal take and arrangement change listed below was entered by the user. The app only suggested common musical building blocks (key, mode, tempo, groove, common chord progressions, song-form templates, instrument palette), which generally are not protected by copyright on their own and which the user accepted, changed or ignored. Instrument sounds are synthesized in the app (no third-party loops or samples).', 10, 'normal', 4, 40);
  w.space(6);
  w.text('This log helps document the human authorship of this song. It is general information, not legal advice, and it does not guarantee copyright protection or acceptance of any registration. The log only records what you did in Mixquilt. It does not cover work done outside the app, and it is not a copyright registration. When registering a work with a copyright office, describe your own contributions (lyrics, music, sound recording) accurately, and consult a qualified attorney with legal questions.', 9, 'italic', 4, 110);
  w.space(8);
  w.text('Summary', 13, 'bold', 6);
  const noteCount = Object.values(s.parts).reduce((a, p) => a + p.length, 0);
  const steps = (['A', 'B'] as const).reduce((a, b) => a + Object.values(s.beats[b]).reduce((x, row) => x + row.filter(Boolean).length, 0), 0);
  const wordsN = s.lyrics.reduce((a, l) => a + (l.text.trim() ? l.text.trim().split(/\s+/).length : 0), 0);
  const prog = PROGRESSIONS.find((p) => p.id === s.recipe.progression);
  const struct = STRUCTURES.find((p) => p.id === s.recipe.structure);
  const rows = [
    ['Created', fmtTime(s.createdAt)], ['Last edited', fmtTime(s.updatedAt)],
    ['Melody notes played', String(noteCount)], ['Drum/bass steps placed', String(steps)], ['Lyric words written', String(wordsN)],
    ['Vocal takes recorded', `${s.takes.length} (${s.takes.filter((t) => t.active).length} in the mix)`],
    ['Sections arranged', String(s.sections.length)],
    ['Voice Polish (classic DSP pitch/timing correction and mix chain, no AI; applied to the user\'s own recorded takes, originals kept)',
      s.takes.filter((t) => t.polish).map((t) => `${t.name}: ${describeSettings(t.polish!.settings as unknown as VoicePolishSettings)}${(t.polish!.settings as any).bypass ? ' (bypassed, original used)' : ''}`).join('; ') || 'not used'],
    ['Starting points used', `${prog ? prog.label : 'custom chords'}; ${struct ? struct.label : 'custom form'}; palette ${paletteById(s.recipe.palette).label}`],
    ['Song fingerprint (SHA-256)', hash],
  ];
  for (const [k, v] of rows) w.text(`${k}: ${v}`, 10, 'normal', 4, 40);
  w.space(8);
  if (s.versions.length) {
    w.text('Saved versions', 13, 'bold', 6);
    for (const v of s.versions) w.text(`${fmtTime(v.ts)} · ${v.label} · SHA-256 ${v.hash}`, 9, 'normal', 4, 40);
    w.space(8);
  }
  w.text('Timeline of edits', 13, 'bold', 6);
  for (const e of s.log) {
    const extra = e.count && e.count > 1 ? ` (x${e.count}, until ${fmtTime(e.last!)})` : '';
    w.text(`${fmtTime(e.ts)} [${e.kind}] ${e.text}${extra}`, 9, 'normal', 3, 40);
  }
  w.space(10);
  w.text(`Generated ${fmtTime(new Date().toISOString())}.`, 8, 'normal', 4, 130);
  return w.doc.output('blob');
}
