// Rule-based music theory library. Everything here is an unprotectable building block
// (keys, modes, tempos, common progressions, forms). Nothing composes melodies, lyrics or beats.

export const KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export interface ModeDef { id: string; name: string; feel: string; steps: number[]; bright: number }
export const MODES: ModeDef[] = [
  { id: 'major', name: 'Major', feel: 'bright, open', steps: [0, 2, 4, 5, 7, 9, 11], bright: 2 },
  { id: 'minor', name: 'Minor', feel: 'serious, emotional', steps: [0, 2, 3, 5, 7, 8, 10], bright: -1 },
  { id: 'dorian', name: 'Dorian', feel: 'hopeful minor, soulful', steps: [0, 2, 3, 5, 7, 9, 10], bright: 0 },
  { id: 'mixolydian', name: 'Mixolydian', feel: 'anthemic, bluesy', steps: [0, 2, 4, 5, 7, 9, 10], bright: 1 },
  { id: 'lydian', name: 'Lydian', feel: 'dreamy lift', steps: [0, 2, 4, 6, 7, 9, 11], bright: 3 },
  { id: 'phrygian', name: 'Phrygian', feel: 'dark tension', steps: [0, 1, 3, 5, 7, 8, 10], bright: -2 },
  { id: 'harmonic', name: 'Harmonic minor', feel: 'dramatic, exotic', steps: [0, 2, 3, 5, 7, 8, 11], bright: -1 },
];
export const modeById = (id: string) => MODES.find((m) => m.id === id) ?? MODES[0];

export type ChordQ = 'auto' | 'maj' | 'min' | 'dim' | 'sus2' | 'sus4';
export interface Chord { deg: number; q?: ChordQ; seventh?: boolean }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface ProgressionDef { id: string; label: string; chords: Chord[]; moods: string[]; tone: 'bright' | 'dark' | 'any' }
const P = (id: string, label: string, degs: (number | [number, ChordQ])[], moods: string[], tone: ProgressionDef['tone']): ProgressionDef => ({
  id, label, moods, tone,
  chords: degs.map((d) => (Array.isArray(d) ? { deg: d[0], q: d[1] } : { deg: d })),
});
export const PROGRESSIONS: ProgressionDef[] = [
  P('anthem', 'Anthem loop (1-5-6-4)', [0, 4, 5, 3], ['happy', 'uplifting', 'party', 'hype'], 'bright'),
  P('emo-pop', 'Emotional pop (6-4-1-5)', [5, 3, 0, 4], ['heartbreak', 'nostalgic', 'romantic', 'uplifting'], 'bright'),
  P('doowop', 'Fifties turn (1-6-4-5)', [0, 5, 3, 4], ['romantic', 'nostalgic', 'happy'], 'bright'),
  P('jazz-251', 'Jazz turnaround (2-5-1-1)', [1, 4, 0, 0], ['chill', 'romantic', 'focus'], 'any'),
  P('lift', 'Ballad lift (1-3-4-borrowed 4m)', [0, 2, 3, [3, 'min']], ['heartbreak', 'nostalgic', 'uplifting', 'dreamy'], 'bright'),
  P('epic-minor', 'Epic minor (1-6-3-7)', [0, 5, 2, 6], ['dark', 'angry', 'hype', 'heartbreak'], 'dark'),
  P('vamp', 'Two-chord vamp (1-7)', [0, 6, 0, 6], ['chill', 'dark', 'hype', 'focus'], 'any'),
  P('royal', 'Rising road (4-5-3-6)', [3, 4, 2, 5], ['uplifting', 'dreamy', 'nostalgic', 'romantic'], 'any'),
  P('rock-minor', 'Minor drive (1-4-5-1)', [0, 3, 4, 0], ['angry', 'dark', 'hype'], 'dark'),
  P('loop-down', 'Step down (1-7-6-7)', [0, 6, 5, 6], ['dark', 'party', 'hype', 'angry'], 'dark'),
  P('soul', 'Soul sway (1-4-1-5)', [0, 3, 0, 4], ['happy', 'party', 'chill'], 'any'),
  P('float', 'Floating (1-2-4-1)', [0, 1, 3, 0], ['dreamy', 'chill', 'focus'], 'bright'),
  P('plagal', 'Amen lift (4-1-4-1)', [3, 0, 3, 0], ['uplifting', 'chill', 'happy'], 'any'),
  P('tension', 'Tension climb (6-7-1-1)', [5, 6, 0, 0], ['hype', 'uplifting', 'party'], 'any'),
];

export interface GrooveDef { id: string; label: string; swing: number; feel: string }
export const GROOVES: GrooveDef[] = [
  { id: 'straight', label: 'Straight 16ths', swing: 0.5, feel: 'Even, tight timing' },
  { id: 'light', label: 'Light swing 54%', swing: 0.54, feel: 'Just a little bounce' },
  { id: 'swung', label: 'Swung 16ths 58%', swing: 0.58, feel: 'Head-nod bounce' },
  { id: 'shuffle', label: 'Shuffle 66%', swing: 0.66, feel: 'Triplet shuffle' },
  { id: 'lazy', label: 'Lazy swing 62%', swing: 0.62, feel: 'Laid back, behind the beat' },
];
export const grooveById = (id: string) => GROOVES.find((g) => g.id === id) ?? GROOVES[0];

export const GENRES = ['Boom-bap', 'Trap', 'Drill', 'Lo-fi', 'R&B', 'Afrobeats', 'Reggaeton', 'Pop', 'House', 'Techno', 'Drum & bass', 'Gospel', 'Country', 'Rock', 'Ballad', 'Amapiano', 'Club', 'Phonk', 'Jazz', 'Soul', 'Cinematic', 'Disco', 'Funk', 'Spoken word', 'Folk', 'Synthwave'];
export const GENRE_TEMPO: Record<string, [number, number]> = {
  'Boom-bap': [85, 95], Trap: [130, 150], Drill: [140, 145], 'Lo-fi': [70, 90], 'R&B': [60, 80], Afrobeats: [100, 115], Reggaeton: [90, 100],
  Pop: [100, 130], House: [120, 128], Techno: [125, 140], 'Drum & bass': [170, 175], Gospel: [70, 130], Country: [90, 120], Rock: [110, 140],
  Ballad: [60, 80], Amapiano: [110, 115], Club: [135, 145], Phonk: [130, 145], Jazz: [80, 140], Soul: [70, 100], Cinematic: [60, 100],
  Disco: [110, 125], Funk: [95, 115], 'Spoken word': [70, 95], Folk: [80, 120], Synthwave: [80, 118],
};

export interface PaletteDef { id: string; label: string; kit: string; bass: string; chords: string; lead: string }
export const PALETTES: PaletteDef[] = [
  { id: 'bells', label: '808 sub, bells, airy pad', kit: 'boom808', bass: 'sub', chords: 'pad', lead: 'bell' },
  { id: 'dusty', label: 'Dusty drums, electric keys, round bass', kit: 'dusty', bass: 'round', chords: 'ekeys', lead: 'softlead' },
  { id: 'organ', label: 'Tonewheel organ, piano, claps', kit: 'tight', bass: 'analog', chords: 'organ', lead: 'piano' },
  { id: 'plucks', label: 'Log drum, shaker, guitar-like plucks', kit: 'organic', bass: 'log', chords: 'pluck', lead: 'flute' },
  { id: 'cinema', label: 'Big drums, strings, analog bass', kit: 'big', bass: 'analog', chords: 'strings', lead: 'brass' },
  { id: 'vinyl', label: 'Warm keys, sub, flute', kit: 'dusty', bass: 'sub', chords: 'ekeys', lead: 'flute' },
  { id: 'neon', label: 'Punchy drums, saw bass, wide synth', kit: 'tight', bass: 'saw', chords: 'wide', lead: 'square' },
  { id: 'clean', label: 'Soft drums, piano, warm pad', kit: 'organic', bass: 'round', chords: 'piano', lead: 'softlead' },
];
export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export const KIT_OPTIONS = [['boom808', '808 boom'], ['dusty', 'Dusty'], ['tight', 'Tight'], ['organic', 'Organic'], ['big', 'Big room']];
export const BASS_OPTIONS = [['sub', 'Sub 808'], ['round', 'Round bass'], ['analog', 'Analog'], ['saw', 'Saw bass'], ['log', 'Log drum']];
export const CHORD_OPTIONS = [['pad', 'Airy pad'], ['ekeys', 'Electric keys'], ['organ', 'Organ'], ['pluck', 'Plucks'], ['strings', 'Strings'], ['wide', 'Wide synth'], ['piano', 'Piano']];
export const LEAD_OPTIONS = [['bell', 'Bell'], ['softlead', 'Soft lead'], ['piano', 'Piano'], ['flute', 'Flute'], ['brass', 'Brass'], ['square', 'Square lead']];

export const TWISTS = [
  { id: 'lift', label: 'Key lift on the last hook', how: 'In Song > Arrange, set the last Hook to +1 or +2 semitones.' },
  { id: 'acap', label: 'A cappella break', how: 'In Arrange, add a short section with every layer off except Vocals.' },
  { id: 'stop', label: 'Stop-time bars before the hook', how: 'Add a 1-2 bar Break before the Hook with only Chords on.' },
  { id: 'switch', label: 'Beat switch', how: 'Build Beat B in the Beat tab and set later sections to use it.' },
  { id: 'call', label: 'Call-and-response outro', how: 'Write short answer lines in the Outro and record two takes.' },
  { id: 'counter', label: 'Counter-melody in the final hook', how: 'Give the last Hook its own melody part and play an answer line.' },
  { id: 'cold', label: 'Cold open with the hook', how: 'Move a Hook to the very start of the arrangement.' },
  { id: 'strip', label: 'Stripped-down first verse', how: 'Turn Drums off for Verse 1 and bring them in at the Hook.' },
];

export type SectionType = 'Intro' | 'Verse' | 'Pre-hook' | 'Hook' | 'Post-hook' | 'Bridge' | 'Break' | 'Beat switch' | 'Outro' | 'Interlude';
export const SECTION_TYPES: SectionType[] = ['Intro', 'Verse', 'Pre-hook', 'Hook', 'Post-hook', 'Bridge', 'Break', 'Beat switch', 'Interlude', 'Outro'];

export interface StructureDef { id: string; label: string; parts: [SectionType, number][] }
export const STRUCTURES: StructureDef[] = [
  { id: 'classic', label: 'Classic: Intro–V–H–V–H–Bridge–H–Outro', parts: [['Intro', 4], ['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8], ['Bridge', 8], ['Hook', 8], ['Outro', 4]] },
  { id: 'hookfirst', label: 'Hook first: H–V–H–V–H–Bridge–H–H', parts: [['Hook', 8], ['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8], ['Bridge', 4], ['Hook', 8], ['Hook', 8]] },
  { id: 'prehook', label: 'With pre-hook: Intro–V–Pre–H–V–Pre–H–Break–H', parts: [['Intro', 4], ['Verse', 8], ['Pre-hook', 4], ['Hook', 8], ['Verse', 8], ['Pre-hook', 4], ['Hook', 8], ['Break', 4], ['Hook', 8]] },
  { id: 'rap16', label: 'Rap: Intro–16-bar V–H–16-bar V–H–Outro', parts: [['Intro', 4], ['Verse', 16], ['Hook', 8], ['Verse', 16], ['Hook', 8], ['Outro', 4]] },
  { id: 'switch', label: 'Beat switch: V–H–V–H–Switch–V–H', parts: [['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8], ['Beat switch', 8], ['Verse', 8], ['Hook', 8]] },
  { id: 'chant', label: 'Chant: Cold V–H–Post-hook–V–H–Outro', parts: [['Verse', 8], ['Hook', 8], ['Post-hook', 4], ['Verse', 8], ['Hook', 8], ['Post-hook', 4], ['Outro', 4]] },
  { id: 'spoken', label: 'Spoken: Interlude–V–H–V–H–Long outro', parts: [['Interlude', 4], ['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8], ['Outro', 8]] },
  { id: 'short', label: 'Short & sweet: V–H–V–H', parts: [['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8]] },
  { id: 'dance', label: 'Dance: Intro–Build–Drop–Break–Build–Drop–Outro', parts: [['Intro', 8], ['Pre-hook', 8], ['Hook', 16], ['Break', 8], ['Pre-hook', 8], ['Hook', 16], ['Outro', 8]] },
  { id: 'ballad', label: 'Ballad: V–V–H–V–H–Bridge–H–H', parts: [['Verse', 8], ['Verse', 8], ['Hook', 8], ['Verse', 8], ['Hook', 8], ['Bridge', 8], ['Hook', 8], ['Hook', 4]] },
];

export interface MoodDef { id: string; label: string; emoji: string; modes: string[]; bpm: [number, number]; genres: string[]; palettes: string[]; grooves: string[] }
export const MOODS: MoodDef[] = [
  { id: 'hype', label: 'Hype', emoji: '🔥', modes: ['minor', 'phrygian', 'harmonic', 'dorian'], bpm: [130, 150], genres: ['Trap', 'Drill', 'Phonk', 'Club', 'Rock'], palettes: ['bells', 'neon', 'cinema'], grooves: ['straight', 'light'] },
  { id: 'chill', label: 'Chill', emoji: '🌊', modes: ['dorian', 'major', 'lydian', 'minor'], bpm: [70, 92], genres: ['Lo-fi', 'R&B', 'Jazz', 'Soul', 'Boom-bap'], palettes: ['dusty', 'vinyl', 'clean'], grooves: ['swung', 'lazy', 'light'] },
  { id: 'happy', label: 'Happy', emoji: '☀️', modes: ['major', 'mixolydian', 'lydian'], bpm: [100, 128], genres: ['Pop', 'Afrobeats', 'Disco', 'Funk', 'Country'], palettes: ['plucks', 'neon', 'organ', 'clean'], grooves: ['straight', 'light', 'swung'] },
  { id: 'heartbreak', label: 'Heartbreak', emoji: '💔', modes: ['minor', 'dorian', 'harmonic'], bpm: [60, 90], genres: ['R&B', 'Ballad', 'Pop', 'Soul', 'Folk'], palettes: ['clean', 'bells', 'vinyl'], grooves: ['straight', 'lazy'] },
  { id: 'romantic', label: 'Romantic', emoji: '🌹', modes: ['major', 'dorian', 'lydian'], bpm: [64, 96], genres: ['R&B', 'Soul', 'Reggaeton', 'Jazz', 'Afrobeats'], palettes: ['dusty', 'clean', 'plucks'], grooves: ['swung', 'light', 'lazy'] },
  { id: 'nostalgic', label: 'Nostalgic', emoji: '📼', modes: ['major', 'mixolydian', 'dorian', 'minor'], bpm: [76, 110], genres: ['Synthwave', 'Lo-fi', 'Soul', 'Folk', 'Boom-bap'], palettes: ['vinyl', 'dusty', 'neon'], grooves: ['light', 'swung'] },
  { id: 'dark', label: 'Dark', emoji: '🌑', modes: ['phrygian', 'minor', 'harmonic'], bpm: [64, 145], genres: ['Drill', 'Trap', 'Techno', 'Cinematic', 'Phonk'], palettes: ['bells', 'cinema', 'neon'], grooves: ['straight', 'light'] },
  { id: 'dreamy', label: 'Dreamy', emoji: '☁️', modes: ['lydian', 'major', 'dorian'], bpm: [70, 110], genres: ['Lo-fi', 'Synthwave', 'Cinematic', 'R&B', 'House'], palettes: ['bells', 'clean', 'vinyl'], grooves: ['light', 'straight', 'swung'] },
  { id: 'uplifting', label: 'Uplifting', emoji: '🚀', modes: ['major', 'mixolydian', 'lydian', 'dorian'], bpm: [90, 128], genres: ['Gospel', 'Pop', 'House', 'Cinematic', 'Afrobeats'], palettes: ['organ', 'cinema', 'neon', 'plucks'], grooves: ['straight', 'light', 'shuffle'] },
  { id: 'angry', label: 'Angry', emoji: '⚡', modes: ['phrygian', 'minor', 'harmonic'], bpm: [130, 175], genres: ['Rock', 'Drill', 'Drum & bass', 'Phonk', 'Techno'], palettes: ['neon', 'cinema', 'bells'], grooves: ['straight'] },
  { id: 'party', label: 'Party', emoji: '🎉', modes: ['minor', 'mixolydian', 'major', 'dorian'], bpm: [96, 128], genres: ['Reggaeton', 'House', 'Afrobeats', 'Amapiano', 'Club', 'Disco'], palettes: ['plucks', 'neon', 'organ'], grooves: ['straight', 'light', 'swung'] },
  { id: 'focus', label: 'Focus', emoji: '🎯', modes: ['dorian', 'major', 'lydian', 'minor'], bpm: [72, 124], genres: ['Lo-fi', 'Techno', 'Jazz', 'House', 'Cinematic'], palettes: ['dusty', 'clean', 'vinyl', 'neon'], grooves: ['straight', 'light', 'swung'] },
];
export const moodById = (id: string) => MOODS.find((m) => m.id === id);

// ---------- pitch helpers ----------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiToName = (m: number) => KEYS[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const keyIndex = (k: string) => Math.max(0, KEYS.indexOf(k));

/** MIDI note of scale degree `deg` (can be negative or > 6) for the key/mode, around `baseOct` (C4 = 60 means octave 4). */
export function degreeToMidi(keyName: string, modeId: string, deg: number, baseMidi = 60): number {
  const steps = modeById(modeId).steps;
  const oct = Math.floor(deg / 7);
  const d = ((deg % 7) + 7) % 7;
  return baseMidi + keyIndex(keyName) + steps[d] + oct * 12;
}

/** Notes of a chord as MIDI numbers, root near `baseMidi`. */
export function chordMidis(keyName: string, modeId: string, c: Chord, baseMidi = 48): number[] {
  const root = degreeToMidi(keyName, modeId, c.deg, baseMidi);
  const q = resolveQuality(modeId, c);
  const iv: Record<string, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7] };
  const notes = (iv[q] ?? iv.maj).map((i) => root + i);
  if (c.seventh) {
    // diatonic 7th from the mode
    const seventh = degreeToMidi(keyName, modeId, c.deg + 6, baseMidi);
    notes.push(seventh <= root ? seventh + 12 : seventh);
  }
  return notes;
}

export function diatonicQuality(modeId: string, deg: number): ChordQ {
  const steps = modeById(modeId).steps;
  const at = (d: number) => steps[d % 7] + (d >= 7 ? 12 : 0);
  const r = at(deg), third = at(deg + 2) - r, fifth = at(deg + 4) - r;
  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  if (third === 3 && fifth === 6) return 'dim';
  return 'maj';
}
export function resolveQuality(modeId: string, c: Chord): string {
  if (!c.q || c.q === 'auto') {
    const q = diatonicQuality(modeId, c.deg);
    // augmented third chord in harmonic minor
    if (modeId === 'harmonic' && c.deg === 2) return 'aug';
    return q;
  }
  return c.q;
}

/** Roman numeral label, e.g. "vi", "IV7", "ii°". */
export function chordLabel(modeId: string, c: Chord): string {
  const q = resolveQuality(modeId, c);
  let r = ROMAN[c.deg];
  if (q === 'min' || q === 'dim') r = r.toLowerCase();
  if (q === 'dim') r += '°';
  if (q === 'aug') r += '+';
  if (q === 'sus2') r += 'sus2';
  if (q === 'sus4') r += 'sus4';
  if (c.seventh) r += '7';
  return r;
}
/** Letter-name label for the chord, e.g. "Am7". */
export function chordName(keyName: string, modeId: string, c: Chord): string {
  const root = degreeToMidi(keyName, modeId, c.deg, 48);
  const q = resolveQuality(modeId, c);
  const name = KEYS[((root % 12) + 12) % 12];
  const suf: Record<string, string> = { maj: '', min: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4' };
  return name + (suf[q] ?? '') + (c.seventh ? '7' : '');
}

export function scaleMidis(keyName: string, modeId: string, lowDeg: number, count: number, baseMidi = 60, pentatonic = false): number[] {
  const out: number[] = [];
  const steps = modeById(modeId).steps;
  const minorish = steps[2] === 3;
  // pentatonic subset of degrees: major-ish 1 2 3 5 6, minor-ish 1 3 4 5 7
  const penta = minorish ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
  let d = lowDeg;
  while (out.length < count) {
    const dd = ((d % 7) + 7) % 7;
    if (!pentatonic || penta.includes(dd)) out.push(degreeToMidi(keyName, modeId, d, baseMidi));
    d++;
  }
  return out;
}
/** Snap any MIDI note to the nearest note of the scale. */
export function snapToScale(keyName: string, modeId: string, midi: number): number {
  const pcs = modeById(modeId).steps.map((s) => (s + keyIndex(keyName)) % 12);
  for (let o = 0; o < 7; o++) {
    if (pcs.includes(((midi - o) % 12 + 12) % 12)) return midi - o;
    if (pcs.includes(((midi + o) % 12 + 12) % 12)) return midi + o;
  }
  return midi;
}

export const instrumentDefaults = (paletteId: string) => {
  const p = paletteById(paletteId);
  return { drums: p.kit, bass: p.bass, chords: p.chords, melody: p.lead };
};
