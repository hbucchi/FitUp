import type { ReactNode } from 'react';

export function NumberField({ label, value, onChange, suffix, step = 'any', min = 0, placeholder, id }: {
  label: ReactNode; value: number | ''; onChange: (v: number | '') => void; suffix?: string;
  step?: number | 'any'; min?: number; placeholder?: string; id?: string;
}) {
  return (
    <label className="field">
      {label}
      <div className="input-wrap">
        <input
          id={id}
          className="input num"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
