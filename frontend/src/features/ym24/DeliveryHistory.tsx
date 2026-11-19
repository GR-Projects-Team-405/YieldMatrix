import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import BannerArt from './BannerArt';
import './DeliveryHistory.css';

// Demo data for now. Replaced with API data after the backend endpoint is ready.
type TripStatus = 'Completed' | 'Partially accepted' | 'Disputed';

interface Trip {
  id: string;
  destination: string;
  dateIso: string; 
  farms: number;
  deliveredKg: number;
  acceptedKg: number;
  status: TripStatus;
}

const trips: Trip[] = [
  { id: '1042', destination: 'Colombo', dateIso: '2026-11-02', farms: 3, deliveredKg: 1000, acceptedKg: 1000, status: 'Completed' },
  { id: '1041', destination: 'Colombo', dateIso: '2026-10-31', farms: 2, deliveredKg: 600, acceptedKg: 580, status: 'Partially accepted' },
  { id: '1040', destination: 'Colombo', dateIso: '2026-10-30', farms: 1, deliveredKg: 750, acceptedKg: 750, status: 'Completed' },
  { id: '1039', destination: 'Colombo', dateIso: '2026-10-28', farms: 3, deliveredKg: 350, acceptedKg: 0, status: 'Disputed' },
  { id: '1031', destination: 'Colombo', dateIso: '2026-09-24', farms: 2, deliveredKg: 820, acceptedKg: 820, status: 'Completed' },
  { id: '1028', destination: 'Colombo', dateIso: '2026-09-18', farms: 1, deliveredKg: 540, acceptedKg: 540, status: 'Completed' },
];

const weekly = [
  { week: 'W41', delivered: 2300, accepted: 2260 },
  { week: 'W42', delivered: 2950, accepted: 2880 },
  { week: 'W43', delivered: 1950, accepted: 1840 },
  { week: 'W44', delivered: 3090, accepted: 3010 },
  { week: 'W45', delivered: 2160, accepted: 2090 },
];

const Y_MAX = 3000;
const yTicks = [3000, 2000, 1000, 0];
const statusOptions = ['All', 'Completed', 'Partially accepted', 'Disputed'];

const badgeClass: Record<TripStatus, string> = {
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};

const kg = (n: number) => `${n.toLocaleString('en-US')} kg`;

const DAY_MS = 24 * 60 * 60 * 1000;
const toTime = (iso: string) => new Date(`${iso}T12:00:00+05:30`).getTime();
const formatDate = (iso: string) =>
  new Date(toTime(iso)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  });
// Demo: the window counts back from the newest trip. The API will use the real current date.
const newestTime = Math.max(...trips.map((t) => toTime(t.dateIso)));

export default function DeliveryHistory() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [range, setRange] = useState('30');

    const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = newestTime - Number(range) * DAY_MS;
    return trips.filter(
      (t) =>
        toTime(t.dateIso) >= cutoff &&
        (status === 'All' || t.status === status) &&
        (q === '' || `ym ${t.id} ${t.destination}`.toLowerCase().includes(q)),
    );
  }, [search, status, range]);

  // Demo totals match the design (16 trips in 30 days) until the API provides real counts.
  const isDefaultView = range === '30' && status === 'All' && search.trim() === '';
  const total = isDefaultView ? 16 : filtered.length;

  return (
    <div className="ym24-page">
        <div className="ym24-head">
        <div>
          <p>Review completed deliveries and handover records.</p>
          <span className="ym24-demo-tag">DEMO DASHBOARD</span>
        </div>
        <button type="button" className="ym24-btn">Export ↗</button>
      </div>

      <div className="ym24-stats">
        <StatCard label="Completed trips" value="18" subtext="Last 30 days · accepted" />
        <StatCard label="Total delivered" value="12,450 kg" subtext="Across 18 deliveries" />
        <StatCard label="Acceptance rate" value="97%" subtext="12,080 of 12,450 kg accepted" />
        <StatCard label="Open incidents" value="01" subtext="1 more under review" />
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
          <p className="ym24-panel-sub">YM 1042 • Colombo • 02 Nov 2026</p>
          <div className="ym24-kv"><span>Destination</span><span>Metro Foods, Colombo</span></div>
          <div className="ym24-kv"><span>Handed over</span><span>1,000 kg</span></div>
          <div className="ym24-kv"><span>Accepted</span><span>1,000 kg</span></div>
          <div className="ym24-kv"><span>Time</span><span>14:10 · Asia/Colombo</span></div>
        </div>
      </div>

      <div className="ym24-row">
        <div className="ym24-panel">
          <h3>Weekly kg delivered</h3>
          <p className="ym24-panel-sub">Delivered vs accepted · last 5 weeks · illustrative sample</p>
          <div className="ym24-legend">
            <span><i className="ym24-dot ym24-dot--delivered" />Delivered</span>
            <span><i className="ym24-dot ym24-dot--accepted" />Accepted</span>
          </div>
          <div className="ym24-chart" role="img" aria-label="Weekly delivered and accepted weight in kilograms for weeks 41 to 45">
            <div className="ym24-yaxis">
              {yTicks.map((t) => <span key={t}>{t}</span>)}
            </div>
            <div className="ym24-plot">
              {weekly.map((w) => (
                <div className="ym24-week" key={w.week}>
                  <div className="ym24-bars">
                    <div className="ym24-bar ym24-bar--delivered" style={{ height: `${(w.delivered / Y_MAX) * 100}%` }} title={kg(w.delivered)} />
                    <div className="ym24-bar ym24-bar--accepted" style={{ height: `${(w.accepted / Y_MAX) * 100}%` }} title={kg(w.accepted)} />
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
            <div className="ym24-donut" role="img" aria-label="97 percent of delivered weight accepted" style={{ background: 'conic-gradient(var(--ym24-primary) 0 97%, var(--orange) 97% 100%)' }}>
              <div className="ym24-donut-inner">97%</div>
            </div>
            <div className="ym24-donut-text">
              <strong>12,080 kg accepted</strong>
              <span className="ym24-warn">370 kg not accepted</span>
              <span>2 disputes raised</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ym24-filters">
        <input className="ym24-input" aria-label="Search by trip or reference" placeholder="Search by trip or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ym24-input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {statusOptions.map((s) => <option key={s} value={s}>Status: {s}</option>)}
        </select>
        {/* Date range is not wired yet; it will filter through the API later. */}
        <select className="ym24-input" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div className="ym24-panel">
        <h3>Buyer acceptance</h3>
        <p className="ym24-panel-sub">{isDefaultView ? '18 in the last 30 days' : `Last ${range} days`}</p>
        {filtered.length === 0 ? (
          <div className="ym24-empty">No deliveries match your filters.</div>
        ) : (
          <Table headers={['Trip / Reference', 'Date', 'Pickup farms', 'Delivered (kg)', 'Accepted (kg)', 'Status']}>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <td><Link className="ym24-link" to={`/driver/history/${t.id}`}>YM {t.id} • {t.destination}</Link></td>
                <td>{formatDate(t.dateIso)}</td>
                <td>{t.farms} {t.farms === 1 ? 'farm' : 'farms'}</td>
                <td>{kg(t.deliveredKg)}</td>
                <td>{kg(t.acceptedKg)}</td>
                <td><span className={`ym-status ${badgeClass[t.status]}`}>{t.status}</span></td>
              </TableRow>
            ))}
          </Table>
        )}
        <div className="ym24-pager">
          <span>Showing {filtered.length === 0 ? 0 : `1–${filtered.length}`} of {total}</span>
          <div>
            <button type="button" className="ym24-btn ym24-btn--ghost" disabled>Previous</button>
            <button type="button" className="ym24-btn ym24-btn--ghost">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}