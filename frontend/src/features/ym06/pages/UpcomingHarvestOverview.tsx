import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ListFilter, MapPin, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../../components/SelectField';
import { StatusBadge } from '../../../components/StatusBadge';
import { StatCard } from '../../../components/StatCard';
import { getHarvests, type Harvest, formatDate, formatKg } from '../ym06Api';
import { ErrorState, LoadingState, NoRecords } from '../components/DataState';
import PageFrame from '../components/PageFrame';

function CalendarView({ harvests, month, setMonth }: { harvests: Harvest[]; month: Date; setMonth: (value: Date) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const byDay = new Map<number, Harvest[]>();
  harvests.filter((item) => item.planned_harvest_date.startsWith(monthKey)).forEach((item) => {
    const day = Number(item.planned_harvest_date.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) || []), item]);
  });
  const label = new Intl.DateTimeFormat('en-LK', { month: 'long', year: 'numeric' }).format(month);
  return <div className="ym06-calendar"><div className="ym06-calendar-header"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><h3>{label}</h3><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div><div className="ym06-calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span className="ym06-calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: firstDay }, (_, index) => <span className="ym06-calendar-blank" key={`blank-${index}`}/>)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const items = byDay.get(day) || []; return <div className={`ym06-calendar-day ${items.length ? 'has-harvest' : ''}`} key={day}><span>{day}</span>{items.slice(0, 2).map((item) => <span className={`ym06-calendar-event ${item.status}`} key={item.id} title={`${item.crop} · ${item.grade} · ${formatKg(item.planned_kg)}`}><Sprout size={11}/>{item.crop}</span>)}{items.length > 2 && <small>+{items.length - 2} more</small>}</div>; })}</div>{!harvests.some((item) => item.planned_harvest_date.startsWith(monthKey)) && <NoRecords title="No harvests this month" description="Try another month or use list view to see all upcoming harvests."/>}</div>;
}

export default function UpcomingHarvestOverview() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [crop, setCrop] = useState('');
  const [farm, setFarm] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const load = () => { setLoading(true); setError(''); getHarvests().then(setHarvests).catch(() => setError('Upcoming harvests could not be loaded. Try again.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const crops = useMemo(() => [...new Set(harvests.map((item) => item.crop))].sort(), [harvests]);
  const farms = useMemo(() => [...new Set(harvests.map((item) => item.farm))].sort(), [harvests]);
  const filtered = useMemo(() => harvests.filter((item) => (!crop || item.crop === crop) && (!farm || item.farm === farm)), [harvests, crop, farm]);
  const expectedKg = filtered.reduce((total, item) => total + Number(item.planned_kg), 0);
  const ready = filtered.filter((item) => item.status === 'ready').length;
  if (loading) return <PageFrame title="Upcoming harvests" description="Plan and monitor your expected harvest batches."><LoadingState/></PageFrame>;
  if (error) return <PageFrame title="Upcoming harvests" description="Plan and monitor your expected harvest batches."><ErrorState message={error} onRetry={load}/></PageFrame>;

  return <PageFrame title="Upcoming harvests" description="Plan, monitor and prepare for your next harvest batches.">
    <section className="ym06-stat-grid ym06-harvest-stats"><StatCard label="Upcoming batches" value={String(filtered.length)} subtext="Planned and ready"/><StatCard label="Expected quantity" value={formatKg(expectedKg)} subtext="Across your selected filters"/><StatCard label="Harvesting this week" value={String(filtered.filter((item) => { const date = new Date(`${item.planned_harvest_date}T12:00:00`); return date >= new Date() && date.getTime() < Date.now() + 7 * 86400000; }).length)} subtext="Next seven days"/><StatCard label="Ready for collection" value={String(ready)} subtext="Batches marked ready" highlight/></section>
    <section className="ym06-panel ym06-harvest-panel"><div className="ym06-harvest-toolbar"><div className="ym06-view-toggle" role="group" aria-label="Harvest view"><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><ListFilter size={15}/> List view</button><button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15}/> Calendar view</button></div><SelectField label="Crop" value={crop} onChange={(event) => setCrop(event.target.value)} options={[{ value: '', label: 'All crops' }, ...crops.map((item) => ({ value: item, label: item }))]}/><SelectField label="Farm" value={farm} onChange={(event) => setFarm(event.target.value)} options={[{ value: '', label: 'All farms' }, ...farms.map((item) => ({ value: item, label: item }))]}/><Link className="ym06-add-link" to="../harvest-calendar"><Sprout size={15}/> Manage harvests <ArrowRight size={14}/></Link></div>
      {view === 'calendar' ? <CalendarView harvests={filtered} month={month} setMonth={setMonth}/> : filtered.length ? <div className="ym06-harvest-list">{filtered.map((item) => <article className="ym06-harvest-row" key={item.id}><span className={`ym06-harvest-crop-icon ym06-crop-color-${item.crop.length % 4}`}><Sprout size={21}/></span><div className="ym06-harvest-info"><div className="ym06-harvest-title"><h3>{item.crop} · {item.grade}</h3><StatusBadge status={item.status}/></div><p><MapPin size={13}/>{item.farm} · {item.district}</p><div className="ym06-harvest-progress"><span style={{ width: item.status === 'ready' ? '100%' : '35%' }}/></div><small>{item.status === 'ready' ? 'Ready for collection' : 'Planned'} · {formatKg(item.planned_kg)} expected</small></div><div className="ym06-harvest-date"><small>EXPECTED HARVEST</small><strong>{formatDate(item.planned_harvest_date, { day: '2-digit', month: 'short', year: 'numeric' })}</strong><span>{formatKg(item.planned_kg)}</span></div></article>)}</div> : <NoRecords title="No upcoming harvests" description="Planned or ready harvest batches will appear when they are added to your harvest calendar."/>}
    </section>
    <div className="ym06-harvest-footer-note"><CalendarDays size={15}/> Harvest records come from your farm calendar. <Link to="../harvest-calendar">Open harvest calendar <ArrowRight size={14}/></Link></div>
  </PageFrame>;
}
