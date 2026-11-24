import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Award, Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatCard } from '../../../components/StatCard';
import { Table, TableRow } from '../../../components/Table';
import { StatusBadge } from '../../../components/StatusBadge';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';
import PerformanceChart from '../components/PerformanceChart';
import { formatDate, formatKg, formatLkr, getSales, type SalesCrop, type SalesPerformanceData } from '../ym06Api';

const pageSize = 5;
const cropColors = ['#315a42', '#e7a06c', '#8fa998', '#b8a67a', '#638374'];

export default function SalesPerformance() {
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [cropChoices, setCropChoices] = useState<SalesCrop[]>([]);
  const [days, setDays] = useState(30);
  const [cropId, setCropId] = useState('');
  const [metric, setMetric] = useState<'revenue' | 'quantity'>('revenue');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    getSales(days, cropId).then((result) => {
      setData(result);
      if (!cropId) setCropChoices(result.crops);
    }).catch(() => setError('Sales performance could not be loaded. Try again.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [days, cropId]);

  const transactions = useMemo(() => (data?.transactions || []).filter((row) => {
    const matchesSearch = `${row.order_id} ${row.buyer} ${row.crop} ${row.destination_district}`.toLowerCase().includes(search.trim().toLowerCase());
    const settled = Number(row.settled_cents) >= Number(row.sales_cents);
    const matchesStatus = status === 'all'
      || (status === 'fulfilled' && ['delivered', 'closed'].includes(row.order_status))
      || (status === 'in_fulfilment' && row.order_status === 'in_fulfilment')
      || (status === 'outstanding' && !settled);
    return matchesSearch && matchesStatus;
  }), [data, search, status]);
  useEffect(() => { setPage(1); }, [search, status, days, cropId]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const pageRows = transactions.slice((page - 1) * pageSize, page * pageSize);
  const cropOptions = [{ value: '', label: `All crops${cropChoices.length ? ` (${cropChoices.length})` : ''}` }, ...cropChoices.map((crop) => ({ value: crop.crop_id, label: `${crop.crop} · ${crop.grade}` }))];
  const totalCropKg = (data?.crops || []).reduce((sum, item) => sum + Number(item.accepted_kg), 0);
  const totalCropSales = (data?.crops || []).reduce((sum, item) => sum + Number(item.sales_cents), 0);
  const bestCrop = [...(data?.crops || [])].sort((a, b) => Number(b.sales_cents) - Number(a.sales_cents))[0];
  const donutGradient = (data?.crops || []).reduce<{ stops: string[]; current: number }>((acc, item, index) => {
    const share = totalCropKg ? Number(item.accepted_kg) / totalCropKg * 100 : 0;
    const color = cropColors[index % cropColors.length];
    acc.stops.push(`${color} ${acc.current}% ${acc.current + share}%`);
    acc.current += share;
    return acc;
  }, { stops: [], current: 0 }).stops.join(', ');

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Order ID', 'Buyer', 'Crop', 'Grade', 'Accepted kg', 'Unit price LKR/kg', 'Sales LKR', 'Order status', 'Settlement LKR', 'District', 'Updated'], ...transactions.map((row) => [row.order_id, row.buyer, row.crop, row.grade, row.accepted_kg, (Number(row.price_cents_per_kg) / 100).toFixed(2), (Number(row.sales_cents) / 100).toFixed(2), row.order_status, (Number(row.settled_cents) / 100).toFixed(2), row.destination_district, row.updated_at])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'yieldmatrix-sales-performance.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) return <PageFrame title="Sales performance" description="Track your sales, revenue, and produce performance with verified buyers."><LoadingState/></PageFrame>;
  if (error && !data) return <PageFrame title="Sales performance" description="Track your sales, revenue, and produce performance with verified buyers."><ErrorState message={error} onRetry={load}/></PageFrame>;
  const summary = data?.summary;
  const completedOrders = Number(summary?.completed_orders || 0);
  const averageOrderValue = completedOrders ? Math.round(Number(summary?.sales_cents || 0) / completedOrders) : 0;
  const chartPoints = data?.trend.map((point) => ({
    label: formatDate(point.period_start, days === 7 ? { weekday: 'short' } : { day: '2-digit', month: 'short' }),
    value: metric === 'revenue' ? Number(point.sales_cents) / 100 : Number(point.accepted_kg),
  })) || [];
  const maxPeriodKg = Math.max(1, ...(data?.trend || []).map((point) => Number(point.accepted_kg)));
  const visiblePages = Array.from({ length: Math.min(totalPages, 3) }, (_, index) => Math.min(Math.max(page - 1, 1), Math.max(totalPages - 2, 1)) + index);

  return <PageFrame className="ym06-sales-page-frame" title="Sales performance" description="Track your sales, revenue, and produce performance with verified buyers." hideHeader>
    <header className="ym06-sales-page-header"><div className="ym06-sales-title"><div className="ym06-demo-stamp"><span>DEMO DASHBOARD</span><time>{formatDate(new Date().toISOString())}</time></div><h2>Sales Performance</h2><p>Track your sales, revenue, and produce performance with verified buyers.</p></div><div className="ym06-sales-controls"><SelectField label="Reporting period" value={String(days)} onChange={(event) => setDays(Number(event.target.value))} options={[{ value: '30', label: 'Last 30 days' }, { value: '7', label: 'Last 7 days' }, { value: '90', label: 'Last 3 months' }]}/><SelectField label="Crop" value={cropId} onChange={(event) => setCropId(event.target.value)} options={cropOptions}/><button type="button" className="ym06-export-button" onClick={exportCsv} disabled={!transactions.length}><ArrowUpRight size={15}/> Export report</button></div></header>
    {error && data && <div className="ym06-inline-error">{error} Showing the last loaded results.</div>}
    <section className="ym06-stat-grid ym06-sales-stats" aria-label="Sales summary">
      <StatCard label="Total sales revenue" value={formatLkr(summary?.sales_cents)} subtext="From accepted produce"/>
      <StatCard label="Total quantity sold" value={formatKg(summary?.accepted_kg)} subtext="Accepted weight"/>
      <StatCard label="Completed orders" value={String(completedOrders)} subtext={`${summary?.active_crops || 0} crops in this period`}/>
      <StatCard label="Average order value" value={formatLkr(averageOrderValue)} subtext="Sales value per completed order"/>
    </section>

    <div className="ym06-sales-layout">
      <div className="ym06-sales-primary">
        <section className="ym06-panel ym06-revenue-panel"><div className="ym06-panel-heading"><div><h3>Revenue &amp; quantity trend</h3><p>Daily accepted sales, grouped for the selected period</p></div><div className="ym06-chart-toggle" role="group" aria-label="Chart measure"><button type="button" className={metric === 'revenue' ? 'active' : ''} onClick={() => setMetric('revenue')}>Revenue (LKR)</button><button type="button" className={metric === 'quantity' ? 'active' : ''} onClick={() => setMetric('quantity')}>Quantity (kg)</button></div></div>
          {chartPoints.length ? <PerformanceChart points={chartPoints} label={metric === 'revenue' ? 'Accepted sales revenue trend' : 'Accepted sales quantity trend'} valueLabel={metric === 'revenue' ? 'LKR' : 'kg'}/> : <NoRecords title="No sales in this period" description="Accepted sales will appear here when fulfilled orders have been recorded."/>}
          <div className="ym06-weekly-heading"><strong>Quantity dispatched by period</strong><span>Total volume: {formatKg(summary?.accepted_kg)}</span></div>
          {data?.trend.length ? <div className="ym06-weekly-bars">{data.trend.slice(-5).map((point, index) => <div className="ym06-weekly-bar" key={point.period_start}><span className="ym06-weekly-bar-value">{formatKg(point.accepted_kg)}</span><span className={`ym06-weekly-bar-track ${index === Math.min(3, data.trend.slice(-5).length - 1) ? 'highlight' : ''}`}><span style={{ height: `${Math.max(6, Number(point.accepted_kg) / maxPeriodKg * 100)}%` }}/></span><small>{days === 7 ? formatDate(point.period_start, { weekday: 'short' }) : `W${index + 1}`}</small></div>)}</div> : <p className="ym06-no-period-data">No dispatch volume recorded for this period.</p>}
        </section>

        <section className="ym06-panel ym06-produce-breakdown"><div className="ym06-panel-heading"><div><h3>Produce performance breakdown</h3><p>Volume, unit yield value and sales contribution by crop</p></div><span className="ym06-small-pill">{data?.crops.length || 0} active crops</span></div>
          {data?.crops.length ? <div className="ym06-breakdown-list">{data.crops.map((item, index) => { const share = totalCropSales ? Number(item.sales_cents) / totalCropSales * 100 : 0; return <article className="ym06-breakdown-item" key={`${item.crop_id}-${item.grade}`}><div className="ym06-breakdown-top"><span className={`ym06-breakdown-crop-mark ym06-crop-color-${index % 4}`}>{item.crop.toLowerCase().includes('tomato') ? '🍅' : item.crop.toLowerCase().includes('carrot') ? '🥕' : item.crop.toLowerCase().includes('cabbage') ? '🥬' : '🌿'}</span><div className="ym06-breakdown-name"><strong>{item.crop} · {item.grade}</strong><small>{formatKg(item.accepted_kg)} sold</small></div><div className="ym06-breakdown-revenue"><strong>{formatLkr(item.sales_cents)}</strong><small>{share.toFixed(0)}% of sales</small></div></div><div className="ym06-breakdown-track"><span className={`ym06-progress-fill-${index % 4}`} style={{ width: `${Math.max(3, share)}%` }}/></div></article>; })}</div> : <NoRecords title="No crop sales to break down" description="Crop performance will appear once accepted quantities are recorded."/>}
        </section>
      </div>

      <aside className="ym06-sales-aside">
        <section className="ym06-panel ym06-crop-donut-panel"><div className="ym06-panel-heading"><div><h3>Sales by crop share</h3><p>Volume contribution by crop</p></div></div>
          {data?.crops.length ? <><div className="ym06-donut-row"><div className="ym06-donut" style={{ background: `conic-gradient(${donutGradient})` }} role="img" aria-label="Accepted sales quantity share by crop"><div><strong>{formatKg(totalCropKg)}</strong><small>{data.crops.length} crops</small></div></div></div><div className="ym06-donut-legend">{data.crops.map((item, index) => { const percent = totalCropKg ? Number(item.accepted_kg) / totalCropKg * 100 : 0; return <div key={`${item.crop_id}-${item.grade}`}><span className={`ym06-crop-color ym06-crop-color-${index % 4}`}/><span className="ym06-legend-crop">{item.crop} · {item.grade}</span><strong>{percent.toFixed(0)}%</strong><small>{formatKg(item.accepted_kg)}</small></div>; })}</div></> : <NoRecords title="Crop share unavailable" description="Accepted volume by crop will appear here."/>}
        </section>
        {bestCrop && <section className="ym06-panel ym06-top-earner"><div className="ym06-earner-heading"><span className="ym06-award-icon"><Award size={17}/></span><span>TOP EARNER</span></div><small>Best performing crop</small><h3>{bestCrop.crop} · {bestCrop.grade}</h3><p>{formatKg(bestCrop.accepted_kg)} accepted with {formatLkr(bestCrop.sales_cents)} in sales during this period.</p><Link to="../buyer-requests">View buyer demand <ArrowRight size={13}/></Link></section>}
      </aside>
    </div>

    <section className="ym06-panel ym06-transactions-panel"><div className="ym06-panel-heading"><div><h3>Recent sales transactions</h3><p>{transactions.length} of {data?.transactions.length || 0} accepted line items in this view</p></div><div className="ym06-sales-table-controls"><label className="ym06-table-search"><Search size={15}/><input aria-label="Search sales" placeholder="Search order, buyer, crop…" value={search} onChange={(event) => setSearch(event.target.value)}/></label><SelectField label="Order status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'all', label: 'All statuses' }, { value: 'fulfilled', label: 'Delivered / closed' }, { value: 'in_fulfilment', label: 'In fulfilment' }, { value: 'outstanding', label: 'Unsettled value' }]}/><button type="button" className="ym06-csv-button" onClick={exportCsv} disabled={!transactions.length}><Download size={14}/> Download CSV</button></div></div>
      {pageRows.length ? <Table className="ym06-table ym06-sales-table" headers={['Order ID', 'Buyer', 'Product', 'Quantity', 'Unit price', 'Total amount', 'Order date', 'Status', 'Action']}>
        {pageRows.map((row, index) => { const orderComplete = ['delivered', 'closed'].includes(row.order_status); const paid = Number(row.settled_cents) >= Number(row.sales_cents); const badge = orderComplete ? (paid ? 'Completed · Paid' : 'Pending settlement') : row.order_status.replaceAll('_', ' '); return <TableRow key={`${row.order_id}-${row.crop}-${index}`}><td><strong>#{row.order_id.slice(0, 8).toUpperCase()}</strong></td><td>{row.buyer}</td><td>{row.crop} · {row.grade}</td><td>{formatKg(row.accepted_kg)}</td><td>{formatLkr(row.price_cents_per_kg)} / kg</td><td><strong>{formatLkr(row.sales_cents)}</strong></td><td>{formatDate(row.updated_at, { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><StatusBadge status={badge}/></td><td><Link className="ym06-row-action" to="../records">{orderComplete ? 'Invoice' : 'Details'} <ArrowUpRight size={12}/></Link></td></TableRow>; })}
      </Table> : <NoRecords title={search ? 'No matching sales' : 'No sales recorded'} description={search ? 'Try another order, buyer or crop search.' : 'Completed sales line items will appear here.'}/>}<div className="ym06-pagination"><span>Showing {transactions.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, transactions.length)} of {transactions.length} line items</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>{visiblePages.map((pageNumber) => <button type="button" className={page === pageNumber ? 'active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    </section>
  </PageFrame>;
}
