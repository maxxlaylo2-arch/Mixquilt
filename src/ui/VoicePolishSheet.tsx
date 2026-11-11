import { useEffect, useRef, useState } from 'preact/hooks';
import { getSong, logAction, update, useSong } from '../store';
import type { Take } from '../model';
import { Seg } from './common';
import { toast } from './ui';
import { describeSettings, polishedBuffer, presetSettings, PRESETS, type PresetId, type VoicePolishSettings } from '../audio/voicePolish';
import type { PolishReport, Space } from '../audio/polishDsp';
import { polishContext, rawTakeBuffer } from '../audio/takes';
import { nativeContext } from '../audio/engine';
import { IconPlay, IconStop } from './icons';

type AB = 'A' | 'B';

/** Plays original and polished copies in sync so the A/B switch is instant. */
class ABPlayer {
  srcs: AudioBufferSourceNode[] = []; gA?: GainNode; gB?: GainNode; onEnd?: () => void;
  async start(a: AudioBuffer, b: AudioBuffer, which: AB) {
    this.stop();
    const ctx = nativeContext(); await ctx.resume();
    this.gA = ctx.createGain(); this.gB = ctx.createGain();
    this.gA.connect(ctx.destination); this.gB.connect(ctx.destination);
    this.set(which);
    const t = ctx.currentTime + 0.05;
    for (const [buf, g] of [[a, this.gA], [b, this.gB]] as const) {
      const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g); s.start(t); this.srcs.push(s);
    }
    this.srcs[1].onended = () => { this.stop(); this.onEnd?.(); };
  }
  set(which: AB) { this.gA?.gain.setTargetAtTime(which === 'A' ? 1 : 0, nativeContext().currentTime, 0.01); this.gB?.gain.setTargetAtTime(which === 'B' ? 1 : 0, nativeContext().currentTime, 0.01); }
  stop() { for (const s of this.srcs) { s.onended = null; try { s.stop(); } catch { /* ok */ } } this.srcs = []; this.gA?.disconnect(); this.gB?.disconnect(); }
}

function Slider(p: { label: string; left: string; right: string; value: number; onChange: (v: number) => void; testid?: string }) {
  return (
    <label class="polish-slider">
      <span class="ps-label">{p.label} <b>{Math.round(p.value * 100)}%</b></span>
      <input type="range" class="range" min={0} max={1} step={0.01} value={p.value} aria-label={p.label} data-testid={p.testid}
        onInput={(e) => p.onChange(Number((e.target as HTMLInputElement).value))} />
      <span class="ps-ends"><span>{p.left}</span><span>{p.right}</span></span>
    </label>
  );
}

export function VoicePolishSheet(p: { take: Take; onClose: () => void }) {
  const s = useSong();
  const take = s.takes.find((t) => t.id === p.take.id) ?? p.take;
  const initial = useRef(JSON.stringify(take.polish?.settings ?? null));
  const settings = (take.polish?.settings as unknown as VoicePolishSettings | undefined) ?? null;
  const [busy, setBusy] = useState<{ f: number; stage: string } | null>(null);
  const [report, setReport] = useState<PolishReport | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef(new ABPlayer());
  const timer = useRef<number | undefined>(undefined);
  const ab: AB = settings && !settings.bypass ? 'B' : 'A';

  const setSettings = (next: VoicePolishSettings | null) => {
    update((x) => { const t = x.takes.find((q) => q.id === take.id)!; t.polish = next ? { kind: 'pitch-timing', settings: next as any, processedAudioKey: t.polish?.processedAudioKey } : null; });
  };
  const tweak = (patch: Partial<VoicePolishSettings>) => { if (!settings) return; setSettings({ ...settings, ...patch, preset: 'custom' }); };

  async function process(): Promise<AudioBuffer | null> {
    const cur = getSong().takes.find((q) => q.id === take.id);
    const st = cur?.polish?.settings as unknown as VoicePolishSettings | undefined;
    if (!cur || !st) { setReport(null); return null; }
    const raw = await rawTakeBuffer(cur); if (!raw) return null;
    setBusy({ f: 0, stage: 'Starting' });
    try {
      const res = await polishedBuffer(raw, { ...st, bypass: false }, polishContext(cur, getSong()), (f, stage) => setBusy({ f, stage }));
      setReport(res.report);
      return res.buf;
    } catch (e) { console.error(e); toast('Voice Polish failed on this take.'); return null; }
    finally { setBusy(null); }
  }
  // (re)process whenever settings change, debounced so slider drags stay smooth
  useEffect(() => {
    clearTimeout(timer.current);
    if (!settings) { setReport(null); return; }
    timer.current = window.setTimeout(async () => { const b = await process(); if (b && playing) listen(); }, 350);
    return () => clearTimeout(timer.current);
  }, [JSON.stringify(settings && { ...settings, bypass: false }), s.recipe.key, s.recipe.mode, s.recipe.bpm]);
  useEffect(() => () => player.current.stop(), []);

  async function listen() {
    const raw = await rawTakeBuffer(take); if (!raw) return;
    const pol = settings ? await process() : raw;
    if (!pol) return;
    player.current.onEnd = () => setPlaying(false);
    await player.current.start(raw, pol, ab);
    setPlaying(true);
  }
  const close = () => {
    player.current.stop();
    const now = JSON.stringify(getSong().takes.find((q) => q.id === take.id)?.polish?.settings ?? null);
    if (now !== initial.current) {
      const st = JSON.parse(now) as VoicePolishSettings | null;
      update((x) => {
        if (!st) logAction(x, 'polish', `Removed Voice Polish from take "${take.name}"`);
        else logAction(x, 'polish', `Applied Voice Polish to take "${take.name}" (${describeSettings(st)}). Song uses: ${st.bypass ? 'A, original take' : 'B, polished take'}. Classic signal processing (no AI) of the user's own recorded vocal; the original recording is kept.`);
      });
    }
    p.onClose();
  };

  const active: PresetId | 'off' | 'custom' = !settings ? 'off' : settings.preset;
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="sheet polish-sheet" role="dialog" aria-label="Voice Polish" data-testid="polish-sheet">
        <div class="sheet-head"><h2>Voice Polish</h2><button class="btn ghost" data-testid="polish-done" onClick={close}>Done</button></div>
        <p class="muted small">{take.name}. Pitch and timing touch-ups using classic audio processing, no AI. Your original take is always kept.</p>
        <div class="preset-grid" role="radiogroup" aria-label="Preset">
          <button role="radio" aria-checked={active === 'off'} class={'preset' + (active === 'off' ? ' on' : '')} data-testid="preset-off" onClick={() => setSettings(null)}>
            <b>Off</b><span>Raw take</span>
          </button>
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button key={id} role="radio" aria-checked={active === id} class={'preset' + (active === id ? ' on' : '')} data-testid={`preset-${id}`}
              onClick={() => setSettings({ ...presetSettings(id), bypass: settings?.bypass ?? false })}>
              <b>{PRESETS[id].label}</b><span>{PRESETS[id].blurb}</span>
            </button>
          ))}
        </div>
        {settings && (
          <>
            <div class="ab-row">
              <Seg label="A/B compare" value={ab} onChange={(v) => { player.current.set(v); setSettings({ ...settings, bypass: v === 'A' }); }}
                options={[['A', 'A · Original'], ['B', 'B · Polished']]} />
              <button class={'btn primary' + (playing ? ' on' : '')} data-testid="polish-listen" disabled={!!busy} onClick={() => (playing ? (player.current.stop(), setPlaying(false)) : listen())}>
                {playing ? <IconStop size={18} /> : <IconPlay size={18} />}{playing ? 'Stop' : 'Listen'}
              </button>
            </div>
            <p class="muted tiny">Flip A/B while listening to compare. The song and exports use {ab === 'B' ? 'B, the polished take' : 'A, your original take'}.</p>
            <div class="polish-status" data-testid="polish-report" aria-live="polite">
              {busy ? (
                <><div class="bar"><span style={{ width: `${Math.round(busy.f * 100)}%` }} /></div><span>{busy.stage}…</span></>
              ) : report ? (
                <span>Pitch: notes were {Math.round(report.avgErrorCentsBefore)}¢ off the scale on average, now {Math.round(report.avgErrorCentsAfter)}¢. Timing: {report.phrasesMoved} of {report.phrases} phrase starts nudged{report.phrasesMoved ? ` (avg ${Math.round(report.meanShiftMs)} ms)` : ''}.</span>
              ) : <span class="muted">Ready.</span>}
            </div>
            <details class="finetune" data-testid="polish-finetune">
              <summary>Fine-tune</summary>
              <Slider label="Tuning" left="Natural" right="Hard tuned" value={settings.tune} onChange={(v) => tweak({ tune: v })} testid="polish-tune" />
              <Slider label="Humanize" left="Steady" right="Keep vibrato" value={settings.humanize} onChange={(v) => tweak({ humanize: v })} />
              <Slider label="Timing tighten" left="As sung" right="On the grid" value={settings.timing} onChange={(v) => tweak({ timing: v })} />
              <div class="row wrap"><span class="muted small">Grid</span>
                <Seg label="Timing grid" value={settings.grid} onChange={(v) => tweak({ grid: v })} options={[[0.5, '1/8 notes'], [0.25, '1/16 notes']]} />
              </div>
              <label class="check"><input type="checkbox" checked={settings.mix} onChange={() => tweak({ mix: !settings.mix })} /> Sit in the mix (clean lows, soften “s” sounds, even out volume, add presence)</label>
              <div class="row wrap"><span class="muted small">Space</span>
                <Seg label="Space" value={settings.space} onChange={(v) => tweak({ space: v as Space })} options={[['none', 'None'], ['room', 'Room'], ['echo', 'Echo'], ['both', 'Both']]} />
              </div>
              <p class="muted tiny">Tuning snaps to {s.recipe.key} {s.recipe.mode}. Echo is timed to {s.recipe.bpm} BPM.</p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
