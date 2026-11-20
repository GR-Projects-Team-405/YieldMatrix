import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import './DeliveryHistory.css'; // shared page styles (panels, stats, filters)
import './DeliveryDetails.css'; // shared bars
import './IncidentsList.css';

type IncidentStatus = 'Open' | 'Under review' | 'Resolved';
type IncidentType = 'Spoilage' | 'Short quantity' | 'Refused load' | 'Delay' | 'Packaging';

interface Incident {
  id: string;
  trip: string;
  destination: string;
  description: string;
  type: IncidentType;
  reportedAt: string; // UTC ISO timestamp
  status: IncidentStatus;
}

// Demo data for now. Replaced with API data after the backend endpoint is ready.
const incidents: Incident[] = [
  { id: 'INC-0031', trip: '1041', destination: 'Kandy', description: '20 kg of tomatoes spoiled in transit', type: 'Spoilage', reportedAt: '2026-10-31T10:35:00Z', status: 'Open' },
  { id: 'INC-0029', trip: '1039', destination: 'Galle', description: 'Recipient refused the full load at handover', type: 'Refused load', reportedAt: '2026-10-28T08:50:00Z', status: 'Under review' },
  { id: 'INC-0026', trip: '1034', destination: 'Colombo', description: 'Farm pickup: 50 kg short of allocation', type: 'Short quantity', reportedAt: '2026-10-22T03:20:00Z', status: 'Resolved' },
  { id: 'INC-0021', trip: '1028', destination: 'Negombo', description: 'Vehicle delay of 2 hours on route', type: 'Delay', reportedAt: '2026-10-15T06:40:00Z', status: 'Resolved' },
  { id: 'INC-0017', trip: '1022', destination: 'Matale', description: '30 kg of beans spoiled before pickup', type: 'Spoilage', reportedAt: '2026-10-08T05:00:00Z', status: 'Resolved' },
  { id: 'INC-0012', trip: '1015', destination: 'Kurunegala', description: 'Damaged crates at handover', type: 'Packaging', reportedAt: '2026-10-01T09:45:00Z', status: 'Resolved' },
];

const TYPES: IncidentType[] = ['Spoilage', 'Short quantity', 'Refused load', 'Delay', 'Packaging'];
const AVG_RESOLUTION = '1.5 days'; // demo value until resolved timestamps come from the API
const statusOptions = ['All', 'Open', 'Under review', 'Resolved'];

const statusClass: Record<IncidentStatus, string> = {
  Open: 'ym-tone--error',
  'Under review': 'ym-tone--warning',
  Resolved: 'ym-tone--success',
};

// Timestamps are stored in UTC and shown in Asia/Colombo.
const TZ = 'Asia/Colombo';
const DAY_MS = 24 * 60 * 60 * 1000;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
// Compare by Colombo calendar day so the window is in whole days.
const dayTime = (iso: string) =>
  new Date(`${new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })}T12:00:00+05:30`).getTime();

const count = (list: Incident[], status: IncidentStatus) => list.filter((i) => i.status === status).length;
const pad = (n: number) => String(n).padStart(2, '0');

// Demo: windows count back from the newest incident. The API will use the real current date.
const newestDay = Math.max(...incidents.map((i) => dayTime(i.reportedAt)));
const needsAttention = incidents.filter((i) => i.status !== 'Resolved');
const recent = incidents.filter((i) => dayTime(i.reportedAt) >= newestDay - 30 * DAY_MS);
const byType = TYPES.map((type) => ({ type, count: recent.filter((i) => i.type === type).length })).filter((t) => t.count > 0);
const maxTypeCount = Math.max(...byType.map((t) => t.count), 1);

export default function IncidentsList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [range, setRange] = useState('30');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = newestDay - Number(range) * DAY_MS;
    return incidents.filter(
      (i) =>
        dayTime(i.reportedAt) >= cutoff &&
        (status === 'All' || i.status === status) &&
        (q === '' || `${i.id} ym ${i.trip} ${i.destination} ${i.description}`.toLowerCase().includes(q)),
    );
  }, [search, status, range]);

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <p>Track problems reported on your pickups and deliveries.</p>
          <span className="ym24-demo-tag">DEMO DASHBOARD</span>
          <span className="ym24-date-note">05 NOV 2026</span>
        </div>
        <Link className="ym24-btn" to="/driver/incidents/new">Report incident</Link>
      </div>

      <div className="ym24-stats">
        <StatCard label="Open" value={pad(count(incidents, 'Open'))} subtext="Waiting for admin review" />
        <StatCard label="Under review" value={pad(count(incidents, 'Under review'))} subtext="Being checked by admin" />
        <StatCard label="Resolved" value={pad(count(incidents, 'Resolved'))} subtext="Last 30 days" />
        <StatCard label="Avg. resolution" value={AVG_RESOLUTION} subtext="From report to resolved" />
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
                <p><strong>{i.id}</strong> · {i.description}</p>
                <span className={`ym-status ${statusClass[i.status]}`}>{i.status}</span>
              </div>
            ))
          )}
        </div>

        <div className="ym24-panel">
          <h3>Incidents by type</h3>
          <p className="ym24-panel-sub">Last 30 days · {recent.length} reports</p>
          {byType.map((t) => (
            <div className="ym24-farm" key={t.type}>
              <span>{t.type}</span>
              <div className="ym24-track">
                <div className="ym24-fill" style={{ width: `${(t.count / maxTypeCount) * 100}%` }} />
              </div>
              <span className="ym24-farm-kg">{t.count}</span>
            </div>
          ))}
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
          {statusOptions.map((s) => <option key={s} value={s}>Status: {s}</option>)}
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
            {count(filtered, 'Open')} open · {count(filtered, 'Under review')} under review · {count(filtered, 'Resolved')} resolved
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="ym24-empty">No incidents match your filters.</div>
        ) : (
          <Table headers={['Incident', 'Trip / allocation', 'Description', 'Reported', 'Status']}>
            {filtered.map((i) => (
              <TableRow key={i.id}>
                <td><strong>{i.id}</strong></td>
                <td>YM {i.trip} • {i.destination}</td>
                <td>{i.description}</td>
                <td>{fmtDate(i.reportedAt)}, {fmtTime(i.reportedAt)}</td>
                <td><span className={`ym-status ${statusClass[i.status]}`}>{i.status}</span></td>
              </TableRow>
            ))}
          </Table>
        )}
        <div className="ym24-pager">
          <span>Showing {filtered.length === 0 ? 0 : `1–${filtered.length}`} of {filtered.length}</span>
          <div>
            {/* All rows fit on one page for now; the API will provide real paging. */}
            <button type="button" className="ym24-btn ym24-btn--ghost" disabled>Previous</button>
            <button type="button" className="ym24-btn ym24-btn--ghost" disabled>Next</button>
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
    </div>
  );
}