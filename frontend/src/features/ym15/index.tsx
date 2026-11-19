import { useState } from 'react';
import api from '../../services/api';
import { BulkMatchingRequestPage } from './BulkMatchingRequestPage';
import { CompleteMatchResultsPage } from './CompleteMatchResultsPage';
import type {
  BulkMatchRequestInput,
  BulkMatchResponseData,
  ValidatedBulkMatchRequest,
} from './types';

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
  const [matchResult, setMatchResult] = useState<BulkMatchResponseData | null>(null);

  const handleSubmitRequest = async (payload: ValidatedBulkMatchRequest) => {
    setSubmitting(true);
    setFeedbackMessage('');

    try {
      const { data } = await api.post<BulkMatchResponseData>('/ym15/match', payload);
      setMatchResult(data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not run bulk matching against the backend API.';
      setFeedbackType('error');
      setFeedbackMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (matchResult) {
    return (
      <CompleteMatchResultsPage
        data={matchResult}
        onBackToRequest={() => {
          setMatchResult(null);
          setFeedbackMessage('');
        }}
        onViewAllocationBreakdown={() => {
          setMatchResult(null);
          setFeedbackType('info');
          setFeedbackMessage(
            'Grower allocation breakdown screen will be added when its UI design is provided.'
          );
        }}
      />
    );
  }

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