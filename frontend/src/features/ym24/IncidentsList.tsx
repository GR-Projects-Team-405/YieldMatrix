import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import { Alert } from '../../components/Alert';
import { getIncidents, errorMessage } from './ym24Api';
import type { IncidentRow, IncidentStatus, IncidentType } from './ym24Api';
import './DeliveryHistory.css'; // shared page styles (panels, stats, filters)
import './DeliveryDetails.css'; // shared bars
import './IncidentsList.css';

const TYPES: IncidentType[] = ['spoilage', 'short_quantity', 'refused_load', 'delay', 'packaging', 'other'];
const TYPE_LABEL: Record<IncidentType, string> = {
  spoilage: 'Spoilage',
  short_quantity: 'Short quantity',
  refused_load: 'Refused load',
  delay: 'Delay',
  packaging: 'Packaging',
  other: 'Other',
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
};
const statusClass: Record<IncidentStatus, string> = {
  open: 'ym-tone--error',
  under_review: 'ym-tone--warning',
  resolved: 'ym-tone--success',
};
const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
];

// Timestamps are stored in UTC and shown in Asia/Colombo.
const TZ = 'Asia/Colombo';
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
// Compare by Colombo calendar day so the window is in whole days.
const dayTime = (iso: string) =>
  new Date(new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) + 'T12:00:00+05:30').getTime();

const pad = (n: number) => String(n).padStart(2, '0');
const countStatus = (list: IncidentRow[], status: IncidentStatus) => list.filter((i) => i.status === status).length;

export default function IncidentsList() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('30');
  const [page, setPage] = useState(1);
  const [today] = useState(() => dayTime(new Date().toISOString()));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setIncidents(await getIncidents());
    } catch (e) {
      setError(errorMessage(e, 'Could not load incidents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, range]);

  const recent = useMemo(() => incidents.filter((i) => dayTime(i.createdAt) >= today - 30 * DAY_MS), [incidents, today]);
  const needsAttention = useMemo(() => incidents.filter((i) => i.status !== 'resolved').slice(0, 5), [incidents]);
  const byType = useMemo(
    () => TYPES.map((type) => ({ type, count: recent.filter((i) => i.type === type).length })).filter((t) => t.count > 0),
    [recent],
  );
  const maxTypeCount = Math.max(...byType.map((t) => t.count), 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = today - Number(range) * DAY_MS;
    return incidents.filter(
      (i) =>
        dayTime(i.createdAt) >= cutoff &&
        (status === 'all' || i.status === status) &&
        (q === '' || (i.code + ' ' + i.tripCode + ' ' + (i.farm ?? '') + ' ' + i.description).toLowerCase().includes(q)),
    );
  }, [incidents, search, status, range, today]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = (safePage - 1) * PAGE_SIZE + pageRows.length;

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <p>Track problems reported on your pickups and deliveries.</p>
        </div>
        <Link className="ym24-btn" to="/driver/incidents/new">Report incident</Link>
      </div>

      {loading && <div className="ym24-panel ym24-empty">Loading incidents…</div>}

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
            <StatCard label="Open" value={pad(countStatus(incidents, 'open'))} subtext="Waiting for admin review" />
            <StatCard label="Under review" value={pad(countStatus(incidents, 'under_review'))} subtext="Being checked by admin" />
            <StatCard label="Resolved" value={pad(countStatus(recent, 'resolved'))} subtext="Last 30 days" />
            <StatCard label="Total reports" value={pad(incidents.length)} subtext="All time" />
          </div>

          <div className="ym24-row">
            <div className="ym24-panel">
              <h3>Needs attention</h3>
              <p className="ym24-panel-sub">Open and under review</p>
              {needsAttention.length === 0 ? (
                <div className="ym24-empty">Nothing needs attention.</div>
              ) : (
                needsAttention.map((i) => (
                  <div className="ym24-attention" key={i.id}>
                    <p><strong>{i.code}</strong> · {i.description}</p>
                    <span className={'ym-status ' + statusClass[i.status]}>{STATUS_LABEL[i.status]}</span>
                  </div>
                ))
              )}
            </div>

            <div className="ym24-panel">
              <h3>Incidents by type</h3>
              <p className="ym24-panel-sub">Last 30 days · {recent.length} {recent.length === 1 ? 'report' : 'reports'}</p>
              {byType.length === 0 ? (
                <div className="ym24-empty">No reports in the last 30 days.</div>
              ) : (
                byType.map((t) => (
                  <div className="ym24-farm" key={t.type}>
                    <span>{TYPE_LABEL[t.type]}</span>
                    <div className="ym24-track">
                      <div className="ym24-fill" style={{ width: (t.count / maxTypeCount) * 100 + '%' }} />
                    </div>
                    <span className="ym24-farm-kg">{t.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ym24-filters">
            <input
              className="ym24-input"
              aria-label="Search by trip or reference"
              placeholder="Search by trip or reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="ym24-input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((s) => <option key={s.value} value={s.value}>Status: {s.label}</option>)}
            </select>
            <select className="ym24-input" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          <div className="ym24-panel">
            <div className="ym24-panel-head">
              <h3>Reported incidents</h3>
              <span>
                {countStatus(filtered, 'open')} open · {countStatus(filtered, 'under_review')} under review · {countStatus(filtered, 'resolved')} resolved
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="ym24-empty">
                {incidents.length === 0 ? 'No incidents reported yet.' : 'No incidents match your filters.'}
              </div>
            ) : (
              <Table headers={['Incident', 'Trip / farm', 'Description', 'Reported', 'Status']}>
                {pageRows.map((i) => (
                  <TableRow key={i.id}>
                    <td><strong>{i.code}</strong></td>
                    <td>
                      <Link className="ym24-link" to={'/driver/history/' + i.tripId}>{i.tripCode}</Link>
                      {i.farm ? ' • ' + i.farm : ''}
                    </td>
                    <td>{TYPE_LABEL[i.type]} · {i.description}</td>
                    <td>{fmtDate(i.createdAt)}, {fmtTime(i.createdAt)}</td>
                    <td><span className={'ym-status ' + statusClass[i.status]}>{STATUS_LABEL[i.status]}</span></td>
                  </TableRow>
                ))}
              </Table>
            )}
            <div className="ym24-pager">
              <span>Showing {from === 0 ? 0 : from + '–' + to} of {filtered.length}</span>
              <div>
                <button type="button" className="ym24-btn ym24-btn--ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                <button type="button" className="ym24-btn ym24-btn--ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
              </div>
            </div>
          </div>

          <div className="ym24-panel">
            <div className="ym24-how">
              <div className="ym24-how-item">
                <span className="ym24-num ym24-num--green" aria-hidden="true">1</span>
                <div>
                  <strong>You report</strong>
                  <span>Add the trip, kg affected and a photo as evidence.</span>
                </div>
              </div>
              <div className="ym24-how-item">
                <span className="ym24-num ym24-num--orange" aria-hidden="true">2</span>
                <div>
                  <strong>Admin reviews</strong>
                  <span>Status moves from Open to Under review.</span>
                </div>
              </div>
              <div className="ym24-how-item">
                <span className="ym24-num ym24-num--grey" aria-hidden="true">3</span>
                <div>
                  <strong>Resolved</strong>
                  <span>The outcome is saved to the trip and trace record.</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}