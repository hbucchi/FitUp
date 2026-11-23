import { useState } from 'react';
import type { Sex } from '../../domain/types';
import { RANKS } from '../../domain/xp';
import { Emblem } from './Emblem';

const pad = (n: number) => String(n).padStart(2, '0');

/** Path of a rank's Renaissance miniature (women have their own set), or of a tier emblem. */
export const rankImageSrc = (index: number, sex?: Sex) => `${import.meta.env.BASE_URL}ranks/${sex === 'female' ? 'f' : 'm'}-${pad(index)}.webp`;
export const tierImageSrc = (tier: number) => `${import.meta.env.BASE_URL}ranks/tier-${tier}.webp`;

/** Round picture for a rank (or a tier with `tier`), falling back to the laurel emblem if it can't load. */
export function RankImage({ index, sex, size = 64, tier }: { index: number; sex?: Sex; size?: number; tier?: number }) {
  const r = RANKS[index] ?? RANKS[0];
  const src = tier != null ? tierImageSrc(tier) : rankImageSrc(index, sex);
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <Emblem level={tier ?? r.tier} size={size} />;
  return (
    <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(src)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', boxShadow: '0 0 0 2px var(--accent-soft)' }} />
  );
}
