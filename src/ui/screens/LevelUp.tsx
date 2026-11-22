import { useStore } from '../../data/store';
import { LEVELS, ascent } from '../../domain/objective';
import { Emblem } from '../components/Emblem';
import { t } from '../../i18n';

/** Shown once when a weigh-in moves you into a new rank. */
export function LevelUp() {
  const profile = useStore((s) => s.profile);
  const objective = useStore((s) => s.objective);
  const setObjective = useStore((s) => s.setObjective);
  if (!profile || !objective) return null;
  const a = ascent(objective, profile);
  if (a.level <= objective.levelSeen) return null;
  const lvl = LEVELS[a.level];
  const close = () => setObjective({ ...objective, levelSeen: a.level });
  return (
    <div className="sheet-backdrop" style={{ alignItems: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="card" role="dialog" aria-modal="true" aria-label={t('New rank: {name}', { name: lvl.name })} style={{ maxWidth: 340, width: 'calc(100% - 32px)', textAlign: 'center', padding: 28 }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}><Emblem level={a.level} size={96} /></div>
        <div className="eyebrow">{t('You have risen')}</div>
        <div className="h-display" style={{ fontSize: 34, margin: '4px 0 8px' }}>{lvl.name}</div>
        <p className="small muted" style={{ marginTop: 0 }}>{lvl.blurb}</p>
        <p className="small">{t('{pct}% of the way to your objective.', { pct: Math.round(a.progress * 100) })}{a.next ? ` ${t('Next: {name}.', { name: a.next.name })}` : ''}</p>
        <button className="btn primary block" onClick={close}>{t('Onward')}</button>
      </div>
    </div>
  );
}
