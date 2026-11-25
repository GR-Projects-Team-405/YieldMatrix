import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { formatLkr, orderSlug, orders, statusClass, sum, transactions } from './data';
import { useRecordsBase } from './useRecordsBase';

export default function AllocationSettlement() {
  const { orderId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const order = orders[orderId ?? ''];

  if (!order) {
    return (
      <ContentCard title="Settlement not found" subtitle={`We could not find ${orderId ?? 'this order'}.`}>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </ContentCard>
    );
  }

  const totalQty = sum(order.growers.map((g) => g.qty));
  const gross = sum(order.growers.map((g) => g.qty * g.unitPrice));
  const fees = sum(order.growers.map((g) => g.fee));
  const net = gross - fees;
  const tx = transactions.find((t) => orderSlug(t.orderId) === orderId);
  const settled = order.payment === 'Completed';

  const stats = [
    { label: 'ALLOCATED QUANTITY', value: `${totalQty.toLocaleString('en-US')} kg`, note: `${order.growers.length} grower${order.growers.length > 1 ? 's' : ''}` },
    { label: 'GROSS VALUE', value: formatLkr(gross), note: 'Goods total' },
    { label: 'PLATFORM FEE', value: formatLkr(fees), note: 'Simulated' },
    { label: 'NET TO GROWERS', value: formatLkr(net), note: 'After fees' },
  ];

  const timeline = [
    { label: 'Allocation confirmed', done: true },
    { label: 'Funds held', done: true },
    { label: 'Delivery accepted', done: settled },
    { label: 'Settlement released', done: settled },
  ];

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(`${base}/orders/${orderId}`)}>
        ← Back to order summary
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Allocation settlement details</h1>
          <p className="text-sm opacity-70">How the order value is shared across growers · {order.id}</p>
          <span className="mt-2 inline-block text-[10px] tracking-wide opacity-70">DEMO DASHBOARD · 02 NOV 2026</span>
        </div>
        <Button variant="outline">Download breakdown</Button>
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

      <ContentCard title="Settlement by grower">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] tracking-wider opacity-70">
                <th className="p-3">GROWER</th><th className="p-3">QTY</th><th className="p-3">SHARE</th><th className="p-3">GROSS</th>
                <th className="p-3">FEE</th><th className="p-3">NET</th><th className="p-3">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {order.growers.map((g) => {
                const gGross = g.qty * g.unitPrice;
                return (
                  <tr key={g.name} className="border-t border-gray-200">
                    <td className="p-3 font-semibold">{g.name}</td>
                    <td className="p-3">{g.qty} kg</td>
                    <td className="p-3">
                      <div className="h-2 min-w-20 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full bg-[#315A42]" style={{ width: `${Math.round((g.qty / totalQty) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="p-3">{formatLkr(gGross)}</td>
                    <td className="p-3">{formatLkr(g.fee)}</td>
                    <td className="p-3">{formatLkr(gGross - g.fee)}</td>
                    <td className="p-3">
                      <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${statusClass[order.payment]}`}>{order.payment}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ContentCard>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ContentCard title="Settlement timeline">
          <ul className="space-y-4 text-sm">
            {timeline.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${s.done ? 'bg-[#315A42]' : 'border-2 border-gray-300'}`} />
                <span className={s.done ? '' : 'opacity-60'}>{s.label}{s.done ? '' : ' · pending'}</span>
              </li>
            ))}
          </ul>
        </ContentCard>

        <ContentCard title="Related records">
          <div className="space-y-3 text-sm font-semibold text-[#315A42]">
            {tx && <button className="block hover:underline" onClick={() => navigate(`${base}/transactions/${tx.id}`)}>{tx.id} · {tx.type} →</button>}
            <button className="block hover:underline" onClick={() => navigate(`${base}/orders/${orderId}`)}>Order summary →</button>
            <button className="block hover:underline" onClick={() => navigate(base)}>All transactions →</button>
          </div>
          <p className="mt-4 rounded-xl bg-orange-100 px-4 py-3 text-xs text-orange-900">Demo data · Simulated settlement.</p>
        </ContentCard>
      </div>
    </div>
  );
}