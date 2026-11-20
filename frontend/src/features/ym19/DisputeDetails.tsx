import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { ArrowLeft, ShieldAlert, CheckCircle, Clock, FileText, ExternalLink, Info } from 'lucide-react';

export function DisputeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDispute() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/ym19/disputes/${id}`);
        setDispute(res.data.dispute);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load dispute details');
      } finally {
        setLoading(false);
      }
    }
    fetchDispute();
  }, [id]);

  const formatLkr = (centsStr: string | number) => {
    const cents = typeof centsStr === 'string' ? parseInt(centsStr, 10) : centsStr;
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      </div>

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
              <span style={{ fontSize: '12px', color: '#059669', display: 'block' }}>Farmer Settlement</span>
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
                Under YieldMatrix rule FR-ORD-08, disputed funds ({formatLkr(dispute.disputed_cents)}) remain securely locked in the smart escrow contract. The platform administrator and supplier will review the evidence provided and determine final refund vs settlement amounts.
              </p>
            </div>
          </div>
        </ContentCard>
      )}
    </div>
  );
}
