import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import type { BuyerRequestDetailsResponse, SubmitOfferResponse } from './types';
import { formatLkr, formatPlainDate, getApiErrorMessage, isNotFoundError } from './utils';

type OfferErrors = {
  batchId?: string;
  quantity?: string;
  price?: string;
};

export default function SubmitOffer() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerRequestDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<OfferErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submissionInProgress = useRef(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setLoadError(new Error('Missing request ID.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get<BuyerRequestDetailsResponse>(
        `/ym10/buyer-requests/${requestId}`,
      );
      setData(response.data);
    } catch (requestError) {
      setLoadError(requestError);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  const matchingBatches = data?.matchingBatches ?? [];
  const selectedBatch = matchingBatches.find((batch) => batch.id === batchId);
  const quantityValue = Number(quantity) || 0;
  const priceValue = Number(price) || 0;
  const totalValue = quantityValue * priceValue;
  const priceAboveMaximum =
    data?.request.maxPricePerKgCents !== null &&
    data?.request.maxPricePerKgCents !== undefined &&
    priceValue > 0 &&
    priceValue * 100 > data.request.maxPricePerKgCents;
  const maximumPricePerKgCents = data?.request.maxPricePerKgCents;
  const isClosed = data ? Date.now() >= Date.parse(data.request.expiresAt) : false;
  const hasPendingOffer = data?.myOffer?.status === 'pending';

  const clearFieldError = (field: keyof OfferErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const validate = (): boolean => {
    if (!data) return false;
    const nextErrors: OfferErrors = {};
    if (!batchId) {
      nextErrors.batchId = 'Select a harvest batch.';
    }
    if (!quantity || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      nextErrors.quantity = 'Enter a quantity greater than 0.';
    } else if (!/^(?:\d+|\d*\.\d{1,3})$/.test(quantity)) {
      nextErrors.quantity = 'Use no more than 3 decimal places.';
    } else if (selectedBatch && quantityValue > selectedBatch.availableKg) {
      nextErrors.quantity = `Quantity cannot exceed ${selectedBatch.availableKg} kg available in this batch.`;
    }
    if (!price || !Number.isFinite(priceValue) || priceValue <= 0) {
      nextErrors.price = 'Enter a price greater than 0.';
    } else if (!Number.isInteger(priceValue)) {
      nextErrors.price = 'Enter a whole LKR amount.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    if (validate()) setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    if (!data || submissionInProgress.current) return;
    submissionInProgress.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const body = {
        batchId,
        quantityKg: quantityValue,
        pricePerKgLkr: priceValue,
      };
      await api.post<SubmitOfferResponse>(
        `/ym10/buyer-requests/${data.request.id}/offers`,
        body,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      setConfirmOpen(false);
      navigate('/farmer/offers', { state: { toastMessage: 'Offer submitted' } });
    } catch (requestError) {
      setConfirmOpen(false);
      setSubmitError(getApiErrorMessage(requestError, 'We could not submit your offer. Please try again.'));
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  };

  const offerSummary = `${quantityValue || 0} kg at ${formatLkr((priceValue || 0) * 100)} per kg, total ${formatLkr(totalValue * 100)}.`;

  if (loading) {
    return <div className="ym10-page"><p className="ym10-placeholder">Loading...</p></div>;
  }

  if (isNotFoundError(loadError)) {
    return (
      <div className="ym10-page">
        <EmptyState
          title="Request not found"
          description="This buyer request may no longer be available."
          action={
            <Button variant="outline" onClick={() => navigate('/farmer/buyer-requests')}>
              Back
            </Button>
          }
        />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="ym10-page">
        <Alert type="error">
          {getApiErrorMessage(loadError, 'Could not load this buyer request.')}{' '}
          <Button variant="outline" onClick={() => void loadRequest()}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  const request = data.request;
  const offerSummaryText = `${request.requestCode}: ${offerSummary}`;

  return (
    <div className="ym10-page ym10-offer-layout">
      {/* Available from and Notes are omitted until the offers table has those columns. */}
      <form className="ym10-offer-form" onSubmit={handleSubmit} noValidate>
        {submitError && <Alert type="error">{submitError}</Alert>}
        {isClosed && <Alert type="warning">This request is closed and is no longer accepting offers.</Alert>}
        {!request.hasMatchingStock && (
          <Alert type="warning">You have no matching stock for this request.</Alert>
        )}
        {hasPendingOffer && <Alert>You already have a pending offer for this request.</Alert>}
        <ContentCard title="Submit offer">
          {priceAboveMaximum && maximumPricePerKgCents !== null && maximumPricePerKgCents !== undefined && (
            <div className="ym10-price-warning">
              <Alert type="warning">
                Your price is above the buyer&apos;s maximum of{' '}
                {formatLkr(maximumPricePerKgCents)} per kg.
              </Alert>
            </div>
          )}
          <div className="ym10-form-fields">
            <SelectField
              label="Harvest batch"
              value={batchId}
              error={errors.batchId}
              onChange={(event) => {
                setBatchId(event.target.value);
                clearFieldError('batchId');
                setErrors((current) => ({ ...current, quantity: undefined }));
              }}
              options={[
                { value: '', label: 'Select a matching batch' },
                ...matchingBatches.map((batch) => ({
                  value: batch.id,
                  label: `${batch.batchCode} · ${batch.availableKg} kg available · harvested ${formatPlainDate(batch.harvestDate)}`,
                })),
              ]}
            />
            <InputField
              label="Quantity offered"
              type="number"
              min="0"
              max={selectedBatch?.availableKg}
              step="0.001"
              unit="kg"
              value={quantity}
              error={errors.quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                clearFieldError('quantity');
              }}
            />
            <InputField
              label="Price per kg"
              type="number"
              min="0"
              step="1"
              unit="LKR"
              value={price}
              error={errors.price}
              onChange={(event) => {
                setPrice(event.target.value);
                clearFieldError('price');
              }}
            />
          </div>
          <div className="ym10-offer-info">
            <Alert>Your offer is sent to the buyer and can be tracked under My offers.</Alert>
          </div>
          <div className="ym10-detail-actions">
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => navigate(`/farmer/buyer-requests/${request.id}`)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submitting || isClosed || !request.hasMatchingStock || matchingBatches.length === 0 || hasPendingOffer}
            >
              Submit offer
            </Button>
          </div>
        </ContentCard>
      </form>

      <ContentCard title="Offer summary" className="ym10-offer-summary">
        <dl className="ym10-summary-list">
          <div><dt>Request</dt><dd>{request.requestCode} · {request.buyerName}</dd></div>
          <div><dt>Produce</dt><dd>{request.cropName} · {request.gradeName}</dd></div>
          <div><dt>Quantity offered</dt><dd>{quantityValue > 0 ? `${quantityValue} kg` : '—'}</dd></div>
          <div><dt>Price per kg</dt><dd>{priceValue > 0 ? `${formatLkr(priceValue * 100)} per kg` : '—'}</dd></div>
          <div><dt>Total offer value</dt><dd className="ym10-value-range">{formatLkr(totalValue * 100)}</dd></div>
        </dl>
      </ContentCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit this offer?"
        description={offerSummaryText}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirmSubmit()}
        confirmLabel="Submit offer"
        busy={submitting}
      />
    </div>
  );
}
