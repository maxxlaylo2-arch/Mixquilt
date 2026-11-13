// Render 3 short Mixquilt demos showcasing the sound-expansion library.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.MQ_URL || 'http://127.0.0.1:4175/Mixquilt/';
const OUT = process.env.MQ_OUT || '/workspace/mixquilt-guidebook/test-beats';
fs.mkdirSync(OUT, { recursive: true });

const demos = [
  {
    slug: 'halo-clap-gospel-trap',
    title: 'Halo Clap (Hard Gospel Trap)',
    genre: 'Hard Gospel Trap',
    blurb: 'Library-demo Hard Gospel Trap instrumental: stacked claps, a dirty gliding 808, choir-formant pad, and a small choir-ooh lead.',
    recipe: { key: 'A♭', mode: 'dorian', bpm: 140, groove: 'straight', progression: 'plagal', palette: 'gospeltrap', chordRhythm: 'stabs' },
    mix: {
      drums: { inst: 'gospelclap', tone: 0.55, drive: 0.18, character: 0.45, vol: 0.9 },
      bass: { inst: 'dirty808', tone: 0.42, drive: 0.62, character: 0.3, vol: 0.92 },
      chords: { inst: 'choirpad', tone: 0.58, drive: 0.12, character: 0.7, vol: 0.72 },
      melody: { inst: 'choirooh', tone: 0.6, drive: 0.1, character: 0.65, vol: 0.7 },
    },
    sections: [
      { id: 'i', type: 'Intro', bars: 4, layers: { drums: true, bass: false, chords: true, melody: false, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'h1', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'v', type: 'Verse', bars: 8, layers: { drums: true, bass: true, chords: true, melody: false, vocals: false }, beat: 'B', part: 'Verse', transpose: 0 },
    ],
    // Ab dorian around Ab3–Ab4: 56 58 59 61 63 65 66 68
    hookMelody: [
      { t: 0, d: 1.5, m: 68, v: 0.85 }, { t: 2, d: 0.8, m: 71, v: 0.7 }, { t: 3, d: 1.6, m: 73, v: 0.8 },
      { t: 6, d: 0.8, m: 75, v: 0.75 }, { t: 8, d: 1.8, m: 68, v: 0.85 }, { t: 11, d: 0.9, m: 66, v: 0.7 },
      { t: 12, d: 2.2, m: 73, v: 0.8 },
    ],
    beatsA: {
      kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      perc:  [0,0,1,0, 0,0,0,1, 0,0,1,0, 0,1,0,0],
      bass:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0],
    },
    beatsB: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,0, 1,0,1,0, 1,1,1,0, 1,0,1,0],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      perc:  [0,1,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0],
      bass:  [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,1,0],
    },
  },
  {
    slug: 'iron-psalm',
    title: 'Iron Psalm (bowed-metal gospel hybrid)',
    genre: 'Experimental (industrial × gospel × cinematic)',
    blurb: 'Experimental genre-blend: industrial kit and growl bass under a bowed-metal pad, with inharmonic metal-bell answers — a church-basement hymn made of steel.',
    recipe: { key: 'E', mode: 'harmonic', bpm: 100, groove: 'light', progression: 'epic-minor', palette: 'metalbow', chordRhythm: 'long' },
    mix: {
      drums: { inst: 'industrial', tone: 0.48, drive: 0.4, character: 0.35, vol: 0.82 },
      bass: { inst: 'growl', tone: 0.4, drive: 0.55, character: 0.4, vol: 0.88 },
      chords: { inst: 'bowed', tone: 0.52, drive: 0.15, character: 0.75, vol: 0.7 },
      melody: { inst: 'metalbell', tone: 0.62, drive: 0.12, character: 0.55, vol: 0.68 },
    },
    sections: [
      { id: 'i', type: 'Intro', bars: 4, layers: { drums: false, bass: true, chords: true, melody: false, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'v', type: 'Verse', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'h', type: 'Hook', bars: 4, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'B', part: 'Hook', transpose: 2 },
    ],
    // E harmonic minor E F# G A B C D#: 64 66 67 69 71 72 75 76
    hookMelody: [
      { t: 0, d: 2, m: 76, v: 0.8 }, { t: 4, d: 1.2, m: 75, v: 0.7 }, { t: 6, d: 1.5, m: 71, v: 0.75 },
      { t: 8, d: 2, m: 67, v: 0.8 }, { t: 12, d: 1, m: 72, v: 0.65 }, { t: 14, d: 1.5, m: 76, v: 0.8 },
    ],
    beatsA: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      hat:   [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
      perc:  [0,0,1,0, 0,0,0,0, 0,1,0,0, 0,0,0,0],
      bass:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
    },
    beatsB: {
      kick:  [1,0,0,1, 0,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,1,0,1, 1,0,1,0, 1,1,0,1, 1,0,1,1],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      perc:  [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
      bass:  [1,0,0,1, 0,0,0,0, 1,0,0,0, 1,0,0,0],
    },
  },
  {
    slug: 'glass-souk',
    title: 'Glass Souk (world × glass garden)',
    genre: 'Experimental (amapiano / world pulse × glassy FM)',
    blurb: 'A shaker-forward world-pulse groove with glass bass, kalimba chords, and a shimmering lead — a market-stall melody under a crystal ceiling.',
    recipe: { key: 'F', mode: 'mixolydian', bpm: 112, groove: 'swung', progression: 'float', palette: 'glassgarden', chordRhythm: 'offbeat' },
    mix: {
      drums: { inst: 'worldpulse', tone: 0.6, drive: 0.15, character: 0.4, vol: 0.88 },
      bass: { inst: 'glassbass', tone: 0.5, drive: 0.25, character: 0.45, vol: 0.86 },
      chords: { inst: 'kalimba', tone: 0.62, drive: 0.08, character: 0.5, vol: 0.74 },
      melody: { inst: 'shimmerlead', tone: 0.68, drive: 0.1, character: 0.7, vol: 0.66 },
    },
    sections: [
      { id: 'i', type: 'Intro', bars: 4, layers: { drums: true, bass: false, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'h', type: 'Hook', bars: 8, layers: { drums: true, bass: true, chords: true, melody: true, vocals: false }, beat: 'A', part: 'Hook', transpose: 0 },
      { id: 'b', type: 'Bridge', bars: 4, layers: { drums: true, bass: true, chords: true, melody: false, vocals: false }, beat: 'B', part: 'Hook', transpose: 0 },
    ],
    // F mixolydian F G A Bb C D Eb: 65 67 69 70 72 74 75 77
    hookMelody: [
      { t: 0, d: 0.7, m: 77, v: 0.8 }, { t: 1, d: 0.7, m: 74, v: 0.7 }, { t: 2, d: 1.2, m: 72, v: 0.85 },
      { t: 5, d: 0.6, m: 70, v: 0.65 }, { t: 6, d: 1.4, m: 69, v: 0.8 }, { t: 8, d: 0.7, m: 72, v: 0.75 },
      { t: 10, d: 0.7, m: 74, v: 0.7 }, { t: 12, d: 2, m: 77, v: 0.85 },
    ],
    beatsA: {
      kick:  [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
      perc:  [0,0,1,0, 0,1,0,0, 0,0,1,1, 0,0,1,0],
      bass:  [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0],
    },
    beatsB: {
      kick:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:   [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1],
      open:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      perc:  [0,1,0,1, 0,0,1,0, 0,1,0,0, 0,1,0,1],
      bass:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
    },
  },
];

function wavStats(buf) {
  // skip header, 16-bit stereo
  const n = (buf.length - 44) / 2;
  let peak = 0, sum = 0, clip = 0, first = -1, last = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(44 + i * 2) / 32768;
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sum += s * s;
    if (a >= 0.999) clip++;
    if (a > 0.001) { if (first < 0) first = i; last = i; }
  }
  const sr = buf.readUInt32LE(24);
  const ch = buf.readUInt16LE(22);
  const dur = n / ch / sr;
  return {
    duration: Number(dur.toFixed(2)),
    peak: Number(peak.toFixed(4)),
    peakDb: Number((20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1)),
    rms: Number(Math.sqrt(sum / n).toFixed(4)),
    clipped: clip,
    leadSil: Number(((first < 0 ? 0 : first / ch) / sr).toFixed(2)),
    trailSil: Number((dur - (last / ch) / sr).toFixed(2)),
    sr, ch,
  };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(URL);
await page.waitForSelector('.hero h1');

for (const d of demos) {
  const b64 = await page.evaluate(async (d) => {
    const mq = window.__mq;
    mq.update((s) => {
      s.title = d.title;
      s.recipe = { ...s.recipe, ...d.recipe };
      s.sections = d.sections;
      s.chords = (
        d.recipe.progression === 'plagal' ? [{ deg: 3 }, { deg: 0 }, { deg: 3 }, { deg: 0 }] :
        d.recipe.progression === 'epic-minor' ? [{ deg: 0 }, { deg: 5 }, { deg: 2 }, { deg: 6 }] :
        [{ deg: 0 }, { deg: 1 }, { deg: 3 }, { deg: 0 }]
      );
      s.parts = { Hook: d.hookMelody, Verse: [] };
      s.beats.A = { ...s.beats.A, ...d.beatsA };
      s.beats.B = { ...s.beats.B, ...d.beatsB };
      for (const [tr, mix] of Object.entries(d.mix)) {
        s.mix[tr] = { ...s.mix[tr], ...mix };
      }
    });
    const buf = await mq.renderSong(mq.getSong());
    const ch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate;
    const dataLen = len * ch * 2;
    const ab = new ArrayBuffer(44 + dataLen);
    const v = new DataView(ab);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, dataLen, true);
    const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, chans[c][i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
    }
    const bytes = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }, d);
  const wavPath = path.join(OUT, `${d.slug}.wav`);
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(wavPath, buf);
  const st = wavStats(buf);
  const md = `# ${d.title}

${d.blurb}

Made in Mixquilt on the \`sound-expansion\` branch (all voices synthesized in-app).

## Recipe

| Ingredient | Value |
| --- | --- |
| Genre | ${d.genre} |
| Key / mode | ${d.recipe.key} ${d.recipe.mode} |
| Tempo | ${d.recipe.bpm} BPM |
| Groove | ${d.recipe.groove} |
| Progression | ${d.recipe.progression} |
| Chord rhythm | ${d.recipe.chordRhythm} |
| Palette (starting point) | ${d.recipe.palette} |
| Drums | \`${d.mix.drums.inst}\` · tone ${d.mix.drums.tone} · drive ${d.mix.drums.drive} · character ${d.mix.drums.character} |
| Bass | \`${d.mix.bass.inst}\` · tone ${d.mix.bass.tone} · drive ${d.mix.bass.drive} · character ${d.mix.bass.character} |
| Chords | \`${d.mix.chords.inst}\` · tone ${d.mix.chords.tone} · drive ${d.mix.chords.drive} · character ${d.mix.chords.character} |
| Melody | \`${d.mix.melody.inst}\` · tone ${d.mix.melody.tone} · drive ${d.mix.melody.drive} · character ${d.mix.melody.character} |
| Form | ${d.sections.map((s) => `${s.type} ${s.bars} (${s.beat}${s.transpose ? `, ${s.transpose > 0 ? '+' : ''}${s.transpose}` : ''})`).join(' → ')} |

## Render

- File: \`${d.slug}.wav\`
- Duration: ${st.duration} s
- Peak: ${st.peak} (${st.peakDb} dBFS)
- RMS: ${st.rms}
- Clipped samples (|x|≥0.999): ${st.clipped}
- Leading / trailing silence: ${st.leadSil} s / ${st.trailSil} s

Patterns and melody notes were entered through the \`window.__mq\` test hook to match what the Beat / Play / Song tabs can store.
`;
  fs.writeFileSync(path.join(OUT, `${d.slug}.md`), md);
  console.log(d.slug, st);
}

await browser.close();
