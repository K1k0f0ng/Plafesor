import React from 'react';

function SVG({ size = 18, style, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export function IconHome({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </SVG>
  );
}

export function IconSchool({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M4 22V8L12 2l8 6v14" />
      <line x1="2" y1="22" x2="22" y2="22" />
      <path d="M9 22v-6h6v6" />
      <path d="M12 6v2" />
    </SVG>
  );
}

export function IconBookOpen({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </SVG>
  );
}

export function IconUsers({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SVG>
  );
}

export function IconUser({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </SVG>
  );
}

export function IconBarChart({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </SVG>
  );
}

export function IconTrendUp({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </SVG>
  );
}

export function IconAlertTriangle({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </SVG>
  );
}

export function IconAlertCircle({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </SVG>
  );
}

export function IconZap({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </SVG>
  );
}

export function IconFileText({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </SVG>
  );
}

export function IconEdit({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </SVG>
  );
}

export function IconClipboard({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="12" y1="11" x2="16" y2="11" />
      <line x1="12" y1="16" x2="16" y2="16" />
      <line x1="8" y1="11" x2="8.01" y2="11" />
      <line x1="8" y1="16" x2="8.01" y2="16" />
    </SVG>
  );
}

export function IconCheckSquare({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </SVG>
  );
}

export function IconCalendar({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </SVG>
  );
}

export function IconMegaphone({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 0 1-5.8-1.6" />
    </SVG>
  );
}

export function IconBot({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <path d="M9 15v2" />
      <path d="M15 15v2" />
      <path d="M1 14h2M21 14h2" />
    </SVG>
  );
}

export function IconDownload({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </SVG>
  );
}

export function IconInbox({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </SVG>
  );
}

export function IconClock({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </SVG>
  );
}

export function IconCheck({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="20 6 9 17 4 12" />
    </SVG>
  );
}

export function IconLogOut({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </SVG>
  );
}

export function IconRefresh({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </SVG>
  );
}

export function IconArrowLeft({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </SVG>
  );
}

export function IconChevronDown({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="6 9 12 15 18 9" />
    </SVG>
  );
}

export function IconChevronUp({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="18 15 12 9 6 15" />
    </SVG>
  );
}

export function IconMonitor({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </SVG>
  );
}

export function IconGlobe({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </SVG>
  );
}

export function IconFlask({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M9 3h6l2 7H7L9 3z" />
      <path d="M7 10l-4 10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1L17 10" />
      <line x1="12" y1="3" x2="12" y2="10" />
    </SVG>
  );
}

export function IconMap({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </SVG>
  );
}

export function IconGrid({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </SVG>
  );
}

export function IconLink({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </SVG>
  );
}

export function IconList({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </SVG>
  );
}

export function IconCheckCircle({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </SVG>
  );
}

export function IconCircle({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </SVG>
  );
}

export function IconStar({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </SVG>
  );
}

export function IconAccessibility({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 8.5c2.2.8 4.6 1.2 7 1.2s4.8-.4 7-1.2" />
      <path d="M12 9.7v4.3" />
      <path d="M9 22l2.2-6.4a1 1 0 0 1 1.6 0L15 22" />
      <path d="M8 13.5 5.5 19" />
      <path d="M16 13.5 18.5 19" />
    </SVG>
  );
}

export function IconFlame({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </SVG>
  );
}

export function IconMenu({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </SVG>
  );
}

export function IconChevronRight({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <polyline points="9 18 15 12 9 6" />
    </SVG>
  );
}

export function IconShield({ size, style }) {
  return (
    <SVG size={size} style={style}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11.5 14.5 15.5 10" />
    </SVG>
  );
}

/** Colored dot used as a semaphore / status indicator */
export function SemaforoDot({ color, size = 11 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  );
}
