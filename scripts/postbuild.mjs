// GitHub Pages serves 404.html for unknown paths. The app has no routes, so send any unknown
// path under the site back to the app's start URL (read from the built manifest).
// Also inject a production CSP (kept out of the Vite HTML so local HMR still works).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Note: frame-ancestors is ignored (and warns) when delivered via <meta>; omit it here.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

if (existsSync('dist/index.html')) {
  let html = readFileSync('dist/index.html', 'utf8');
  if (!html.includes('Content-Security-Policy')) {
    html = html.replace(
      /<head>/i,
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
    writeFileSync('dist/index.html', html);
    console.log('postbuild: injected Content-Security-Policy');
  }

  let start = './';
  try { start = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8')).start_url || start; } catch {}
  if (start.startsWith('/')) {
    const bounce = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mixquilt</title>
<meta name="robots" content="noindex"><script>location.replace(${JSON.stringify(start)} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=${start}"></head><body><a href="${start}">Open Mixquilt</a></body></html>\n`;
    writeFileSync('dist/404.html', bounce);
    console.log(`postbuild: wrote dist/404.html -> ${start}`);
  }
}
