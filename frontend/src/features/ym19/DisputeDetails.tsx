import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { ArrowLeft, ShieldAlert, CheckCircle, FileText, Info, Scale, Printer, Gavel, X } from 'lucide-react';

export function DisputeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Adjudication dialog state
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resolveVerdict, setResolveVerdict] = useState<string>('');
  const [resolvedKg, setResolvedKg] = useState<string>('');
  const [refundLkr, setRefundLkr] = useState<string>('');
  const [settlementLkr, setSettlementLkr] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(false);

  const fetchDispute = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/ym19/disputes/${id}`);
      const disp = res.data.dispute;
      setDispute(disp);

      // Pre-fill default suggested split
      if (disp) {
        const totalDisputedLkr = (parseInt(disp.disputed_cents, 10) / 100);
        setResolvedKg(disp.disputed_kg?.toString() || '0');
        setRefundLkr(totalDisputedLkr.toFixed(2));
        setSettlementLkr('0.00');
        setResolveVerdict('QA inspection confirmed non-conforming produce. Buyer refunded for damaged quantity.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dispute details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispute();
  }, [id]);

  const formatLkr = (centsStr: string | number) => {
    const cents = typeof centsStr === 'string' ? parseInt(centsStr, 10) : centsStr;
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispute) return;

    const refundCents = Math.round((parseFloat(refundLkr) || 0) * 100);
    const settlementCents = Math.round((parseFloat(settlementLkr) || 0) * 100);
    const resolvedKgNum = parseFloat(resolvedKg) || 0;

    try {
      setResolving(true);
      setFeedback(null);
      await api.post(`/ym19/disputes/${dispute.id}/resolve`, {
        resolution: resolveVerdict.trim(),
        resolvedKg: resolvedKgNum,
        refundCents,
        settlementCents,
      });

      setShowResolveModal(false);
      setFeedback({
        type: 'success',
        message: 'Dispute formally resolved! Escrow funds adjusted and notifications sent.',
      });
      await fetchDispute();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to resolve dispute' });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <ContentCard title="Dispute Details">
        <p style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>Loading dispute dossier…</p>
      </ContentCard>
    );
  }

  if (!dispute || error) {
    return (
      <ContentCard title="Dispute Dossier">
        <Alert type="error">{error || `Could not find dispute record #${id}`}</Alert>
        <div style={{ marginTop: '16px' }}>
          <Button variant="outline" onClick={() => navigate('/buyer/disputes')}>
            Back to Disputes List
          </Button>
        </div>
      </ContentCard>
    );
  }

  const evidenceList = Array.isArray(dispute.evidence) ? dispute.evidence : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="outline" onClick={() => navigate('/buyer/disputes')} style={{ padding: '6px 12px' }}>
            <ArrowLeft size={16} style={{ marginRight: '4px' }} />
            Back
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Dispute #{dispute.id.slice(0, 8)}</h2>
              <StatusBadge status={dispute.dispute_status} />
            </div>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Raised on {new Date(dispute.created_at).toLocaleString()} · Allocation #{dispute.allocation_id.slice(0, 8)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="outline"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
          >
            <Printer size={15} />
            Print Dossier
          </Button>

          {dispute.dispute_status !== 'resolved' && (
            <Button
              variant="secondary"
              onClick={() => setShowResolveModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
            >
              <Gavel size={15} />
              Adjudicate Claim
            </Button>
          )}
        </div>
      </div>

      {feedback && <Alert type={feedback.type}>{feedback.message}</Alert>}

      {/* Overview Grid */}
      <ContentCard title="Delivery & Produce Context">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Produce & Quality</span>
            <strong style={{ fontSize: '15px' }}>{dispute.crop_name}</strong>
            <span style={{ fontSize: '12px', color: '#4b5563', display: 'block' }}>{dispute.grade_name}</span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Farmer / Producer</span>
            <strong style={{ fontSize: '15px' }}>{dispute.farmer_name}</strong>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>{dispute.farmer_email}</span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Agreed Unit Price</span>
            <strong style={{ fontSize: '15px' }}>{formatLkr(dispute.agreed_unit_price_cents)}/kg</strong>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Order ID</span>
            <strong style={{ fontSize: '14px' }}>#{dispute.order_id.slice(0, 8)}</strong>
          </div>
        </div>

        {/* Quantities breakdown */}
        <div
          style={{
            marginTop: '20px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Agreed Weight</span>
            <strong style={{ fontSize: '16px', color: '#1e293b' }}>{dispute.agreed_kg?.toFixed(1)} kg</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Handed-Over</span>
            <strong style={{ fontSize: '16px', color: '#1e293b' }}>{dispute.handed_over_kg?.toFixed(1)} kg</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#059669', display: 'block' }}>Accepted</span>
            <strong style={{ fontSize: '16px', color: '#059669' }}>{dispute.accepted_kg?.toFixed(1)} kg</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#dc2626', display: 'block' }}>Disputed / Held</span>
            <strong style={{ fontSize: '16px', color: '#dc2626' }}>{dispute.disputed_kg?.toFixed(1)} kg</strong>
            <span style={{ fontSize: '11px', color: '#dc2626', display: 'block' }}>{formatLkr(dispute.disputed_cents)}</span>
          </div>
        </div>
      </ContentCard>

      {/* Buyer's Claim & Reason */}
      <ContentCard title="Buyer Inspection Claim & Notes">
        <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldAlert size={16} color="#ea580c" />
            <strong style={{ fontSize: '14px', color: '#9a3412' }}>Inspection Findings:</strong>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#7c2d12', lineHeight: 1.5 }}>
            {dispute.reason}
          </p>
        </div>

        {/* Evidence files */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Attached QA Evidence & References ({evidenceList.length})
          </h4>
          {evidenceList.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No external evidence files attached.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {evidenceList.map((ev: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="#64748b" />
                    <strong>{ev.label || `Evidence #${idx + 1}`}</strong>
                  </span>
                  <span style={{ color: '#475569', fontSize: '12px' }}>{ev.url || 'Internal attachment'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ContentCard>

      {/* Resolution Dossier */}
      {dispute.dispute_status === 'resolved' ? (
        <ContentCard title="Platform Adjudication & Resolution">
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={18} color="#16a34a" />
              <strong style={{ fontSize: '15px', color: '#15803d' }}>Dispute Formally Resolved</strong>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534', lineHeight: 1.5 }}>
              {dispute.resolution || 'Resolution decision documented by platform administrator.'}
            </p>
            <span style={{ fontSize: '12px', color: '#15803d' }}>
              Resolved by <strong>{dispute.resolver_name || 'System Admin'}</strong> on{' '}
              {dispute.resolved_at ? new Date(dispute.resolved_at).toLocaleString() : 'N/A'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Resolved Produce Quantity</span>
              <strong style={{ fontSize: '15px' }}>{dispute.resolved_kg?.toFixed(1)} kg</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#059669', display: 'block' }}>Farmer Payout Release</span>
              <strong style={{ fontSize: '15px', color: '#059669' }}>{formatLkr(dispute.settlement_cents)}</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#2563eb', display: 'block' }}>Buyer Refund Credited</span>
              <strong style={{ fontSize: '15px', color: '#2563eb' }}>{formatLkr(dispute.refund_cents)}</strong>
            </div>
          </div>
        </ContentCard>
      ) : (
        <ContentCard title="Adjudication Status & Escrow Guarantee">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
            <Info size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '14px', color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                Pending Platform Review ({dispute.dispute_status === 'under_review' ? 'In Mediation' : 'Queued'})
              </strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>
                Under YieldMatrix rule FR-ORD-08, disputed funds ({formatLkr(dispute.disputed_cents)}) remain securely locked in the smart escrow contract. Use the "Adjudicate Claim" button to simulate or execute administrative resolution.
              </p>
            </div>
          </div>
        </ContentCard>
      )}

      {/* Adjudication Modal */}
      {showResolveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '550px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={20} color="#15803d" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Adjudicate & Settle Dispute</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Adjudicate claim for <strong>{dispute.disputed_kg?.toFixed(1)} kg</strong> ({formatLkr(dispute.disputed_cents)}).
              Determine refund to buyer vs payout to farmer.
            </p>

            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Approved Disputed Quantity (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={dispute.disputed_kg}
                  value={resolvedKg}
                  onChange={(e) => setResolvedKg(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#2563eb' }}>
                    Refund to Buyer (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refundLkr}
                    onChange={(e) => setRefundLkr(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#16a34a' }}>
                    Release to Farmer (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settlementLkr}
                    onChange={(e) => setSettlementLkr(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Formal Verdict & Explanation
                </label>
                <textarea
                  rows={3}
                  value={resolveVerdict}
                  onChange={(e) => setResolveVerdict(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <Button variant="outline" type="button" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resolving}>
                  {resolving ? 'Applying Verdict…' : 'Confirm Adjudication & Release'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
