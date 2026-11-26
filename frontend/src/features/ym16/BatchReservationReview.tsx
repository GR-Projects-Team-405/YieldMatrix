import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { ym16Api } from './api';
import { formatKg, formatLkr } from './format';
import { MapPanel } from './MapPanel';
import { ReservationFrame } from './ReservationFrame';
import { useReservation } from './useReservation';

export default function BatchReservationReview() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, busy, error, notice, setNotice, run } = useReservation(orderId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function submit() {
    const next = await run(() => ym16Api.submit(orderId), 'Reservation submitted. Simulated escrow hold placed.');
    setConfirmOpen(false);
    navigate(`/buyer/reservations/${next.order.id}/status-countdown`);
  }

  const harvest = data?.maps.harvest[0];

  return (
    <ReservationFrame orderId={orderId} current="batch-review" data={data} loading={loading} error={error} notice={notice} onCloseNotice={() => setNotice('')}>
      {data && <>
        <div className="ym16-toolbar">
          <div>
            <p className="ym16-kicker">Buyer reservations · YM16</p>
            <h2>Batch Reservation Review</h2>
            <p>Review produce allotments, logistics and the simulated Agri Wallet escrow before the 4 hour 30 minute farmer-response hold starts.</p>
          </div>
          <div className="ym16-actions">
            <Button variant="outline" onClick={() => navigate(`/buyer/reservations/${orderId}/status-countdown`)}>Reservation status</Button>
            <Button disabled={busy || data.order.status !== 'draft'} onClick={() => setConfirmOpen(true)}>
              {data.order.status === 'draft' ? 'Submit reservation' : 'Hold already started'}
            </Button>
          </div>
        </div>
        <div className="ym16-grid">
          <div className="ym16-stack">
            <section className="ym16-card">
              <p className="ym16-kicker">Reservation summary</p>
              <h3>{data.produce.title}</h3>
              <div className="ym16-meta">
                <div><span>Requested volume</span><strong>{formatKg(data.summary.requestedKg)}</strong></div>
                <div><span>Suppliers</span><strong>{data.summary.supplierCount}</strong></div>
                <div><span>Harvest window</span><strong>{data.produce.harvestWindow}</strong></div>
                <div><span>Delivery hub</span><strong>{data.produce.deliveryHub}</strong></div>
              </div>
            </section>
            <section className="ym16-card">
              <h3>Produce and harvest allotments</h3>
              <div className="ym16-produce">
                {data.items.map((item) => (
                  <article className="ym16-lot" key={item.allocationId}>
                    <div className={`ym16-lot-art ${item.imageTone}`}>{item.crop}</div>
                    <footer>
                      <strong>{item.farmName}</strong>
                      {item.grade} · {formatKg(item.requestedKg)} · {item.farmDistrict}
                    </footer>
                  </article>
                ))}
              </div>
            </section>
            <section className="ym16-card">
              <h3>Quality, harvest window and delivery</h3>
              <div className="ym16-checks">
                <div className="ym16-stat"><span>Quality</span><strong>{data.produce.quality}</strong></div>
                <div className="ym16-stat"><span>Inspection window</span><strong>{data.logistics.inspectionWindow}</strong></div>
                <div className="ym16-stat"><span>Cold chain</span><strong>{data.logistics.coldChain}</strong></div>
                <div className="ym16-stat"><span>Dispute protection</span><strong>{data.logistics.disputeProtection}</strong></div>
              </div>
            </section>
            <section className="ym16-card">
              <h3>Reservation items</h3>
              <Table headers={['Lot', 'Farmer', 'Qty', 'Price', 'Value', 'Status']}>
                {data.items.map((item) => (
                  <TableRow key={item.allocationId}>
                    <td>{item.crop}<div className="ym16-muted">{item.farmName}</div></td>
                    <td>{item.farmerName}</td>
                    <td>{formatKg(item.requestedKg)}</td>
                    <td>{formatLkr(item.requestedUnitPriceCents)} / kg</td>
                    <td>{formatLkr(item.requestedValueCents)}</td>
                    <td><StatusBadge status={item.allocationStatus} /></td>
                  </TableRow>
                ))}
              </Table>
            </section>
            <section className="ym16-card">
              <h3>Logistics verification</h3>
              <p className="ym16-muted">Pickup addresses are private operational data for this hold. Hub geofence: {data.logistics.geofence}.</p>
              <ul className="assigned-pages">
                {data.items.map((item) => <li key={item.allocationId}>{item.farmerName} · {item.pickupAddress}</li>)}
              </ul>
            </section>
            <MapPanel
              title="Harvest zone"
              latitude={harvest?.latitude}
              longitude={harvest?.longitude}
              caption={harvest?.district || 'Highland pickup cluster'}
              markers={[
                ...data.items.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({
                  latitude: item.latitude!, longitude: item.longitude!, label: `${item.farmerName} · ${item.farmName} · ${item.crop}`, kind: 'farm' as const,
                })),
                ...(data.maps.depot.latitude != null && data.maps.depot.longitude != null ? [{
                  latitude: Number(data.maps.depot.latitude), longitude: Number(data.maps.depot.longitude),
                  label: `Collection hub · ${data.maps.depot.name}`, kind: 'hub' as const,
                }] : []),
              ]}
              geofenceRadiusKm={data.logistics.geofenceRadiusKm}
            />
          </div>
          <aside className="ym16-stack">
            <section className="ym16-side">
              <p className="ym16-kicker">Escrow commitment</p>
              <h3>Simulated procurement hold</h3>
              <div className="price">{formatLkr(data.summary.requestedCents)}</div>
              <p className="ym16-muted">Funds are not sent to a payment provider. Confirming this review places a simulated Agri Wallet hold for the full requested value.</p>
              <div className="ym16-wallet">
                <span>Agri Wallet available</span>
                <strong>{formatLkr(data.escrow.walletAvailableCents)}</strong>
                <div className="ym16-muted">Already held: {formatLkr(data.escrow.walletHeldCents)}</div>
              </div>
              <Button disabled={busy || data.order.status !== 'draft'} onClick={() => setConfirmOpen(true)}>Continue to farmer hold</Button>
            </section>
            <section className="ym16-card">
              <h3>Escrow and procurement terms</h3>
              <p className="ym16-muted">Hold duration 4 hours 30 minutes. Unused lots can be released before expiry. Settlement is a later authorised step, not this reservation lock.</p>
            </section>
            <section className="ym16-card">
              <h3>Delivery hub</h3>
              <strong>{data.order.destination}</strong>
              <p className="ym16-muted">{data.order.destinationDistrict} · delivery {data.order.deliveryDate}</p>
            </section>
          </aside>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Place simulated escrow hold?"
          description="This starts the farmer-response countdown and holds Agri Wallet funds inside the simulation. No bank transfer is sent."
          simulationNote="Wallet movements are simulated. Available balance must cover the requested value."
          confirmLabel="Submit reservation"
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { void submit().catch(() => setConfirmOpen(false)); }}
        />
      </>}
    </ReservationFrame>
  );
}
