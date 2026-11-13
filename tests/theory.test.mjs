// Unit tests for key-aware spelling and key-change intervals.
// Run: node tests/theory.test.mjs
import { midiToName, pitchClassName, keySemitoneDelta, chordName, keyAfterTranspose } from '../src/theory.ts';
import { toneCutoffHz } from '../src/audio/macros.ts';

const results = [];
const ok = (name, cond, extra = '') => {
  const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`;
  results.push(l);
  console.log(l);
  if (!cond) process.exitCode = 1;
};

ok('Ab Dorian pc 6 is Gb, not F♯', pitchClassName(6, 'A♭', 'dorian') === 'G♭', pitchClassName(6, 'A♭', 'dorian'));
ok('Ab Dorian MIDI 66 is Gb4', midiToName(66, 'A♭', 'dorian') === 'G♭4', midiToName(66, 'A♭', 'dorian'));
ok('Ab Dorian pc 11 is Cb, not B', pitchClassName(11, 'A♭', 'dorian') === 'C♭', pitchClassName(11, 'A♭', 'dorian'));
ok('Ab Dorian MIDI 59 is Cb4 (enharmonic B3)', midiToName(59, 'A♭', 'dorian') === 'C♭4', midiToName(59, 'A♭', 'dorian'));
ok('F♯ Phrygian tonic is F♯', midiToName(66, 'F♯', 'phrygian') === 'F♯4', midiToName(66, 'F♯', 'phrygian'));
ok('C major C4 stays C4', midiToName(60, 'C', 'major') === 'C4', midiToName(60, 'C', 'major'));
ok('C harmonic minor Eb is Eb, B is B (not Cb)', pitchClassName(3, 'C', 'harmonic') === 'E♭' && pitchClassName(11, 'C', 'harmonic') === 'B', `${pitchClassName(3, 'C', 'harmonic')} ${pitchClassName(11, 'C', 'harmonic')}`);
ok('Ab Dorian i chord is Abm, not G#m', chordName('A♭', 'dorian', { deg: 0 }) === 'A♭m', chordName('A♭', 'dorian', { deg: 0 }));
ok('Fallback without a key still uses the KEYS list (F♯)', midiToName(66) === 'F♯4', midiToName(66));

ok('C → F♯ is +6', keySemitoneDelta('C', 'F♯') === 6, String(keySemitoneDelta('C', 'F♯')));
ok('F♯ → C is −6 (same register)', keySemitoneDelta('F♯', 'C') === -6, String(keySemitoneDelta('F♯', 'C')));
ok('C → B is −1, not +11', keySemitoneDelta('C', 'B') === -1, String(keySemitoneDelta('C', 'B')));
ok('A♭ → E♭ is −5', keySemitoneDelta('A♭', 'E♭') === -5, String(keySemitoneDelta('A♭', 'E♭')));
ok('C +2 snaps to D', keyAfterTranspose('C', 2) === 'D', keyAfterTranspose('C', 2));
ok('A♭ +2 snaps to B♭', keyAfterTranspose('A♭', 2) === 'B♭', keyAfterTranspose('A♭', 2));
ok('Tone 0 is dark (~700 Hz)', Math.abs(toneCutoffHz(0) - 700) < 1, String(toneCutoffHz(0)));
ok('Tone default 0.5 is transparent (≥16 kHz)', toneCutoffHz(0.5) >= 16000 && toneCutoffHz() >= 16000, String(toneCutoffHz(0.5)));
ok('Tone 1 stays fully open', toneCutoffHz(1) >= 16000, String(toneCutoffHz(1)));
ok('Old curve mid-point (~3.3 kHz) is no longer the default', toneCutoffHz(0.5) > 8000, String(toneCutoffHz(0.5)));

console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
