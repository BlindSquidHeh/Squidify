import { useState, type ReactNode } from "react";

export function Control({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="control" title={hint}>
      <span className="label">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <Control label={label} hint={hint}>
      <div className="control-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <output>
          {value}
          {unit}
        </output>
      </div>
    </Control>
  );
}

const HEX6 = /^#[0-9a-f]{6}$/i;

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Черновик живёт только пока поле ввода в фокусе и значение ещё не валидно.
  const [draft, setDraft] = useState<string | null>(null);
  // <input type="color"> понимает только #rrggbb.
  const pickerValue = HEX6.test(value) ? value : value.length === 9 ? value.slice(0, 7) : "#000000";
  return (
    <Control label={label}>
      <div className="color-control">
        <input type="color" value={pickerValue} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input
          className="input"
          value={draft ?? value}
          maxLength={9}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </Control>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Control label={label}>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            className={value === opt.value ? "active" : ""}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Control>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Control label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Control>
  );
}
