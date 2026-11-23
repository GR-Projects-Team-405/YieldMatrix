import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  formatColomboDate,
  formatColomboDateTime,
  formatKg,
  formatLkrCents,
  humanizeLabel,
  isAbortError,
  isPositiveCents,
  shortId,
  type BuyerHeldFundsResponse,
} from './utils';

export default function HeldFundsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerHeldFundsResponse | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHolds = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<BuyerHeldFundsResponse>('/ym28/buyer/holds', {
          params: includeResolved ? { includeResolved: 'true' } : {},
          signal,
        });
        setData(res.data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(extractApiError(err, 'Could not load held funds by order.').message);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [includeResolved]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadHolds(controller.signal);
    return () => controller.abort();
  }, [loadHolds]);

  return (
    <div className="ym28-stack">
      <BuyerSubNav />

      <Alert type="info">
        <strong>How Simulated Order Holds Work:</strong> When you confirm a bulk order, the agreed goods total is moved
        from <em>Available</em> to <em>Held</em>. Accepted quantities settle to each farmer while disputed portions stay
        held until resolved.
      </Alert>

      <div className="ym28-toolbar" style={{ marginBottom: 0 }}>
        <label className="ym28-checkbox">
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
          />
          <span>Include fully settled and refunded orders</span>
        </label>
        <Button variant="outline" onClick={() => void loadHolds()}>
          Refresh holds
        </Button>
      </div>

      {error ? (
        <ContentCard title="Held funds unavailable">
          <Alert type="error">{error}</Alert>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void loadHolds()}>
              Retry
            </Button>
          </div>
        </ContentCard>
      ) : loading || !data ? (
        <ContentCard title="Held funds by order">
          <p role="status" className="ym28-muted">
            Loading order and allocation holds…
          </p>
        </ContentCard>
      ) : (
        <>
          {!data.holdsAligned ? (
            <Alert type="error">
              Wallet held balance ({formatLkrCents(data.walletHeldCents)}) differs from active allocation holds (
              {formatLkrCents(data.totalAllocationHeldCents)}). Please notify an administrator for reconciliation.
            </Alert>
          ) : (
            <Alert type="success">
              Simulated wallet holds match active order allocations ({formatLkrCents(data.walletHeldCents)} held).
            </Alert>
          )}

          <div className="ym28-stat-grid">
            <StatCard
              label="Wallet held balance (Simulated)"
              value={formatLkrCents(data.walletHeldCents)}
              subtext="Protected in your Buyer Agri Wallet"
              highlight
            />
            <StatCard
              label="Order allocations held"
              value={formatLkrCents(data.totalAllocationHeldCents)}
              subtext={`Across ${data.orders.length} displayed order(s)`}
            />
            <StatCard
              label="Total funded (Shown orders)"
              value={formatLkrCents(data.totalAllocationFundedCents)}
              subtext="Funded = Settled + Refunded + Held"
            />
            <StatCard
              label="Settled / Refunded"
              value={formatLkrCents(data.totalAllocationSettledCents)}
              subtext={`Refunded: ${formatLkrCents(data.totalAllocationRefundedCents)}`}
            />
          </div>

          {data.orders.length === 0 ? (
            <EmptyState
              title={includeResolved ? 'No funded orders found' : 'No active held funds'}
              description={
                includeResolved
                  ? 'You have no confirmed orders with funded allocations yet.'
                  : 'None of your orders currently have funds held in escrow. Confirmed orders will appear here with per-farmer allocation breakdowns.'
              }
              action={
                <div className="ym28-actions" style={{ justifyContent: 'center' }}>
                  {!includeResolved && (
                    <Button variant="outline" onClick={() => setIncludeResolved(true)}>
                      Show resolved orders
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => navigate('/buyer/wallet')}>
                    Back to wallet overview
                  </Button>
                </div>
              }
            />
          ) : (
            data.orders.map((order) => (
              <ContentCard
                key={order.orderId}
                title={`Order ${shortId(order.orderId)} · ${order.destinationDistrict}`}
                subtitle={`Destination: ${order.destination} · Delivery date: ${formatColomboDate(order.deliveryDate)} · Created: ${formatColomboDateTime(order.createdAt)}`}
              >
                <div className="ym28-order-header">
                  <div className="ym28-actions">
                    <StatusBadge status={humanizeLabel(order.orderStatus)} />
                    <span className="ym28-mono ym28-muted">Order ID: {order.orderId}</span>
                  </div>
                  <div className="ym28-actions">
                    <span className="ym28-muted">
                      Funded: <strong>{formatLkrCents(order.orderFundedCents)}</strong>
                    </span>
                    <span className="ym28-muted">
                      Settled: <strong>{formatLkrCents(order.orderSettledCents)}</strong>
                    </span>
                    <span className="ym28-muted">
                      Refunded: <strong>{formatLkrCents(order.orderRefundedCents)}</strong>
                    </span>
                    <span className={isPositiveCents(order.orderHeldCents) ? 'ym28-amount-pos' : 'ym28-muted'}>
                      Held: {formatLkrCents(order.orderHeldCents)}
                    </span>
                  </div>
                </div>

                <Table
                  headers={[
                    'Supplier & Batch',
                    'Agreed / Accepted',
                    'Unit price',
                    'Funded',
                    'Settled',
                    'Refunded',
                    'Remaining held',
                    'Status',
                  ]}
                >
                  {order.allocations.map((alloc) => (
                    <TableRow key={alloc.allocationId}>
                      <td>
                        <strong>{alloc.farmerName}</strong>
                        <div className="ym28-mono ym28-muted">Batch: {shortId(alloc.batchId)}</div>
                      </td>
                      <td>
                        <div>{formatKg(alloc.agreedKg)}</div>
                        <div className="ym28-muted">Accepted: {formatKg(alloc.acceptedKg)}</div>
                      </td>
                      <td>{formatLkrCents(alloc.agreedUnitPriceCents)} / kg</td>
                      <td>{formatLkrCents(alloc.fundedCents)}</td>
                      <td>{formatLkrCents(alloc.settledCents)}</td>
                      <td>{formatLkrCents(alloc.refundedCents)}</td>
                      <td>
                        <strong>{formatLkrCents(alloc.heldCents)}</strong>
                      </td>
                      <td>
                        <StatusBadge status={humanizeLabel(alloc.status)} />
                      </td>
                    </TableRow>
                  ))}
                </Table>
              </ContentCard>
            ))
          )}
        </>
      )}
    </div>
  );
}