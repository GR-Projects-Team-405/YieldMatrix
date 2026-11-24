import { Link, useParams } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';

// YM14_05: Harvest Change Review (FR-YM14-05)
// Will be fully elaborated in Phase 6.
export default function HarvestChangeReview() {
  const { id = 'c1041' } = useParams<{ id?: string }>();

  return (
    <div className="ym14-container">
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to="/buyer/commitments">← Back to Commitments</Link> • Review Change Ref: {id.toUpperCase()}
          </div>
          <div className="ym14-title-row">
            <h1>Harvest Change Review ({id.toUpperCase()})</h1>
          </div>
        </div>
      </div>

      <ContentCard title="Pre-Harvest Modification Diff (YM14_05)" subtitle="Side-by-side parameter variance & escrow adjustment">
        <p className="ym14-prose">
          Grower submitted a yield adjustment (-120 kg, +4 days delay). Review the agronomic justification and financial refund.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Link to="/buyer/commitments">
            <Button variant="outline">Back to Commitments</Button>
          </Link>
          <Link to="/buyer/offers/OFF-2026-0842">
            <Button variant="primary">View Received Offer Details</Button>
          </Link>
        </div>
      </ContentCard>
    </div>
  );
}
