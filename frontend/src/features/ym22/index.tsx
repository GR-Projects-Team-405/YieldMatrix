import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import AssignedTrips from './pages/AssignedTrips';
import TripDetails from './pages/TripDetails';
import PickupSequence from './pages/PickupSequence';
import RouteOverview from './pages/RouteOverview';
import type { Trip } from './components/tripTypes';
import './ym22.css';

type TripsResponse = { trips: Trip[] };
export default function YM22() {
  const [params, setParams] = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const view = params.get('view') || 'assigned';
  const selectedId = params.get('trip');
  const nextTrip = useMemo(() => { const candidates=trips.filter((trip) => ['assigned', 'in_progress'].includes(trip.status)).sort((a,b)=>Date.parse(a.scheduledStart)-Date.parse(b.scheduledStart)); return candidates.find((trip)=>trip.status==='assigned')||candidates[0]; }, [trips]);
  const selectedTrip = trips.find((trip) => trip.id === selectedId) || nextTrip;

  const loadTrips = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get<TripsResponse & {demo?:boolean}>('/ym22/trips'); setTrips(data.trips); setDemo(Boolean(data.demo)); }
    catch (cause: unknown) {
      const response = cause && typeof cause === 'object' && 'response' in cause ? (cause as {response?:{data?:{error?:string}}}).response : undefined;
      setError(response?.data?.error || 'Could not load assigned trips. Check the API connection and try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadTrips(); }, [loadTrips]);
  useEffect(() => {
    if (view !== 'details' || !selectedId) return;
    let current = true;
    api.get<{trip:Trip;demo?:boolean}>(`/ym22/trips/${encodeURIComponent(selectedId)}`).then(({data}) => {
      if (!current) return;
      setTrips((existing) => existing.some((trip) => trip.id === data.trip.id) ? existing.map((trip) => trip.id === data.trip.id ? data.trip : trip) : [data.trip,...existing]);
      if (data.demo !== undefined) setDemo(data.demo);
    }).catch(() => { /* The assigned trips page already reports list loading errors. */ });
    return () => { current = false; };
  }, [view, selectedId]);

  const openTrip = (trip: Trip, nextView = 'details') => setParams({ trip: trip.id, view: nextView });
  const goAssigned = () => setParams({});
  const content = view === 'details' && selectedTrip
    ? <TripDetails trip={selectedTrip} demo={demo} onSequence={() => openTrip(selectedTrip, 'sequence')} onRoute={() => openTrip(selectedTrip, 'route')} />
    : view === 'sequence' && selectedTrip
      ? <PickupSequence trip={selectedTrip} />
      : view === 'route' && selectedTrip
        ? <RouteOverview trip={selectedTrip} />
        : <AssignedTrips trips={trips} demo={demo} loading={loading} error={error} search={search} filter={filter} dateFrom={dateFrom} dateTo={dateTo} page={page} onSearch={(value)=>{setSearch(value);setPage(1)}} onFilter={(value)=>{setFilter(value);setPage(1)}} onDateFrom={(value)=>{setDateFrom(value);setPage(1)}} onDateTo={(value)=>{setDateTo(value);setPage(1)}} onPage={setPage} onRetry={()=>void loadTrips()} onOpenTrip={openTrip} />;

  return <div className="ym22-module">
    {view !== 'assigned' && selectedTrip && <nav className="ym22-tabs" aria-label="Trip pages">
      <button onClick={goAssigned}>Assigned trips</button>
      <button className={view==='details'?'active':''} onClick={()=>openTrip(selectedTrip,'details')}>Trip details</button>
      <button className={view==='sequence'?'active':''} onClick={()=>openTrip(selectedTrip,'sequence')}>Pickup sequence</button>
      <button className={view==='route'?'active':''} onClick={()=>openTrip(selectedTrip,'route')}>Route overview</button>
    </nav>}
    {content}
  </div>;
}
