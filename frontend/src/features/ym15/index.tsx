import { useState } from 'react';
import api from '../../services/api';
import { BulkMatchingRequestPage } from './BulkMatchingRequestPage';
import { CompleteMatchResultsPage } from './CompleteMatchResultsPage';
import { GrowerAllocationBreakdownPage } from './GrowerAllocationBreakdownPage';
import { PartialMatchShortagePage } from './PartialMatchShortagePage';
import type {
  BulkMatchRequestInput,
  BulkMatchResponseData,
  ValidatedBulkMatchRequest,
} from './types';

type ActiveScreen = 'request' | 'results' | 'breakdown' | 'partial';

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
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('request');

  const handleSubmitRequest = async (payload: ValidatedBulkMatchRequest) => {
    setSubmitting(true);
    setFeedbackMessage('');

    try {
      const { data } = await api.post<BulkMatchResponseData>('/ym15/match', payload);
      setMatchResult(data);
      if (data.status === 'partial' && data.matchedKg > 0) {
        setActiveScreen('partial');
      } else {
        setActiveScreen('results');
      }
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

  if (matchResult && activeScreen === 'partial') {
    return (
      <PartialMatchShortagePage
        data={matchResult}
        onBackToRequest={() => {
          setMatchResult(null);
          setActiveScreen('request');
          setFeedbackMessage('');
        }}
        onAcceptPartialPlan={() => {
          setActiveScreen('breakdown');
        }}
      />
    );
  }

  if (matchResult && activeScreen === 'breakdown') {
    return (
      <GrowerAllocationBreakdownPage
        data={matchResult}
        onBackToResults={() => {
          setActiveScreen(matchResult.status === 'partial' ? 'partial' : 'results');
        }}
        onContinue={() => {
          setActiveScreen('request');
          setMatchResult(null);
          setFeedbackType('success');
          setFeedbackMessage(
            matchResult.status === 'partial'
              ? 'Partial allocation plan reviewed and ready for the next step.'
              : 'Allocation breakdown reviewed. Ready for the next step or a new bulk matching request.'
          );
        }}
      />
    );
  }

  if (matchResult && activeScreen === 'results') {
    return (
      <CompleteMatchResultsPage
        data={matchResult}
        onBackToRequest={() => {
          setMatchResult(null);
          setActiveScreen('request');
          setFeedbackMessage('');
        }}
        onViewAllocationBreakdown={() => {
          setActiveScreen('breakdown');
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