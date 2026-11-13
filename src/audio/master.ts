// Master "Finish": a loudness stage at the end of the master bus (gain → soft clipper → limiter).
// Pure math lives here so it can be unit-tested in Node. All original code, no samples, no AI.

export type FinishId = 'off' | 'stream' | 'chart' | 'club';

export interface Finish { id: FinishId; label: string; driveDb: number; hint: string }

export const FINISHES: Finish[] = [
  { id: 'off', label: 'Pre-master', driveDb: 0, hint: 'Clean and quieter, with headroom for mastering elsewhere. Same sound as before Finish existed.' },
  { id: 'stream', label: 'Streaming', driveDb: 3, hint: 'About 3 dB louder. Gentle soft clip on the biggest peaks.' },
  { id: 'chart', label: 'Chart', driveDb: 6, hint: 'Loud like a current trap or hip-hop single. The soft clipper shaves the 808 and kick peaks.' },
  { id: 'club', label: 'Club', driveDb: 9, hint: 'Loudest. Hits hard, but long 808s and pads get denser. Check it on a phone.' },
];

/** Songs saved before Finish existed have no `finish`, so they stay on Pre-master. */
export function finishOf(mix: unknown): Finish {
  const id = (mix as { finish?: string } | undefined)?.finish;
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}

/** Input range the clipper curve covers (±CLIP_RANGE). A WaveShaper only reads −1…1, so the
 *  signal is scaled down by this before the shaper and the curve is built over the real range. */
export const CLIP_RANGE = 4;
/** Soft-clip knee (−6 dBFS) and ceiling (−1 dBFS). Below the knee the curve is a straight line. */
export const CLIP_KNEE = 0.5;
export const CLIP_CEILING = 10 ** (-1 / 20);

/** Soft clip for one sample value: linear up to the knee, then a tanh bend that never passes the ceiling. */
export function softClip(x: number, knee = CLIP_KNEE, ceiling = CLIP_CEILING): number {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const room = ceiling - knee;
  return Math.sign(x) * (knee + room * Math.tanh((a - knee) / room));
}

/** WaveShaper curve: index i maps to input (i / (n-1) * 2 − 1) * CLIP_RANGE. */
export function clipCurve(n = 8193): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = softClip(((i / (n - 1)) * 2 - 1) * CLIP_RANGE);
  return c;
}

/** Linear gain into the shaper for a finish: drive, then scaled into the curve's −1…1 domain. */
export function shaperInputGain(f: Finish): number {
  return 10 ** (f.driveDb / 20) / CLIP_RANGE;
}
