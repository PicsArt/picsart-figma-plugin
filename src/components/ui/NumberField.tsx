import React from "react";

export interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  tabIndex?: number;
  wide?: boolean;
  onChange: (value: number) => void;
}

/**
 * Pin a typed-in number to the range the API accepts.
 *
 * The browser does not enforce min/max on a value the user types, and clearing the
 * field yields "", which becomes NaN. Both used to reach the request untouched
 * from two of the three panels — this clamping existed only in the
 * RemoveBackground copy.
 */
export const clamp = (value: string, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
};

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  min,
  max,
  tabIndex = 0,
  wide,
  onChange,
}) => {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className={`option-group ${wide ? "wide" : ""}`}>
      <label className="option-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="option-input"
        type="number"
        min={min}
        max={max}
        value={value}
        tabIndex={tabIndex}
        onChange={(e) => onChange(clamp(e.target.value, min, max))}
      />
    </div>
  );
};

export default NumberField;
