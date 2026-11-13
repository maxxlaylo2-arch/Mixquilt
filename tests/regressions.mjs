// Playwright regressions for the 2026-11-13 bug-fix pass. Needs the preview server.
import { chromium } from 'playwright';
import fs from 'node:fs';
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

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector('.hero h1');

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

ok('No page or console errors during regressions', errors.length === 0, errors.join(' | '));


console.log('\nSUMMARY');
for (const l of results) console.log(l);
await browser.close();
