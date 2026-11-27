import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';
import { formatDate, formatKg, formatLkr, getCompletedOrders, type CompletedOrder, type CompletedOrdersData } from '../ym06Api';

const cropEmoji = (crop: string) => /tomato/i.test(crop) ? '🍅' : /carrot/i.test(crop) ? '🥕' : /cabbage/i.test(crop) ? '🥬' : '🌱';
const acceptedPercent = (item: CompletedOrder) => Number(item.ordered_kg) > 0 ? Math.min(100, Math.round(Number(item.accepted_kg) / Number(item.ordered_kg) * 100)) : 0;
const settledState = (item: CompletedOrder) => Number(item.settled_cents) >= Number(item.sales_cents) ? 'Settled' : Number(item.settled_cents) > 0 ? 'Partially settled' : 'Pending settlement';

function WeeklyBars({ data }: { data: CompletedOrdersData }) {
  const weeks = data.trend.slice(-(data.days <= 30 ? 5 : data.days <= 90 ? 8 : 12));
  const maxKg = Math.max(1, ...weeks.map((week) => Number(week.accepted_kg)));
  return <div className="ym06-weekly-bars" role="img" aria-label="Accepted quantity by week">
    {weeks.length ? weeks.map((week) => { const kg = Number(week.accepted_kg); const height = Math.max(7, kg / maxKg * 100); const dateValue = String(week.week_start ?? '').slice(0, 10); const start = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T12:00:00`) : null; const end = start ? new Date(start) : null; end?.setDate(end.getDate() + 6); const endValue = end ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}` : ''; return <div className="ym06-week-bar" key={week.week_start}>
      <div className="ym06-week-bar-value">{kg.toLocaleString('en-LK')} kg</div><div className="ym06-week-bar-track"><i style={{ height: `${height}%` }}/></div><div className="ym06-week-bar-dates">{start ? formatDate(dateValue, { day: '2-digit', month: 'short' }) : 'Date unavailable'}{end ? ` – ${formatDate(endValue, { day: '2-digit', month: 'short' })}` : ''}</div><small>{week.completed_orders} {week.completed_orders === 1 ? 'order' : 'orders'}</small>
    </div>; }) : <NoRecords title="No completed orders in this period" description="Completed weekly volume will appear after accepted deliveries."/>}
  </div>;
}

function printReceipt(order: CompletedOrder) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
  const popup = window.open('', '_blank', 'width=720,height=800');
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>Delivery receipt</title><style>body{font:14px Arial,sans-serif;color:#263a31;margin:42px}h1{font-size:22px}h2{margin-top:34px;font-size:14px;text-transform:uppercase;color:#62726b}header{display:flex;justify-content:space-between;border-bottom:2px solid #315a42;padding-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:10px;border-bottom:1px solid #e5e8eb}td:first-child{color:#62726b}.total{font-size:18px;font-weight:bold;color:#315a42}.foot{margin-top:32px;color:#62726b;font-size:11px}@media print{body{margin:0}}</style></head><body><header><div><strong>YieldMatrix</strong><h1>Delivery receipt</h1><div>${escape(order.order_id)}</div></div><div>${escape(formatDate(order.completed_at))}</div></header><h2>Buyer and produce</h2><table><tr><td>Buyer</td><td>${escape(order.buyer)}</td></tr><tr><td>Destination</td><td>${escape(order.destination_district)}</td></tr><tr><td>Produce</td><td>${escape(`${order.crop} · ${order.grade}`)}</td></tr><tr><td>Harvest batch</td><td>${escape(order.batch_id)}</td></tr></table><h2>Accepted delivery and settlement</h2><table><tr><td>Ordered quantity</td><td>${escape(formatKg(order.ordered_kg))}</td></tr><tr><td>Accepted quantity</td><td>${escape(formatKg(order.accepted_kg))}</td></tr><tr><td>Agreed price</td><td>${escape(formatLkr(order.price_cents_per_kg))} / kg</td></tr><tr><td>Accepted value</td><td>${escape(formatLkr(order.sales_cents))}</td></tr><tr><td>Settled amount</td><td>${escape(formatLkr(order.settled_cents))}</td></tr><tr><td>Settlement status</td><td>${escape(settledState(order))}</td></tr><tr><td>Order status</td><td>${escape(order.order_status)}</td></tr></table><p class="total">Accepted value: ${escape(formatLkr(order.sales_cents))}</p><p class="foot">Generated from recorded YieldMatrix order and allocation details. This receipt does not add unrecorded delivery or logistics information.</p><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

export default function CompletedOrdersOverview() {
  const [data, setData] = useState<CompletedOrdersData | null>(null);
  const [days, setDays] = useState(30);
  const [cropId, setCropId] = useState('');
  const [search, setSearch] = useState('');
  const [settlement, setSettlement] = useState('all');
  const [acceptance, setAcceptance] = useState<'all' | 'full' | 'partial'>('all');
  const [selectedKey, setSelectedKey] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 5;
  const load = () => { setLoading(true); setError(''); getCompletedOrders(days, cropId).then((result) => { setData(result); setSelectedKey(''); }).catch(() => setError('Completed orders could not be loaded. Try again.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [days, cropId]);

  const orders = useMemo(() => (data?.orders || []).filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = `${item.order_id} ${item.buyer} ${item.crop} ${item.grade} ${item.destination_district} ${item.batch_id}`.toLowerCase().includes(query);
    const settled = Number(item.settled_cents) >= Number(item.sales_cents);
    const fullyAccepted = Number(item.accepted_kg) >= Number(item.ordered_kg);
    return matchesSearch && (settlement === 'all' || (settlement === 'settled' ? settled : !settled)) && (acceptance === 'all' || (acceptance === 'full' ? fullyAccepted : !fullyAccepted));
  }), [data, search, settlement, acceptance]);
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = orders.find((item) => `${item.order_id}-${item.batch_id}` === selectedKey) || pageOrders[0] || orders[0];
  const summary = data?.summary;
  const acceptanceRate = Number(summary?.ordered_kg) ? Number(summary?.accepted_kg || 0) / Number(summary?.ordered_kg) * 100 : 0;
  const settledRate = Number(summary?.sales_cents) ? Number(summary?.settled_cents || 0) / Number(summary?.sales_cents) * 100 : 0;

  useEffect(() => { setPage(1); }, [search, settlement, acceptance, days, cropId]);

  const exportCsv = () => {
    const rows = [['Order ID','Buyer','District','Crop','Grade','Batch ID','Ordered kg','Accepted kg','Acceptance %','Price LKR/kg','Accepted value LKR','Settled LKR','Settlement status','Order status','Completed'], ...orders.map((item) => [item.order_id,item.buyer,item.destination_district,item.crop,item.grade,item.batch_id,item.ordered_kg,item.accepted_kg,`${acceptedPercent(item)}%`,(Number(item.price_cents_per_kg)/100).toFixed(2),(Number(item.sales_cents)/100).toFixed(2),(Number(item.settled_cents)/100).toFixed(2),settledState(item),item.order_status,item.completed_at])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'yieldmatrix-completed-orders.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) return <PageFrame title="Completed Orders Overview" description="Review completed deliveries, acceptance and settlement progress."><LoadingState/></PageFrame>;
  if (error && !data) return <PageFrame title="Completed Orders Overview" description="Review completed deliveries, acceptance and settlement progress."><ErrorState message={error} onRetry={load}/></PageFrame>;

  return <PageFrame className="ym06-completed-page" eyebrow="Farmer workspace" title="Completed Orders Overview" description="Review successfully fulfilled orders, verified delivery records and settlement status." hideHeader>
    <header className="ym06-completed-page-header"><div className="ym06-completed-title"><div className="ym06-completed-intro"><span>DEMO DASHBOARD</span><time>{new Intl.DateTimeFormat('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()}</time></div><h2>Completed Orders Overview</h2><p>Review your successfully fulfilled orders, verified delivery records and settlement status.</p></div><div className="ym06-completed-page-controls"><SelectField label="Reporting period" value={String(days)} onChange={(event) => setDays(Number(event.target.value))} options={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }]}/><SelectField label="Crop" value={cropId} onChange={(event) => setCropId(event.target.value)} options={[{ value: '', label: `All crops (${data?.crops?.length || 0})` }, ...(data?.crops || []).map((item) => ({ value: item.crop_id, label: item.crop }))]}/><button type="button" className="ym06-export-button" onClick={exportCsv} disabled={!orders.length}><ArrowDownToLine size={14}/> Export orders <ArrowRight size={12}/></button></div></header>
    {error && <div className="ym06-inline-error">Could not refresh completed orders. Showing the last loaded records.</div>}
    <section className="ym06-stat-grid ym06-completed-kpis">
      <article><small>TOTAL COMPLETED ORDERS</small><strong>{summary?.completed_orders || 0}</strong><span className="positive"><ArrowRight size={12}/> From the last {days} days</span></article>
      <article><small>TOTAL ACCEPTED QUANTITY</small><strong>{formatKg(summary?.accepted_kg)}</strong><span className="positive"><ArrowRight size={12}/> {acceptanceRate.toFixed(1)}% of agreed volume</span></article>
      <article><small>TOTAL SALES VALUE</small><strong>{formatLkr(summary?.sales_cents)}</strong><span className="positive">Verified accepted produce value</span></article>
      <article><small>SETTLED AMOUNT</small><strong>{formatLkr(summary?.settled_cents)}</strong><span className={settledRate >= 100 ? 'positive' : 'warning'}>{settledRate.toFixed(1)}% settled · {formatLkr(Math.max(0, Number(summary?.sales_cents || 0) - Number(summary?.settled_cents || 0)))} pending</span></article>
    </section>

    <section className="ym06-completed-insights">
      <article className="ym06-panel ym06-completed-trend"><div className="ym06-panel-heading"><div><h3>Monthly completed orders trend</h3><p>Accepted weekly harvest volume and verified completion count</p></div><span className="ym06-trend-legend"><i/> Accepted volume</span></div><WeeklyBars data={data!}/><div className="ym06-chart-footer"><span><span className="ym06-legend-dot"/> Accepted quantity · {formatKg(summary?.accepted_kg)}</span><span><BadgeCheck size={13}/> Delivered or closed orders</span></div></article>
      <article className="ym06-panel ym06-acceptance-card"><div className="ym06-panel-heading"><div><h3>Fulfilment acceptance rate</h3><p>Accepted versus agreed quantities</p></div><span className="ym06-optimal-pill">{acceptanceRate >= 95 ? 'On track' : 'Review'}</span></div><div className="ym06-acceptance-row"><span><i className="full"/> Fully accepted lines</span><strong>{summary?.fully_accepted_lines || 0}</strong></div><div className="ym06-acceptance-track"><i style={{ width: `${Math.min(100, acceptanceRate)}%` }}/></div><small>{acceptanceRate.toFixed(1)}% of agreed volume accepted</small><div className="ym06-acceptance-row partial"><span><i/> Partially accepted lines</span><strong>{summary?.partially_accepted_lines || 0}</strong></div><p>Calculated from quantities recorded on completed order allocations.</p><div className="ym06-rating-row"><span>Settlement completion</span><strong>{settledRate.toFixed(1)}%</strong></div></article>
    </section>

    <section className="ym06-panel ym06-completed-records">
      <div className="ym06-completed-filterbar"><div className="ym06-completed-tabs" role="group" aria-label="Filter by accepted quantity">{([['all','All completed',data?.orders.length || 0],['full','Fully accepted',summary?.fully_accepted_lines || 0],['partial','Partially accepted',summary?.partially_accepted_lines || 0]] as const).map(([key,label,count]) => <button type="button" key={key} className={acceptance === key ? 'active' : ''} onClick={() => setAcceptance(key)}>{label} <span>{count}</span></button>)}</div><div className="ym06-table-controls"><label className="ym06-table-search"><Search size={14}/><input aria-label="Search completed orders" placeholder="Search by order ID, buyer or produce" value={search} onChange={(event) => setSearch(event.target.value)}/></label><SelectField label="Settlement" value={settlement} onChange={(event) => setSettlement(event.target.value)} options={[{ value: 'all', label: 'All settlements' }, { value: 'settled', label: 'Settled' }, { value: 'outstanding', label: 'Outstanding' }]}/><button type="button" className="ym06-csv-button" onClick={exportCsv} disabled={!orders.length}><Download size={13}/> Download CSV</button></div></div>
      <div className="ym06-completed-dual-pane">
        <div className="ym06-completed-table-wrap">{pageOrders.length ? <Table className="ym06-completed-table" headers={['Order ID','Buyer','Produce','Ordered / accepted','Agreed price','Accepted value']}>
          {pageOrders.map((item, index) => <TableRow key={`${item.order_id}-${item.batch_id}-${index}`} className={`${selected?.order_id === item.order_id && selected?.batch_id === item.batch_id ? 'selected' : ''} ym06-selectable-row`} onClick={() => setSelectedKey(`${item.order_id}-${item.batch_id}`)}><td><strong>#{item.order_id.slice(0, 8).toUpperCase()}</strong></td><td><strong>{item.buyer}</strong><small className="ym06-cell-sub">{item.destination_district}</small></td><td><span className="ym06-produce-cell">{cropEmoji(item.crop)} {item.crop} · {item.grade}</span></td><td><strong>{formatKg(item.ordered_kg)}</strong><small className="ym06-acceptance-small">{formatKg(item.accepted_kg)} accepted · {acceptedPercent(item)}%</small></td><td>{formatLkr(item.price_cents_per_kg)} / kg</td><td><strong>{formatLkr(item.sales_cents)}</strong></td></TableRow>)}
        </Table> : <NoRecords title="No matching completed orders" description="Try changing your filters, or check a longer reporting period."/>}</div>
        {selected ? <aside className="ym06-order-detail"><div className="ym06-order-detail-head"><div><small>FULFILMENT INSPECTION RECORD</small><h3>Order #{selected.order_id.slice(0, 8).toUpperCase()}</h3></div><StatusBadge status={acceptedPercent(selected) === 100 ? 'Fully accepted' : 'Partially accepted'}/></div><div className="ym06-buyer-card"><small>BUYER PARTNER</small><strong>{selected.buyer}</strong><span>{selected.destination_district}</span></div><div className="ym06-order-detail-list"><div><span>Harvest batch ID</span><strong>{selected.batch_id.slice(0, 8).toUpperCase()}</strong></div><div><span>Order completion date</span><strong>{formatDate(selected.completed_at)}</strong></div><div><span>Produce</span><strong>{cropEmoji(selected.crop)} {selected.crop} · {selected.grade}</strong></div><div><span>Order status</span><strong>{selected.order_status}</strong></div></div><div className="ym06-financial-card"><small>FINANCIAL SETTLEMENT</small><div><span>Accepted {formatKg(selected.accepted_kg)} × {formatLkr(selected.price_cents_per_kg)}/kg</span><strong>{formatLkr(selected.sales_cents)}</strong></div><div><span>Settled amount</span><strong>{formatLkr(selected.settled_cents)}</strong></div><div className="total"><span>Outstanding</span><strong>{formatLkr(Math.max(0, Number(selected.sales_cents) - Number(selected.settled_cents)))}</strong></div></div><div className="ym06-ledger-mark"><Check size={14}/> Settlement status: {settledState(selected)}</div><button className="ym06-receipt-button" type="button" onClick={() => printReceipt(selected)}><Download size={14}/> Delivery receipt · Print / Save PDF</button><Link className="ym06-wallet-link" to="../wallet">View Agri wallet <ArrowRight size={13}/></Link></aside> : <aside className="ym06-order-detail ym06-order-detail-empty"><NoRecords title="Select an order" description="Choose a completed order to view its delivery and settlement details."/></aside>}
      </div>
      <div className="ym06-completed-pagination"><span>Showing <strong>{orders.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, orders.length)}</strong> of <strong>{orders.length}</strong> order lines</span><div><button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}><ChevronLeft size={13}/> Previous</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, currentPage - 2), Math.max(3, currentPage + 1)).map((value) => <button type="button" key={value} className={currentPage === value ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next <ChevronRight size={13}/></button></div></div>
    </section>
    <div className="ym06-harvest-footer-note"><BadgeCheck size={14}/> Completed order values and settlement amounts are read from recorded allocations. <Link to="../wallet">View farmer wallet <ArrowRight size={13}/></Link></div>
  </PageFrame>;
}
