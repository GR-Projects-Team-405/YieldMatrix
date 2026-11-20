import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { InputField } from '../../components/InputField';
import { ArrowLeft, AlertTriangle, ShieldAlert, Plus, Trash2, Check } from 'lucide-react';
import type { DeliveryAllocation } from './DeliveryAcceptanceReview';

export function PartialAcceptance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [allocation, setAllocation] = useState<DeliveryAllocation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form fields
  const [acceptedKg, setAcceptedKg] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('Damage or transit bruising');
  const [detailedReason, setDetailedReason] = useState<string>('');
  const [evidenceList, setEvidenceList] = useState<{ label: string; url: string }[]>([]);
  const [newEvidenceLabel, setNewEvidenceLabel] = useState<string>('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState<string>('');

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await api.get(`/ym19/allocations/${id}`);
        const alloc = res.data.allocation;
        setAllocation(alloc);

        // Pre-fill default suggested accepted kg (e.g. 90% or 0)
        const delivered = alloc.handed_over_kg > 0 ? alloc.handed_over_kg : alloc.picked_up_kg;
        setAcceptedKg(Math.max(0, delivered - 10).toString());
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to load allocation detail' });
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id]);

  const deliveredKg = allocation
    ? allocation.handed_over_kg > 0
      ? allocation.handed_over_kg
      : allocation.picked_up_kg
    : 0;

  const unitPriceCents = allocation ? parseInt(allocation.agreed_unit_price_cents, 10) : 0;
  const acceptedKgNum = parseFloat(acceptedKg) || 0;
  const disputedKg = Math.max(0, deliveredKg - acceptedKgNum);

  const acceptedValueCents = Math.round(acceptedKgNum * unitPriceCents);
  const disputedValueCents = Math.round(disputedKg * unitPriceCents);

  const formatLkr = (cents: number) => {
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAddEvidence = () => {
    if (!newEvidenceLabel.trim()) return;
    setEvidenceList((prev) => [
      ...prev,
      { label: newEvidenceLabel.trim(), url: newEvidenceUrl.trim() || 'Internal inspection photo' },
    ]);
    setNewEvidenceLabel('');
    setNewEvidenceUrl('');
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocation) return;

    if (acceptedKgNum < 0) {
      setFeedback({ type: 'error', message: 'Accepted quantity cannot be negative.' });
      return;
    }

    if (acceptedKgNum >= deliveredKg) {
      setFeedback({
        type: 'error',
        message: `Accepted quantity (${acceptedKgNum} kg) must be less than delivered quantity (${deliveredKg} kg). For full quantity, use Full Acceptance.`,
      });
      return;
    }

    const fullReason = `${reasonCategory}: ${detailedReason.trim()}`;
    if (!detailedReason.trim()) {
      setFeedback({ type: 'error', message: 'Please provide detailed explanation notes for the QA deduction.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);

      await api.post(`/ym19/allocations/${allocation.id}/partial-accept`, {
        acceptedKg: acceptedKgNum,
        reason: fullReason,
        evidence: evidenceList,
      });

      setFeedback({
        type: 'success',
        message: `Partial acceptance recorded! ${acceptedKgNum.toFixed(1)} kg accepted, ${disputedKg.toFixed(1)} kg routed to dispute resolution.`,
      });

      setTimeout(() => {
        navigate('/buyer/disputes');
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to submit partial acceptance' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ContentCard title="Partial Acceptance & Dispute Recording">
        <p style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading allocation details…</p>
      </ContentCard>
    );
  }

  if (!allocation) {
    return (
      <ContentCard title="Allocation Not Found">
        <Alert type="error">Could not find delivery allocation with ID: {id}</Alert>
        <div style={{ marginTop: '16px' }}>
          <Button variant="outline" onClick={() => navigate('/buyer/acceptance')}>
            Back to Acceptance Review
          </Button>
        </div>
      </ContentCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button variant="outline" onClick={() => navigate('/buyer/acceptance')} style={{ padding: '6px 12px' }}>
          <ArrowLeft size={16} style={{ marginRight: '4px' }} />
          Back
        </Button>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Partial Acceptance & Quality Dispute</h2>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Allocation #{allocation.id.slice(0, 8)} · Order #{allocation.order_id.slice(0, 8)}
          </span>
        </div>
      </div>

      {feedback && <Alert type={feedback.type}>{feedback.message}</Alert>}

      {/* Allocation Overview Card */}
      <ContentCard title="Delivered Batch Details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Crop & Grade</span>
            <strong style={{ fontSize: '15px' }}>{allocation.crop_name}</strong> ({allocation.grade_name})
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Farmer / Supplier</span>
            <strong style={{ fontSize: '15px' }}>{allocation.farmer_name}</strong>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>{allocation.farm_name || 'Farm'}</span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Delivered Quantity</span>
            <strong style={{ fontSize: '16px', color: '#111827' }}>{deliveredKg.toFixed(1)} kg</strong>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Agreed Unit Price</span>
            <strong style={{ fontSize: '15px' }}>{formatLkr(unitPriceCents)}/kg</strong>
          </div>
        </div>
      </ContentCard>

      {/* Calculation & Deduction Preview Box */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, display: 'block' }}>Delivered Quantity</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>{deliveredKg.toFixed(1)} kg</span>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#059669', fontWeight: 500, display: 'block' }}>To Accept & Settle</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>{acceptedKgNum.toFixed(1)} kg</span>
          <span style={{ fontSize: '11px', color: '#059669', display: 'block' }}>{formatLkr(acceptedValueCents)}</span>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500, display: 'block' }}>To Dispute & Hold</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{disputedKg.toFixed(1)} kg</span>
          <span style={{ fontSize: '11px', color: '#dc2626', display: 'block' }}>{formatLkr(disputedValueCents)}</span>
        </div>
      </div>

      {/* Form Submission */}
      <form onSubmit={handleSubmit}>
        <ContentCard title="Record Accepted Quantity & Dispute Justification">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Accepted Quantity (kg) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                max={deliveredKg - 0.001}
                value={acceptedKg}
                onChange={(e) => setAcceptedKg(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter quantity of acceptable produce in kg"
              />
              <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                Must be strictly less than delivered quantity ({deliveredKg.toFixed(1)} kg).
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Primary Defect Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Damage or transit bruising">Damage or transit bruising</option>
                <option value="Grade or quality mismatch with order">Grade or quality mismatch with order</option>
                <option value="Weight shortfall / Dehydration loss">Weight shortfall / Dehydration loss</option>
                <option value="Premature decay / rot / over-ripeness">Premature decay / rot / over-ripeness</option>
                <option value="Pest damage / foreign matter contamination">Pest damage / foreign matter contamination</option>
                <option value="Other QA non-conformance">Other QA non-conformance</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Detailed Explanation & Inspection Notes <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={detailedReason}
                onChange={(e) => setDetailedReason(e.target.value)}
                required
                placeholder="Explain the inspection findings, measured rejection kg, and QA rationale for withholding settlement..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Evidence items */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                Supporting Inspection Evidence (Photos, Weighbridge slips, Reports)
              </label>

              {evidenceList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {evidenceList.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <span>
                        <strong>{item.label}</strong> — <span style={{ color: '#64748b' }}>{item.url}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(index)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Evidence title (e.g. Bruising photo)"
                  value={newEvidenceLabel}
                  onChange={(e) => setNewEvidenceLabel(e.target.value)}
                  style={{ flex: 1, minWidth: '180px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
                <input
                  type="text"
                  placeholder="Reference URL or ticket number"
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  style={{ flex: 1, minWidth: '180px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
                <Button variant="outline" type="button" onClick={handleAddEvidence} style={{ fontSize: '12px', padding: '6px 12px' }}>
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  Add
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <Button variant="outline" type="button" onClick={() => navigate('/buyer/acceptance')}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting Dispute…' : 'Confirm Partial Acceptance & Submit Dispute'}
              </Button>
            </div>
          </div>
        </ContentCard>
      </form>
    </div>
  );
}
