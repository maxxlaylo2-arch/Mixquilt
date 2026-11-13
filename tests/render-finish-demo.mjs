// Render the "Finish" A/B demo: the same 4-bar hook at Pre-master, then Chart. Needs the preview server (MQ_URL).
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.MQ_URL || 'http://127.0.0.1:4173/Mixquilt/';
const OUT = process.env.MQ_OUT || '/workspace/mixquilt-guidebook/test-beats';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage();
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL); await page.waitForSelector('.hero h1');
await page.evaluate(() => {
  const mq = window.__mq;
  mq.applyRecipe({ key: 'A', mode: 'minor', bpm: 140, groove: 'straight', progression: 'epic-minor', palette: 'gospeltrap' }, 'chose');
  mq.update((s) => {
    s.title = 'Finish Line (A/B demo)';
    s.takes = []; s.chordStyle = 'stabs'; s.partBars = 4;
    s.sections = [{ id: 'h', type: 'Hook', bars: 4, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
    // A natural minor hook: call, call, answer. Original.
    s.parts.Hook = [
      [0, .75, 76], [1, .5, 76], [1.5, .5, 74], [2, 1.5, 72],
      [4, .75, 76], [5, .5, 76], [5.5, .5, 74], [6, 1.5, 72],
      [8, .5, 76], [8.5, .5, 79], [9, 1, 81], [10, .5, 79], [10.5, .5, 76], [11, 1, 74],
      [12, 1, 72], [13, .5, 71], [13.5, 2.5, 69],
    ].map(([t, d, m]) => ({ t, d, m, v: 0.85 }));
    const pat = {
      kick:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
      snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hat:   [1,0,1,0, 1,0,1,3, 1,0,1,0, 1,2,1,3],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,2],
      bass:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
    };
    for (const r of Object.keys(pat)) s.beats.A[r] = pat[r];
    Object.assign(s.mix.drums, { vol: 0.9, tone: 0.6, drive: 0.15, character: 0.4 });
    Object.assign(s.mix.bass, { vol: 0.9, tone: 0.5, drive: 0.45, character: 0.25 });
    Object.assign(s.mix.chords, { vol: 0.6, tone: 0.6, drive: 0.1, character: 0.6 });
    Object.assign(s.mix.melody, { vol: 0.72, tone: 0.62, drive: 0.1, character: 0.55 });
    s.mix.master = 1;
  });
});
for (const finish of ['off', 'chart']) {
  const pcm = await page.evaluate(async (finish) => {
    const mq = window.__mq;
    mq.update((s) => { s.mix.finish = finish; });
    const buf = await mq.renderSong(mq.getSong());
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = new Int16Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { out[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let s = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, finish);
  fs.writeFileSync(`/tmp/finish-${finish}.raw`, Buffer.from(pcm, 'base64'));
  console.log('rendered', finish);
}
const song = await page.evaluate(() => { const s = window.__mq.getSong(); return { chords: s.chords, recipe: s.recipe }; });
console.log(JSON.stringify(song));
await b.close();
