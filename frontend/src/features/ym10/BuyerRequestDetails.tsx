import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import type { BuyerRequestDetailsResponse } from './types';
import { formatLkr, formatPlainDate, getApiErrorMessage, isNotFoundError } from './utils';

export default function BuyerRequestDetails() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerRequestDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setError(new Error('Missing request ID.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<BuyerRequestDetailsResponse>(
        `/ym10/buyer-requests/${requestId}`,
      );
      setData(response.data);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  if (loading) {
    return <div className="ym10-page"><p className="ym10-placeholder">Loading...</p></div>;
  }

  if (isNotFoundError(error)) {
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

  if (error || !data) {
    return (
      <div className="ym10-page">
        <Alert type="error">
          {getApiErrorMessage(error, 'Could not load this buyer request.')}{' '}
          <Button variant="outline" onClick={() => void loadRequest()}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  const { request, matchingBatches, myOffer } = data;
  const isClosed = Date.now() >= Date.parse(request.expiresAt);
  const hasPendingOffer = myOffer?.status === 'pending';
  const status = hasPendingOffer
    ? 'Offer sent'
    : isClosed
      ? 'Closed'
      : request.closingSoon
        ? 'Closing soon'
        : request.hasMatchingStock
          ? 'Matching'
          : 'Open';

  return (
    <div className="ym10-page">
      <div className="ym10-detail-topbar">
        <Button variant="outline" onClick={() => navigate('/farmer/buyer-requests')}>
          Back to buyer requests
        </Button>
        <StatusBadge status={status} />
      </div>

      {hasPendingOffer && <Alert>You already have a pending offer for this request.</Alert>}

      <ContentCard title="Request details">
        <dl className="ym10-detail-grid">
          <div><dt>Buyer</dt><dd>{request.buyerName}</dd></div>
          <div><dt>Request ID</dt><dd>{request.requestCode}</dd></div>
          <div><dt>District</dt><dd>{request.district}</dd></div>
          <div><dt>Destination</dt><dd>{request.destination || 'Not specified'}</dd></div>
          <div><dt>Produce and grade</dt><dd>{request.cropName} · {request.gradeName}</dd></div>
          <div><dt>Quantity needed</dt><dd>{request.quantityKg.toLocaleString('en-US')} kg</dd></div>
          <div>
            <dt>Delivery window</dt>
            <dd>{formatPlainDate(request.deliveryFrom)} – {formatPlainDate(request.deliveryUntil)}</dd>
          </div>
          <div>
            <dt>Maximum price per kg</dt>
            <dd>{request.maxPricePerKgCents === null ? 'Not specified' : formatLkr(request.maxPricePerKgCents)}</dd>
          </div>
          <div><dt>Partial delivery</dt><dd>{request.allowPartial ? 'Allowed' : 'Not allowed'}</dd></div>
        </dl>
      </ContentCard>

      <ContentCard title="Buyer's budget">
        <p className="ym10-value-range">
          {request.budgetCents === null ? 'Not specified' : formatLkr(request.budgetCents)}
        </p>
        <p className="ym10-muted-note">Buyer&apos;s stated budget for this request.</p>
      </ContentCard>

      <ContentCard title="Matching stock">
        {!request.hasMatchingStock && (
          <Alert type="warning">You have no matching stock for this request.</Alert>
        )}
        {matchingBatches.length > 0 ? (
          <ul className="ym10-batch-list">
            {matchingBatches.map((batch) => (
              <li key={batch.id}>
                <strong>{batch.batchCode}</strong>
                <span>{batch.availableKg.toLocaleString('en-US')} kg</span>
                <span>Harvested {formatPlainDate(batch.harvestDate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ym10-placeholder">No matching batches available.</p>
        )}
      </ContentCard>

      <div className="ym10-detail-actions">
        <Button
          variant="primary"
          disabled={isClosed || !request.hasMatchingStock || matchingBatches.length === 0 || hasPendingOffer}
          onClick={() => navigate(`/farmer/buyer-requests/${request.id}/offer`)}
        >
          Submit offer
        </Button>
        <Button variant="outline" onClick={() => navigate('/farmer/buyer-requests')}>
          Back
        </Button>
      </div>
    </div>
  );
}
