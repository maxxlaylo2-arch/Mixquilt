import { useState } from 'preact/hooks';
import { update, useSong } from '../store';
import { DRUM_ROWS, STEPS, emptyPattern, type StepVal } from '../model';
import { Card, NextStep, Seg } from './common';
import { setUi, useUi, useEmitter } from './ui';
import { heardBeat, isPlaying, liveDrum, onEngine } from '../audio/engine';
import { grooveById } from '../theory';
import { useEffect } from 'preact/hooks';

function usePlayhead() {
  useEmitter(onEngine);
  const [step, setStep] = useState(-1);
  const playing = isPlaying();
  useEffect(() => {
    if (!playing) { setStep(-1); return; }
    let raf = 0;
    const f = () => { setStep(Math.floor((heardBeat() * 4) % STEPS)); raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return step;
}

export function BeatTab() {
  const s = useSong();
  const u = useUi();
  const [half, setHalf] = useState<0 | 1>(0);
  const pat = s.beats[u.beat];
  const step = usePlayhead();
  const cycle = (row: string, i: number) => {
    const cur = (pat as any)[row][i] as StepVal;
    const max = row === 'hat' || row === 'open' ? 3 : 2;
    const next = ((cur + 1) % (max + 1)) as StepVal;
    update((x) => { (x.beats[u.beat] as any)[row][i] = next; }, ['beat', `Edited Beat ${u.beat} (${DRUM_ROWS.find((r) => r.id === row)?.label})`]);
    if (next && !isPlaying()) liveDrum(row);
  };
  const filled = DRUM_ROWS.reduce((a, r) => a + pat[r.id].filter(Boolean).length, 0);
  return (
    <div class="tab-page">
      <div class="hero">
        <h1>Beat grid</h1>
        <p>Tap squares to place drum hits. Tap again for a soft hit; hi-hats also get a roll. Press play to loop it with your chords.</p>
      </div>
      <Card>
        <div class="row wrap between">
          <Seg label="Pattern" value={u.beat} onChange={(v) => setUi({ beat: v })} options={[['A', 'Beat A'], ['B', 'Beat B']]} />
          <div class="row">
            <button class="btn ghost" onClick={() => { if (confirm(`Copy Beat ${u.beat} onto Beat ${u.beat === 'A' ? 'B' : 'A'}?`)) update((x) => { x.beats[u.beat === 'A' ? 'B' : 'A'] = JSON.parse(JSON.stringify(x.beats[u.beat])); }, ['beat', `Copied Beat ${u.beat} to Beat ${u.beat === 'A' ? 'B' : 'A'}`]); }}>Copy to {u.beat === 'A' ? 'B' : 'A'}</button>
            <button class="btn ghost" onClick={() => { if (filled && confirm(`Clear Beat ${u.beat}?`)) update((x) => { x.beats[u.beat] = emptyPattern(); }, ['beat', `Cleared Beat ${u.beat}`]); }}>Clear</button>
          </div>
        </div>
        <div class="half-switch">
          <Seg label="Steps shown" value={half} onChange={setHalf} options={[[0, 'Steps 1–8'], [1, 'Steps 9–16']]} />
        </div>
        <div class={'grid half-' + half} role="grid" aria-label={`Beat ${u.beat} grid`} data-testid="beat-grid">
          <div class="grid-row head" role="row">
            <span class="row-label" />
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} class={'step-num' + (i % 4 === 0 ? ' beat' : '')} data-half={i < 8 ? 0 : 1}>{i % 4 === 0 ? i / 4 + 1 : '·'}</span>
            ))}
          </div>
          {DRUM_ROWS.map((r) => (
            <div class={'grid-row row-' + r.id} role="row" key={r.id}>
              <button class="row-label" onClick={() => liveDrum(r.id)} aria-label={`Hear ${r.label}`}>{r.label}</button>
              {pat[r.id].map((v, i) => (
                <button key={i} role="gridcell" data-half={i < 8 ? 0 : 1} data-v={v}
                  class={'cell' + (i % 4 === 0 ? ' downbeat' : '') + (step === i ? ' now' : '') + (Math.floor(i / 4) % 2 ? ' alt' : '')}
                  aria-label={`${r.label} step ${i + 1}: ${['off', 'hit', 'soft', 'roll'][v]}`} aria-pressed={v > 0}
                  onClick={() => cycle(r.id, i)}>
                  {v === 3 ? '⋮' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div class="groove-meter" data-testid="groove-meter" aria-label={`Swing ${Math.round(grooveById(s.recipe.groove).swing * 100)} percent`}>
          <div class="row between">
            <span class="muted small">Groove · {grooveById(s.recipe.groove).label}</span>
            <span class="muted tiny">{Math.round(grooveById(s.recipe.groove).swing * 100)}% swing</span>
          </div>
          <div class="groove-track" aria-hidden="true">
            <span class="groove-knob" style={{ left: `${Math.min(100, Math.max(0, (grooveById(s.recipe.groove).swing - 0.5) / 0.2 * 100))}%` }} />
          </div>
          <p class="muted tiny">Left = straight · right = heavier swing. Change groove in Recipe.</p>
        </div>
        <p class="muted small">The Bass note row plays the root of the current chord.</p>
      </Card>
      <NextStep label="Next: play chords and melody" onClick={() => setUi({ tab: 'play' })} />
    </div>
  );
}
