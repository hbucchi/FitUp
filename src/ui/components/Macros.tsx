import { fmt, type Nutrients } from '../../domain/nutrients';

export function Ring({ value, target, burned = 0 }: { value: number; target: number; burned?: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const budget = target + burned;
  const pct = budget > 0 ? Math.min(1, value / budget) : 0;
  const over = value > budget;
  const remaining = Math.round(budget - value);
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle
          cx="66" cy="66" r={r} fill="none"
          stroke={over ? 'var(--danger)' : 'var(--accent)'} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 66 66)"
        />
      </svg>
      <div className="center">
        <div className="big-num num">{Math.abs(remaining)}</div>
        <div className="tiny muted">{over ? 'kcal over' : 'kcal left'}</div>
      </div>
    </div>
  );
}

export function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="macro">
      <div className="label"><span>{label}</span></div>
      <div className="value">{Math.round(value)}<span className="muted small"> / {target} g</span></div>
      <div className="bar"><span style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

export function MacroLine({ n }: { n: Nutrients }) {
  return (
    <span className="num">
      <span style={{ color: 'var(--protein)' }}>P {fmt(n.protein ?? 0)}</span>
      {' · '}
      <span style={{ color: 'var(--carbs)' }}>C {fmt(n.carbs ?? 0)}</span>
      {' · '}
      <span style={{ color: 'var(--fat)' }}>F {fmt(n.fat ?? 0)}</span>
    </span>
  );
}
