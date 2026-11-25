import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, History, MapPin, Package, Search } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import api from '../../services/api';
import './ym23.css';

type PickupStopStatus = 'pending' | 'completed' | 'exception';

interface PickupStop {
  id: string;
  sequence: number;
  farmName: string;
  farmerName: string;
  district: string;
  crop: string;
  committedKg: number;
  pickupTime?: string | null;
  status: PickupStopStatus;
  requestId?: string;
}

interface PickupStopsResponse {
  stops: PickupStop[];
  requestId: string;
}

type StatusFilter = 'all' | PickupStopStatus;

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'exception', label: 'Exception' },
];

function formatPickupTime(value: PickupStop['pickupTime']) {
  if (!value || value.trim().toLowerCase() === 'not scheduled') return 'Not scheduled';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function PickupStopCard({ stop }: { stop: PickupStop }) {
  const pickupTime = formatPickupTime(stop.pickupTime);

  return (
    <article className="ym23-stop-card">
      <div className="ym23-stop-main">
        <div className="ym23-stop-sequence" aria-label={`Stop ${stop.sequence}`}>
          {String(stop.sequence).padStart(2, '0')}
        </div>
        <div className="ym23-stop-heading">
          <div className="ym23-stop-title">
            <div>
              <p className="ym23-eyebrow">Stop #{String(stop.sequence).padStart(2, '0')}</p>
              <h3>{stop.farmName}</h3>
            </div>
            <span className={`ym23-status ym23-status--${stop.status}`}>
              <StatusBadge status={stop.status.charAt(0).toUpperCase() + stop.status.slice(1)} />
            </span>
          </div>
          <p className="ym23-farmer">{stop.farmerName}</p>
          <p className="ym23-location"><MapPin size={14} aria-hidden="true" />{stop.district}</p>
        </div>
      </div>

      <div className="ym23-stop-details">
        <div>
          <span className="ym23-detail-label">Produce</span>
          <strong>{stop.crop}</strong>
        </div>
        <div>
          <span className="ym23-detail-label">Committed quantity</span>
          <strong>{stop.committedKg} kg</strong>
        </div>
        <div>
          <span className="ym23-detail-label">Pickup time</span>
          <strong>{pickupTime}</strong>
        </div>
        <Link className="ym-button ym-button--outline ym23-details-link" to={`/driver/pickups/${stop.id}`}>
          View details <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export default function PickupStopsPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stops, setStops] = useState<PickupStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api.get<PickupStopsResponse>('/ym23/pickup-stops', { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.stops)) throw new Error('Invalid pickup stops response');
        setStops(data.stops);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Unable to load pickup stops. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const completedCount = stops.filter((stop) => stop.status === 'completed').length;
  const pendingCount = stops.filter((stop) => stop.status === 'pending').length;
  const totalQuantity = stops.reduce((total, stop) => total + stop.committedKg, 0);
  const nextStop = stops.find((stop) => stop.status === 'pending');
  const normalizedQuery = query.trim().toLowerCase();

  const visibleStops = useMemo(() => stops.filter((stop) => {
    const matchesStatus = statusFilter === 'all' || stop.status === statusFilter;
    const searchableText = [
      stop.sequence,
      stop.farmName,
      stop.farmerName,
      stop.district,
      stop.crop,
      formatPickupTime(stop.pickupTime),
      stop.status,
    ].join(' ').toLowerCase();
    return matchesStatus && searchableText.includes(normalizedQuery);
  }), [normalizedQuery, statusFilter, stops]);

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  return (
    <div className="ym23-pickups">
      <div className="ym23-page-header">
        <div>
          <p className="ym23-page-subtitle">View your assigned pickup locations and plan your route.</p>
          <span className="ym23-demo-label">ASSIGNED TRIP DATA</span>
        </div>
        <Link className="ym-button ym-button--outline ym23-history-link" to="/driver/pickups/history">
          <History size={16} aria-hidden="true" />
          Pickup History
        </Link>
      </div>

      {loading ? (
        <ContentCard className="ym23-empty-card">
          <Alert type="info">Loading pickup stops...</Alert>
        </ContentCard>
      ) : error ? (
        <ContentCard className="ym23-empty-card">
          <Alert type="error">{error}</Alert>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
        </ContentCard>
      ) : (
        <>
          <Alert type="info">Pickup stops are loaded from trips assigned to your driver account.</Alert>

      <section className="ym23-metrics" aria-label="Pickup summary">
        <div className="ym23-metric">
          <MapPin size={18} aria-hidden="true" />
          <StatCard label="Total pickup stops" value={stops.length} subtext="Across your assigned farms" />
        </div>
        <div className="ym23-metric">
          <Package size={18} aria-hidden="true" />
          <StatCard label="Total quantity" value={`${totalQuantity} kg`} subtext="Committed for today" />
        </div>
        <div className="ym23-metric">
          <CheckCircle2 size={18} aria-hidden="true" />
          <StatCard label="Completed" value={completedCount} subtext="Pickup recorded" />
        </div>
        <div className="ym23-metric">
          <Clock3 size={18} aria-hidden="true" />
          <StatCard label="Pending" value={pendingCount} subtext="Pickup stops remaining" />
        </div>
      </section>

      <div className="ym23-stops-layout">
        <section className="ym23-stops-column" aria-labelledby="ym23-stops-heading">
          <div className="ym23-section-heading">
            <div>
              <h2 id="ym23-stops-heading">Today's stops</h2>
              <p>{visibleStops.length} of {stops.length} assigned farms</p>
            </div>
          </div>

          <div className="ym23-filters">
            <InputField
              className="ym23-search-field"
              label="Search pickup stops"
              type="search"
              placeholder="Search by farm, farmer, district, or crop..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search pickup stops by farm, farmer, district, crop, time, or status"
            />
            <SelectField
              className="ym23-status-field"
              label="Filter by status"
              options={statusOptions}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            />
          </div>

          {visibleStops.length > 0 ? (
            <div className="ym23-stop-list">
              {visibleStops.map((stop) => <PickupStopCard key={stop.id} stop={stop} />)}
            </div>
          ) : (
            <ContentCard className="ym23-empty-card">
              <EmptyState
                title={stops.length ? 'No pickup stops found' : 'No pickup stops available'}
                description={stops.length
                  ? 'Try a different search or status filter to find an assigned stop.'
                  : 'There are no pickup stops assigned to your driver account.'}
                action={stops.length ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
              />
            </ContentCard>
          )}
          <p className="ym23-footer-note">Every pickup connected. Every handover accounted for.</p>
        </section>

        <aside className="ym23-route-summary" aria-label="Pickup route summary">
          {nextStop ? (
            <section className="ym23-next-stop">
              <p className="ym23-next-label">Next pickup</p>
              <h2>{nextStop.farmName}</h2>
              <p className="ym23-next-location">{nextStop.district}</p>
              <div className="ym23-next-details">
                <div><span>Scheduled time</span><strong>{formatPickupTime(nextStop.pickupTime)}</strong></div>
                <div><span>Committed load</span><strong>{nextStop.committedKg} kg</strong></div>
              </div>
              <p className="ym23-next-note">Based on the assigned stop sequence.</p>
            </section>
          ) : stops.length === 0 ? (
            <ContentCard title="No pickup stops" subtitle="No stops are currently assigned to your driver account." />
          ) : stops.every((stop) => stop.status === 'completed') ? (
            <ContentCard title="Route complete" subtitle="All assigned pickup stops are marked completed." />
          ) : (
            <ContentCard title="No pending pickups" subtitle="Review stops marked as exceptions in the pickup list." />
          )}

          <ContentCard className="ym23-sequence-card" title="Pickup sequence" subtitle={`${completedCount} of ${stops.length} completed`}>
            <div className="ym23-progress-track" role="progressbar" aria-label="Pickup stops completed" aria-valuemin={0} aria-valuemax={stops.length} aria-valuenow={completedCount}>
              <span style={{ width: `${stops.length ? (completedCount / stops.length) * 100 : 0}%` }} />
            </div>
            <ol className="ym23-sequence-list">
              {stops.map((stop) => (
                <li key={stop.id} className={`ym23-sequence-item ym23-sequence-item--${stop.status}`}>
                  <span className="ym23-sequence-marker">{stop.status === 'completed' ? <CheckCircle2 size={16} aria-hidden="true" /> : String(stop.sequence).padStart(2, '0')}</span>
                  <div><strong>{stop.farmName}</strong><span>{formatPickupTime(stop.pickupTime)} · {stop.status}</span></div>
                  <span className="ym23-sequence-quantity">{stop.committedKg} kg</span>
                </li>
              ))}
            </ol>
            <div className="ym23-sequence-total"><span>Total committed quantity</span><strong>{totalQuantity} kg</strong></div>
          </ContentCard>
        </aside>
      </div>
        </>
      )}
    </div>
  );
}
