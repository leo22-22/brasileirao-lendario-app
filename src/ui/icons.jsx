// Ícones de traço (stroke 1.7) no lugar dos emojis da interface. Todos usam
// `currentColor`, então herdam a cor do texto do botão/aba onde estão.
const P = {
  trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" /><path d="M12 13v4M8.5 20h7M10 17h4" /></>,
  shirt: <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />,
  formation: <><rect x="3.5" y="3" width="17" height="18" rx="2" /><path d="M3.5 12h17" /><circle cx="12" cy="12" r="2.5" /><circle cx="8" cy="7" r="0.9" fill="currentColor" /><circle cx="16" cy="7" r="0.9" fill="currentColor" /><circle cx="12" cy="17.5" r="0.9" fill="currentColor" /></>,
  market: <><path d="M3 9h18l-1.5 11h-15z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></>,
  table: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></>,
  cup: <><path d="M4 5h5v5H4zM4 14h5v5H4zM9 7.5h4v9H9M13 12h7" /></>,
  sprout: <><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z" /><path d="M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5z" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  sound: <><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  ranking: <><path d="M8 21V11H3v10M15 21V4h-5v17M21 21v-7h-5v7" /></>,
  news: <><path d="M12 3v2M5.6 5.6 7 7M3 12h2M19 12h2M17 7l1.4-1.4" /><path d="M9 16a5 5 0 1 1 6 0c-.6.5-1 1.1-1 2H10c0-.9-.4-1.5-1-2zM10 21h4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.3-6 8-6s7 2 8 6" /></>,
  users: <><circle cx="9" cy="9" r="3.5" /><circle cx="17" cy="10" r="2.5" /><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M15 14.5c2.5 0 4.6 1.5 5.5 4.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  forward: <path d="M4 5v14l8-7zM12 5v14l8-7z" />,
  warning: <><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  loan: <><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" /></>,
  tag: <><path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" /><circle cx="8" cy="8.5" r="1.4" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></>,
  swap: <path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" />,
  star: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z" /><path d="M12 3v4.5M21 10.4l-5 0M17.5 19.5 14.5 15M6.5 19.5 9.5 15M3 10.4h5" /></>,
  home: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v5M18 9.5v5" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  medal: <><circle cx="12" cy="15" r="5.5" /><path d="M8.5 3 12 9.5 15.5 3M12 12.8v4.4" /></>,
  wifiOff: <><path d="m3 3 18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.6M14.5 10a10 10 0 0 1 4.5 2.5M2 9a14.5 14.5 0 0 1 4.5-2.8M12 20h.01" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.7, style, className, title }) {
  const path = P[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {path}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
