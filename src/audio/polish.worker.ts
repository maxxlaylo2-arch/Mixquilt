// Runs Voice Polish off the main thread so the UI never freezes.
import { polish, type PolishInput } from './polishDsp';

self.onmessage = (e: MessageEvent<{ id: number; input: PolishInput }>) => {
  const { id, input } = e.data;
  try {
    const res = polish(input, (f, stage) => (self as any).postMessage({ id, type: 'progress', f, stage }));
    const out = res.data.byteOffset === 0 && res.data.length === res.data.buffer.byteLength / 4 ? res.data : res.data.slice();
    (self as any).postMessage({ id, type: 'done', data: out, report: res.report }, [out.buffer]);
  } catch (err) {
    (self as any).postMessage({ id, type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
