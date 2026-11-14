import { nativeContext } from './engine';

let stream: MediaStream | null = null;
let moduleLoaded = false;
let lastInputLatency = 0;
const LAT_KEY = 'mq.latencyExtraMs';

export const getExtraLatencyMs = () => Number(localStorage.getItem(LAT_KEY) ?? '0') || 0;
export const setExtraLatencyMs = (ms: number) => localStorage.setItem(LAT_KEY, String(Math.round(ms)));

export async function getMic(): Promise<MediaStream> {
  if (stream && stream.active) return stream;
  // Prefer raw capture. Some Safari builds ignore or reject advanced constraints — fall back.
  const prefer: MediaTrackConstraints = {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1,
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: prefer });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  return stream;
}
/** Turns the microphone fully off (the browser's recording indicator goes away). */
export function releaseMic() {
  const inLat = (stream?.getAudioTracks()[0]?.getSettings() as any)?.latency;
  if (typeof inLat === 'number') lastInputLatency = inLat;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
}

/** Estimated round trip: what the singer hears is late by output latency, what we capture is late by input latency. */
export function estimatedLatencySec(): number {
  const ctx = nativeContext();
  const out = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  const inLat = (stream?.getAudioTracks()[0]?.getSettings() as any)?.latency ?? lastInputLatency ?? 0;
  return out + inLat;
}
export const totalLatencySec = () => estimatedLatencySec() + getExtraLatencyMs() / 1000;

export interface Recording { stop: () => Promise<{ data: Float32Array; firstTime: number; sampleRate: number }>; level: () => number }

export async function startRecording(): Promise<Recording> {
  const ctx = nativeContext();
  if (ctx.state === 'suspended') await ctx.resume();
  // iOS Safari often needs a second resume after getUserMedia.
  const ms = await getMic();
  if (ctx.state === 'suspended') await ctx.resume();
  if (!moduleLoaded) {
    const url = new URL('recorder-worklet.js', document.baseURI).href;
    await ctx.audioWorklet.addModule(url);
    moduleLoaded = true;
  }
  const src = ctx.createMediaStreamSource(ms);
  const node = new AudioWorkletNode(ctx, 'mq-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const sink = ctx.createGain(); sink.gain.value = 0;
  src.connect(node); src.connect(analyser); node.connect(sink); sink.connect(ctx.destination);
  const chunks: Float32Array[] = [];
  let firstFrame = -1;
  let done: () => void = () => {};
  node.port.onmessage = (e) => {
    if (e.data.type === 'first') firstFrame = e.data.frame;
    if (e.data.type === 'chunk') chunks.push(e.data.data);
    if (e.data.type === 'done') done();
  };
  node.port.postMessage('start');
  const tmp = new Float32Array(1024);
  return {
    level: () => { analyser.getFloatTimeDomainData(tmp); let m = 0; for (const v of tmp) m = Math.max(m, Math.abs(v)); return m; },
    stop: () => new Promise((resolve) => {
      done = () => {
        src.disconnect(); node.disconnect(); analyser.disconnect(); sink.disconnect();
        releaseMic(); // the mic is only on while recording
        const len = chunks.reduce((a, c) => a + c.length, 0);
        const data = new Float32Array(len);
        let o = 0; for (const c of chunks) { data.set(c, o); o += c.length; }
        resolve({ data, firstTime: Math.max(0, firstFrame) / ctx.sampleRate, sampleRate: ctx.sampleRate });
      };
      node.port.postMessage('stop');
    }),
  };
}

/** Plays clicks through the speakers, listens with the mic and measures the real round-trip delay. Needs speakers, not headphones. */
export async function calibrate(): Promise<number | null> {
  const ctx = nativeContext();
  const rec = await startRecording();
  await new Promise((r) => setTimeout(r, 300));
  const t0 = ctx.currentTime + 0.3;
  const clicks = 6, gap = 0.5;
  for (let i = 0; i < clicks; i++) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 1500; g.gain.setValueAtTime(0.0001, t0 + i * gap);
    g.gain.exponentialRampToValueAtTime(0.9, t0 + i * gap + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * gap + 0.04);
    o.connect(g); g.connect(ctx.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + 0.05);
  }
  await new Promise((r) => setTimeout(r, (0.3 + clicks * gap + 0.6) * 1000));
  const { data, firstTime, sampleRate } = await rec.stop();
  let noise = 0; for (let i = 0; i < Math.min(data.length, sampleRate * 0.2); i++) noise = Math.max(noise, Math.abs(data[i]));
  const thr = Math.max(noise * 4, 0.02);
  const delays: number[] = [];
  for (let i = 0; i < clicks; i++) {
    const expected = t0 + i * gap - firstTime;
    const s0 = Math.floor(expected * sampleRate), s1 = Math.floor((expected + 0.45) * sampleRate);
    for (let s = Math.max(0, s0); s < Math.min(data.length, s1); s++) if (Math.abs(data[s]) > thr) { delays.push(s / sampleRate - expected); break; }
  }
  if (delays.length < 3) return null;
  delays.sort((a, b) => a - b);
  const measured = delays[Math.floor(delays.length / 2)];
  // measured is the true round trip; store the part the browser estimate misses
  const extra = (measured - estimatedLatencySec()) * 1000;
  setExtraLatencyMs(extra);
  return measured * 1000;
}
