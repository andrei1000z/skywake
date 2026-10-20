import type { ReactNode } from 'react';

/** Small original stroke icon set, 24×24, inherits currentColor. */
function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconSearch = () => <Svg><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const IconFilter = () => <Svg><path d="M4 6h16M7 12h10M10 18h4" /></Svg>;
export const IconLayers = () => <Svg><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" opacity=".55" /></Svg>;
export const IconList = () => <Svg><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".9" fill="currentColor" /><circle cx="4.5" cy="12" r=".9" fill="currentColor" /><circle cx="4.5" cy="18" r=".9" fill="currentColor" /></Svg>;
export const IconInfo = () => <Svg><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.1" /></Svg>;
export const IconClose = () => <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconTarget = () => <Svg><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" /></Svg>;
export const IconLink = () => <Svg><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
export const IconStar = ({ filled = false }: { filled?: boolean }) => (
  <Svg><path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.5-5.1-2.7-5 2.7 1-5.5-4.1-4 5.6-.8z" fill={filled ? 'currentColor' : 'none'} /></Svg>
);
export const IconBell = () => <Svg><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></Svg>;
export const IconLocate = () => <Svg><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="6" /></Svg>;
export const IconPlane = () => <Svg><path d="M12 3c.9 0 1.3 1.4 1.3 3v4l7 4v1.8l-7-2v3.7l2.2 1.7V21L12 20l-3.5 1v-1.8l2.2-1.7v-3.7l-7 2V14l7-4V6c0-1.6.4-3 1.3-3z" /></Svg>;

export function Logo({ size = 26 }: { size?: number }) {
  // A swept wake line ending in a dot: original mark.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--brand-bg)" />
      <path d="M5 22.5c5.5 0 9-1.6 12.4-5.1S23 11 27 10" stroke="var(--brand-wake)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M5 26c4.2 0 7.4-.9 10.4-3" stroke="var(--brand-wake)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".5" />
      <circle cx="27" cy="10" r="3" fill="var(--brand-dot)" />
    </svg>
  );
}
