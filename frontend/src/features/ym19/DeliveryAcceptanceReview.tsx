import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Table, TableRow } from '../../components/Table';
import { Alert } from '../../components/Alert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { CheckCircle2, AlertTriangle, Eye, ShieldAlert, RefreshCw } from 'lucide-react';

export interface DeliveryAllocation {
  id: string;
  order_id: string;
  batch_id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_email: string;
  farm_name: string | null;
  farm_district: string | null;
  crop_name: string;
  grade_name: string;
  agreed_kg: number;
  agreed_unit_price_cents: string;
  agreed_value_cents: string;
  committed_kg: number;
  picked_up_kg: number;
  handed_over_kg: number;
  accepted_kg: number;
  funded_cents: string;
  settled_cents: string;
  refunded_cents: string;
  held_cents: string;
  allocation_status: string;
  created_at: string;
  destination: string;
  delivery_date: string;
  order_status: string;
  dispute_count: number;
}

export interface SummaryMetrics {
  pending_acceptance: string;
  total_accepted: string;
  total_partial: string;
  total_disputed: string;
  total_deliveries: string;
  open_disputes: string;
  total_disputed_cents: string;
}

export function DeliveryAcceptanceReview() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<DeliveryAllocation[]>([]);
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Full acceptance confirmation dialog state
  const [acceptDialog, setAcceptDialog] = useState<{ open: boolean; allocation: DeliveryAllocation | null; busy: boolean }>({
    open: false,
    allocation: null,
    busy: false,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [delivRes, summaryRes] = await Promise.all([
        api.get('/ym19/deliveries?status=all'),
        api.get('/ym19/summary'),
      ]);
      setDeliveries(delivRes.data.deliveries || []);
      setMetrics(summaryRes.data.metrics || null);
      setFeedback(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to load delivery records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFullAccept = async () => {
    if (!acceptDialog.allocation) return;
    setAcceptDialog((prev) => ({ ...prev, busy: true }));
    try {
      await api.post(`/ym19/allocations/${acceptDialog.allocation.id}/accept`, {
        notes: 'Full QA acceptance confirmed by buyer upon handover',
      });
      setFeedback({
        type: 'success',
        message: `Allocation #${acceptDialog.allocation.id.slice(0, 8)} accepted in full. Financial settlement triggered.`,
      });
      setAcceptDialog({ open: false, allocation: null, busy: false });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to record full acceptance' });
      setAcceptDialog((prev) => ({ ...prev, busy: false }));
    }
  };

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === 'all') return deliveries;
    if (statusFilter === 'awaiting') {
      return deliveries.filter((d) => ['handed_over', 'picked_up'].includes(d.allocation_status));
    }
    return deliveries.filter((d) => d.allocation_status === statusFilter);
  }, [deliveries, statusFilter]);

  const formatLkr = (centsStr: string | number) => {
    const cents = typeof centsStr === 'string' ? parseInt(centsStr, 10) : centsStr;
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="ym19-delivery-acceptance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Awaiting QA Acceptance"
          value={metrics?.pending_acceptance || '0'}
          subtext="Delivered batches awaiting buyer verification"
          highlight={parseInt(metrics?.pending_acceptance || '0', 10) > 0}
        />
        <StatCard
          label="Accepted Batches"
          value={metrics?.total_accepted || '0'}
          subtext="Full deliveries successfully settled"
        />
        <StatCard
          label="Partially Accepted"
          value={metrics?.total_partial || '0'}
          subtext="Batches with quality or weight deductions"
        />
        <StatCard
          label="Active Disputes"
          value={metrics?.open_disputes || '0'}
          subtext={`Value held: ${formatLkr(metrics?.total_disputed_cents || '0')}`}
        />
      </div>

      {feedback && (
        <Alert type={feedback.type}>{feedback.message}</Alert>
      )}

      {/* Main Table Card */}
      <ContentCard
        title="Delivery Acceptance Review"
        subtitle="Verify delivered produce quality and recorded weights before final financial release"
      >
        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: '#fff' }}
            >
              <option value="all">All Statuses ({deliveries.length})</option>
              <option value="awaiting">Awaiting Review</option>
              <option value="accepted">Accepted</option>
              <option value="partially_accepted">Partially Accepted</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>

          <Button variant="outline" onClick={loadData} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>Loading delivery records…</p>
        ) : filteredDeliveries.length === 0 ? (
          <EmptyState
            title="No deliveries match the filter"
            description="When suppliers and drivers deliver produce to your destination, they will appear here for QA review and acceptance."
          />
        ) : (
          <Table
            headers={[
              'Allocation / Batch',
              'Crop & Grade',
              'Farmer & Farm',
              'Delivered / Agreed',
              'Unit Price',
              'Total Value',
              'Status',
              'QA Review Actions',
            ]}
          >
            {filteredDeliveries.map((item) => {
              const deliveredWeight = item.handed_over_kg > 0 ? item.handed_over_kg : item.picked_up_kg;
              const isAwaiting = ['handed_over', 'picked_up'].includes(item.allocation_status);

              return (
                <TableRow key={item.id}>
                  <td>
                    <strong style={{ display: 'block', fontSize: '13px' }}>#{item.id.slice(0, 8)}</strong>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Order #{item.order_id.slice(0, 8)}</span>
                  </td>
                  <td>
                    <strong>{item.crop_name}</strong>
                    <span style={{ display: 'block', fontSize: '12px', color: '#4b5563' }}>{item.grade_name}</span>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.farmer_name}</div>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {item.farm_name || 'Direct Farm'} ({item.farm_district || 'Regional'})
                    </span>
                  </td>
                  <td>
                    <strong>{deliveredWeight.toFixed(1)} kg</strong>
                    <span style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>
                      Agreed: {item.agreed_kg.toFixed(1)} kg
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {formatLkr(item.agreed_unit_price_cents)}/kg
                  </td>
                  <td>
                    <strong>{formatLkr(item.agreed_value_cents)}</strong>
                    {item.accepted_kg > 0 && (
                      <span style={{ display: 'block', fontSize: '12px', color: '#059669' }}>
                        Accepted: {item.accepted_kg.toFixed(1)} kg
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={item.allocation_status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isAwaiting ? (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => setAcceptDialog({ open: true, allocation: item, busy: false })}
                            title="Accept 100% of delivered quantity"
                            style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={14} />
                            Full Accept
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => navigate(`/buyer/acceptance/partial/${item.id}`)}
                            title="Accept partial kg and dispute remainder"
                            style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <AlertTriangle size={14} />
                            Partial
                          </Button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#4b5563', fontStyle: 'italic' }}>
                            {item.allocation_status === 'accepted' ? 'Accepted & Settled' : 'Processed'}
                          </span>
                          {item.dispute_count > 0 && (
                            <Button
                              variant="outline"
                              onClick={() => navigate('/buyer/disputes')}
                              title="View related disputes"
                              style={{ padding: '4px 8px', fontSize: '11px', height: 'auto' }}
                            >
                              <ShieldAlert size={12} style={{ marginRight: '3px' }} />
                              Dispute
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </TableRow>
              );
            })}
          </Table>
        )}
      </ContentCard>

      {/* Confirmation Modal for Full Delivery Acceptance */}
      <ConfirmDialog
        open={acceptDialog.open}
        title="Confirm Full Delivery Acceptance"
        description={
          acceptDialog.allocation
            ? `Are you sure you want to accept all ${(acceptDialog.allocation.handed_over_kg || acceptDialog.allocation.picked_up_kg).toFixed(1)} kg of ${acceptDialog.allocation.crop_name} (${acceptDialog.allocation.grade_name}) from ${acceptDialog.allocation.farmer_name}? This action will permanently settle the agreed amount (${formatLkr(acceptDialog.allocation.agreed_value_cents)}) to the farmer's wallet.`
            : 'Confirm full acceptance of this allocation.'
        }
        confirmLabel="Accept & Release Payment"
        busy={acceptDialog.busy}
        onCancel={() => setAcceptDialog({ open: false, allocation: null, busy: false })}
        onConfirm={handleFullAccept}
      />
    </div>
  );
}
