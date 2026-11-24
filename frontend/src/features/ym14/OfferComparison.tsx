import { Link, useParams } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';

// YM14_02: Offer Comparison (FR-YM14-02)
// Will be fully elaborated in Phase 6.
export default function OfferComparison() {
  const { demandId = 'DM-1042' } = useParams<{ demandId?: string }>();

  return (
    <div className="ym14-container">
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to="/buyer/demands">← Back to Demands</Link> • Demand Ref: {demandId}
          </div>
          <div className="ym14-title-row">
            <h1>Offer Comparison for Demand #{demandId}</h1>
          </div>
        </div>
      </div>

      <ContentCard title="Offer Comparison Matrix (YM14_02)" subtitle="Side-by-side evaluation & recommendation ranking">
        <p className="ym14-prose">
          Evaluating 3 competing producer offers for Fresh Salad Tomatoes (1,500 kg). Offers ranked by pricing benchmark, demand coverage, and grower reliability.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Link to="/buyer/offers/OFF-2026-0842">
            <Button variant="primary">Inspect Best Value Offer (OFF-2026-0842)</Button>
          </Link>
          <Link to="/buyer/commitments">
            <Button variant="outline">View Commitments</Button>
          </Link>
        </div>
      </ContentCard>
    </div>
  );
}
