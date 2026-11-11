import type { PolishInput, PolishReport } from './polishDsp';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: { data: Float32Array; report: PolishReport }) => void; reject: (e: Error) => void; progress?: (f: number, stage: string) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./polish.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data; const p = pending.get(m.id); if (!p) return;
    if (m.type === 'progress') p.progress?.(m.f, m.stage);
    else { pending.delete(m.id); if (m.type === 'done') p.resolve({ data: m.data, report: m.report }); else p.reject(new Error(m.message)); }
  };
  return worker;
}

/** Process audio in a Web Worker. The caller's array is copied, so the original take is never touched. */
export function runPolish(input: PolishInput, progress?: (f: number, stage: string) => void): Promise<{ data: Float32Array; report: PolishReport }> {
  const id = ++seq;
  const data = input.data.slice();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress });
    getWorker().postMessage({ id, input: { ...input, data } }, [data.buffer]);
  });
}
