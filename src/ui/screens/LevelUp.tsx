import { useEffect } from 'react';
import { useStore } from '../../data/store';
import { useRank } from '../../data/useRank';
import { tierBlurb } from '../../domain/xp';
import { RankImage } from '../components/RankImage';
import { t } from '../../i18n';

/** Shown once when training points move you into a new rank. */
export function LevelUp() {
  const profile = useStore((s) => s.profile);
  const seen = useStore((s) => s.rankSeen);
  const setSeen = useStore((s) => s.setRankSeen);
  const r = useRank();
  // first run (or history imported from another device): start from where you are, no fanfare
  useEffect(() => {
    if (profile && seen == null) setSeen(r.index);
  }, [profile, seen, r.index, setSeen]);
  if (!profile || seen == null || r.index <= seen) return null;
  const close = () => setSeen(r.index);
  return (
    <div className="sheet-backdrop" style={{ alignItems: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="card" role="dialog" aria-modal="true" aria-label={t('New rank: {name}', { name: r.name })} style={{ maxWidth: 340, width: 'calc(100% - 32px)', textAlign: 'center', padding: 28 }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}><RankImage index={r.index} sex={r.sex} size={160} /></div>
        <div className="eyebrow">{t('You have risen')} · {r.tierName}</div>
        <div className="h-display" style={{ fontSize: 34, margin: '4px 0 8px' }}>{r.name}</div>
        <p className="small muted" style={{ marginTop: 0 }}>{t(tierBlurb(r.tier, r.sex))}</p>
        <p className="small">{t('{n} points', { n: Math.floor(r.points).toLocaleString() })}{r.next ? ` · ${t('Next: {name}.', { name: r.next.name })}` : ''}</p>
        <button className="btn primary block" onClick={close}>{t('Onward')}</button>
      </div>
    </div>
  );
}
