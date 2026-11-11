import { useEffect, useState } from 'preact/hooks';

export type Tab = 'recipe' | 'beat' | 'play' | 'write' | 'mic' | 'song';
export const ui = {
  tab: 'recipe' as Tab,
  beat: 'A' as 'A' | 'B',
  part: 'Hook',
  toast: '' as string,
  songsOpen: false,
  busy: '' as string,
};
const ls = new Set<() => void>();
export function setUi(p: Partial<typeof ui>) { Object.assign(ui, p); ls.forEach((l) => l()); }
export function useUi() {
  const [, set] = useState(0);
  useEffect(() => { const l = () => set((x) => x + 1); ls.add(l); return () => { ls.delete(l); }; }, []);
  return ui;
}
let toastTimer: number | undefined;
export function toast(msg: string) {
  setUi({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => setUi({ toast: '' }), 2600);
}
/** Re-render a component whenever an outside emitter fires. */
export function useEmitter(sub: (l: () => void) => () => unknown) {
  const [, set] = useState(0);
  useEffect(() => { const off = sub(() => set((x) => x + 1)); return () => { off(); }; }, []);
}
