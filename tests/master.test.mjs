// Unit tests for the master Finish stage (soft clipper math + presets).
// Run: node tests/master.test.mjs
import { softClip, clipCurve, FINISHES, finishOf, shaperInputGain, CLIP_RANGE, CLIP_KNEE, CLIP_CEILING } from '../src/audio/master.ts';

let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) { fails++; process.exitCode = 1; } };

ok('Below the knee the clipper is a straight line', [0, 0.1, -0.3, 0.5, -0.5].every((x) => softClip(x) === x));
ok('Clipper is odd-symmetric', [0.6, 0.9, 1.5, 3.7].every((x) => Math.abs(softClip(-x) + softClip(x)) < 1e-12));
let mono = true, prev = -Infinity;
for (let x = -CLIP_RANGE; x <= CLIP_RANGE; x += 0.001) { const y = softClip(x); if (y < prev - 1e-12) mono = false; prev = y; }
ok('Clipper never turns down a louder input (monotonic)', mono);
ok('Clipper never passes the −1 dBFS ceiling', [1, 2, 4, 50].every((x) => softClip(x) <= CLIP_CEILING && softClip(x) > CLIP_KNEE), String(softClip(4)));
const c = clipCurve();
ok('Curve centre is silent', c[(c.length - 1) / 2] === 0);
ok('Curve ends sit at the ceiling', Math.abs(c[c.length - 1] - softClip(CLIP_RANGE)) < 1e-6 && c[c.length - 1] <= CLIP_CEILING + 1e-6);
ok('Curve slope at centre is unity in real units', Math.abs((c[(c.length - 1) / 2 + 1] - c[(c.length - 1) / 2]) / (2 * CLIP_RANGE / (c.length - 1)) - 1) < 1e-4);
ok('Four finishes in order Pre-master, Streaming, Chart, Club', FINISHES.map((f) => f.id).join() === 'off,stream,chart,club');
ok('Drive rises with each finish', FINISHES.every((f, i) => i === 0 || f.driveDb > FINISHES[i - 1].driveDb));
ok('Old songs (no finish field) load as Pre-master', finishOf({ master: 0.85 }).id === 'off' && finishOf(undefined).id === 'off');
ok('Unknown finish falls back to Pre-master', finishOf({ finish: 'nope' }).id === 'off');
ok('Chart drive is +6 dB into the curve', Math.abs(shaperInputGain(finishOf({ finish: 'chart' })) * CLIP_RANGE - 10 ** (6 / 20)) < 1e-9);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
