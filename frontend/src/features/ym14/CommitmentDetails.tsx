import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Toast } from '../../components/Toast';
import { Alert } from '../../components/Alert';
import { downloadAgreementPdf } from './pdfGenerator';
import type { CommitmentDetail } from './types';

export default function CommitmentDetails() {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();

  const [commitment, setCommitment] = useState<CommitmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const rolePrefix = user?.role === 'farmer' ? '/farmer' : '/buyer';

  useEffect(() => {
    let mounted = true;
    async function loadCommitment() {
      if (!id) {
        if (mounted) {
          setErrorMsg('No commitment ID specified.');
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.get(`/ym14/commitments/${id}`);
        if (mounted && res.data?.commitment) {
          setCommitment(res.data.commitment);
        } else if (mounted) {
          setCommitment(null);
          setErrorMsg('Commitment record not found in the database.');
        }
      } catch (err: any) {
        if (mounted) {
          setCommitment(null);
          setErrorMsg(
            err?.response?.status === 404
              ? 'Commitment record not found in the database.'
              : 'Unable to load commitment details from the database.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCommitment();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="ym14-container">
        <ContentCard>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Loading commitment specifications from database…</p>
        </ContentCard>
      </div>
    );
  }

  if (!commitment) {
    return (
      <div className="ym14-container">
        <div className="ym14-breadcrumb" style={{ marginBottom: '16px' }}>
          <Link to={`${rolePrefix}/commitments`}>← Back to Commitments List</Link>
        </div>
        <ContentCard>
          <Alert type="error">{errorMsg || 'Commitment record not found.'}</Alert>
        </ContentCard>
      </div>
    );
  }

  return (
    <div className="ym14-container">
      {/* Toast Alert */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Top Header */}
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to={`${rolePrefix}/commitments`}>← Back to Commitments List</Link>
            <span>•</span>
            <span>Contract Ref: {commitment.reference}</span>
          </div>
          <div className="ym14-title-row">
            <h1>Commitment Details: {commitment.reference}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <StatusBadge status={commitment.status ? commitment.status.replace(/_/g, ' ') : 'Proposed'} />
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
            {commitment.hasChangePending ? '⚠️ Modification Pending Review' : 'No change pending'}
          </span>
        </div>
      </div>

      {/* Mandatory SRS Rule Banner (Callout) */}
      <aside className="ym14-rule-banner" aria-label="SRS Rule Notice">
        <div className="ym14-rule-content">
          <span className="ym14-rule-icon" aria-hidden="true">
            📌
          </span>
          <div>
            <strong>MANDATORY SRS RULE:</strong> A future commitment does NOT reserve sellable stock.
            Conversion to an order allocation occurs only after actual harvest is recorded at hub intake.
          </div>
        </div>
      </aside>

      {/* Horizontal Meta Strip */}
      <div className="ym14-summary-bar" style={{ marginBottom: '24px' }}>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Linked Demand</span>
          <span className="ym14-summary-value">
            #{commitment.linkedDemand.reference} ({commitment.linkedDemand.title})
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Originating Offer</span>
          <span className="ym14-summary-value">
            #{commitment.originatingOffer.reference} ({commitment.originatingOffer.supplierName})
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Order Allocation</span>
          <span className="ym14-summary-value" style={{ color: '#b56208' }}>
            {commitment.orderAllocationStatus}
          </span>
        </div>
      </div>

      {/* 4-Stage Stepper Card */}
      <section className="ym14-stepper-card" aria-label="Commitment Lifecycle Progress">
        <div className="ym14-stepper">
          {commitment.stepper.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';

            return (
              <div key={step.step} className="ym14-step-item">
                <div
                  className={`ym14-step-circle ${
                    isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? '✓' : step.step}
                </div>
                <div className="ym14-step-text">
                  <span className="ym14-step-title">{step.title}</span>
                  <span className="ym14-step-subtitle">{step.subtitle}</span>
                </div>
                {idx < commitment.stepper.length - 1 && (
                  <div
                    className={`ym14-step-line ${
                      isCompleted ? 'completed' : ''
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Content Grid */}
      <div className="ym14-grid-2col">
        {/* Left Column: Specifications & Audit Anchor */}
        <div className="ym14-column-main">
          {/* Card 1: Contract Summary & Specifications */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Contract Summary &amp; Specifications</h2>
            </div>

            <table className="ym14-spec-table">
              <tbody>
                <tr>
                  <td className="label">Commitment Reference ID</td>
                  <td className="value">
                    {commitment.reference} (Hash: {commitment.contractHash})
                  </td>
                </tr>
                <tr>
                  <td className="label">Buyer / Shop Workspace</td>
                  <td className="value">{commitment.specs.buyerWorkspace}</td>
                </tr>
                <tr>
                  <td className="label">Farmer / Supplier</td>
                  <td className="value">{commitment.specs.supplierName}</td>
                </tr>
                <tr>
                  <td className="label">Planned Field Batch</td>
                  <td className="value">{commitment.specs.plannedFieldBatch}</td>
                </tr>
                <tr>
                  <td className="label">Expected Quantity</td>
                  <td className="value">
                    {commitment.specs.expectedKg.toLocaleString()} kg net volume
                  </td>
                </tr>
                <tr>
                  <td className="label">Agreed Price per Unit</td>
                  <td className="value">
                    LKR {(commitment.specs.agreedPricePerKgCents / 100).toFixed(2)} / kg
                  </td>
                </tr>
                <tr>
                  <td className="label">Expected Total Value</td>
                  <td className="value">
                    LKR {(commitment.specs.expectedTotalCents / 100).toLocaleString()} (Agri Wallet Escrow)
                  </td>
                </tr>
                <tr>
                  <td className="label">Target Harvest Window</td>
                  <td className="value">{commitment.specs.targetHarvestWindow}</td>
                </tr>
                <tr>
                  <td className="label">Cancellation Terms</td>
                  <td className="value">{commitment.specs.cancellationTerms}</td>
                </tr>
              </tbody>
            </table>
          </ContentCard>

          {/* Card 2: Revision & Decision History Timeline */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Revision &amp; Decision History Timeline</h2>
              <span className="ym14-tag-pill green">Original terms locked</span>
            </div>

            <div className="ym14-audit-box">
              <div className="ym14-audit-label">
                <span aria-hidden="true">🔒</span>
                <span>ORIGINAL AGREED TERMS (AUDIT ANCHOR)</span>
              </div>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {commitment.originalTermsAnchor.summaryText}
              </p>
            </div>
          </ContentCard>
        </div>

        {/* Right Column: Escrow, Logistics, and Actions */}
        <div className="ym14-column-side">
          {/* Card 1: Escrow & Agri Wallet Status */}
          <ContentCard>
            <div className="ym14-card-header" style={{ marginBottom: '12px' }}>
              <h2>Escrow &amp; Agri Wallet Status</h2>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span className="ym14-verified-badge" style={{ height: '26px' }}>
                Funds Held in Escrow
              </span>
            </div>

            <div className="ym14-spec-box" style={{ padding: '16px', marginBottom: '14px' }}>
              <span className="ym14-spec-label">ESCROW BALANCE HELD</span>
              <span className="ym14-spec-value" style={{ fontSize: '28px', color: 'var(--accent-text)' }}>
                LKR {(commitment.escrowStatus.balanceHeldCents / 100).toLocaleString()}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5', margin: '0' }}>
              {commitment.escrowStatus.releaseTrigger}
            </p>
          </ContentCard>

          {/* Card 2: Logistics & Receiving Point */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Logistics &amp; Receiving Point</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                RECEIVING HUB
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                {commitment.logistics.receivingHub}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                {commitment.logistics.gatePass}
              </span>
            </div>
          </ContentCard>

          {/* Card 3: Contract Actions */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Contract Actions</h2>
            </div>

            <div className="ym14-actions-card">
              <Button
                variant="outline"
                onClick={() => setToastMessage('Messaging channel established with grower via YieldMatrix In-App Comms.')}
              >
                Message Grower via App
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  downloadAgreementPdf(commitment);
                  setToastMessage(`Downloaded contract agreement: YieldMatrix-Contract-${commitment.reference}.pdf`);
                }}
              >
                Download Agreement PDF
              </Button>

              {commitment.hasChangePending && user?.role !== 'farmer' && (
                <Link to={`${rolePrefix}/commitments/${commitment.id}/change-review`}>
                  <Button variant="primary">Review Harvest Change Proposal</Button>
                </Link>
              )}
            </div>
          </ContentCard>
        </div>
      </div>
    </div>
  );
}
