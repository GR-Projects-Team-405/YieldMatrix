import { Link } from 'react-router-dom';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import RouteMap from './RouteMap';
import './DeliveryHistory.css'; // shared page styles (panels, buttons, stats)
import './DeliveryDetails.css';

type TripStatus = 'Completed' | 'Partially accepted' | 'Disputed';

interface Stop {
  kind: 'pickup' | 'handover';
  name: string;
  at: string; // UTC ISO timestamp
  kg: number;
}

interface Allocation {
  farm: string;
  pickedUpKg: number;
  acceptedKg: number;
  priceCentsPerKg: number; // integer LKR cents
}

interface TripDetails {
  id: string;
  destination: string;
  deliveredAt: string; // UTC ISO timestamp
  vehicle: string;
  buyer: string;
  recipient: string;
  status: TripStatus;
  handedOverKg: number;
  distanceKm: number;
  durationMin: number;
  stops: Stop[];
  allocations: Allocation[];
  incident?: { id: string; text: string; status: string };
}

// Demo data for now. Replaced with API data after the backend endpoint is ready.
const trips: Record<string, TripDetails> = {
  '1041': {
    id: '1041',
    destination: 'Kandy',
    deliveredAt: '2026-10-31T10:10:00Z',
    vehicle: 'WP LO 4811',
    buyer: 'Sunrise Supermarket',
    recipient: 'N. Perera',
    status: 'Partially accepted',
    handedOverKg: 600,
    distanceKm: 86,
    durationMin: 190,
    stops: [
      { kind: 'pickup', name: 'Green Valley Farm', at: '2026-10-31T04:00:00Z', kg: 400 },
      { kind: 'pickup', name: 'Highland Harvest', at: '2026-10-31T05:30:00Z', kg: 200 },
      { kind: 'handover', name: 'Sunrise Supermarket', at: '2026-10-31T10:10:00Z', kg: 600 },
    ],
    allocations: [
      { farm: 'Green Valley Farm', pickedUpKg: 400, acceptedKg: 400, priceCentsPerKg: 29000 },
      { farm: 'Highland Harvest', pickedUpKg: 200, acceptedKg: 180, priceCentsPerKg: 29000 },
    ],
    incident: { id: 'INC-0031', text: '20 kg of tomatoes spoiled in transit', status: 'Open' },
  },
};

const statusClass: Record<TripStatus, string> = {
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};

// Timestamps are stored in UTC and shown in Asia/Colombo.
const TZ = 'Asia/Colombo';
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const kg = (n: number) => `${round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
const lkr = (cents: number) => `LKR ${(cents / 100).toLocaleString('en-US')}`;
const duration = (min: number) => `${Math.floor(min / 60)} h ${min % 60} min`;

export default function DeliveryDetails({ tripId }: { tripId: string }) {
  const trip = trips[tripId];

  if (!trip) {
    return (
      <div className="ym24-page">
        <Link className="ym24-back" to="/driver/history">← Back to delivery history</Link>
        <div className="ym24-panel ym24-empty">Trip YM {tripId} was not found.</div>
      </div>
    );
  }

  const pickedUpKg = round3(trip.allocations.reduce((sum, a) => sum + a.pickedUpKg, 0));
  const acceptedKg = round3(trip.allocations.reduce((sum, a) => sum + a.acceptedKg, 0));
  const notAcceptedKg = round3(trip.handedOverKg - acceptedKg);
  const orderValueCents = trip.allocations.reduce((sum, a) => sum + Math.round(a.pickedUpKg * a.priceCentsPerKg), 0);

  const pickupCount = trip.stops.filter((s) => s.kind === 'pickup').length;
  const handoverCount = trip.stops.length - pickupCount;

  const routeStops = trip.stops.map((s) => ({
    kind: s.kind,
    name: s.name,
    detail: s.kind === 'pickup' ? `${fmtTime(s.at)} · ${kg(s.kg)}` : `${fmtTime(s.at)} · handover`,
  }));

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <Link className="ym24-back" to="/driver/history">← Back to delivery history</Link>
          <h2 className="ym24-title">YM {trip.id} • {trip.destination}</h2>
          <p>
            Delivered {fmtDate(trip.deliveredAt)}, {fmtTime(trip.deliveredAt)} ({TZ}) · Vehicle {trip.vehicle}
          </p>
        </div>
        <Link className="ym24-btn" to={`/driver/incidents/new?trip=${trip.id}`}>Report incident</Link>
      </div>

      <div className="ym24-stats">
        <StatCard label="Picked up" value={kg(pickedUpKg)} subtext={`Across ${trip.allocations.length} pickup farms`} />
        <StatCard label="Handed over" value={kg(trip.handedOverKg)} subtext={`To ${trip.buyer}`} />
        <StatCard label="Accepted" value={kg(acceptedKg)} subtext={`${kg(notAcceptedKg)} not accepted`} />
        <StatCard label="Order value" value={lkr(orderValueCents)} subtext="Simulated wallet" />
      </div>

      <div className="ym24-row">
        <div className="ym24-panel ym24-route">
          <h3>Route</h3>
          <p className="ym24-panel-sub">
            {pickupCount} pickup stops · {handoverCount} handover · {trip.distanceKm} km · {duration(trip.durationMin)}
          </p>
          <RouteMap stops={routeStops} />
        </div>

        <div className="ym24-panel">
          <h3>Trip summary</h3>
          <p className="ym24-panel-sub">Delivered {fmtDate(trip.deliveredAt)}</p>
          <div className="ym24-kv"><span>Vehicle</span><span>{trip.vehicle}</span></div>
          <div className="ym24-kv"><span>Buyer</span><span>{trip.buyer}</span></div>
          <div className="ym24-kv"><span>Recipient</span><span>{trip.recipient}</span></div>
          <div className="ym24-kv">
            <span>Status</span>
            <span><span className={`ym-status ${statusClass[trip.status]}`}>{trip.status}</span></span>
          </div>
        </div>
      </div>

      <div className="ym24-row">
        <div className="ym24-panel">
          <h3>Allocations</h3>
          <Table headers={['Pickup farm', 'Picked up (kg)', 'Accepted (kg)', 'Price (LKR/kg)']}>
            {trip.allocations.map((a) => (
              <TableRow key={a.farm}>
                <td><strong>{a.farm}</strong></td>
                <td>{kg(a.pickedUpKg)}</td>
                <td>{kg(a.acceptedKg)}</td>
                <td>{lkr(a.priceCentsPerKg)}</td>
              </TableRow>
            ))}
          </Table>
          <p className="ym24-total">
            Total: {kg(pickedUpKg)} picked up · {kg(acceptedKg)} accepted · {lkr(orderValueCents)}
          </p>
        </div>

        <div className="ym24-panel">
          <h3>Accepted by farm</h3>
          <p className="ym24-panel-sub">kg accepted vs picked up</p>
          {trip.allocations.map((a) => (
            <div className="ym24-farm" key={a.farm}>
              <span>{a.farm.split(' ').slice(0, 2).join(' ')}</span>
              <div className="ym24-track">
                <div className="ym24-fill" style={{ width: `${a.pickedUpKg === 0 ? 0 : (a.acceptedKg / a.pickedUpKg) * 100}%` }} />
              </div>
              <span className="ym24-farm-kg">{kg(a.acceptedKg)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ym24-panel">
        <h3>Pickup and handover records</h3>
        <div className="ym24-records">
          {trip.stops.map((s) => (
            <div className="ym24-record" key={`${s.kind}-${s.name}`}>
              <i className={`ym24-record-dot ym24-record-dot--${s.kind}`} />
              <div>
                <strong>{s.kind === 'pickup' ? 'Pickup' : 'Handover'} · {s.name}</strong>
                <span>
                  {fmtDate(s.at)}, {fmtTime(s.at)} ·{' '}
                  {s.kind === 'pickup'
                    ? `${kg(s.kg)} recorded`
                    : `${kg(s.kg)} handed over, ${kg(acceptedKg)} accepted`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {trip.incident && (
        <div className="ym24-panel">
          <h3>Linked incident</h3>
          <div className="ym24-incident">
            <p className="ym24-panel-sub">
              <Link className="ym24-link" to="/driver/incidents">{trip.incident.id}</Link> · {trip.incident.text}
            </p>
            <span className="ym-status ym-tone--warning">{trip.incident.status}</span>
          </div>
        </div>
      )}
    </div>
  );
}