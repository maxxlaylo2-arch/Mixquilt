// Original in-app instrument builders. Tone.js / Web Audio only. No samples, no AI.
import * as Tone from 'tone';

export type Inst = {
  trigger: (notes: number[], dur: number, time: number, vel: number) => void;
  dispose: () => void;
  attack?: (m: number, time: number, vel: number) => void;
  release?: (m: number, time: number) => void;
  releaseAll?: () => void;
};
export type Kit = { hit: (row: string, time: number, vel: number) => void; dispose: () => void };

const f = (m: number) => Tone.Frequency(m, 'midi').toFrequency();
const env = (a: number, d: number, s: number, r: number) => ({ attack: a, decay: d, sustain: s, release: r });

function formant(out: Tone.InputNode, f1: number, f2: number, q = 3) {
  const a = new Tone.Filter({ type: 'peaking', frequency: f1, Q: q, gain: 8 });
  const b = new Tone.Filter({ type: 'peaking', frequency: f2, Q: q, gain: 6 });
  a.connect(b);
  b.connect(out as any);
  return { in: a as Tone.InputNode, nodes: [a, b] };
}

export function makePoly(kind: string, out: Tone.InputNode): Inst {
  let synth: Tone.PolySynth<any> | undefined;
  let extra: Tone.PolySynth<any> | undefined;
  const chain: Tone.ToneAudioNode[] = [];
  const nodes: { dispose(): unknown }[] = [];
  const add = <T extends { dispose(): unknown }>(n: T) => { nodes.push(n); return n; };

  const finish = (s: Tone.PolySynth<any>, fx: Tone.ToneAudioNode[] = []) => {
    s.maxPolyphony = 24;
    s.chain(...fx, out as any);
    synth = s;
    chain.push(...fx);
  };

  switch (kind) {
    case 'pad':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 24 } as any, envelope: env(0.35, 0.5, 0.8, 1.4) })), [add(new Tone.Filter(1600, 'lowpass'))]);
      synth!.volume.value = -9.5; break;
    case 'ekeys':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3, modulationIndex: 1.6, envelope: env(0.004, 1.4, 0.25, 0.9), modulationEnvelope: env(0.004, 0.5, 0.1, 0.5) } as any)), [add(new Tone.Filter(3200, 'lowpass'))]);
      synth!.volume.value = 1; break;
    case 'organ':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.75, 0.5, 0, 0.32, 0, 0.18, 0.12] } as any, envelope: env(0.01, 0.1, 0.95, 0.12) })));
      synth!.volume.value = -16; break;
    case 'pluck':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle8' } as any, envelope: env(0.002, 0.28, 0.04, 0.25) })), [add(new Tone.Filter(2600, 'lowpass'))]);
      synth!.volume.value = 2.5; break;
    case 'strings':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 34 } as any, envelope: env(0.45, 0.3, 0.85, 1.6) })), [add(new Tone.Filter(2400, 'lowpass'))]);
      synth!.volume.value = -9.5; break;
    case 'wide':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsquare', count: 3, spread: 40 } as any, envelope: env(0.04, 0.4, 0.6, 0.6) })), [add(new Tone.Filter(2200, 'lowpass'))]);
      synth!.volume.value = -12; break;
    case 'piano':
    case 'piano-lead':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fmtriangle', modulationType: 'sine', harmonicity: 2, modulationIndex: 1.2 } as any, envelope: env(0.003, 1.6, 0.08, 1.0) })));
      synth!.volume.value = -1; break;
    case 'bell':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.5, modulationIndex: 7, envelope: env(0.002, 1.3, 0.0, 1.2), modulationEnvelope: env(0.002, 0.6, 0, 0.6) } as any)));
      synth!.volume.value = 4.5; break;
    case 'flute':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.07, 0.2, 0.8, 0.3) })), [add(new Tone.Vibrato(5, 0.08))]);
      synth!.volume.value = -12; break;
    case 'brass':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: env(0.06, 0.2, 0.7, 0.3) })), [add(new Tone.Filter(1800, 'lowpass'))]);
      synth!.volume.value = -8; break;
    case 'square':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: env(0.01, 0.2, 0.6, 0.25) })), [add(new Tone.Filter(3000, 'lowpass'))]);
      synth!.volume.value = -11; break;
    case 'choirpad': {
      const form = formant(out, 700, 1200, 2.8);
      nodes.push(...form.nodes);
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [0.4, 1, 0.35, 0.2, 0.45, 0.08, 0.2] } as any, envelope: env(0.22, 0.5, 0.85, 1.8) }));
      s.maxPolyphony = 24;
      s.chain(add(new Tone.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.45, wet: 0.45 })), form.in as any);
      s.volume.value = -14;
      synth = s;
      break;
    }
    case 'gospelorg': {
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.9, 0.7, 0.15, 0.45, 0.1, 0.28, 0.2, 0.1] } as any, envelope: env(0.012, 0.08, 0.95, 0.18) }));
      finish(s, [add(new Tone.Chorus({ frequency: 4.2, delayTime: 2.2, depth: 0.7, wet: 0.55 }))]);
      synth!.volume.value = -15; break;
    }
    case 'glasspad':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2.02, modulationIndex: 4.5, envelope: env(0.12, 0.8, 0.55, 2.2), modulationEnvelope: env(0.08, 0.6, 0.2, 1.4) } as any)), [add(new Tone.Filter(4200, 'lowpass')), add(new Tone.Chorus({ frequency: 0.35, delayTime: 4, depth: 0.4, wet: 0.4 }))]);
      synth!.volume.value = -8; break;
    case 'shimmer': {
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsine', count: 3, spread: 20 } as any, envelope: env(0.3, 0.6, 0.8, 2.4) }));
      const hi = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: env(0.4, 0.8, 0.5, 3.2) }));
      const sparkle = add(new Tone.FeedbackDelay({ delayTime: 0.22, feedback: 0.42, wet: 0.35 }));
      const hp = add(new Tone.Filter(1800, 'highpass'));
      s.maxPolyphony = 16; hi.maxPolyphony = 16;
      s.chain(add(new Tone.Filter(2200, 'lowpass')), out as any);
      hi.chain(hp, sparkle, out as any);
      s.volume.value = -14; hi.volume.value = -18;
      synth = s; extra = hi;
      break;
    }
    case 'bowed':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.15, 0.45, 0.08, 0.3, 0.2, 0.05, 0.18] } as any, envelope: env(0.55, 0.4, 0.8, 1.8) })), [add(new Tone.Filter(1500, 'lowpass')), add(new Tone.Chorus({ frequency: 0.25, delayTime: 6, depth: 0.35, wet: 0.35 }))]);
      synth!.volume.value = -11; break;
    case 'tapepiano':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fmtriangle', modulationType: 'sine', harmonicity: 1.8, modulationIndex: 1.0 } as any, envelope: env(0.004, 1.4, 0.06, 1.1) })), [add(new Tone.Filter(2800, 'lowpass')), add(new Tone.Vibrato(0.55, 0.06))]);
      synth!.volume.value = -2; break;
    case 'rhodes':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 3.4, envelope: env(0.004, 1.8, 0.2, 1.3), modulationEnvelope: env(0.003, 0.7, 0.12, 0.8) } as any)), [add(new Tone.Filter(4200, 'lowpass')), add(new Tone.Chorus({ frequency: 0.8, delayTime: 2, depth: 0.25, wet: 0.25 }))]);
      synth!.volume.value = -2; break;
    case 'wurli':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 1.5, modulationIndex: 5.5, envelope: env(0.002, 0.9, 0.15, 0.6), modulationEnvelope: env(0.002, 0.35, 0.05, 0.4) } as any)), [add(new Tone.Filter(2600, 'lowpass')), add(new Tone.Chebyshev(3))]);
      synth!.volume.value = -8; break;
    case 'churchorg':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.6, 0.35, 0.2, 0.15, 0.08, 0.06] } as any, envelope: env(0.04, 0.2, 0.95, 0.8) })), [add(new Tone.Filter(3500, 'lowpass')), add(new Tone.Chorus({ frequency: 0.7, delayTime: 5, depth: 0.2, wet: 0.2 }))]);
      synth!.volume.value = -14; break;
    case 'analogpad':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 4, spread: 30 } as any, envelope: env(0.28, 0.45, 0.8, 1.5) })), [add(new Tone.Filter(1800, 'lowpass'))]);
      synth!.volume.value = -13; break;
    case 'motionpad':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 48 } as any, envelope: env(0.2, 0.4, 0.75, 1.3) })), [add(new Tone.AutoFilter({ frequency: 0.18, baseFrequency: 400, octaves: 3, wet: 0.55 })), add(new Tone.Chorus({ frequency: 0.9, delayTime: 3.5, depth: 0.5, wet: 0.5 }))]);
      synth!.volume.value = -12; break;
    case 'voxstab': {
      const form = formant(out, 500, 1600, 4);
      nodes.push(...form.nodes);
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [0.3, 1, 0.4, 0.15, 0.6] } as any, envelope: env(0.004, 0.18, 0.05, 0.16) }));
      s.maxPolyphony = 24;
      s.connect(form.in as any);
      s.volume.value = -8;
      synth = s;
      break;
    }
    case 'darkpad':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 18 } as any, envelope: env(0.5, 0.6, 0.85, 2.2) })), [add(new Tone.Filter(700, 'lowpass'))]);
      synth!.volume.value = -11; break;
    case 'harp':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: env(0.002, 1.1, 0.0, 0.8) })), [add(new Tone.Filter(4500, 'lowpass'))]);
      synth!.volume.value = -4; break;
    case 'kalimba':
    case 'kalimbalead':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2.01, modulationIndex: 2.2, envelope: env(0.001, 0.7, 0.0, 0.6), modulationEnvelope: env(0.001, 0.15, 0, 0.2) } as any)), [add(new Tone.Filter(3800, 'lowpass'))]);
      synth!.volume.value = 1; break;
    case 'nylon':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle8' } as any, envelope: env(0.003, 0.55, 0.08, 0.4) })), [add(new Tone.Filter(2200, 'lowpass'))]);
      synth!.volume.value = 0; break;
    case 'harpsi':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square8' } as any, envelope: env(0.001, 0.22, 0.0, 0.15) })), [add(new Tone.Filter(4000, 'lowpass'))]);
      synth!.volume.value = -10; break;
    case 'noisepool': {
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.4, 0.5, 0.7, 2) }));
      const ns = add(new Tone.Noise('pink'));
      const ng = add(new Tone.Gain(0.04));
      const nf = add(new Tone.Filter(1200, 'bandpass'));
      ns.connect(nf); nf.connect(ng); ng.connect(out as any);
      ns.start();
      finish(s, [add(new Tone.Filter(1400, 'lowpass'))]);
      synth!.volume.value = -16;
      break;
    }
    case 'crystal':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.04, modulationIndex: 8, envelope: env(0.002, 1.8, 0.0, 1.6), modulationEnvelope: env(0.002, 0.5, 0, 0.8) } as any)), [add(new Tone.Chorus({ frequency: 0.4, delayTime: 4, depth: 0.4, wet: 0.3 }))]);
      synth!.volume.value = 0; break;
    case 'tapevox': {
      const form = formant(out, 650, 1100, 2.4);
      nodes.push(...form.nodes);
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [0.5, 1, 0.3, 0.25, 0.4] } as any, envelope: env(0.18, 0.4, 0.85, 1.6) }));
      s.maxPolyphony = 16;
      s.chain(add(new Tone.Vibrato(0.7, 0.08)), form.in as any);
      s.volume.value = -14;
      synth = s;
      break;
    }
    case 'voxlead': {
      const form = formant(out, 480, 1900, 3.5);
      nodes.push(...form.nodes);
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [0.2, 1, 0.25, 0.4, 0.15] } as any, envelope: env(0.04, 0.2, 0.7, 0.3) }));
      s.maxPolyphony = 12;
      s.chain(add(new Tone.Vibrato(5.2, 0.06)), form.in as any);
      s.volume.value = -10;
      synth = s;
      break;
    }
    case 'glassbell':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 4.03, modulationIndex: 9, envelope: env(0.002, 1.6, 0.0, 1.5), modulationEnvelope: env(0.002, 0.35, 0, 0.5) } as any)));
      synth!.volume.value = 2; break;
    case 'supersaw':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 6, spread: 55 } as any, envelope: env(0.03, 0.25, 0.65, 0.4) })), [add(new Tone.Filter(3200, 'lowpass'))]);
      synth!.volume.value = -16; break;
    case 'whisper':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.08, 0.25, 0.55, 0.45) })), [add(new Tone.Filter(3500, 'lowpass'))]);
      synth!.volume.value = -11; break;
    case 'sitarish':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 1.02, modulationIndex: 12, envelope: env(0.004, 0.7, 0.25, 0.5), modulationEnvelope: env(0.002, 0.2, 0.1, 0.3) } as any)), [add(new Tone.FeedbackDelay({ delayTime: 0.05, feedback: 0.18, wet: 0.18 }))]);
      synth!.volume.value = -6; break;
    case 'hoover':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 5, spread: 70 } as any, envelope: env(0.01, 0.2, 0.7, 0.25) })), [add(new Tone.Filter(1800, 'lowpass')), add(new Tone.Distortion(0.25))]);
      synth!.volume.value = -16; break;
    case 'choirooh': {
      const form = formant(out, 400, 800, 3);
      nodes.push(...form.nodes);
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'custom', partials: [1, 0.7, 0.25, 0.15, 0.2] } as any, envelope: env(0.08, 0.3, 0.8, 0.5) }));
      s.maxPolyphony = 12;
      s.chain(add(new Tone.Chorus({ frequency: 1.1, delayTime: 3, depth: 0.35, wet: 0.4 })), form.in as any);
      s.volume.value = -13;
      synth = s;
      break;
    }
    case 'tapeflute':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.08, 0.2, 0.75, 0.35) })), [add(new Tone.Filter(2400, 'lowpass')), add(new Tone.Vibrato(0.8, 0.07))]);
      synth!.volume.value = -11; break;
    case 'dirtlead':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: env(0.01, 0.18, 0.6, 0.25) })), [add(new Tone.Filter(2000, 'lowpass')), add(new Tone.Distortion(0.45))]);
      synth!.volume.value = -10; break;
    case 'pulselead':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'pulse', width: 0.15 } as any, envelope: env(0.005, 0.18, 0.55, 0.2) })), [add(new Tone.Filter(2800, 'lowpass'))]);
      synth!.volume.value = -12; break;
    case 'metalbell':
      finish(add(new Tone.PolySynth(Tone.FMSynth, { harmonicity: 7.1, modulationIndex: 10, envelope: env(0.001, 1.1, 0.0, 1.0), modulationEnvelope: env(0.001, 0.25, 0, 0.4) } as any)));
      synth!.volume.value = 1; break;
    case 'slidelead': {
      const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: env(0.02, 0.2, 0.65, 0.25), filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, baseFrequency: 300, octaves: 2.5 }, portamento: 0.12 } as any));
      s.chain(add(new Tone.Filter(2400, 'lowpass')), out as any);
      s.volume.value = -8;
      let lastT = -1;
      return {
        trigger: (notes, dur, time, vel) => { const t = time <= lastT ? lastT + 0.001 : time; lastT = t; s.triggerAttackRelease(f(notes[0]), dur, t, vel); },
        attack: (m, time, vel) => s.triggerAttack(f(m), time, vel),
        release: (m, time) => s.triggerRelease(time),
        releaseAll: () => s.triggerRelease(),
        dispose: () => { s.dispose(); nodes.forEach((n) => n.dispose()); },
      };
    }
    case 'shimmerlead': {
      const s = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: env(0.03, 0.25, 0.6, 0.5) }));
      const hi = add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: env(0.08, 0.4, 0.3, 1.6) }));
      s.maxPolyphony = 12; hi.maxPolyphony = 12;
      s.connect(out as any);
      hi.chain(add(new Tone.Filter(2000, 'highpass')), add(new Tone.FeedbackDelay({ delayTime: 0.18, feedback: 0.3, wet: 0.4 })), out as any);
      s.volume.value = -10; hi.volume.value = -16;
      synth = s; extra = hi;
      break;
    }
    case 'beesaw':
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 5, spread: 80 } as any, envelope: env(0.02, 0.2, 0.6, 0.3) })), [add(new Tone.Filter(1600, 'lowpass'))]);
      synth!.volume.value = -15; break;
    case 'softlead':
    default:
      finish(add(new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: env(0.02, 0.3, 0.6, 0.4) })));
      synth!.volume.value = -8.5;
  }

  if (!synth) throw new Error('makePoly produced no synth');
  const s0 = synth;
  const s1 = extra;
  return {
    trigger: (notes, dur, time, vel) => {
      const freqs = notes.map(f);
      s0.triggerAttackRelease(freqs, dur, time, vel);
      if (s1) s1.triggerAttackRelease(freqs.map((hz) => hz * 2), dur * 1.15, time, vel * 0.7);
    },
    attack: (m, time, vel) => { s0.triggerAttack(f(m), time, vel); s1?.triggerAttack(f(m) * 2, time, vel * 0.7); },
    release: (m, time) => { s0.triggerRelease(f(m), time); s1?.triggerRelease(f(m) * 2, time); },
    releaseAll: () => { s0.releaseAll(); s1?.releaseAll(); },
    dispose: () => { s0.dispose(); s1?.dispose(); nodes.forEach((n) => n.dispose()); chain.forEach((c) => { try { c.dispose(); } catch { /* already */ } }); },
  };
}

export function makeBass(kind: string, out: Tone.InputNode): Inst {
  const nodes: { dispose(): unknown }[] = [];
  const add = <T extends { dispose(): unknown }>(n: T) => { nodes.push(n); return n; };
  let trigger: Inst['trigger'];
  let disposeExtra = () => {};

  const mono = (s: Tone.Synth | Tone.MonoSynth | Tone.MembraneSynth | Tone.FMSynth, fx: Tone.ToneAudioNode[] = []) => {
    s.chain(...fx, out as any);
    let lastT = -1;
    trigger = (notes, dur, time, vel) => {
      const t = time <= lastT ? lastT + 0.001 : time; lastT = t;
      (s as any).triggerAttackRelease(f(notes[0]), dur, t, vel);
    };
    disposeExtra = () => { s.dispose(); fx.forEach((x) => x.dispose()); };
  };

  switch (kind) {
    case 'sub':
      { const s = add(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.6, sustain: 0.7, release: 0.25 }, portamento: 0.02 })); s.volume.value = -10; mono(s, [add(new Tone.Distortion(0.18))]); break; }
    case 'round':
      { const s = add(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.45, sustain: 0.25, release: 0.15 } })); s.volume.value = -2; mono(s, [add(new Tone.Filter(900, 'lowpass'))]); break; }
    case 'saw':
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.003, decay: 0.2, sustain: 0.6, release: 0.1 }, filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.3, baseFrequency: 160, octaves: 3.2 } } as any)); s.volume.value = -5.5; mono(s); break; }
    case 'log':
      { const s = add(new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 1.4, envelope: { attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.2 } })); s.volume.value = -0.5; mono(s); break; }
    case 'subglide':
      { const s = add(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.008, decay: 0.7, sustain: 0.75, release: 0.35 }, portamento: 0.09 })); s.volume.value = -10; mono(s, [add(new Tone.Distortion(0.22)), add(new Tone.Filter(500, 'lowpass'))]); break; }
    case 'dirty808':
      { const s = add(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.004, decay: 0.55, sustain: 0.65, release: 0.28 }, portamento: 0.035 })); s.volume.value = -12; mono(s, [add(new Tone.Chebyshev(4)), add(new Tone.Distortion(0.45)), add(new Tone.Filter(700, 'lowpass'))]); break; }
    case 'reese': {
      const a = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.3 }, filter: { Q: 1.2 }, filterEnvelope: { attack: 0.05, decay: 0.4, sustain: 0.4, baseFrequency: 80, octaves: 2.2 } } as any));
      const b = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.3 }, filterEnvelope: { attack: 0.05, decay: 0.4, sustain: 0.4, baseFrequency: 80, octaves: 2.2 } } as any));
      const lp = add(new Tone.Filter(280, 'lowpass'));
      a.connect(lp); b.connect(lp); lp.connect(out as any);
      a.volume.value = -14; b.volume.value = -14;
      a.detune.value = -7; b.detune.value = 9;
      let lastT = -1;
      trigger = (notes, dur, time, vel) => {
        const t = time <= lastT ? lastT + 0.001 : time; lastT = t;
        a.triggerAttackRelease(f(notes[0]), dur, t, vel);
        b.triggerAttackRelease(f(notes[0]), dur, t, vel);
      };
      disposeExtra = () => { a.dispose(); b.dispose(); lp.dispose(); };
      break;
    }
    case 'growl':
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.55, release: 0.15 }, filter: { Q: 2.4, type: 'lowpass' }, filterEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.2, baseFrequency: 90, octaves: 3 } } as any)); s.volume.value = -8; mono(s, [add(new Tone.Distortion(0.3))]); break; }
    case 'acid':
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.002, decay: 0.15, sustain: 0.35, release: 0.08 }, filter: { Q: 8, type: 'lowpass' }, filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0.05, baseFrequency: 200, octaves: 4.2 } } as any)); s.volume.value = -7; mono(s); break; }
    case 'rubber':
      { const s = add(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.35, sustain: 0.2, release: 0.12 } })); s.volume.value = -4; mono(s, [add(new Tone.Filter(1100, 'lowpass'))]); break; }
    case 'moogish':
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.006, decay: 0.28, sustain: 0.6, release: 0.18 }, filter: { Q: 1.8, type: 'lowpass' }, filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.35, baseFrequency: 100, octaves: 2.8 } } as any)); s.volume.value = -7; mono(s); break; }
    case 'tapebass':
      { const s = add(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.25 } })); s.volume.value = -5; mono(s, [add(new Tone.Vibrato(0.6, 0.05)), add(new Tone.Filter(700, 'lowpass')), add(new Tone.Chebyshev(2))]); break; }
    case 'fmbass':
      { const s = add(new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 8, envelope: { attack: 0.003, decay: 0.25, sustain: 0.4, release: 0.18 }, modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.1 } })); s.volume.value = -8; mono(s, [add(new Tone.Filter(800, 'lowpass'))]); break; }
    case 'organbass':
      { const s = add(new Tone.Synth({ oscillator: { type: 'custom', partials: [1, 0.6, 0.3, 0.15] } as any, envelope: { attack: 0.02, decay: 0.15, sustain: 0.9, release: 0.2 } })); s.volume.value = -14; mono(s, [add(new Tone.Filter(600, 'lowpass'))]); break; }
    case 'choirsub':
      { const s = add(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.5, sustain: 0.75, release: 0.4 } })); s.volume.value = -11; mono(s, [add(new Tone.Filter({ type: 'peaking', frequency: 420, Q: 2, gain: 5 })), add(new Tone.Filter(500, 'lowpass'))]); break; }
    case 'drone':
      { const s = add(new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 12 } as any, envelope: { attack: 0.15, decay: 0.4, sustain: 0.95, release: 1.4 } })); s.volume.value = -16; mono(s, [add(new Tone.Filter(250, 'lowpass'))]); break; }
    case 'wobble': {
      const s = add(new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2 }, filter: { Q: 4, type: 'lowpass' }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, baseFrequency: 80, octaves: 3 } } as any));
      const lfo = add(new Tone.LFO({ frequency: 2.2, min: 60, max: 900 }));
      lfo.connect(s.filter.frequency); lfo.start();
      s.volume.value = -8; mono(s);
      break;
    }
    case 'hooverbass':
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'fatsawtooth', count: 4, spread: 40 } as any, envelope: { attack: 0.008, decay: 0.2, sustain: 0.65, release: 0.18 }, filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.3, baseFrequency: 120, octaves: 2.4 } } as any)); s.volume.value = -14; mono(s, [add(new Tone.Distortion(0.28))]); break; }
    case 'glassbass':
      { const s = add(new Tone.FMSynth({ harmonicity: 2.02, modulationIndex: 5, envelope: { attack: 0.01, decay: 0.35, sustain: 0.5, release: 0.3 }, modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 } })); s.volume.value = -10; mono(s, [add(new Tone.Filter(600, 'lowpass'))]); break; }
    case 'analog':
    default:
      { const s = add(new Tone.MonoSynth({ oscillator: { type: 'square' }, envelope: { attack: 0.004, decay: 0.3, sustain: 0.5, release: 0.12 }, filterEnvelope: { attack: 0.003, decay: 0.2, sustain: 0.25, baseFrequency: 110, octaves: 2.6 } } as any)); s.volume.value = -9; mono(s); break; }
  }

  return { trigger: trigger!, dispose: () => { disposeExtra(); nodes.forEach((n) => { try { n.dispose(); } catch { /* ok */ } }); } };
}

type PercKind = 'membrane' | 'noise' | 'metal' | 'cowbell';
interface KitSpec {
  kickNote: string; kickPitchDecay: number; kickOct: number; kickDecay: number; kickVol: number;
  snareNoise: 'white' | 'pink' | 'brown'; snareHp: number; snareDecay: number; snareVol: number; bodyNote: string; bodyVol: number;
  clapBp: number; clapVol: number; clapHits: number;
  hatHp: number; hatDecay: number; hatVol: number;
  openHp: number; openDecay: number; openVol: number;
  perc: PercKind; percNote: string; percDecay: number; percVol: number; percBp?: number;
  color?: 'dusty' | 'crunch' | 'dark' | 'bright' | 'crush';
}

const KITS: Record<string, KitSpec> = {
  boom808: { kickNote: 'A1', kickPitchDecay: 0.06, kickOct: 6, kickDecay: 0.32, kickVol: -5, snareNoise: 'white', snareHp: 1600, snareDecay: 0.16, snareVol: -9, bodyNote: 'G3', bodyVol: -14, clapBp: 1300, clapVol: -4, clapHits: 3, hatHp: 8500, hatDecay: 0.045, hatVol: -14, openHp: 7500, openDecay: 0.32, openVol: -17, perc: 'membrane', percNote: 'E5', percDecay: 0.06, percVol: -12 },
  dusty: { kickNote: 'A1', kickPitchDecay: 0.035, kickOct: 6, kickDecay: 0.28, kickVol: -5, snareNoise: 'pink', snareHp: 1600, snareDecay: 0.16, snareVol: -9, bodyNote: 'G3', bodyVol: -14, clapBp: 1300, clapVol: -4, clapHits: 3, hatHp: 6500, hatDecay: 0.045, hatVol: -14, openHp: 7500, openDecay: 0.32, openVol: -17, perc: 'membrane', percNote: 'E5', percDecay: 0.06, percVol: -12, color: 'dusty' },
  tight: { kickNote: 'A1', kickPitchDecay: 0.035, kickOct: 6, kickDecay: 0.22, kickVol: -5, snareNoise: 'white', snareHp: 2200, snareDecay: 0.14, snareVol: -9, bodyNote: 'G3', bodyVol: -14, clapBp: 1400, clapVol: -4, clapHits: 3, hatHp: 8500, hatDecay: 0.04, hatVol: -14, openHp: 8000, openDecay: 0.26, openVol: -17, perc: 'membrane', percNote: 'E5', percDecay: 0.05, percVol: -12 },
  organic: { kickNote: 'A1', kickPitchDecay: 0.035, kickOct: 6, kickDecay: 0.28, kickVol: -5, snareNoise: 'white', snareHp: 1600, snareDecay: 0.16, snareVol: -9, bodyNote: 'G3', bodyVol: -14, clapBp: 1300, clapVol: -4, clapHits: 3, hatHp: 8500, hatDecay: 0.03, hatVol: -14, openHp: 7500, openDecay: 0.32, openVol: -17, perc: 'noise', percNote: 'E5', percDecay: 0.07, percVol: -10, percBp: 5000 },
  big: { kickNote: 'F1', kickPitchDecay: 0.09, kickOct: 7, kickDecay: 0.6, kickVol: -5, snareNoise: 'white', snareHp: 1600, snareDecay: 0.3, snareVol: -9, bodyNote: 'G3', bodyVol: -14, clapBp: 1300, clapVol: -4, clapHits: 3, hatHp: 8500, hatDecay: 0.045, hatVol: -14, openHp: 7500, openDecay: 0.4, openVol: -17, perc: 'membrane', percNote: 'C2', percDecay: 0.35, percVol: -12 },
  gospelclap: { kickNote: 'A1', kickPitchDecay: 0.04, kickOct: 6, kickDecay: 0.3, kickVol: -5, snareNoise: 'white', snareHp: 1800, snareDecay: 0.18, snareVol: -11, bodyNote: 'G3', bodyVol: -16, clapBp: 1500, clapVol: -1, clapHits: 4, hatHp: 9000, hatDecay: 0.04, hatVol: -15, openHp: 8000, openDecay: 0.28, openVol: -16, perc: 'noise', percNote: 'C6', percDecay: 0.09, percVol: -11, percBp: 6000, color: 'bright' },
  trapdark: { kickNote: 'A1', kickPitchDecay: 0.05, kickOct: 6.5, kickDecay: 0.24, kickVol: -4, snareNoise: 'white', snareHp: 2000, snareDecay: 0.14, snareVol: -8, bodyNote: 'A3', bodyVol: -15, clapBp: 1600, clapVol: -3, clapHits: 3, hatHp: 10000, hatDecay: 0.035, hatVol: -13, openHp: 9000, openDecay: 0.22, openVol: -16, perc: 'membrane', percNote: 'C5', percDecay: 0.05, percVol: -11, color: 'dark' },
  phonkbell: { kickNote: 'A1', kickPitchDecay: 0.045, kickOct: 6, kickDecay: 0.3, kickVol: -5, snareNoise: 'pink', snareHp: 1400, snareDecay: 0.2, snareVol: -8, bodyNote: 'G3', bodyVol: -12, clapBp: 1200, clapVol: -5, clapHits: 2, hatHp: 7000, hatDecay: 0.05, hatVol: -14, openHp: 6500, openDecay: 0.3, openVol: -16, perc: 'cowbell', percNote: 'G5', percDecay: 0.25, percVol: -8, color: 'crunch' },
  lofitape: { kickNote: 'A1', kickPitchDecay: 0.03, kickOct: 5.5, kickDecay: 0.34, kickVol: -6, snareNoise: 'pink', snareHp: 1200, snareDecay: 0.2, snareVol: -10, bodyNote: 'F3', bodyVol: -16, clapBp: 1000, clapVol: -6, clapHits: 2, hatHp: 5200, hatDecay: 0.05, hatVol: -16, openHp: 5000, openDecay: 0.35, openVol: -18, perc: 'noise', percNote: 'E5', percDecay: 0.08, percVol: -14, percBp: 2500, color: 'dusty' },
  worldpulse: { kickNote: 'G1', kickPitchDecay: 0.04, kickOct: 5, kickDecay: 0.28, kickVol: -5, snareNoise: 'pink', snareHp: 1000, snareDecay: 0.12, snareVol: -12, bodyNote: 'E3', bodyVol: -14, clapBp: 900, clapVol: -8, clapHits: 2, hatHp: 7000, hatDecay: 0.06, hatVol: -13, openHp: 6000, openDecay: 0.28, openVol: -16, perc: 'membrane', percNote: 'G3', percDecay: 0.14, percVol: -8, percBp: 800 },
  technoclick: { kickNote: 'A1', kickPitchDecay: 0.02, kickOct: 5, kickDecay: 0.18, kickVol: -4, snareNoise: 'white', snareHp: 2500, snareDecay: 0.1, snareVol: -8, bodyNote: 'C4', bodyVol: -18, clapBp: 2000, clapVol: -8, clapHits: 1, hatHp: 11000, hatDecay: 0.03, hatVol: -13, openHp: 10000, openDecay: 0.18, openVol: -16, perc: 'membrane', percNote: 'C6', percDecay: 0.03, percVol: -10, color: 'bright' },
  boombapcrunch: { kickNote: 'A1', kickPitchDecay: 0.05, kickOct: 6, kickDecay: 0.36, kickVol: -5, snareNoise: 'white', snareHp: 1400, snareDecay: 0.22, snareVol: -7, bodyNote: 'G3', bodyVol: -11, clapBp: 1100, clapVol: -6, clapHits: 2, hatHp: 7000, hatDecay: 0.055, hatVol: -15, openHp: 6500, openDecay: 0.34, openVol: -17, perc: 'membrane', percNote: 'D4', percDecay: 0.08, percVol: -12, color: 'crunch' },
  drillhat: { kickNote: 'A1', kickPitchDecay: 0.045, kickOct: 6, kickDecay: 0.26, kickVol: -4, snareNoise: 'white', snareHp: 2400, snareDecay: 0.11, snareVol: -8, bodyNote: 'B3', bodyVol: -16, clapBp: 1800, clapVol: -4, clapHits: 3, hatHp: 11000, hatDecay: 0.028, hatVol: -12, openHp: 9500, openDecay: 0.2, openVol: -15, perc: 'membrane', percNote: 'E5', percDecay: 0.04, percVol: -12, color: 'bright' },
  amapianoshek: { kickNote: 'G1', kickPitchDecay: 0.03, kickOct: 5, kickDecay: 0.26, kickVol: -5, snareNoise: 'white', snareHp: 1800, snareDecay: 0.12, snareVol: -11, bodyNote: 'E3', bodyVol: -16, clapBp: 1400, clapVol: -7, clapHits: 2, hatHp: 8000, hatDecay: 0.07, hatVol: -12, openHp: 7000, openDecay: 0.3, openVol: -15, perc: 'noise', percNote: 'A5', percDecay: 0.1, percVol: -9, percBp: 5500 },
  industrial: { kickNote: 'F1', kickPitchDecay: 0.07, kickOct: 6, kickDecay: 0.4, kickVol: -6, snareNoise: 'white', snareHp: 800, snareDecay: 0.25, snareVol: -8, bodyNote: 'C3', bodyVol: -10, clapBp: 700, clapVol: -8, clapHits: 1, hatHp: 5000, hatDecay: 0.06, hatVol: -14, openHp: 4000, openDecay: 0.4, openVol: -16, perc: 'metal', percNote: 'C4', percDecay: 0.3, percVol: -10, color: 'crunch' },
  jazzbrush: { kickNote: 'A1', kickPitchDecay: 0.025, kickOct: 5, kickDecay: 0.3, kickVol: -8, snareNoise: 'pink', snareHp: 900, snareDecay: 0.28, snareVol: -11, bodyNote: 'E3', bodyVol: -20, clapBp: 800, clapVol: -10, clapHits: 1, hatHp: 6000, hatDecay: 0.08, hatVol: -16, openHp: 5500, openDecay: 0.45, openVol: -18, perc: 'noise', percNote: 'C6', percDecay: 0.12, percVol: -14, percBp: 4000, color: 'dusty' },
  gospelroom: { kickNote: 'A1', kickPitchDecay: 0.055, kickOct: 6.5, kickDecay: 0.45, kickVol: -5, snareNoise: 'white', snareHp: 1500, snareDecay: 0.24, snareVol: -10, bodyNote: 'G3', bodyVol: -15, clapBp: 1400, clapVol: -2, clapHits: 4, hatHp: 8500, hatDecay: 0.05, hatVol: -15, openHp: 7500, openDecay: 0.4, openVol: -16, perc: 'noise', percNote: 'G5', percDecay: 0.12, percVol: -11, percBp: 6500, color: 'bright' },
  glitchtick: { kickNote: 'A1', kickPitchDecay: 0.015, kickOct: 4, kickDecay: 0.12, kickVol: -6, snareNoise: 'white', snareHp: 3000, snareDecay: 0.06, snareVol: -9, bodyNote: 'C5', bodyVol: -18, clapBp: 2500, clapVol: -8, clapHits: 1, hatHp: 12000, hatDecay: 0.02, hatVol: -13, openHp: 10000, openDecay: 0.1, openVol: -16, perc: 'membrane', percNote: 'C7', percDecay: 0.02, percVol: -10, color: 'crush' },
  rimshot: { kickNote: 'A1', kickPitchDecay: 0.03, kickOct: 5.5, kickDecay: 0.22, kickVol: -5, snareNoise: 'white', snareHp: 2800, snareDecay: 0.08, snareVol: -10, bodyNote: 'E4', bodyVol: -8, clapBp: 2000, clapVol: -6, clapHits: 2, hatHp: 9000, hatDecay: 0.035, hatVol: -14, openHp: 8000, openDecay: 0.22, openVol: -16, perc: 'membrane', percNote: 'C6', percDecay: 0.04, percVol: -9 },
  halo: { kickNote: 'A1', kickPitchDecay: 0.04, kickOct: 6, kickDecay: 0.36, kickVol: -7, snareNoise: 'pink', snareHp: 1800, snareDecay: 0.2, snareVol: -12, bodyNote: 'G3', bodyVol: -18, clapBp: 1600, clapVol: -8, clapHits: 2, hatHp: 9000, hatDecay: 0.06, hatVol: -16, openHp: 8500, openDecay: 0.5, openVol: -14, perc: 'metal', percNote: 'E5', percDecay: 0.4, percVol: -14, color: 'bright' },
};

export function makeKit(kind: string, out: Tone.InputNode): Kit {
  const spec = KITS[kind] ?? KITS.tight;
  const nodes: Tone.ToneAudioNode[] = [];
  const add = <T extends Tone.ToneAudioNode>(n: T) => { nodes.push(n); return n; };
  const bus = add(new Tone.Gain(1));
  if (spec.color === 'dusty') { const lp = add(new Tone.Filter(5200, 'lowpass')); const d = add(new Tone.Distortion(0.12)); bus.chain(d, lp, out as any); }
  else if (spec.color === 'crunch') { const d = add(new Tone.Distortion(0.28)); const lp = add(new Tone.Filter(7000, 'lowpass')); bus.chain(d, lp, out as any); }
  else if (spec.color === 'dark') { const lp = add(new Tone.Filter(4000, 'lowpass')); bus.chain(lp, out as any); }
  else if (spec.color === 'crush') { const b = add(new Tone.BitCrusher(5)); bus.chain(b, out as any); }
  else bus.connect(out as any);

  const kick = add(new Tone.MembraneSynth({ pitchDecay: spec.kickPitchDecay, octaves: spec.kickOct, envelope: { attack: 0.001, decay: spec.kickDecay, sustain: 0, release: 0.1 } }));
  kick.volume.value = spec.kickVol; kick.connect(bus);
  const snareN = add(new Tone.NoiseSynth({ noise: { type: spec.snareNoise }, envelope: { attack: 0.001, decay: spec.snareDecay, sustain: 0 } }));
  const snareF = add(new Tone.Filter(spec.snareHp, 'highpass')); snareN.chain(snareF, bus); snareN.volume.value = spec.snareVol;
  const snareB = add(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } })); snareB.volume.value = spec.bodyVol; snareB.connect(bus);
  const clap = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }));
  const clapF = add(new Tone.Filter({ frequency: spec.clapBp, type: 'bandpass', Q: 0.9 })); clap.chain(clapF, bus); clap.volume.value = spec.clapVol;
  const hat = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: spec.hatDecay, sustain: 0 } }));
  const hatF = add(new Tone.Filter(spec.hatHp, 'highpass')); hat.chain(hatF, bus); hat.volume.value = spec.hatVol;
  const open = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: spec.openDecay, sustain: 0 } }));
  const openF = add(new Tone.Filter(spec.openHp, 'highpass')); open.chain(openF, bus); open.volume.value = spec.openVol;

  let perc: Tone.ToneAudioNode;
  let percHit: (t: number, vel: number) => void;
  if (spec.perc === 'noise') {
    const p = add(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.012, decay: spec.percDecay, sustain: 0 } }));
    const pf = add(new Tone.Filter(spec.percBp ?? 5000, 'bandpass'));
    p.chain(pf, bus); p.volume.value = spec.percVol;
    perc = p; percHit = (t, vel) => p.triggerAttackRelease(0.05, t, vel);
  } else if (spec.perc === 'metal') {
    const p = add(new Tone.MetalSynth({ envelope: { attack: 0.001, decay: spec.percDecay, release: 0.1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 2500, octaves: 1.5 }));
    p.connect(bus); p.volume.value = spec.percVol;
    perc = p; percHit = (t, vel) => p.triggerAttackRelease(spec.percNote, 0.08, t, vel);
  } else if (spec.perc === 'cowbell') {
    const p = add(new Tone.FMSynth({ harmonicity: 3.4, modulationIndex: 4, oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: spec.percDecay, sustain: 0, release: 0.08 }, modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 } }));
    p.connect(bus); p.volume.value = spec.percVol;
    perc = p; percHit = (t, vel) => p.triggerAttackRelease(spec.percNote, 0.12, t, vel);
  } else {
    const p = add(new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.5, envelope: { attack: 0.001, decay: spec.percDecay, sustain: 0, release: 0.05 } }));
    const pf = add(new Tone.Filter(spec.percBp ?? 200, spec.percBp ? 'bandpass' : 'highpass'));
    p.chain(pf, bus); p.volume.value = spec.percVol;
    perc = p; percHit = (t, vel) => p.triggerAttackRelease(spec.percNote, 0.05, t, vel);
  }
  void perc;

  const last: Record<string, number> = {};
  const safe = (row: string, t: number) => { const l = last[row] ?? -1; const tt = t <= l ? l + 0.0005 : t; last[row] = tt; return tt; };
  return {
    hit(row, time, vel) {
      switch (row) {
        case 'kick': kick.triggerAttackRelease(spec.kickNote, 0.3, safe(row, time), vel); break;
        case 'snare': { const t = safe(row, time); snareN.triggerAttackRelease(0.15, t, vel); snareB.triggerAttackRelease(spec.bodyNote, 0.08, t, vel); break; }
        case 'clap': {
          const t = safe(row, time);
          const hits = Math.max(1, spec.clapHits);
          for (let i = 0; i < hits; i++) {
            const v = i === hits - 1 ? vel : vel * (0.55 + i * 0.1);
            const d = i === hits - 1 ? 0.08 : 0.01;
            clap.triggerAttackRelease(d, t + i * 0.011, v);
          }
          last[row] = t + (hits - 1) * 0.011;
          break;
        }
        case 'hat': hat.triggerAttackRelease(0.03, safe(row, time), vel); break;
        case 'open': open.triggerAttackRelease(Math.min(0.4, spec.openDecay), safe(row, time), vel); break;
        case 'perc': percHit(safe(row, time), vel); break;
      }
    },
    dispose() { nodes.forEach((n) => n.dispose()); },
  };
}
