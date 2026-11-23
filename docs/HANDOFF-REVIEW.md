# Mixquilt handoff review — 2026-11-23

Audience: any model/engineer picking up Mixquilt next. This report separates **measured facts**,
**strong hypotheses**, and **not-tested areas**. Do not upgrade a hypothesis to a fact without the
isolation test listed for it. No hidden agenda: limitations and failures are stated plainly.

Repo: `/agent/repos/Mixquilt` · Branch: `cursor/studio-hardening-phases-4784` · PR #1 (open, CI green at time of writing)
Artifacts from this session: `/opt/cursor/artifacts/trap-beats/` (WAVs, screenshots, waveforms, logs)

---

## 1. What was done this session

Three hard-trap instrumentals were built **inside the real Mixquilt app** (test-hooks build,
`npm run build:test`, preview on port 4194) and exported with the app's own
Song → `export-wav` (WAV mixdown) button. Configuration was set through `window.__mq.update()`
(the same store the UI writes to); notes/patterns below are the exact inputs, so the beats are
reproducible.

| # | Title | File | Key/Mode | BPM | Kit | 808/Bass | Chords | Lead | Finish | Bars | Duration |
|---|-------|------|----------|-----|-----|----------|--------|------|--------|------|----------|
| 1 | Midnight Menace | `01-midnight-menace.wav` | D minor | 142 | trapdark | dirty808 | darkpad | glassbell | chart | 40 | 70.11 s |
| 2 | 808 Funeral | `02-808-funeral.wav` | F♯ phrygian | 145 | phonkbell | subglide | darkpad (stabs) | metalbell | club | 44 | 75.33 s |
| 3 | Choir of the Block | `03-choir-of-the-block.wav` | G harmonic minor | 138 | gospelclap | dirty808 | choirpad | bell | chart | 48 | 85.98 s |

Common recipe: half-time snare/clap on step 8, syncopated kick (steps 0/6/10 variants), 8th-note hats
with ghost (2) and roll (3) steps, bass row following kick rhythm on chord roots, 4-bar minor hook
riffs (note lists are in `/tmp/make-trap-beats.mjs`; regenerate from this table + patterns if needed).
Sections: beat 1 Intro–V–H–V(B)–H–Outro; beat 2 hook-first; beat 3 Intro–V–Pre–H–V(B)–H(B)–Post–Outro.
Durations match `bars × 4 × 60/BPM + 2.5 s tail` exactly — renders are complete, not truncated.
Creation log (`creation.log`) ends with `console/page errors: none`.

---

## 2. Measured audio facts (ffmpeg `loudnorm`/`volumedetect`, Python `wave`+`numpy`)

| Metric | 01 Midnight Menace | 02 808 Funeral | 03 Choir of the Block |
|---|---|---|---|
| Integrated loudness | −11.04 LUFS | **−4.17 LUFS** | −9.79 LUFS |
| True peak | −0.90 dBTP | −0.82 dBTP | −0.70 dBTP |
| RMS / crest factor | −8.93 dB / 8.0 dB | −5.27 dB / **4.4 dB** | −8.44 dB / 7.6 dB |
| Hard-clipped samples (≥0.999) | 0.0000 % | 0.0000 % | 0.0000 % |
| Samples above −1 dBFS | 0.000 % | 0.028 % | 0.001 % |
| **DC offset (channel mean)** | **−0.266** | +0.001 | **−0.273** |
| 5 s-window DC after intro | ≈ −0.30 sustained | ≈ 0.001 | ≈ −0.30 sustained |
| Low-band energy 20–120 Hz (20–35 s window) | 2.9 % | 81.7 % | 3.9 % |
| Stereo correlation / width ratio | 0.950 / 0.106 | 0.987 / 0.080 | 0.945 / 0.115 |
| Silence | only final ~1.7–2.0 s tail | same | same |
| Spectral centroid (25–35 s) | 3502 Hz | 3700 Hz | 4049 Hz |

Waveform PNGs make the DC offset visible: in `01-…-waveform.png` the waveform sits shifted below
centre from the first verse onward; `02-…-waveform.png` is centred but very dense.

---

## 3. CONFIRMED BUG — DC offset in `dirty808` renders (high priority)

**Fact:** Beats 1 and 3 (both `bass: dirty808`) carry a sustained ≈ −0.30 DC offset on both channels
for the whole body of the song, starting exactly when the bass layer enters (intro windows ≈ 0).
Beat 2 (`bass: subglide`, otherwise similar chain) is clean at ≈ 0.001. No clipping occurs because
the master Finish soft-clipper is symmetric and the offset eats headroom instead.

**Strong hypothesis (not yet isolated):** `src/audio/voices.ts` `makeBass()` case `dirty808`:
```ts
mono(s, [add(new Tone.Chebyshev(4)), add(new Tone.Distortion(0.45)), add(new Tone.Filter(700, 'lowpass'))]);
```
Even-order Chebyshev polynomials have a non-zero value at x=0 (T₄(0)=1), so a sustained sine is
rectified into DC + even harmonics. `sub`/`subglide` use `Distortion` only and are clean.
`tapebass` uses `Chebyshev(2)` (T₂(0)=−1) and is **suspected of the same defect — unproven**.

**Isolation test for the next model (do this before changing code):**
1. Build test hooks, open the app, set a song to ONLY a bass pattern, `inst: dirty808`, render with
   `window.__mq.renderSong(window.__mq.getSong())`, compute channel means in-page or export and run:
   `python3 -c "import wave,numpy as np; w=wave.open('x.wav'); x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')/32768; print(x.reshape(-1,2).mean(axis=0))"`
2. Repeat with the Chebyshev removed / replaced (in a scratch build) and with `tapebass`, `sub`, `subglide`.
3. Only then fix. Candidate fixes to evaluate: drop the Chebyshev, use odd order (3) like the lead at
   `voices.ts:126` (T₃(0)=0), or add a DC-blocking highpass (~10–20 Hz) after the bass chain.
   Weigh tone change: even harmonics are part of the "dirty" character; a DC blocker preserves them.

**Test gap that let this ship:** `tests/levels.mjs` checks every voice for silence/clipping/RMS only.
Add a DC assertion (|channel mean| < 0.01 over a sustained note render) for every bass voice,
and ideally every voice. A song-level render assertion would have caught this immediately.

---

## 4. Loudness finding — `club` finish on dense material (design trade-off, not proven bug)

Beat 2 at `finish: club` (+9 dB drive, `src/audio/master.ts`) measures −4.17 LUFS, crest 4.4 dB,
loudness range 0.5 dB — effectively flat. The app's own hint warns Club "hits hard, but long 808s
and pads get denser", and the soft-clipper ceiling held (0 hard clips, −0.82 dBTP), so this is the
stage working as built. Whether −4 LUFS is "too much" is a musical judgement; flag for a human
listen before calling it a defect. Beats 1/3 at `chart` (−11.0 / −9.8 LUFS, crest ~8 dB) are in a
normal loud-trap range.

Other honest limitations of these exports:
- Stereo is narrow (correlation 0.945–0.987). Normal for trap low-end, but the mixes are near-mono overall.
- Beat 2 starts at full level (hook-first structure, first-0.5 s peak 0.89). Intentional, note for radio edits.
- Instrumentals only: no vocal takes exist, so the Mic/Voice Polish path was not exercised by these beats.

---

## 5. What is WORKING — verified this session (2026-11-23, this machine)

| Check | Command | Result |
|---|---|---|
| Unit/policy suites | `npm run test:unit` (theory, polish DSP, preroll, master, CSP, notices) | PASS (exit 0) |
| Browser regressions | `MQ_URL=http://127.0.0.1:4194/Mixquilt/ npm run regressions` | PASS, 66 PASS lines, no page/console errors |
| Master finish suite | `npm run test:finish` (same MQ_URL) | PASS (exit 0) |
| All voices | `npm run test:voices` (same MQ_URL; needs CSP-correct build) | PASS — "OK 89 voices, none silent or clipping" |
| Production build + verifier | `npm run build && npm run verify:production` | PASS (CSP, no sourcemaps, no `__mq`, PWA scope OK) |
| Dependency audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Trap beat creation (this session) | creator script in app, Song → WAV mixdown ×3 | 3 exports, 0 console/page errors |
| Latest remote CI (PR #1) | GitHub "Verify application" | SUCCESS (3 checks, deploy steps skip on PR by design) |

Also verified earlier and still true: full backup ZIP restore with vocals, malformed-backup
rejection, IndexedDB persistence, offline PWA, no-cookie/no-external-request behaviour (smoke suite,
green in CI). **Not re-run this session:** the full `npm run smoke` (≈5 min) — the creation run
exercised load/configure/export in the same browser path with zero errors, but do not cite this
report as a fresh full-smoke pass.

## 6. NOT tested / cannot be claimed

- **Native apps:** `android/` and `ios/` sync (`npm run cap:sync` passes) but have never been
  compiled here — no Android SDK/Xcode on this Linux VM. Signing, store builds, and real-device
  microphone/audio-route/interruption behaviour are unverified.
- **Real microphone:** all Mic/Voice Polish tests use a fake device. Latency calibration and
  Voice Polish on real voices/devices need a physical-device pass.
- **Human listening:** loudness/DC numbers are objective; nobody has critically listened to these
  three exports on monitors/headphones/car speakers yet. Do that before release decisions.
- **Backend:** there is none, by design (local-first, IndexedDB). Nothing was "removed" — git
  history has no server implementation. Add one only for accounts/sync/collaboration/billing,
  with the privacy/retention work listed in `docs/OPERATIONS.md`.

## 7. Suggested next debug tasks (in order)

1. Isolate and fix the §3 DC-offset defect (dirty808 first, then audit tapebass/Chebyshev(2) and
   the Chebyshev(3) lead for completeness). Add the DC assertion to `tests/levels.mjs`.
2. Re-render beats 1 and 3 after the fix and confirm |DC| < 0.01 and LUFS/peak stay in range;
   keep the pre-fix WAVs for A/B tone comparison (the fix may change the 808 character).
3. Human-listen pass on all three beats; decide if beat 2 stays `club` or drops to `chart`.
4. Full `npm run smoke` after any audio-chain change (it re-renders mix/stems/backup end to end).
5. Physical-device checklist in `docs/OPERATIONS.md` before any store submission.

## 8. Environment notes for reproduction

- Fresh VMs ship with incomplete `node_modules`: run `npm ci` before building (a bare
  `npm run build:test` fails with missing `@capacitor/*` until you do — environment, not app bug).
- Preview used here: `npx vite preview --host 0.0.0.0 --port 4194` after `npm run build:test`.
  Tests default to port 4173 — always set `MQ_URL` to the port you actually started.
- Creator script: `/tmp/make-trap-beats.mjs` must run from the repo root (Playwright resolves
  from `node_modules`); it was copied to `./make-trap-beats.tmp.mjs` for the run and deleted after.
- Analysis one-liners used: `ffmpeg -i x.wav -af loudnorm=print_format=json -f null -`,
  `ffprobe -show_entries format=duration`, and a `wave`+`numpy` script for DC/RMS/crest/band energy
  (recreate from §2 metric definitions).