/** Mark inspired by the relieving triangle and column of Mycenae's Lion Gate. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round">
      <path d="M14 30 L32 12 L50 30" />
      <path d="M10 34 H54" />
      <path d="M28 34 H36 L34.5 52 H29.5 Z" fill="currentColor" />
      <path d="M26 31 H38" />
      <path d="M14 52 V38 M50 52 V38" />
    </svg>
  );
}
