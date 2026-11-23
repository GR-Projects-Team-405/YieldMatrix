import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
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
  type BuyerTransactionDetailResponse,
} from './utils';

export default function TransactionDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerTransactionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!entryId) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get<BuyerTransactionDetailResponse>(`/ym28/buyer/transactions/${entryId}`, { signal });
        setData(res.data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(extractApiError(err, 'Could not load transaction details.').message);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [entryId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail]);

  return (
    <div className="ym28-stack">
      <BuyerSubNav />

      <div>
        <Button variant="outline" onClick={() => navigate('/buyer/wallet')}>
          ← Back to Buyer Wallet
        </Button>
      </div>

      {loading ? (
        <ContentCard title="Transaction details">
          <p role="status" className="ym28-muted">
            Loading transaction details…
          </p>
        </ContentCard>
      ) : error || !data ? (
        <ContentCard title="Transaction unavailable">
          <Alert type="error">{error || 'Transaction not found.'}</Alert>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Button variant="outline" onClick={() => void loadDetail()}>
              Retry
            </Button>
          </div>
        </ContentCard>
      ) : (
        <>
          <ContentCard
            title={`Transaction · ${humanizeLabel(data.transaction.eventType)}`}
            subtitle={data.transaction.eventReference}
          >
            {data.transaction.reversedById && (
              <div style={{ marginBottom: 16 }}>
                <Alert type="warning">
                  This journal entry was reversed by linked entry{' '}
                  <span className="ym28-mono">{data.transaction.reversedById}</span>. Original entries remain immutable.
                </Alert>
              </div>
            )}

            <div className="ym28-meta-grid">
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Entry ID</span>
                <span className="ym28-meta-value ym28-mono">{data.transaction.id}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Amount (Simulated)</span>
                <span className="ym28-meta-value">{formatLkrCents(data.transaction.amountCents)}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Occurred (Asia/Colombo)</span>
                <span className="ym28-meta-value">{formatColomboDateTime(data.transaction.occurredAt)}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Recorded by</span>
                <span className="ym28-meta-value">
                  {data.transaction.actorName} ({humanizeLabel(data.transaction.actorRole)})
                </span>
              </div>
            </div>
          </ContentCard>

          <ContentCard
            title="Balanced double-entry journal lines"
            subtitle="Every simulated wallet event posts equal debits and credits in integer LKR cents."
          >
            <Table headers={['Wallet', 'Bucket', 'Side', 'Amount']}>
              {data.transaction.lines.map((line) => (
                <TableRow key={line.id}>
                  <td>
                    <strong>{line.walletLabel}</strong>
                    <div className="ym28-muted">{humanizeLabel(line.accountType)}</div>
                  </td>
                  <td>{humanizeLabel(line.bucket)}</td>
                  <td>
                    <StatusBadge status={line.side === 'credit' ? 'Confirmed' : 'Pending'} />
                    <span style={{ marginLeft: 8 }}>{humanizeLabel(line.side)}</span>
                  </td>
                  <td>
                    <strong>{formatLkrCents(line.amountCents)}</strong>
                  </td>
                </TableRow>
              ))}
            </Table>
          </ContentCard>

          {data.transaction.order && (
            <ContentCard title="Linked order reference" subtitle={`Order ID: ${data.transaction.order.id}`}>
              <div className="ym28-meta-grid">
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Status</span>
                  <span className="ym28-meta-value">
                    <StatusBadge status={humanizeLabel(data.transaction.order.status)} />
                  </span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Destination</span>
                  <span className="ym28-meta-value">
                    {data.transaction.order.destination} ({data.transaction.order.destinationDistrict})
                  </span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Delivery date</span>
                  <span className="ym28-meta-value">{formatColomboDate(data.transaction.order.deliveryDate)}</span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Agreed goods total</span>
                  <span className="ym28-meta-value">{formatLkrCents(data.transaction.order.agreedTotalCents)}</span>
                </div>
              </div>
            </ContentCard>
          )}

          {data.transaction.allocation && (
            <ContentCard
              title="Linked allocation settlement breakdown"
              subtitle={`Supplier: ${data.transaction.allocation.farmerName}`}
            >
              <div className="ym28-meta-grid">
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Agreed / Accepted</span>
                  <span className="ym28-meta-value">
                    {formatKg(data.transaction.allocation.agreedKg)} /{' '}
                    {formatKg(data.transaction.allocation.acceptedKg)}
                  </span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Funded</span>
                  <span className="ym28-meta-value">{formatLkrCents(data.transaction.allocation.fundedCents)}</span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Settled</span>
                  <span className="ym28-meta-value">{formatLkrCents(data.transaction.allocation.settledCents)}</span>
                </div>
                <div className="ym28-meta-item">
                  <span className="ym28-meta-label">Refunded / Remaining held</span>
                  <span className="ym28-meta-value">
                    {formatLkrCents(data.transaction.allocation.refundedCents)} /{' '}
                    {formatLkrCents(data.transaction.allocation.heldCents)}
                  </span>
                </div>
              </div>
            </ContentCard>
          )}
        </>
      )}
    </div>
  );
}