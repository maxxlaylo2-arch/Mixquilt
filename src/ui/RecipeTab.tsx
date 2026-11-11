import { useState } from 'preact/hooks';
import { update, useSong } from '../store';
import type { Recipe, RecipeField } from '../model';
import { GENRES, GROOVES, KEYS, MODES, MOODS, PALETTES, PROGRESSIONS, STRUCTURES, TWISTS, chordName, modeById } from '../theory';
import { suggest, type Wildness } from '../suggest';
import { applyRecipe, describe, FIELD_LABEL } from '../actions';
import { Card, NextStep, Seg, Select, Stepper } from './common';
import { IconDice, IconLock, IconUnlock } from './icons';
import { setUi, toast } from './ui';
import { refreshInstruments } from '../audio/engine';

function Ingredient(p: { field: RecipeField; children: any; hint?: string }) {
  const s = useSong();
  const locked = !!s.locks[p.field];
  return (
    <div class={'ingredient' + (locked ? ' locked' : '')} data-field={p.field}>
      <div class="ing-head">
        <span class="ing-label">{FIELD_LABEL[p.field]}</span>
        <button class={'lock' + (locked ? ' on' : '')} aria-pressed={locked} aria-label={(locked ? 'Unlock ' : 'Lock ') + FIELD_LABEL[p.field]}
          onClick={() => update((x) => { x.locks[p.field] = !locked; })}>
          {locked ? <IconLock size={18} /> : <IconUnlock size={18} />}<span>{locked ? 'Locked' : 'Lock'}</span>
        </button>
      </div>
      <div class="ing-body">{p.children}</div>
      {p.hint && <p class="muted small">{p.hint}</p>}
    </div>
  );
}

function SuggestionSheet(p: { proposal: Partial<Recipe>; onClose: () => void }) {
  const entries = Object.entries(p.proposal) as [RecipeField, any][];
  const [keep, setKeep] = useState<Record<string, boolean>>(Object.fromEntries(entries.map(([k]) => [k, true])));
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div class="sheet" role="dialog" aria-label="Suggested ingredients" data-testid="suggestions">
        <div class="sheet-head"><h2>Ideas to try</h2></div>
        <p class="muted small">These are only starting points. Untick anything you don't want, then make the music yourself.</p>
        <ul class="suggest-list">
          {entries.map(([k, v]) => (
            <li key={k}>
              <label class="check">
                <input type="checkbox" checked={keep[k]} onChange={() => setKeep({ ...keep, [k]: !keep[k] })} />
                <span><b>{FIELD_LABEL[k]}</b><br /><span class="muted">{describe(k, v)}</span></span>
              </label>
            </li>
          ))}
        </ul>
        {!entries.length && <p>Everything is locked. Unlock an ingredient to get ideas for it.</p>}
        <div class="row end">
          <button class="btn ghost" onClick={p.onClose}>Cancel</button>
          <button class="btn primary" data-testid="use-suggestions" onClick={async () => {
            const chosen = Object.fromEntries(entries.filter(([k]) => keep[k])) as Partial<Recipe>;
            if ('structure' in chosen && !confirm('Using a new song structure replaces your current arrangement (lyrics are kept). Continue?')) delete chosen.structure;
            applyRecipe(chosen, 'accepted suggestion');
            await refreshInstruments();
            p.onClose();
            toast('Ingredients updated');
          }}>Use selected</button>
        </div>
      </div>
    </div>
  );
}

export function RecipeTab() {
  const s = useSong();
  const r = s.recipe;
  const [wild, setWild] = useState<Wildness>(1);
  const [proposal, setProposal] = useState<Partial<Recipe> | null>(null);
  const mood = MOODS.find((m) => m.id === r.mood);
  const progs = [...PROGRESSIONS].sort((a, b) => Number(b.moods.includes(r.mood)) - Number(a.moods.includes(r.mood)));
  const set = (p: Partial<Recipe>) => applyRecipe(p, 'chose');
  const twist = TWISTS.find((t) => t.id === r.twist);
  const [taps, setTaps] = useState<number[]>([]);
  return (
    <div class="tab-page">
      <div class="hero">
        <h1>Your song recipe</h1>
        <p>Pick a mood and the ingredients. You'll play, write and record everything yourself. Nothing here is made by AI.</p>
      </div>

      <Card title="1. Pick a mood" sub="Moods shape the ideas Surprise me gives you.">
        <div class="mood-grid" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => (
            <button key={m.id} role="radio" aria-checked={r.mood === m.id} class={'mood' + (r.mood === m.id ? ' on' : '')} onClick={() => set({ mood: m.id })}>
              <span class="emoji" aria-hidden="true">{m.emoji}</span>{m.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="2. Get ideas or choose your own" sub="Surprise me only suggests building blocks. Lock anything you want to keep.">
        <Seg label="Wildness" value={wild} onChange={setWild} options={[[0, 'Safe'], [1, 'Spicy'], [2, 'Wild']]} />
        <button class="btn primary big" data-testid="surprise" onClick={() => setProposal(suggest(r, s.locks, wild))}><IconDice /> Surprise me</button>
        <p class="muted small">It avoids ideas it showed you recently, so every song starts somewhere new.</p>
      </Card>

      <Card title="3. Ingredients">
        <div class="ing-grid">
          <Ingredient field="blend" hint="Two styles to mix. Sets the tempo range Surprise me uses.">
            <div class="row">
              <Select label="First genre" value={r.blend[0]} options={GENRES.map((g) => [g, g])} onChange={(v) => set({ blend: [v, r.blend[1]] })} />
              <span class="x">×</span>
              <Select label="Second genre" value={r.blend[1]} options={GENRES.map((g) => [g, g])} onChange={(v) => set({ blend: [r.blend[0], v] })} />
            </div>
          </Ingredient>
          <Ingredient field="key">
            <div class="key-grid">
              {KEYS.map((k) => <button key={k} class={'chip' + (r.key === k ? ' on' : '')} aria-pressed={r.key === k} onClick={() => set({ key: k })}>{k}</button>)}
            </div>
          </Ingredient>
          <Ingredient field="mode" hint={modeById(r.mode).feel}>
            <Select label="Mode" testid="mode" value={r.mode} options={MODES.map((m) => [m.id, `${m.name}: ${m.feel}`])} onChange={(v) => set({ mode: v })} />
          </Ingredient>
          <Ingredient field="bpm">
            <div class="row">
              <Stepper label="tempo" value={r.bpm} min={50} max={190} onChange={(v) => update((x) => { x.recipe.bpm = v; }, ['recipe', 'Adjusted tempo'])} suffix=" BPM" />
              <button class="btn ghost" onClick={() => {
                const now = performance.now();
                const t = [...taps.filter((x) => now - x < 2500), now].slice(-6);
                setTaps(t);
                if (t.length >= 3) { const avg = (t[t.length - 1] - t[0]) / (t.length - 1); const bpm = Math.round(Math.min(190, Math.max(50, 60000 / avg))); update((x) => { x.recipe.bpm = bpm; }, ['recipe', 'Set tempo by tapping']); }
              }}>Tap tempo</button>
            </div>
            <input type="range" class="range" min={50} max={190} value={r.bpm} aria-label="Tempo slider"
              onInput={(e) => update((x) => { x.recipe.bpm = Number((e.target as HTMLInputElement).value); }, ['recipe', 'Adjusted tempo'])} />
          </Ingredient>
          <Ingredient field="groove" hint={GROOVES.find((g) => g.id === r.groove)?.feel + '. Groove only changes the swing feel.'}>
            <Select label="Groove" value={r.groove} options={GROOVES.map((g) => [g.id, g.label])} onChange={(v) => set({ groove: v })} />
          </Ingredient>
          <Ingredient field="progression" hint={`Your chords now: ${s.chords.map((c) => chordName(r.key, r.mode, c)).join(' – ')}. Change any chord in the Play tab.`}>
            <Select label="Chord progression" testid="progression" value={PROGRESSIONS.some((p) => p.id === r.progression) ? r.progression : ''}
              options={[...(PROGRESSIONS.some((p) => p.id === r.progression) ? [] : [['', 'Custom chords'] as [string, string]]), ...progs.map((p) => [p.id, (p.moods.includes(r.mood) ? '★ ' : '') + p.label] as [string, string])]}
              onChange={(v) => v && set({ progression: v })} />
          </Ingredient>
          <Ingredient field="structure" hint="Changing this rebuilds the arrangement in the Song tab. Your lyrics stay.">
            <Select label="Song structure" value={STRUCTURES.some((p) => p.id === r.structure) ? r.structure : ''}
              options={[...(STRUCTURES.some((p) => p.id === r.structure) ? [] : [['', 'Custom arrangement'] as [string, string]]), ...STRUCTURES.map((p) => [p.id, p.label] as [string, string])]}
              onChange={(v) => { if (v && confirm('Replace your current arrangement with this structure? Lyrics are kept.')) set({ structure: v }); }} />
          </Ingredient>
          <Ingredient field="palette" hint="All sounds are synthesized in the app. Fine-tune each instrument in Song → Mixer.">
            <Select label="Sound palette" value={r.palette} options={PALETTES.map((p) => [p.id, p.label])} onChange={async (v) => { set({ palette: v }); await refreshInstruments(); }} />
          </Ingredient>
          <Ingredient field="twist" hint={twist?.how}>
            <Select label="Twist idea" value={r.twist} options={TWISTS.map((t) => [t.id, t.label])} onChange={(v) => set({ twist: v })} />
          </Ingredient>
        </div>
      </Card>
      {mood && <p class="muted small center">Mood: {mood.emoji} {mood.label}</p>}
      <NextStep label="Next: build your beat" onClick={() => setUi({ tab: 'beat' })} />
      {proposal && <SuggestionSheet proposal={proposal} onClose={() => setProposal(null)} />}
    </div>
  );
}
