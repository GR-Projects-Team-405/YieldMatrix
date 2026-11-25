import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { Toast } from '../../components/Toast';
import { downloadAgreementPdf } from './pdfGenerator';
import type { CommitmentDetail } from './types';

// Fallback mock commitment details matching Figma YM14_04
const defaultMockCommitmentDetail: CommitmentDetail = {
  id: 'c1042',
  reference: 'COM-1042',
  contractHash: '#YM-8820-CC',
  status: 'ready_to_fulfil',
  hasChangePending: false,
  linkedDemand: {
    id: 'd1111111-1111-1111-1111-111111111111',
    reference: 'DM-1042',
    title: 'Salad Tomatoes 1,500 kg',
  },
  originatingOffer: {
    id: 'o-highland-9104',
    reference: 'OFF-2026-0842',
    supplierName: 'Highland Harvest',
  },
  orderAllocationStatus: 'Pending Harvest Intake Scan',
  stepper: [
    {
      step: 1,
      title: '1. Proposed',
      subtitle: '28 Oct • Offer Received',
      status: 'completed',
    },
    {
      step: 2,
      title: '2. Accepted',
      subtitle: '02 Nov • Escrow Locked',
      status: 'completed',
    },
    {
      step: 3,
      title: '3. Ready to fulfil',
      subtitle: 'Active • Harvesting Batch',
      status: 'active',
    },
    {
      step: 4,
      title: '4. Fulfilled',
      subtitle: 'Upcoming • Hub Scan & Payout',
      status: 'upcoming',
    },
  ],
  specs: {
    buyerName: 'Mohomad Mushrif',
    buyerWorkspace: 'YM14 • Mohomad Mushrif (Colombo Hub)',
    supplierName: 'Highland Harvest (Kandy District)',
    plannedFieldBatch: 'Batch #BT-9104 (Salad Tomatoes, Grade A)',
    expectedKg: 1000.0,
    agreedPricePerKgCents: 18425, // LKR 184.25
    expectedTotalCents: 18425000, // LKR 184,250
    targetHarvestWindow: '12 Nov - 14 Nov 2026 (08:00 AM Intake)',
    cancellationTerms: 'Free cancellation prior to harvest dispatch; reason required',
  },
  originalTermsAnchor: {
    summaryText:
      '1,000 kg Fresh Salad Tomatoes (Grade A) @ LKR 184.25/kg = LKR 184,250 • Delivery 12-14 Nov 2026',
  },
  escrowStatus: {
    balanceHeldCents: 18425000,
    releaseTrigger:
      'Auto-settles and transfers to farmer wallet upon digital warehouse acceptance scan at Colombo intake bay.',
  },
  logistics: {
    receivingHub: 'Colombo Central Hub - Intake Dock 04',
    gatePass: '#GP-8832 issued to driver',
  },
};

export default function CommitmentDetails() {
  const { id = 'c1042' } = useParams<{ id?: string }>();
  const { user } = useAuth();

  const [commitment, setCommitment] = useState<CommitmentDetail>(defaultMockCommitmentDetail);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCommitment() {
      try {
        const res = await api.get(`/ym14/commitments/${id}`);
        if (mounted && res.data?.commitment) {
          setCommitment(res.data.commitment);
        }
      } catch (_err) {
        // Fallback gracefully
        if (mounted) {
          setCommitment({
            ...defaultMockCommitmentDetail,
            id,
            reference: id.startsWith('COM-') ? id : `COM-${id.toUpperCase()}`,
          });
        }
      }
    }
    loadCommitment();
    return () => {
      mounted = false;
    };
  }, [id]);

  const rolePrefix = user?.role === 'farmer' ? '/farmer' : '/buyer';

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

              {commitment.hasChangePending && (
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
