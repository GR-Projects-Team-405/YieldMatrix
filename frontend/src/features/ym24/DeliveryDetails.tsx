import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { StatCard } from '../../components/StatCard';
import { Table, TableRow } from '../../components/Table';
import { Alert } from '../../components/Alert';
import RouteMap from './RouteMap';
import { getDelivery, errorMessage } from './ym24Api';
import type { DeliveryDetail, DeliveryStatus, IncidentStatus } from './ym24Api';
import './DeliveryHistory.css'; // shared page styles (panels, buttons, stats)
import './DeliveryDetails.css';

const statusClass: Record<DeliveryStatus, string> = {
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};

const incidentLabel: Record<IncidentStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
};
const incidentClass: Record<IncidentStatus, string> = {
  open: 'ym-tone--warning',
  under_review: 'ym-tone--warning',
  resolved: 'ym-tone--success',
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

export default function DeliveryDetails({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      setTrip(await getDelivery(tripId));
    } catch (e) {
      setTrip(null);
      // 404 = not this driver's trip (or no such trip), 400 = not a valid trip id.
      if (axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 400)) setNotFound(true);
      else setError(errorMessage(e, 'Could not load this delivery.'));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load]);

  const back = <Link className="ym24-back" to="/driver/history">← Back to delivery history</Link>;

  if (loading) {
    return (
      <div className="ym24-page">
        {back}
        <div className="ym24-panel ym24-empty">Loading delivery…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="ym24-page">
        {back}
        <div className="ym24-panel ym24-empty">This trip was not found.</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="ym24-page">
        {back}
        <Alert type="error">{error || 'Could not load this delivery.'}</Alert>
        <div className="ym24-actions">
          <button type="button" className="ym24-btn" onClick={() => void load()}>Try again</button>
        </div>
      </div>
    );
  }

  const pickedUpKg = round3(trip.allocations.reduce((sum, a) => sum + a.pickedUpKg, 0));
  const acceptedKg = round3(trip.allocations.reduce((sum, a) => sum + a.acceptedKg, 0));
  const notAcceptedKg = round3(Math.max(0, trip.handedOverKg - acceptedKg));
  const orderValueCents = trip.allocations.reduce((sum, a) => sum + Math.round(a.pickedUpKg * a.priceCentsPerKg), 0);

  const routeStops = [
    ...trip.allocations.map((a) => ({
      kind: 'pickup' as const,
      name: a.farm,
      detail: a.pickedUpAt ? `${fmtTime(a.pickedUpAt)} · ${kg(a.pickedUpKg)}` : kg(a.pickedUpKg),
    })),
    {
      kind: 'handover' as const,
      name: trip.buyer,
      detail: trip.deliveredAt ? `${fmtTime(trip.deliveredAt)} · handover` : 'handover',
    },
  ];

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          {back}
          <h2 className="ym24-title">{trip.code} • {trip.destination}</h2>
          <p>
            {trip.deliveredAt ? `Delivered ${fmtDate(trip.deliveredAt)}, ${fmtTime(trip.deliveredAt)} (${TZ})` : 'Not delivered yet'} · Vehicle {trip.vehicle}
          </p>
        </div>
        <Link className="ym24-btn" to={`/driver/incidents/new?trip=${trip.id}`}>Report incident</Link>
      </div>

      <div className="ym24-stats">
        <StatCard label="Picked up" value={kg(pickedUpKg)} subtext={`Across ${trip.allocations.length} pickup ${trip.allocations.length === 1 ? 'farm' : 'farms'}`} />
        <StatCard label="Handed over" value={kg(trip.handedOverKg)} subtext={`To ${trip.buyer}`} />
        <StatCard label="Accepted" value={kg(acceptedKg)} subtext={`${kg(notAcceptedKg)} not accepted`} />
        <StatCard label="Order value" value={lkr(orderValueCents)} subtext="Simulated wallet" />
      </div>

      <div className="ym24-row">
        <div className="ym24-panel ym24-route">
          <h3>Route</h3>
          <p className="ym24-panel-sub">
            {trip.allocations.length} pickup {trip.allocations.length === 1 ? 'stop' : 'stops'} · 1 handover
          </p>
          <RouteMap stops={routeStops} />
        </div>

        <div className="ym24-panel">
          <h3>Trip summary</h3>
          <p className="ym24-panel-sub">{trip.deliveredAt ? `Delivered ${fmtDate(trip.deliveredAt)}` : 'Not delivered yet'}</p>
          <div className="ym24-kv"><span>Vehicle</span><span>{trip.vehicle}</span></div>
          <div className="ym24-kv"><span>Buyer</span><span>{trip.buyer}</span></div>
          <div className="ym24-kv"><span>Recipient</span><span>{trip.recipient ?? '—'}</span></div>
          <div className="ym24-kv">
            <span>Status</span>
            <span><span className={`ym-status ${statusClass[trip.status]}`}>{trip.status}</span></span>
          </div>
        </div>
      </div>

      <div className="ym24-row">
        <div className="ym24-panel">
          <h3>Allocations</h3>
          <p className="ym24-panel-sub">&nbsp;</p>
          <Table headers={['Pickup farm', 'Picked up (kg)', 'Accepted (kg)', 'Price (LKR/kg)']}>
            {trip.allocations.map((a) => (
              <TableRow key={`${a.sequence}-${a.farm}`}>
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
            <div className="ym24-farm" key={`${a.sequence}-${a.farm}`}>
              <span>{a.farm.split(' ').slice(0, 2).join(' ')}</span>
              <div className="ym24-track">
                <div className="ym24-fill" style={{ width: `${a.pickedUpKg === 0 ? 0 : Math.min(100, (a.acceptedKg / a.pickedUpKg) * 100)}%` }} />
              </div>
              <span className="ym24-farm-kg">{kg(a.acceptedKg)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ym24-panel">
        <h3>Pickup and handover records</h3>
        <p className="ym24-panel-sub">&nbsp;</p>
        <div className="ym24-records">
          {trip.allocations.map((a) => (
            <div className="ym24-record" key={`pickup-${a.sequence}-${a.farm}`}>
              <i className="ym24-record-dot ym24-record-dot--pickup" />
              <div>
                <strong>Pickup · {a.farm}</strong>
                <span>
                  {a.pickedUpAt ? `${fmtDate(a.pickedUpAt)}, ${fmtTime(a.pickedUpAt)}` : '—'} · {kg(a.pickedUpKg)} recorded
                </span>
              </div>
            </div>
          ))}
          <div className="ym24-record">
            <i className="ym24-record-dot ym24-record-dot--handover" />
            <div>
              <strong>Handover · {trip.buyer}</strong>
              <span>
                {trip.deliveredAt ? `${fmtDate(trip.deliveredAt)}, ${fmtTime(trip.deliveredAt)}` : '—'} · {kg(trip.handedOverKg)} handed over, {kg(acceptedKg)} accepted
              </span>
            </div>
          </div>
        </div>
      </div>

      {trip.incident && (
        <div className="ym24-panel">
          <h3>Linked incident</h3>
          <div className="ym24-incident">
            <p className="ym24-panel-sub">{trip.incident.code} · {trip.incident.text}</p>
            <span className={`ym-status ${incidentClass[trip.incident.status]}`}>{incidentLabel[trip.incident.status]}</span>
          </div>
        </div>
      )}
    </div>
  );
}