import { ArrowUpRight, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProduceDetailsResponse } from './types';
export function SupplierSummaryCard({ data }: { data: ProduceDetailsResponse }) {
  const { supplier } = data;
  const ratingText = supplier.rating === null ? 'Buyer rating unavailable'
    : `${supplier.rating.toFixed(1)} / 5 buyer rating${supplier.ratingCount ? ` · ${supplier.ratingCount} ${data.dataSource === 'sample' ? 'sample ' : ''}ratings` : ''}`;
  const ordersText = supplier.completedOrders === null ? 'Insufficient history' : `${supplier.completedOrders} completed orders`;
  const status = supplier.verified ? (data.dataSource === 'sample' ? 'Verified supplier · sample' : 'Approved supplier') : 'Verification not recorded';
  return <section className="ym12-supplier-card" aria-label="Supplier summary">
    <div className="ym12-supplier-top"><span className="ym12-supplier-mark" aria-hidden="true"><Sprout size={25} strokeWidth={1.6} /></span>
      <div className="ym12-supplier-identity"><h3>{supplier.name}</h3><p>{supplier.district} district · {status}</p></div>
      <Link className="ym12-profile-link" to={`/buyer/suppliers/${encodeURIComponent(supplier.id)}`}>View profile <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </div>
    <div className="ym12-supplier-stats"><p>{ratingText}</p><span aria-hidden="true">·</span><p>{ordersText}</p></div>
    {supplier.completedOrders === null && <p className="ym12-history-note">Supplier performance appears after completed orders are recorded.</p>}
  </section>;
}
