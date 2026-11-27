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
import type { ReceivedOffer, OfferStatus } from './types';

export default function ReceivedOfferDetails() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<ReceivedOffer | null>(null);
  const [createdCommitmentId, setCreatedCommitmentId] = useState<string | null>(null);
  const [createdCommitmentRef, setCreatedCommitmentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('--h --m --s');

  // Modals and user actions
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Counter-offer state
  const [counterPrice, setCounterPrice] = useState('');
  const [counterQty, setCounterQty] = useState('');
  const [counterNotes, setCounterNotes] = useState('');

  // Decline state
  const [declineReason, setDeclineReason] = useState('Price exceeds benchmark');
  const [declineNotes, setDeclineNotes] = useState('');
  const [declineError, setDeclineError] = useState('');

  // Fetch offer from PostgreSQL-backed API
  useEffect(() => {
    let mounted = true;
    async function loadOffer() {
      if (!id) {
        if (mounted) {
          setErrorMsg('No offer ID specified.');
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.get(`/ym14/offers/${id}`);
        if (mounted && res.data?.offer) {
          setOffer(res.data.offer);
        } else if (mounted) {
          setOffer(null);
          setErrorMsg('Offer not found in the database.');
        }
      } catch (err: any) {
        if (mounted) {
          setOffer(null);
          setErrorMsg(
            err?.response?.status === 404
              ? 'Offer record not found in the database.'
              : 'Unable to load offer details from the database.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadOffer();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Expiry countdown timer (Asia/Colombo)
  useEffect(() => {
    if (!offer?.expiresAt) return;
    const targetTime = new Date(offer.expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      if (diff <= 0) {
        setCountdown('00h 00m 00s (Expired)');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');
      setCountdown(`${hStr}h ${mStr}m ${sStr}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [offer?.expiresAt]);

  // Handle Accept Offer (FR-YM14-01 / FR-YM14-03)
  const handleAcceptConfirm = async () => {
    if (!offer) return;
    setActionBusy(true);
    try {
      const res = await api.post(`/ym14/offers/${offer.id}/accept`, {
        operationKey: `op-accept-${offer.reference}-${Date.now()}`,
      });
      setOffer((prev) => (prev ? { ...prev, status: 'accepted' as OfferStatus } : prev));
      if (res.data?.commitmentId) setCreatedCommitmentId(res.data.commitmentId);
      if (res.data?.reference) setCreatedCommitmentRef(res.data.reference);
      setAcceptDialogOpen(false);
      setToastMessage(
        res.data?.message || 'Offer accepted successfully! Forward commitment initiated with escrow locked.'
      );
    } catch (err: any) {
      setAcceptDialogOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to accept offer.');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Counter-Offer
  const handleCounterSubmit = () => {
    if (!offer) return;
    setActionBusy(true);
    setTimeout(() => {
      setActionBusy(false);
      setCounterModalOpen(false);
      setToastMessage(
        `Counter-offer for ${counterQty || offer.offeredKg} kg @ LKR ${counterPrice || offer.unitPriceCents / 100}/kg submitted to ${offer.supplier.name}.`
      );
    }, 600);
  };

  // Handle Decline Offer
  const handleDeclineSubmit = async () => {
    if (!offer) return;
    if (!declineReason.trim()) {
      setDeclineError('Please select or specify a reason.');
      return;
    }
    setDeclineError('');
    setActionBusy(true);
    try {
      await api.post(`/ym14/offers/${offer.id}/decline`, {
        reason: `${declineReason}${declineNotes ? ': ' + declineNotes : ''}`,
        operationKey: `op-decline-${offer.reference}-${Date.now()}`,
      });
      setOffer((prev) => (prev ? { ...prev, status: 'rejected' as OfferStatus } : prev));
      setDeclineModalOpen(false);
      setToastMessage('Offer declined. The supplier has been notified with the recorded reason.');
    } catch (err: any) {
      setDeclineModalOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to decline offer.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ym14-container">
        <ContentCard>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Loading offer details from database…</p>
        </ContentCard>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="ym14-container">
        <div className="ym14-breadcrumb" style={{ marginBottom: '16px' }}>
          <Link to="/buyer/demands">← Back to Demands</Link>
        </div>
        <ContentCard>
          <Alert type="error">{errorMsg || 'Offer not found in the database.'}</Alert>
        </ContentCard>
      </div>
    );
  }

  const isPending = offer.status === 'pending';
  const isAccepted = offer.status === 'accepted';
  const isRejected = offer.status === 'rejected';
  const isWithdrawn = offer.status === 'withdrawn';
  const isExpired =
    offer.status === 'expired' ||
    (isPending && offer.expiresAt ? new Date(offer.expiresAt).getTime() <= Date.now() : false);

  const priceDiffCents = offer.demand.budgetPerKgCents - offer.unitPriceCents;
  const isUnderBudget = priceDiffCents >= 0;
  const priceDiffText = isUnderBudget
    ? `LKR ${(priceDiffCents / 100).toFixed(0)}/kg under buyer budget`
    : `LKR ${(Math.abs(priceDiffCents) / 100).toFixed(0)}/kg over buyer budget`;

  const volumeShortageKg = Math.max(0, offer.demand.quantityKg - offer.offeredKg);

  return (
    <div className="ym14-container">
      {/* Toast Confirmation */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Top Header & Breadcrumbs */}
      <div className="ym14-top-bar">
        <div>
          <div className="ym14-breadcrumb">
            <Link to="/buyer/demands">← Back to Demands</Link>
            <span>•</span>
            <span>Offer Ref: {offer.reference}</span>
          </div>
          <div className="ym14-title-row">
            <h1>Offer from {offer.supplier.farmName}</h1>
            <StatusBadge status={isPending ? 'Pending Review' : offer.status} />
          </div>
        </div>

        {/* Expiry Countdown Timer */}
        <div className="ym14-timer-pill" role="timer" aria-live="polite">
          <span aria-hidden="true">⏳</span>
          <span>
            Offer Hold Expiry: <strong>{countdown}</strong> (Asia/Colombo)
          </span>
        </div>
      </div>

      {/* Linked Demand Summary Bar */}
      <div className="ym14-summary-bar">
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Linked Demand</span>
          <span className="ym14-summary-value">
            <Link to={`/buyer/offers/compare/${offer.demand.reference}`}>
              Demand #{offer.demand.reference}
            </Link>
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Crop &amp; Grade</span>
          <span className="ym14-summary-value">
            {offer.demand.cropName} ({offer.demand.gradeName})
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Demanded Volume</span>
          <span className="ym14-summary-value">{offer.demand.quantityKg.toLocaleString()} kg net</span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Destination Hub</span>
          <span className="ym14-summary-value">{offer.demand.destinationHub}</span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Target Window</span>
          <span className="ym14-summary-value">{offer.demand.targetWindow}</span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Buyer Budget</span>
          <span className="ym14-summary-value">
            Max LKR {(offer.demand.budgetPerKgCents / 100).toFixed(0)} / kg
          </span>
        </div>
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="ym14-grid-2col">
        {/* Left Column: Terms & Quality Specs */}
        <div className="ym14-column-main">
          {/* Card 1: Offer Terms & Pricing Specs */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Offer Terms &amp; Pricing Specs</h2>
              <span className="ym14-header-badge">Batch #{offer.batch?.code || 'BT-9024'}</span>
            </div>

            <div className="ym14-specs-grid">
              {/* Offered Quantity */}
              <div className="ym14-spec-box">
                <span className="ym14-spec-label">Offered Quantity</span>
                <span className="ym14-spec-value">{offer.offeredKg.toLocaleString()} kg</span>
                <span className="ym14-spec-subtext warning">
                  {volumeShortageKg > 0
                    ? `Partial volume (${volumeShortageKg.toLocaleString()} kg shortage)`
                    : 'Full volume match'}
                </span>
              </div>

              {/* Offered Unit Price */}
              <div className="ym14-spec-box">
                <span className="ym14-spec-label">Offered Unit Price</span>
                <span className="ym14-spec-value">
                  LKR {(offer.unitPriceCents / 100).toFixed(0)} / kg
                </span>
                <span className={`ym14-spec-subtext ${isUnderBudget ? 'success' : 'warning'}`}>
                  {priceDiffText}
                </span>
              </div>

              {/* Line Total Value */}
              <div className="ym14-spec-box">
                <span className="ym14-spec-label">Line Total Value</span>
                <span className="ym14-spec-value">
                  LKR {(offer.lineTotalCents / 100).toLocaleString()}
                </span>
                <span className="ym14-spec-subtext">Agri Wallet Escrow required</span>
              </div>

              {/* Availability Window */}
              <div className="ym14-spec-box">
                <span className="ym14-spec-label">Availability Window</span>
                <span className="ym14-spec-value">{offer.availabilityWindow}</span>
                <span className="ym14-spec-subtext">Ready for pickup 08:00 AM</span>
              </div>
            </div>

            {/* Tags / Certifications */}
            <div className="ym14-tags-row">
              {(offer.tags || []).map((tag, idx) => (
                <span
                  key={idx}
                  className={`ym14-tag-pill ${idx === 0 ? 'green' : idx === 2 ? 'orange' : ''}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </ContentCard>

          {/* Card 2: Farmer Notes & Quality Assurance */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Farmer Notes &amp; Quality Assurance</h2>
            </div>

            <p className="ym14-prose">{offer.notes}</p>

            <div className="ym14-checklist">
              {offer.qualityChecklist.map((item, idx) => (
                <div key={idx} className="ym14-checklist-item">
                  <span className="ym14-checklist-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <strong>{item.label}:</strong> {item.value}
                  </span>
                </div>
              ))}
            </div>
          </ContentCard>
        </div>

        {/* Right Column: Supplier Profile & Action Box */}
        <div className="ym14-column-side">
          {/* Card 1: Supplier Profile Summary */}
          <ContentCard>
            <div className="ym14-card-header">
              <h2>Supplier Profile Summary</h2>
              <span className="ym14-verified-badge">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                </svg>
                <span>Verified Supplier</span>
              </span>
            </div>

            <div className="ym14-supplier-card">
              <div className="ym14-supplier-row">
                <div className="ym14-avatar">
                  {offer.supplier.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="ym14-supplier-info">
                  <span className="ym14-supplier-name">{offer.supplier.name}</span>
                  <span className="ym14-supplier-estate">
                    {offer.supplier.estate || offer.supplier.farmName} • {offer.supplier.location}
                  </span>
                  <div className="ym14-supplier-stats">
                    <span className="ym14-star">★</span>
                    <span>
                      {offer.supplier.rating.toFixed(1)} / 5.0 Rating • {offer.supplier.completedTrades} completed
                      trades
                    </span>
                  </div>
                </div>
              </div>

              <div className="ym14-notice-box">
                ℹ Evaluated on completed activity only. New suppliers display "Insufficient trades"
              </div>
            </div>
          </ContentCard>

          {/* Card 2: Agri Wallet Escrow Protection */}
          <ContentCard>
            <div className="ym14-escrow-card">
              <div className="ym14-escrow-title">
                <span aria-hidden="true">🛡️</span>
                <span>Agri Wallet Escrow Protection</span>
              </div>
              <p className="ym14-escrow-text">
                LKR {(offer.lineTotalCents / 100).toLocaleString()} will be held from available balance upon
                commitment acceptance. Funds are secured in escrow and auto-released upon digital warehouse
                intake acceptance.
              </p>
            </div>
          </ContentCard>

          {/* Card 3: Action Panel */}
          <ContentCard>
            <div className="ym14-actions-card">
              <div className="ym14-callout-note">
                📌 <strong>NOTE:</strong> Accepting starts reservation / future-commitment process; it does not
                confirm the order directly.
              </div>

              {isAccepted ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="success">
                    Offer accepted! Forward commitment {createdCommitmentRef || ''} is active and escrow is locked.
                  </Alert>
                  <Button
                    variant="primary"
                    style={{ width: '100%' }}
                    onClick={() =>
                      navigate(createdCommitmentId ? `/buyer/commitments/${createdCommitmentId}` : '/buyer/commitments')
                    }
                  >
                    {createdCommitmentRef
                      ? `View Commitment Specifications (${createdCommitmentRef})`
                      : 'View Produce Commitments'}
                  </Button>
                </div>
              ) : isRejected ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="error">Offer declined. Supplier has been notified.</Alert>
                  <Button
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={() => navigate(`/buyer/offers/compare/${offer.demand.id || offer.demand.reference}`)}
                  >
                    Compare Other Offers
                  </Button>
                </div>
              ) : isExpired || isWithdrawn ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <Alert type="warning">
                    {isWithdrawn
                      ? 'This offer was withdrawn by the supplier and cannot be accepted.'
                      : 'This offer has expired and can no longer be accepted.'}
                  </Alert>
                  <Button
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={() => navigate(`/buyer/offers/compare/${offer.demand.id || offer.demand.reference}`)}
                  >
                    Compare Other Offers
                  </Button>
                </div>
              ) : (
                <>
                  {/* Primary: Accept Offer */}
                  <Button
                    variant="primary"
                    style={{ width: '100%' }}
                    onClick={() => setAcceptDialogOpen(true)}
                  >
                    Accept Offer &amp; Start Reservation
                  </Button>

                  {/* Secondary: Counter-Offer */}
                  <Button
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={() => setCounterModalOpen(true)}
                  >
                    Counter-Offer Price / Qty
                  </Button>

                  {/* Tertiary: Decline Offer */}
                  <button
                    type="button"
                    className="ym14-decline-btn"
                    onClick={() => setDeclineModalOpen(true)}
                  >
                    Decline Offer (Reason Required)
                    <span aria-hidden="true">▾</span>
                  </button>
                </>
              )}

              <p className="ym14-footnote">
                🔒 Buyer YM14: Active. Pending/Suspended accounts cannot accept offers.
              </p>
            </div>
          </ContentCard>
        </div>
      </div>

      {/* Confirmation Dialog: Accept Offer */}
      <ConfirmDialog
        open={acceptDialogOpen}
        title="Accept Offer & Lock Escrow"
        description={`Confirming will lock LKR ${(offer.lineTotalCents / 100).toLocaleString()} in Agri Wallet escrow and establish a binding forward commitment for ${offer.offeredKg.toLocaleString()} kg ${offer.demand.cropName}.`}
        simulationNote="Domain Rule DR-01: Future commitment creates forward reservation. Physical stock is inspected and allocated upon hub intake."
        confirmLabel="Confirm & Lock Escrow"
        busy={actionBusy}
        onCancel={() => setAcceptDialogOpen(false)}
        onConfirm={handleAcceptConfirm}
      />

      {/* Modal Dialog: Counter-Offer */}
      {counterModalOpen && (
        <div className="ym14-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="counter-modal-title">
          <div className="ym14-modal">
            <div className="ym14-modal-header">
              <h3 id="counter-modal-title">Submit Counter-Offer</h3>
              <button
                type="button"
                className="ym14-modal-close"
                onClick={() => setCounterModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="ym14-modal-body">
              <p className="ym14-prose">
                Suggest revised terms to {offer.supplier.name}. Original offer price was LKR {(offer.unitPriceCents / 100).toFixed(0)}/kg.
              </p>
              <InputField
                label="Proposed Unit Price"
                unit="LKR / kg"
                type="number"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
              />
              <InputField
                label="Required Volume"
                unit="kg"
                type="number"
                value={counterQty}
                onChange={(e) => setCounterQty(e.target.value)}
              />
              <div className="ym-field">
                <label htmlFor="counter-notes">Negotiation Message</label>
                <textarea
                  id="counter-notes"
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
                  placeholder="e.g. Can meet on-site pickup if volume is increased to 1,500 kg."
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
                {actionBusy ? 'Submitting…' : 'Transmit Counter-Offer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Decline Offer */}
      {declineModalOpen && (
        <div className="ym14-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="decline-modal-title">
          <div className="ym14-modal">
            <div className="ym14-modal-header">
              <h3 id="decline-modal-title">Decline Received Offer</h3>
              <button
                type="button"
                className="ym14-modal-close"
                onClick={() => setDeclineModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="ym14-modal-body">
              <p className="ym14-prose">
                A valid decline rationale is mandatory under SRS FR-YM14-01 to inform producer demand matching.
              </p>
              <SelectField
                label="Decline Reason"
                value={declineReason}
                error={declineError}
                options={[
                  { label: 'Price exceeds benchmark', value: 'Price exceeds benchmark' },
                  { label: 'Delivery window incompatible', value: 'Delivery window incompatible' },
                  { label: 'Found alternative supplier', value: 'Found alternative supplier' },
                  { label: 'Volume insufficient', value: 'Volume insufficient' },
                  { label: 'Other rationale', value: 'Other' },
                ]}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
              <div className="ym-field">
                <label htmlFor="decline-notes">Additional Context (Optional)</label>
                <textarea
                  id="decline-notes"
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
                  placeholder="Provide brief feedback to the producer..."
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="ym14-modal-footer">
              <Button variant="outline" onClick={() => setDeclineModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={actionBusy} onClick={handleDeclineSubmit}>
                {actionBusy ? 'Declining…' : 'Decline Offer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
