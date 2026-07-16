import React from 'react';

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
};

const NumberField: React.FC<NumberFieldProps> = ({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  min = 0,
  max,
  step = 1,
}) => (
  <label htmlFor={id} className="block">
    <span className="text-sm font-semibold text-slate-800">{label}</span>
    <span className="relative mt-1.5 block">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-900 transition focus:border-primary ${
          suffix ? 'pr-12' : ''
        }`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">{suffix}</span>
      ) : null}
    </span>
    {hint ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{hint}</span> : null}
  </label>
);

export default NumberField;
