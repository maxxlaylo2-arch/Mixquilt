import { useMemo, useRef, useState } from 'preact/hooks';
import { getSong, update, useSong } from '../store';
import type { TrackId } from '../model';
import { voiceById, voicesFor, VOICE_CATEGORIES, type VoiceCategory, type VoiceRole } from '../audio/library';
import { refreshInstruments, refreshMix, stop, liveDrum, liveNote } from '../audio/engine';
import { paletteById } from '../theory';

const ROLE: Record<'drums' | 'bass' | 'chords' | 'melody', VoiceRole> = {
  drums: 'kit', bass: 'bass', chords: 'chords', melody: 'lead',
};

const TRACK_LABEL: Record<string, string> = { drums: 'Drums', bass: 'Bass', chords: 'Chords', melody: 'Melody' };

async function preview(role: VoiceRole, id: string) {
  const s = getSong();
  // Temporarily set the instrument so the rig rebuilds the chosen voice, play a hit, then leave it
  // (the picker commits only on Select). For preview we apply, play, and the parent will refresh if cancelled.
  const track = role === 'kit' ? 'drums' : role === 'lead' ? 'melody' : role;
  const prev = s.mix[track].inst;
  update((x) => { x.mix[track].inst = id; });
  await stop();
  await refreshInstruments();
  if (role === 'kit') await liveDrum('kick');
  else if (role === 'bass') await liveDrum('bass');
  else {
    const root = 60;
    await liveNote(role === 'chords' ? [root, root + 4, root + 7] : [root + 12], 0.5, 0.85, role === 'chords' ? 'chords' : 'lead');
  }
  return prev;
}

export function currentVoiceName(track: 'drums' | 'bass' | 'chords' | 'melody', inst: string | undefined, paletteId: string) {
  const role = ROLE[track];
  const p = paletteById(paletteId);
  const id = inst || (track === 'drums' ? p.kit : track === 'bass' ? p.bass : track === 'chords' ? p.chords : p.lead);
  const v = voiceById(id, role) || voiceById(id);
  if (v) return inst ? v.name : `Palette: ${v.name}`;
  return inst || 'Palette default';
}

export function SoundPicker(p: { track: 'drums' | 'bass' | 'chords' | 'melody'; onClose: () => void }) {
  const s = useSong();
  const role = ROLE[p.track];
  const cats = VOICE_CATEGORIES.filter((c) => c.roles.includes(role) || (role === 'lead' && c.id === 'plucks') || (role === 'chords' && (c.id === 'plucks' || c.id === 'textures')));
  const all = useMemo(() => {
    const list = voicesFor(role).slice();
    if (role === 'lead' && !list.some((v) => v.id === 'piano')) {
      const piano = voiceById('piano', 'chords');
      if (piano) list.push({ ...piano, id: 'piano', role: 'lead', name: 'Piano' });
    }
    return list;
  }, [role]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<VoiceCategory | 'all'>('all');
  const pal = paletteById(s.recipe.palette);
  const original = useRef(s.mix[p.track].inst);
  const current = s.mix[p.track].inst || (p.track === 'drums' ? pal.kit : p.track === 'bass' ? pal.bass : p.track === 'chords' ? pal.chords : pal.lead);
  const close = async () => {
    if (s.mix[p.track].inst !== original.current) {
      update((x) => { x.mix[p.track].inst = original.current; });
      await stop();
      await refreshInstruments();
    }
    p.onClose();
  };

  const shown = all.filter((v) => {
    if (cat !== 'all' && v.category !== cat) return false;
    if (!q.trim()) return true;
    const hay = `${v.name} ${v.character} ${v.genres.join(' ')} ${v.id}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const choose = async (id: string | '') => {
    update((x) => { x.mix[p.track].inst = id || undefined; }, ['mix', `Changed ${TRACK_LABEL[p.track]} sound`]);
    original.current = id || undefined;
    await stop();
    await refreshInstruments();
    p.onClose();
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="sheet sound-sheet" role="dialog" aria-label={`${TRACK_LABEL[p.track]} sound library`} data-testid="sound-picker">
        <div class="sheet-head">
          <h2>{TRACK_LABEL[p.track]} sounds</h2>
          <button class="btn ghost" onClick={close}>Close</button>
        </div>
        <p class="muted small">All sounds are synthesized in the app. Tap a name to preview, then select it.</p>
        <input class="input" type="search" placeholder="Search sounds" aria-label="Search sounds" value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <div class="sound-cats" role="tablist" aria-label="Sound categories">
          <button class={'chip sm' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>All</button>
          {cats.map((c) => (
            <button key={c.id} class={'chip sm' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.label}</button>
          ))}
        </div>
        <button class={'sound-item' + (!s.mix[p.track].inst ? ' on' : '')} onClick={() => choose('')}>
          <b>Palette default</b>
          <span class="muted small">{currentVoiceName(p.track, undefined, s.recipe.palette)}</span>
        </button>
        <ul class="sound-list">
          {VOICE_CATEGORIES.filter((c) => shown.some((v) => v.category === c.id)).map((c) => (
            <li key={c.id}>
              <h3>{c.label}</h3>
              {shown.filter((v) => v.category === c.id).map((v) => (
                <div key={v.id} class={'sound-item' + (current === v.id && s.mix[p.track].inst ? ' on' : '')}>
                  <button class="sound-pick" data-voice={v.id} onClick={async () => { await preview(role, v.id); }}>
                    <b>{v.name}</b>
                    <span class="muted small">{v.character}</span>
                    <span class="tiny muted">{v.genres.slice(0, 3).join(' · ')}{v.classic ? ' · Classic' : ''}</span>
                  </button>
                  <button class="btn sm primary" data-testid={'use-voice-' + v.id} onClick={() => choose(v.id)}>Use</button>
                </div>
              ))}
            </li>
          ))}
        </ul>
        {!shown.length && <p class="muted">No sounds match that search.</p>}
      </div>
    </div>
  );
}

export function MacroSliders(p: { track: TrackId }) {
  const s = useSong();
  const m = s.mix[p.track];
  const set = (key: 'tone' | 'drive' | 'character', v: number, label: string) => {
    update((x) => { x.mix[p.track][key] = v; }, ['mix', `Set ${p.track} ${label}`]);
    refreshMix();
  };
  return (
    <div class="macros" data-testid={'macros-' + p.track}>
      <label>Tone <b>{Math.round((m.tone ?? 0.5) * 100)}</b>
        <input type="range" class="range" min={0} max={1} step={0.01} value={m.tone ?? 0.5} aria-label={`${p.track} tone`}
          onInput={(e) => set('tone', Number((e.target as HTMLInputElement).value), 'tone')} />
      </label>
      <label>Drive <b>{Math.round((m.drive ?? 0.2) * 100)}</b>
        <input type="range" class="range" min={0} max={1} step={0.01} value={m.drive ?? 0.2} aria-label={`${p.track} drive`}
          onInput={(e) => set('drive', Number((e.target as HTMLInputElement).value), 'drive')} />
      </label>
      <label>Character <b>{Math.round((m.character ?? 0.5) * 100)}</b>
        <input type="range" class="range" min={0} max={1} step={0.01} value={m.character ?? 0.5} aria-label={`${p.track} character`}
          onInput={(e) => set('character', Number((e.target as HTMLInputElement).value), 'character')} />
      </label>
    </div>
  );
}
