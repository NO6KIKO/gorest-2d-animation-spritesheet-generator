import type { ReactNode } from "react";

type StartUiToggleControlProps = {
  checked: boolean;
  children: ReactNode;
  disabled?: boolean;
  emphasized?: boolean;
  onChange: (checked: boolean) => void;
};

type StartUiRangeControlProps = {
  disabled?: boolean;
  label: ReactNode;
  max: number;
  min: number;
  step?: number;
  value: number;
  valueLabel?: ReactNode;
  onChange: (value: number) => void;
};

type StartUiSelectControlProps<T extends string> = {
  disabled?: boolean;
  label: ReactNode;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
};

export function StartUiToggleControl({
  checked,
  children,
  disabled = false,
  emphasized = false,
  onChange,
}: StartUiToggleControlProps) {
  return (
    <label className={`scene-start-ui-toggle ${emphasized ? "enabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

export function StartUiRangeControl({
  disabled = false,
  label,
  max,
  min,
  step = 1,
  value,
  valueLabel = value,
  onChange,
}: StartUiRangeControlProps) {
  return (
    <label>
      {label} <span>{valueLabel}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function StartUiSelectControl<T extends string>({
  disabled = false,
  label,
  options,
  value,
  onChange,
}: StartUiSelectControlProps<T>) {
  return (
    <label>
      {label}
      <select value={value} disabled={disabled} onChange={event => onChange(event.target.value as T)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
