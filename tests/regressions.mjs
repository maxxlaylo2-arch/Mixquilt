// Playwright regressions for the 2026-11-13 bug-fix pass. Needs the preview server.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const URL = process.env.MQ_URL || 'http://localhost:4173/Mixquilt/';
const SHOTS = process.env.MQ_SHOTS || '/workspace/mixquilt-guidebook/test-beats/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => {
  const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`;
  results.push(l);
  console.log(l);
  if (!cond) process.exitCode = 1;
};

const chromePath = process.env.MQ_CHROME || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector('.hero h1');
await page.waitForFunction(() => window.__mq && typeof window.__mq.stop === 'function');

// --- 5. Title saves on input, before blur ---
await page.click('.title-input');
await page.fill('.title-input', '');
// fill() usually commits via input events; also type to be safe
await page.type('.title-input', 'Title Type Test', { delay: 10 });
const midTitle = await page.evaluate(() => window.__mq.getSong().title);
ok('Title is in song state while typing (before blur)', midTitle === 'Title Type Test', JSON.stringify(midTitle));
await page.click('.hero');
const afterBlur = await page.evaluate(() => window.__mq.getSong().title);
ok('Title stays after blur', afterBlur === 'Title Type Test', JSON.stringify(afterBlur));

// --- 1. Key change transposes recorded melody ---
await page.evaluate(() => {
  window.__mq.update((s) => {
    s.recipe.key = 'C';
    s.recipe.mode = 'major';
    s.parts.Hook = [{ t: 0, d: 1, m: 60, v: 0.8 }, { t: 1, d: 1, m: 67, v: 0.8 }];
  });
});
await page.evaluate(() => window.__mq.applyRecipe({ key: 'F♯' }, 'chose'));
const afterKey = await page.evaluate(() => window.__mq.getSong().parts.Hook.map((n) => n.m));
ok('Key change C→F♯ transposes C4/G4 to 66/73', afterKey[0] === 66 && afterKey[1] === 73, JSON.stringify(afterKey));

// --- 2. Tempo change rescales take starts ---
await page.evaluate(() => {
  window.__mq.update((s) => {
    s.recipe.bpm = 140;
    s.takes = [{ id: 't1', name: 'Take', createdAt: '', start: 1.7142857142857142, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null }];
  });
});
await page.evaluate(() => window.__mq.applyTempo(90));
const afterTempo = await page.evaluate(() => ({ bpm: window.__mq.getSong().recipe.bpm, start: window.__mq.getSong().takes[0].start }));
ok('Tempo 140→90 rescales take start by 140/90', afterTempo.bpm === 90 && Math.abs(afterTempo.start - 1.7142857142857142 * 140 / 90) < 1e-6, JSON.stringify(afterTempo));

// --- 3. Play tab loops the selected beat ---
await page.click('[data-tab="beat"]');
await page.click('.seg[aria-label="Pattern"] button:has-text("Beat B")');
await page.click('[data-tab="play"]');
const playMode = await page.evaluate(() => window.__mq.contextMode('play'));
ok('Play tab contextMode uses Beat B after it is selected', playMode.kind === 'loop' && playMode.beat === 'B', JSON.stringify(playMode));
const label = await page.locator('.t-where').textContent();
ok('Transport label mentions Beat B on the Play tab', /Beat B/.test(label || ''), JSON.stringify(label));

// --- 4. polishContext includes section.transpose ---
const polish = await page.evaluate(() => {
  const mq = window.__mq;
  mq.update((s) => {
    s.recipe.key = 'C';
    s.recipe.mode = 'major';
    s.recipe.bpm = 140;
    s.sections = [
      { id: 'v', type: 'Verse', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Verse', transpose: 0 },
      { id: 'h', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 2 },
    ];
  });
  const hookStart = 8 * 4 * 60 / 140;
  const take = { id: 't2', name: 'Hook take', createdAt: '', start: hookStart + 0.2, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null };
  return { ctx: mq.polishContext(take, mq.getSong()), trans: mq.takeSectionTranspose(take, mq.getSong()) };
});
ok('polishContext.transpose is 2 for a take in a +2 hook', polish.ctx.transpose === 2 && polish.trans === 2, JSON.stringify(polish));

// --- 7. Pad labels in Ab Dorian use Gb, not F♯ ---
await page.evaluate(() => window.__mq.applyRecipe({ key: 'A♭', mode: 'dorian' }, 'chose'));
await page.click('[data-tab="play"]');
await page.click('.seg[aria-label="Scale"] button:has-text("Pentatonic")');
const padNames = await page.locator('.pad-key .nn').allTextContents();
ok('Ab Dorian pads include Gb and no F♯', padNames.some((n) => n.includes('G♭')) && !padNames.some((n) => n.includes('F♯')), padNames.join(', '));

// --- 6. 390×844 Beat grid is not covered by the transport ---
await page.click('[data-tab="beat"]');
await page.waitForSelector('[data-testid="beat-grid"]');
await page.locator('#main').evaluate((el) => { el.scrollTop = 0; });
const shot = `${SHOTS}/mobile-beat-layout-390x844.png`;
await page.screenshot({ path: shot, fullPage: false });
const boxes = await page.evaluate(() => {
  const grid = document.querySelector('[data-testid="beat-grid"]');
  const open = grid.querySelector('.row-open');
  const perc = grid.querySelector('.row-perc');
  const bass = grid.querySelector('.row-bass');
  const transport = document.querySelector('.transport');
  const main = document.getElementById('main');
  const overlap = (a, b) => {
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    return !(ar.bottom <= br.top + 0.5 || ar.top >= br.bottom - 0.5);
  };
  const fullyInMain = (el) => {
    const r = el.getBoundingClientRect(), m = main.getBoundingClientRect();
    return r.top >= m.top - 0.5 && r.bottom <= m.bottom + 0.5;
  };
  return {
    openOverlap: overlap(open, transport),
    percOverlap: overlap(perc, transport),
    bassOverlap: overlap(bass, transport),
    openInView: fullyInMain(open),
    // scroll last row into view and re-check
    mainBottom: main.getBoundingClientRect().bottom,
    transportTop: transport.getBoundingClientRect().top,
  };
});
ok('Open hat row is fully visible above the transport at 390×844', boxes.openInView && !boxes.openOverlap, JSON.stringify(boxes));
ok('Content pane ends at or above the transport', boxes.mainBottom <= boxes.transportTop + 2, JSON.stringify(boxes));
// Perc/Bass may be below the fold; scrolling the main pane must bring them fully above the transport
await page.locator('.row-bass').evaluate((el) => el.scrollIntoView({ block: 'end' }));
const afterScroll = await page.evaluate(() => {
  const transport = document.querySelector('.transport');
  const perc = document.querySelector('.row-perc');
  const bass = document.querySelector('.row-bass');
  const main = document.getElementById('main');
  const fullyClear = (el) => {
    const r = el.getBoundingClientRect(), t = transport.getBoundingClientRect(), m = main.getBoundingClientRect();
    return r.bottom <= t.top + 1 && r.bottom <= m.bottom + 1 && r.top >= m.top - 1;
  };
  return { perc: fullyClear(perc), bass: fullyClear(bass) };
});
ok('Perc and Bass can be scrolled fully clear of the transport', afterScroll.perc && afterScroll.bass, JSON.stringify(afterScroll));
await page.screenshot({ path: `${SHOTS}/mobile-beat-layout-390x844-scrolled.png`, fullPage: false });

// --- Pre-roll window should not steal the next section's transpose ---
const preroll = await page.evaluate(() => {
  const mq = window.__mq;
  mq.update((s) => {
    s.recipe.key = 'C';
    s.recipe.mode = 'major';
    s.recipe.bpm = 140;
    s.sections = [
      { id: 'v', type: 'Verse', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Verse', transpose: 0 },
      { id: 'h', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 2 },
    ];
  });
  const hookStart = 8 * 4 * 60 / 140;
  const take = { id: 'pre', name: 'Hook take', createdAt: '', start: hookStart - 0.24, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null };
  const trans = mq.takeSectionTranspose(take, mq.getSong());
  const ctx = mq.polishContext(take, mq.getSong());
  const key = mq.keyAfterTranspose('C', trans);
  return { hookStart, trans, ctxT: ctx.transpose, key, preroll: mq.TAKE_PREROLL_SEC, nVoices: (mq.VOICES || []).length };
});
ok('Pre-roll take (0.24s before a +2 hook) uses hook transpose 2, not the previous section', preroll.trans === 2 && preroll.ctxT === 2, JSON.stringify(preroll));
ok('Effective snap key for C +2 is D', preroll.key === 'D', JSON.stringify(preroll));
ok('Voice catalog is loaded on the test hook', preroll.nVoices >= 80, String(preroll.nVoices));

// --- Same-named adjacent Hooks: match by time range, not the label "Hook" ---
const hooks = await page.evaluate(() => {
  const mq = window.__mq;
  mq.update((s) => {
    s.recipe.key = 'C';
    s.recipe.mode = 'major';
    s.recipe.bpm = 140;
    s.sections = [
      { id: 'h1', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'h2', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 2 },
    ];
  });
  const hook2 = 8 * 4 * 60 / 140;
  const inFirst = mq.takeSectionTranspose({ id: 'a', name: 'H1', createdAt: '', start: 1, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null }, mq.getSong());
  const inSecond = mq.takeSectionTranspose({ id: 'b', name: 'H2', createdAt: '', start: hook2 + 0.1, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null }, mq.getSong());
  const prerollSecond = mq.takeSectionTranspose({ id: 'c', name: 'H2 pre', createdAt: '', start: hook2 - 0.24, duration: 2, sampleRate: 44100, active: true, section: 'Hook', polish: null }, mq.getSong());
  return { hook2, inFirst, inSecond, prerollSecond, tone0: mq.toneCutoffHz(0), toneDef: mq.toneCutoffHz(0.5), tone1: mq.toneCutoffHz(1) };
});
ok('Hook@0 then Hook@+2: a take inside the first Hook uses 0, not the later Hook', hooks.inFirst === 0, JSON.stringify(hooks));
ok('Hook@0 then Hook@+2: a take inside the second Hook uses +2, not the shared name', hooks.inSecond === 2, JSON.stringify(hooks));
ok('Hook@0 then Hook@+2: a take 0.24s before the second Hook (pre-roll) uses +2', hooks.prerollSecond === 2, JSON.stringify(hooks));
ok('toneCutoffHz default is transparent on the test hook', hooks.toneDef >= 16000 && hooks.tone0 < 1000, JSON.stringify(hooks));

// --- Mic-tab floor-rounded pre-roll (already-saved takes) must still pick the next section ---
const floorTrim = await page.evaluate(() => {
  const mq = window.__mq;
  const out = [];
  const setups = [
    { sr: 44100, bpm: 140, bars1: 8 },
    { sr: 48000, bpm: 140, bars1: 8 },
    { sr: 44100, bpm: 128, bars1: 16 },
    { sr: 48000, bpm: 90, bars1: 8 },
  ];
  for (const cfg of setups) {
    mq.update((s) => {
      s.recipe.bpm = cfg.bpm;
      s.sections = [
        { id: 'h1', type: 'Hook', bars: cfg.bars1, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 0 },
        { id: 'h2', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: true }, beat: 'A', part: 'Hook', transpose: 2 },
      ];
    });
    const sectionStart = cfg.bars1 * 4 * 60 / cfg.bpm;
    const recStart = sectionStart - 4 * 60 / cfg.bpm; // count-in
    const floored = mq.trimTakeToSectionFloor(recStart, sectionStart, cfg.sr);
    const ceiled = mq.trimTakeToSection(recStart, sectionStart, cfg.sr);
    const transFloor = mq.takeSectionTranspose({ start: floored.start, section: 'Hook' }, mq.getSong());
    const transCeil = mq.takeSectionTranspose({ start: ceiled.start, section: 'Hook' }, mq.getSong());
    const trans024 = mq.takeSectionTranspose({ start: sectionStart - 0.24, section: 'Hook' }, mq.getSong());
    out.push({
      ...cfg, sectionStart, floorStart: floored.start, ceilStart: ceiled.start,
      floorLookup: floored.start + mq.TAKE_PREROLL_SEC,
      earlyBy: sectionStart - (floored.start + mq.TAKE_PREROLL_SEC),
      transFloor, transCeil, trans024,
    });
  }
  return out;
});
for (const row of floorTrim) {
  ok(`Floor-trim + slop at ${row.sr}Hz ${row.bpm}bpm (${row.bars1} bars) uses Hook@+2, not the previous Hook`,
    row.transFloor === 2 && row.transCeil === 2 && row.trans024 === 2, JSON.stringify(row));
}


// --- Default Tone is spectrally bright (not the old ~3.3 kHz dull default) ---
const bright = await page.evaluate(async () => {
  const mq = window.__mq;
  const hfRatio = (buf, fc = 8000) => {
    const x = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const rc = 1 / (2 * Math.PI * fc);
    const dt = 1 / sr;
    const a = rc / (rc + dt);
    let y = 0, prev = 0, hs = 0, ts = 0;
    for (let i = 0; i < x.length; i++) {
      y = a * (y + x[i] - prev);
      prev = x[i];
      hs += y * y;
      ts += x[i] * x[i];
    }
    return ts > 0 ? hs / ts : 0;
  };
  const hatsOnly = () => {
    mq.update((s) => {
      s.takes = [];
      s.recipe.bpm = 120;
      s.recipe.palette = 'clean';
      s.sections = [{ id: 'x', type: 'Hook', bars: 2, layers: { drums: true, bass: false, chords: false, melody: false, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 }];
      s.parts.Hook = [];
      for (const r of ['kick', 'snare', 'hat', 'bass', 'clap', 'open', 'perc']) {
        s.beats.A[r] = s.beats.A[r].map((_, i) => (r === 'hat' && i % 2 === 0 ? 1 : 0));
      }
      s.mix.drums.inst = 'tight';
      s.mix.drums.drive = 0;
      s.mix.drums.character = 0;
    });
  };
  const renderAt = async (tone, inst = 'tight') => {
    hatsOnly();
    mq.update((s) => { s.mix.drums.tone = tone; s.mix.drums.inst = inst; });
    const buf = await mq.renderSong(mq.getSong(), ['drums']);
    const ch = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
    return { ratio: hfRatio(buf), peak };

  };
  const t0 = await renderAt(0);
  const tDef = await renderAt(0.5);
  const t1 = await renderAt(1);
  const darkKit = await renderAt(0.5, 'trapdark');
  const tightKit = tDef;
  return { t0, tDef, t1, darkKit, tightKit };
});
ok('Default Tone (50) keeps hat brightness close to fully open, unlike Tone 0',
  bright.tDef.peak > bright.t0.peak * 5 && Math.abs(bright.tDef.ratio - bright.t1.ratio) < 0.05,
  JSON.stringify(bright));
ok('Dark trap hats are not buried by the 4 kHz body filter (HF comparable to Tight)',
  bright.darkKit.ratio > bright.tightKit.ratio * 0.5 && bright.darkKit.peak > 0.02,
  JSON.stringify(bright));

// --- Sound picker ---

await page.click('[data-tab="song"]');
await page.click('[data-testid="sound-open-chords"]');
await page.waitForSelector('[data-testid="sound-picker"]');
const picker = await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="sound-picker"]');
  const items = [...sheet.querySelectorAll('.sound-item b')].map((el) => el.textContent);
  const cats = [...sheet.querySelectorAll('.sound-cats .chip')].map((el) => el.textContent);
  const macros = !!document.querySelector('[data-testid="macros-chords"]');
  return { items: items.slice(0, 8), nItems: items.length, cats, macros, w: sheet.getBoundingClientRect().width };
});
ok('Sound picker lists grouped presets on a 390×844 phone', picker.nItems >= 10 && picker.cats.includes('All') && picker.macros, JSON.stringify(picker));
await page.screenshot({ path: `${SHOTS}/mobile-sound-picker-390x844.png`, fullPage: false });
await page.click('.sound-sheet button:has-text("Close")');

// --- Legacy mix (no saved macros) must match pre-library sound, not the new Drive/Character defaults ---
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'legacy-pre-library.wav');
const legacy = await page.evaluate(async () => {
  const mq = window.__mq;
  const stats = (buf) => {
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, hf = 0, prev = 0, y = 0;
    const sr = buf.sampleRate, rc = 1 / (2 * Math.PI * 8000), dt = 1 / sr, a = rc / (rc + dt);
    for (let i = 0; i < d.length; i++) {
      const x = d[i]; const ax = Math.abs(x); if (ax > peak) peak = ax;
      sum += x * x;
      y = a * (y + x - prev); prev = x; hf += y * y;
    }
    return { peak, rms: Math.sqrt(sum / d.length), hf: Math.sqrt(hf / d.length), len: d.length, sr: buf.sampleRate };
  };
  // Install the fixture (inlined to avoid bundling).
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
    for (const id of ['drums', 'bass', 'chords', 'melody', 'vocals']) {
      delete s.mix[id].tone; delete s.mix[id].drive; delete s.mix[id].character;
      s.mix[id].inst = undefined; s.mix[id].mute = false; s.mix[id].solo = false;
    }
    s.mix.drums.vol = 0.8; s.mix.bass.vol = 0.75; s.mix.chords.vol = 0.6; s.mix.melody.vol = 0.7; s.mix.vocals.vol = 0.9; s.mix.master = 0.85;
  });
  const has = mq.mixHasMacros(mq.getSong().mix);
  const macros = mq.macrosForTrack(mq.getSong().mix, 'drums');
  const migrated = mq.migrateSong(JSON.parse(JSON.stringify(mq.getSong())));
  const bufLegacy = await mq.renderSong(mq.getSong());
  mq.update((s) => {
    for (const id of ['drums', 'bass', 'chords', 'melody', 'vocals']) Object.assign(s.mix[id], mq.DEFAULT_MACROS);
  });
  const bufNew = await mq.renderSong(mq.getSong());
  // wav of the no-macro render
  const ch = Math.min(2, bufLegacy.numberOfChannels), len = bufLegacy.length, sr = bufLegacy.sampleRate;
  const dataLen = len * ch * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, dataLen, true);
  const chans = Array.from({ length: ch }, (_, i) => bufLegacy.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const x = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  const bytes = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return {
    has, macros, migrated: mq.macrosForTrack(migrated.mix, 'drums'),
    stLegacy: stats(bufLegacy), stNew: stats(bufNew), wavB64: btoa(bin),
  };
});
ok('A song with no saved macros is treated as legacy (drive 0, character 0)',
  legacy.has === false && legacy.macros.legacy === true && legacy.macros.drive === 0 && legacy.macros.character === 0,
  JSON.stringify({ has: legacy.has, macros: legacy.macros }));
ok('migrate() writes legacy-neutral macros onto a pre-library song',
  legacy.migrated.drive === 0 && legacy.migrated.character === 0 && legacy.migrated.tone === 0.5,
  JSON.stringify(legacy.migrated));
ok('Legacy mix render differs from the new Drive/Character defaults (not accidentally the same path)',
  Math.abs(legacy.stLegacy.rms - legacy.stNew.rms) / Math.max(legacy.stNew.rms, 1e-6) > 0.02
    || Math.abs(legacy.stLegacy.hf - legacy.stNew.hf) / Math.max(legacy.stNew.hf, 1e-6) > 0.02,
  JSON.stringify({ legacy: legacy.stLegacy, neu: legacy.stNew }));

if (fs.existsSync(GOLDEN)) {
  const golden = fs.readFileSync(GOLDEN);
  const got = Buffer.from(legacy.wavB64, 'base64');
  const readStats = (buf) => {
    const n = (buf.length - 44) / 2;
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const s = buf.readInt16LE(44 + i * 2) / 32768;
      const a = Math.abs(s); if (a > peak) peak = a;
      sum += s * s;
    }
    return { peak, rms: Math.sqrt(sum / n), bytes: buf.length };
  };
  const g = readStats(golden), c = readStats(got);
  const relRms = Math.abs(g.rms - c.rms) / Math.max(g.rms, 1e-6);
  const relPeak = Math.abs(g.peak - c.peak) / Math.max(g.peak, 1e-6);
  ok('Legacy render is close to the pre-library (6b83602) golden WAV',
    g.bytes === c.bytes && relRms < 0.05 && relPeak < 0.25,
    JSON.stringify({ golden: g, current: c, relRms, relPeak }));
} else {
  ok('Pre-library golden WAV is present for a null/close test', false, `missing ${GOLDEN}`);
}

// Export must call engine.stop (not window.stop) so transport actually halts.
{
  await page.evaluate(async () => {
    window.__mq.update((s) => {
      s.beats.A.kick[0] = 1;
      s.beats.A.hat[0] = 1;
    });
    await window.__mq.play({ kind: 'song' });
  });
  await page.waitForTimeout(400);
  const playingBefore = await page.evaluate(() => window.__mq.isPlaying());
  ok('Playback running before export stop check', playingBefore === true);
  await page.evaluate(async () => { await window.__mq.stop(); });
  const playingAfter = await page.evaluate(() => window.__mq.isPlaying());
  ok('engine.stop halts transport (SongTab must import this, not DOM stop)', playingAfter === false);
  // Song tab export path: clicking MIDI export should leave transport stopped
  await page.evaluate(async () => {
    await window.__mq.play({ kind: 'song' });
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__mq.setUi({ tab: 'song' }));
  await page.click('[data-testid="export-midi"]');
  await page.waitForTimeout(800);
  const afterExport = await page.evaluate(() => window.__mq.isPlaying());
  ok('MIDI export leaves transport stopped (uses engine.stop)', afterExport === false);
}

ok('No page or console errors during regressions', errors.length === 0, errors.join(' | '));

console.log('\nSUMMARY');
for (const l of results) console.log(l);
await browser.close();
