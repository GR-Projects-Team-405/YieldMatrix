import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import type { BulkMatchRequestInput, ValidatedBulkMatchRequest } from './types';
import './ym15.css';

const CROP_OPTIONS = [
  { value: 'Tomato', label: 'Tomato' },
  { value: 'Carrot', label: 'Carrot' },
  { value: 'Cabbage', label: 'Cabbage' },
  { value: 'Potato', label: 'Potato' },
  { value: 'Beans', label: 'Beans' },
];

const GRADE_OPTIONS = [
  { value: 'Grade A', label: 'Grade A' },
  { value: 'Grade B', label: 'Grade B' },
  { value: 'Grade C', label: 'Grade C' },
];

const DISTRICT_OPTIONS = [
  { value: 'Colombo', label: 'Colombo' },
  { value: 'Colombo Wholesale Market', label: 'Colombo Wholesale Market' },
  { value: 'Kandy', label: 'Kandy' },
  { value: 'Gampaha', label: 'Gampaha' },
  { value: 'Kurunegala', label: 'Kurunegala' },
  { value: 'Nuwara Eliya', label: 'Nuwara Eliya' },
];

const MATCHING_RULES = [
  'Approved growers only',
  'Active produce listings',
  'Matching crop and grade',
  'Available unreserved stock',
  'Compatible delivery window',
  'Serviceable destination',
];

interface BulkMatchingRequestPageProps {
  values: BulkMatchRequestInput;
  onChange: (next: BulkMatchRequestInput) => void;
  onSubmitRequest: (payload: ValidatedBulkMatchRequest) => Promise<void> | void;
  submitting?: boolean;
  feedbackMessage?: string;
  feedbackType?: 'success' | 'warning' | 'error' | 'info';
}

function hasValidThreeDecimalPrecision(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return false;
  const parts = trimmed.split('.');
  return parts.length === 1 || parts[1].length <= 3;
}

function SummaryDocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" strokeLinejoin="round" />
      <path d="M14 3v6h6" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20v-8" strokeLinecap="round" />
      <path d="M12 14c0-4-3.5-7-8-7 0 4.5 3 8 8 7Z" strokeLinejoin="round" />
      <path d="M12 12c0-3.5 3-6.5 7.5-6.5 0 4-2.5 7-7.5 6.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 8.5V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8.5a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z" strokeLinejoin="round" />
      <path d="m3.3 7 8.7 5 8.7-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22V12" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s7-5.35 7-11.5a7 7 0 1 0-14 0C5 15.65 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

export function BulkMatchingRequestPage({
  values,
  onChange,
  onSubmitRequest,
  submitting = false,
  feedbackMessage = '',
  feedbackType = 'info',
}: BulkMatchingRequestPageProps) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BulkMatchRequestInput, string>>>({});

  const updateField = <K extends keyof BulkMatchRequestInput>(key: K, val: BulkMatchRequestInput[K]) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    onChange({ ...values, [key]: val });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Partial<Record<keyof BulkMatchRequestInput, string>> = {};

    if (!values.crop.trim()) nextErrors.crop = 'Please select a crop.';
    if (!values.grade.trim()) nextErrors.grade = 'Please select a grade.';

    if (!hasValidThreeDecimalPrecision(values.requiredKg)) {
      nextErrors.requiredKg = 'Enter a valid quantity in kg (greater than 0, up to 3 decimal places).';
    }

    if (!values.destination.trim()) {
      nextErrors.destination = 'Please select a serviceable destination district.';
    }

    if (!values.deliveryWindow.trim()) {
      nextErrors.deliveryWindow = 'Please enter a delivery window.';
    }

    let parsedBudget: number | null = null;
    if (values.maxBudgetLkr.trim() !== '') {
      const budgetNum = Number(values.maxBudgetLkr.trim());
      if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
        nextErrors.maxBudgetLkr = 'Maximum goods total must be greater than 0 LKR.';
      } else {
        parsedBudget = budgetNum;
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmitRequest({
      crop: values.crop,
      grade: values.grade,
      requiredKg: Number(values.requiredKg.trim()),
      destination: values.destination,
      deliveryWindow: values.deliveryWindow.trim(),
      maxBudgetLkr: parsedBudget,
      allowPartial: values.allowPartial === 'yes',
    });
  };

  const handleCancel = () => {
    setFieldErrors({});
    onChange({
      crop: 'Tomato',
      grade: 'Grade A',
      requiredKg: '1000',
      destination: 'Colombo',
      deliveryWindow: '12 Nov 2026 - 08:00 - 12:00',
      maxBudgetLkr: '',
      allowPartial: 'yes',
    });
  };

  const formattedQty = values.requiredKg.trim() ? `${values.requiredKg.trim()} kg` : '—';
  const formattedBudget = values.maxBudgetLkr.trim()
    ? `LKR ${Number(values.maxBudgetLkr).toLocaleString()}`
    : 'No limit set';

  return (
    <div className="ym15-page">
      <p className="ym15-lead-copy">
        <span>Find suitable harvests from multiple growers to fulfil your bulk order.</span>
        <span>Create a request and let YieldMatrix find the best available harvest combinations.</span>
      </p>

      {feedbackMessage && (
        <div className="ym15-alert-wrap">
          <Alert type={feedbackType}>{feedbackMessage}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="ym15-grid">
          <ContentCard title="Request details" subtitle="Find suitable harvests for your order.">
            <div className="ym15-form-stack">
              <SelectField
                label="Crop"
                options={CROP_OPTIONS}
                value={values.crop}
                error={fieldErrors.crop}
                onChange={(e) => updateField('crop', e.target.value)}
              />

              <SelectField
                label="Grade"
                options={GRADE_OPTIONS}
                value={values.grade}
                error={fieldErrors.grade}
                onChange={(e) => updateField('grade', e.target.value)}
              />

              <InputField
                label="Required quantity"
                type="number"
                step="0.001"
                min="0.001"
                unit="kg"
                placeholder="1000"
                value={values.requiredKg}
                error={fieldErrors.requiredKg}
                onChange={(e) => updateField('requiredKg', e.target.value)}
              />

              <SelectField
                label="Destination"
                options={DISTRICT_OPTIONS}
                value={values.destination}
                error={fieldErrors.destination}
                onChange={(e) => updateField('destination', e.target.value)}
              />

              <InputField
                label="Delivery window"
                type="text"
                placeholder="e.g. 2026-11-25 08:00 - 12:00"
                value={values.deliveryWindow}
                error={fieldErrors.deliveryWindow}
                onChange={(e) => updateField('deliveryWindow', e.target.value)}
              />

              <InputField
                label="Maximum goods total (optional)"
                type="number"
                step="0.01"
                min="0.01"
                unit="LKR"
                placeholder="Optional budget cap"
                value={values.maxBudgetLkr}
                error={fieldErrors.maxBudgetLkr}
                onChange={(e) => updateField('maxBudgetLkr', e.target.value)}
              />

              <SelectField
                label="Allow partial fulfilment"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                value={values.allowPartial}
                onChange={(e) => updateField('allowPartial', e.target.value as 'yes' | 'no')}
              />
            </div>
          </ContentCard>

          <aside className="ym15-side-column">
            <ContentCard
              title="Matching preferences"
              subtitle="The system will consider these conditions when selecting growers."
            >
              <ul className="ym15-rules-list">
                {MATCHING_RULES.map((rule) => (
                  <li key={rule} className="ym15-rule-item">
                    <span className="ym15-rule-check" aria-hidden="true">
                      ✓
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>

              <ContentCard className="ym15-summary-box">
                <div className="ym15-summary-title-wrap">
                  <span className="ym15-summary-icon">
                    <SummaryDocIcon />
                  </span>
                  <h2>Request summary</h2>
                </div>
                <dl className="ym15-summary-list">
                  <div className="ym15-summary-row">
                    <div className="ym15-summary-label">
                      <span className="ym15-summary-icon">
                        <SproutIcon />
                      </span>
                      <dt>Crop &amp; Grade:</dt>
                    </div>
                    <dd>
                      {values.crop || '—'} · {values.grade || '—'}
                    </dd>
                  </div>
                  <div className="ym15-summary-row">
                    <div className="ym15-summary-label">
                      <span className="ym15-summary-icon">
                        <BoxIcon />
                      </span>
                      <dt>Required quantity:</dt>
                    </div>
                    <dd>{formattedQty}</dd>
                  </div>
                  <div className="ym15-summary-row">
                    <div className="ym15-summary-label">
                      <span className="ym15-summary-icon">
                        <PinIcon />
                      </span>
                      <dt>Destination:</dt>
                    </div>
                    <dd>{values.destination || '—'}</dd>
                  </div>
                  <div className="ym15-summary-row">
                    <div className="ym15-summary-label">
                      <span className="ym15-summary-icon">
                        <WalletIcon />
                      </span>
                      <dt>Budget:</dt>
                    </div>
                    <dd>{formattedBudget}</dd>
                  </div>
                </dl>
              </ContentCard>

              <div className="ym15-note-wrap">
                <Alert type="info">
                  Matching results are recommendations. Stock is not reserved at this stage.
                </Alert>
              </div>
            </ContentCard>

            <div className="ym15-actions">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="ym15-submit-btn" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Continue'}
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}