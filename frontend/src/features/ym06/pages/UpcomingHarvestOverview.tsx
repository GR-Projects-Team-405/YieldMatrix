import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, ListFilter, MapPin, Search, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatDate, formatKg, getHarvests, type Harvest } from '../ym06Api';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';

const dateOnly = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const startToday = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; };
const cropEmoji = (crop: string) => /tomato/i.test(crop) ? '🍅' : /carrot/i.test(crop) ? '🥕' : /cabbage/i.test(crop) ? '🥬' : /pepper/i.test(crop) ? '🫑' : '🌱';
const daysUntil = (date: string) => Math.ceil((dateOnly(date).getTime() - startToday().getTime()) / 86400000);

function HarvestCalendar({ harvests, month, setMonth }: { harvests: Harvest[]; month: Date; setMonth: (value: Date) => void }) {
  const firstDay = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const byDay = new Map<number, Harvest[]>();
  harvests.filter((item) => item.planned_harvest_date.startsWith(key)).forEach((item) => {
    const day = Number(item.planned_harvest_date.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) || []), item]);
  });
  const label = new Intl.DateTimeFormat('en-LK', { month: 'long', year: 'numeric' }).format(month);
  return <section className="ym06-panel ym06-harvest-calendar-panel">
    <div className="ym06-calendar-header"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17}/></button><h3>{label}</h3><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17}/></button><button type="button" className="ym06-today-button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button></div>
    <div className="ym06-calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <span className="ym06-calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: firstDay }, (_, index) => <span className="ym06-calendar-blank" key={`blank-${index}`}/>)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const items = byDay.get(day) || []; const today = new Date().toDateString() === new Date(month.getFullYear(), month.getMonth(), day).toDateString(); return <div className={`ym06-calendar-day ${items.length ? 'has-harvest' : ''} ${today ? 'is-today' : ''}`} key={day}><span>{String(day).padStart(2, '0')}</span>{items.slice(0, 2).map((item) => <span className={`ym06-calendar-event ${item.status}`} key={item.id} title={`${item.crop} · ${item.grade} · ${formatKg(item.planned_kg)}`}><Sprout size={10}/>{item.crop}</span>)}{items.length > 2 && <small>+{items.length - 2} more</small>}</div>; })}</div>
    {!harvests.some((item) => item.planned_harvest_date.startsWith(key)) && <NoRecords title="No harvests this month" description="Try another month or return to list view."/>}
    <div className="ym06-calendar-legend"><span><i className="ready"/>Ready for harvest</span><span><i className="planned"/>Planned</span></div>
  </section>;
}

export default function UpcomingHarvestOverview() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [crop, setCrop] = useState('');
  const [farm, setFarm] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'quantity'>('date');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const load = () => { setLoading(true); setError(''); getHarvests().then(setHarvests).catch(() => setError('Upcoming harvests could not be loaded. Try again.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const crops = useMemo(() => [...new Set(harvests.map((item) => item.crop))].sort(), [harvests]);
  const farms = useMemo(() => [...new Set(harvests.map((item) => item.farm))].sort(), [harvests]);
  const filtered = useMemo(() => harvests.filter((item) => {
    const q = search.trim().toLowerCase();
    const delta = daysUntil(item.planned_harvest_date);
    const matchesStatus = status === 'all' || item.status === status || (status === 'approaching' && item.status !== 'ready' && delta >= 0 && delta <= 7);
    return (!crop || item.crop === crop) && (!farm || item.farm === farm) && matchesStatus && (!q || `${item.crop} ${item.grade} ${item.farm} ${item.district} ${item.id}`.toLowerCase().includes(q));
  }).sort((a, b) => sort === 'date' ? a.planned_harvest_date.localeCompare(b.planned_harvest_date) : Number(b.planned_kg) - Number(a.planned_kg)), [harvests, crop, farm, status, search, sort]);
  const expectedKg = filtered.reduce((total, item) => total + Number(item.planned_kg), 0);
  const today = startToday();
  const nextWeek = filtered.filter((item) => { const delta = daysUntil(item.planned_harvest_date); return delta >= 0 && delta < 7; });
  const ready = filtered.filter((item) => item.status === 'ready');
  const nextWeekKg = nextWeek.reduce((total, item) => total + Number(item.planned_kg), 0);
  const distribution = [...new Set(nextWeek.map((item) => item.crop))].map((name) => ({ crop: name, kg: nextWeek.filter((item) => item.crop === name).reduce((sum, item) => sum + Number(item.planned_kg), 0) })).sort((a, b) => b.kg - a.kg);

  if (loading) return <PageFrame title="Upcoming Harvest Overview" description="Plan, monitor and coordinate your expected harvest batches."><LoadingState/></PageFrame>;
  if (error) return <PageFrame title="Upcoming Harvest Overview" description="Plan, monitor and coordinate your expected harvest batches."><ErrorState message={error} onRetry={load}/></PageFrame>;

  return <PageFrame className="ym06-harvest-page" eyebrow="Farmer workspace" title="Upcoming Harvest Overview" description="Plan, monitor and coordinate your expected harvest dispatches with verified buyers." hideHeader>
    <header className="ym06-harvest-page-header"><div className="ym06-harvest-title-block"><div className="ym06-harvest-intro"><span>DEMO DASHBOARD</span><time>{new Intl.DateTimeFormat('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }).format(today).toUpperCase()}</time></div><h2>Upcoming Harvest Overview</h2><p>Plan, monitor, and coordinate your expected bulk harvest dispatches with verified buyers.</p></div><div className="ym06-harvest-page-controls"><div className="ym06-harvest-toolbar">
      <div className="ym06-view-toggle" role="group" aria-label="Harvest view"><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><ListFilter size={14}/> List view</button><button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={14}/> Calendar view</button></div>
      <SelectField label="Crop" value={crop} onChange={(event) => setCrop(event.target.value)} options={[{ value: '', label: `All crops (${crops.length})` }, ...crops.map((item) => ({ value: item, label: item }))]}/>
      <SelectField label="Farm" value={farm} onChange={(event) => setFarm(event.target.value)} options={[{ value: '', label: `All farms (${farms.length})` }, ...farms.map((item) => ({ value: item, label: item }))]}/>
      <Link className="ym06-add-link" to="../harvest-calendar"><Sprout size={14}/> Add harvest <ArrowRight size={13}/></Link>
    </div></div></header>
    <section className="ym06-stat-grid ym06-harvest-stats">
      <article className="ym06-harvest-kpi"><small>UPCOMING HARVEST BATCHES</small><strong>{String(filtered.length).padStart(2, '0')}</strong><span>{ready.length} ready · {filtered.length - ready.length} planned</span></article>
      <article className="ym06-harvest-kpi"><small>EXPECTED TOTAL QUANTITY</small><strong>{formatKg(expectedKg)}</strong><span>Across {new Set(filtered.map((item) => item.crop)).size} crop types</span></article>
      <article className="ym06-harvest-kpi priority"><small>HARVESTING THIS WEEK (NEXT 7D)</small><strong>{String(nextWeek.length).padStart(2, '0')} <em>{nextWeekKg > 0 ? `${formatKg(nextWeekKg)} planned` : 'No batches scheduled'}</em></strong><span><Clock3 size={13}/> {nextWeek.length ? 'Upcoming harvest window' : 'Check another week'}</span></article>
      <article className="ym06-harvest-kpi"><small>READY FOR COLLECTION</small><strong>{String(ready.length).padStart(2, '0')}</strong><span>{ready.length ? 'Marked ready in your harvest records' : 'No batches marked ready'}</span></article>
    </section>

    <section className="ym06-harvest-layout">
      <div className="ym06-harvest-main">
        <section className="ym06-panel ym06-harvest-filter-panel"><div className="ym06-harvest-filters"><label className="ym06-harvest-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search crop, plot, field or batch ID..."/></label><div className="ym06-status-filter" role="group" aria-label="Filter harvest status">{(['all', 'ready', 'approaching', 'planned'] as const).map((value) => <button type="button" key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{value === 'all' ? 'All statuses' : value === 'ready' ? 'Ready' : value === 'approaching' ? 'Approaching' : 'Planned'}</button>)}</div><label className="ym06-harvest-sort">Sort by: <select value={sort} onChange={(event) => setSort(event.target.value as 'date' | 'quantity')} aria-label="Sort harvests"><option value="date">Harvest date (nearest)</option><option value="quantity">Quantity (highest)</option></select></label></div></section>
        {view === 'calendar' ? <HarvestCalendar harvests={filtered} month={month} setMonth={setMonth}/> : filtered.length ? <div className="ym06-harvest-list">{filtered.map((item) => { const delta = daysUntil(item.planned_harvest_date); const stateLabel = item.status === 'ready' ? 'Ready for harvest' : delta <= 2 ? `Approaching${delta >= 0 ? ` · ${delta}d` : ''}` : delta <= 7 ? 'This week' : 'Planned'; const progress = item.status === 'ready' ? 100 : delta <= 2 ? 72 : delta <= 7 ? 55 : 35; return <article className={`ym06-upcoming-card ${item.status === 'ready' ? 'is-ready' : ''}`} key={item.id}>
            <div className="ym06-upcoming-card-top"><span className={`ym06-harvest-crop-icon ym06-crop-color-${item.crop.length % 4}`}>{cropEmoji(item.crop)}</span><div className="ym06-harvest-info"><div className="ym06-harvest-title"><h3>{item.crop} · {item.grade}</h3><StatusBadge status={item.status === 'ready' ? 'Ready' : stateLabel}/></div><p><MapPin size={13}/>{item.farm} · {item.district} <span>· Batch #{item.id.slice(0, 8).toUpperCase()}</span></p></div><div className="ym06-upcoming-date"><small>EXPECTED HARVEST DATE</small><strong>{formatDate(item.planned_harvest_date, { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div><div className="ym06-upcoming-quantity"><small>EST. QUANTITY</small><strong>{formatKg(item.planned_kg)}</strong></div></div>
            <div className="ym06-upcoming-progress-label"><span>Harvest readiness</span><span>{progress}%</span></div><div className="ym06-harvest-progress"><span className={item.status} style={{ width: `${progress}%` }}/></div>
            <div className="ym06-upcoming-card-bottom"><span>{item.status === 'ready' ? 'Ready for collection based on your harvest record.' : 'Planned harvest; update progress from your harvest calendar.'}</span><Link to="../harvest-calendar">View batch details <ArrowRight size={13}/></Link></div>
          </article>; })}</div> : <NoRecords title="No upcoming harvests found" description="Change the filters or add harvests through your harvest calendar."/>}
      </div>
      <aside className="ym06-harvest-aside">
        {view === 'list' && <HarvestCalendar harvests={filtered} month={month} setMonth={setMonth}/>}
        <section className="ym06-panel ym06-harvest-side-panel"><div className="ym06-side-title"><h3>Next 7 days harvest yield</h3><strong>{formatKg(nextWeekKg)}</strong></div><p>Quantity expected from batches scheduled in the next seven days.</p>{distribution.length ? <div className="ym06-yield-list">{distribution.map((item, index) => <div className="ym06-yield-item" key={item.crop}><div><span>{cropEmoji(item.crop)} {item.crop}</span><strong>{formatKg(item.kg)} <small>({nextWeekKg ? Math.round(item.kg / nextWeekKg * 100) : 0}%)</small></strong></div><div className="ym06-yield-track"><i style={{ width: `${nextWeekKg ? item.kg / nextWeekKg * 100 : 0}%`, background: ['#315a42', '#e7a06c', '#719c86', '#6697da'][index % 4] }}/></div></div>)}</div> : <NoRecords title="No harvests in the next 7 days" description="Your upcoming crop quantities will appear here."/>}</section>
        <section className="ym06-harvest-notice"><div className="ym06-notice-icon"><CalendarDays size={17}/></div><div><h3>Keep harvest details current</h3><p>Update batch readiness and dates in your harvest calendar so your team can plan collection accurately.</p><Link to="../harvest-calendar">Open harvest calendar <ArrowRight size={13}/></Link></div></section>
      </aside>
    </section>
    <div className="ym06-harvest-footer-note"><CalendarDays size={15}/> Harvest records shown here are loaded from your farmer account. <Link to="../harvest-calendar">Manage harvest calendar <ArrowRight size={14}/></Link></div>
  </PageFrame>;
}
