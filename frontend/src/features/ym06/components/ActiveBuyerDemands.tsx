import { ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NoRecords } from './DataState';
import type { BuyerDemand } from '../ym06Api';
import { formatDate, formatKg, formatLkr } from '../ym06Api';

export default function ActiveBuyerDemands({ demands }: { demands: BuyerDemand[] }) {
  return <section className="ym06-panel ym06-demands-panel">
    <div className="ym06-panel-heading"><div className="ym06-demand-heading"><span className="ym06-demand-icon"><LockKeyhole size={16}/></span><div><div className="ym06-demand-title"><h3>Active buyer demands</h3><span>{demands.length} matching {demands.length === 1 ? 'demand' : 'demands'}</span></div><p>Direct sourcing requests for produce you grow</p></div></div><Link className="ym06-inline-link" to="../buyer-requests">Explore buyer requests <ArrowRight size={14}/></Link></div>
    {demands.length ? <div className="ym06-demand-list">{demands.map((item) => <article className="ym06-demand-row" key={item.id}><div className="ym06-demand-main"><div className="ym06-demand-buyer"><strong>{item.buyer}</strong><span>Request #{item.id.slice(0, 8).toUpperCase()}</span></div><div className="ym06-demand-spec"><strong>{item.crop} · {item.grade}</strong><span>Seeking {formatKg(item.quantity_kg)}{item.allow_partial ? ' · partial quantities accepted' : ''}</span></div><div className="ym06-demand-spec"><strong>{item.budget_cents ? formatLkr(item.budget_cents) : 'No budget listed'}</strong><span>{item.budget_cents ? 'Total budget cap' : 'Buyer has not provided a budget'}</span></div><div className="ym06-demand-spec"><strong>{formatDate(item.delivery_from, { day: '2-digit', month: 'short' })}{item.delivery_until !== item.delivery_from ? ` – ${formatDate(item.delivery_until, { day: '2-digit', month: 'short' })}` : ''}</strong><span>Delivery window · {item.destination_district}</span></div></div><Link className="ym06-demand-action" to="../buyer-requests">Review request <ArrowUpRight size={14}/></Link></article>)}</div> : <NoRecords title="No matching buyer demands" description="Open buyer requests for crops and grades in your farm records will appear here."/>}
  </section>;
}
