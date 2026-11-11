import { useEffect, useRef, useState } from 'preact/hooks';
import { update, useSong } from '../store';
import { lyricKeys } from '../model';
import { STRUCTURES } from '../theory';
import { dictReady, findRhymes, sameRhyme, lineSyllables, loadDict, syllables, type RhymeResult } from '../lyrics/dict';
import { Card, NextStep, Seg, Select } from './common';
import { setUi, toast } from './ui';
import { applyRecipe } from '../actions';

const lastWord = (line: string) => (line.match(/[A-Za-z']+(?=[^A-Za-z']*$)/)?.[0] ?? '').toLowerCase();

/** Labels each line A, B, C… by which line endings rhyme (dictionary lookup). */
function schemeLetters(lines: string[]): string[] {
  const keys: string[] = [];
  const out: string[] = [];
  for (const l of lines) {
    const w = lastWord(l);
    if (!w) { out.push(''); continue; }
    let found = -1;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (sameRhyme(k, w)) { found = i; break; }
    }
    if (found < 0) { keys.push(w); found = keys.length - 1; }
    out.push(String.fromCharCode(65 + (found % 26)));
  }
  return out;
}

export function WriteTab() {
  const s = useSong();
  const [ready, setReady] = useState(dictReady());
  const [word, setWord] = useState('');
  const [res, setRes] = useState<RhymeResult | null>(null);
  const [density, setDensity] = useState(12);
  const [rare, setRare] = useState(false);
  const [tpl, setTpl] = useState(s.recipe.structure);
  const active = useRef<{ el: HTMLTextAreaElement; key: string } | null>(null);
  useEffect(() => { loadDict().then(() => setReady(true)).catch(() => toast('Could not load the rhyme dictionary')); }, []);

  const keys = lyricKeys(s.sections);
  const unique = Array.from(new Set(keys));
  const barsFor = (k: string) => s.sections.filter((_, i) => keys[i] === k).reduce((a, x) => Math.max(a, x.bars), 0);
  const search = (w: string, r = rare) => { const c = w.trim().toLowerCase(); setWord(c); if (c) setRes(findRhymes(c, 80, r)); };
  const insert = (w: string) => {
    const a = active.current;
    if (!a) { navigator.clipboard?.writeText(w); toast(`Copied "${w}"`); return; }
    const { el, key } = a;
    const st = el.selectionStart, en = el.selectionEnd;
    const before = el.value.slice(0, st), after = el.value.slice(en);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const next = before + pad + w + after;
    update((x) => { const b = x.lyrics.find((l) => l.key === key); if (b) b.text = next; }, ['lyrics', `Wrote lyrics (${key})`]);
    requestAnimationFrame(() => { el.focus(); const p = (before + pad + w).length; el.setSelectionRange(p, p); });
  };
  const groups = (list: string[]) => {
    const g = new Map<number, string[]>();
    for (const w of list) { const n = syllables(w); if (!g.has(n)) g.set(n, []); g.get(n)!.push(w); }
    return Array.from(g.entries()).sort((a, b) => a[0] - b[0]);
  };

  return (
    <div class="tab-page">
      <div class="hero">
        <h1>Lyrics</h1>
        <p>Write every line yourself. The rhyme finder and syllable counter use a public pronunciation dictionary, not AI.</p>
      </div>
      <Card title="Rhyme finder" class="sticky-card" sub={ready ? 'Type a word, or tap "Rhyme" under a line.' : 'Loading the dictionary…'}>
        <form class="row" onSubmit={(e) => { e.preventDefault(); search(word); }}>
          <input class="input grow" data-testid="rhyme-input" placeholder="Word to rhyme" value={word} disabled={!ready} onInput={(e) => setWord((e.target as HTMLInputElement).value)} />
          <button class="btn primary" type="submit" disabled={!ready}>Find</button>
        </form>
        {res && (
          <div class="rhymes" data-testid="rhymes">
            {!res.known && <p class="muted">"{word}" isn't in the dictionary. Try a similar word.</p>}
            {res.known && !res.perfect.length && !res.near.length && <p class="muted">No rhymes found.</p>}
            {res.perfect.length > 0 && <h3>Rhymes</h3>}
            {groups(res.perfect).map(([n, ws]) => (
              <div class="rhyme-group" key={'p' + n}><span class="syl">{n} syl</span>{ws.slice(0, 30).map((w) => <button key={w} class="chip sm" onClick={() => insert(w)}>{w}</button>)}</div>
            ))}
            {res.near.length > 0 && <h3>Near rhymes (same vowels)</h3>}
            {groups(res.near).slice(0, 4).map(([n, ws]) => (
              <div class="rhyme-group" key={'n' + n}><span class="syl">{n} syl</span>{ws.slice(0, 20).map((w) => <button key={w} class="chip sm ghost" onClick={() => insert(w)}>{w}</button>)}</div>
            ))}
            <label class="check inline tiny"><input type="checkbox" checked={rare} onChange={() => { setRare(!rare); search(word, !rare); }} /> Include rare words and names{!rare && res.hiddenRare ? ` (${res.hiddenRare} hidden)` : ''}</label>
            <p class="muted tiny">Tap a word to add it where your cursor is.</p>
          </div>
        )}
      </Card>
      <Card title="Flow check" sub="About how many syllables fit in one bar.">
        <Seg label="Flow speed" value={density} onChange={setDensity} options={[[8, 'Relaxed (8)'], [12, 'Steady (12)'], [16, 'Fast (16)']]} />
      </Card>
      {unique.map((k) => {
        const block = s.lyrics.find((l) => l.key === k) ?? { key: k, text: '' };
        const lines = block.text.split('\n');
        const letters = ready ? schemeLetters(lines) : [];
        const bars = barsFor(k);
        const filled = lines.filter((l) => l.trim()).length;
        const totalSyl = ready ? lines.reduce((a, l) => a + lineSyllables(l), 0) : 0;
        return (
          <Card key={k} title={k} sub={`${bars} bars · ${filled} line${filled === 1 ? '' : 's'}${ready ? ` · ${totalSyl} syllables` : ''} · 1 line ≈ 1 bar`} class="lyric-card">
            <textarea class="lyrics" data-testid={`lyrics-${k}`} aria-label={`${k} lyrics`} rows={Math.max(4, Math.min(16, lines.length + 1))} value={block.text}
              placeholder={`Write your ${k.toLowerCase()} here, one line per bar…`}
              onFocus={(e) => { active.current = { el: e.currentTarget, key: k }; }}
              onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; update((x) => { let b = x.lyrics.find((l) => l.key === k); if (!b) { b = { key: k, text: '' }; x.lyrics.push(b); } b.text = v; }, ['lyrics', `Wrote lyrics (${k})`]); }} />
            {ready && filled > 0 && (
              <ol class="line-check">
                {lines.map((l, i) => {
                  if (!l.trim()) return <li key={i} class="blank" />;
                  const n = lineSyllables(l);
                  const fit = n <= density * 0.6 ? 'short' : n <= density * 1.15 ? 'fits' : 'long';
                  return (
                    <li key={i}>
                      <span class="scheme">{letters[i]}</span>
                      <span class="lc-text">{l}</span>
                      <span class={'fit ' + fit} title={`${n} syllables`}>{n} · {fit === 'fits' ? '1 bar' : fit === 'short' ? 'room left' : 'crowded'}</span>
                      <button class="chip sm ghost" onClick={() => search(lastWord(l))} disabled={!lastWord(l)}>Rhyme</button>
                    </li>
                  );
                })}
              </ol>
            )}
            {filled > bars && bars > 0 && <p class="muted small">You have more lines than bars. Add bars in Song → Arrange, or split into two sections.</p>}
          </Card>
        );
      })}
      <Card title="Song structure templates" sub="Sections above follow your arrangement. Pick a template to restructure it.">
        <div class="row">
          <Select label="Structure template" value={tpl} options={STRUCTURES.map((x) => [x.id, x.label])} onChange={setTpl} />
          <button class="btn ghost" onClick={() => { if (confirm('Replace your arrangement with this structure? Your lyrics are kept.')) applyRecipe({ structure: tpl }, 'chose'); }}>Use</button>
        </div>
      </Card>
      <NextStep label="Next: record your vocals" onClick={() => setUi({ tab: 'mic' })} />
    </div>
  );
}
