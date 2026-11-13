// Original in-app instruments built only from Tone.js / Web Audio synthesis. No samples, no AI.
import * as Tone from 'tone';
import type { Song, TrackId } from '../model';
import { paletteById } from '../theory';
import { toneCutoffHz } from './macros';
import { makeBass, makeKit, makePoly, type Inst, type Kit } from './voices';
export { toneCutoffHz } from './macros';

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

export class Rig {
  channels: Record<TrackId, Tone.Channel>;
  masterGain: Tone.Gain;
  vocalGate: Tone.Gain;
  kit: Kit; bass: Inst; chords: Inst; lead: Inst;
  click: Tone.Synth;
  reverb: Tone.Reverb;
  signature: string;
  private tone: Record<TrackId, Tone.Filter> = {} as any;
  private drive: Record<TrackId, Tone.Distortion> = {} as any;
  private chor: Record<TrackId, Tone.Chorus> = {} as any;
  private sends: Record<TrackId, Tone.Gain> = {} as any;
  private sendBase: Record<TrackId, number> = { drums: 0.12, bass: 0.06, chords: 0.34, melody: 0.28, vocals: 0.32 };
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
    for (const id of ['drums', 'bass', 'chords', 'melody', 'vocals'] as TrackId[]) {
      const c = new Tone.Channel({ volume: 0 });
      const drive = new Tone.Distortion(0.01);
      const tone = new Tone.Filter(8000, 'lowpass');
      const chor = new Tone.Chorus({ frequency: 0.8, delayTime: 3, depth: 0.35, wet: 0 });
      chor.start();
      c.chain(drive, tone, chor, this.masterGain);
      const send = new Tone.Gain(this.sendBase[id]);
      chor.connect(send);
      send.connect(this.reverb);
      this.channels[id] = c;
      this.drive[id] = drive;
      this.tone[id] = tone;
      this.chor[id] = chor;
      this.sends[id] = send;
      this.disposables.push(c, drive, tone, chor, send);
    }
    this.vocalGate = new Tone.Gain(1).connect(this.channels.vocals);
    this.kit = makeKit(ch.kit, this.channels.drums);
    this.bass = makeBass(ch.bass, this.channels.bass);
    this.chords = makePoly(ch.chords, this.channels.chords);
    this.lead = makePoly(ch.lead, this.channels.melody);
    this.click = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } }).toDestination();
    this.click.volume.value = -14;
    this.disposables.push(comp, lim, this.masterGain, this.reverb, revRet, this.vocalGate, this.click);
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
      const tone = m.tone ?? 0.5;
      const drive = m.drive ?? 0.2;
      const character = m.character ?? 0.5;
      this.tone[id].frequency.rampTo(toneCutoffHz(tone), 0.05);
      this.drive[id].distortion = Math.max(0.001, drive * 0.65);
      this.chor[id].wet.rampTo(id === 'drums' || id === 'bass' ? character * 0.12 : character * 0.45, 0.05);
      this.sends[id].gain.rampTo(this.sendBase[id] * (0.45 + character * 1.1), 0.05);
    }
    this.masterGain.gain.value = song.mix.master;
  }

  tick(time: number, down: boolean) { this.click.triggerAttackRelease(down ? 'C6' : 'G5', 0.03, time, down ? 1 : 0.6); }

  dispose() {
    this.kit.dispose(); this.bass.dispose(); this.chords.dispose(); this.lead.dispose();
    for (const id of Object.keys(this.chor) as (keyof typeof this.chor)[]) {
      try { this.chor[id].stop(); } catch { /* already stopped */ }
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
