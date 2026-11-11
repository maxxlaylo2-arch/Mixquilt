// Original in-app instruments built only from Tone.js / Web Audio synthesis. No samples, no AI.
import * as Tone from 'tone';
import type { Song, TrackId } from '../model';
import { paletteById } from '../theory';

type Inst = { trigger: (notes: number[], dur: number, time: number, vel: number) => void; dispose: () => void; attack?: (m: number, time: number, vel: number) => void; release?: (m: number, time: number) => void; releaseAll?: () => void };

const f = (m: number) => Tone.Frequency(m, 'midi').toFrequency();

export function instrumentChoice(song: Song) {
  const p = paletteById(song.recipe.palette);
  return {
    kit: song.mix.drums.inst || p.kit,
    bass: song.mix.bass.inst || p.bass,
    chords: song.mix.chords.inst || p.chords,
    lead: song.mix.melody.inst || p.lead,
  };
}
export const rigSignature = (song: Song) => JSON.stringify(instrumentChoice(song));

function poly(kind: string, out: Tone.InputNode): Inst {
  let synth: Tone.PolySynth<any>;
  let chain: Tone.ToneAudioNode[] = [];
  const env = (a: number, d: number, s: number, r: number) => ({ attack: a, decay: d, sustain: s, release: r });
  switch (kind) {
    case 'pad':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 24 } as any, envelope: env(0.35, 0.5, 0.8, 1.4) });
      chain = [new Tone.Filter(1600, 'lowpass')]; synth.volume.value = -9.5; break;
    case 'ekeys':
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3, modulationIndex: 1.6, envelope: env(0.004, 1.4, 0.25, 0.9), modulationEnvelope: env(0.004, 0.5, 0.1, 0.5) } as any);
      chain = [new Tone.Filter(3200, 'lowpass')]; synth.volume.value = 1; break;
    case 'organ':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.75, 0.5, 0, 0.32, 0, 0.18, 0.12] } as any, envelope: env(0.01, 0.1, 0.95, 0.12) });
      synth.volume.value = -16; break;
    case 'pluck':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle8' } as any, envelope: env(0.002, 0.28, 0.04, 0.25) });
      chain = [new Tone.Filter(2600, 'lowpass')]; synth.volume.value = 2.5; break;
    case 'strings':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 34 } as any, envelope: env(0.45, 0.3, 0.85, 1.6) });
      chain = [new Tone.Filter(2400, 'lowpass')]; synth.volume.value = -9.5; break;
    case 'wide':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsquare', count: 3, spread: 40 } as any, envelope: env(0.04, 0.4, 0.6, 0.6) });
      chain = [new Tone.Filter(2200, 'lowpass')]; synth.volume.value = -12; break;
    case 'piano':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fmtriangle', modulationType: 'sine', harmonicity: 2, modulationIndex: 1.2 } as any, envelope: env(0.003, 1.6, 0.08, 1.0) });
      synth.volume.value = -1; break;
    case 'bell':
      synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.5, modulationIndex: 7, envelope: env(0.002, 1.3, 0.0, 1.2), modulationEnvelope: env(0.002, 0.6, 0, 0.6) } as any);
      synth.volume.value = 4.5; break;
    case 'flute':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.07, 0.2, 0.8, 0.3) });
      chain = [new Tone.Vibrato(5, 0.08)]; synth.volume.value = -12; break;
    case 'brass':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: env(0.06, 0.2, 0.7, 0.3) });
      chain = [new Tone.Filter(1800, 'lowpass')]; synth.volume.value = -8; break;
    case 'square':
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: env(0.01, 0.2, 0.6, 0.25) });
      chain = [new Tone.Filter(3000, 'lowpass')]; synth.volume.value = -11; break;
    case 'softlead':
    default:
      synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: env(0.02, 0.3, 0.6, 0.4) });
      synth.volume.value = -8.5;
  }
  synth.maxPolyphony = 24;
  synth.chain(...chain, out as any);
  return {
    trigger: (notes, dur, time, vel) => synth.triggerAttackRelease(notes.map(f), dur, time, vel),
    attack: (m, time, vel) => synth.triggerAttack(f(m), time, vel),
    release: (m, time) => synth.triggerRelease(f(m), time),
    releaseAll: () => synth.releaseAll(),
    dispose: () => { synth.dispose(); chain.forEach((c) => c.dispose()); },
  };
}

function bassInst(kind: string, out: Tone.InputNode): Inst {
  let s: Tone.MonoSynth | Tone.Synth | Tone.MembraneSynth;
  const extra: Tone.ToneAudioNode[] = [];
  switch (kind) {
    case 'sub':
      s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.6, sustain: 0.7, release: 0.25 }, portamento: 0.02 });
      extra.push(new Tone.Distortion(0.18)); s.volume.value = -10; break;
    case 'round':
      s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.45, sustain: 0.25, release: 0.15 } });
      extra.push(new Tone.Filter(900, 'lowpass')); s.volume.value = -2; break;
    case 'saw':
      s = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.003, decay: 0.2, sustain: 0.6, release: 0.1 }, filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.3, baseFrequency: 160, octaves: 3.2 } } as any);
      s.volume.value = -5.5; break;
    case 'log':
      s = new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 1.4, envelope: { attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.2 } });
      s.volume.value = -0.5; break;
    case 'analog':
    default:
      s = new Tone.MonoSynth({ oscillator: { type: 'square' }, envelope: { attack: 0.004, decay: 0.3, sustain: 0.5, release: 0.12 }, filterEnvelope: { attack: 0.003, decay: 0.2, sustain: 0.25, baseFrequency: 110, octaves: 2.6 } } as any);
      s.volume.value = -9;
  }
  s.chain(...extra, out as any);
  let lastT = -1;
  return {
    trigger: (notes, dur, time, vel) => {
      const t = time <= lastT ? lastT + 0.001 : time; lastT = t;
      (s as any).triggerAttackRelease(f(notes[0]), dur, t, vel);
    },
    dispose: () => { s.dispose(); extra.forEach((x) => x.dispose()); },
  };
}

interface Kit { hit: (row: string, time: number, vel: number) => void; dispose: () => void }
function makeKit(kind: string, out: Tone.InputNode): Kit {
  const nodes: Tone.ToneAudioNode[] = [];
  const add = <T extends Tone.ToneAudioNode>(n: T) => { nodes.push(n); return n; };
  const bus = add(new Tone.Gain(1));
  if (kind === 'dusty') { const lp = add(new Tone.Filter(5200, 'lowpass')); const d = add(new Tone.Distortion(0.12)); bus.chain(d, lp, out as any); }
  else bus.connect(out as any);
  const big = kind === 'big';
  const kick = add(new Tone.MembraneSynth({ pitchDecay: kind === 'boom808' ? 0.06 : big ? 0.09 : 0.035, octaves: big ? 7 : 6,
    envelope: { attack: 0.001, decay: kind === 'boom808' ? 0.32 : big ? 0.6 : 0.28, sustain: 0, release: 0.1 } }));
  kick.volume.value = big ? -5 : -5; kick.connect(bus);
  const snareN = add(new Tone.NoiseSynth({ noise: { type: kind === 'dusty' ? 'pink' : 'white' }, envelope: { attack: 0.001, decay: big ? 0.3 : 0.16, sustain: 0 } }));
  const snareF = add(new Tone.Filter(kind === 'tight' ? 2200 : 1600, 'highpass')); snareN.chain(snareF, bus); snareN.volume.value = -9;
  const snareB = add(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } })); snareB.volume.value = -14; snareB.connect(bus);
  const clap = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }));
  const clapF = add(new Tone.Filter({ frequency: 1300, type: 'bandpass', Q: 0.9 })); clap.chain(clapF, bus); clap.volume.value = -4;
  const hat = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: kind === 'organic' ? 0.03 : 0.045, sustain: 0 } }));
  const hatF = add(new Tone.Filter(kind === 'dusty' ? 6500 : 8500, 'highpass')); hat.chain(hatF, bus); hat.volume.value = -14;
  const open = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.32, sustain: 0 } }));
  const openF = add(new Tone.Filter(7500, 'highpass')); open.chain(openF, bus); open.volume.value = -17;
  const perc = kind === 'organic'
    ? add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.012, decay: 0.07, sustain: 0 } }))
    : add(new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.5, envelope: { attack: 0.001, decay: big ? 0.35 : 0.06, sustain: 0, release: 0.05 } }));
  const percF = add(new Tone.Filter(kind === 'organic' ? 5000 : 200, kind === 'organic' ? 'bandpass' : 'highpass'));
  perc.chain(percF, bus); perc.volume.value = kind === 'organic' ? -10 : -12;

  const last: Record<string, number> = {};
  const safe = (row: string, t: number) => { const l = last[row] ?? -1; const tt = t <= l ? l + 0.0005 : t; last[row] = tt; return tt; };
  return {
    hit(row, time, vel) {
      switch (row) {
        case 'kick': kick.triggerAttackRelease(big ? 'F1' : 'A1', 0.3, safe(row, time), vel); break;
        case 'snare': { const t = safe(row, time); snareN.triggerAttackRelease(0.15, t, vel); snareB.triggerAttackRelease('G3', 0.08, t, vel); break; }
        case 'clap': { const t = safe(row, time); clap.triggerAttackRelease(0.01, t, vel * 0.8); clap.triggerAttackRelease(0.01, t + 0.011, vel * 0.7); clap.triggerAttackRelease(0.08, t + 0.022, vel); last[row] = t + 0.022; break; }
        case 'hat': hat.triggerAttackRelease(0.03, safe(row, time), vel); break;
        case 'open': open.triggerAttackRelease(0.25, safe(row, time), vel); break;
        case 'perc': {
          const t = safe(row, time);
          if (perc instanceof Tone.NoiseSynth) perc.triggerAttackRelease(0.05, t, vel);
          else (perc as Tone.MembraneSynth).triggerAttackRelease(big ? 'C2' : 'E5', 0.05, t, vel);
          break;
        }
      }
    },
    dispose() { nodes.forEach((n) => n.dispose()); },
  };
}

export class Rig {
  channels: Record<TrackId, Tone.Channel>;
  masterGain: Tone.Gain;
  vocalGate: Tone.Gain;
  kit: Kit; bass: Inst; chords: Inst; lead: Inst;
  click: Tone.Synth;
  reverb: Tone.Reverb;
  signature: string;
  private disposables: { dispose(): unknown }[] = [];

  constructor(song: Song) {
    this.signature = rigSignature(song);
    const ch = instrumentChoice(song);
    const comp = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.2 });
    const lim = new Tone.Limiter(-1);
    this.masterGain = new Tone.Gain(song.mix.master);
    this.masterGain.chain(comp, lim, Tone.getDestination());
    this.reverb = new Tone.Reverb({ decay: 2.6, preDelay: 0.02, wet: 1 });
    const revRet = new Tone.Gain(0.5);
    this.reverb.chain(revRet, this.masterGain);
    this.channels = {} as Record<TrackId, Tone.Channel>;
    const sends: Record<TrackId, number> = { drums: 0.05, bass: 0, chords: 0.35, melody: 0.3, vocals: 0.18 };
    for (const id of ['drums', 'bass', 'chords', 'melody', 'vocals'] as TrackId[]) {
      const c = new Tone.Channel({ volume: 0 }).connect(this.masterGain);
      if (sends[id]) { const s = new Tone.Gain(sends[id]); c.connect(s); s.connect(this.reverb); this.disposables.push(s); }
      this.channels[id] = c;
    }
    this.vocalGate = new Tone.Gain(1).connect(this.channels.vocals);
    this.kit = makeKit(ch.kit, this.channels.drums);
    this.bass = bassInst(ch.bass, this.channels.bass);
    this.chords = poly(ch.chords, this.channels.chords);
    this.lead = poly(ch.lead, this.channels.melody);
    this.click = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } }).toDestination();
    this.click.volume.value = -14;
    this.disposables.push(comp, lim, this.masterGain, this.reverb, revRet, this.vocalGate, this.click, ...Object.values(this.channels));
    this.applyMix(song);
  }
  ready() { return this.reverb.ready; }

  applyMix(song: Song, soloOnly?: TrackId[]) {
    const gain2db = (g: number) => (g <= 0.001 ? -Infinity : 20 * Math.log10(g));
    const anySolo = Object.values(song.mix).some((m: any) => m && m.solo);
    for (const id of Object.keys(this.channels) as TrackId[]) {
      const m = song.mix[id];
      const c = this.channels[id];
      c.volume.value = gain2db(m.vol);
      let audible = !m.mute && (!anySolo || m.solo);
      if (soloOnly) audible = soloOnly.includes(id) && !m.mute;
      c.mute = !audible;
    }
    this.masterGain.gain.value = song.mix.master;
  }

  tick(time: number, down: boolean) { this.click.triggerAttackRelease(down ? 'C6' : 'G5', 0.03, time, down ? 1 : 0.6); }

  dispose() {
    this.kit.dispose(); this.bass.dispose(); this.chords.dispose(); this.lead.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
