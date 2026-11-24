import { Link, useParams } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';

// YM14_04: Commitment Details (FR-YM14-04)
// Will be fully elaborated in Phase 6.
export default function CommitmentDetails() {
  const { id = 'c1042' } = useParams<{ id?: string }>();

  return (
    <div className="ym14-container">
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to="/buyer/commitments">← Back to Commitments</Link> • Commitment Ref: {id.toUpperCase()}
          </div>
          <div className="ym14-title-row">
            <h1>Commitment Details ({id.toUpperCase()})</h1>
          </div>
        </div>
      </div>

      <ContentCard title="Forward Contract Specifications (YM14_04)" subtitle="4-Stage harvest stepper, specifications & audit anchor">
        <p className="ym14-prose">
          Tracking batch allocation and escrow hold for Fresh Salad Tomatoes (1,000 kg).
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Link to="/buyer/commitments">
            <Button variant="outline">Back to Commitments</Button>
          </Link>
          <Link to="/buyer/commitments/c1041/change-review">
            <Button variant="secondary">Review Change Proposal (COM-1041)</Button>
          </Link>
        </div>
      </ContentCard>
    </div>
  );
}
