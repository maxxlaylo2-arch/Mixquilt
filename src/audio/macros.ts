/** Mixer Tone macro → low-pass cutoff.
 *  0 is dark (~700 Hz). The default 0.5 (and any higher value) is transparent
 *  (~20 kHz), so older songs with no saved Tone, and new songs left at 50,
 *  sound like they did before the library added this filter. */
export const TONE_MIN_HZ = 700;
export const TONE_OPEN_HZ = 20000;

export function toneCutoffHz(tone = 0.5): number {
  const t = Math.max(0, Math.min(1, tone));
  if (t >= 0.5) return TONE_OPEN_HZ;
  return TONE_MIN_HZ * Math.pow(TONE_OPEN_HZ / TONE_MIN_HZ, t / 0.5);
}
