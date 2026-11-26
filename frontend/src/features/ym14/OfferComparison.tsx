import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import { SelectField } from '../../components/SelectField';
import { ContentCard } from '../../components/ContentCard';
import { Alert } from '../../components/Alert';
import type { OfferComparisonSummary, OfferComparisonItem } from './types';

export default function OfferComparison() {
  const { demandId } = useParams<{ demandId?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OfferComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdCommitmentMap, setCreatedCommitmentMap] = useState<Record<string, { id: string; ref: string }>>({});
  const [selectedOffer, setSelectedOffer] = useState<OfferComparisonItem | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('Price exceeds benchmark');
  const [declineNotes, setDeclineNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Load live comparison metrics from PostgreSQL-backed API
  useEffect(() => {
    let mounted = true;
    async function fetchComparison() {
      if (!demandId) {
        if (mounted) {
          setErrorMsg('No demand ID specified.');
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.get(`/ym14/offers/compare/${demandId}`);
        if (mounted && res.data?.demand) {
          setData(res.data);
        } else if (mounted) {
          setData(null);
          setErrorMsg('Demand not found in the database.');
        }
      } catch (err: any) {
        if (mounted) {
          setData(null);
          setErrorMsg(
            err?.response?.status === 404
              ? 'Demand not found in the database.'
              : 'Unable to load offer comparison from the database.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchComparison();
    return () => {
      mounted = false;
    };
  }, [demandId]);

  // Handle Accept Offer from comparison card
  const handleAcceptConfirm = async () => {
    if (!selectedOffer) return;
    setActionBusy(true);
    try {
      const res = await api.post(`/ym14/offers/${selectedOffer.id}/accept`, {
        operationKey: `op-comp-accept-${selectedOffer.id}-${Date.now()}`,
      });
      setAcceptDialogOpen(false);
      setToastMessage(
        res.data?.message ||
          `Offer from ${selectedOffer.supplierName} accepted! Forward commitment created and escrow held.`
      );
      if (res.data?.commitmentId) {
        setCreatedCommitmentMap((prev) => ({
          ...prev,
          [selectedOffer.id]: { id: res.data.commitmentId, ref: res.data.reference || 'View' },
        }));
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              offers: prev.offers.map((o) =>
                o.id === selectedOffer.id ? { ...o, status: 'accepted' } : o
              ),
            }
          : prev
      );
    } catch (err: any) {
      setAcceptDialogOpen(false);
      setToastMessage(err?.response?.data?.error || 'Failed to accept offer.');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Decline Offer from comparison card
  const handleDeclineSubmit = async () => {
    if (!selectedOffer) return;
    setActionBusy(true);
    try {
      await api.post(`/ym14/offers/${selectedOffer.id}/decline`, {
        reason: `${declineReason}${declineNotes ? ': ' + declineNotes : ''}`,
        operationKey: `op-comp-decline-${selectedOffer.id}-${Date.now()}`,
      });
      setDeclineModalOpen(false);
      setToastMessage(`Offer from ${selectedOffer.supplierName} declined.`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              offers: prev.offers.map((o) =>
                o.id === selectedOffer.id ? { ...o, status: 'rejected' } : o
              ),
            }
          : prev
      );
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
          <p style={{ margin: 0, color: 'var(--muted)' }}>Loading offer comparison from database…</p>
        </ContentCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ym14-container">
        <div className="ym14-breadcrumb" style={{ marginBottom: '16px' }}>
          <Link to="/buyer/demands">← Back to Demands</Link>
        </div>
        <ContentCard>
          <Alert type="error">{errorMsg || 'Demand not found in the database.'}</Alert>
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
            <Link to="/buyer/demands">← Back to Demands</Link>
            <span>•</span>
            <span>Comparison Mode ({data.metrics.totalOffers} Offers Received)</span>
          </div>
          <div className="ym14-title-row">
            <h1>Compare Received Offers</h1>
          </div>
        </div>

        {/* Demand Spec Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            Demand #{data.demand.reference}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {data.demand.cropName} • {data.demand.quantityKg.toLocaleString()} kg
          </span>
          <span className="ym14-tag-pill green">
            Budget: Max LKR {(data.demand.budgetPerKgCents / 100).toFixed(0)}/kg
          </span>
        </div>
      </div>

      {/* 4-Metric Summary Strip */}
      <div className="ym14-summary-bar" style={{ marginBottom: '24px' }}>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Offers on Demand</span>
          <span className="ym14-summary-value">
            {data.metrics.totalOffers} Received ({data.metrics.pendingOffers} Pending, {data.metrics.expiredOffers} Expired)
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Lowest Offered Price</span>
          <span className="ym14-summary-value" style={{ color: 'var(--accent-text)' }}>
            LKR {(data.metrics.lowestPricePerKgCents / 100).toFixed(0)} / kg ({data.metrics.lowestPriceSupplier})
          </span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Demand Coverage</span>
          <span className="ym14-summary-value">{data.metrics.demandCoverageText}</span>
        </div>
        <div className="ym14-summary-item">
          <span className="ym14-summary-label">Earliest Harvest Pickup</span>
          <span className="ym14-summary-value">{data.metrics.earliestPickupDate}</span>
        </div>
      </div>

      {/* Offer Comparison Grid */}
      {data.offers.length === 0 ? (
        <ContentCard>
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
            No offers have been submitted for this demand yet.
          </p>
        </ContentCard>
      ) : (
      <div className="ym14-compare-grid">
        {data.offers.map((offer) => {
          const isPending = offer.status === 'pending';
          const isExpired = offer.status === 'expired';
          const isAccepted = offer.status === 'accepted';
          const isRejected = offer.status === 'rejected';

          const badgeClass = offer.badge?.includes('RECOMMENDED')
            ? 'recommended'
            : offer.badge?.includes('FULL DEMAND')
            ? 'full-match'
            : 'expired';

          return (
            <div key={offer.id} className="ym14-compare-card">
              {/* Badge Row */}
              <div className="ym14-compare-badge-row">
                {offer.badge && (
                  <span className={`ym14-compare-badge ${badgeClass}`}>{offer.badge}</span>
                )}
              </div>

              {/* Supplier Block */}
              <div className="ym14-compare-supplier-block">
                <span className="ym14-compare-supplier-caption">Supplier</span>
                <span className="ym14-compare-supplier-name">{offer.supplierName}</span>
                <span className="ym14-compare-district">{offer.district}</span>
              </div>

              {/* Batch & Grade */}
              <div className="ym14-compare-meta-strip">
                <span>Batch #{offer.batchCode}</span>
                <span>{offer.grade}</span>
              </div>

              {/* Offered Volume */}
              <div className="ym14-compare-section">
                <span className="ym14-compare-section-label">Offered Volume</span>
                <span className="ym14-compare-section-val">{offer.offeredKg.toLocaleString()} kg</span>
                {offer.shortageKg && offer.shortageKg > 0 ? (
                  <span className="ym14-compare-sub negative">
                    ▲ Shortage: {offer.shortageKg.toLocaleString()} kg below demanded {data.demand.quantityKg.toLocaleString()} kg
                  </span>
                ) : (
                  <span className="ym14-compare-sub positive">
                    ✓ Covers 100% of demanded volume
                  </span>
                )}
              </div>

              {/* Price Per Kg */}
              <div className="ym14-compare-section">
                <span className="ym14-compare-section-label">Price Per Kg</span>
                <span className="ym14-compare-section-val">
                  LKR {(offer.pricePerKgCents / 100).toFixed(0)} / kg
                </span>
                {offer.priceDifferenceCents < 0 ? (
                  <span className="ym14-compare-sub positive">
                    ✓ LKR {(Math.abs(offer.priceDifferenceCents) / 100).toFixed(0)}/kg below buyer budget
                  </span>
                ) : offer.priceDifferenceCents === 0 ? (
                  <span className="ym14-compare-sub neutral">✓ Exactly at buyer budget limit</span>
                ) : (
                  <span className="ym14-compare-sub negative">
                    ▲ Exceeds buyer budget by LKR {(offer.priceDifferenceCents / 100).toFixed(0)}/kg
                  </span>
                )}
              </div>

              {/* Line Total */}
              <div className="ym14-compare-line-total">
                <span className="label">LINE TOTAL</span>
                <strong>LKR {(offer.lineTotalCents / 100).toLocaleString()}</strong>
              </div>

              {/* Availability, Expiry, Status */}
              <div className="ym14-compare-details-list">
                <div className="ym14-compare-detail-row">
                  <span className="label">AVAILABILITY</span>
                  <span>{offer.availabilityWindow}</span>
                </div>
                <div className="ym14-compare-detail-row">
                  <span className="label">EXPIRY</span>
                  <span>{offer.expiresAt}</span>
                </div>
                <div className="ym14-compare-detail-row">
                  <span className="label">STATUS</span>
                  <StatusBadge status={isPending ? 'Pending Review' : offer.status} />
                </div>
              </div>

              {/* Supplier Performance */}
              <div className="ym14-compare-section">
                <span className="ym14-compare-section-label">Supplier Performance</span>
                {offer.hasInsufficientHistory ? (
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Insufficient history</span>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    ★ {offer.supplierRating.toFixed(1)} • {offer.completedTrades} completed trades ({offer.onTimePercentage}% on-time)
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="ym14-compare-actions">
                {isAccepted ? (
                  <Button
                    variant="primary"
                    onClick={() =>
                      navigate(
                        createdCommitmentMap[offer.id]?.id
                          ? `/buyer/commitments/${createdCommitmentMap[offer.id].id}`
                          : '/buyer/commitments'
                      )
                    }
                  >
                    {createdCommitmentMap[offer.id]?.ref
                      ? `View Commitment (${createdCommitmentMap[offer.id].ref})`
                      : 'View Commitments'}
                  </Button>
                ) : isRejected ? (
                  <Button variant="unavailable" disabled>
                    Offer Rejected
                  </Button>
                ) : isExpired ? (
                  <Button variant="unavailable" disabled>
                    Offer Expired (Disabled)
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedOffer(offer);
                        setAcceptDialogOpen(true);
                      }}
                    >
                      Accept Offer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedOffer(offer);
                        setDeclineModalOpen(true);
                      }}
                    >
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Accept Confirmation Dialog */}
      <ConfirmDialog
        open={acceptDialogOpen}
        title="Accept Offer & Create Forward Commitment"
        description={
          selectedOffer
            ? `Confirm accepting ${selectedOffer.offeredKg.toLocaleString()} kg @ LKR ${(selectedOffer.pricePerKgCents / 100).toFixed(0)}/kg from ${selectedOffer.supplierName}? Total LKR ${(selectedOffer.lineTotalCents / 100).toLocaleString()} will be locked in Agri Wallet escrow.`
            : 'Confirm offer acceptance?'
        }
        simulationNote="Domain Rule DR-01: Creates forward commitment reservation. Physical stock is checked and allocated upon hub arrival."
        confirmLabel="Confirm & Lock Escrow"
        busy={actionBusy}
        onCancel={() => setAcceptDialogOpen(false)}
        onConfirm={handleAcceptConfirm}
      />

      {/* Decline Reason Modal */}
      {declineModalOpen && selectedOffer && (
        <div className="ym14-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="decline-title">
          <div className="ym14-modal">
            <div className="ym14-modal-header">
              <h3 id="decline-title">Decline Offer from {selectedOffer.supplierName}</h3>
              <button
                type="button"
                className="ym14-modal-close"
                onClick={() => setDeclineModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="ym14-modal-body">
              <p className="ym14-prose">
                Please provide a decline reason under YieldMatrix SRS FR-YM14-01:
              </p>
              <SelectField
                label="Decline Reason"
                value={declineReason}
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
                <label htmlFor="comp-decline-notes">Notes for Producer</label>
                <textarea
                  id="comp-decline-notes"
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
                  placeholder="Feedback..."
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
