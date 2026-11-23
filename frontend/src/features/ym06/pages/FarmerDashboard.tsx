import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronRight, ClipboardCheck, PackageCheck, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { useAuth } from '../../../context/AuthContext';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import MarketInsightCard from '../components/MarketInsightCard';
import PageFrame from '../components/PageFrame';
import PerformanceChart from '../components/PerformanceChart';
import { formatDate, formatKg, formatLkr, getOverview, getSales, type Overview, type SalesPerformanceData } from '../ym06Api';

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sales, setSales] = useState<SalesPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true); setError('');
    Promise.all([getOverview(), getSales(30)]).then(([overviewData, salesData]) => { setOverview(overviewData); setSales(salesData); })
      .catch(() => setError('Your overview could not be loaded. Check the API connection and try again.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <PageFrame title="Farmer dashboard" description="A clear view of your harvest and sales."><LoadingState/></PageFrame>;
  if (error || !overview) return <PageFrame title="Farmer dashboard" description="A clear view of your harvest and sales."><ErrorState message={error || 'Overview data is unavailable.'} onRetry={load}/></PageFrame>;
  const { summary } = overview;
  const firstName = user?.name.split(' ')[0] || 'Farmer';

  return <PageFrame eyebrow="Your farm at a glance" title={`Good morning, ${firstName}.`} description="Your harvest is growing. Here’s your latest overview.">
    <section className="ym06-stat-grid" aria-label="Farmer overview summary">
      <StatCard label="Accepted sales · 30 days" value={formatLkr(summary.accepted_sales_cents)} subtext="Value of accepted produce"/>
      <StatCard label="Available harvest" value={formatKg(summary.available_kg)} subtext={`${summary.active_listings || 0} active listings`}/>
      <StatCard label="Pending allocations" value={String(summary.pending_allocations)} subtext="Items requiring follow-up"/>
      <StatCard label="Completed orders" value={String(summary.completed_orders)} subtext="Delivered or closed · 30 days" highlight/>
    </section>
    <div className="ym06-dashboard-grid">
      <section className="ym06-panel">
        <div className="ym06-panel-heading"><div><h3>Sales trend</h3><p>Accepted sales value · last 30 days</p></div><Link className="ym06-inline-link" to="sales">View performance <ArrowRight size={14}/></Link></div>
        {sales?.trend.length ? <PerformanceChart points={sales.trend.map((point) => ({ label: formatDate(point.period_start, { day: '2-digit', month: 'short' }), value: Number(point.sales_cents) / 100 }))} label="Accepted sales trend" valueLabel="LKR"/> : <NoRecords title="No accepted sales yet" description="Sales trends will appear when completed allocations have acceptance records."/>}
        <div className="ym06-chart-footer"><span><span className="ym06-legend-dot"/> Accepted sales (LKR)</span><Link to="sales">Open sales performance <ChevronRight size={14}/></Link></div>
      </section>
      <MarketInsightCard insights={overview.marketInsights}/>
      <section className="ym06-panel">
        <div className="ym06-panel-heading"><div><h3>Upcoming harvests</h3><p>Next planned and ready batches</p></div><Link className="ym06-inline-link" to="harvests">View all <ArrowRight size={14}/></Link></div>
        {overview.upcomingHarvests.length ? <div className="ym06-upcoming-list">{overview.upcomingHarvests.slice(0, 4).map((item) => <div className="ym06-upcoming-item" key={item.id}><span className="ym06-produce-icon"><Sprout size={19}/></span><span className="ym06-upcoming-name"><strong>{item.crop} · {item.grade}</strong><small>{item.farm} · {item.district}</small></span><span className="ym06-upcoming-date"><strong>{formatDate(item.planned_harvest_date, { day: '2-digit', month: 'short' })}</strong><small>{formatKg(item.planned_kg)}</small></span><StatusBadge status={item.status}/></div>)}</div> : <NoRecords title="No upcoming harvests" description="Planned and ready harvest batches will appear here."/>}
      </section>
      <section className="ym06-panel ym06-allocations-panel">
        <div className="ym06-panel-heading"><div><h3>Recent allocations</h3><p>Recent buyer and order activity</p></div><Link className="ym06-inline-link" to="../allocations">View allocations <ArrowRight size={14}/></Link></div>
        {overview.recentAllocations.length ? <Table className="ym06-table" headers={['Buyer / order', 'Produce', 'Quantity', 'Agreed value', 'Status']}>
          {overview.recentAllocations.map((item) => <TableRow key={item.id}><td><strong>{item.buyer}</strong><small className="ym06-cell-sub">{item.order_id.slice(0, 8).toUpperCase()}</small></td><td>{item.crop} · {item.grade}</td><td>{formatKg(item.agreed_kg)}</td><td>{formatLkr(item.agreed_value_cents)}</td><td><StatusBadge status={item.status}/></td></TableRow>)}
        </Table> : <NoRecords title="No allocations yet" description="Buyer allocations for your produce will appear here."/>}
      </section>
    </div>
    <div className="ym06-dashboard-shortcuts"><Link to="sales"><ChartNoAxesCombined size={17}/> Sales performance <ArrowRight size={14}/></Link><Link to="harvests"><CalendarDays size={17}/> Upcoming harvests <ArrowRight size={14}/></Link><Link to="completed-orders"><ClipboardCheck size={17}/> Completed orders <ArrowRight size={14}/></Link><Link to="../market-insights"><PackageCheck size={17}/> Market insights <ArrowRight size={14}/></Link></div>
  </PageFrame>;
}
