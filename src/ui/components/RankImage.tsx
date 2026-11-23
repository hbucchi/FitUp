import { useState } from 'react';
import { RANKS, TIERS } from '../../domain/xp';
import { Emblem } from './Emblem';

/** File name for a rank or tier picture: "Athlete of Olympia" → "athlete-of-olympia". */
export const slug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Renaissance miniature for a rank (public/ranks/<slug>.webp), with the laurel emblem as fallback. */
export function RankImage({ index, size = 64, tierOnly = false }: { index: number; size?: number; tierOnly?: boolean }) {
  const r = RANKS[index] ?? RANKS[0];
  const name = tierOnly ? `tier-${TIERS[r.tier].name}` : r.name;
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === name) return <Emblem level={r.tier} size={size} />;
  return (
    <img src={`${import.meta.env.BASE_URL}ranks/${slug(name)}.webp`} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(name)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', boxShadow: '0 0 0 2px var(--accent-soft)' }} />
  );
}
