import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { formatLkr, orderSlug, orders, statusClass, sum, transactions } from './data';
import { useRecordsBase } from './useRecordsBase';

export default function OrderSummary() {
  const { orderId } = useParams();
  const base = useRecordsBase();
  const navigate = useNavigate();
  const order = orders[orderId ?? ''];

  if (!order) {
    return (
      <ContentCard title="Order not found" subtitle={`We could not find ${orderId ?? 'this order'}.`}>
        <Button variant="outline" onClick={() => navigate(base)}>Back to transaction history</Button>
      </ContentCard>
    );
  }

  const goods = sum(order.growers.map((g) => g.qty * g.unitPrice));
  const adjustments = sum(order.growers.map((g) => g.fee));
  const total = goods - adjustments;
  const totalQty = sum(order.growers.map((g) => g.qty));
  const tx = transactions.find((t) => orderSlug(t.orderId) === orderId);

  return (
    <div className="space-y-6">
      <button className="text-xs opacity-70 hover:underline" onClick={() => navigate(base)}>
        ← Back to transaction history
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            Order summary · {order.id}
            <span className="rounded-xl bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">{order.status}</span>
          </h1>
          <p className="text-sm opacity-70">Placed {order.placed} · {order.produce} · {totalQty.toLocaleString('en-US')} kg</p>
          <span className="mt-2 inline-block text-[10px] tracking-wide opacity-70">DEMO DASHBOARD · 02 NOV 2026</span>
        </div>
        <Button variant="outline" onClick={() => navigate(`${base}/settlement/${orderId}`)}>
          View allocation settlement ↗
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentCard title="Items by grower">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] tracking-wider opacity-70">
                  <th className="p-3">GROWER</th><th className="p-3">PRODUCE</th><th className="p-3">QTY</th>
                  <th className="p-3">UNIT PRICE</th><th className="p-3">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {order.growers.map((g) => (
                  <tr key={g.name} className="border-t border-gray-200">
                    <td className="p-3 font-semibold">{g.name}</td>
                    <td className="p-3">{order.produce}</td>
                    <td className="p-3">{g.qty} kg</td>
                    <td className="p-3">{formatLkr(g.unitPrice)}</td>
                    <td className="p-3">{formatLkr(g.qty * g.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContentCard>

          <ContentCard title="Delivery information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-[10px] tracking-wider opacity-70">DELIVERY ADDRESS</dt><dd className="font-semibold">{order.address}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">EXPECTED DATE</dt><dd className="font-semibold">{order.expected}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">VEHICLE</dt><dd className="font-semibold">{order.vehicle}</dd></div>
              <div><dt className="text-[10px] tracking-wider opacity-70">TRACKING</dt><dd className="font-semibold text-[#315A42]">Delivery tracking (YM18)</dd></div>
            </dl>
          </ContentCard>
        </div>

        <ContentCard title="Payment summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Goods total</span><span>{formatLkr(goods)}</span></div>
            <div className="flex justify-between"><span>Delivery fee</span><span>LKR 0</span></div>
            <div className="flex justify-between"><span>Adjustments</span><span>− {formatLkr(adjustments)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold">
              <span>Order total</span><span>{formatLkr(total)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span>Payment status</span>
              <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${statusClass[order.payment]}`}>{order.payment}</span>
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={() => navigate(tx ? `${base}/transactions/${tx.id}` : base)}>
            {tx ? `View transaction ${tx.id}` : 'View transactions'}
          </Button>
        </ContentCard>
      </div>
    </div>
  );
}