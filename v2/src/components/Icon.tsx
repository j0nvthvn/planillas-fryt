const paths = {
  arrowLeft: 'M15 18l-6-6 6-6M9 12h10',
  chart: 'M5 19V9M12 19V5M19 19v-7',
  check: 'M5 12.5l4.5 4.5L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  history: 'M4 12a8 8 0 108-8 8.2 8.2 0 00-5.7 2.3L4 8.5M4 4v4.5h4.5M12 8v4l3 2',
  home: 'M4 10l8-6 8 6M6 9v10h12V9',
  logout: 'M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M4 7h16M4 12h16M4 17h16',
  moon: 'M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z',
  note: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  summary: 'M5 5h14v14H5zM8 15l3-3 2 2 3-4',
  store: 'M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M8 19v-6h5v6',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8',
  warning: 'M12 4l8 15H4l8-15zM12 9v4M12 16h.01',
  merge: 'M4 6l8 6M4 18l8-6M12 12h6M20 12l-3-3M20 12l-3 3',
  suppliers: 'M2 8h12v10H2V8zM14 11h4l3 4v3h-7V11zM6 18a2 2 0 100-4 2 2 0 000 4zM17 18a2 2 0 100-4 2 2 0 000 4z',
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  pencil: 'M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z',
  chevR: 'M9 18l6-6-6-6',
  chevL: 'M15 18l-6-6 6-6',
  calendar: 'M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  cash: 'M3 7h18v10H3zM12 9.7a2.3 2.3 0 100 4.6 2.3 2.3 0 000-4.6',
  bank: 'M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18',
  caretUp: 'M6 15l6-6 6 6',
  caretDown: 'M6 9l6 6 6-6',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4.5M12 8h.01',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  split: 'M12 3v18M4 12h6M14 12h6M17 9l3 3-3 3M7 9l-3 3 3 3',
  refresh: 'M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0019 13.5M18.4 9A8 8 0 005 10.5',
  mail: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3.5 6.5L12 13l8.5-6.5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.3 6.4A17 17 0 002 12s3.5 7 10 7a9.9 9.9 0 004.3-.95',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  wallet: 'M3 7h16a2 2 0 012 2v8a2 2 0 01-2 2H3zM3 7V5a2 2 0 012-2h11v4M16 13h5',
} as const

export type IconName = keyof typeof paths

interface Props {
  name: IconName
  className?: string
  stroke?: number
}

export default function Icon({ name, className = 'w-5 h-5', stroke = 1.8 }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
