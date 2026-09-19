const PATHS = {
  leafheart: (
    <>
      <path d="M16 28S5 21.5 5 14.5A5.5 5.5 0 0 1 16 12a5.5 5.5 0 0 1 11 2.5C27 21.5 16 28 16 28Z" />
      <path d="M16 28V13" />
      <path d="M16 19c2.4-.3 4-1.7 4.6-4" />
      <path d="M16 16c-2.2-.3-3.6-1.6-4.2-3.6" />
    </>
  ),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5" /></>),
  bell: (<><path d="M18 9a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 15 18 9Z" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>),
  alert: (<><path d="M12 4 2.7 20h18.6L12 4Z" /><path d="M12 10.5v4" /><path d="M12 17.6h.01" /></>),
  pulse: (<><path d="M20.5 9.5c0 4.8-8.5 10-8.5 10S3.5 14.3 3.5 9.5a4.7 4.7 0 0 1 8.5-2.6 4.7 4.7 0 0 1 8.5 2.6Z" /><path d="M3.8 11.6h3.4l1.6-2.6 2 5.4 1.7-3.6 1.1.8h5.6" /></>),
  steth: (<><path d="M6 3v5.5a4 4 0 0 0 8 0V3" /><path d="M5 3h2" /><path d="M13 3h2" /><path d="M10 12.5v2a5.5 5.5 0 0 0 11 0v-1.2" /><circle cx="21" cy="11" r="2" /></>),
  pill: (<><path d="M11 3.6 3.6 11a5 5 0 0 0 7.1 7.1l7.4-7.4a5 5 0 1 0-7.1-7.1Z" /><path d="m7.3 7.3 7.1 7.1" /></>),
  video: (<><rect x="2.8" y="5.5" width="12.4" height="13" rx="2.6" /><path d="m15.2 11.4 6-3.6v8.4l-6-3.6Z" /></>),
  book: (<><path d="M12 7a4 4 0 0 0-4-2.2H3v13.4h5A4 4 0 0 1 12 20a4 4 0 0 1 4-1.8h5V4.8h-5A4 4 0 0 0 12 7Z" /><path d="M12 7v13" /></>),
  check: <path d="m5 12.6 4.4 4.4L19 7.4" />,
  clock: (<><circle cx="12" cy="12" r="8.6" /><path d="M12 7v5.3l3.2 2" /></>),
  scan: (<><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" /><path d="M20 8.5V6a2 2 0 0 0-2-2h-2.5" /><path d="M4 15.5V18a2 2 0 0 0 2 2h2.5" /><path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" /><circle cx="12" cy="12" r="3.2" /></>),
  flame: <path d="M12 3.2c3 4 5 5.3 5 9a5 5 0 0 1-10 0c0-2 1-3.1 2-4 .4 1.5 1.4 2 2 1 0-2 0-4 1-6Z" />,
  drop: <path d="M12 3.4s6 6.6 6 10.2a6 6 0 0 1-12 0c0-3.6 6-10.2 6-10.2Z" />,
  bowl: (<><path d="M2.8 11.6h18.4a9.2 9.2 0 0 1-18.4 0Z" /><path d="M8.6 8.4c0-1.6 1.2-2.6 1.2-2.6" /><path d="M12 8.4c0-2 1.4-3.2 1.4-3.2" /><path d="M15.4 8.4c0-1.6 1.2-2.6 1.2-2.6" /><path d="M5.5 21h13" /></>),
  user: (<><circle cx="12" cy="8.4" r="3.9" /><path d="M4.6 20.2a7.6 7.6 0 0 1 14.8 0" /></>),
  sun: (<><circle cx="12" cy="12" r="8.4" /><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8Z" fill="currentColor" stroke="none" /></>),
  wave: (<><path d="M3 9.5h13" /><path d="M3 14.5h8" /><path d="M19.5 9.5H21" /><path d="M14.5 14.5H21" /></>),
  close: (<><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>),
  sprout: (<><path d="M12 21v-8" /><path d="M12 13c0-3.4 2.4-6 6-6.4.3 3.8-2.2 6.4-6 6.4Z" /><path d="M12 15.5C8.6 15.5 6 13 5.6 9.4c3.7.3 6.4 2.7 6.4 6.1Z" /></>),
  info: (<><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.2" /><path d="M12 7.8h.01" /></>),
  home: (<><path d="M3.6 10.4 12 3.6l8.4 6.8" /><path d="M5.6 12v8.4h12.8V12" /><path d="M9.8 20.4v-5.6h4.4v5.6" /></>),
  body: (<><circle cx="12" cy="5" r="2.6" /><path d="M12 7.6v7" /><path d="M6.6 10.4 12 8.8l5.4 1.6" /><path d="M9.4 21.4 12 14.6l2.6 6.8" /></>),
  menu: (<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>),
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9M18.5 18.5l-1.9-1.9M7.4 7.4 5.5 5.5" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  chat: (<><path d="M4 5.5h16v11H10l-4.6 3.6V16.5H4v-11Z" /><path d="M8 9.5h8" /><path d="M8 13h5" /></>),
  send: (<><path d="M4 12 20 4l-6.5 16-2.8-7.7L4 12Z" /></>),
};

export default function Icon({ name, size = 20, strokeWidth = 1.6, className, title }) {
  const content = PATHS[name];
  if (!content) return null;
  const viewBox = name === 'leafheart' ? '0 0 32 32' : '0 0 24 24';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  );
}
