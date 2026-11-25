import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { badgeClass, formatCents, formatDate, formatKg, labelize, paymentStatus, shortCode, sumField } from './txApi';
import { useOrder } from './useOrder';
import { useRecordsBase } from './useRecordsBase';

export default function OrderSummary() {
  const { orderId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const { data, loading, error } = useOrder(orderId);

  if (loading) return <p role="status" className="text-sm opacity-70">Loading order...</p>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert type="error">{error || 'Order not found.'}</Alert>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </div>
    );
  }

  const { order, allocations } = data;
  const total = order.totalCents ?? String(sumField(allocations, 'valueCents'));
  const pay = paymentStatus(allocations);

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(base)}>
        ← Back to transaction history
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            Order summary · {shortCode('ORD', order.id)}
            <span className="rounded-xl bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">{labelize(order.status)}</span>
          </h1>
          <p className="text-sm opacity-70">
            Placed {formatDate(order.createdAt)} · {allocations.length} allocation{allocations.length === 1 ? '' : 's'} · {formatKg(sumField(allocations, 'agreedKg'))}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(`${base}/settlement/${order.id}`)}>
          View allocation settlement ↗
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentCard title="Items by farm">
            {allocations.length === 0 ? (
              <p className="text-sm opacity-70">No allocations on this order yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] tracking-wider opacity-70">
                      <th className="p-3">FARM</th><th className="p-3">PRODUCE</th><th className="p-3">QTY</th>
                      <th className="p-3">UNIT PRICE</th><th className="p-3">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.id} className="border-t border-gray-200">
                        <td className="p-3 font-semibold">{a.farm}</td>
                        <td className="p-3">{a.crop} · {a.grade}</td>
                        <td className="p-3">{formatKg(a.agreedKg)}</td>
                        <td className="p-3">{formatCents(a.unitPriceCents)}</td>
                        <td className="p-3">{formatCents(a.valueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>

          <ContentCard title="Delivery information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-[10px] tracking-wider opacity-70">DELIVERY TO</dt><dd className="font-semibold">{order.destination}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">DELIVERY DATE</dt><dd className="font-semibold">{formatDate(order.deliveryDate)}</dd></div>
            </dl>
          </ContentCard>
        </div>

        <ContentCard title="Payment summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-200 pb-3 text-base font-bold">
              <span>{order.totalCents ? 'Order total' : 'Your allocations'}</span><span>{formatCents(total)}</span>
            </div>
            <div className="flex justify-between"><span>Funded</span><span>{formatCents(sumField(allocations, 'fundedCents'))}</span></div>
            <div className="flex justify-between"><span>Held in escrow</span><span>{formatCents(sumField(allocations, 'heldCents'))}</span></div>
            <div className="flex justify-between"><span>Settled</span><span>{formatCents(sumField(allocations, 'settledCents'))}</span></div>
            <div className="flex justify-between"><span>Refunded</span><span>{formatCents(sumField(allocations, 'refundedCents'))}</span></div>
            <div className="flex items-center justify-between pt-2">
              <span>Payment status</span>
              <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${badgeClass(pay)}`}>{pay}</span>
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={() => navigate(base)}>View transactions</Button>
        </ContentCard>
      </div>
    </div>
  );
}