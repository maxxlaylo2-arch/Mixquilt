// Playwright checks for the master Finish stage. Needs the preview server (MQ_URL).
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.MQ_URL || 'http://localhost:4173/Mixquilt/';
const SHOTS = process.env.MQ_SHOTS || '/workspace/mixquilt-guidebook/test-beats/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) process.exitCode = 1; };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector('.hero h1');
ok('Build exposes Finish helpers', await page.evaluate(() => !!(window.__mq && window.__mq.FINISHES && window.__mq.finishOf)));

// A dense 2-bar trap loop, rendered at each finish.
const measure = (finish) => page.evaluate(async (finish) => {
  const mq = window.__mq;
  mq.update((s) => {
    s.takes = []; s.recipe.bpm = 140;
    s.sections = [{ id: 'x', type: 'Hook', bars: 2, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
    s.parts.Hook = Array.from({ length: 8 }, (_, i) => ({ t: i, d: 0.8, m: 64 + (i % 4) * 3, v: 0.85 }));
    const pat = { kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0], snare: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], clap: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
      hat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1], open: Array(16).fill(0), perc: Array(16).fill(0), bass: [1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0] };
    for (const r of Object.keys(pat)) s.beats.A[r] = pat[r];
    for (const t of ['drums', 'bass', 'chords', 'melody']) s.mix[t].vol = 1;
    s.mix.master = 1;
    if (finish === null) delete s.mix.finish; else s.mix.finish = finish;
  });
  const buf = await mq.renderSong(mq.getSong());
  let sq = 0, pk = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); sq += d[i] * d[i]; if (a > pk) pk = a; n++; } }
  return { rmsDb: 10 * Math.log10(sq / n), peak: pk };
}, finish);

const none = await measure(null);
const off = await measure('off');
const stream = await measure('stream');
const chart = await measure('chart');
const club = await measure('club');
console.log(JSON.stringify({ none, off, stream, chart, club }));
// Renders are not bit-identical run to run (the reverb impulse and hat noise are random), so compare loudness.
ok('Pre-master renders like a song with no finish field (old songs unchanged, within 0.3 dB)', Math.abs(none.rmsDb - off.rmsDb) < 0.3, (none.rmsDb - off.rmsDb).toFixed(3) + ' dB');
ok('Streaming is louder than Pre-master by ≥1.5 dB', stream.rmsDb - off.rmsDb >= 1.5, (stream.rmsDb - off.rmsDb).toFixed(2) + ' dB');
ok('Chart is louder than Streaming', chart.rmsDb > stream.rmsDb + 1, (chart.rmsDb - off.rmsDb).toFixed(2) + ' dB over Pre-master');
ok('Club is the loudest', club.rmsDb > chart.rmsDb + 0.5, (club.rmsDb - off.rmsDb).toFixed(2) + ' dB over Pre-master');
for (const [k, v] of Object.entries({ stream, chart, club })) ok(`${k} peak stays under 0 dBFS (≤ −0.9 dBFS)`, v.peak <= 0.902, v.peak.toFixed(4));

// Stems stay Pre-master: a Club drum stem must be as loud as a Pre-master one (Club would add ~8 dB).
const stem = await page.evaluate(async () => {
  const mq = window.__mq;
  const lvl = (buf) => { let sq = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { sq += d[i] * d[i]; n++; } } return 10 * Math.log10(sq / n); };
  mq.update((s) => { s.mix.finish = 'club'; });
  const a = lvl(await mq.renderSong(mq.getSong(), ['drums']));
  mq.update((s) => { s.mix.finish = 'off'; });
  const b = lvl(await mq.renderSong(mq.getSong(), ['drums']));
  return a - b;
});
ok('Stems ignore Finish (always Pre-master, within 0.3 dB)', Math.abs(stem) < 0.3, stem.toFixed(3) + ' dB');

// UI: the chips in the Master strip.
await page.evaluate(() => window.__mq.setUi({ tab: 'song' }));
await page.waitForSelector('[data-testid="finish"]');
await page.locator('[data-testid="finish"]').scrollIntoViewIfNeeded();
ok('Pre-master chip is pressed by default for this song', await page.getAttribute('[data-testid="finish-off"]', 'aria-pressed') === 'true');
await page.click('[data-testid="finish-chart"]');
ok('Tapping Chart saves finish=chart', await page.evaluate(() => window.__mq.getSong().mix.finish) === 'chart');
ok('Chart chip shows pressed', await page.getAttribute('[data-testid="finish-chart"]', 'aria-pressed') === 'true');
ok('Hint explains Chart', (await page.textContent('[data-testid="finish-hint"]')).includes('Loud like'));
const box = await page.locator('[data-testid="finish"]').boundingBox();
ok('Finish row fits a 390 px phone', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
await page.locator('.strip.master').screenshot({ path: `${SHOTS}/finish-master-strip-390.png` });
const log = await page.evaluate(() => window.__mq.getSong().log.slice(-1)[0]?.text || '');
ok('Authorship log records the Finish change', /finish to Chart/.test(log), log);
ok('No page errors', errors.length === 0, errors.join(' | '));
await browser.close();
