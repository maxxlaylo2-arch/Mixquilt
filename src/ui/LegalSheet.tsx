import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import privacyMd from '../../PRIVACY.md?raw';
import termsMd from '../../TERMS.md?raw';
import { Seg } from './common';

export type LegalPage = 'privacy' | 'terms' | 'licenses';

/** Minimal renderer for our own plain policy markdown: headings, paragraphs, bullet lists, **bold**, _italic_. */
function inline(t: string): ComponentChildren[] {
  return t.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\)|(?<![\w{])_[^_]+_(?![\w}]))/g).filter(Boolean).map((x) => {
    const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(x);
    if (link) return <a href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return x.startsWith('**') ? <b>{x.slice(2, -2)}</b> : x.startsWith('_') && x.endsWith('_') ? <i>{x.slice(1, -1)}</i> : x;
  });
}
function Markdown({ src }: { src: string }) {
  const out: ComponentChildren[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) out.push(<ul>{list.map((l) => <li>{inline(l)}</li>)}</ul>); list = []; };
  for (const block of src.split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    if (lines.every((l) => l.startsWith('- '))) { list.push(...lines.map((l) => l.slice(2))); continue; }
    flush();
    const b = block.trim();
    if (b.startsWith('## ')) out.push(<h3>{b.slice(3)}</h3>);
    else if (b.startsWith('# ')) out.push(<h2>{b.slice(2)}</h2>);
    else if (b) out.push(<p>{inline(b.replace(/\n/g, ' '))}</p>);
  }
  flush();
  return <div class="legal-md">{out}</div>;
}

function Licenses() {
  const [text, setText] = useState('Loading…');
  useEffect(() => {
    fetch(new URL('licenses/THIRD-PARTY-NOTICES.txt', document.baseURI).href)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(setText, () => setText('Could not load the notices. They are also in THIRD-PARTY-NOTICES.txt in the project repository.'));
  }, []);
  return (
    <div class="legal-md">
      <p>Mixquilt is Copyright (c) 2026 Stephen Curran III, New York. All rights reserved. It includes the open-source software and data below, each under its own license. The rhymes and syllable counts come from the CMU Pronouncing Dictionary (BSD-2-Clause, Carnegie Mellon University). Word commonness comes from the SCOWL word lists (Kevin Atkinson). All sounds are synthesized in the app, the icons are original and the app bundles no fonts.</p>
      <pre class="legal-pre" data-testid="licenses-text">{text}</pre>
    </div>
  );
}

export function LegalSheet(p: { page: LegalPage; onClose: () => void }) {
  const [page, setPage] = useState<LegalPage>(p.page);
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div class="sheet legal-sheet" role="dialog" aria-label="Privacy, terms and licenses" data-testid="legal-sheet">
        <div class="sheet-head"><h2>Legal</h2><button class="btn ghost" data-testid="legal-done" onClick={p.onClose}>Done</button></div>
        <Seg label="Page" value={page} onChange={setPage} options={[['privacy', 'Privacy'], ['terms', 'Terms'], ['licenses', 'Licenses']]} />
        <div data-testid={`legal-${page}`}>
          {page === 'privacy' ? <Markdown src={privacyMd} /> : page === 'terms' ? <Markdown src={termsMd} /> : <Licenses />}
        </div>
      </div>
    </div>
  );
}
