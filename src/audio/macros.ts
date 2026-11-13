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

export type MacroTrack = 'drums' | 'bass' | 'chords' | 'melody' | 'vocals';
export const MACRO_TRACKS: MacroTrack[] = ['drums', 'bass', 'chords', 'melody', 'vocals'];

/** Pre-library reverb send levels (Mixquilt before the sound-library update). */
export const LEGACY_SENDS: Record<MacroTrack, number> = { drums: 0.05, bass: 0, chords: 0.35, melody: 0.3, vocals: 0.18 };
/** Send levels at the new Character default (50). */
export const DEFAULT_SENDS: Record<MacroTrack, number> = { drums: 0.12, bass: 0.06, chords: 0.34, melody: 0.28, vocals: 0.32 };

export const LEGACY_MACROS = { tone: 0.5, drive: 0, character: 0 };
export const DEFAULT_MACROS = { tone: 0.5, drive: 0.2, character: 0.5 };

/** True when the saved mix never stored Tone / Drive / Character (pre-library songs). */
export function mixHasMacros(mix: unknown): boolean {
  const m = mix as Record<string, { tone?: number; drive?: number; character?: number }> | undefined;
  return MACRO_TRACKS.some((id) => {
    const t = m?.[id];
    return !!t && (t.tone != null || t.drive != null || t.character != null);
  });
}

export function macrosForTrack(mix: unknown, id: MacroTrack): { tone: number; drive: number; character: number; legacy: boolean } {
  const legacy = !mixHasMacros(mix);
  const d = legacy ? LEGACY_MACROS : DEFAULT_MACROS;
  const t = (mix as Record<string, { tone?: number; drive?: number; character?: number }> | undefined)?.[id] ?? {};
  return {
    tone: t.tone ?? d.tone,
    drive: t.drive ?? d.drive,
    character: t.character ?? d.character,
    legacy,
  };
}

/** Reverb send for a track at a Character value. 0 reproduces pre-library sends; 0.5 is DEFAULT_SENDS. */
export function sendLevel(id: MacroTrack, character: number): number {
  const c = Math.max(0, Math.min(1, character));
  const mid = DEFAULT_SENDS[id];
  if (c >= 0.5) return mid * (0.45 + c * 1.1);
  const lo = LEGACY_SENDS[id];
  return lo + (mid - lo) * (c / 0.5);
}
