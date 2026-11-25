import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { badgeClass, formatCents, formatDateTime, shortCode, typeLabel, type ApiTransactionDetail } from './txApi';
import { useRecordsBase } from './useRecordsBase';

export default function TransactionDetails() {
  const { txId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const [tx, setTx] = useState<ApiTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api
      .get<{ transaction: ApiTransactionDetail }>(`/ym20/transactions/${txId}`, { signal: controller.signal })
      .then(({ data }) => {
        if (active) setTx(data.transaction);
      })
      .catch((e) => {
        if (active) setError(e?.response?.status === 404 ? 'Transaction not found.' : 'Could not load this transaction.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [txId]);

  if (loading) return <p role="status" className="text-sm opacity-70">Loading transaction...</p>;
  if (error || !tx) {
    return (
      <div className="space-y-4">
        <Alert type="error">{error || 'Transaction not found.'}</Alert>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </div>
    );
  }

  const steps =
    tx.type === 'hold'
      ? [
          { label: 'Funds held in escrow', done: true },
          { label: 'Delivery accepted', done: false },
          { label: 'Settlement released', done: false },
        ]
      : [{ label: `${typeLabel[tx.type] ?? tx.type} recorded`, done: true }];

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(base)}>
        ← Back to transaction history
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            {shortCode('TX', tx.id)}
            <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${badgeClass(tx.status)}`}>{tx.status}</span>
          </h1>
          <p className="text-sm opacity-70">{typeLabel[tx.type] ?? tx.type} · {formatDateTime(tx.occurredAt)}</p>
        </div>
        {tx.orderId && (
          <Button onClick={() => navigate(`${base}/orders/${tx.orderId}`)}>View order summary ↗</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentCard title="Transaction information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-[10px] tracking-wider opacity-70">AMOUNT</dt><dd className="font-semibold">{formatCents(tx.amountCents)}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">TYPE</dt><dd className="font-semibold">{typeLabel[tx.type] ?? tx.type}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">OCCURRED</dt><dd className="font-semibold">{formatDateTime(tx.occurredAt)}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">RECORDED</dt><dd className="font-semibold">{formatDateTime(tx.recordedAt)}</dd></div>
              <div className="col-span-2"><dt className="text-[10px] tracking-wider opacity-70">REFERENCE</dt><dd className="break-all font-semibold">{tx.reference}</dd></div>
            </dl>
          </ContentCard>

          {tx.orderId && (
            <ContentCard title="Linked order">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div><dt className="text-[10px] tracking-wider opacity-70">ORDER</dt><dd className="font-semibold">{shortCode('ORD', tx.orderId)}</dd></div>
                <div><dt className="text-[10px] tracking-wider opacity-70">ORDER STATUS</dt><dd className="font-semibold">{tx.orderStatus?.replace(/_/g, ' ') ?? '—'}</dd></div>
                <div><dt className="text-[10px] tracking-wider opacity-70">DELIVERY TO</dt><dd className="font-semibold">{tx.destination ?? '—'}</dd></div>
                <div><dt className="text-[10px] tracking-wider opacity-70">ORDER TOTAL</dt><dd className="font-semibold">{tx.orderTotalCents ? formatCents(tx.orderTotalCents) : '—'}</dd></div>
              </dl>
            </ContentCard>
          )}

          <p className="rounded-xl bg-orange-100 px-4 py-3 text-xs text-orange-900">
            Simulated funds only · No real money is moved. Ledger records cannot be edited.
          </p>
        </div>

        <ContentCard title="Status timeline">
          <ul className="space-y-4 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${s.done ? 'bg-[#315A42]' : 'border-2 border-gray-300'}`} />
                <span className={s.done ? '' : 'opacity-60'}>{s.label}{s.done ? '' : ' · pending'}</span>
              </li>
            ))}
          </ul>
        </ContentCard>
      </div>
    </div>
  );
}