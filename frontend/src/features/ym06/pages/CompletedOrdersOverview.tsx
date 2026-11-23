import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BadgeCheck, PackageCheck, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';
import PerformanceChart from '../components/PerformanceChart';
import { formatDate, formatKg, formatLkr, getCompletedOrders, type CompletedOrdersData } from '../ym06Api';

export default function CompletedOrdersOverview() {
  const [data, setData] = useState<CompletedOrdersData | null>(null);
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [settlement, setSettlement] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => { setLoading(true); setError(''); getCompletedOrders(days).then(setData).catch(() => setError('Completed orders could not be loaded. Try again.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [days]);
  const orders = (data?.orders || []).filter((item) => {
    const matchesSearch = `${item.order_id} ${item.buyer} ${item.crop} ${item.destination_district}`.toLowerCase().includes(search.trim().toLowerCase());
    const fullySettled = Number(item.settled_cents) >= Number(item.sales_cents);
    return matchesSearch && (settlement === 'all' || (settlement === 'settled' ? fullySettled : !fullySettled));
  });
  const exportCsv = () => {
    const rows = [['Order ID','Buyer','Crop','Grade','Ordered kg','Accepted kg','Sales LKR','Settled LKR','Status','Completed'], ...orders.map((item) => [item.order_id,item.buyer,item.crop,item.grade,item.ordered_kg,item.accepted_kg,(Number(item.sales_cents)/100).toFixed(2),(Number(item.settled_cents)/100).toFixed(2),item.order_status,item.completed_at])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'yieldmatrix-completed-orders.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) return <PageFrame title="Completed orders" description="Review accepted quantities, order value and settlement progress."><LoadingState/></PageFrame>;
  if (error && !data) return <PageFrame title="Completed orders" description="Review accepted quantities, order value and settlement progress."><ErrorState message={error} onRetry={load}/></PageFrame>;
  const summary = data?.summary;

  return <PageFrame title="Completed orders" description="Review fulfilled orders and your recorded settlements.">
    <div className="ym06-toolbar"><div className="ym06-toolbar-note"><span className="ym06-live-dot"/>Delivered or closed orders with accepted produce</div><div className="ym06-toolbar-controls"><SelectField label="Reporting period" value={String(days)} onChange={(event) => setDays(Number(event.target.value))} options={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }]}/><button type="button" className="ym06-export-button" onClick={exportCsv} disabled={!orders.length}><ArrowDownToLine size={16}/> Export orders</button></div></div>
    <section className="ym06-stat-grid ym06-completed-stats"><StatCard label="Total completed orders" value={String(summary?.completed_orders || 0)} subtext={`Last ${days} days`}/><StatCard label="Accepted quantity" value={formatKg(summary?.accepted_kg)} subtext={`${summary?.active_crops || 0} crops`}/><StatCard label="Total sales value" value={formatLkr(summary?.sales_cents)} subtext="Based on accepted quantity"/><StatCard label="Settled amount" value={formatLkr(summary?.settled_cents)} subtext="Recorded in wallet journal" highlight/></section>
    <div className="ym06-completed-grid"><section className="ym06-panel"><div className="ym06-panel-heading"><div><h3>Completed orders trend</h3><p>Accepted quantity by week</p></div><span className="ym06-small-pill"><PackageCheck size={14}/> {days} days</span></div>{data?.trend.length ? <PerformanceChart points={data.trend.map((point) => ({ label: formatDate(point.week_start, { day: '2-digit', month: 'short' }), value: Number(point.accepted_kg) }))} label="Accepted quantity trend" valueLabel="kg"/> : <NoRecords title="No completed orders yet" description="Accepted order volume will appear here once deliveries are closed."/>}<div className="ym06-chart-footer"><span><span className="ym06-legend-dot"/> Accepted quantity (kg)</span><span><BadgeCheck size={14}/> Verified allocations</span></div></section><section className="ym06-panel ym06-fulfilment-card"><span className="ym06-fulfilment-icon"><BadgeCheck size={21}/></span><span className="ym06-eyebrow">Fulfilment &amp; settlement</span><h3>Know what has been accepted.</h3><p>Completed orders include delivered or closed orders with accepted produce. Settlement values come from your allocation records.</p><div className="ym06-fulfilment-stat"><span>Unsettled accepted value</span><strong>{formatLkr(Math.max(0, Number(summary?.sales_cents || 0) - Number(summary?.settled_cents || 0)))}</strong></div><Link to="../wallet">View farmer wallet <ArrowRight size={14}/></Link></section></div>
    <section className="ym06-panel ym06-transactions-panel"><div className="ym06-panel-heading"><div><h3>Completed order records</h3><p>{orders.length} records shown</p></div><div className="ym06-table-controls"><label className="ym06-table-search"><Search size={15}/><input aria-label="Search completed orders" placeholder="Search order, buyer, product…" value={search} onChange={(event) => setSearch(event.target.value)}/></label><SelectField label="Settlement" value={settlement} onChange={(event) => setSettlement(event.target.value)} options={[{ value: 'all', label: 'All settlements' }, { value: 'settled', label: 'Settled' }, { value: 'outstanding', label: 'Outstanding' }]}/></div></div>{orders.length ? <Table className="ym06-table" headers={['Order / buyer', 'Produce', 'Ordered / accepted', 'Agreed price', 'Accepted value', 'Settlement', 'Completed']}>
      {orders.map((item, index) => <TableRow key={`${item.order_id}-${item.crop}-${index}`}><td><strong>{item.order_id.slice(0, 8).toUpperCase()}</strong><small className="ym06-cell-sub">{item.buyer} · {item.destination_district}</small></td><td>{item.crop} · {item.grade}</td><td>{formatKg(item.ordered_kg)} / {formatKg(item.accepted_kg)}</td><td>{formatLkr(item.price_cents_per_kg)} / kg</td><td><strong>{formatLkr(item.sales_cents)}</strong></td><td><StatusBadge status={Number(item.settled_cents) >= Number(item.sales_cents) ? 'Settled' : 'Outstanding'}/><small className="ym06-cell-sub">{formatLkr(item.settled_cents)} paid</small></td><td>{formatDate(item.completed_at)}</td></TableRow>)}
    </Table> : <NoRecords title={search ? 'No matching orders' : 'No completed orders yet'} description={search ? 'Try another order ID, buyer, district or crop.' : 'Delivered and closed orders will appear here after produce has been accepted.'}/>}<div className="ym06-table-footer"><span>Showing {orders.length} of {data?.orders.length || 0} order lines</span><Link to="../records">Open order records <ArrowRight size={14}/></Link></div></section>
  </PageFrame>;
}
