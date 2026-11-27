import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { ym16Api } from './api';
import { formatDate, formatKg, formatLkr, splitCountdown } from './format';
import { MapPanel } from './MapPanel';
import { ReservationFrame } from './ReservationFrame';
import { useReservation } from './useReservation';

export default function ReservationStatusCountdown() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, busy, error, notice, setNotice, run, reload } = useReservation(orderId);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => { setSeconds(data?.countdown.remainingSeconds ?? 0); }, [data?.countdown.remainingSeconds]);
  useEffect(() => {
    if (data?.order.status !== 'awaiting_suppliers') return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) void reload();
      return Math.max(0, value - 1);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [reload, data?.order.status]);
  useEffect(() => {
    if (data?.order.status !== 'awaiting_suppliers') return;
    const poll = window.setInterval(() => void reload(), 15000);
    return () => window.clearInterval(poll);
  }, [reload, data?.order.status]);

  const clock = splitCountdown(seconds);
  const harvest = data?.maps.harvest[0];
  const depot = data?.maps.depot;
  const responded = data?.items.filter((item) => item.responseKind !== 'pending').length ?? 0;

  return (
    <ReservationFrame orderId={orderId} current="status-countdown" data={data} loading={loading} error={error} notice={notice} onCloseNotice={() => setNotice('')}>
      {data && <>
        <div className="ym16-toolbar">
          <div>
            <p className="ym16-kicker">Live hold · {data.order.contractReference}</p>
            <h2>Reservation Status &amp; Countdown</h2>
            <p>Farmers have until the hold expires to accept or counter the reserved lots. Escrow stays simulated until a later settlement step.</p>
          </div>
          <div className="ym16-actions">
            <Button variant="outline" onClick={() => navigate(`/buyer/reservations/${orderId}/batch-review`)}>Back to review</Button>
            <Button variant="outline" disabled={busy} onClick={() => void reload()}>Refresh status</Button>
          </div>
        </div>
        <section className="ym16-hero">
          <p className="ym16-kicker">Time remaining on active holds</p>
          <div className="clock">{String(clock.hours).padStart(2, '0')}h:{String(clock.minutes).padStart(2, '0')}m:{String(clock.seconds).padStart(2, '0')}s</div>
          <div className="ym16-pills">
            <span className="ym16-pill">Order {data.order.status.replaceAll('_', ' ')}</span>
            <span className="ym16-pill">Escrow {data.summary.escrowState}</span>
            <span className="ym16-pill">{responded}/{data.items.length} farmer replies</span>
            <span className="ym16-pill">Expires {data.countdown.expiresAt ? formatDate(data.countdown.expiresAt) : 'not started'}</span>
          </div>
        </section>
        <div className="ym16-meta">
          <div><span>Requested</span><strong>{formatKg(data.summary.requestedKg)}</strong></div>
          <div><span>Escrow locked</span><strong>{formatLkr(data.escrow.lockedCents)}</strong></div>
          <div><span>Farmer replies</span><strong>{responded} of {data.items.length}</strong></div>
          <div><span>Vault</span><strong>{data.escrow.simulated ? 'Simulated Agri Wallet' : 'Wallet'}</strong></div>
        </div>
        <div className="ym16-grid">
          <div className="ym16-stack">
            <section className="ym16-card">
              <h3>Batch allocation breakdown</h3>
              <div className="ym16-split">
                {data.items.map((item) => (
                  <article className="ym16-farmer" key={item.allocationId}>
                    <header>
                      <div>
                        <strong>{item.farmerName}</strong>
                        <div className="ym16-muted">{item.farmName} · {item.crop}</div>
                      </div>
                      <StatusBadge status={item.responseKind === 'pending' ? 'Awaiting response' : item.responseKind} />
                    </header>
                    <div className="ym16-compare">
                      <div>Held {formatKg(item.requestedKg)}</div>
                      <div>{formatLkr(item.requestedValueCents)}</div>
                    </div>
                    <div className="ym16-inline">
                      <Button variant="outline" onClick={() => setNotice(`${item.farmerName} · ${item.farmDistrict} · ${item.pickupAddress}`)}>View farmer profile</Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          const message = window.prompt(`Message ${item.farmerName}`, 'Please confirm this harvest window and gate access.') || '';
                          if (!message.trim()) return;
                          void run(() => ym16Api.message(orderId, item.allocationId, message.trim()), `Message sent to ${item.farmerName}.`).catch(() => undefined);
                        }}
                      >
                        Send message
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="ym16-card">
              <h3>Allocation and audit trail</h3>
              <ul className="ym16-roadmap">
                {data.audit.length ? data.audit.map((entry) => (
                  <li key={entry.id}><b>{entry.action}</b><span className="ym16-muted">{formatDate(entry.occurredAt)} · {entry.reason}</span></li>
                )) : <li>No audit events yet.</li>}
              </ul>
            </section>
            <div className="ym16-split">
              <MapPanel
                title="Harvest zone map"
                latitude={harvest?.latitude}
                longitude={harvest?.longitude}
                caption="Supplier pickup cluster"
                markers={data.items.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({
                  latitude: item.latitude!, longitude: item.longitude!, label: `${item.farmerName} · ${item.farmName}`, kind: 'farm' as const,
                }))}
              />
              <MapPanel
                title="Depot geofence map"
                latitude={depot?.latitude}
                longitude={depot?.longitude}
                caption={depot?.name}
                markers={depot?.latitude != null && depot?.longitude != null ? [{
                  latitude: Number(depot.latitude), longitude: Number(depot.longitude), label: `Collection hub · ${depot.name}`, kind: 'hub' as const,
                }] : []}
                geofenceRadiusKm={data.logistics.geofenceRadiusKm}
              />
            </div>
          </div>
          <aside className="ym16-stack">
            <section className="ym16-side">
              <p className="ym16-kicker">Escrow vault</p>
              <h3>Target fulfilment</h3>
              <div className="price">{formatLkr(data.escrow.lockedCents || data.summary.requestedCents)}</div>
              <p className="ym16-muted">Hold is simulated. {data.countdown.expired ? 'This hold has expired.' : 'Responding farmers do not move cash; they only change reservation state.'}</p>
              <Button variant="outline" onClick={() => navigate('/buyer/wallet')}>View Agri Wallet</Button>
            </section>
            <section className="ym16-card">
              <h3>Escrow support</h3>
              <p className="ym16-muted">If a farmer misses the window the hold expires, stock is released and the simulated wallet hold is reversed. Support tickets stay on the help module.</p>
              <Button variant="outline" onClick={() => navigate('/buyer/help')}>Open support</Button>
            </section>
            {data.order.status === 'draft' && (
              <section className="ym16-card">
                <h3>Hold not started</h3>
                <p className="ym16-muted">Submit the batch review before the countdown and farmer inbox go live.</p>
                <Button onClick={() => navigate(`/buyer/reservations/${orderId}/batch-review`)}>Go to review</Button>
              </section>
            )}
          </aside>
        </div>
      </>}
    </ReservationFrame>
  );
}
