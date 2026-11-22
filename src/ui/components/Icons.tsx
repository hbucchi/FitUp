import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props,
});

export const IconDiary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 7h6M8 11h6M8 15h3" /></svg>
);
export const IconFoods = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 11h14a7 7 0 0 1-14 0Z" /><path d="M12 4c0 2 2 2 2 4M9 5c0 1.5 1.5 1.5 1.5 3" /><path d="M9 21h6" /></svg>
);
export const IconTraining = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /></svg>
);
export const IconProfile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
);
export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconChevron = ({ dir = 'right', ...p }: SVGProps<SVGSVGElement> & { dir?: 'left' | 'right' }) => (
  <svg {...base(p)}><path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" /></svg>
);
export const IconWave = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" /></svg>
);
export const IconArrows = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 12h16M14 6l6 6-6 6M10 6l-6 6 6 6" /></svg>
);
