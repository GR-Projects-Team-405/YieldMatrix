import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Award, ChartNoAxesCombined, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatCard } from '../../../components/StatCard';
import { Table, TableRow } from '../../../components/Table';
import { StatusBadge } from '../../../components/StatusBadge';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';
import PerformanceChart from '../components/PerformanceChart';
import { formatDate, formatKg, formatLkr, getSales, type SalesPerformanceData } from '../ym06Api';

export default function SalesPerformance() {
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [days, setDays] = useState(30);
  const [cropId, setCropId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => { setLoading(true); setError(''); getSales(days, cropId).then(setData).catch(() => setError('Sales performance could not be loaded. Try again.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [days, cropId]);

  const transactions = useMemo(() => (data?.transactions || []).filter((row) => `${row.order_id} ${row.buyer} ${row.crop} ${row.destination_district}`.toLowerCase().includes(search.trim().toLowerCase())), [data, search]);
  const cropOptions = [{ value: '', label: 'All crops' }, ...(data?.crops || []).map((crop) => ({ value: crop.crop_id, label: crop.crop }))];
  const exportCsv = () => {
    if (!data) return;
    const rows = [['Order ID', 'Buyer', 'Crop', 'Grade', 'Accepted kg', 'Sales LKR', 'Settled LKR', 'District', 'Updated'], ...transactions.map((row) => [row.order_id, row.buyer, row.crop, row.grade, row.accepted_kg, (Number(row.sales_cents) / 100).toFixed(2), (Number(row.settled_cents) / 100).toFixed(2), row.destination_district, row.updated_at])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'yieldmatrix-sales-performance.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) return <PageFrame title="Sales performance" description="Track accepted sales, volume and payments."><LoadingState/></PageFrame>;
  if (error && !data) return <PageFrame title="Sales performance" description="Track accepted sales, volume and payments."><ErrorState message={error} onRetry={load}/></PageFrame>;
  const summary = data?.summary;
  const bestCrop = data?.crops[0];

  return <PageFrame title="Sales performance" description="Track accepted produce value, quantity and settlement activity.">
    <div className="ym06-toolbar"><div className="ym06-toolbar-note"><span className="ym06-live-dot"/>Verified sales from accepted allocations</div><div className="ym06-toolbar-controls"><SelectField label="Reporting period" value={String(days)} onChange={(event) => setDays(Number(event.target.value))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]}/><SelectField label="Crop" value={cropId} onChange={(event) => setCropId(event.target.value)} options={cropOptions}/><button type="button" className="ym06-export-button" onClick={exportCsv} disabled={!transactions.length}><ArrowDownToLine size={16}/> Export report</button></div></div>
    {error && data && <div className="ym06-inline-error">{error} Showing the last loaded results.</div>}
    <section className="ym06-stat-grid ym06-sales-stats">
      <StatCard label="Total sales revenue" value={formatLkr(summary?.sales_cents)} subtext="Accepted produce value"/>
      <StatCard label="Accepted quantity sold" value={formatKg(summary?.accepted_kg)} subtext="Net accepted weight"/>
      <StatCard label="Completed orders" value={String(summary?.completed_orders || 0)} subtext={`${summary?.active_crops || 0} crops represented`}/>
      <StatCard label="Amount settled" value={formatLkr(summary?.settled_cents)} subtext="Recorded settlements" highlight/>
    </section>
    <div className="ym06-sales-grid">
      <section className="ym06-panel"><div className="ym06-panel-heading"><div><h3>Revenue &amp; quantity trend</h3><p>Accepted produce over the selected period</p></div><span className="ym06-small-pill"><ChartNoAxesCombined size={14}/> LKR</span></div>{data?.trend.length ? <PerformanceChart points={data.trend.map((point) => ({ label: formatDate(point.period_start, { day: '2-digit', month: 'short' }), value: Number(point.sales_cents) / 100 }))} label="Sales revenue trend" valueLabel="LKR"/> : <NoRecords title="No sales in this period" description="Accepted sales will appear here when fulfilled orders have been recorded."/>}<div className="ym06-panel-footnote">Sales value is calculated from accepted kilograms and the agreed unit price.</div></section>
      <section className="ym06-panel"><div className="ym06-panel-heading"><div><h3>Sales by crop</h3><p>Accepted produce mix</p></div></div>{data?.crops.length ? <div className="ym06-crop-share-list">{data.crops.map((crop, index) => { const max = Number(data.crops[0]?.accepted_kg || 1); const percent = Math.max(4, Number(crop.accepted_kg) / max * 100); return <div className="ym06-crop-share" key={`${crop.crop_id}-${crop.grade}`}><div><span className={`ym06-crop-color ym06-crop-color-${index % 4}`}/><span><strong>{crop.crop} · {crop.grade}</strong><small>{formatKg(crop.accepted_kg)}</small></span><b>{formatLkr(crop.sales_cents)}</b></div><span className="ym06-progress-track"><span className={`ym06-progress-fill ym06-progress-fill-${index % 4}`} style={{ width: `${percent}%` }}/></span></div>; })}</div> : <NoRecords title="Crop breakdown unavailable" description="Crop performance appears after accepted sales are recorded."/>}{bestCrop && <div className="ym06-best-performer"><span className="ym06-award-icon"><Award size={18}/></span><div><small>Top crop by quantity</small><strong>{bestCrop.crop} · {bestCrop.grade}</strong><span>{formatKg(bestCrop.accepted_kg)} accepted</span></div></div>}</section>
    </div>
    <section className="ym06-panel ym06-transactions-panel"><div className="ym06-panel-heading"><div><h3>Recent sales transactions</h3><p>{transactions.length} accepted line items in this view</p></div><label className="ym06-table-search"><Search size={15}/><input aria-label="Search sales" placeholder="Search order, buyer, crop…" value={search} onChange={(event) => setSearch(event.target.value)}/></label></div>{transactions.length ? <Table className="ym06-table" headers={['Order / buyer', 'Produce', 'Accepted', 'Unit price', 'Sales value', 'Settled', 'Updated']}>
      {transactions.map((row, index) => <TableRow key={`${row.order_id}-${row.crop}-${index}`}><td><strong>{row.order_id.slice(0, 8).toUpperCase()}</strong><small className="ym06-cell-sub">{row.buyer}</small></td><td>{row.crop} · {row.grade}</td><td>{formatKg(row.accepted_kg)}</td><td>{formatLkr(row.price_cents_per_kg)} / kg</td><td><strong>{formatLkr(row.sales_cents)}</strong></td><td><StatusBadge status={Number(row.settled_cents) >= Number(row.sales_cents) ? 'Settled' : 'Pending settlement'}/></td><td>{formatDate(row.updated_at)}</td></TableRow>)}
    </Table> : <NoRecords title={search ? 'No matching sales' : 'No sales recorded'} description={search ? 'Try another order, buyer or crop search.' : 'Completed sales line items will appear here.'}/>}<div className="ym06-table-footer"><span>Showing {transactions.length} of {data?.transactions.length || 0} line items</span><Link to="completed-orders">See completed orders <ArrowRight size={14}/></Link></div></section>
  </PageFrame>;
}
