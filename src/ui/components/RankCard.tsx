import { useRank } from '../../data/useRank';
import { RANKS, THRESHOLDS, TIERS } from '../../domain/xp';
import { t } from '../../i18n';
import { Emblem } from './Emblem';

const pts = (n: number) => (n < 10 ? n.toFixed(1) : Math.floor(n).toLocaleString());

/** Training rank: points earned in the diary, the current rank and the road to the next. */
export function RankCard() {
  const r = useRank();
  const tier = TIERS[r.tier];
  const inTier = RANKS.filter((x) => x.tier === r.tier);
  const firstInTier = RANKS.findIndex((x) => x.tier === r.tier);
  return (
    <section className="card">
      <div className="row" style={{ gap: 14 }}>
        <Emblem level={r.tier} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{t('{tier} · rank {n} of {total}', { tier: r.tierName, n: r.index + 1, total: RANKS.length })}</div>
          <div className="h-display" style={{ fontSize: 28 }}>{r.name}</div>
          <div className="tiny muted">{t(tier.blurb)}</div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="row between tiny muted" style={{ marginBottom: 4 }}>
          <span className="num"><strong style={{ color: 'var(--ink)' }}>{pts(r.points)}</strong> {t('points')}</span>
          {r.next ? <span>{t('{name} at {n}', { name: r.next.name, n: r.next.at.toLocaleString() })}</span> : <span>{t('Summit of Olympus')}</span>}
        </div>
        <div className="bar" style={{ height: 10 }}>
          <span style={{ width: `${Math.min(1, r.toNext) * 100}%`, background: 'linear-gradient(90deg, var(--sea), var(--accent))' }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
          {inTier.map((x, i) => {
            const idx = firstInTier + i;
            return (
              <span key={x.name} className="tiny" title={`${THRESHOLDS[idx]} ${t('points')}`}
                style={{ color: idx <= r.index ? 'var(--accent)' : 'var(--muted)', fontWeight: idx === r.index ? 700 : 400 }}>
                {t(x.name)}
              </span>
            );
          })}
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="k">{t('Last 7 days')}</div><div className="v num">+{pts(r.week)}</div></div>
        <div className="stat"><div className="k">{t('Tier')}</div><div className="v">{r.tier + 1} / {TIERS.length}</div></div>
      </div>
      <p className="tiny muted" style={{ margin: '10px 0 0' }}>{t('1 point per hour of cardio; lifting scores by exercise and weight. Zeus takes ~7 years of hard training.')}</p>
    </section>
  );
}
