import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronRight, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { useAuth } from '../../../context/AuthContext';
import ActiveBuyerDemands from '../components/ActiveBuyerDemands';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import FieldNotesCard from '../components/FieldNotesCard';
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
    Promise.all([getOverview(), getSales(7)]).then(([overviewData, salesData]) => { setOverview(overviewData); setSales(salesData); })
      .catch(() => setError('Your overview could not be loaded. Check the API connection and try again.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <PageFrame className="ym06-dashboard-page" title="Farmer dashboard" description="A clear view of your harvest and sales."><LoadingState/></PageFrame>;
  if (error || !overview) return <PageFrame className="ym06-dashboard-page" title="Farmer dashboard" description="A clear view of your harvest and sales."><ErrorState message={error || 'Overview data is unavailable.'} onRetry={load}/></PageFrame>;
  const { summary } = overview;
  const firstName = user?.name.split(' ')[0] || 'Farmer';
  const today = new Intl.DateTimeFormat('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

  return <PageFrame className="ym06-dashboard-page" eyebrow="Farmer dashboard" title={`Good morning, ${firstName}.`} description="Your harvest is growing. So are your opportunities." headerAction={<Link className="ym06-primary-action" to="../harvest-calendar">Add harvest <ArrowUpRight size={15}/></Link>}>
    <div className="ym06-dashboard-date"><span>DEMO DASHBOARD</span><time>{today.toUpperCase()}</time></div>
    <section className="ym06-stat-grid" aria-label="Farmer overview summary">
      <StatCard label="Accepted sales" value={formatLkr(summary.accepted_sales_cents)} subtext="Accepted produce value · 30 days"/>
      <StatCard label="Available harvest" value={formatKg(summary.available_kg)} subtext={`${summary.active_listings || 0} active produce listings`}/>
      <StatCard label="Pending allocations" value={String(summary.pending_allocations).padStart(2, '0')} subtext="Items requiring follow-up"/>
      <StatCard label="Completed orders" value={String(summary.completed_orders)} subtext="Accepted in the last 30 days"/>
    </section>
    <div className="ym06-dashboard-grid">
      <div className="ym06-dashboard-main">
        <ActiveBuyerDemands demands={overview.activeDemands || []}/>
        <section className="ym06-panel">
          <div className="ym06-panel-heading"><div><h3>Accepted sales</h3><p>LKR · last 7 days</p></div><Link className="ym06-inline-link" to="sales">Last 7 days <ChevronRight size={14}/></Link></div>
          {sales?.trend.length ? <PerformanceChart points={sales.trend.map((point) => ({ label: formatDate(point.period_start, { weekday: 'short' }), value: Number(point.sales_cents) / 100 }))} label="Accepted sales trend" valueLabel="LKR" showGrid={false} showYAxis={false} showAllLabels/> : <NoRecords title="No accepted sales this week" description="Sales will appear when accepted produce has been recorded."/>}
        </section>
        <section className="ym06-panel ym06-allocations-panel">
          <div className="ym06-panel-heading"><div><h3>Recent allocations</h3><p>Recent buyer and order activity</p></div><Link className="ym06-inline-link" to="../allocations">View all <ArrowRight size={14}/></Link></div>
          {overview.recentAllocations.length ? <Table className="ym06-table" headers={['Buyer / order', 'Produce', 'Quantity', 'Agreed value', 'Status']}>
            {overview.recentAllocations.slice(0, 3).map((item) => <TableRow key={item.id}><td><strong>{item.buyer}</strong><small className="ym06-cell-sub">{item.order_id.slice(0, 8).toUpperCase()}</small></td><td>{item.crop} · {item.grade}</td><td>{formatKg(item.agreed_kg)}</td><td>{formatLkr(item.agreed_value_cents)}</td><td><StatusBadge status={item.status}/></td></TableRow>)}
          </Table> : <NoRecords title="No allocations yet" description="Buyer allocations for your produce will appear here."/>}
        </section>
      </div>
      <aside className="ym06-dashboard-side" aria-label="Harvest and market summary">
        <section className="ym06-panel">
          <div className="ym06-panel-heading"><div><h3>Upcoming harvests</h3><p>Next planned batches</p></div><Link className="ym06-inline-link" to="harvests">View all <ArrowRight size={14}/></Link></div>
          {overview.upcomingHarvests.length ? <div className="ym06-upcoming-list">{overview.upcomingHarvests.slice(0, 3).map((item) => <div className="ym06-upcoming-item" key={item.id}><span className="ym06-produce-icon"><Sprout size={19}/></span><span className="ym06-upcoming-name"><strong>{item.crop} · {item.grade}</strong><small>{formatDate(item.planned_harvest_date, { day: '2-digit', month: 'short' })}</small></span><span className="ym06-upcoming-date"><strong>{formatKg(item.planned_kg)}</strong><small>{item.status === 'ready' ? 'Ready' : 'Expected'}</small></span></div>)}</div> : <NoRecords title="No upcoming harvests" description="Planned batches will appear here."/>}
        </section>
        <MarketInsightCard insights={overview.marketInsights}/>
        <FieldNotesCard harvests={overview.upcomingHarvests}/>
      </aside>
    </div>
  </PageFrame>;
}
