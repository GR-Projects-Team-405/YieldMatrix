import { useEffect, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { apiError, ym16Api } from './api';
import { formatKg, formatLkr } from './format';
import type { ReservationDetail, ReservationItem } from './types';

export default function FarmerReservations() {
  const [reservations, setReservations] = useState<ReservationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setReservations(await ym16Api.farmerReservations());
    } catch (err) {
      setError(apiError(err, 'Unable to load assigned reservations'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function respond(reservationId: string, item: ReservationItem, response: 'accept' | 'reject' | 'counter') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let offeredKg: number | undefined;
      let offeredUnitPriceCents: number | undefined;
      let notes: string | undefined;
      if (response === 'counter') {
        const kgText = window.prompt('Counter quantity (kg)', String(item.requestedKg));
        const priceText = window.prompt('Counter price (LKR cents per kg)', String(item.requestedUnitPriceCents));
        if (!kgText || !priceText) return;
        offeredKg = Number(kgText);
        offeredUnitPriceCents = Number(priceText);
        notes = window.prompt('Comment to the buyer', '') || '';
      } else {
        notes = window.prompt('Optional reason or comment', '') || '';
      }
      const updated = await ym16Api.farmerResponse(reservationId, {
        allocationId: item.allocationId,
        response,
        offeredKg,
        offeredUnitPriceCents,
        notes,
      });
      setReservations((current) => current.map((reservation) => reservation.order.id === reservationId ? updated : reservation));
      setNotice(response === 'reject' ? 'Response rejected and recorded.' : 'Farmer response recorded.');
    } catch (err) {
      setError(apiError(err, 'Unable to submit farmer response'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="loading-state" role="status">Loading assigned reservations…</p>;
  if (error && reservations.length === 0) return <Alert type="error">{error}</Alert>;
  if (reservations.length === 0) return <EmptyState title="No assigned reservations" description="You do not currently have any YM16 reservation allocations." />;

  return (
    <div className="ym16-stack">
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      {reservations.map((reservation) => (
        <section className="ym16-card" key={reservation.order.id}>
          <div className="ym16-toolbar">
            <div>
              <p className="ym16-kicker">Reservation {reservation.order.contractReference}</p>
              <h2>Assigned reservation request</h2>
              <p>Destination: {reservation.order.destination} · Delivery: {reservation.order.deliveryDate}</p>
            </div>
          </div>
          <div className="ym16-split">
            {reservation.items.filter((item) => item.farmerId).map((item) => (
              <article className="ym16-farmer" key={item.allocationId}>
                <header>
                  <div><strong>{item.crop} · {item.grade}</strong><div className="ym16-muted">{item.farmName}</div></div>
                </header>
                <div className="ym16-compare">
                  <div><span className="ym16-muted">Requested</span><strong>{formatKg(item.requestedKg)}</strong><div>{formatLkr(item.requestedUnitPriceCents)} / kg</div></div>
                  <div><span className="ym16-muted">Current response</span><strong>{item.responseKind}</strong><div>{item.notes || 'No comment'}</div></div>
                </div>
                <div className="ym16-inline">
                  <Button disabled={busy || item.allocationStatus !== 'held' || item.responseKind !== 'pending'} onClick={() => void respond(reservation.order.id, item, 'accept')}>Accept</Button>
                  <Button variant="outline" disabled={busy || item.allocationStatus !== 'held' || item.responseKind !== 'pending'} onClick={() => void respond(reservation.order.id, item, 'counter')}>Counter-offer</Button>
                  <Button variant="danger" disabled={busy || item.allocationStatus !== 'held' || item.responseKind !== 'pending'} onClick={() => void respond(reservation.order.id, item, 'reject')}>Reject</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
