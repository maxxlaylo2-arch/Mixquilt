import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.MQ_URL || 'http://127.0.0.1:4178/Mixquilt/';
const OUT = process.env.OUT || '/tmp/legacy-pre-library.wav';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero h1');
const b64 = await page.evaluate(async () => {
  const mq = window.__mq;
  mq.update((s) => {
    s.title = 'Legacy Fixture';
    s.recipe.mood = 'chill'; s.recipe.key = 'C'; s.recipe.mode = 'major'; s.recipe.bpm = 120;
    s.recipe.groove = 'straight'; s.recipe.progression = 'anthem'; s.recipe.palette = 'dusty';
    s.recipe.chordRhythm = 'sustain';
    s.chords = [{ deg: 0 }, { deg: 4 }, { deg: 5 }, { deg: 3 }];
    s.sections = [{ id: 'h', type: 'Hook', bars: 2, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
    s.parts = { Hook: [{ t: 0, d: 1.2, m: 72, v: 0.85 }, { t: 2, d: 0.8, m: 76, v: 0.7 }, { t: 4, d: 1.5, m: 79, v: 0.8 }, { t: 8, d: 2, m: 72, v: 0.85 }] };
    s.takes = [];
    const pat = (fill) => Array.from({ length: 16 }, (_, i) => fill(i) ? 1 : 0);
    s.beats.A.kick = pat((i) => i === 0 || i === 8);
    s.beats.A.snare = pat((i) => i === 4 || i === 12);
    s.beats.A.hat = pat((i) => i % 2 === 0);
    s.beats.A.clap = pat(() => false);
    s.beats.A.open = pat((i) => i === 14);
    s.beats.A.perc = pat((i) => i === 6);
    s.beats.A.bass = pat((i) => i === 0 || i === 6 || i === 8 || i === 12);
    s.mix.drums.vol = 0.8; s.mix.bass.vol = 0.75; s.mix.chords.vol = 0.6; s.mix.melody.vol = 0.7; s.mix.vocals.vol = 0.9; s.mix.master = 0.85;
  });
  const buf = await mq.renderSong(mq.getSong());
  const ch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate;
  const dataLen = len * ch * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, dataLen, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const x = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  const bytes = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const d = buf.getChannelData(0);
  let peak = 0, sum = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i]*d[i]; }
  return { b64: btoa(bin), peak, rms: Math.sqrt(sum/d.length), len: d.length, sr, ch };
});
fs.writeFileSync(OUT, Buffer.from(b64.b64, 'base64'));
console.log(OUT, b64.peak, b64.rms, b64.len, b64.sr, b64.ch);
await browser.close();
