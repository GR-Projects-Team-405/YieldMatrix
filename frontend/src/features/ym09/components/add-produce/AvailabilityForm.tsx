import { CalendarDays } from 'lucide-react';
import type { AddProduceFormState, AddProduceValidationErrors } from '../../types/produce';

interface AvailabilityFormProps {
  formState: AddProduceFormState;
  errors: AddProduceValidationErrors;
  onFromChange: (val: string) => void;
  onUntilChange: (val: string) => void;
}

export function AvailabilityForm({
  formState,
  errors,
  onFromChange,
  onUntilChange,
}: AvailabilityFormProps) {
  return (
    <section className="ym-content-card ym09-form-section">
      {/* Standardized Section Header Banner */}
      <div className="ym09-section-badge">
        <span className="ym09-section-badge-num">3</span>
        <CalendarDays size={16} aria-hidden="true" />
        <span>Availability</span>
      </div>

      <div className="ym09-availability-grid">
        {/* Available From */}
        <div className="ym-field">
          <label htmlFor="produce-available-from" className="ym09-field-label">
            <CalendarDays size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Available From <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-available-from"
              type="date"
              value={formState.availableFrom}
              onChange={(e) => onFromChange(e.target.value)}
              aria-invalid={errors.availableFrom ? true : undefined}
              aria-describedby={errors.availableFrom ? 'produce-from-error' : undefined}
            />
          </div>
          {errors.availableFrom && (
            <p className="ym-field-error" id="produce-from-error">
              {errors.availableFrom}
            </p>
          )}
        </div>

        {/* Available Until */}
        <div className="ym-field">
          <label htmlFor="produce-available-until" className="ym09-field-label">
            <CalendarDays size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Available Until <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-available-until"
              type="date"
              min={formState.availableFrom || undefined}
              value={formState.availableUntil}
              onChange={(e) => onUntilChange(e.target.value)}
              aria-invalid={errors.availableUntil ? true : undefined}
              aria-describedby={errors.availableUntil ? 'produce-until-error' : undefined}
            />
          </div>
          {errors.availableUntil && (
            <p className="ym-field-error" id="produce-until-error">
              {errors.availableUntil}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
