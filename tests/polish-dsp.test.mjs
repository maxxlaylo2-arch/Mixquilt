// Unit test for Voice Polish DSP using a synthetic, deliberately off-pitch "sung" signal.
// Run: node tests/polish-dsp.test.mjs   (Node 22.18+/24 strips the TypeScript types itself)
import { polish, trackPitch, hzToMidi } from '../src/audio/polishDsp.ts';

const SR = 48000;
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
// [scale note (midi), detune cents, start sec, length sec]; starts are deliberately late vs a 1/8 grid at 120 BPM (0.25 s)
const NOTES = [[64, +38, 0.25 + 0.045, 0.55], [67, -42, 1.0 + 0.06, 0.55], [69, +33, 1.75 + 0.04, 0.5], [62, -36, 2.5 + 0.05, 0.6]];

/** Vocal-like tone: band-limited sawtooth with two formant bumps, vibrato, attack/release. */
function voice(sr, totalSec, notes, vibCents = 18) {
  const x = new Float32Array(Math.round(sr * totalSec));
  for (const [m, cents, st, len] of notes) {
    const f0 = 440 * 2 ** ((m + cents / 100 - 69) / 12);
    const a = Math.round(st * sr), b = Math.round((st + len) * sr);
    let ph = 0;
    for (let i = a; i < b && i < x.length; i++) {
      const t = (i - a) / sr;
      const vib = 2 ** ((vibCents / 100) * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.15) / 12);
      ph += (2 * Math.PI * f0 * vib) / sr;
      let s = 0;
      for (let h = 1; h * f0 < 6000; h++) {
        const fh = h * f0;
        const form = Math.exp(-(((fh - 600) / 250) ** 2)) + 0.6 * Math.exp(-(((fh - 1700) / 400) ** 2)) + 0.15;
        s += (form / h) * Math.sin(h * ph);
      }
      const env = Math.min(1, t / 0.02) * Math.min(1, (b - i) / sr / 0.05);
      x[i] += 0.3 * s * env;
    }
  }
  return x;
}

function noteCents(x, notes, scale) {
  const tr = trackPitch(x, SR, 0.005);
  return notes.map(([m, , st, len]) => {
    const vals = [];
    const a = st + 0.12, b = st + len - 0.08; // skip attack/release
    for (let k = 0; k < tr.f0.length; k++) { const t = (k * tr.hop) / SR; if (t >= a && t <= b && tr.voiced[k]) vals.push(hzToMidi(tr.f0[k])); }
    vals.sort((p, q) => p - q);
    const med = vals[Math.floor(vals.length / 2)];
    return { target: m, cents: Math.round((med - m) * 100) };
  });
}
function onsets(x, thr = 0.01) {
  const hop = 48, out = []; let quiet = 1000;
  for (let i = 0; i + hop < x.length; i += hop) { let e = 0; for (let j = 0; j < hop; j++) e = Math.max(e, Math.abs(x[i + j])); if (e < thr) quiet++; else { if (quiet > 100) out.push(i / SR); quiet = 0; } }
  return out;
}

let fails = 0;
const check = (name, cond, info) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} — ${info}`); if (!cond) fails++; };

const input = voice(SR, 3.4, NOTES);
const before = noteCents(input, NOTES, C_MAJOR);
check('Detector measures the input detune', before.every((b, i) => Math.abs(b.cents - NOTES[i][1]) <= 6), JSON.stringify(before.map((b) => b.cents)));

const base = { grid: 0.5, mix: false, space: 'none', timing: 0 };
const t0 = performance.now();
const hard = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 1, humanize: 0 } });
const ms = performance.now() - t0;
const hardC = noteCents(hard.data, NOTES, C_MAJOR);
check('Tuned (hard): every note within 8 cents of the scale note', hardC.every((c) => Math.abs(c.cents) <= 8), JSON.stringify(hardC.map((c) => c.cents)));
check('Report shows error went down', hard.report.avgErrorCentsAfter < hard.report.avgErrorCentsBefore / 2, `${hard.report.avgErrorCentsBefore.toFixed(1)} -> ${hard.report.avgErrorCentsAfter.toFixed(1)} cents`);
check('Speed: 3.4 s take processed fast', ms < 3000, `${ms.toFixed(0)} ms`);

const nat = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 0.35, humanize: 0.7 } });
const natC = noteCents(nat.data, NOTES, C_MAJOR);
check('Natural: notes move toward the scale but less than Tuned', natC.every((c, i) => Math.abs(c.cents) < Math.abs(before[i].cents) - 8 && Math.abs(c.cents) >= Math.abs(hardC[i].cents) - 2), JSON.stringify(natC.map((c) => c.cents)));

const off = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 0, humanize: 0 } });
const offC = noteCents(off.data, NOTES, C_MAJOR);
check('Tuning off leaves pitch alone', offC.every((c, i) => Math.abs(c.cents - before[i].cents) <= 3), JSON.stringify(offC.map((c) => c.cents)));

// vibrato kept with humanize: measure pitch spread on a held note
const spread = (x) => { const tr = trackPitch(x, SR, 0.005); const v = []; for (let k = 0; k < tr.f0.length; k++) { const t = (k * tr.hop) / SR; if (t > 0.5 && t < 0.75 && tr.voiced[k]) v.push(hzToMidi(tr.f0[k])); } return (Math.max(...v) - Math.min(...v)) * 100; };
const vibIn = spread(input), vibHard = spread(hard.data);
const hum = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 1, humanize: 1 } });
const vibHum = spread(hum.data);
check('Hard tune flattens vibrato; humanize keeps it', vibHard < vibIn * 0.6 && vibHum > vibIn * 0.6, `input ${vibIn.toFixed(0)}c, hard ${vibHard.toFixed(0)}c, humanize ${vibHum.toFixed(0)}c`);

// timing
const tim = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 0, humanize: 0, timing: 1 } });
const oIn = onsets(input), oOut = onsets(tim.data);
const err = (os) => os.map((o) => Math.abs(o - Math.round(o / 0.25) * 0.25) * 1000);
const eIn = err(oIn), eOut = err(oOut);
check('Timing tighten pulls phrase starts onto the 1/8 grid', oOut.length === 4 && eOut.every((e) => e < 12) && Math.max(...eIn) > 35, `in ${eIn.map((e) => e.toFixed(0)).join('/')} ms, out ${eOut.map((e) => e.toFixed(0)).join('/')} ms, moved ${tim.report.phrasesMoved}`);
const half = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { ...base, tune: 0, humanize: 0, timing: 0.5 } });
const eHalf = err(onsets(half.data));
check('Timing strength 50% moves about halfway', eHalf.every((e, i) => e < eIn[i] * 0.7 && e > eIn[i] * 0.3), eHalf.map((e) => e.toFixed(0)).join('/') + ' ms');

// mix chain sanity
const full = polish({ data: input, sr: SR, scale: C_MAJOR, bpm: 120, takeStart: 0, params: { tune: 0.65, humanize: 0.4, timing: 0.45, grid: 0.5, mix: true, space: 'both' } });
let pk = 0, nan = false; for (const v of full.data) { if (!Number.isFinite(v)) nan = true; pk = Math.max(pk, Math.abs(v)); }
check('Mix chain + space: finite, no clipping, adds a tail', !nan && pk < 1 && full.data.length > input.length + SR, `peak ${pk.toFixed(2)}, length ${(full.data.length / SR).toFixed(2)} s`);
check('Original input untouched (non-destructive)', voice(SR, 3.4, NOTES).every((v, i) => v === input[i]), 'input buffer unchanged');

console.log(fails ? `\n${fails} FAILED` : '\nAll Voice Polish DSP tests passed.');
process.exit(fails ? 1 : 0);
