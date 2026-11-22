const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Level emblem: a laurel wreath around the rank numeral. A leaf pair lights up per rank. */
export function Emblem({ level, size = 64 }: { level: number; size?: number }) {
  const leaves = 7;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="19" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.2" />
      {[-1, 1].map((side) =>
        Array.from({ length: leaves }, (_, i) => {
          // leaves climb from the bottom up each side, roughly tangent to a circle of r = 26
          const deg = 100 + i * 21;
          const a = (deg * Math.PI) / 180;
          const x = 32 - side * Math.cos(a) * 26;
          const y = 32 + Math.sin(a) * 26;
          return (
            <ellipse key={`${side}-${i}`} cx={x} cy={y} rx="2.6" ry="5.2" transform={`rotate(${side * (deg - 180)} ${x} ${y})`}
              fill={i <= level ? 'var(--accent)' : 'var(--line)'} />
          );
        }),
      )}
      <text x="32" y="38" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="16" fill="var(--ink)">
        {NUMERALS[level]}
      </text>
    </svg>
  );
}
