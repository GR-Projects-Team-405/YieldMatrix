import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { addSubmittedOffer, buyerRequests, harvestBatches } from './sampleData';
import { formatLkr } from './utils';

type OfferErrors = {
  batchId?: string;
  quantity?: string;
  price?: string;
  availableFrom?: string;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));

export default function SubmitOffer() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const request = buyerRequests.find((item) => item.id === requestId);
  const matchingBatches = useMemo(
    () =>
      request
        ? harvestBatches.filter(
            (batch) =>
              batch.produce.trim().toLowerCase() === request.produce.trim().toLowerCase() &&
              batch.grade.trim().toLowerCase() === request.grade.trim().toLowerCase(),
          )
        : [],
    [request],
  );
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<OfferErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedBatch = matchingBatches.find((batch) => batch.id === batchId);
  const quantityValue = Number(quantity) || 0;
  const priceValue = Number(price) || 0;
  const totalValue = quantityValue * priceValue;
  const priceOutsideRange =
    request !== undefined &&
    priceValue > 0 &&
    (priceValue < request.minimumPrice || priceValue > request.maximumPrice);

  const clearFieldError = (field: keyof OfferErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  if (!request) {
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

  const validate = (): boolean => {
    const nextErrors: OfferErrors = {};
    if (!batchId) {
      nextErrors.batchId = 'Select a harvest batch.';
    }
    if (!quantity || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      nextErrors.quantity = 'Enter a quantity greater than 0.';
    } else if (!/^(?:\d+|\d*\.\d{1,3})$/.test(quantity)) {
      nextErrors.quantity = 'Use no more than 3 decimal places.';
    } else if (selectedBatch && quantityValue > selectedBatch.availableQuantityKg) {
      nextErrors.quantity = `Quantity cannot exceed ${selectedBatch.availableQuantityKg} kg available in this batch.`;
    }
    if (!price || !Number.isFinite(priceValue) || priceValue <= 0) {
      nextErrors.price = 'Enter a price greater than 0.';
    } else if (!Number.isInteger(priceValue)) {
      nextErrors.price = 'Enter a whole LKR amount.';
    }
    if (!availableFrom) {
      nextErrors.availableFrom = 'Choose an available-from date.';
    } else if (availableFrom > request.deliveryDate) {
      nextErrors.availableFrom = `Choose a date on or before ${formatDate(request.deliveryDate)}.`;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    if (validate()) setConfirmOpen(true);
  };

  const confirmSubmit = () => {
    try {
      setConfirmOpen(false);
      addSubmittedOffer({
        requestId: request.id,
        buyerName: request.buyerName,
        produce: request.produce,
        grade: request.grade,
        quantityKg: quantityValue,
        pricePerKg: priceValue,
        notes: notes.trim() || undefined,
      });
      navigate('/farmer/offers', { state: { toastMessage: 'Offer submitted' } });
    } catch {
      setConfirmOpen(false);
      setSubmitError('We could not submit your offer. Please try again.');
    }
  };

  const offerSummary = `${quantityValue || 0} kg at ${formatLkr(priceValue || 0)} per kg, total ${formatLkr(totalValue)}.${notes.trim() ? ` Note: ${notes.trim()}` : ''}`;

  return (
    <div className="ym10-page ym10-offer-layout">
      <form className="ym10-offer-form" onSubmit={handleSubmit} noValidate>
        {submitError && <Alert type="error">{submitError}</Alert>}
        {request.status.toLowerCase() === 'closed' && (
          <Alert type="warning">This request is closed and is no longer accepting offers.</Alert>
        )}
        {matchingBatches.length === 0 && (
          <Alert type="warning">You have no matching stock for this request</Alert>
        )}
        <ContentCard title="Submit offer">
          {priceOutsideRange && (
            <div className="ym10-price-warning">
              <Alert type="warning">
                Your price is outside the buyer&apos;s range of {formatLkr(request.minimumPrice)}-
                {request.maximumPrice.toLocaleString('en-US')} per kg.
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
                  label: `${batch.id} · ${batch.availableQuantityKg} kg available`,
                })),
              ]}
            />
            <InputField
              label="Quantity offered"
              type="number"
              min="0"
              max={selectedBatch?.availableQuantityKg}
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
            <InputField
              label="Available from"
              type="date"
              max={request.deliveryDate}
              value={availableFrom}
              error={errors.availableFrom}
              onChange={(event) => {
                setAvailableFrom(event.target.value);
                clearFieldError('availableFrom');
              }}
            />
            <InputField
              label="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note for the buyer"
            />
          </div>
          <div className="ym10-offer-info">
            <Alert>Your offer is sent to the buyer and can be tracked under My offers.</Alert>
          </div>
          <div className="ym10-detail-actions">
            <Button
              variant="outline"
              onClick={() => navigate(`/farmer/buyer-requests/${request.id}`)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={request.status.toLowerCase() === 'closed' || matchingBatches.length === 0}
            >
              Submit offer
            </Button>
          </div>
        </ContentCard>
      </form>

      <ContentCard title="Offer summary" className="ym10-offer-summary">
        <dl className="ym10-summary-list">
          <div><dt>Request</dt><dd>{request.id} · {request.buyerName}</dd></div>
          <div><dt>Produce</dt><dd>{request.produce} · Grade {request.grade}</dd></div>
          <div><dt>Quantity offered</dt><dd>{quantityValue > 0 ? `${quantityValue} kg` : '—'}</dd></div>
          <div><dt>Price per kg</dt><dd>{priceValue > 0 ? `${formatLkr(priceValue)} per kg` : '—'}</dd></div>
          <div><dt>Total offer value</dt><dd className="ym10-value-range">{formatLkr(totalValue)}</dd></div>
        </dl>
      </ContentCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit this offer?"
        description={`${request.id}: ${offerSummary}${availableFrom ? ` Available from ${formatDate(availableFrom)}.` : ''}`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmSubmit}
        confirmLabel="Submit offer"
      />
    </div>
  );
}
