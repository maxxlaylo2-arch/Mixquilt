import { useEffect, useRef, useState } from 'preact/hooks';
import { getSong, update, useSong } from '../store';
import type { Note } from '../model';
import { SECTION_TYPES, chordLabel, chordMidis, chordName, degreeToMidi, midiToName, snapToScale, type Chord, type ChordQ } from '../theory';
import { Card, NextStep, Seg, Select } from './common';
import { setUi, toast, useEmitter, useUi } from './ui';
import { allNotesOff, heardBeat, isPlaying, liveNote, noteOff, noteOn, onEngine, play } from '../audio/engine';
import { contextMode } from './App';
import { IconRecord, IconTrash } from './icons';

const KB_ROWS = ['zxcvbnm,./', 'asdfghjkl;', 'qwertyuiop'];

function ChordTrack() {
  const s = useSong();
  const [sel, setSel] = useState<number | null>(null);
  const { key, mode } = s.recipe;
  const edit = (i: number, c: Chord) => {
    update((x) => { x.chords[i] = c; x.recipe.progression = 'custom'; }, ['chords', 'Edited chord track']);
    liveNote(chordMidis(key, mode, c, 48), 0.8, 0.7, 'chords');
  };
  const c = sel !== null ? s.chords[sel] : null;
  return (
    <Card title="Chord track" sub="One chord per bar. Tap a bar to change its chord.">
      <div class="chord-row" data-testid="chord-track">
        {s.chords.map((ch, i) => (
          <button key={i} class={'chord-chip' + (sel === i ? ' on' : '')} onClick={() => { setSel(sel === i ? null : i); liveNote(chordMidis(key, mode, ch, 48), 0.8, 0.7, 'chords'); }}>
            <span class="roman">{chordLabel(mode, ch)}</span><span class="cname">{chordName(key, mode, ch)}</span><span class="bar-n">bar {i + 1}</span>
          </button>
        ))}
        {s.chords.length < 8 && (
          <button class="chord-chip add" aria-label="Add a bar" onClick={() => update((x) => { x.chords.push({ ...x.chords[x.chords.length - 1] ?? { deg: 0 } }); x.recipe.progression = 'custom'; }, ['chords', 'Added a chord bar'])}>+ bar</button>
        )}
      </div>
      {c && sel !== null && (
        <div class="chord-editor">
          <div class="deg-grid">
            {Array.from({ length: 7 }, (_, d) => (
              <button key={d} class={'chip' + (c.deg === d ? ' on' : '')} onClick={() => edit(sel, { ...c, deg: d })}>
                {chordLabel(mode, { deg: d })}<small>{chordName(key, mode, { deg: d })}</small>
              </button>
            ))}
          </div>
          <div class="row wrap">
            <Seg label="Chord color" value={(c.q ?? 'auto') as ChordQ} onChange={(q) => edit(sel, { ...c, q })}
              options={[['auto', 'In key'], ['maj', 'Major'], ['min', 'Minor'], ['sus2', 'Sus2'], ['sus4', 'Sus4']]} />
            <button class={'chip' + (c.seventh ? ' on' : '')} aria-pressed={!!c.seventh} onClick={() => edit(sel, { ...c, seventh: !c.seventh })}>+7th</button>
            {s.chords.length > 1 && <button class="btn ghost" onClick={() => { update((x) => { x.chords.splice(sel, 1); x.recipe.progression = 'custom'; }, ['chords', 'Removed a chord bar']); setSel(null); }}>Remove bar</button>}
          </div>
        </div>
      )}
      <div class="row wrap">
        <span class="muted small">Rhythm</span>
        <Seg label="Chord rhythm" value={s.chordStyle} onChange={(v) => update((x) => { x.chordStyle = v; }, ['chords', `Set chord rhythm to ${v}`])}
          options={[['sustain', 'Hold'], ['halves', 'Halves'], ['stabs', 'Stabs'], ['offbeat', 'Offbeat'], ['arp', 'Arp']]} />
      </div>
    </Card>
  );
}

function NoteRoll(p: { notes: Note[]; bars: number }) {
  useEmitter(onEngine);
  const [pos, setPos] = useState(-1);
  const playing = isPlaying();
  useEffect(() => {
    if (!playing) { setPos(-1); return; }
    let raf = 0; const f = () => { setPos(heardBeat() % (p.bars * 4)); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [playing, p.bars]);
  const lo = Math.min(...p.notes.map((n) => n.m), 60), hi = Math.max(...p.notes.map((n) => n.m), 72);
  const span = Math.max(12, hi - lo + 1), len = p.bars * 4;
  return (
    <div class="roll" aria-label={`${p.notes.length} notes recorded`} data-testid="note-roll">
      {Array.from({ length: p.bars }, (_, i) => <span key={i} class="roll-bar" style={{ left: `${(i * 4 / len) * 100}%` }}>{i + 1}</span>)}
      {p.notes.map((n, i) => (
        <span key={i} class="roll-note" title={midiToName(n.m)}
          style={{ left: `${(n.t / len) * 100}%`, width: `${Math.max(0.6, (n.d / len) * 100)}%`, bottom: `${((n.m - lo) / span) * 100}%`, height: `${100 / span}%` }} />
      ))}
      {pos >= 0 && <span class="roll-head" style={{ left: `${(pos / len) * 100}%` }} />}
      {!p.notes.length && <span class="roll-empty">Your melody shows up here</span>}
    </div>
  );
}

export function PlayTab() {
  const s = useSong();
  const u = useUi();
  useEmitter(onEngine);
  const [oct, setOct] = useState(0);
  const [penta, setPenta] = useState(false);
  const [rec, setRec] = useState(false);
  const [quant, setQuant] = useState<number>(0.25);
  const [midiName, setMidiName] = useState('');
  const held = useRef(new Map<string, { m: number; t: number; abs: number }>());
  const { key, mode } = s.recipe;
  const part = u.part;
  const notes = s.parts[part] ?? [];
  const clip = s.partBars * 4;
  const recRef = useRef(rec); recRef.current = rec;
  const quantRef = useRef(quant); quantRef.current = quant;
  const partRef = useRef(part); partRef.current = part;

  const parts = Array.from(new Set([...s.sections.map((x) => x.part), ...Object.keys(s.parts)]));
  const rows = [2, 1, 0].map((r) => {
    const degs = Array.from({ length: 8 }, (_, i) => i);
    const base = 48 + (r + oct) * 12;
    if (!penta) return degs.map((d) => degreeToMidi(key, mode, d, base));
    const minorish = degreeToMidi(key, mode, 2, 0) - degreeToMidi(key, mode, 0, 0) === 3;
    const pd = minorish ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
    const out: number[] = []; let d = 0;
    while (out.length < 8) { const dd = d % 7; if (pd.includes(dd)) out.push(degreeToMidi(key, mode, d, base)); d++; }
    return out;
  });
  const rootPc = degreeToMidi(key, mode, 0, 0) % 12;

  const down = (id: string, m: number) => {
    if (held.current.has(id)) return;
    noteOn(m);
    const abs = heardBeat();
    held.current.set(id, { m, t: abs % clip, abs });
  };
  const up = (id: string) => {
    const h = held.current.get(id);
    if (!h) return;
    held.current.delete(id);
    noteOff(h.m);
    if (!recRef.current || !isPlaying()) return;
    const q = quantRef.current;
    let t = h.t, d = Math.max(0.1, heardBeat() - h.abs);
    if (q) { t = Math.round(t / q) * q; d = Math.max(q, Math.round(d / q) * q); }
    t = t % clip;
    const n: Note = { t, d: Math.min(d, clip), m: h.m, v: 0.85 };
    const pn = partRef.current;
    update((x) => { (x.parts[pn] ??= []).push(n); }, ['melody', `Played melody notes (${pn})`]);
  };

  // computer keyboard
  useEffect(() => {
    const map = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return null;
      const k = e.key.toLowerCase();
      for (let r = 0; r < 3; r++) { const i = KB_ROWS[r].indexOf(k); if (i >= 0 && i < 8) return { id: 'kb' + k, m: rows[2 - r][i] }; }
      return null;
    };
    const kd = (e: KeyboardEvent) => { if (e.repeat) return; const x = map(e); if (x) { e.preventDefault(); down(x.id, x.m); } };
    const ku = (e: KeyboardEvent) => { const x = map(e); if (x) up(x.id); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); allNotesOff(); };
  }, [key, mode, oct, penta, clip]);

  const connectMidi = async () => {
    if (!(navigator as any).requestMIDIAccess) { toast('This browser has no MIDI support. Try Chrome or Edge.'); return; }
    try {
      const acc = await (navigator as any).requestMIDIAccess();
      const inputs: any[] = Array.from(acc.inputs.values());
      if (!inputs.length) { toast('No MIDI keyboard found. Plug one in and try again.'); return; }
      for (const inp of inputs) {
        inp.onmidimessage = (ev: any) => {
          const [st, n, vel] = ev.data; const cmd = st & 0xf0;
          const cur = getSong().recipe;
          const m = snapToScale(cur.key, cur.mode, n);
          if (cmd === 0x90 && vel > 0) down('midi' + n, m);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) up('midi' + n);
        };
      }
      setMidiName(inputs.map((i) => i.name).join(', '));
      toast('MIDI keyboard connected. Notes snap to your scale.');
    } catch { toast('MIDI access was blocked.'); }
  };

  const toggleRec = async () => {
    const on = !rec; setRec(on);
    if (on && !isPlaying()) await play(contextMode('play'), { countInBeats: 4 });
  };

  return (
    <div class="tab-page">
      <div class="hero">
        <h1>Play</h1>
        <p>Pick your chords, then play a melody on pads that only have notes in your key, so nothing sounds wrong.</p>
      </div>
      <ChordTrack />
      <Card title="Melody pad" sub={`${key} ${mode}${penta ? ' pentatonic' : ''}. Highlighted pads are the key note.`}
        right={<button class={'btn rec' + (rec ? ' on' : '')} aria-pressed={rec} data-testid="rec-melody" onClick={toggleRec}><IconRecord size={18} />{rec ? 'Recording' : 'Record'}</button>}>
        <div class="row wrap">
          <Select label="Melody part" value={part} options={[...parts.map((p) => [p, `Part: ${p}`] as [string, string]), ...SECTION_TYPES.filter((t) => !parts.includes(t)).map((t) => [t, `New part: ${t}`] as [string, string])]} onChange={(v) => setUi({ part: v })} />
          <Seg label="Octave" value={oct} onChange={setOct} options={[[-1, 'Low'], [0, 'Mid'], [1, 'High']]} />
          <Seg label="Scale" value={penta ? 1 : 0} onChange={(v) => setPenta(v === 1)} options={[[0, 'Full scale'], [1, 'Pentatonic']]} />
        </div>
        <div class="pad" data-testid="pad" onContextMenu={(e) => e.preventDefault()}>
          {rows.map((row, r) => (
            <div class="pad-row" key={r}>
              {row.map((m, i) => {
                const id = `pad${r}-${i}`;
                return (
                  <button key={id} class={'pad-key' + (m % 12 === rootPc ? ' root' : '')} aria-label={`Play ${midiToName(m)}`}
                    onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); down(id, m); }}
                    onPointerUp={() => up(id)} onPointerCancel={() => up(id)} onLostPointerCapture={() => up(id)}>
                    {!penta && <span class="deg">{(i % 7) + 1}</span>}<span class="nn">{midiToName(m)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <NoteRoll notes={notes} bars={s.partBars} />
        <div class="row wrap between">
          <div class="row wrap">
            <Seg label="Snap notes" value={quant} onChange={setQuant} options={[[0, 'Free'], [0.25, 'Snap 1/16'], [0.5, 'Snap 1/8']]} />
            <Seg label="Part length" value={s.partBars} onChange={(v) => update((x) => { x.partBars = v; }, ['melody', `Set melody part length to ${v} bars`])} options={[[2, '2 bars'], [4, '4 bars'], [8, '8 bars']]} />
          </div>
          <div class="row">
            <button class="btn ghost" disabled={!notes.length} onClick={() => update((x) => { x.parts[part]?.pop(); }, ['melody', `Undid a melody note (${part})`])}>Undo note</button>
            <button class="btn ghost" disabled={!notes.length} aria-label="Clear melody part" onClick={() => { if (confirm(`Clear the ${part} melody?`)) update((x) => { x.parts[part] = []; }, ['melody', `Cleared melody part (${part})`]); }}><IconTrash size={18} /></button>
          </div>
        </div>
        <p class="muted small">Tip: press Record, wait for the 4 count-in clicks, then play along. Keyboard: Z–/, A–; and Q–P rows play the pads. {midiName ? `MIDI: ${midiName}` : ''}</p>
        <button class="btn ghost" onClick={connectMidi}>{midiName ? 'Reconnect MIDI keyboard' : 'Connect a MIDI keyboard'}</button>
      </Card>
      <NextStep label="Next: write your lyrics" onClick={() => setUi({ tab: 'write' })} />
    </div>
  );
}
