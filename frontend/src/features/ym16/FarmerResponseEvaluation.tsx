import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { ym16Api } from './api';
import { formatKg, formatLkr } from './format';
import { ReservationFrame } from './ReservationFrame';
import { useReservation } from './useReservation';
import type { ReservationItem } from './types';

export default function FarmerResponseEvaluation() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, busy, error, notice, setNotice, run } = useReservation(orderId);
  const [pending, setPending] = useState<{ item: ReservationItem; decision: 'accept' | 'decline' | 'accept-counter' } | null>(null);

  async function apply() {
    if (!pending) return;
    const labels = { accept: 'Farmer terms accepted.', decline: 'Supplier response declined.', 'accept-counter': 'Counter-offer accepted within escrow cap.' };
    await run(() => ym16Api.decide(orderId, pending.item.allocationId, pending.decision), labels[pending.decision]);
    setPending(null);
  }

  const ready = data?.order.status === 'ready_to_confirm';

  return (
    <ReservationFrame orderId={orderId} current="farmer-evaluation" data={data} loading={loading} error={error} notice={notice} onCloseNotice={() => setNotice('')}>
      {data && <>
        <div className="ym16-toolbar">
          <div>
            <p className="ym16-kicker">Supplier replies · {data.order.contractReference}</p>
            <h2>Farmer Response Evaluation</h2>
            <p>Accept matching lots, accept in-cap counter-offers, or decline. Allocation prices on the hold cannot increase above the escrowed value.</p>
          </div>
          <div className="ym16-actions">
            <Button variant="outline" onClick={() => navigate(`/buyer/reservations/${orderId}/status-countdown`)}>Back</Button>
            <Button disabled={!ready || busy} onClick={() => navigate(`/buyer/reservations/${orderId}/confirmation-result`)}>Continue to confirmation</Button>
          </div>
        </div>
        <div className="ym16-meta">
          <div><span>Requested quantity</span><strong>{formatKg(data.summary.requestedKg)}</strong></div>
          <div><span>Committed quantity</span><strong>{formatKg(data.summary.committedKg)}</strong></div>
          <div><span>Price variance</span><strong>{data.summary.priceVariancePct > 0 ? '+' : ''}{data.summary.priceVariancePct}%</strong></div>
          <div><span>Escrow state</span><strong>{data.summary.escrowState}</strong></div>
        </div>
        <div className="ym16-split">
          {data.items.map((item) => (
            <article className="ym16-farmer" key={item.allocationId}>
              <header>
                <div>
                  <strong>{item.farmerName}</strong>
                  <div className="ym16-muted">{item.farmName} · {item.crop} · {item.quality.label}</div>
                </div>
                <StatusBadge status={item.responseKind === 'pending' ? 'Pending' : item.responseKind} />
              </header>
              <div className="ym16-compare">
                <div><span className="ym16-muted">Requested</span><strong>{formatKg(item.requestedKg)}</strong><div>{formatLkr(item.requestedUnitPriceCents)} / kg</div></div>
                <div><span className="ym16-muted">Offered</span><strong>{formatKg(item.offeredKg)}</strong><div>{formatLkr(item.offeredUnitPriceCents)} / kg</div></div>
              </div>
              <p className="ym16-notes">{item.notes || 'No farmer response or comment has been submitted yet.'}</p>
              <div className="ym16-muted">Quality · moisture {item.quality.moisture || 'n/a'} · size {item.quality.sizeClass || 'n/a'}</div>
              <div className="ym16-inline">
                {item.responseKind === 'counter' ? (
                  <Button disabled={busy || item.allocationStatus !== 'held'} onClick={() => setPending({ item, decision: 'accept-counter' })}>Accept counter-offer</Button>
                ) : (
                  <Button disabled={busy || item.allocationStatus !== 'held' || item.responseKind === 'pending'} onClick={() => setPending({ item, decision: 'accept' })}>Approve</Button>
                )}
                <Button variant="danger" disabled={busy || item.allocationStatus !== 'held'} onClick={() => setPending({ item, decision: 'decline' })}>Decline</Button>
              </div>
            </article>
          ))}
        </div>
        <section className="ym16-card">
          <div className="ym16-toolbar">
            <div>
              <h3>Consolidated commitment reconciliation</h3>
              <p className="ym16-muted">Accepted offered value {formatLkr(data.summary.committedCents)} against requested {formatLkr(data.summary.requestedCents)}. Smart-contract language here is a local reference only; no chain transaction is broadcast.</p>
            </div>
            <div className="price" style={{ fontSize: 28, fontWeight: 800, color: 'var(--forest)' }}>{formatLkr(data.summary.committedCents || data.summary.requestedCents)}</div>
          </div>
        </section>
        <ConfirmDialog
          open={Boolean(pending)}
          title={pending?.decision === 'decline' ? `Decline ${pending.item.farmerName}?` : `Accept ${pending?.item.farmerName}'s response?`}
          description={pending?.decision === 'decline'
            ? 'The lot hold is released. Simulated escrow stays on the order until every lot is declined or the reservation is cancelled.'
            : 'This records a buyer decision against the supplier allocation. Counter-offers above the escrow cap are rejected by the API.'}
          simulationNote="No live payment is captured or released by this decision."
          confirmLabel={pending?.decision === 'decline' ? 'Decline' : 'Accept'}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => { void apply().catch(() => setPending(null)); }}
        />
      </>}
    </ReservationFrame>
  );
}
