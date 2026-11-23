import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || 'dist';
assert.ok(existsSync(root), `missing production directory: ${root}`);

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(root);
const rel = (path) => relative(root, path).replaceAll('\\', '/');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const scripts = files.filter((path) => path.endsWith('.js')).map((path) => readFileSync(path, 'utf8')).join('\n');

assert.match(html, /http-equiv="Content-Security-Policy"/, 'production index must include CSP');
assert.match(html, /script-src 'self' 'wasm-unsafe-eval' blob:/, 'CSP must allow Tone blob AudioWorklets');
assert.match(html, /connect-src 'self' blob:/, 'CSP must allow Tone to fetch blob AudioWorklets');
assert.equal(files.some((path) => path.endsWith('.map')), false, 'production must not ship source maps');
assert.equal(scripts.includes('__mq'), false, 'production must not expose test hooks');
assert.ok(existsSync(join(root, '404.html')), 'GitHub Pages fallback must exist');
assert.equal(manifest.start_url, manifest.scope, 'PWA start_url and scope must match');
assert.ok(manifest.start_url === './' || /^\/[^/]+\/$/.test(manifest.start_url), `unexpected PWA base path: ${manifest.start_url}`);

console.log(`PASS production bundle verified (${files.length} files; base ${manifest.start_url})`);
console.log(`Checked: ${files.map(rel).sort().join(', ')}`);
