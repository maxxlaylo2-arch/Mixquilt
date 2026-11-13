// Unit tests for Mic-tab take trim and section lookup time. No browser needed.
import { TAKE_PREROLL_SEC, TAKE_SECTION_SLOP_SEC, trimTakeToSection, trimTakeToSectionFloor, takeLookupTime } from '../src/audio/takeTiming.ts';
import { sendLevel, LEGACY_SENDS, DEFAULT_SENDS, mixHasMacros, macrosForTrack, LEGACY_MACROS, DEFAULT_MACROS } from '../src/audio/macros.ts';

const results = [];
const ok = (name, cond, extra = '') => {
  const l = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`;
  results.push(l);
  console.log(l);
  if (!cond) process.exitCode = 1;
};

ok('pre-roll is 0.25 s', TAKE_PREROLL_SEC === 0.25);
ok('section slop is 5 ms', TAKE_SECTION_SLOP_SEC === 0.005);

const cases = [];
for (const sr of [44100, 48000]) {
  for (const [bpm, bars] of [[140, 8], [90, 8], [120, 0], [128, 16], [100, 4]]) {
    const sectionStart = bars * 4 * (60 / bpm);
    // Count-in: recording begins 4 beats before the section.
    const recStart = sectionStart - 4 * (60 / bpm);
    cases.push({ sr, bpm, bars, sectionStart, recStart, label: `count-in ${sr}Hz ${bpm}bpm ${bars} bars` });
  }
  // Recording that begins well before an off-grid section start
  cases.push({ sr, bpm: 140, bars: null, sectionStart: 13.714285714285714, recStart: 13.714285714285714 - 2, label: `hook2-ish ${sr}Hz` });
  cases.push({ sr, bpm: 97, bars: null, sectionStart: Math.PI * 3, recStart: Math.PI * 3 - 1.7, label: `irrational ${sr}Hz` });
}

for (const c of cases) {
  const floor = trimTakeToSectionFloor(c.recStart, c.sectionStart, c.sr);
  const ceil = trimTakeToSection(c.recStart, c.sectionStart, c.sr);
  const floorLookup = floor.start + TAKE_PREROLL_SEC;
  const ceilLookup = ceil.start + TAKE_PREROLL_SEC;
  const floorGap = c.sectionStart - floorLookup; // > 0 means still before the section
  const ceilGap = ceilLookup - c.sectionStart;  // >= 0 means at or after

  // Document the historical bug: floor trim can leave lookup a hair early.
  if (floorGap > 1e-12) {
    ok(`${c.label}: historical floor trim lands before the section (the bug)`, floorGap > 0 && floorGap < 1 / c.sr + 1e-12, `gap=${floorGap}`);
    ok(`${c.label}: slop covers the floor-trim shortfall`, takeLookupTime(floor.start) >= c.sectionStart, `lookup=${takeLookupTime(floor.start)} startSec=${c.sectionStart}`);
  } else {
    ok(`${c.label}: floor trim already on/after the section (no shortfall this time)`, floorGap <= 1e-12, `gap=${floorGap}`);
  }

  ok(`${c.label}: ceil trim lands at or after the section`, ceilGap >= -1e-12, `delta=${ceilGap}`);
  ok(`${c.label}: ceil lookup (even without slop) is in the section`, ceilLookup >= c.sectionStart - 1e-12, `lookup=${ceilLookup}`);
  ok(`${c.label}: ceil start is within 1 sample of the target`, Math.abs(ceil.start - (c.sectionStart - TAKE_PREROLL_SEC)) <= 1 / c.sr + 1e-12);
}

// The 0.24 s case from the earlier regression: already 10 ms inside after +0.25.
ok('0.24 s before a section still looks up inside it', takeLookupTime(10 - 0.24) > 10, String(takeLookupTime(9.76)));
ok('0.24 s before: slop does not jump an extra section 5 ms later', takeLookupTime(10 - 0.24) < 10.02, String(takeLookupTime(9.76)));

// Mix macros
ok('empty mix is treated as legacy', mixHasMacros({ drums: { vol: 0.8 } }) === false);
ok('new-song mix is not legacy', mixHasMacros({ drums: { ...DEFAULT_MACROS } }) === true);
ok('legacy track macros are tone 0.5 / drive 0 / character 0', JSON.stringify(macrosForTrack({ drums: { vol: 1 } }, 'drums')) === JSON.stringify({ ...LEGACY_MACROS, legacy: true }));
ok('send at character 0 is the pre-library table', MACRO_OK());
function MACRO_OK() {
  return ['drums', 'bass', 'chords', 'melody', 'vocals'].every((id) => Math.abs(sendLevel(id, 0) - LEGACY_SENDS[id]) < 1e-12);
}
ok('send at character 0.5 is the new default table', ['drums', 'bass', 'chords', 'melody', 'vocals'].every((id) => Math.abs(sendLevel(id, 0.5) - DEFAULT_SENDS[id]) < 1e-12));

console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
