// Voice Polish DSP. Classic signal processing only (no AI / machine learning):
//  - YIN pitch detection (de Cheveigné & Kawahara, 2002)
//  - scale-snapped correction with retune-speed smoothing and humanize
//  - TD-PSOLA pitch shifting (pitch-synchronous overlap-add)
//  - phrase-onset timing tighten (energy envelope + segment shift)
//  - mix chain: high-pass, de-esser, compressor, presence EQ, tempo-synced echo, small room reverb
// Self-contained (no imports) so it runs in a Web Worker and in Node tests.

export type Space = 'none' | 'room' | 'echo' | 'both';
export interface PolishParams {
  tune: number;      // 0..1  natural -> hard "tuned"
  humanize: number;  // 0..1  keep vibrato / scoops
  timing: number;    // 0..1  pull phrase starts toward the grid
  grid: number;      // grid size in beats (0.5 = 1/8 note, 0.25 = 1/16)
  mix: boolean;      // sit-in-the-mix chain
  space: Space;
}
export interface PolishInput { data: Float32Array; sr: number; scale: number[]; bpm: number; takeStart: number; params: PolishParams }
export interface PolishReport { voicedPct: number; avgErrorCentsBefore: number; avgErrorCentsAfter: number; phrases: number; phrasesMoved: number; meanShiftMs: number }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const hzToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

// ---------------- biquad ----------------
type BQ = { b0: number; b1: number; b2: number; a1: number; a2: number };
function bq(type: 'lp' | 'hp' | 'peak' | 'hshelf', f: number, sr: number, q = 0.7071, gainDb = 0): BQ {
  const w = 2 * Math.PI * f / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function filt(x: Float32Array, f: BQ): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

// ---------------- YIN pitch tracking ----------------
export interface PitchTrack { hop: number; f0: Float32Array; voiced: Uint8Array; rms: Float32Array }
/** Pitch per hop (seconds = i*hop/sr). Analysis runs on a decimated copy (~11-12 kHz) to stay fast. */
export function trackPitch(x: Float32Array, sr: number, hopSec = 0.005, fmin = 70, fmax = 1000): PitchTrack {
  const dec = Math.max(1, Math.floor(sr / 11025));
  const asr = sr / dec;
  let lp = x;
  if (dec > 1) { const f = bq('lp', asr * 0.42, sr); lp = filt(filt(x, f), f); }
  const a = new Float32Array(Math.floor(lp.length / dec));
  for (let i = 0; i < a.length; i++) a[i] = lp[i * dec];
  const tauMax = Math.ceil(asr / fmin), tauMin = Math.floor(asr / fmax);
  const W = Math.ceil(asr * 0.025);
  const hopA = Math.max(1, Math.round(asr * hopSec));
  const n = Math.max(0, Math.floor((a.length - W - tauMax) / hopA) + 1);
  const f0 = new Float32Array(n), voiced = new Uint8Array(n), rms = new Float32Array(n);
  const d = new Float32Array(tauMax + 1);
  let maxRms = 0;
  for (let k = 0; k < n; k++) {
    const o = k * hopA;
    let e = 0; for (let j = 0; j < W; j++) e += a[o + j] * a[o + j];
    rms[k] = Math.sqrt(e / W); if (rms[k] > maxRms) maxRms = rms[k];
  }
  const gate = Math.max(0.002, maxRms * 0.04);
  for (let k = 0; k < n; k++) {
    if (rms[k] < gate) continue;
    const o = k * hopA;
    d[0] = 1;
    let run = 0, best = -1;
    for (let t = 1; t <= tauMax; t++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = a[o + j] - a[o + j + t]; s += v * v; }
      run += s;
      d[t] = run > 0 ? (s * t) / run : 1;
    }
    for (let t = Math.max(2, tauMin); t < tauMax; t++) {
      if (d[t] < 0.15) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; best = t; break; }
    }
    if (best < 0) { // fall back to global min if it's clearly periodic
      let m = 1, mt = -1; for (let t = Math.max(2, tauMin); t < tauMax; t++) if (d[t] < m) { m = d[t]; mt = t; }
      if (m < 0.3) best = mt;
    }
    if (best < 0) continue;
    const y0 = d[best - 1], y1 = d[best], y2 = d[best + 1] ?? y1;
    const den = y0 - 2 * y1 + y2;
    const tt = best + (den !== 0 ? 0.5 * (y0 - y2) / den : 0);
    f0[k] = asr / tt; voiced[k] = 1;
  }
  // 5-point median on voiced runs removes octave blips
  const out = new Float32Array(f0);
  for (let k = 2; k < n - 2; k++) {
    if (!voiced[k]) continue;
    const w = [f0[k - 2], f0[k - 1], f0[k], f0[k + 1], f0[k + 2]].filter((v) => v > 0).sort((p, q) => p - q);
    out[k] = w[Math.floor(w.length / 2)];
  }
  return { hop: hopA * dec, f0: out, voiced, rms };
}

// ---------------- correction curve ----------------
function nearestScale(m: number, scale: number[]): number {
  let best = Math.round(m), bd = 99;
  for (let c = Math.floor(m) - 2; c <= Math.ceil(m) + 2; c++) {
    if (!scale.includes(((c % 12) + 12) % 12)) continue;
    const dd = Math.abs(c - m); if (dd < bd) { bd = dd; best = c; }
  }
  return best;
}
/** Per-frame correction in semitones. */
export function correctionCurve(tr: PitchTrack, sr: number, scale: number[], p: PolishParams) {
  const n = tr.f0.length, dt = tr.hop / sr;
  const corr = new Float32Array(n);
  const tauSmooth = 0.03 + p.humanize * 0.17;          // note-centre tracker
  const tauRetune = 0.004 + Math.pow(1 - p.tune, 1.6) * 0.22; // retune speed
  const amount = p.tune <= 0 ? 0 : 0.35 + 0.65 * p.tune;
  const aS = 1 - Math.exp(-dt / tauSmooth), aR = 1 - Math.exp(-dt / tauRetune), aOff = 1 - Math.exp(-dt / 0.03);
  let smooth = 0, target = NaN, c = 0, inNote = false;
  let errB = 0, errN = 0;
  for (let k = 0; k < n; k++) {
    if (tr.voiced[k] && tr.f0[k] > 0) {
      const m = hzToMidi(tr.f0[k]);
      if (!inNote) { smooth = m; target = NaN; inNote = true; }
      smooth += aS * (m - smooth);
      if (isNaN(target) || Math.abs(smooth - target) > 0.62) target = nearestScale(smooth, scale);
      const ref = m + p.humanize * (smooth - m);
      const want = clamp(amount * (target - ref), -2, 2);
      c += aR * (want - c);
      errB += Math.abs(m - nearestScale(m, scale)); errN++;
    } else { inNote = false; c += aOff * (0 - c); }
    corr[k] = c;
  }
  return { corr, avgErrCents: errN ? (errB / errN) * 100 : 0, voicedPct: n ? errN / n : 0 };
}

// ---------------- TD-PSOLA ----------------
export function psola(x: Float32Array, sr: number, tr: PitchTrack, corr: Float32Array): Float32Array {
  const N = x.length, hop = tr.hop, n = tr.f0.length;
  const frame = (i: number) => clamp(Math.floor(i / hop), 0, n - 1);
  const uvP = Math.round(sr * 0.008);
  // analysis marks one local period apart (float positions keep them phase-consistent)
  const marks: number[] = [], periods: number[] = [];
  let m = 0;
  while (m < N) {
    const k = frame(Math.round(m));
    const Pf = tr.voiced[k] && tr.f0[k] > 0 ? sr / tr.f0[k] : uvP;
    marks.push(Math.round(m)); periods.push(Math.round(Pf));
    m += Pf;
  }
  const out = new Float32Array(N), wsum = new Float32Array(N);
  let ts = 0, ai = 0;
  while (ts < N) {
    while (ai + 1 < marks.length && Math.abs(marks[ai + 1] - ts) <= Math.abs(marks[ai] - ts)) ai++;
    const ta = marks[ai], P = periods[ai];
    const r = Math.pow(2, corr[frame(ts)] / 12);
    for (let j = -P; j < P; j++) {
      const si = ts + j, xi = ta + j;
      if (si < 0 || si >= N || xi < 0 || xi >= N) continue;
      const w = 0.5 - 0.5 * Math.cos(Math.PI * (j + P) / P);
      out[si] += x[xi] * w; wsum[si] += w;
    }
    ts += Math.max(1, Math.round(P / r));
  }
  for (let i = 0; i < N; i++) out[i] = wsum[i] > 0.05 ? out[i] / wsum[i] : out[i] / 0.05;
  return out;
}

// ---------------- timing tighten ----------------
export function tightenTiming(x: Float32Array, sr: number, bpm: number, takeStart: number, p: PolishParams) {
  const hop = Math.round(sr * 0.0025), win = hop * 2;
  const n = Math.floor((x.length - win) / hop);
  const env = new Float32Array(Math.max(0, n));
  let mx = 0;
  for (let k = 0; k < n; k++) { let e = 0; for (let j = 0; j < win; j++) e += x[k * hop + j] ** 2; env[k] = Math.sqrt(e / win); mx = Math.max(mx, env[k]); }
  const thr = Math.max(0.003, mx * 0.08);
  const quietNeed = Math.round(0.12 / 0.0025);
  const onsets: number[] = [];
  let quiet = quietNeed;
  for (let k = 0; k < n; k++) {
    if (env[k] < thr) quiet++;
    else { if (quiet >= quietNeed) onsets.push(k * hop); quiet = 0; }
  }
  const gridSec = (60 / bpm) * p.grid;
  const maxShift = Math.min(0.08, gridSec * 0.45);
  const shifts = onsets.map((o) => {
    const songT = takeStart + o / sr;
    const g = Math.round(songT / gridSec) * gridSec;
    return Math.round(clamp((g - songT) * p.timing, -maxShift, maxShift) * sr);
  });
  if (!onsets.length || p.timing <= 0) return { out: x, phrases: onsets.length, moved: 0, meanShiftMs: 0 };
  const pad = Math.round(maxShift * sr) + 1;
  const out = new Float32Array(x.length + pad);
  const pre = Math.round(sr * 0.015), fi = Math.round(sr * 0.005), fo = Math.round(sr * 0.01);
  const starts = [0, ...onsets.map((o) => Math.max(0, o - pre))];
  const sh = [0, ...shifts];
  for (let s = 0; s < starts.length; s++) {
    const a = starts[s], b = s + 1 < starts.length ? starts[s + 1] : x.length, d = sh[s];
    for (let i = a; i < Math.min(x.length, b + fo); i++) {
      let g = 1;
      if (s > 0 && i - a < fi) g = (i - a) / fi;
      if (i >= b) g = 1 - (i - b) / fo;
      const t = i + d;
      if (t >= 0 && t < out.length) out[t] += x[i] * g;
    }
  }
  const moved = shifts.filter((v) => Math.abs(v) > sr * 0.003).length;
  const meanShiftMs = shifts.reduce((q, v) => q + Math.abs(v), 0) / shifts.length / sr * 1000;
  return { out: out.subarray(0, x.length + (pad > 0 ? pad : 0)), phrases: onsets.length, moved, meanShiftMs };
}

// ---------------- mix chain ----------------
function follower(x: Float32Array, sr: number, att: number, rel: number) {
  const a = Math.exp(-1 / (sr * att)), r = Math.exp(-1 / (sr * rel));
  const y = new Float32Array(x.length); let e = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); e = v > e ? a * e + (1 - a) * v : r * e + (1 - r) * v; y[i] = e; }
  return y;
}
export function mixChain(x: Float32Array, sr: number, bpm: number, space: Space, chain: boolean): Float32Array {
  let y = x;
  if (chain) {
    const hp = bq('hp', 95, sr); y = filt(filt(y, hp), hp);
    // de-esser: duck the >5.5 kHz band when it gets loud relative to the whole voice
    const hi = filt(filt(y, bq('hp', 5500, sr)), bq('hp', 5500, sr));
    const eh = follower(hi, sr, 0.001, 0.05), ef = follower(y, sr, 0.001, 0.05);
    const z = new Float32Array(y.length);
    for (let i = 0; i < y.length; i++) { const ratio = eh[i] / (ef[i] + 1e-6); const g = ratio > 0.3 ? Math.max(0.4, Math.pow(0.3 / ratio, 0.7)) : 1; z[i] = y[i] - hi[i] * (1 - g); }
    y = z;
    // compressor 3:1, threshold 18 dB under the loudest passages
    const env = follower(y, sr, 0.005, 0.12);
    let pk = 0; for (let i = 0; i < env.length; i++) if (env[i] > pk) pk = env[i];
    const thr = pk * Math.pow(10, -18 / 20), ratio = 3;
    const gs = Math.exp(-1 / (sr * 0.01)); let g = 1;
    const c = new Float32Array(y.length);
    for (let i = 0; i < y.length; i++) {
      const e = env[i]; const want = e > thr ? Math.pow(e / thr, 1 / ratio - 1) : 1;
      g = gs * g + (1 - gs) * want; c[i] = y[i] * g;
    }
    y = filt(filt(c, bq('peak', 3500, sr, 1, 3)), bq('hshelf', 10000, sr, 0.7, 1.5));
    let peak = 0; for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
    if (peak > 0) { const k = 0.7 / peak; for (let i = 0; i < y.length; i++) y[i] *= k; }
  }
  if (space === 'none') return y;
  const tail = Math.round(sr * 1.6);
  const out = new Float32Array(y.length + tail); out.set(y);
  if (space === 'echo' || space === 'both') {
    const d = Math.round(sr * (60 / bpm) * 0.75); // dotted eighth
    const buf = new Float32Array(out.length); let lp = 0;
    for (let i = 0; i < out.length; i++) {
      const fb = i >= d ? buf[i - d] : 0;
      lp += 0.35 * (fb - lp);
      buf[i] = (i < y.length ? y[i] : 0) * 0.5 + lp * 0.32;
    }
    for (let i = d; i < out.length; i++) out[i] += buf[i - d] * 0.32;
  }
  if (space === 'room' || space === 'both') {
    // small Schroeder/Freeverb-style room: 6 parallel damped combs + 3 allpasses
    const scale = sr / 44100;
    const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((v) => Math.round(v * scale * 0.8));
    const aps = [556, 441, 341].map((v) => Math.round(v * scale));
    const wet = new Float32Array(out.length);
    for (const L of combs) {
      const b = new Float32Array(L); let idx = 0, f = 0;
      for (let i = 0; i < out.length; i++) { const o = b[idx]; f = o * 0.7 + f * 0.3; b[idx] = (i < y.length ? y[i] : 0) * 0.015 + f * 0.78; wet[i] += o; idx = (idx + 1) % L; }
    }
    for (const L of aps) {
      const b = new Float32Array(L); let idx = 0;
      for (let i = 0; i < out.length; i++) { const bo = b[idx]; const v = -wet[i] + bo; b[idx] = wet[i] + bo * 0.5; wet[i] = v; idx = (idx + 1) % L; }
    }
    const amt = space === 'both' ? 0.8 : 1;
    for (let i = 0; i < out.length; i++) out[i] += wet[i] * amt;
  }
  return out;
}

// ---------------- full pipeline ----------------
export function polish(inp: PolishInput, progress?: (f: number, stage: string) => void): { data: Float32Array; report: PolishReport } {
  const { data, sr, scale, bpm, takeStart, params: p } = inp;
  progress?.(0.05, 'Finding pitch');
  const tr = trackPitch(data, sr);
  progress?.(0.4, 'Tuning');
  const cc = correctionCurve(tr, sr, scale, p);
  let y = p.tune > 0 ? psola(data, sr, tr, cc.corr) : data;
  progress?.(0.65, 'Tightening timing');
  const tt = tightenTiming(y, sr, bpm, takeStart, p);
  y = tt.out;
  progress?.(0.8, 'Mixing');
  y = mixChain(y, sr, bpm, p.space, p.mix);
  // measure the result
  let after = cc.avgErrCents;
  if (p.tune > 0) {
    const t2 = trackPitch(y.subarray(0, data.length), sr, 0.01);
    let e = 0, c = 0;
    for (let k = 0; k < t2.f0.length; k++) if (t2.voiced[k] && t2.f0[k] > 0) { const m = hzToMidi(t2.f0[k]); e += Math.abs(m - nearestScale(m, scale)); c++; }
    after = c ? (e / c) * 100 : 0;
  }
  progress?.(1, 'Done');
  return { data: y, report: { voicedPct: cc.voicedPct, avgErrorCentsBefore: cc.avgErrCents, avgErrorCentsAfter: after, phrases: tt.phrases, phrasesMoved: tt.moved, meanShiftMs: tt.meanShiftMs } };
}
