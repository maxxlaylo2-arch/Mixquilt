# Mixquilt (v0.1) — AI-free song studio PWA

Make songs by hand: pick a recipe (mood, key, mode, tempo, groove, chords, structure, sound palette),
build beats on a step grid, play scale-locked melodies (touch, computer keyboard or MIDI), write lyrics
with a rhyme finder and syllable/bar counter, record vocals over the beat, arrange, mix and export.
No AI anywhere. All sounds are synthesized in the browser (Tone.js / Web Audio). Data stays on the device (IndexedDB).

Live app: https://maxxlaylo2-arch.github.io/Mixquilt/

> **Copyright (c) 2026 Stephen Curran III. All rights reserved.**
> This is proprietary software. No permission is granted to copy, modify, distribute or use the code, in whole or in
> part, without written permission from the copyright holder, except for the limited rights GitHub's Terms of Service
> (Section D.5) give other users to view and fork this repository on GitHub.
> See [LICENSE](LICENSE). Songs you make with the app are yours. Third-party components keep their own licenses
> (see [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)). The CMU Pronouncing Dictionary notice and license must be kept with its data.

## Run
    npm install
    npm run dev          # dev server (includes window.__mq test hooks)
    npm run build        # type-check + production build into dist/ (no __mq, no sourcemaps)
    npm run build:test   # production-like build with VITE_TEST_HOOKS=true for Playwright
    npm run build:native # build with relative paths (BASE_PATH=./) for Capacitor
    npm run preview      # serve dist/ on http://localhost:4173/Mixquilt/
    npm run test:unit    # theory / polish / preroll / master (no browser)
    npm run smoke        # Playwright smoke (Chrome or MQ_CHROME / Playwright Chromium)
    npm run regressions  # Playwright regressions (needs build:test + preview)

## Backup
- **Full backup (.zip)** — song + vocal audio (and polish caches). Prefer this when moving devices.
- **JSON only** — arrangement/lyrics/mix without takes. Importing JSON creates a new song with empty vocals.

## Layout
- `src/theory.ts` rule tables (keys, modes, progressions, grooves, structures, moods, palettes)
- `src/suggest.ts` "Surprise me" (building blocks only, no-repeat memory, wildness dial)
- `src/audio/` instruments (`rig.ts`), event compiler (`compose.ts`), transport (`engine.ts`),
  mic recording + latency calibration (`mic.ts`, `public/recorder-worklet.js`), takes, exports (WAV/stems/MIDI)
- `src/audio/voicePolish.ts` + `polishDsp.ts` + `polish.worker.ts` non-AI pitch/timing "Voice Polish"
- `src/lyrics/dict.ts` CMU Pronouncing Dictionary rhymes/syllables (data built by `scripts/build-dict.mjs`)
- `src/pdf.ts` lyric sheet + authorship log PDFs
- `src/ui/` Preact screens (Recipe, Beat, Play, Lyrics, Mic, Song)

## Wrapping as a mobile app (Capacitor)
`@capacitor/core` / `@capacitor/cli` are in package.json. `capacitor.config.json` points at `dist/`.

    npm run build:native          # BASE_PATH=./ production web build
    npx cap add ios               # once
    npx cap add android           # once
    npm run cap:sync              # build:native + cap sync

Then open Xcode / Android Studio. Add microphone usage strings (iOS `NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`) before shipping store builds.

## Licenses
CMU Pronouncing Dictionary (BSD-2-Clause) and SCOWL word lists notices are in `public/licenses/`,
shown in-app under Song → About. All other shipped packages are permissive (MIT, 0BSD, Apache-2.0); `THIRD-PARTY-NOTICES.txt` has the full texts and is regenerated on every build (the build fails on copyleft or unknown licenses).

## Testing
    npm run build && npm run preview &      # serves dist/ on :4173
    npm run smoke                           # end-to-end smoke test (fake mic), screenshots -> ../screenshots, exports -> ../exports
    node tests/levels.mjs                   # renders every built-in instrument and prints its loudness (keeps palettes balanced)

`window.__mq` (getSong/update/renderSong) is a small hook the tests use.

### Voice Polish (classic DSP, no AI)

Mic tab → a take's **✨ Voice Polish** button. Presets Off / Natural / Polished / Tuned, A/B (original vs polished), and Fine-tune sliders (tuning strength/retune speed, humanize, timing tighten to 1/8 or 1/16, "sit in the mix" chain, room/echo space). Processing runs in a Web Worker (`src/audio/polish.worker.ts`), using YIN pitch tracking + TD-PSOLA snapped to the song's key/scale, phrase-onset timing nudges, and a high-pass / de-ess / compressor / presence EQ / tempo-synced echo / room chain (`src/audio/polishDsp.ts`). It's non-destructive: the raw take stays in IndexedDB, the polished render is cached separately, and playback plus WAV/stem exports use it. Applying or removing it is written to the authorship log.

    npm run test:polish   # Node DSP test with synthetic off-pitch vocal-like tones

## Hosting (GitHub Pages)
`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`, using
`actions/deploy-pages`. In the repo, go to Settings → Pages and set Source to **GitHub Actions**. The base path comes from
`BASE_PATH` (default `/Mixquilt/`; the workflow sets it to `/<repo name>/`, which is case-sensitive). The manifest
`start_url`/`scope` and the service worker scope follow the base. `dist/404.html` sends unknown paths back to the app.

## Privacy, terms and compliance
- [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md) (New York governing law) are also shown in the app (Song → About → Privacy / Terms / Licenses).
- Mixquilt itself collects nothing: no analytics, trackers, cookies, accounts or network calls besides loading the app itself (GitHub Pages, the host, may log IP addresses under its own privacy statement). Songs and takes live in IndexedDB on the device. The mic is opened only when you tap Record or Auto-measure, and it is released as soon as that stops.
- Assets: instrument sounds are synthesized at runtime, the icons are original (`public/icons/icon.svg`, rendered by `scripts/make-icons.mjs`), and system fonts are used (no font files bundled).
