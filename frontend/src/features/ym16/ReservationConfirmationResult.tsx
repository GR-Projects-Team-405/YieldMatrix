import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { ym16Api } from './api';
import { downloadText, formatDate, formatKg, formatLkr } from './format';
import { MapPanel } from './MapPanel';
import { ReservationFrame } from './ReservationFrame';
import { useReservation } from './useReservation';

export default function ReservationConfirmationResult() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, busy, error, notice, setNotice, run } = useReservation(orderId);
  const [open, setOpen] = useState(false);
  const confirmed = data?.order.status === 'confirmed' || data?.order.status === 'in_fulfilment';
  const harvest = data?.maps.harvest[0];

  function agreement() {
    if (!data) return;
    downloadText(`${data.order.contractReference}-agreement.txt`, [
      'YieldMatrix YM16 reservation agreement (simulated)',
      `Reference: ${data.order.contractReference}`,
      `Order: ${data.order.id}`,
      `Hub: ${data.order.destination}`,
      `Volume: ${formatKg(data.summary.committedKg || data.summary.requestedKg)}`,
      `Escrow: ${formatLkr(data.escrow.lockedCents || data.summary.requestedCents)} (simulated Agri Wallet hold)`,
      '',
      ...data.items.map((item) => `${item.farmerName} · ${item.crop} · ${formatKg(item.offeredKg)} · ${item.allocationStatus}`),
      '',
      'This document is a local receipt. It is not a bank, wallet-provider or blockchain settlement.',
    ].join('\n'));
    setNotice('Agreement downloaded.');
  }

  function receipt() {
    if (!data) return;
    downloadText(`${data.order.contractReference}-escrow-receipt.txt`, [
      'YieldMatrix simulated escrow receipt',
      `Reference: ${data.order.contractReference}`,
      `Locked: ${formatLkr(data.escrow.lockedCents || data.summary.requestedCents)}`,
      `Wallet available: ${formatLkr(data.escrow.walletAvailableCents)}`,
      `Wallet held: ${formatLkr(data.escrow.walletHeldCents)}`,
      '',
      ...data.escrow.ledger.map((entry) => `${entry.occurredAt} · ${entry.eventType} · ${formatLkr(entry.amountCents)} · ${entry.reference}`),
    ].join('\n'));
    setNotice('Escrow receipt exported.');
  }

  return (
    <ReservationFrame orderId={orderId} current="confirmation-result" data={data} loading={loading} error={error} notice={notice} onCloseNotice={() => setNotice('')}>
      {data && <>
        <section className="ym16-banner">
          <div>
            <p className="ym16-kicker">{confirmed ? 'Contract reference locked locally' : 'Ready to lock reservation'}</p>
            <h2>{confirmed ? 'Reservation Confirmed & Smart Contract Locked' : 'Confirm reservation to lock the hold'}</h2>
            <p>{data.order.contractReference} · {formatKg(data.summary.committedKg || data.summary.requestedKg)} reserved · {formatLkr(data.escrow.lockedCents || data.summary.requestedCents)} simulated escrow</p>
          </div>
          <div className="ym16-actions">
            <Button variant="outline" onClick={() => navigate('/buyer/wallet')}>View Agri Wallet</Button>
            {!confirmed && <Button disabled={busy || data.order.status !== 'ready_to_confirm'} onClick={() => setOpen(true)}>Confirm reservation</Button>}
          </div>
        </section>
        <div className="ym16-grid">
          <div className="ym16-stack">
            <section className="ym16-card">
              <h3>Digital receipt</h3>
              <div className="ym16-meta">
                <div><span>Contract</span><strong>{data.order.contractReference}</strong></div>
                <div><span>Reserved volume</span><strong>{formatKg(data.confirmation?.reservedKg || data.summary.committedKg || data.summary.requestedKg)}</strong></div>
                <div><span>Financially locked</span><strong>{formatLkr(data.confirmation?.lockedCents || data.escrow.lockedCents)}</strong></div>
                <div><span>Confirmed</span><strong>{data.confirmation ? formatDate(data.confirmation.confirmedAt) : 'Not yet'}</strong></div>
              </div>
            </section>
            <section className="ym16-card">
              <h3>Allocated harvest batches</h3>
              <div className="ym16-split">
                {data.items.filter((item) => item.allocationStatus !== 'declined').map((item) => (
                  <article className="ym16-farmer" key={item.allocationId}>
                    <header>
                      <div>
                        <strong>{item.farmerName}</strong>
                        <div className="ym16-muted">{item.crop} · {item.farmName}</div>
                      </div>
                      <StatusBadge status={item.allocationStatus} />
                    </header>
                    <div>{formatKg(item.offeredKg)} · {formatLkr(item.offeredValueCents)}</div>
                  </article>
                ))}
              </div>
            </section>
            <section className="ym16-card">
              <h3>Execution roadmap</h3>
              <ol className="ym16-roadmap">
                {(data.confirmation?.execution || [
                  { title: 'Telemetry monitoring', detail: 'Custody events join the shared trace record after pickup.' },
                  { title: 'Pre-loading quality check', detail: 'Grade inspection at the farm gate before loading.' },
                  { title: 'Availability and weighbridge calibration', detail: 'Hub scale certificate required before acceptance.' },
                  { title: 'Escrow release upon buyer acceptance', detail: 'Simulated hold is not released from this screen.' },
                ]).map((step) => <li key={step.title}><b>{step.title}</b>{step.detail}</li>)}
              </ol>
            </section>
            <MapPanel
              title="Fulfilment geography"
              latitude={harvest?.latitude}
              longitude={harvest?.longitude}
              caption="Reserved highland lots"
              markers={[
                ...data.items.filter((item) => item.allocationStatus !== 'declined' && item.latitude != null && item.longitude != null).map((item) => ({
                  latitude: item.latitude!, longitude: item.longitude!, label: `${item.farmerName} · ${item.farmName}`, kind: 'farm' as const,
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
              <p className="ym16-kicker">Escrow ledger</p>
              <h3>Financial breakdown</h3>
              <div className="price">{formatLkr(data.escrow.lockedCents || data.summary.requestedCents)}</div>
              {data.escrow.ledger.map((entry) => (
                <p key={entry.id} className="ym16-muted">{entry.eventType} · {formatLkr(entry.amountCents)}</p>
              ))}
              <div className="ym16-actions" style={{ marginTop: 12 }}>
                <Button variant="outline" onClick={agreement}>Download agreement</Button>
                <Button variant="outline" onClick={receipt}>Export escrow receipt</Button>
              </div>
            </section>
            <section className="ym16-card">
              <h3>Smart contract protection</h3>
              <p className="ym16-muted">The reference {data.order.contractReference} is generated by YM16. It is not an on-chain lock. Escrow remains a simulated Agri Wallet hold until an authorised acceptance module releases it.</p>
            </section>
            <section className="ym16-card">
              <h3>Support and navigation</h3>
              <div className="ym16-stack">
                <Button variant="outline" onClick={() => navigate(`/buyer/reservations/${orderId}/farmer-evaluation`)}>Back to evaluation</Button>
                <Button variant="outline" onClick={() => navigate('/buyer/orders')}>Open orders</Button>
                <Button variant="outline" onClick={() => navigate('/buyer/help')}>Help &amp; support</Button>
              </div>
            </section>
          </aside>
        </div>
        <ConfirmDialog
          open={open}
          title="Confirm and consume active holds?"
          description="Accepted lots become committed. Active 30–270 minute reservations are marked consumed. The Agri Wallet hold stays simulated and is not paid out from this screen."
          simulationNote="No payment provider or blockchain network is contacted."
          confirmLabel="Confirm reservation"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => { void run(() => ym16Api.confirm(orderId), 'Reservation confirmed. Simulated escrow remains locked.').then(() => setOpen(false)).catch(() => setOpen(false)); }}
        />
      </>}
    </ReservationFrame>
  );
}
