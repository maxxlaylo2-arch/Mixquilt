import { useEffect, useState } from 'preact/hooks';
import { getSong, maybeWarnStorage, replaceSong, requestPersistentStorage, saveNow, storageEstimate, update, useSong } from '../store';
import { lyricKeys, makeSection, TRACKS, uid, type Song, type TrackId } from '../model';
import { SECTION_TYPES, type SectionType } from '../theory';
import { Card, Select, Stepper } from './common';
import { setUi, toast } from './ui';
import { play, refreshMix, stop } from '../audio/engine';
import { MacroSliders, SoundPicker, currentVoiceName } from './SoundPicker';
import { sectionStartBeat } from '../audio/compose';
import { download, encodeWav, exportMidi, exportStemsZip, renderSong, safeName } from '../audio/export';
import { backupFileName, exportProjectZip, importProjectFile } from '../audio/backup';
import { FINISHES, finishOf } from '../audio/master';
import { LegalSheet, type LegalPage } from './LegalSheet';
import { CONTACT_EMAIL } from '../legal';
import { authorshipPdf, fmtTime, lyricSheetPdf, sha256 } from '../pdf';
import { syncLyrics } from '../actions';
import { IconCopy, IconDown, IconDownload, IconPlay, IconTrash, IconUp } from './icons';

const LAYER_SHORT: Record<TrackId, string> = { drums: 'Drums', bass: 'Bass', chords: 'Chords', melody: 'Melody', vocals: 'Vocals' };

function Arrange() {
  const s = useSong();
  const keys = lyricKeys(s.sections);
  const [addType, setAddType] = useState<SectionType>('Verse');
  const ed = (fn: (x: Song) => void, text: string) => update((x) => { fn(x); x.recipe.structure = 'custom'; syncLyrics(x); }, ['arrange', text]);
  const total = s.sections.reduce((a, x) => a + x.bars, 0);
  return (
    <Card title="Arrange" sub={`${s.sections.length} sections · ${total} bars. Turn layers on and off to shape the energy.`} id="arrange">
      <ol class="sections" data-testid="sections">
        {s.sections.map((sec, i) => (
          <li key={sec.id} class={'section-item t-' + sec.type.replace(/\W/g, '').toLowerCase()}>
            <div class="sec-top">
              <span class="sec-name">{keys[i]}</span>
              <div class="row">
                <button class="icon-btn" aria-label={`Play from ${keys[i]}`} onClick={() => play({ kind: 'song' }, { fromBeat: sectionStartBeat(getSong(), i) })}><IconPlay size={18} /></button>
                <button class="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => ed((x) => { const [a] = x.sections.splice(i, 1); x.sections.splice(i - 1, 0, a); }, `Moved ${keys[i]} earlier`)}><IconUp size={18} /></button>
                <button class="icon-btn" aria-label="Move down" disabled={i === s.sections.length - 1} onClick={() => ed((x) => { const [a] = x.sections.splice(i, 1); x.sections.splice(i + 1, 0, a); }, `Moved ${keys[i]} later`)}><IconDown size={18} /></button>
                <button class="icon-btn" aria-label="Duplicate" onClick={() => ed((x) => { x.sections.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(sec)), id: uid() }); }, `Duplicated ${keys[i]}`)}><IconCopy size={18} /></button>
                <button class="icon-btn" aria-label="Delete section" disabled={s.sections.length < 2} onClick={() => ed((x) => { x.sections.splice(i, 1); }, `Removed ${keys[i]}`)}><IconTrash size={18} /></button>
              </div>
            </div>
            <div class="sec-controls">
              <Select label="Section type" value={sec.type} options={SECTION_TYPES.map((t) => [t, t])} onChange={(v) => ed((x) => {
                x.sections[i].type = v as SectionType;
                // Keep an existing custom part; only default when still tied to the old type name.
                if (!x.sections[i].part || x.sections[i].part === sec.type) x.sections[i].part = v;
              }, `Changed section ${i + 1} to ${v}`)} />
              <Stepper label="bars" value={sec.bars} min={1} max={32} onChange={(v) => ed((x) => { x.sections[i].bars = v; }, `Set ${keys[i]} to ${v} bars`)} suffix=" bars" />
              <button class={'chip' + (sec.beat === 'B' ? ' on' : '')} onClick={() => ed((x) => { x.sections[i].beat = sec.beat === 'A' ? 'B' : 'A'; }, `${keys[i]} uses Beat ${sec.beat === 'A' ? 'B' : 'A'}`)}>Beat {sec.beat}</button>
              <Stepper label="key shift" value={sec.transpose} min={-5} max={5} onChange={(v) => ed((x) => { x.sections[i].transpose = v; }, `Set key shift of ${keys[i]} to ${v}`)} prefix="Key " />
            </div>
            <div class="layers">
              {(Object.keys(LAYER_SHORT) as TrackId[]).map((l) => (
                <button key={l} class={'layer l-' + l + (sec.layers[l] ? ' on' : '')} aria-pressed={sec.layers[l]}
                  onClick={() => ed((x) => { x.sections[i].layers[l] = !sec.layers[l]; }, `${sec.layers[l] ? 'Muted' : 'Added'} ${l} in ${keys[i]}`)}>{LAYER_SHORT[l]}</button>
              ))}
            </div>
            {sec.layers.melody && (() => {
              const partOpts = Array.from(new Set([
                ...s.sections.map((x) => x.part),
                ...Object.keys(s.parts),
                ...SECTION_TYPES,
                keys[i],
                `${keys[i]} melody`,
              ].filter(Boolean)));
              return (
                <div class="row wrap">
                  <Select label="Melody part" value={sec.part} options={partOpts.map((p) => [p, `Melody: ${p}`])}
                    onChange={(v) => ed((x) => { x.sections[i].part = v; }, `Set ${keys[i]} melody part to ${v}`)} />
                  <span class="muted tiny">{(s.parts[sec.part]?.length ?? 0) === 0 ? 'Empty — record it in Play' : `${s.parts[sec.part].length} notes`}</span>
                </div>
              );
            })()}
          </li>
        ))}
      </ol>
      <div class="row">
        <Select label="New section type" value={addType} options={SECTION_TYPES.map((t) => [t, t])} onChange={(v) => setAddType(v as SectionType)} />
        <button class="btn primary" onClick={() => ed((x) => { x.sections.push(makeSection(addType, addType === 'Verse' || addType === 'Hook' ? 8 : 4)); }, `Added a ${addType} section`)}>Add section</button>
      </div>
    </Card>
  );
}

function Mixer() {
  const s = useSong();
  const [pick, setPick] = useState<'drums' | 'bass' | 'chords' | 'melody' | null>(null);
  const mix = (fn: (x: Song) => void, text: string) => { update(fn, ['mix', text]); refreshMix(); };
  return (
    <Card title="Mixer" sub="Volume, mute, solo, and a sound library for every track. All sounds are made in the app.">
      <div class="mixer">
        {TRACKS.map((t) => {
          const m = s.mix[t.id];
          const canPick = t.id === 'drums' || t.id === 'bass' || t.id === 'chords' || t.id === 'melody';
          return (
            <div class={'strip l-' + t.id} key={t.id}>
              <div class="strip-head">
                <span class="strip-name">{t.label}</span>
                <button class={'chip sm' + (m.mute ? ' on warn' : '')} aria-pressed={m.mute} onClick={() => mix((x) => { x.mix[t.id].mute = !m.mute; }, `${m.mute ? 'Unmuted' : 'Muted'} ${t.label}`)}>Mute</button>
                <button class={'chip sm' + (m.solo ? ' on' : '')} aria-pressed={m.solo} onClick={() => mix((x) => { x.mix[t.id].solo = !m.solo; }, `${m.solo ? 'Unsoloed' : 'Soloed'} ${t.label}`)}>Solo</button>
              </div>
              <input type="range" class="range" min={0} max={1} step={0.01} value={m.vol} aria-label={`${t.label} volume`}
                onInput={(e) => mix((x) => { x.mix[t.id].vol = Number((e.target as HTMLInputElement).value); }, `Set ${t.label} volume`)} />
              {canPick && (
                <button class="btn sound-open" data-testid={'sound-open-' + t.id} onClick={() => setPick(t.id as 'drums' | 'bass' | 'chords' | 'melody')}>
                  {currentVoiceName(t.id as 'drums' | 'bass' | 'chords' | 'melody', m.inst, s.recipe.palette)}
                </button>
              )}
              <MacroSliders track={t.id} />
            </div>
          );
        })}
        <div class="strip master">
          <div class="strip-head"><span class="strip-name">Master</span></div>
          <input type="range" class="range" min={0} max={1} step={0.01} value={s.mix.master} aria-label="Master volume"
            onInput={(e) => mix((x) => { x.mix.master = Number((e.target as HTMLInputElement).value); }, 'Set master volume')} />
          <div class="finish" role="group" aria-label="Master finish" data-testid="finish">
            <span class="finish-label">Finish</span>
            <div class="finish-chips">
              {FINISHES.map((f) => (
                <button key={f.id} class={'chip sm' + (finishOf(s.mix).id === f.id ? ' on' : '')} aria-pressed={finishOf(s.mix).id === f.id}
                  data-testid={'finish-' + f.id}
                  onClick={() => mix((x) => { x.mix.finish = f.id; }, `Set master finish to ${f.label}`)}>{f.label}</button>
              ))}
            </div>
            <p class="hint" data-testid="finish-hint">{finishOf(s.mix).hint} Stems always export Pre-master.</p>
          </div>
        </div>
      </div>
      {pick && <SoundPicker track={pick} onClose={() => setPick(null)} />}
    </Card>
  );
}

function Exports() {
  const s = useSong();
  const [storageLabel, setStorageLabel] = useState('');
  useEffect(() => {
    void maybeWarnStorage(toast);
    void storageEstimate().then((e) => {
      if (!e) return;
      const pct = Math.round((e.usage / e.quota) * 100);
      setStorageLabel(`On-device storage: ${pct}% used (${Math.round(e.usage / 1e6)} MB of ~${Math.round(e.quota / 1e6)} MB)`);
    });
  }, [s.takes.length]);
  const run = async (label: string, fn: () => Promise<void>) => {
    await stop();
    setUi({ busy: label });
    try { await fn(); update((x) => {}, ['export', label.replace('…', '')]); }
    catch (e) { console.error(e); toast('Export failed: ' + (e as Error).message); }
    setUi({ busy: '' });
  };
  const base = safeName(s.title);
  return (
    <Card title="Export" sub="Everything renders on your device.">
      <div class="export-grid">
        <button class="btn export" data-testid="export-wav" onClick={() => run('Rendering WAV mixdown…', async () => { download(encodeWav(await renderSong(getSong())), `${base}.wav`); })}><IconDownload size={20} /> WAV mixdown</button>
        <button class="btn export" data-testid="export-stems" onClick={() => run('Rendering stems…', async () => { download(await exportStemsZip(getSong(), (m) => setUi({ busy: m })), `${base}-stems.zip`); })}><IconDownload size={20} /> Stems (.zip)</button>
        <button class="btn export" data-testid="export-midi" onClick={() => run('Writing MIDI…', async () => { download(exportMidi(getSong()), `${base}.mid`); })}><IconDownload size={20} /> MIDI</button>
        <button class="btn export" data-testid="export-lyrics" onClick={() => run('Making lyric sheet…', async () => { download(lyricSheetPdf(getSong()), `${base}-lyrics.pdf`); })}><IconDownload size={20} /> Lyric sheet PDF</button>
        <button class="btn export" data-testid="export-log" onClick={() => run('Making authorship log…', async () => { download(await authorshipPdf(getSong()), `${base}-authorship-log.pdf`); })}><IconDownload size={20} /> Authorship log PDF</button>
        <button class="btn export" data-testid="export-full-backup" onClick={() => run('Saving full backup…', async () => {
          await saveNow();
          download(await exportProjectZip(getSong(), (m) => setUi({ busy: m })), backupFileName(getSong().title));
          await requestPersistentStorage();
        })}><IconDownload size={20} /> Full backup (.zip, includes vocals)</button>
        <button class="btn export ghost" data-testid="export-json-backup" onClick={() => run('Saving JSON backup…', async () => {
          await saveNow();
          download(new Blob([JSON.stringify(getSong(), null, 1)], { type: 'application/json' }), `${base}.mixquilt.json`);
        })}><IconDownload size={20} /> JSON only (no audio)</button>
        <label class="btn export ghost">Import backup<input type="file" accept=".json,.zip,application/json,application/zip" data-testid="import-backup" hidden onChange={async (e) => {
          const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
          (e.target as HTMLInputElement).value = '';
          try {
            await stop();
            await saveNow();
            setUi({ busy: 'Importing backup…' });
            const res = await importProjectFile(f);
            await replaceSong(res.song);
            if (res.kind === 'full') toast(`Imported as a new song (${res.audioCount} vocal file${res.audioCount === 1 ? '' : 's'} restored)`);
            else toast('JSON imported as a new song. Vocals were not in that file — use Full backup (.zip) to move takes.');
            await requestPersistentStorage();
          } catch { toast('That file is not a Mixquilt backup.'); }
          setUi({ busy: '' });
        }} /></label>
      </div>
      {storageLabel && <p class="muted tiny" data-testid="storage-usage">{storageLabel}</p>}
      <label class="field"><span>Songwriter name for PDFs (optional)</span>
        <input class="input" value={s.credits.author} placeholder="Your name" onChange={(e) => update((x) => { x.credits.author = (e.target as HTMLInputElement).value.trim(); }, ['credits', 'Set songwriter name'])} />
      </label>
    </Card>
  );
}

function Versions() {
  const s = useSong();
  const [label, setLabel] = useState('');
  return (
    <Card title="Versions" sub="Snapshots of arrangement, beats, melodies, lyrics and mix — not vocal audio. Use Full backup to keep takes.">
      <form class="row" onSubmit={async (e) => {
        e.preventDefault();
        const snap = JSON.stringify({ ...getSong(), versions: [], log: [] });
        const hash = await sha256(snap);
        const l = label.trim() || `Version ${s.versions.length + 1}`;
        update((x) => { x.versions.push({ id: uid(), ts: new Date().toISOString(), label: l, hash, data: snap }); }, ['version', `Saved version "${l}" (SHA-256 ${hash.slice(0, 12)}…)`]);
        setLabel(''); toast('Version saved (vocals stay as they are — not stored in versions)');
      }}>
        <input class="input grow" placeholder="Version name (optional)" value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
        <button class="btn primary" type="submit" data-testid="save-version">Save version</button>
      </form>
      <ul class="versions">
        {[...s.versions].reverse().map((v) => (
          <li key={v.id}>
            <div><b>{v.label}</b><br /><span class="muted tiny">{fmtTime(v.ts)} · {v.hash.slice(0, 16)}…</span></div>
            <button class="btn sm ghost" onClick={() => {
              if (!confirm(`Restore "${v.label}"?\n\nThis restores arrangement, beats, melodies, lyrics and mix.\nYour current vocal takes stay on this song (versions do not store audio).\nCurrent state is saved as a version first.`)) return;
              const cur = JSON.stringify({ ...getSong(), versions: [], log: [] });
              sha256(cur).then((h) => {
                update((x) => {
                  x.versions.push({ id: uid(), ts: new Date().toISOString(), label: 'Before restoring ' + v.label, hash: h, data: cur });
                  const d = JSON.parse(v.data) as Song;
                  const keptTakes = x.takes;
                  Object.assign(x, {
                    ...d,
                    id: x.id,
                    log: x.log,
                    versions: x.versions,
                    // Keep real takes (with audio in IndexedDB). Only adopt active flags when the same take id existed in the snapshot.
                    takes: keptTakes.map((t) => ({ ...t, active: d.takes.find((q) => q.id === t.id)?.active ?? t.active })),
                  });
                }, ['version', `Restored version "${v.label}" (vocals kept)`]);
                toast('Version restored. Vocal takes were kept.');
              });
            }}>Restore</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Log() {
  const s = useSong();
  const [all, setAll] = useState(false);
  const list = [...s.log].reverse();
  return (
    <Card title="Authorship log" sub="A timestamped record of everything you made in this song. Export it as a PDF above.">
      <ul class="log" data-testid="log">
        {(all ? list : list.slice(0, 25)).map((e, i) => (
          <li key={i}><span class="log-time">{fmtTime(e.last ?? e.ts)}</span><span class={'log-kind k-' + e.kind}>{e.kind}</span><span>{e.text}{e.count && e.count > 1 ? ` ×${e.count}` : ''}</span></li>
        ))}
      </ul>
      {list.length > 25 && <button class="btn ghost" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${list.length}`}</button>}
    </Card>
  );
}

function About() {
  const [legal, setLegal] = useState<LegalPage | null>(null);
  return (
    <Card title="About Mixquilt" sub="No AI. You make every part of your song.">
      <p class="small">Mixquilt never generates audio, vocals, lyrics, melodies or beats. Its suggestions are common musical building blocks (keys, tempos, chord progressions, song forms) that generally aren't protected by copyright on their own. Every sound is synthesized in the app.</p>
      <p class="small" data-testid="authorship-disclaimer">The authorship log helps you document your own human authorship. It only records what you did in Mixquilt. It doesn't cover work done outside the app, and it isn't a copyright registration. It is general information, not legal advice, and it doesn't guarantee copyright protection or registration. For legal questions, ask a qualified attorney.</p>
      <p class="small">Privacy: Mixquilt itself collects nothing. Your songs and recordings stay on this device. No accounts, analytics or ads, and Mixquilt itself sets no cookies. The mic is on only while you record. The host, GitHub Pages, may log technical data like IP addresses under <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's privacy statement</a>. Privacy questions: <a data-testid="contact-email" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      <div class="row wrap">
        <button class="btn ghost" data-testid="open-privacy" onClick={() => setLegal('privacy')}>Privacy</button>
        <button class="btn ghost" data-testid="open-terms" onClick={() => setLegal('terms')}>Terms</button>
        <button class="btn ghost" data-testid="open-licenses" onClick={() => setLegal('licenses')}>Licenses</button>
      </div>
      <p class="tiny muted">Rhymes and syllables: CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD-2-Clause license (<a href="licenses/CMUDICT-LICENSE.txt" target="_blank" rel="noopener">full notice</a>). Word commonness: SCOWL word lists, Copyright 2000-2018 Kevin Atkinson (<a href="licenses/SCOWL-COPYRIGHT.txt" target="_blank" rel="noopener">notice</a>). Open-source software notices: <a href="licenses/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener">all licenses</a>.</p>
      <p class="tiny muted" data-testid="app-copyright">Mixquilt app © 2026 Stephen Curran III, New York. All rights reserved. Terms governed by New York law. The songs you make are yours. The app's code may not be copied, modified or redistributed without written permission.</p>
      {legal && <LegalSheet page={legal} onClose={() => setLegal(null)} />}
    </Card>
  );
}

export function SongTab() {
  return (
    <div class="tab-page">
      <div class="hero"><h1>Song</h1><p>Arrange your sections, balance the mix, save versions and export.</p></div>
      <Arrange />
      <Mixer />
      <Exports />
      <Versions />
      <Log />
      <About />
    </div>
  );
}
