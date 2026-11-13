import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.MQ_URL || 'http://127.0.0.1:4175/Mixquilt/';
const SHOTS = process.env.MQ_SHOTS || '/workspace/mixquilt-guidebook/test-beats/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });

const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const dp = await desk.newPage();
await dp.goto(URL);
await dp.waitForSelector('.hero h1');
await dp.click('[data-tab="song"]');
await dp.click('[data-testid="sound-open-chords"]');
await dp.waitForSelector('[data-testid="sound-picker"]');
await dp.screenshot({ path: `${SHOTS}/desktop-sound-picker-chords.png`, fullPage: false });
await dp.click('.sound-sheet button:has-text("Close")');
await dp.click('[data-testid="sound-open-drums"]');
await dp.waitForSelector('[data-testid="sound-picker"]');
await dp.screenshot({ path: `${SHOTS}/desktop-sound-picker-drums.png`, fullPage: false });
await dp.click('.sound-sheet button:has-text("Close")');
await dp.click('[data-testid="sound-open-bass"]');
await dp.waitForSelector('[data-testid="sound-picker"]');
await dp.screenshot({ path: `${SHOTS}/desktop-sound-picker-bass.png`, fullPage: false });
await desk.close();

// mixer macros visible on desktop without sheet
const desk2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p2 = await desk2.newPage();
await p2.goto(URL);
await p2.waitForSelector('.hero h1');
await p2.click('[data-tab="song"]');
await p2.locator('.mixer').scrollIntoViewIfNeeded();
await p2.screenshot({ path: `${SHOTS}/desktop-mixer-macros.png`, fullPage: false });
await desk2.close();

console.log('screenshots written');
await browser.close();
