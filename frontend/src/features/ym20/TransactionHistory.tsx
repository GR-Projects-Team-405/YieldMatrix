import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { formatLkr, statusClass, transactions, type TxStatus } from './data';
import { useRecordsBase } from './useRecordsBase';

const stats = [
  { label: 'TOTAL TRANSACTIONS', value: '48', note: 'Last 30 days' },
  { label: 'HELD FUNDS', value: 'LKR 184,250', note: 'Reserved · simulated only' },
  { label: 'SETTLED', value: 'LKR 612,000', note: 'Released to growers' },
  { label: 'REFUNDED', value: 'LKR 18,500', note: '2 refunds' },
];

export default function TransactionHistory() {
  const base = useRecordsBase();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TxStatus | 'All'>('All');

  const rows = transactions.filter((t) => {
    const text = `${t.id} ${t.orderId}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (status === 'All' || t.status === status);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transaction history</h1><br />
        <p className="text-sm opacity-80">Every payment, hold and refund linked to your orders.</p>
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
          placeholder="Search by transaction or order ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-12 rounded-xl border border-gray-300 bg-transparent px-4 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as TxStatus | 'All')}
        >
          <option value="All">All statuses</option>
          <option value="Held">Held</option>
          <option value="Completed">Completed</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      <ContentCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] tracking-wider opacity-70">
                <th className="p-3">TRANSACTION</th>
                <th className="p-3">ORDER</th>
                <th className="p-3">TYPE</th>
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
                  <td className="p-3 font-semibold">{t.id}</td>
                  <td className="p-3">{t.orderId}</td>
                  <td className="p-3">{t.type}</td>
                  <td className="p-3">{t.date}</td>
                  <td className="p-3">{formatLkr(t.amount)}</td>
                  <td className="p-3">
                    <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${statusClass[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="p-3">
                    <Link className="font-semibold text-[#315A42]" to={`${base}/transactions/${t.id}`}>View →</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="p-6 text-center opacity-70" colSpan={7}>No transactions match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="pt-4 text-xs opacity-70">Showing {rows.length} of 48 · demo data</p>
      </ContentCard>
    </div>
  );
}