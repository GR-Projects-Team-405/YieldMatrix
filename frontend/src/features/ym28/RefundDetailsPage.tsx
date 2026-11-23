import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import BuyerSubNav from './BuyerSubNav';
import {
  extractApiError,
  formatColomboDateTime,
  formatKg,
  formatLkrCents,
  humanizeLabel,
  isAbortError,
  shortId,
  type BuyerRefundsResponse,
} from './utils';

export default function RefundDetailsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerRefundsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRefunds = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<BuyerRefundsResponse>('/ym28/buyer/refunds', {
          params: { page, limit: 15 },
          signal,
        });
        setData(res.data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(extractApiError(err, 'Could not load refund details.').message);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadRefunds(controller.signal);
    return () => controller.abort();
  }, [loadRefunds]);

  return (
    <div className="ym28-stack">
      <BuyerSubNav />

      <Alert type="warning">
        <strong>Simulated Refund Records:</strong> Refunds release authorised cancelled or dispute-resolved value back
        to your simulated available wallet balance. Total settlement plus refund never exceeds the funded allocation
        amount.
      </Alert>

      {error ? (
        <ContentCard title="Refund details unavailable">
          <Alert type="error">{error}</Alert>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void loadRefunds()}>
              Retry
            </Button>
          </div>
        </ContentCard>
      ) : loading || !data ? (
        <ContentCard title="Refund details">
          <p role="status" className="ym28-muted">
            Loading simulated refund history and disputes…
          </p>
        </ContentCard>
      ) : (
        <>
          <div className="ym28-stat-grid">
            <StatCard
              label="Total refunded (Simulated)"
              value={formatLkrCents(data.summary.totalRefundedCents)}
              subtext="Credited back to available balance"
              highlight
            />
            <StatCard
              label="Posted refund entries"
              value={data.summary.totalRefundCount}
              subtext="Verified immutable journal records"
            />
            <StatCard
              label="Open / Under review disputes"
              value={data.summary.openDisputeCount}
              subtext="Disputed funds remain safely held"
            />
          </div>

          <ContentCard
            title="Posted refund transactions"
            subtitle="Refunds credited from cancelled pre-pickup orders or administrator-resolved allocation disputes."
          >
            <div className="ym28-actions" style={{ marginBottom: 16 }}>
              <Button variant="outline" onClick={() => void loadRefunds()}>
                Refresh refund records
              </Button>
            </div>

            {data.refunds.length === 0 ? (
              <EmptyState
                title="No refunds posted yet"
                description="When an approved order cancellation or delivery dispute returns held funds to your wallet, the full breakdown will appear here."
                action={
                  <Button variant="outline" onClick={() => navigate('/buyer/wallet/holds')}>
                    Check held funds by order
                  </Button>
                }
              />
            ) : (
              <>
                <Table
                  headers={[
                    'Date (Asia/Colombo)',
                    'Refund reference',
                    'Order & Supplier',
                    'Allocation breakdown',
                    'Reason / Resolution',
                    'Refunded',
                    'Journal',
                  ]}
                >
                  {data.refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <td>{formatColomboDateTime(refund.occurredAt)}</td>
                      <td>
                        <div>{refund.eventReference}</div>
                        <div className="ym28-mono ym28-muted">Entry: {shortId(refund.id)}</div>
                      </td>
                      <td>
                        <div>{refund.farmerName || 'Order-level refund'}</div>
                        <div className="ym28-mono ym28-muted">
                          {refund.orderId ? `Order: ${shortId(refund.orderId)}` : '—'}
                          {refund.destinationDistrict ? ` · ${refund.destinationDistrict}` : ''}
                        </div>
                      </td>
                      <td>
                        {refund.fundedCents !== null ? (
                          <div className="ym28-muted">
                            <div>Funded: {formatLkrCents(refund.fundedCents)}</div>
                            <div>Settled: {formatLkrCents(refund.settledCents)}</div>
                            <div>Held: {formatLkrCents(refund.allocationHeldCents)}</div>
                          </div>
                        ) : (
                          <span className="ym28-muted">—</span>
                        )}
                      </td>
                      <td>
                        {refund.dispute ? (
                          <div>
                            <StatusBadge status={humanizeLabel(refund.dispute.status)} />
                            <div className="ym28-muted" style={{ marginTop: 4 }}>
                              {refund.dispute.resolution || refund.dispute.reason}
                            </div>
                          </div>
                        ) : refund.cancellationReason ? (
                          <span className="ym28-muted">{refund.cancellationReason}</span>
                        ) : (
                          <span className="ym28-muted">Authorised refund</span>
                        )}
                      </td>
                      <td className="ym28-amount-pos">+{formatLkrCents(refund.amountCents)}</td>
                      <td>
                        <Link className="ym28-inline-link" to={`/buyer/wallet/transactions/${refund.id}`}>
                          Inspect
                        </Link>
                      </td>
                    </TableRow>
                  ))}
                </Table>

                <div className="ym28-pagination">
                  <span className="ym28-muted">
                    Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} refund(s))
                  </span>
                  <div className="ym28-actions">
                    <Button
                      variant="outline"
                      disabled={data.pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </ContentCard>

          <ContentCard
            title="Dispute & resolution status"
            subtitle="Track open disputes with held amounts alongside completed administrator settlements and refunds."
          >
            {data.disputes.length === 0 ? (
              <EmptyState
                title="No order disputes on record"
                description="All delivered allocations without quantity or quality disputes settle directly upon acceptance."
              />
            ) : (
              <Table
                headers={[
                  'Opened (Asia/Colombo)',
                  'Order & Supplier',
                  'Disputed qty & value',
                  'Settled / Refunded',
                  'Status',
                  'Reason & resolution',
                ]}
              >
                {data.disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <td>{formatColomboDateTime(dispute.createdAt)}</td>
                    <td>
                      <strong>{dispute.farmerName}</strong>
                      <div className="ym28-mono ym28-muted">Order: {shortId(dispute.orderId)}</div>
                    </td>
                    <td>
                      <div>{formatKg(dispute.disputedKg)}</div>
                      <div className="ym28-muted">{formatLkrCents(dispute.disputedCents)}</div>
                    </td>
                    <td>
                      <div>Settled: {formatLkrCents(dispute.settlementCents)}</div>
                      <div className="ym28-amount-pos">Refunded: {formatLkrCents(dispute.refundCents)}</div>
                    </td>
                    <td>
                      <StatusBadge status={humanizeLabel(dispute.status)} />
                    </td>
                    <td>
                      <div>{dispute.reason}</div>
                      {dispute.resolution && (
                        <div className="ym28-muted" style={{ marginTop: 4 }}>
                          Resolution: {dispute.resolution}
                        </div>
                      )}
                    </td>
                  </TableRow>
                ))}
              </Table>
            )}
          </ContentCard>
        </>
      )}
    </div>
  );
}