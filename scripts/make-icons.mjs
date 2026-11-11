import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 0.12]]) {
  await p.setViewportSize({ width: size, height: size });
  const inner = size * (1 - pad * 2);
  await p.setContent(`<html><body style="margin:0;background:#14121f;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}.png`, omitBackground: false });
}
await b.close();
console.log('icons ok');
