const P = (d: string) => (props: { size?: number }) => (
  <svg width={props.size ?? 24} height={props.size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const IconRecipe = P('M4 5h16M4 12h16M4 19h10M18 17l2 2 3-4');
export const IconBeat = P('M3 3h5v5H3zM10 3h5v5h-5zM17 10h5v5h-5zM3 10h5v5H3zM10 17h5v5h-5z');
export const IconPlayPad = P('M3 6h18v12H3zM7 6v7M11 6v7M15 6v7M19 6v7');
export const IconWrite = P('M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4');
export const IconMic = P('M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3');
export const IconSong = P('M4 6h10M4 12h16M4 18h7M17 4v10a3 3 0 1 1-2-2.8');
export const IconPlay = P('M7 4l13 8-13 8z');
export const IconStop = P('M6 6h12v12H6z');
export const IconDice = P('M4 4h16v16H4zM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01');
export const IconLock = P('M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4');
export const IconUnlock = P('M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2');
export const IconMetro = P('M9 3h6l4 18H5zM12 17l5-9');
export const IconMenu = P('M4 6h16M4 12h16M4 18h16');
export const IconPlus = P('M12 5v14M5 12h14');
export const IconTrash = P('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3');
export const IconUp = P('M12 19V5M5 12l7-7 7 7');
export const IconDown = P('M12 5v14M19 12l-7 7-7-7');
export const IconCopy = P('M8 8h12v12H8zM4 16V4h12');
export const IconRecord = (p: { size?: number }) => (<svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor" /></svg>);
export const IconDownload = P('M12 4v12M6 10l6 6 6-6M4 20h16');
