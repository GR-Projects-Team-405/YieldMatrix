import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import { Alert } from '../../components/Alert';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import type { HarvestChangeProposal } from './types';

export default function HarvestChangeReview() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<HarvestChangeProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('--h --m remaining');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [decisionState, setDecisionState] = useState<'pending' | 'approved' | 'rejected' | 'cancelled'>('pending');

  // Modals
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState('220');
  const [counterQty, setCounterQty] = useState('500');
  const [counterNotes, setCounterNotes] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Alternative supply procured due to weather delay');
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Load live proposal data from PostgreSQL-backed API
  useEffect(() => {
    let mounted = true;
    async function loadProposal() {
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
        const res = await api.get(`/ym14/commitments/${id}/change-proposal`);
        if (mounted && res.data?.diff) {
          setProposal(res.data);
        } else if (mounted) {
          setProposal(null);
          setErrorMsg('No pending harvest modification proposal exists for this commitment.');
        }
      } catch (err: any) {
        if (mounted) {
          setProposal(null);
          setErrorMsg(
            err?.response?.status === 404
              ? 'No pending harvest modification proposal exists for this commitment.'
              : 'Unable to load harvest modification proposal from the database.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProposal();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!proposal?.proposalExpiresAt) return;
    const target = new Date(proposal.proposalExpiresAt).getTime();
    const update = () => {
      const diff = Math.max(0, target - Date.now());
      if (diff <= 0) {
        setCountdown('00h 00m (Proposal Lapsed)');
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal?.proposalExpiresAt]);

  // Handle Approve Change (DR-02: Silence is never acceptance)
  const handleApproveConfirm = async () => {
    if (!proposal) return;
    setActionBusy(true);
    try {
      const targetId = proposal.commitmentId || id;
      const res = await api.post(`/ym14/commitments/${targetId}/approve-change`, {
        operationKey: `op-approve-${proposal.reference}-${Date.now()}`,
      });
      setDecisionState('approved');
      setApproveDialogOpen(false);
      setToastMessage(
        res.data?.message || 'Harvest modification approved. Contract terms updated.'
      );
    } catch (err: any) {
      setApproveDialogOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to approve harvest modification.');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Reject Change
  const handleRejectConfirm = async () => {
    if (!proposal) return;
    setActionBusy(true);
    try {
      const targetId = proposal.commitmentId || id;
      const res = await api.post(`/ym14/commitments/${targetId}/reject-change`, {
        reason: rejectReason || 'Buyer requested retention of original binding terms',
        operationKey: `op-reject-${proposal.reference}-${Date.now()}`,
      });
      setDecisionState('rejected');
      setRejectDialogOpen(false);
      setToastMessage(
        res.data?.message || 'Harvest modification rejected. Original agreed terms remain strictly binding.'
      );
    } catch (err: any) {
      setRejectDialogOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to reject harvest modification.');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Counter Proposal
  const handleCounterSubmit = () => {
    setActionBusy(true);
    setTimeout(() => {
      setActionBusy(false);
      setCounterModalOpen(false);
      setToastMessage(`Counter-proposal for ${counterQty} kg @ LKR ${counterPrice}/kg transmitted to grower.`);
    }, 600);
  };

  // Handle Cancellation
  const handleCancelSubmit = async () => {
    if (!proposal) return;
    if (!cancelReason.trim()) {
      setCancelError('Please select or specify a cancellation reason.');
      return;
    }
    setCancelError('');
    setActionBusy(true);
    try {
      const targetId = proposal.commitmentId || id;
      const res = await api.post(`/ym14/commitments/${targetId}/cancel`, {
        reason: `${cancelReason}${cancelNotes ? ': ' + cancelNotes : ''}`,
        operationKey: `op-cancel-${proposal.reference}-${Date.now()}`,
      });
      setDecisionState('cancelled');
      setCancelModalOpen(false);
      setToastMessage(
        res.data?.message || 'Commitment cancelled successfully. 100% of escrow funds released back to Agri Wallet.'
      );
    } catch (err: any) {
      setCancelModalOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to cancel commitment.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ym14-container">
        <ContentCard>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Loading harvest change proposal from database…</p>
        </ContentCard>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="ym14-container">
        <div className="ym14-breadcrumb" style={{ marginBottom: '16px' }}>
          <Link to={id ? `/buyer/commitments/${id}` : '/buyer/commitments'}>← Back to Commitment Details</Link>
        </div>
        <ContentCard>
          <Alert type="info">{errorMsg || 'No pending harvest modification proposal found.'}</Alert>
        </ContentCard>
      </div>
    );
  }

  return (
    <div className="ym14-container">
      {/* Toast Confirmation */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Top Header */}
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to={`/buyer/commitments/${proposal.commitmentId || 'c1041'}`}>
              ← Back to Commitment Details (#{proposal.reference})
            </Link>
            <span>•</span>
            <span>Contract Ref: {proposal.reference}</span>
          </div>
          <div className="ym14-title-row">
            <h1>Harvest Modification Review: {proposal.reference}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <StatusBadge status="Change Pending Review" />
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
            Grower Initiated
          </span>
        </div>
      </div>

      {/* Mandatory SRS Rule Banner (Callout) */}
      <aside className="ym14-rule-banner" aria-label="DR-02 Rule Notice">
        <div className="ym14-rule-content">
          <span className="ym14-rule-icon" aria-hidden="true">
            ⚖
          </span>
          <div>
            <strong>MANDATORY SRS RULE: "Silence is never acceptance"</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              No change applies until the buyer explicitly decides. Original agreed terms remain strictly binding.
              If expired without action, this proposal lapses and original terms stand.
            </p>
          </div>
        </div>

        <div className="ym14-rule-timer" role="timer" aria-live="polite">
          <span aria-hidden="true">⏳</span>
          <span>
            Proposal Expiry: <strong>{countdown}</strong> (Asia/Colombo)
          </span>
        </div>
      </aside>

      {/* Main 2-Column Content Grid */}
      <div className="ym14-grid-2col">
        {/* Left Column: Diff View & Grower Statement */}
        <div className="ym14-column-main">
          {/* Card 1: Proposed Agreement Modifications (Diff View) */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Proposed Agreement Modifications (Diff View)</h2>
              <span className="ym14-header-badge">{proposal.cropBatch}</span>
            </div>

            <div className="ym-table-scroll">
              <table className="ym14-diff-table" aria-label="Agreement modification diff table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Original Agreed</th>
                    <th>Proposed Change</th>
                    <th>Net Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.diff.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{row.parameter}</td>
                      <td>{row.originalAgreed}</td>
                      <td style={{ fontWeight: 600 }}>{row.proposedChange}</td>
                      <td>
                        <span
                          className={`ym14-variance-tag ${
                            row.isNegative && row.parameter.includes('Quantity')
                              ? 'shortage'
                              : row.isShift
                              ? 'shift'
                              : row.parameter.includes('Escrow')
                              ? 'refund'
                              : 'neutral'
                          }`}
                        >
                          {row.netVariance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentCard>

          {/* Card 2: Grower's Statement & Field Notes */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Grower&apos;s Statement &amp; Field Notes</h2>
              <span className="ym14-tag-pill green">✓ Agronomy Verified</span>
            </div>

            <div className="ym14-quote-box">
              &ldquo;{proposal.growerStatement}&rdquo;
              <span className="ym14-quote-author">— Nimal Perera (Green Valley Farm • Welimada)</span>
            </div>

            <div className="ym14-photo-badge">
              <span aria-hidden="true">📷</span>
              <span>{proposal.verificationNotes}</span>
            </div>
          </ContentCard>
        </div>

        {/* Right Column: Financial Impact & Buyer Decision Actions */}
        <div className="ym14-column-side">
          {/* Card 1: Financial & Escrow Impact Summary */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Financial &amp; Escrow Impact Summary</h2>
            </div>

            <div className="ym14-impact-box">
              <span className="ym14-impact-label">ESCROW AUTO-REFUND</span>
              <span className="ym14-impact-val green">
                LKR {(proposal.financialImpact.escrowAutoRefundCents / 100).toLocaleString()}
              </span>
              <span className="ym14-impact-sub">Credited instantly to Agri Wallet upon approval</span>
            </div>

            <div className="ym14-impact-box">
              <span className="ym14-impact-label">REVISED ESCROW HOLD</span>
              <span className="ym14-impact-val">
                LKR {(proposal.financialImpact.revisedEscrowHoldCents / 100).toLocaleString()}
              </span>
              <span className="ym14-impact-sub">Retained in protected smart escrow</span>
            </div>

            <div className="ym14-impact-box">
              <span className="ym14-impact-label">TIMELINE SHIFT</span>
              <span className="ym14-impact-val" style={{ color: '#b56208' }}>
                {proposal.financialImpact.timelineShift}
              </span>
              <span className="ym14-impact-sub">
                New intake: {proposal.financialImpact.newIntakeDate}
              </span>
            </div>
          </ContentCard>

          {/* Card 2: Buyer Decision Actions */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Buyer Decision Actions</h2>
            </div>

            <div className="ym14-actions-card">
              {decisionState === 'approved' ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="success">
                    Harvest modification approved. Contract terms updated and LKR 26,400 refunded.
                  </Alert>
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/buyer/commitments/${proposal.reference || id}`)}
                  >
                    View Updated Commitment
                  </Button>
                </div>
              ) : decisionState === 'rejected' ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="info">
                    Modification rejected. Original agreed binding terms remain enforced.
                  </Alert>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/buyer/commitments/${proposal.reference || id}`)}
                  >
                    Back to Commitment
                  </Button>
                </div>
              ) : decisionState === 'cancelled' ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="error">
                    Commitment cancelled. 100% of escrow hold has been refunded.
                  </Alert>
                  <Button variant="outline" onClick={() => navigate('/buyer/commitments')}>
                    Back to Commitments List
                  </Button>
                </div>
              ) : (
                <>
                  {/* Action 1: Approve Change */}
                  <Button
                    variant="primary"
                    onClick={() => setApproveDialogOpen(true)}
                  >
                    Approve Change (Updates Terms &amp; Escrow)
                  </Button>

                  {/* Action 2: Reject Change */}
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    Reject Change &amp; Keep Original Terms
                  </Button>

                  {/* Action 3: Counter-Terms */}
                  <Button
                    variant="outline"
                    onClick={() => setCounterModalOpen(true)}
                  >
                    Propose Counter-Terms (Price / Qty)
                  </Button>

                  {/* Action 4: Request Cancellation */}
                  <button
                    type="button"
                    className="ym14-decline-btn"
                    style={{
                      background: '#fcebea',
                      border: '1px solid #f3b5b1',
                      color: '#b42318',
                      marginTop: '4px',
                    }}
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Reject &amp; Request Cancellation (Full Refund)
                  </button>

                  <p className="ym14-footnote">
                    Triggers cancellation flow with mandatory reason field. Escrow released in full.
                  </p>
                </>
              )}
            </div>
          </ContentCard>
        </div>
      </div>

      {/* Confirm Dialog: Approve Change */}
      <ConfirmDialog
        open={approveDialogOpen}
        title="Approve Harvest Modification"
        description={`Approving will update the contract to 480 kg net volume with delivery on 14-15 Nov 2026. LKR ${(proposal.financialImpact.escrowAutoRefundCents / 100).toLocaleString()} will be automatically credited to your Agri Wallet.`}
        simulationNote="Domain Rule DR-02: Silence is never acceptance. Explicit approval applies changes and adjusts escrow atomically."
        confirmLabel="Approve & Credit Wallet"
        busy={actionBusy}
        onCancel={() => setApproveDialogOpen(false)}
        onConfirm={handleApproveConfirm}
      />

      {/* Confirm Dialog: Reject Change */}
      <ConfirmDialog
        open={rejectDialogOpen}
        title="Reject Modification & Retain Terms"
        description="Rejecting will uphold the original binding agreement (600 kg net volume @ LKR 220/kg). The grower will be instructed to fulfill original commitments or source replacement produce."
        confirmLabel="Reject & Keep Original Terms"
        busy={actionBusy}
        onCancel={() => setRejectDialogOpen(false)}
        onConfirm={handleRejectConfirm}
      />

      {/* Modal Dialog: Propose Counter-Terms */}
      {counterModalOpen && (
        <div className="ym14-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="counter-modal-title">
          <div className="ym14-modal">
            <div className="ym14-modal-header">
              <h3 id="counter-modal-title">Propose Counter-Terms</h3>
              <button
                type="button"
                className="ym14-modal-close"
                onClick={() => setCounterModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ym14-modal-body">
              <p className="ym14-prose">
                Suggest an alternative volume or price adjustment back to grower Nimal Perera:
              </p>
              <InputField
                label="Proposed Price"
                unit="LKR / kg"
                type="number"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
              />
              <InputField
                label="Proposed Volume"
                unit="kg"
                type="number"
                value={counterQty}
                onChange={(e) => setCounterQty(e.target.value)}
              />
              <div className="ym-field">
                <label htmlFor="change-counter-notes">Negotiation Message</label>
                <textarea
                  id="change-counter-notes"
                  rows={3}
                  className="ym-field"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid var(--control-border)',
                    padding: '12px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                  placeholder="e.g. Can accept 480 kg if price is adjusted to LKR 210/kg."
                  value={counterNotes}
                  onChange={(e) => setCounterNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="ym14-modal-footer">
              <Button variant="outline" onClick={() => setCounterModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={actionBusy} onClick={handleCounterSubmit}>
                {actionBusy ? 'Submitting…' : 'Transmit Counter-Terms'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Cancel Commitment */}
      {cancelModalOpen && (
        <div className="ym14-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
          <div className="ym14-modal">
            <div className="ym14-modal-header">
              <h3 id="cancel-modal-title">Cancel Commitment (Full Escrow Refund)</h3>
              <button
                type="button"
                className="ym14-modal-close"
                onClick={() => setCancelModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ym14-modal-body">
              <p className="ym14-prose">
                Cancellation releases 100% of held escrow funds (LKR 132,000) back to your Agri Wallet.
                A valid explanation is mandatory under contract terms.
              </p>
              <SelectField
                label="Cancellation Rationale"
                value={cancelReason}
                error={cancelError}
                options={[
                  { label: 'Alternative supply procured due to weather delay', value: 'Alternative supply procured due to weather delay' },
                  { label: 'Proposed delivery window conflicts with supply schedule', value: 'Proposed delivery window conflicts with supply schedule' },
                  { label: 'Quantity shortage exceeds business tolerance threshold', value: 'Quantity shortage exceeds business tolerance threshold' },
                  { label: 'Force majeure / weather disruption', value: 'Force majeure / weather disruption' },
                  { label: 'Other rationale', value: 'Other' },
                ]}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="ym-field">
                <label htmlFor="cancel-notes">Additional Notes</label>
                <textarea
                  id="cancel-notes"
                  rows={3}
                  className="ym-field"
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid var(--control-border)',
                    padding: '12px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Provide context..."
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="ym14-modal-footer">
              <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
                Keep Commitment
              </Button>
              <Button variant="danger" disabled={actionBusy} onClick={handleCancelSubmit}>
                {actionBusy ? 'Cancelling…' : 'Cancel & Release Escrow'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
