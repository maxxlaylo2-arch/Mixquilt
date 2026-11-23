import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Web builds are hosted on GitHub Pages under /Mixquilt/ (the repo name, case-sensitive) by default. Override with BASE_PATH,
// e.g. BASE_PATH=/ for a root domain, or BASE_PATH=./ (npm run build:native) for Capacitor,
// where every asset path stays relative.
const rawBase = process.env.BASE_PATH ?? '/Mixquilt/';
const base = rawBase === './' || rawBase === '.' ? './' : '/' + rawBase.replace(/^\/+|\/+$/g, '') + (rawBase.replace(/\//g, '') ? '/' : '');

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'licenses/*', 'data/cmudict.txt'],
      manifest: {
        name: 'Mixquilt Song Studio',
        short_name: 'Mixquilt',
        description: 'Make your own songs: beats, chords, melodies, lyrics and vocals. No AI, all yours.',
        theme_color: '#14121f',
        background_color: '#14121f',
        display: 'standalone',
        orientation: 'any',
        id: base,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      scope: base,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,txt,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: base === './' ? 'index.html' : `${base}index.html`,
        navigateFallbackDenylist: [/\/licenses\//, /\/data\//],
      },
    }),
  ],
  preview: { allowedHosts: ['.trycloudflare.com', '.loca.lt', 'localhost'] },
  // Sourcemaps in production expose proprietary TypeScript on the public web.
  // Keep them for local `vite` / explicit CI test builds via VITE_SOURCEMAP=true.
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 1500,
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
  },
});
