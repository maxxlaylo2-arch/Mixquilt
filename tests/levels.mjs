// Measures the loudness of every built-in instrument so the palettes stay balanced.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await b.newPage();
await page.goto(process.env.MQ_URL || 'http://localhost:4173/Mixquilt/');
await page.waitForSelector('.hero h1');
const out = await page.evaluate(async () => {
  const mq = window.__mq;
  const rms = (buf) => { const d = buf.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i += 3) s += d[i] * d[i]; return Math.sqrt(s / (d.length / 3)); };
  mq.update((s) => {
    s.sections = [{ id: 'x', type: 'Hook', bars: 4, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
    s.parts.Hook = Array.from({ length: 16 }, (_, i) => ({ t: i, d: 0.8, m: 62 + (i % 5) * 2, v: 0.85 }));
    for (const r of ['kick', 'snare', 'hat', 'bass']) s.beats.A[r] = s.beats.A[r].map((_, i) => (r === 'hat' ? i % 2 === 0 : r === 'kick' ? i % 8 === 0 : r === 'snare' ? i % 8 === 4 : i % 4 === 0) ? 1 : 0);
  });
  const res = {};
  const opts = { drums: ['boom808', 'dusty', 'tight', 'organic', 'big'], bass: ['sub', 'round', 'analog', 'saw', 'log'], chords: ['pad', 'ekeys', 'organ', 'pluck', 'strings', 'wide', 'piano'], melody: ['bell', 'softlead', 'piano', 'flute', 'brass', 'square'] };
  for (const [track, list] of Object.entries(opts)) for (const inst of list) {
    mq.update((s) => { s.mix[track].inst = inst; });
    const buf = await mq.renderSong(mq.getSong(), [track]);
    res[`${track}:${inst}`] = rms(buf).toFixed(3);
  }
  return res;
});
console.log(out);
await b.close();
