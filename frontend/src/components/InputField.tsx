import { useId, type InputHTMLAttributes } from 'react';

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label associated with the input. */
  label: string;
  /** Right-aligned unit badge, such as kg or LKR. */
  unit?: string;
  /** Validation message; also marks the input as invalid for assistive technology. */
  error?: string;
  /** Input ID. An accessible unique ID is generated when omitted. */
  id?: string;
  /** Additional CSS classes for the field wrapper. */
  className?: string;
}

/** A labelled 48px input with an optional unit badge and validation message. */
export function InputField({ label, unit, error, id, className = '', ...props }: InputFieldProps) {
  const generatedId = useId(); const inputId = id || generatedId;
  const description = [props['aria-describedby'], unit ? `${inputId}-unit` : '', error ? `${inputId}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className={`ym-field ${className}`}><label htmlFor={inputId}>{label}</label><div className="ym-input-wrap"><input {...props} id={inputId} className={unit ? 'ym-input--unit' : ''} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description} />{unit && <span id={`${inputId}-unit`} className="ym-unit">{unit}</span>}</div>{error && <p className="ym-field-error" id={`${inputId}-error`}>{error}</p>}</div>;
}
