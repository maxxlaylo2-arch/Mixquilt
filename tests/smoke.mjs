// Headless smoke test for the main flows. Uses the system Chrome with a fake microphone.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const URL = process.env.MQ_URL || 'http://localhost:4173/Mixquilt/';
const SHOTS = process.env.MQ_SHOTS || new globalThis.URL('../../screenshots', import.meta.url).pathname;
const EXPORTS = process.env.MQ_EXPORTS || new globalThis.URL('../../exports', import.meta.url).pathname;
const errors = [];
const results = [];
const ok = (name, cond, extra = '') => { const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`; results.push(l); console.log(l); if (!cond) process.exitCode = 1; };

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

const external = [];
async function newPage(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, acceptDownloads: true, permissions: ['microphone'] });
  await ctx.addInitScript(() => {
    window.__mqMicCalls = 0; window.__mqStreams = [];
    const md = navigator.mediaDevices; if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { window.__mqMicCalls++; const st = await orig(c); window.__mqStreams.push(st); return st; };
  });
  const page = await ctx.newPage();
  page.on('request', (r) => { const u = new globalThis.URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !/^(data|blob|chrome-extension):/.test(r.url())) external.push(r.url()); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${viewport.width}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${viewport.width}] pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
const tab = (page, id) => page.click(`[data-tab="${id}"]`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- mobile flow ----------------
{
  const { ctx, page } = await newPage({ width: 390, height: 844 }, true);
  await page.goto(URL);
  await page.waitForSelector('.hero h1');
  await page.screenshot({ path: `${SHOTS}/mobile-1-recipe.png`, fullPage: false });
  await page.fill('.title-input', 'Smoke Test Song'); await page.press('.title-input', 'Enter'); await page.click('.hero');
  await page.click('.mood:has-text("Hype")');
  await page.click('[data-testid="surprise"]');
  await page.waitForSelector('[data-testid="suggestions"]');
  await page.screenshot({ path: `${SHOTS}/mobile-2-surprise.png` });
  const nSug = await page.locator('.suggest-list li').count();
  ok('Surprise me proposes ingredients', nSug >= 5, `${nSug} suggestions`);
  await page.click('[data-testid="use-suggestions"]');
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/mobile-3-recipe-full.png`, fullPage: true });

  // Beat
  await tab(page, 'beat');
  const cells = (row) => page.locator(`.row-${row} .cell`);
  for (const i of [0, 3, 6]) await cells('kick').nth(i).click();
  for (const i of [4]) await cells('snare').nth(i).click();
  for (const i of [0, 2, 4, 6]) await cells('hat').nth(i).click();
  await cells('hat').nth(7).click(); await cells('hat').nth(7).click(); await cells('hat').nth(7).click(); // roll
  for (const i of [0, 3]) await cells('bass').nth(i).click();
  await page.click('.half-switch button:has-text("9")');
  for (const i of [8, 11, 14]) await cells('kick').nth(i).click();
  await cells('snare').nth(12).click();
  for (const i of [8, 10, 12, 14]) await cells('hat').nth(i).click();
  await cells('bass').nth(8).click();
  const on = await page.locator('.grid .cell[data-v]:not([data-v="0"])').count();
  ok('Beat grid toggles steps', on >= 15, `${on} active`);
  await page.click('[data-testid="play"]');
  await wait(1500);
  await page.screenshot({ path: `${SHOTS}/mobile-4-beat.png` });
  const playing = await page.locator('.play-btn.on').count();
  ok('Loop playback starts', playing === 1);
  await page.click('[data-testid="play"]');

  // Play
  await tab(page, 'play');
  await page.locator('.chord-chip').nth(1).click();
  await page.locator('.deg-grid .chip').nth(3).click();
  await page.locator('.chord-chip').nth(1).click();
  await page.click('[data-testid="rec-melody"]');
  const spb = 60 / Number((await page.locator('.t-sub').innerText()).match(/(\d+) BPM/)[1]);
  await wait(4 * spb * 1000 + 300);
  const pads = page.locator('.pad-key');
  await page.locator('[data-testid="note-roll"]').scrollIntoViewIfNeeded();
  for (const i of [8, 10, 12, 11, 9, 8, 13, 12]) {
    const b = await pads.nth(i).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await wait(spb * 450); await page.mouse.up(); await wait(spb * 450);
  }
  await page.click('[data-testid="rec-melody"]');
  const notes = await page.locator('.roll-note').count();
  ok('Melody pad records notes while looping', notes >= 6, `${notes} notes`);
  await page.screenshot({ path: `${SHOTS}/mobile-5-play.png` });
  await page.click('[data-testid="play"]');

  // Lyrics
  await tab(page, 'write');
  await page.waitForFunction(() => !document.querySelector('[data-testid="rhyme-input"]')?.hasAttribute('disabled'), null, { timeout: 15000 });
  const first = page.locator('textarea.lyrics').first();
  await first.fill('Lights on the city and I feel alive\nRunning every red light just to make it by\nEvery single heartbeat is a drum line\nWe could own the night if we take our time');
  await page.fill('[data-testid="rhyme-input"]', 'night');
  await page.click('form:has([data-testid="rhyme-input"]) button');
  await page.waitForSelector('[data-testid="rhymes"] .chip');
  const rhymes = await page.locator('[data-testid="rhymes"] .chip').allInnerTexts();
  ok('Rhyme finder returns rhymes for "night"', rhymes.includes('light') || rhymes.includes('bright'), rhymes.slice(0, 8).join(', '));
  const fits = await page.locator('.line-check .fit').count();
  ok('Syllable/bar counter shows per line', fits === 4);
  const scheme = await page.locator('.line-check .scheme').allInnerTexts();
  ok('Rhyme scheme letters', scheme.length === 4, scheme.join(''));
  await page.screenshot({ path: `${SHOTS}/mobile-6-lyrics.png` });

  // Mic (fake device)
  await tab(page, 'mic');
  const micBefore = await page.evaluate(() => window.__mqMicCalls);
  ok('Mic is not opened before the user taps Record', micBefore === 0, `${micBefore} getUserMedia calls`);
  await page.click('[data-testid="rec-vocal"]');
  await wait(4500);
  await page.screenshot({ path: `${SHOTS}/mobile-7-mic-recording.png` });
  await page.click('[data-testid="rec-vocal"]');
  await page.waitForSelector('.takes li', { timeout: 8000 }).catch(() => {});
  const takes = await page.locator('.takes li').count();
  ok('Vocal take recorded and saved', takes === 1);
  const micOff = await page.evaluate(() => window.__mqStreams.length > 0 && window.__mqStreams.every((st) => st.getTracks().every((t) => t.readyState === 'ended')));
  ok('Mic is released when recording stops', micOff);
  await page.screenshot({ path: `${SHOTS}/mobile-8-mic.png` });

  // Voice Polish on the recorded take
  await page.click('[data-testid="polish-open"]');
  await page.waitForSelector('[data-testid="polish-sheet"]');
  await page.screenshot({ path: `${SHOTS}/voice-polish-1-sheet.png` });
  await page.click('[data-testid="preset-tuned"]');
  const gotReport = await page.waitForFunction(() => /now \d+¢/.test(document.querySelector('[data-testid="polish-report"]')?.textContent || ''), null, { timeout: 60000 }).then(() => true).catch(() => false);
  const rep = gotReport ? await page.locator('[data-testid="polish-report"]').innerText() : '';
  ok('Voice Polish processes the take in a worker (Tuned preset)', gotReport, rep.replace(/\s+/g, ' '));
  await page.screenshot({ path: `${SHOTS}/voice-polish-2-tuned.png` });
  await page.click('[data-testid="polish-listen"]');
  await wait(700);
  await page.click('.ab-row .seg button:has-text("A ·")');
  const aOn = await page.getAttribute('.ab-row .seg button:has-text("A ·")', 'aria-checked');
  await wait(400);
  await page.click('.ab-row .seg button:has-text("B ·")');
  const bOn = await page.getAttribute('.ab-row .seg button:has-text("B ·")', 'aria-checked');
  ok('A/B bypass toggle switches', aOn === 'true' && bOn === 'true');
  await page.click('[data-testid="polish-finetune"] summary');
  await page.locator('[data-testid="polish-tune"]').fill('0.8');
  await page.locator('[data-testid="polish-finetune"]').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/voice-polish-3-finetune.png` });
  await page.waitForFunction(() => /now \d+¢/.test(document.querySelector('[data-testid="polish-report"]')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.click('[data-testid="polish-done"]');
  const badge = await page.locator('[data-testid="polish-open"]').innerText();
  ok('Take shows its Voice Polish badge', /Custom|Tuned/.test(badge), badge.replace(/\s+/g, ' '));
  await page.screenshot({ path: `${SHOTS}/voice-polish-4-takes.png` });
  const polishLog = await page.evaluate(() => window.__mq.getSong().log.filter((e) => e.kind === 'polish').map((e) => e.text));
  ok('Authorship log records the Voice Polish settings', polishLog.length === 1 && /no AI/.test(polishLog[0]), polishLog[0]?.slice(0, 110) + '…');
  const rawKept = await page.evaluate(async () => { const s = window.__mq.getSong(); const t = s.takes[0]; return !!t.polish && t.polish.settings.bypass === false; });
  ok('Polish settings stored on the take (raw kept separately)', rawKept);

  // synthetic off-pitch voice through the real worker; UI must stay responsive
  const syn = await page.evaluate(async () => {
    const sr = 48000, dur = 20, x = new Float32Array(sr * dur);
    const notes = []; const scaleNotes = [60, 62, 64, 65, 67, 69, 71, 72];
    for (let i = 0; i < 16; i++) notes.push([scaleNotes[i % 8], (i % 2 ? -1 : 1) * (30 + (i % 3) * 6), i * 1.2 + 0.1, 0.95]);
    for (const [m, c, st, len] of notes) {
      const f0 = 440 * 2 ** ((m + c / 100 - 69) / 12); let ph = 0;
      for (let i = Math.round(st * sr); i < Math.round((st + len) * sr); i++) {
        const t = i / sr - st; ph += 2 * Math.PI * f0 * 2 ** (0.12 * Math.sin(2 * Math.PI * 5 * t) / 12) / sr;
        let v = 0; for (let h = 1; h * f0 < 5000; h++) v += Math.sin(h * ph) / h * (1 / (1 + ((h * f0 - 700) / 500) ** 2));
        x[i] = 0.3 * v * Math.min(1, t / 0.02) * Math.min(1, (st + len - i / sr) / 0.05);
      }
    }
    let maxGap = 0, last = performance.now(), run = true;
    const tick = () => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    const res = await window.__mq.runPolish({ data: x, sr, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 120, takeStart: 0, params: { tune: 1, humanize: 0, timing: 0, grid: 0.25, mix: false, space: 'none' } });
    const ms = performance.now() - t0; run = false;
    const cents = (buf) => { const tr = window.__mq.trackPitch(buf, sr, 0.01); return notes.map(([m, , st, len]) => { const v = []; for (let k = 0; k < tr.f0.length; k++) { const t = k * tr.hop / sr; if (t > st + 0.15 && t < st + len - 0.1 && tr.voiced[k]) v.push(69 + 12 * Math.log2(tr.f0[k] / 440)); } v.sort((a, b) => a - b); return Math.round((v[v.length >> 1] - m) * 100); }); };
    return { ms: Math.round(ms), maxGap: Math.round(maxGap), before: cents(x), after: cents(res.data), inputIntact: x[Math.round(0.5 * sr)] !== 0 };
  });
  const worstBefore = Math.max(...syn.before.map(Math.abs)), worstAfter = Math.max(...syn.after.map(Math.abs));
  ok('Synthetic off-pitch voice (16 notes, 30-42¢ off) snaps to C major in the worker', worstBefore >= 28 && worstAfter <= 10, `worst ${worstBefore}¢ → ${worstAfter}¢; after: ${syn.after.join(',')}`);
  ok('UI stays responsive while a 20 s take is polished', syn.maxGap < 250, `${syn.ms} ms processing, longest frame gap ${syn.maxGap} ms`);

  // Song
  await tab(page, 'song');
  await page.screenshot({ path: `${SHOTS}/mobile-9-song.png` });
  await page.click('[data-testid="save-version"]');
  for (const [id, name] of [['export-midi', 'song.mid'], ['export-lyrics', 'lyrics.pdf'], ['export-log', 'authorship.pdf'], ['export-wav', 'mix.wav'], ['export-stems', 'stems.zip']]) {
    const dl = page.waitForEvent('download', { timeout: 300000 });
    await page.click(`[data-testid="${id}"]`);
    const d = await dl;
    const p = `${EXPORTS}/${d.suggestedFilename()}`;
    await d.saveAs(p);
    const size = fs.statSync(p).size;
    ok(`Export ${name}`, size > 500, `${d.suggestedFilename()} ${size} bytes`);
    if (name === 'authorship.pdf') { const txt = execFileSync('pdftotext', [p, '-']).toString(); ok('Authorship PDF lists Voice Polish', /Voice Polish/.test(txt) && /Tuned|Custom/.test(txt)); }
    if (name === 'stems.zip') { const z = execFileSync('unzip', ['-l', p]).toString(); ok('Stems include the polished vocal', /vocals\.wav/.test(z)); }
    await page.waitForSelector('.busy', { state: 'detached', timeout: 300000 });
  }
  await page.screenshot({ path: `${SHOTS}/mobile-10-song-full.png`, fullPage: true });
  const logN = await page.locator('[data-testid="log"] li').count();
  ok('Authorship log has entries', logN > 8, `${logN} shown`);

  // persistence + offline
  await page.reload();
  await page.waitForSelector('.hero h1');
  const title = await page.inputValue('.title-input');
  ok('Song persists after reload (IndexedDB)', title === 'Smoke Test Song', title);
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok('Service worker active', sw);
  const swInfo = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); return { scope: new URL(r.scope).pathname, start: m.start_url, mscope: m.scope }; });
  const basePath = new globalThis.URL(URL).pathname;
  ok('PWA scoped to the base path', swInfo.scope === basePath && swInfo.start === basePath && swInfo.mscope === basePath, JSON.stringify(swInfo));
  await tab(page, 'song');
  const copy = await page.locator('[data-testid="app-copyright"]').textContent().catch(() => '');
  ok('About shows the copyright line', /© 2026 Stephen Curran III, New York\. All rights reserved/.test(copy || ''));
  const disc = await page.locator('[data-testid="authorship-disclaimer"]').textContent();
  ok('Authorship wording: not legal advice, no guarantee, in-app only, not a registration', /not legal advice/.test(disc) && /doesn't guarantee/.test(disc) && /outside the app/.test(disc) && /isn't a copyright registration/.test(disc));
  await page.locator('[data-testid="open-privacy"]').scrollIntoViewIfNeeded();
  await page.click('[data-testid="open-privacy"]');
  const priv = await page.locator('[data-testid="legal-privacy"]').textContent();
  ok('In-app Privacy Policy', /No analytics, tracking, ads or cookies/.test(priv) && /not directed to children under 13/.test(priv));
  ok('Privacy explains GitHub Pages host logging with a link', /collects nothing/.test(priv) && (await page.locator('[data-testid="legal-privacy"] a[href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"]').count()) === 1);
  await page.screenshot({ path: `${SHOTS}/legal-1-privacy.png` });
  await page.click('.legal-sheet .seg button:has-text("Terms")');
  const terms = await page.locator('[data-testid="legal-terms"]').textContent();
  ok('In-app Terms of Use', /belong to you/.test(terms) && /as is/.test(terms) && /not legal advice/.test(terms) && /laws of the State of New York/.test(terms) && /state or federal courts located in New York/.test(terms) && /cannot be waived/.test(terms) && /not a copyright registration/.test(terms));
  ok('Privacy contact email shown (no placeholder left)', /maxxlaylo2@gmail\.com/.test(priv) && !/\{\{/.test(priv + terms) && /Stephen Curran III, New York\./.test(priv));
  await page.click('.legal-sheet .seg button:has-text("Licenses")');
  await page.waitForFunction(() => /CMU Pronouncing Dictionary/.test(document.querySelector('[data-testid="licenses-text"]')?.textContent || '') && /tone@/.test(document.querySelector('[data-testid="licenses-text"]')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  const lic = await page.locator('[data-testid="licenses-text"]').textContent();
  ok('In-app Licenses screen with full notices', /Carnegie Mellon/.test(lic) && /Kevin Atkinson/.test(lic) && /Permission is hereby granted/.test(lic), `${lic.length} chars`);
  await page.screenshot({ path: `${SHOTS}/legal-2-licenses.png` });
  await page.click('[data-testid="legal-done"]');
  ok('No cookies set', (await ctx.cookies()).length === 0);
  await ctx.setOffline(true);
  await page.goto(URL);
  await page.waitForSelector('.hero h1', { timeout: 10000 }).catch(() => {});
  const offline = await page.locator('.hero h1').count();
  ok('App loads offline', offline === 1);
  await tab(page, 'write');
  const offDict = await page.waitForFunction(() => !document.querySelector('[data-testid="rhyme-input"]')?.hasAttribute('disabled'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  ok('Rhyme dictionary works offline', offDict);
  await ctx.setOffline(false);
  await page.goto(URL + 'some/deep/link?x=1');
  await page.waitForSelector('.hero h1', { timeout: 15000 }).catch(() => {});
  const deepPath = new globalThis.URL(page.url()).pathname;
  ok('Deep link falls back to the app at the base path', deepPath === basePath && (await page.locator('.hero h1').count()) === 1, page.url());
  await ctx.close();
}

// ---------------- desktop screenshots ----------------
{
  const { ctx, page } = await newPage({ width: 1440, height: 900 }, false);
  await page.goto(URL);
  await page.waitForSelector('.hero h1');
  // fresh context = fresh IndexedDB; add a little content for the shots
  await page.click('.mood:has-text("Dreamy")');
  await page.screenshot({ path: `${SHOTS}/desktop-1-recipe.png` });
  await tab(page, 'beat');
  for (const i of [0, 7, 10]) await page.locator('.row-kick .cell').nth(i).click();
  for (const i of [4, 12]) await page.locator('.row-clap .cell').nth(i).click();
  for (let i = 0; i < 16; i += 2) await page.locator('.row-hat .cell').nth(i).click();
  for (const i of [0, 7, 10]) await page.locator('.row-bass .cell').nth(i).click();
  await page.screenshot({ path: `${SHOTS}/desktop-2-beat.png` });
  await tab(page, 'play');
  await page.screenshot({ path: `${SHOTS}/desktop-3-play.png` });
  await tab(page, 'write');
  await page.waitForFunction(() => !document.querySelector('[data-testid="rhyme-input"]')?.hasAttribute('disabled'), null, { timeout: 15000 });
  await page.fill('[data-testid="rhyme-input"]', 'heart');
  await page.click('form:has([data-testid="rhyme-input"]) button');
  await page.screenshot({ path: `${SHOTS}/desktop-4-lyrics.png` });
  await tab(page, 'mic');
  await page.screenshot({ path: `${SHOTS}/desktop-5-mic.png` });
  await page.click('[data-testid="rec-vocal"]'); await wait(6000); await page.click('[data-testid="rec-vocal"]');
  await page.waitForSelector('[data-testid="polish-open"]', { timeout: 8000 });
  await page.click('[data-testid="polish-open"]');
  await page.click('[data-testid="preset-polished"]');
  await page.waitForFunction(() => /now \d+¢/.test(document.querySelector('[data-testid="polish-report"]')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.click('[data-testid="polish-finetune"] summary');
  await page.screenshot({ path: `${SHOTS}/voice-polish-5-desktop.png` });
  await page.click('[data-testid="polish-done"]');
  await tab(page, 'song');
  await page.screenshot({ path: `${SHOTS}/desktop-6-song.png` });
  await page.click('[data-testid="songs"]');
  await page.screenshot({ path: `${SHOTS}/desktop-7-songs.png` });
  await ctx.close();
}
await browser.close();
ok('No network requests leave the device', external.length === 0, external.slice(0, 3).join(' '));
console.log('\nSUMMARY\n' + results.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNo console errors.');
