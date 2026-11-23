import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import { Alert } from '../../components/Alert';
import BannerArt from './BannerArt';
import { getDeliveries, getIncidents, errorMessage } from './ym24Api';
import type { DeliveryRow, DeliveryStatus, IncidentRow } from './ym24Api';
import './DeliveryHistory.css';

const TZ = 'Asia/Colombo';
const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const WEEKS = 5;
const statusOptions = ['All', 'Completed', 'Partially accepted', 'Disputed'];

const badgeClass: Record<DeliveryStatus, string> = {
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const kg = (n: number) => `${round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const timeOf = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

// Monday of the week (Asia/Colombo) that contains the time, as a shifted UTC number.
function weekStart(ms: number) {
  const d = new Date(ms + COLOMBO_OFFSET_MS);
  const dayFromMonday = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayFromMonday);
}

function isoWeekNumber(mondayMs: number) {
  const monday = new Date(mondayMs);
  const thursday = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 3);
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / DAY_MS + 1) / 7);
}

function buildWeekly(trips: DeliveryRow[], nowMs: number) {
  const current = weekStart(nowMs);
  const starts = Array.from({ length: WEEKS }, (_, i) => current - (WEEKS - 1 - i) * 7 * DAY_MS);
  const rows = starts.map((s) => ({ week: `W${isoWeekNumber(s)}`, delivered: 0, accepted: 0 }));
  for (const t of trips) {
    if (!t.deliveredAt) continue;
    const index = Math.round((weekStart(timeOf(t.deliveredAt)) - starts[0]) / (7 * DAY_MS));
    if (index >= 0 && index < WEEKS) {
      rows[index].delivered += t.handedOverKg;
      rows[index].accepted += t.acceptedKg;
    }
  }
  return rows;
}

export default function DeliveryHistory() {
  const [trips, setTrips] = useState<DeliveryRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [range, setRange] = useState('30');
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The incidents card is optional: if it fails, the rest of the page still works.
      const [tripRows, incidentRows] = await Promise.all([getDeliveries(), getIncidents().catch(() => null)]);
      setTrips(tripRows);
      setIncidents(incidentRows);
    } catch (e) {
      setError(errorMessage(e, 'Could not load deliveries.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, range]);

  // Cards, chart and donut always use the last 30 days.
  const last30 = useMemo(() => trips.filter((t) => timeOf(t.deliveredAt) >= now - 30 * DAY_MS), [trips, now]);
  const handedKg = round3(last30.reduce((sum, t) => sum + t.handedOverKg, 0));
  const acceptedKg = round3(last30.reduce((sum, t) => sum + t.acceptedKg, 0));
  const notAcceptedKg = round3(Math.max(0, handedKg - acceptedKg));
  const completedCount = last30.filter((t) => t.status === 'Completed').length;
  const disputeCount = last30.filter((t) => t.status === 'Disputed').length;
  const rate = handedKg > 0 ? Math.round((acceptedKg / handedKg) * 100) : 0;
  const openIncidents = incidents ? incidents.filter((i) => i.status === 'open').length : null;
  const reviewIncidents = incidents ? incidents.filter((i) => i.status === 'under_review').length : 0;

  const weekly = useMemo(() => buildWeekly(trips, now), [trips, now]);
  const maxWeekly = Math.max(0, ...weekly.map((w) => Math.max(w.delivered, w.accepted)));
  const step = Math.max(1, Math.ceil(maxWeekly / 3 / 100)) * 100;
  const yMax = step * 3;
  const yTicks = [yMax, step * 2, step, 0];

  const latest = trips.find((t) => t.deliveredAt) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = now - Number(range) * DAY_MS;
    return trips.filter(
      (t) =>
        timeOf(t.deliveredAt) >= cutoff &&
        (status === 'All' || t.status === status) &&
        (q === '' || `${t.code} ${t.destination} ${t.buyer} ${t.vehicle}`.toLowerCase().includes(q)),
    );
  }, [trips, search, status, range, now]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = (safePage - 1) * PAGE_SIZE + pageRows.length;

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <p>Review completed deliveries and handover records.</p>
        </div>
        <button type="button" className="ym24-btn">Export ↗</button>
      </div>

      {loading && <div className="ym24-panel ym24-empty">Loading deliveries…</div>}

      {!loading && error && (
        <>
          <Alert type="error">{error}</Alert>
          <div className="ym24-actions">
            <button type="button" className="ym24-btn" onClick={() => void load()}>Try again</button>
          </div>
        </>
      )}

      {!loading && !error && (
        <>
          <div className="ym24-stats">
            <StatCard label="Completed trips" value={String(completedCount)} subtext="Last 30 days · accepted" />
            <StatCard label="Total delivered" value={kg(handedKg)} subtext={`Across ${last30.length} ${last30.length === 1 ? 'delivery' : 'deliveries'}`} />
            <StatCard label="Acceptance rate" value={`${rate}%`} subtext={`${kg(acceptedKg)} of ${kg(handedKg)} accepted`} />
            <StatCard
              label="Open incidents"
              value={openIncidents === null ? '—' : String(openIncidents).padStart(2, '0')}
              subtext={openIncidents === null ? 'Could not load incidents' : `${reviewIncidents} more under review`}
            />
          </div>

          <div className="ym24-row">
            <div className="ym24-banner">
              <BannerArt />
              <small>DELIVERY RECORDS</small>
              <h3>Every handover,<br />on record.</h3>
              <p>Each delivery is traced from farm pickup to buyer acceptance.</p>
              <Link to="/driver/handover" className="ym24-btn ym24-btn--accent">View latest handover ↗</Link>
            </div>
            <div className="ym24-panel">
              <h3>Latest handover</h3>
              {latest && latest.deliveredAt ? (
                <>
                  <p className="ym24-panel-sub">{latest.code} • {fmtDate(latest.deliveredAt)}</p>
                  <div className="ym24-kv"><span>Destination</span><span>{latest.destination}</span></div>
                  <div className="ym24-kv"><span>Handed over</span><span>{kg(latest.handedOverKg)}</span></div>
                  <div className="ym24-kv"><span>Accepted</span><span>{kg(latest.acceptedKg)}</span></div>
                  <div className="ym24-kv"><span>Time</span><span>{fmtTime(latest.deliveredAt)} · {TZ}</span></div>
                </>
              ) : (
                <div className="ym24-empty">No handovers yet.</div>
              )}
            </div>
          </div>

          <div className="ym24-row">
            <div className="ym24-panel">
              <h3>Weekly kg delivered</h3>
              <p className="ym24-panel-sub">Delivered vs accepted · last {WEEKS} weeks</p>
              <div className="ym24-legend">
                <span><i className="ym24-dot ym24-dot--delivered" />Delivered</span>
                <span><i className="ym24-dot ym24-dot--accepted" />Accepted</span>
              </div>
              <div className="ym24-chart" role="img" aria-label={`Weekly delivered and accepted weight in kilograms for the last ${WEEKS} weeks`}>
                <div className="ym24-yaxis">
                  {yTicks.map((t) => <span key={t}>{t}</span>)}
                </div>
                <div className="ym24-plot">
                  {weekly.map((w) => (
                    <div className="ym24-week" key={w.week}>
                      <div className="ym24-bars">
                        <div className="ym24-bar ym24-bar--delivered" style={{ height: `${(w.delivered / yMax) * 100}%` }} title={kg(w.delivered)} />
                        <div className="ym24-bar ym24-bar--accepted" style={{ height: `${(w.accepted / yMax) * 100}%` }} title={kg(w.accepted)} />
                      </div>
                      <span className="ym24-week-label">{w.week}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ym24-panel">
              <h3>Buyer acceptance</h3>
              <p className="ym24-panel-sub">Last 30 days · by weight</p>
              <div className="ym24-donut-wrap">
                <div
                  className="ym24-donut"
                  role="img"
                  aria-label={`${rate} percent of delivered weight accepted`}
                  style={{
                    background: handedKg > 0
                      ? `conic-gradient(var(--ym24-primary) 0 ${rate}%, var(--orange) ${rate}% 100%)`
                      : 'var(--soft)',
                  }}
                >
                  <div className="ym24-donut-inner">{rate}%</div>
                </div>
                <div className="ym24-donut-text">
                  <strong>{kg(acceptedKg)} accepted</strong>
                  <span className="ym24-warn">{kg(notAcceptedKg)} not accepted</span>
                  <span>{disputeCount} {disputeCount === 1 ? 'dispute' : 'disputes'} raised</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ym24-filters">
            <input className="ym24-input" aria-label="Search by trip or reference" placeholder="Search by trip or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="ym24-input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((s) => <option key={s} value={s}>Status: {s}</option>)}
            </select>
            <select className="ym24-input" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          <div className="ym24-panel">
            <h3>Buyer acceptance</h3>
            <p className="ym24-panel-sub">{filtered.length} in the last {range} days</p>
            {filtered.length === 0 ? (
              <div className="ym24-empty">
                {trips.length === 0 ? 'No deliveries yet.' : 'No deliveries match your filters.'}
              </div>
            ) : (
              <Table headers={['Trip / Reference', 'Date', 'Pickup farms', 'Delivered (kg)', 'Accepted (kg)', 'Status']}>
                {pageRows.map((t) => (
                  <TableRow key={t.id}>
                    <td><Link className="ym24-link" to={`/driver/history/${t.id}`}>{t.code} • {t.destination}</Link></td>
                    <td>{t.deliveredAt ? fmtDate(t.deliveredAt) : '—'}</td>
                    <td>{t.farms} {t.farms === 1 ? 'farm' : 'farms'}</td>
                    <td>{kg(t.handedOverKg)}</td>
                    <td>{kg(t.acceptedKg)}</td>
                    <td><span className={`ym-status ${badgeClass[t.status]}`}>{t.status}</span></td>
                  </TableRow>
                ))}
              </Table>
            )}
            <div className="ym24-pager">
              <span>Showing {from === 0 ? 0 : `${from}–${to}`} of {filtered.length}</span>
              <div>
                <button type="button" className="ym24-btn ym24-btn--ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                <button type="button" className="ym24-btn ym24-btn--ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}