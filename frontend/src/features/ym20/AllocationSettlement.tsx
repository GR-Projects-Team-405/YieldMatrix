import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { badgeClass, formatCents, formatKg, labelize, shortCode, sumField } from './txApi';
import { useOrder } from './useOrder';
import { useRecordsBase } from './useRecordsBase';

export default function AllocationSettlement() {
  const { orderId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const { data, loading, error } = useOrder(orderId);

  if (loading) return <p role="status" className="text-sm opacity-70">Loading settlement...</p>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert type="error">{error || 'Order not found.'}</Alert>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </div>
    );
  }

  const { order, allocations } = data;
  const totalKg = sumField(allocations, 'agreedKg');
  const stats = [
    { label: 'ALLOCATED QUANTITY', value: formatKg(totalKg), note: `${allocations.length} farm${allocations.length === 1 ? '' : 's'}` },
    { label: 'AGREED VALUE', value: formatCents(sumField(allocations, 'valueCents')), note: 'Goods total' },
    { label: 'HELD IN ESCROW', value: formatCents(sumField(allocations, 'heldCents')), note: 'Simulated funds' },
    { label: 'SETTLED', value: formatCents(sumField(allocations, 'settledCents')), note: `Refunded ${formatCents(sumField(allocations, 'refundedCents'))}` },
  ];

  const accepted = allocations.some((a) => ['accepted', 'partially_accepted', 'resolved'].includes(a.status));
  const timeline = [
    { label: 'Allocation confirmed', done: allocations.length > 0 },
    { label: 'Funds held', done: sumField(allocations, 'fundedCents') > 0 },
    { label: 'Delivery accepted', done: accepted },
    { label: 'Settlement released', done: sumField(allocations, 'settledCents') > 0 },
  ];

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(`${base}/orders/${order.id}`)}>
        ← Back to order summary
      </button>

      <div>
        <h1 className="text-3xl font-bold">Allocation settlement details</h1>
        <p className="text-sm opacity-70">How the order value is shared across farms · {shortCode('ORD', order.id)}</p>
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

      <ContentCard title="Settlement by farm">
        {allocations.length === 0 ? (
          <p className="text-sm opacity-70">No allocations on this order yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] tracking-wider opacity-70">
                  <th className="p-3">FARM</th><th className="p-3">QTY</th><th className="p-3">SHARE</th><th className="p-3">VALUE</th>
                  <th className="p-3">HELD</th><th className="p-3">SETTLED</th><th className="p-3">REFUNDED</th><th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-t border-gray-200">
                    <td className="p-3 font-semibold">{a.farm}</td>
                    <td className="p-3">{formatKg(a.agreedKg)}</td>
                    <td className="p-3">
                      <div className="h-2 min-w-20 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full bg-[#315A42]" style={{ width: `${totalKg ? Math.round((Number(a.agreedKg) / totalKg) * 100) : 0}%` }} />
                      </div>
                    </td>
                    <td className="p-3">{formatCents(a.valueCents)}</td>
                    <td className="p-3">{formatCents(a.heldCents)}</td>
                    <td className="p-3">{formatCents(a.settledCents)}</td>
                    <td className="p-3">{formatCents(a.refundedCents)}</td>
                    <td className="p-3">
                      <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${badgeClass(Number(a.heldCents) > 0 ? 'Held' : 'Completed')}`}>{labelize(a.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <button className="block hover:underline" onClick={() => navigate(`${base}/orders/${order.id}`)}>Order summary →</button>
            <button className="block hover:underline" onClick={() => navigate(base)}>All transactions →</button>
          </div>
          <p className="mt-4 rounded-xl bg-orange-100 px-4 py-3 text-xs text-orange-900">Simulated funds only · No real money is moved.</p>
        </ContentCard>
      </div>
    </div>
  );
}