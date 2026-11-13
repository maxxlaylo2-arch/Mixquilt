/** Recording keeps at most this much audio before the chosen section start. */
export const TAKE_PREROLL_SEC = 0.25;
/** Snap the post-pre-roll lookup forward by this much so a take whose start was
 *  floor-rounded to the previous sample still lands in the intended section. */
export const TAKE_SECTION_SLOP_SEC = 0.005;

/** Mic-tab trim: drop samples before (sectionStart − pre-roll).
 *  The trim is rounded UP so start + pre-roll is at or after the section start. */
export function trimTakeToSection(start: number, sectionStartSec: number, sampleRate: number): { start: number; trimSamples: number } {
  const sr = sampleRate > 0 ? sampleRate : 44100;
  const target = sectionStartSec - TAKE_PREROLL_SEC;
  const trimSamples = Math.max(0, Math.ceil((target - start) * sr));
  return { start: start + trimSamples / sr, trimSamples };
}

/** Historical Mic-tab arithmetic (floor). Kept so tests can replay already-saved takes. */
export function trimTakeToSectionFloor(start: number, sectionStartSec: number, sampleRate: number): { start: number; trimSamples: number } {
  const sr = sampleRate > 0 ? sampleRate : 44100;
  const target = sectionStartSec - TAKE_PREROLL_SEC;
  const trimSamples = Math.max(0, Math.floor((target - start) * sr));
  return { start: start + trimSamples / sr, trimSamples };
}

/** Song time used to pick a take's section, after pre-roll and slop. */
export function takeLookupTime(start: number): number {
  return Math.max(0, start + TAKE_PREROLL_SEC + TAKE_SECTION_SLOP_SEC);
}
