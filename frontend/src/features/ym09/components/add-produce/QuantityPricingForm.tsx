import { Package, Calculator } from 'lucide-react';
import type { AddProduceFormState, AddProduceValidationErrors } from '../../types/produce';

interface QuantityPricingFormProps {
  formState: AddProduceFormState;
  errors: AddProduceValidationErrors;
  maxAvailableKg?: number;
  minAvailableKg?: number;
  onQuantityChange: (qty: number | '') => void;
  onPriceChange: (price: number | '') => void;
}

export function QuantityPricingForm({
  formState,
  errors,
  maxAvailableKg,
  minAvailableKg,
  onQuantityChange,
  onPriceChange,
}: QuantityPricingFormProps) {
  const quantity = typeof formState.totalQuantity === 'number' ? formState.totalQuantity : 0;
  const unitPrice = typeof formState.unitPrice === 'number' ? formState.unitPrice : 0;
  const totalValueRupees = quantity > 0 && unitPrice > 0 ? quantity * unitPrice : 0;

  const handleQtyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      onQuantityChange('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onQuantityChange(num);
    }
  };

  const handlePriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      onPriceChange('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onPriceChange(num);
    }
  };

  return (
    <section className="ym-content-card ym09-form-section">
      {/* Standardized Section Header Banner */}
      <div className="ym09-section-badge">
        <span className="ym09-section-badge-num">2</span>
        <Package size={16} aria-hidden="true" />
        <span>Quantity &amp; Pricing</span>
      </div>

      {/* 3-element horizontal row on desktop (28% / 28% / 44%) */}
      <div className="ym09-quantity-pricing-grid">
        {/* Column 1 (28%): Total Quantity */}
        <div className="ym-field">
          <label htmlFor="produce-quantity" className="ym09-field-label">
            <span>
              Total Quantity <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-quantity"
              type="number"
              min={minAvailableKg && minAvailableKg > 0 ? minAvailableKg : 0.001}
              step="any"
              max={maxAvailableKg || undefined}
              placeholder="e.g. 100"
              value={formState.totalQuantity}
              onChange={handleQtyInput}
              className="ym-input--unit"
              aria-invalid={errors.totalQuantity ? true : undefined}
              aria-describedby={errors.totalQuantity ? 'produce-quantity-error' : 'produce-quantity-hint'}
            />
            <span id="produce-quantity-unit" className="ym-unit">
              kg
            </span>
          </div>
          {errors.totalQuantity ? (
            <p className="ym-field-error" id="produce-quantity-error">
              {errors.totalQuantity}
            </p>
          ) : (
            maxAvailableKg !== undefined && (
              <span id="produce-quantity-hint" className="ym09-field-hint">
                {minAvailableKg && minAvailableKg > 0
                  ? `Max batch stock: ${maxAvailableKg} kg (min ${minAvailableKg} kg held/committed)`
                  : `Max batch stock: ${maxAvailableKg} kg`}
              </span>
            )
          )}
        </div>

        {/* Column 2 (28%): Price per kg */}
        <div className="ym-field">
          <label htmlFor="produce-price" className="ym09-field-label">
            <span>
              Price per kg <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-price"
              type="number"
              min="0.01"
              step="any"
              placeholder="e.g. 320"
              value={formState.unitPrice}
              onChange={handlePriceInput}
              className="ym-input--unit"
              aria-invalid={errors.unitPrice ? true : undefined}
              aria-describedby={errors.unitPrice ? 'produce-price-error' : undefined}
            />
            <span id="produce-price-unit" className="ym-unit">
              / kg
            </span>
          </div>
          {errors.unitPrice ? (
            <p className="ym-field-error" id="produce-price-error">
              {errors.unitPrice}
            </p>
          ) : (
            <span id="produce-price-hint" className="ym09-field-hint">
              Wholesale farmgate price in LKR
            </span>
          )}
        </div>

        {/* Column 3 (44%): Estimated Total Value Card */}
        <div className="ym-field ym09-estimated-value-col">
          <span className="ym09-field-label">
            <Calculator size={14} color="#D97706" aria-hidden="true" />
            <span>Estimated Total Value</span>
          </span>

          <div className="ym09-estimated-value-box">
            <strong
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--green)',
                letterSpacing: '-0.02em',
              }}
            >
              LKR {totalValueRupees.toLocaleString('en-US')}
            </strong>

            <span
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
              }}
            >
              ({quantity.toLocaleString('en-US')} kg × LKR {unitPrice.toLocaleString('en-US')})
            </span>
          </div>

          <span className="ym09-field-hint">
            Calculated marketplace gross value
          </span>
        </div>
      </div>
    </section>
  );
}
