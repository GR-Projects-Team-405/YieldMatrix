import { useParams, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { buyerRequests, harvestBatches } from './sampleData';
import { formatLkr } from './utils';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));

const matchesProduceAndGrade = (
  batch: (typeof harvestBatches)[number],
  produce: string,
  grade: string,
) =>
  batch.produce.trim().toLowerCase() === produce.trim().toLowerCase() &&
  batch.grade.trim().toLowerCase() === grade.trim().toLowerCase();

export default function BuyerRequestDetails() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const request = buyerRequests.find((item) => item.id === requestId);

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

  const matchingBatches = harvestBatches.filter((batch) =>
    matchesProduceAndGrade(batch, request.produce, request.grade),
  );
  const isClosed = request.status.toLowerCase() === 'closed';

  return (
    <div className="ym10-page">
      <div className="ym10-detail-topbar">
        <Button variant="outline" onClick={() => navigate('/farmer/buyer-requests')}>
          Back to buyer requests
        </Button>
        <StatusBadge status={request.status} />
      </div>

      <ContentCard title="Request details">
        <dl className="ym10-detail-grid">
          <div><dt>Buyer</dt><dd>{request.buyerName}</dd></div>
          <div><dt>Request ID</dt><dd>{request.id}</dd></div>
          <div><dt>District</dt><dd>{request.district}</dd></div>
          <div><dt>Produce and grade</dt><dd>{request.produce} · Grade {request.grade}</dd></div>
          <div><dt>Quantity needed</dt><dd>{request.quantityKg.toLocaleString('en-US')} kg</dd></div>
          <div><dt>Delivery date</dt><dd>{formatDate(request.deliveryDate)}</dd></div>
          <div><dt>Price range</dt><dd>{formatLkr(request.minimumPrice)}–{request.maximumPrice.toLocaleString('en-US')} per kg</dd></div>
          <div className="ym10-detail-grid__wide"><dt>Notes</dt><dd>{request.notes || 'No additional notes.'}</dd></div>
        </dl>
      </ContentCard>

      <ContentCard title="Estimated order value">
        <p className="ym10-value-range">
          {formatLkr(request.quantityKg * request.minimumPrice)} to{' '}
          {formatLkr(request.quantityKg * request.maximumPrice)}
        </p>
        <p className="ym10-muted-note">This is an estimate based on the requested quantity and price range.</p>
      </ContentCard>

      <ContentCard title="Matching stock">
        {matchingBatches.length > 0 ? (
          <ul className="ym10-batch-list">
            {matchingBatches.map((batch) => (
              <li key={batch.id}>
                <strong>{batch.id}</strong>
                <span>{batch.availableQuantityKg.toLocaleString('en-US')} kg</span>
                <span>Available {formatDate(batch.availableDate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Alert type="warning">You have no matching stock for this request</Alert>
        )}
      </ContentCard>

      <div className="ym10-detail-actions">
        <Button
          variant="primary"
          disabled={isClosed || matchingBatches.length === 0}
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
