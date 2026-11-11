// GitHub Pages serves 404.html for unknown paths. The app has no routes, so send any unknown
// path under the site back to the app's start URL (read from the built manifest).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (existsSync('dist/index.html')) {
  let start = './';
  try { start = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8')).start_url || start; } catch {}
  if (start.startsWith('/')) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mixquilt</title>
<meta name="robots" content="noindex"><script>location.replace(${JSON.stringify(start)} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=${start}"></head><body><a href="${start}">Open Mixquilt</a></body></html>\n`;
    writeFileSync('dist/404.html', html);
    console.log(`postbuild: wrote dist/404.html -> ${start}`);
  }
}
