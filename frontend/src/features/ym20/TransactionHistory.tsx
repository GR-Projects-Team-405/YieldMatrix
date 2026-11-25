import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { badgeClass, formatCents, formatDate, shortCode, sumCents, typeLabel, type ApiTransaction } from './txApi';
import { useRecordsBase } from './useRecordsBase';

export default function TransactionHistory() {
  const base = useRecordsBase();
  const navigate = useNavigate();
  const [all, setAll] = useState<ApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api
      .get<{ transactions: ApiTransaction[] }>('/ym20/transactions', { signal: controller.signal })
      .then(({ data }) => {
        if (active) setAll(data.transactions);
      })
      .catch(() => {
        if (active) setError('Could not load transactions. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const rows = all.filter((t) => {
    const text = `${shortCode('TX', t.id)} ${t.reference} ${shortCode('ORD', t.orderId)}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (status === 'All' || t.status === status);
  });

  const stats = [
    { label: 'TOTAL TRANSACTIONS', value: String(all.length), note: 'Latest entries (up to 50)' },
    { label: 'FUNDED', value: formatCents(sumCents(all, 'funding')), note: 'Simulated wallet funding' },
    { label: 'FUNDS HELD', value: formatCents(sumCents(all, 'hold')), note: 'Escrow holds · simulated only' },
    { label: 'REFUNDED', value: formatCents(sumCents(all, 'refund')), note: 'Returned to your wallet' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transaction history</h1>
        <p className="text-sm opacity-70">Every payment, hold and refund linked to your orders.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <ContentCard key={s.label}>
            <p className="text-[10px] tracking-wider opacity-70">{s.label}</p>
            <p className="my-2 text-2xl font-bold">{s.value}</p>
            <p className="text-xs opacity-70">{s.note}</p>
          </ContentCard>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="h-12 flex-1 rounded-xl border border-gray-300 bg-transparent px-4 text-sm"
          placeholder="Search by transaction, order or reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-12 rounded-xl border border-gray-300 bg-transparent px-4 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="All">All statuses</option>
          <option value="Held">Held</option>
          <option value="Completed">Completed</option>
          <option value="Refunded">Refunded</option>
          <option value="Reversed">Reversed</option>
        </select>
      </div>

      {loading && <p role="status" className="text-sm opacity-70">Loading transactions...</p>}
      {error && <Alert type="error">{error}</Alert>}
      {!loading && !error && all.length === 0 && (
        <EmptyState title="No transactions yet" description="Payments, holds and refunds for your orders will appear here." />
      )}

      {!loading && !error && all.length > 0 && (
        <ContentCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] tracking-wider opacity-70">
                  <th className="p-3">TRANSACTION</th>
                  <th className="p-3">TYPE</th>
                  <th className="p-3">REFERENCE</th>
                  <th className="p-3">ORDER</th>
                  <th className="p-3">DATE</th>
                  <th className="p-3">AMOUNT</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-t border-gray-200 hover:bg-gray-50/50"
                    onClick={() => navigate(`${base}/transactions/${t.id}`)}
                  >
                    <td className="p-3 font-semibold">{shortCode('TX', t.id)}</td>
                    <td className="p-3">{typeLabel[t.type] ?? t.type}</td>
                    <td className="max-w-[220px] truncate p-3" title={t.reference}>{t.reference}</td>
                    <td className="p-3">{shortCode('ORD', t.orderId)}</td>
                    <td className="p-3">{formatDate(t.occurredAt)}</td>
                    <td className="p-3">{formatCents(t.amountCents)}</td>
                    <td className="p-3">
                      <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${badgeClass(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="p-3">
                      <Link className="font-semibold text-[#315A42]" to={`${base}/transactions/${t.id}`}>View →</Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="p-6 text-center opacity-70" colSpan={8}>No transactions match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="pt-4 text-xs opacity-70">Showing {rows.length} of {all.length}</p>
        </ContentCard>
      )}
    </div>
  );
}