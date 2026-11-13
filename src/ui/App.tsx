import { useEffect, useState } from 'preact/hooks';
import { createSong, deleteSong, getSong, getSongs, openSong, update, useSong } from '../store';
import { setUi, toast, ui, useEmitter, useUi, type Tab } from './ui';
import { IconBeat, IconMenu, IconMetro, IconMic, IconPlay, IconPlayPad, IconPlus, IconRecipe, IconSong, IconStop, IconTrash, IconWrite } from './icons';
import { heardBeat, isPlaying, onEngine, play, settings, stop } from '../audio/engine';
import { sectionAtBeat, songBeats, type PlayMode } from '../audio/compose';
import { RecipeTab } from './RecipeTab';
import { BeatTab } from './BeatTab';
import { PlayTab } from './PlayTab';
import { WriteTab } from './WriteTab';
import { MicTab } from './MicTab';
import { SongTab } from './SongTab';
import { lyricKeys } from '../model';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'recipe', label: 'Recipe', Icon: IconRecipe },
  { id: 'beat', label: 'Beat', Icon: IconBeat },
  { id: 'play', label: 'Play', Icon: IconPlayPad },
  { id: 'write', label: 'Lyrics', Icon: IconWrite },
  { id: 'mic', label: 'Mic', Icon: IconMic },
  { id: 'song', label: 'Song', Icon: IconSong },
];

export function contextMode(tab: Tab): PlayMode {
  const s = getSong();
  const u = ui;
  if (tab === 'beat') return { kind: 'loop', beat: u.beat, part: u.part, bars: Math.max(1, s.chords.length), layers: { melody: false } };
  if (tab === 'play') return { kind: 'loop', beat: u.beat, part: u.part, bars: s.partBars };
  return { kind: 'song' };
}

export function Transport() {
  const s = useSong();
  const u = useUi();
  useEmitter(onEngine);
  const [pos, setPos] = useState(0);
  const playing = isPlaying();
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => { setPos(heardBeat()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const m = contextMode(u.tab);
  const label = m.kind === 'song' ? 'Whole song' : u.tab === 'beat' ? `Loop: Beat ${u.beat}` : `Loop: ${u.part} melody · Beat ${u.beat}`;
  const at = m.kind === 'song' ? sectionAtBeat(s, pos) : null;
  const keys = lyricKeys(s.sections);
  const where = playing ? (m.kind === 'song' ? (at ? `${keys[at.index]} · bar ${Math.floor((pos - at.start) / 4) + 1}` : 'End') : `Bar ${Math.floor((pos % (m.bars * 4)) / 4) + 1} of ${m.bars}`) : label;
  const total = songBeats(s) * 60 / s.recipe.bpm;
  const [metro, setMetro] = useState(settings.metronome);
  return (
    <div class="transport" role="region" aria-label="Transport">
      <button class={'play-btn' + (playing ? ' on' : '')} data-testid="play" aria-label={playing ? 'Stop' : 'Play'}
        onClick={async () => { if (playing) await stop(); else await play(contextMode(u.tab)); }}>
        {playing ? <IconStop size={28} /> : <IconPlay size={28} />}
      </button>
      <div class="t-info">
        <div class="t-where">{where}</div>
        <div class="t-sub">{s.recipe.key} {s.recipe.mode} · {s.recipe.bpm} BPM{m.kind === 'song' ? ` · ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}` : ''}</div>
      </div>
      <button class={'icon-btn' + (metro ? ' active' : '')} aria-pressed={metro} aria-label="Metronome" title="Metronome"
        onClick={() => { settings.metronome = !settings.metronome; setMetro(settings.metronome); }}><IconMetro /></button>
    </div>
  );
}

function SongsSheet() {
  const s = useSong();
  const list = getSongs();
  const [name, setName] = useState('');
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setUi({ songsOpen: false }); }}>
      <div class="sheet" role="dialog" aria-label="My songs">
        <div class="sheet-head"><h2>My songs</h2><button class="btn ghost" onClick={() => setUi({ songsOpen: false })}>Done</button></div>
        <form class="row" onSubmit={async (e) => { e.preventDefault(); await stop(); await createSong(name.trim() || undefined); setName(''); setUi({ songsOpen: false, tab: 'recipe' }); toast('New song started'); }}>
          <input class="input grow" placeholder="New song name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button class="btn primary" type="submit"><IconPlus size={20} /> New</button>
        </form>
        <ul class="song-list">
          {list.map((x) => (
            <li key={x.id} class={x.id === s.id ? 'current' : ''}>
              <button class="song-open" onClick={async () => { await stop(); await openSong(x.id); setUi({ songsOpen: false }); }}>
                <span class="song-title">{x.title}</span>
                <span class="muted small">Edited {new Date(x.updatedAt).toLocaleString()}</span>
              </button>
              <button class="icon-btn" aria-label={`Delete ${x.title}`} onClick={async () => {
                if (confirm(`Delete "${x.title}" from this device? This can't be undone.`)) { await stop(); await deleteSong(x.id); }
              }}><IconTrash size={20} /></button>
            </li>
          ))}
        </ul>
        <p class="muted small">Songs are saved on this device only. Export a backup from Song → Export.</p>
      </div>
    </div>
  );
}

export function App() {
  const s = useSong();
  const u = useUi();
  return (
    <div class="app">
      <header class="topbar">
        <div class="brand" aria-label="Mixquilt"><span class="logo" aria-hidden="true"><i /><i /><i /><i /></span><span class="brand-name">Mixquilt</span></div>
        <input class="title-input" aria-label="Song title" value={s.title}
          onInput={(e) => { const v = (e.target as HTMLInputElement).value; update((x) => { x.title = v; }); }}
          onChange={(e) => { const v = (e.target as HTMLInputElement).value.trim() || 'Untitled song'; update((x) => { x.title = v; }, ['title', `Renamed song to "${v}"`]); }}
          onBlur={(e) => { const v = (e.target as HTMLInputElement).value.trim() || 'Untitled song'; if (v !== s.title) update((x) => { x.title = v; }, ['title', `Renamed song to "${v}"`]); }} />
        <button class="icon-btn" aria-label="My songs" data-testid="songs" onClick={() => setUi({ songsOpen: true })}><IconMenu /></button>
      </header>
      <main class="content" id="main">
        {u.tab === 'recipe' && <RecipeTab />}
        {u.tab === 'beat' && <BeatTab />}
        {u.tab === 'play' && <PlayTab />}
        {u.tab === 'write' && <WriteTab />}
        {u.tab === 'mic' && <MicTab />}
        {u.tab === 'song' && <SongTab />}
      </main>
      <Transport />
      <nav class="tabbar" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} class={'tab' + (u.tab === id ? ' active' : '')} aria-current={u.tab === id ? 'page' : undefined} data-tab={id}
            onClick={async () => { if (isPlaying() && u.tab !== id) await stop(); setUi({ tab: id }); document.getElementById('main')?.scrollTo(0, 0); window.scrollTo(0, 0); }}>
            <Icon size={22} /><span>{label}</span>
          </button>
        ))}
      </nav>
      {u.songsOpen && <SongsSheet />}
      {u.toast && <div class="toast" role="status">{u.toast}</div>}
      {u.busy && <div class="busy" role="status"><div class="spinner" />{u.busy}</div>}
    </div>
  );
}
