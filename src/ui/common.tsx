import type { ComponentChildren } from 'preact';

export function Card(p: { title?: string; sub?: string; children: ComponentChildren; class?: string; right?: ComponentChildren; id?: string }) {
  return (
    <section class={'card ' + (p.class ?? '')} id={p.id}>
      {(p.title || p.right) && (
        <div class="card-head">
          <div>{p.title && <h2>{p.title}</h2>}{p.sub && <p class="muted small">{p.sub}</p>}</div>
          {p.right}
        </div>
      )}
      {p.children}
    </section>
  );
}
export function Seg<T extends string | number>(p: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, l]) => (
        <button key={String(v)} role="radio" aria-checked={p.value === v} class={p.value === v ? 'on' : ''} onClick={() => p.onChange(v)}>{l}</button>
      ))}
    </div>
  );
}
export function Stepper(p: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; suffix?: string; prefix?: string }) {
  const st = p.step ?? 1;
  return (
    <div class="stepper" aria-label={p.label}>
      <button aria-label={`Less ${p.label}`} onClick={() => p.onChange(Math.max(p.min, p.value - st))}>−</button>
      <span class="stepper-val">{p.prefix ?? ''}{p.prefix && p.value > 0 ? '+' : ''}{p.value}{p.suffix ?? ''}</span>
      <button aria-label={`More ${p.label}`} onClick={() => p.onChange(Math.min(p.max, p.value + st))}>+</button>
    </div>
  );
}
export function Select(p: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string; testid?: string }) {
  return (
    <select class="select" aria-label={p.label} data-testid={p.testid} value={p.value} onChange={(e) => p.onChange((e.target as HTMLSelectElement).value)}>
      {p.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
export function NextStep(p: { label: string; onClick: () => void }) {
  return <button class="btn next" onClick={p.onClick}>{p.label} →</button>;
}
