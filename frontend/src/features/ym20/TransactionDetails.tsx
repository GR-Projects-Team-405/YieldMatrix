import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { formatLkr, orderSlug, statusClass, transactions, txExtra } from './data';
import { useRecordsBase } from './useRecordsBase';

export default function TransactionDetails() {
  const { txId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const tx = transactions.find((t) => t.id === txId);

  if (!tx) {
    return (
      <ContentCard title="Transaction not found" subtitle={`We could not find ${txId ?? 'this transaction'}.`}>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </ContentCard>
    );
  }

  const extra = txExtra[tx.id];
  const timeline = [
    { label: 'Funding requested', done: true },
    { label: tx.status === 'Refunded' ? 'Refund issued' : 'Funds held', done: true },
    { label: 'Delivery accepted', done: tx.status === 'Completed' },
    { label: 'Settlement released', done: tx.status === 'Completed' },
  ];

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(base)}>
        ← Back to transaction history
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            {tx.id}
            <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${statusClass[tx.status]}`}>{tx.status}</span>
          </h1>
          <p className="text-sm opacity-70">{tx.type} for order {tx.orderId} · {tx.date}</p>
          <span className="mt-2 inline-block text-[10px] tracking-wide opacity-70">DEMO DASHBOARD · 02 NOV 2026</span>
        </div>
        <Button onClick={() => navigate(`${base}/orders/${orderSlug(tx.orderId)}`)}>View order summary ↗</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentCard title="Transaction information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-[10px] tracking-wider opacity-70">AMOUNT</dt><dd className="font-semibold">{formatLkr(tx.amount)}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">TYPE</dt><dd className="font-semibold">{tx.type}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">DATE</dt><dd className="font-semibold">{tx.date}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">METHOD</dt><dd className="font-semibold">{extra?.method ?? 'Agri wallet (simulated)'}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">REFERENCE</dt><dd className="font-semibold">{extra?.reference ?? '—'}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">BALANCE AFTER</dt><dd className="font-semibold">{extra ? formatLkr(extra.balanceAfter) : '—'}</dd></div>
            </dl>
          </ContentCard>

          <ContentCard title="Linked order">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] tracking-wider opacity-70">
                  <th className="p-3">ORDER</th><th className="p-3">PRODUCE</th><th className="p-3">QUANTITY</th><th className="p-3">SUPPLIERS</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className="cursor-pointer border-t border-gray-200"
                  onClick={() => navigate(`${base}/orders/${orderSlug(tx.orderId)}`)}
                >
                  <td className="p-3 font-semibold">{tx.orderId}</td>
                  <td className="p-3">Tomato · A</td>
                  <td className="p-3">1,000 kg</td>
                  <td className="p-3">3 growers</td>
                </tr>
              </tbody>
            </table>
          </ContentCard>

          <p className="rounded-xl bg-orange-100 px-4 py-3 text-xs text-orange-900">
            Demo data · No real money is moved. Held funds stay reserved until delivery is accepted.
          </p>
        </div>

        <ContentCard title="Status timeline">
          <ul className="mb-4 space-y-4 text-sm">
            {timeline.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${s.done ? 'bg-[#315A42]' : 'border-2 border-gray-300'}`} />
                <span className={s.done ? '' : 'opacity-60'}>{s.label}{s.done ? '' : ' · pending'}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full">Download receipt</Button>
        </ContentCard>
      </div>
    </div>
  );
}