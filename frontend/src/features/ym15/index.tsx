import { useState } from 'react';
import { BulkMatchingRequestPage } from './BulkMatchingRequestPage';
import type { BulkMatchRequestInput, ValidatedBulkMatchRequest } from './types';

export default function YM15() {
  const [formValues, setFormValues] = useState<BulkMatchRequestInput>({
    crop: 'Tomato',
    grade: 'Grade A',
    requiredKg: '1000',
    destination: 'Colombo',
    deliveryWindow: '12 Nov 2026 - 08:00 - 12:00',
    maxBudgetLkr: '',
    allowPartial: 'yes',
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'warning' | 'error' | 'info'>('info');

  const handleSubmitRequest = async (payload: ValidatedBulkMatchRequest) => {
    setSubmitting(true);
    setFeedbackMessage('');

    try {
      setFeedbackType('success');
      setFeedbackMessage(
        `Bulk matching request validated: ${payload.requiredKg} kg of ${payload.crop} (${payload.grade}) to ${payload.destination}.`
      );
    } catch {
      setFeedbackType('error');
      setFeedbackMessage('Could not validate the bulk matching request. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BulkMatchingRequestPage
      values={formValues}
      onChange={setFormValues}
      onSubmitRequest={handleSubmitRequest}
      submitting={submitting}
      feedbackMessage={feedbackMessage}
      feedbackType={feedbackType}
    />
  );
}