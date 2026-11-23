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
            <span>Total Quantity <span style={{ color: '#b42318' }}>*</span></span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-quantity"
              type="number"
              min={minAvailableKg || 1}
              step="any"
              max={maxAvailableKg || undefined}
              placeholder="e.g. 100"
              value={formState.totalQuantity}
              onChange={handleQtyInput}
              className="ym-input--unit"
              aria-invalid={errors.totalQuantity ? true : undefined}
              aria-describedby={errors.totalQuantity ? 'produce-quantity-error' : 'produce-quantity-hint'}
              style={{
                height: '48px',
                width: '100%',
                borderRadius: '12px',
                border: `1px solid ${errors.totalQuantity ? '#b42318' : 'var(--control-border)'}`,
                padding: '0 54px 0 16px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '15px',
              }}
            />
            <span
              id="produce-quantity-unit"
              className="ym-unit"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                backgroundColor: 'var(--canvas)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--muted)',
                fontWeight: 500,
              }}
            >
              kg
            </span>
          </div>
          {errors.totalQuantity ? (
            <p className="ym-field-error" id="produce-quantity-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.totalQuantity}
            </p>
          ) : maxAvailableKg !== undefined && (
            <span id="produce-quantity-hint" style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              {minAvailableKg && minAvailableKg > 0
                ? `Max batch stock: ${maxAvailableKg} kg (min ${minAvailableKg} kg committed)`
                : `Max batch stock: ${maxAvailableKg} kg`}
            </span>
          )}
        </div>

        {/* Column 2 (28%): Price per kg */}
        <div className="ym-field">
          <label htmlFor="produce-price" className="ym09-field-label">
            <span>Price per kg <span style={{ color: '#b42318' }}>*</span></span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-price"
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 320"
              value={formState.unitPrice}
              onChange={handlePriceInput}
              className="ym-input--unit"
              aria-invalid={errors.unitPrice ? true : undefined}
              aria-describedby={errors.unitPrice ? 'produce-price-error' : 'produce-price-hint'}
              style={{
                height: '48px',
                width: '100%',
                borderRadius: '12px',
                border: `1px solid ${errors.unitPrice ? '#b42318' : 'var(--control-border)'}`,
                padding: '0 64px 0 16px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '15px',
              }}
            />
            <span
              id="produce-price-unit"
              className="ym-unit"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                backgroundColor: 'var(--canvas)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--muted)',
                fontWeight: 500,
              }}
            >
              / kg
            </span>
          </div>
          {errors.unitPrice ? (
            <p className="ym-field-error" id="produce-price-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.unitPrice}
            </p>
          ) : (
            <span id="produce-price-hint" style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Wholesale farmgate price in LKR
            </span>
          )}
        </div>

        {/* Column 3 (44%): Estimated Total Value Card */}
        <div className="ym-field ym09-estimated-value-col">
          <label className="ym09-field-label">
            <Calculator size={14} color="#D97706" aria-hidden="true" />
            <span>Estimated Total Value</span>
          </label>

          <div className="ym09-estimated-value-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            </div>

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

          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Calculated marketplace gross value
          </span>
        </div>
      </div>
    </section>
  );
}
