import { useId, type SelectHTMLAttributes } from 'react';

/** One selectable item in a SelectField. */
export interface SelectOption {
  /** Value supplied to the change handler when selected. */
  value: string;
  /** Human-readable option text. */
  label: string;
  /** Prevent this option from being selected. */
  disabled?: boolean;
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible label associated with the select. */
  label: string;
  /** Options in display order; values should be unique. */
  options: SelectOption[];
  /** Validation message shown below the select. */
  error?: string;
  /** Select ID. An accessible unique ID is generated when omitted. */
  id?: string;
  /** Additional CSS classes for the field wrapper. */
  className?: string;
}

/** A labelled 48px native select with accessible validation feedback. */
export function SelectField({ label, options, error, id, className = '', ...props }: SelectFieldProps) {
  const generatedId = useId(); const selectId = id || generatedId;
  return <div className={`ym-field ${className}`}><label htmlFor={selectId}>{label}</label><select {...props} id={selectId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={[props['aria-describedby'], error ? `${selectId}-error` : ''].filter(Boolean).join(' ') || undefined}>{options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>{error && <p className="ym-field-error" id={`${selectId}-error`}>{error}</p>}</div>;
}
