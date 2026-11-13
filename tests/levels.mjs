// Measures the loudness of every built-in instrument so the palettes stay balanced.
import { chromium } from 'playwright';
const URL = process.env.MQ_URL || 'http://localhost:4173/Mixquilt/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero h1');
await page.waitForFunction(() => window.__mq && window.__mq.VOICES);
const catalog = await page.evaluate(() => (window.__mq.VOICES || []).map((v) => ({ id: v.id, role: v.role })));
const jobs = [
  ...catalog.filter((v) => v.role === 'kit').map((v) => ({ track: 'drums', inst: v.id })),
  ...catalog.filter((v) => v.role === 'bass').map((v) => ({ track: 'bass', inst: v.id })),
  ...catalog.filter((v) => v.role === 'chords').map((v) => ({ track: 'chords', inst: v.id })),
  ...catalog.filter((v) => v.role === 'lead').map((v) => ({ track: 'melody', inst: v.id })),
  { track: 'melody', inst: 'piano' },
];
console.log(`measuring ${jobs.length} voice renders`);
const out = {};
for (const job of jobs) {
  const t0 = Date.now();
  const row = await page.evaluate(async ({ track, inst }) => {
    const mq = window.__mq;
    const rms = (buf) => { const d = buf.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i += 3) s += d[i] * d[i]; return Math.sqrt(s / (d.length / 3)); };
    const peak = (buf) => { const d = buf.getChannelData(0); let p = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } return p; };
    mq.update((s) => {
      s.takes = [];
      s.recipe.bpm = 120;
      s.sections = [{ id: 'x', type: 'Hook', bars: 2, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
      s.parts.Hook = Array.from({ length: 8 }, (_, i) => ({ t: i * 2, d: 0.8, m: 62 + (i % 5) * 2, v: 0.85 }));
      s.parts.Verse = [];
      for (const r of ['kick', 'snare', 'hat', 'bass', 'clap', 'open', 'perc']) {
        s.beats.A[r] = s.beats.A[r].map((_, i) => (r === 'hat' ? i % 2 === 0 : r === 'kick' ? i % 8 === 0 : r === 'snare' ? i % 8 === 4 : r === 'bass' ? i % 4 === 0 : 0) ? 1 : 0);
      }
      for (const tr of ['drums', 'bass', 'chords', 'melody']) s.mix[tr].inst = 'pad';
      s.mix[track].inst = inst;
    });
    const t0 = performance.now();
    const buf = await mq.renderSong(mq.getSong(), [track]);
    return { rms: Number(rms(buf).toFixed(4)), peak: Number(peak(buf).toFixed(4)), ms: Math.round(performance.now() - t0), dur: buf.duration };
  }, job);
  out[`${job.track}:${job.inst}`] = row;
  console.log(`${job.track}:${job.inst}  rms=${row.rms} peak=${row.peak} ${row.ms}ms dur=${row.dur} (wall ${Date.now() - t0}ms)`);
  if (row.peak >= 0.99 || row.rms < 0.001 || row.peak < 0.01) console.error('  FLAG', row);
}
console.log(JSON.stringify(out, null, 2));
const silent = Object.entries(out).filter(([, v]) => v.rms < 0.001 || v.peak < 0.01);
const clipped = Object.entries(out).filter(([, v]) => v.peak >= 0.99);
if (silent.length) { console.error('SILENT', silent.map(([k]) => k).join(', ')); process.exitCode = 1; }
if (clipped.length) { console.error('CLIPPED', clipped.map(([k]) => k).join(', ')); process.exitCode = 1; }
if (!silent.length && !clipped.length) console.log(`OK ${Object.keys(out).length} voices, none silent or clipping`);
await b.close();
