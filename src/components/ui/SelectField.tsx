import React from "react";
import type { SelectOption } from "@constants/index";

export interface SelectFieldProps {
  label: string;
  value: string | number;
  options: readonly (SelectOption | string | number)[];
  /**
   * Optional, defaulting to 0. This repo drives focus order with explicit positive
   * tabIndex values, so existing call sites pass one; new code should leave it
   * alone and let DOM order decide.
   */
  tabIndex?: number;
  wide?: boolean;
  onChange: (value: string) => void;
}

// A plain string or number list is its own label; a SelectOption list labels a
// value the API expects but no user would recognise (an AIR model URN,
// "bottom-right").
export const toOption = (option: SelectOption | string | number): SelectOption =>
  typeof option === "object" ? option : { label: String(option), value: String(option) };

/**
 * The labelled `<select>` used by every advanced-settings panel.
 *
 * Three near-identical copies of this existed — in RemoveBackground, Upscale and
 * GenerateImage — and they had already drifted: only the RemoveBackground one
 * handled SelectOption lists, so the other two could not label a model URN.
 */
const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  tabIndex = 0,
  wide,
  onChange,
}) => {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className={`option-group ${wide ? "wide" : ""}`}>
      {/* htmlFor + id, so clicking the label focuses the control and a screen
          reader announces the two together. The originals had a bare <label>
          adjacent to the <select>, which associates nothing. */}
      <label className="option-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="option-select"
        value={value}
        tabIndex={tabIndex}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(toOption).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectField;
