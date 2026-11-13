import { useEffect, useRef, useState } from 'preact/hooks';
import { getSong, update, useSong } from '../store';
import { lyricKeys, uid, type Take } from '../model';
import { Card, NextStep, Select } from './common';
import { setUi, toast, useEmitter } from './ui';
import { heardBeat, isPlaying, onEngine, play, settings, stop } from '../audio/engine';
import { sectionAtBeat, sectionStartBeat } from '../audio/compose';
import { trimTakeToSection } from '../audio/takeTiming';
import { calibrate, releaseMic, estimatedLatencySec, getExtraLatencyMs, setExtraLatencyMs, startRecording, totalLatencySec, type Recording } from '../audio/mic';
import { deleteTakeAudio, previewTake, saveTakeAudio, stopPreview } from '../audio/takes';
import { PRESETS, type VoicePolishSettings } from '../audio/voicePolish';
import { VoicePolishSheet } from './VoicePolishSheet';
import { db } from '../db';
import { IconPlay, IconRecord, IconStop, IconTrash } from './icons';

function Teleprompter() {
  const s = useSong();
  useEmitter(onEngine);
  const [beat, setBeat] = useState(0);
  const playing = isPlaying();
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const f = () => { setBeat(heardBeat()); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const keys = lyricKeys(s.sections);
  const at = sectionAtBeat(s, beat);
  const idx = at?.index ?? 0;
  const cur = keys[idx], next = keys[idx + 1];
  const text = (k?: string) => (k ? s.lyrics.find((l) => l.key === k)?.text.trim() : '') || '';
  const lines = text(cur).split('\n').filter(Boolean);
  const bar = at ? Math.floor((beat - at.start) / 4) : 0;
  return (
    <div class="prompter" aria-live="polite" data-testid="prompter">
      <div class="prompter-label">{playing ? `${cur} · bar ${bar + 1}` : 'Lyrics appear here while you record'}</div>
      {lines.length ? lines.map((l, i) => <p key={i} class={playing && i === Math.min(bar, lines.length - 1) ? 'now' : ''}>{l}</p>) : <p class="muted">{cur ? `No lyrics for ${cur} yet.` : ''}</p>}
      {next && <div class="prompter-next">Next: {next}{text(next) ? ` · “${text(next).split('\n')[0]}”` : ''}</div>}
    </div>
  );
}

export function MicTab() {
  const s = useSong();
  useEmitter(onEngine);
  const keys = lyricKeys(s.sections);
  const [from, setFrom] = useState(0);
  const [countIn, setCountIn] = useState(true);
  const [metro, setMetro] = useState(settings.metronome);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [extra, setExtra] = useState(getExtraLatencyMs());
  const [calibrating, setCalibrating] = useState(false);
  const [polishFor, setPolishFor] = useState<Take | null>(null);
  const recRef = useRef<{ rec: Recording; ctxStart: number; songSec: number; section: string } | null>(null);

  useEffect(() => {
    if (!recording) return;
    let raf = 0; const f = () => { setLevel(recRef.current?.rec.level() ?? 0); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [recording]);
  useEffect(() => () => { if (recRef.current) finish(); stopPreview(); }, []);
  // stop the take when the song reaches its end
  useEffect(() => { if (recording && !isPlaying()) finish(); });

  async function begin() {
    try {
      const rec = await startRecording();
      const sec = keys[from] ?? 'Song';
      await play({ kind: 'song' }, {
        fromBeat: sectionStartBeat(getSong(), from), countInBeats: countIn ? 4 : 0,
        onStarted: (ctxStart, songSec) => { recRef.current = { rec, ctxStart, songSec, section: sec }; },
      });
      setRecording(true);
    } catch (e) {
      console.error(e);
      releaseMic();
      toast('Microphone not available. Allow mic access in your browser settings.');
    }
  }
  async function finish() {
    const r = recRef.current; recRef.current = null;
    setRecording(false);
    if (isPlaying()) await stop();
    if (!r) { releaseMic(); return; }
    const { data, firstTime, sampleRate } = await r.rec.stop();
    let start = r.songSec + (firstTime - r.ctxStart) - totalLatencySec();
    const trimmed = trimTakeToSection(start, r.songSec, sampleRate);
    const pcm = data.subarray(Math.min(trimmed.trimSamples, data.length));
    start = trimmed.start;
    if (pcm.length < sampleRate * 0.3) { toast('Take was too short, so it was not saved.'); return; }
    const id = uid();
    await saveTakeAudio(id, pcm.slice());
    const n = getSong().takes.length + 1;
    const take: Take = { id, name: `Take ${n} (${r.section})`, createdAt: new Date().toISOString(), start, duration: pcm.length / sampleRate, sampleRate, active: true, section: r.section, polish: null };
    let muted = 0;
    update((x) => {
      for (const t of x.takes) if (t.active && t.start < take.start + take.duration && take.start < t.start + t.duration) { t.active = false; muted++; }
      x.takes.push(take);
    }, ['vocal', `Recorded vocal take "${take.name}" (${take.duration.toFixed(1)} s)`]);
    toast(muted ? 'Take saved. Older takes in the same spot were turned off.' : 'Take saved.');
  }

  return (
    <div class="tab-page">
      <div class="hero">
        <h1>Mic booth</h1>
        <p>Record your own voice over the beat. Use headphones so the beat doesn't leak into your vocal.</p>
      </div>
      <Teleprompter />
      <Card>
        <div class="row wrap">
          <Select label="Start from" value={String(from)} options={s.sections.map((_, i) => [String(i), `Start at ${keys[i]}`])} onChange={(v) => setFrom(Number(v))} />
          <label class="check inline"><input type="checkbox" checked={countIn} onChange={() => setCountIn(!countIn)} /> Count-in</label>
          <label class="check inline"><input type="checkbox" checked={metro} onChange={() => { settings.metronome = !metro; setMetro(!metro); }} /> Click</label>
        </div>
        <button class={'rec-big' + (recording ? ' on' : '')} data-testid="rec-vocal" aria-pressed={recording} onClick={() => (recording ? finish() : begin())}>
          {recording ? <IconStop size={30} /> : <IconRecord size={30} />}<span>{recording ? 'Stop & save take' : 'Record vocals'}</span>
        </button>
        {recording && <div class="meter" aria-label="Mic level"><span style={{ width: `${Math.min(100, level * 140)}%` }} class={level > 0.9 ? 'clip' : ''} /></div>}
      </Card>
      <Card title="Takes" sub="Turn takes on or off to choose what plays in the song.">
        {!s.takes.length && <p class="muted">No takes yet.</p>}
        <ul class="takes">
          {s.takes.map((t) => (
            <li key={t.id} class={t.active ? 'on' : ''}>
              <label class="check"><input type="checkbox" checked={t.active} onChange={() => update((x) => { const y = x.takes.find((q) => q.id === t.id)!; y.active = !y.active; }, ['vocal', `${t.active ? 'Muted' : 'Used'} take "${t.name}"`])} /></label>
              <div class="take-info">
                <input class="take-name" aria-label="Take name" value={t.name} onChange={(e) => { const v = (e.target as HTMLInputElement).value; update((x) => { x.takes.find((q) => q.id === t.id)!.name = v; }, ['vocal', 'Renamed a take']); }} />
                <span class="muted small">{t.duration.toFixed(1)} s · starts {t.start.toFixed(2)} s · {new Date(t.createdAt).toLocaleTimeString()}</span>
              </div>
              <button class="icon-btn" aria-label="Listen to take" onClick={() => previewTake(t, s)}><IconPlay size={20} /></button>
              <button class={'btn sm polish-btn' + (t.polish ? ' on' : '')} data-testid="polish-open" onClick={() => setPolishFor(t)}>
                ✨ Voice Polish{t.polish && <small>{(t.polish.settings as any).bypass ? ' (A)' : ' · ' + ((t.polish.settings as unknown as VoicePolishSettings).preset === 'custom' ? 'Custom' : PRESETS[(t.polish.settings as unknown as VoicePolishSettings).preset as 'natural'].label)}</small>}
              </button>
              <button class="icon-btn" aria-label="Delete take" onClick={async () => { if (confirm(`Delete ${t.name}?`)) { await deleteTakeAudio(t.id); if (t.polish?.processedAudioKey) await db.del('audio', t.polish.processedAudioKey).catch(() => {}); update((x) => { x.takes = x.takes.filter((q) => q.id !== t.id); }, ['vocal', `Deleted take "${t.name}"`]); } }}><IconTrash size={20} /></button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Timing fix (latency)" sub="Phones and Bluetooth add delay. This lines your voice up with the beat.">
        <p class="small">Browser estimate: {Math.round(estimatedLatencySec() * 1000)} ms. Extra adjustment: <b>{extra} ms</b></p>
        <input type="range" class="range" min={-150} max={400} step={5} value={extra} aria-label="Extra latency adjustment"
          onInput={(e) => { const v = Number((e.target as HTMLInputElement).value); setExtra(v); setExtraLatencyMs(v); }} />
        <button class="btn ghost" disabled={calibrating || recording} onClick={async () => {
          setCalibrating(true);
          try { const ms = await calibrate(); if (ms === null) toast('Could not hear the clicks. Use speakers (not headphones) and turn the volume up.'); else { setExtra(getExtraLatencyMs()); toast(`Measured ${Math.round(ms)} ms round trip`); } }
          catch { toast('Microphone not available.'); }
          setCalibrating(false);
        }}>{calibrating ? 'Listening…' : 'Auto-measure (uses speakers)'}</button>
        <p class="muted tiny">If your vocal sounds late, move the slider right. Applies to new takes on this device.</p>
      </Card>
      <NextStep label="Next: arrange, mix and export" onClick={() => setUi({ tab: 'song' })} />
      {polishFor && <VoicePolishSheet take={polishFor} onClose={() => setPolishFor(null)} />}
    </div>
  );
}
