import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Table, TableRow } from '../../components/Table';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { ShieldAlert, Eye, RefreshCw, Filter, Search } from 'lucide-react';

export interface DisputeRecord {
  id: string;
  allocation_id: string;
  order_id: string;
  raised_by: string;
  buyer_name: string;
  farmer_name: string;
  crop_name: string;
  grade_name: string;
  disputed_kg: number;
  disputed_cents: string;
  reason: string;
  evidence: any;
  dispute_status: 'open' | 'under_review' | 'resolved';
  resolved_kg: number;
  settlement_cents: string;
  refund_cents: string;
  resolution: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  created_at: string;
  agreed_kg: number;
  handed_over_kg: number;
  accepted_kg: number;
  agreed_unit_price_cents: string;
}

export function MyDisputes() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/ym19/disputes');
      setDisputes(res.data.disputes || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const formatLkr = (centsStr: string | number) => {
    const cents = typeof centsStr === 'string' ? parseInt(centsStr, 10) : centsStr;
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered & searched disputes
  const filteredDisputes = useMemo(() => {
    return disputes.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.dispute_status === statusFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        item.crop_name.toLowerCase().includes(term) ||
        item.farmer_name.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        item.order_id.toLowerCase().includes(term) ||
        item.reason.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [disputes, statusFilter, searchTerm]);

  // Metric counts
  const openCount = disputes.filter((d) => d.dispute_status === 'open').length;
  const underReviewCount = disputes.filter((d) => d.dispute_status === 'under_review').length;
  const resolvedCount = disputes.filter((d) => d.dispute_status === 'resolved').length;
  const totalDisputedCents = disputes.reduce((sum, d) => sum + parseInt(d.disputed_cents || '0', 10), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Total Disputes"
          value={disputes.length}
          subtext="Recorded quality & weight claims"
        />
        <StatCard
          label="Open / Pending Action"
          value={openCount}
          subtext="Awaiting platform review"
          highlight={openCount > 0}
        />
        <StatCard
          label="Under Review"
          value={underReviewCount}
          subtext="Active admin mediation"
        />
        <StatCard
          label="Total Disputed Value"
          value={formatLkr(totalDisputedCents)}
          subtext={`${resolvedCount} disputes resolved`}
        />
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <ContentCard
        title="My Disputes & Resolution Tracking"
        subtitle="Track submitted quality claims, evidence, and settlement adjustments adjudicated by the platform"
      >
        {/* Controls: Search & Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter buttons */}
            {[
              { id: 'all', label: `All (${disputes.length})` },
              { id: 'open', label: `Open (${openCount})` },
              { id: 'under_review', label: `Under Review (${underReviewCount})` },
              { id: 'resolved', label: `Resolved (${resolvedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: statusFilter === tab.id ? '1px solid #16a34a' : '1px solid #d1d5db',
                  backgroundColor: statusFilter === tab.id ? '#f0fdf4' : '#fff',
                  color: statusFilter === tab.id ? '#15803d' : '#374151',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search crop, farmer, ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '6px 12px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  minWidth: '200px',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            </div>

            <Button variant="outline" onClick={loadDisputes} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>Loading dispute history…</p>
        ) : filteredDisputes.length === 0 ? (
          <EmptyState
            title="No disputes found"
            description={
              disputes.length === 0
                ? 'You have not raised any delivery disputes. Any partial acceptances or rejections will appear here.'
                : 'No disputes match your selected filter or search term.'
            }
            action={
              disputes.length === 0 ? (
                <Button variant="secondary" onClick={() => navigate('/buyer/acceptance')}>
                  Go to Delivery Acceptance
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table
            headers={[
              'Dispute ID',
              'Crop & Grade',
              'Farmer / Supplier',
              'Disputed Weight',
              'Disputed Amount',
              'Reason Summary',
              'Status',
              'Actions',
            ]}
          >
            {filteredDisputes.map((d) => (
              <TableRow key={d.id}>
                <td>
                  <strong style={{ fontSize: '13px' }}>#{d.id.slice(0, 8)}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: '#6b7280' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </td>
                <td>
                  <strong>{d.crop_name}</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: '#4b5563' }}>{d.grade_name}</span>
                </td>
                <td style={{ fontSize: '13px' }}>{d.farmer_name}</td>
                <td>
                  <strong style={{ color: '#dc2626' }}>{d.disputed_kg.toFixed(1)} kg</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: '#6b7280' }}>
                    Agreed: {d.agreed_kg.toFixed(1)} kg
                  </span>
                </td>
                <td>
                  <strong style={{ color: '#dc2626' }}>{formatLkr(d.disputed_cents)}</strong>
                  {d.dispute_status === 'resolved' && (
                    <span style={{ display: 'block', fontSize: '11px', color: '#059669' }}>
                      Refund: {formatLkr(d.refund_cents)}
                    </span>
                  )}
                </td>
                <td style={{ maxWidth: '240px', fontSize: '12px', color: '#374151' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.reason}>
                    {d.reason}
                  </div>
                </td>
                <td>
                  <StatusBadge status={d.dispute_status} />
                </td>
                <td>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/buyer/disputes/${d.id}`)}
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Eye size={14} />
                    View Details
                  </Button>
                </td>
              </TableRow>
            ))}
          </Table>
        )}
      </ContentCard>
    </div>
  );
}
