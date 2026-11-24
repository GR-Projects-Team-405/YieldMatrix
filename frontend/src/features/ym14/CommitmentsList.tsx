import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';

// YM14_03: Commitments List (FR-YM14-03)
// Will be fully elaborated in Phase 6.
export default function CommitmentsList() {
  return (
    <div className="ym14-container">
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-title-row">
            <h1>Produce Commitments & Forward Contracts</h1>
          </div>
        </div>
      </div>

      <ContentCard title="Commitments Directory (YM14_03)" subtitle="Active harvest escrow reservations & fulfilment tracking">
        <p className="ym14-prose">
          Tracking 8 commitments (6 active, 1 requiring action, LKR 1,180,250 held in escrow).
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Link to="/buyer/commitments/c1041/change-review">
            <Button variant="secondary">Review Pending Harvest Change (COM-1041)</Button>
          </Link>
          <Link to="/buyer/commitments/c1042">
            <Button variant="outline">View Commitment Details (COM-1042)</Button>
          </Link>
          <Link to="/buyer/offers/OFF-2026-0842">
            <Button variant="outline">View Received Offer (OFF-2026-0842)</Button>
          </Link>
        </div>
      </ContentCard>
    </div>
  );
}
