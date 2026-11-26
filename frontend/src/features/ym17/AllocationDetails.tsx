import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, Field, responseWindow } from './components/detailBits';
import {
  fetchAllocationDetails,
  getApiErrorMessage,
  isNotFoundError,
  isValidAllocationId,
} from './api';
import { formatColomboDate, formatColomboDateTime, formatKg, formatLkrCents, statusLabel } from './format';
import type { AllocationDetail } from './types';

/** The Allocation Inbox lives at this absolute path (see App.tsx). */
const INBOX_PATH = '/farmer/allocations';

/** Task 02B-1 keeps the decision controls inert while no response is possible. */
const DECISION_PENDING_TITLE = 'A response is not available for this allocation';

/**
 * Statuses where "you cannot respond" is simply the allocation moving on
 * through its normal lifecycle (accepted, committed, picked up, handed over,
 * completed, declined, expired, cancelled…). Those states get a neutral
 * informational message instead of a red alert. Anything else — notably a
 * `held` allocation whose hold is missing, released or past its expiry — is an
 * unexpected condition and keeps the error styling.
 */
const NEUTRAL_NON_ACTIONABLE_STATUSES = new Set([
  'supplier_accepted',
  'committed',
  'picked_up',
  'handed_over',
  'accepted',
  'partially_accepted',
  'resolved',
  'declined',
  'expired',
  'cancelled',
]);

type LoadState = 'loading' | 'ready' | 'error';
type ErrorKind = 'invalid' | 'notfound' | 'failed';

/* --------------------------------- page ---------------------------------- */

/**
 * YM17 · Allocation Details (Task 02B-1)
 * Rendered by the feature-local route `/farmer/allocations/:allocationId`.
 * Read-only: it displays GET /api/ym17/allocations/:allocationId and never
 * submits a decision.
 */
export default function AllocationDetails() {
  const { allocationId } = useParams();
  const id = (allocationId ?? '').trim();
  const validId = isValidAllocationId(id);

  const [detail, setDetail] = useState<AllocationDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorKind, setErrorKind] = useState<ErrorKind>('failed');
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  // One request per id/retry; the cleanup aborts it so navigating away or
  // changing the id can never let a stale response overwrite the screen.
  useEffect(() => {
    if (!validId) {
      setDetail(null);
      setErrorKind('invalid');
      setErrorMessage('');
      setLoadState('error');
      return;
    }
    const controller = new AbortController();
    setLoadState('loading');
    fetchAllocationDetails(id, controller.signal)
      .then((allocation) => {
        if (controller.signal.aborted) return;
        setDetail(allocation);
        setErrorKind('failed');
        setErrorMessage('');
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = getApiErrorMessage(error);
        if (!message) return; // cancelled, not a failure
        setDetail(null);
        setErrorKind(isNotFoundError(error) ? 'notfound' : 'failed');
        setErrorMessage(message);
        setLoadState('error');
      });
    return () => controller.abort();
  }, [id, validId, attempt]);

  const backLink = (
    <Link
      to={INBOX_PATH}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text)] hover:text-[var(--accent-text)] transition-colors"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      <span>Back to Allocation Inbox</span>
    </Link>
  );

  // Always a real link (never history.back) so a directly pasted URL still
  // lands back in the inbox instead of leaving the app.
  const backButton = (
    <Link
      to={INBOX_PATH}
      className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
    >
      Back to Allocation Inbox
    </Link>
  );

  /* -------------------------------- states -------------------------------- */

  if (loadState === 'loading') {
    return (
      <div
        role="status"
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center text-sm text-[var(--muted)]"
      >
        Loading allocation details…
      </div>
    );
  }

  if (loadState === 'error') {
    if (errorKind === 'invalid') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">{backLink}</div>
          <EmptyState
            title="Invalid allocation link"
            description="This link does not contain a valid allocation reference, so it cannot be opened. Copy the link again or go back to the inbox."
            action={backButton}
          />
        </div>
      );
    }

    if (errorKind === 'notfound') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">{backLink}</div>
          <EmptyState
            title="Allocation not found"
            description="This allocation does not exist, or it belongs to another farmer's workspace. Open it from your own Allocation Inbox."
            action={backButton}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">{backLink}</div>
        <div className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
          <Alert type="error">
            Allocation details could not be loaded{errorMessage ? `: ${errorMessage}` : '.'}
          </Alert>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              Retry
            </Button>
            {backButton}
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  /* ------------------------------- ready view ------------------------------ */

  const reserved = detail.reservationStatus === 'active';
  const windowText = responseWindow(detail.reservationStatus, detail.reservationExpiresAt);
  // Neutral lifecycle state vs. an unexpected "held but not actionable" one.
  const nonActionableByDesign = !detail.canRespond && NEUTRAL_NON_ACTIONABLE_STATUSES.has(detail.status);

  return (
    <div className="space-y-6">
      {/* 1. Page heading */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text)]">
            Allocation Details
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1.5">
            Review the requested harvest quantity, agreed price and reservation details.
          </p>
        </div>

        <div className="flex flex-col md:items-end text-left md:text-right gap-2">
          <StatusBadge status={statusLabel(detail.status)} />
          {backLink}
        </div>
      </header>

      {/* 2. Allocation overview */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="allocation-overview-heading"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
          <h2 id="allocation-overview-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
            Allocation overview
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="ALLOCATED QUANTITY"
            value={formatKg(detail.agreedKg)}
            subtext="This allocation's share"
          />
          <StatCard
            label="AGREED UNIT PRICE"
            value={`${formatLkrCents(detail.agreedUnitPriceCents)}/kg`}
            subtext="Price locked for this allocation"
          />
          <StatCard
            label="TOTAL ALLOCATION VALUE"
            value={formatLkrCents(detail.agreedValueCents)}
            subtext={`${formatKg(detail.agreedKg)} × ${formatLkrCents(detail.agreedUnitPriceCents)}`}
          />
          <StatCard
            label="BUYER"
            value={<span className="text-2xl">{detail.buyerName}</span>}
            subtext={`${detail.cropName} • ${detail.gradeName}`}
          />
        </div>
      </section>

      {/* 3. Buyer & order + harvest batch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Buyer & Order Information" subtitle="Order context for this allocation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            <Field label="BUYER NAME" value={detail.buyerName} />
            <Field label="REQUESTED PRODUCE" value={`${detail.cropName} • ${detail.gradeName}`} />
            <Field label="ORDER STATUS" value={statusLabel(detail.orderStatus)} />
            <Field label="ALLOCATION CREATED" value={formatColomboDateTime(detail.createdAt)} />
          </div>
          <p className="text-xs text-[var(--muted)] mt-5">
            This allocation reserves {formatKg(detail.agreedKg)} of the buyer&apos;s order.
          </p>
        </Card>

        <Card title="Your Harvest Batch" subtitle="Stock reserved from your own harvested produce">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            {detail.batchDisplayId && <Field label="BATCH" value={detail.batchDisplayId} />}
            <Field label="FARM" value={detail.farmName} />
            <Field label="CROP AND GRADE" value={`${detail.cropName} • ${detail.gradeName}`} />
            <Field label="FARM DISTRICT" value={detail.farmDistrict} />
          </div>
          <p className="text-xs text-[var(--muted)] mt-5">
            Allocated {formatKg(detail.agreedKg)} from this batch.
          </p>
        </Card>
      </div>

      {/* 4. Reservation status + delivery information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section
          className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm lg:col-span-2"
          aria-labelledby="reservation-status-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="reservation-status-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
                Reservation Status
              </h2>
              <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
                Stock held for this request while you review it
              </p>
            </div>
            {detail.reservationStatus ? (
              <StatusBadge status={statusLabel(detail.reservationStatus)} />
            ) : (
              <span className="ym-status ym-tone--neutral">No active hold</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            <Field
              label="RESERVATION EXPIRY"
              value={formatColomboDateTime(detail.reservationExpiresAt)}
            />
            <Field
              label="RESERVED STOCK"
              value={detail.reservationHeldKg ? formatKg(detail.reservationHeldKg) : '—'}
            />
          </div>

          <div className="mt-5">
            <StatCard
              label="RESPONSE WINDOW"
              value={windowText ?? '—'}
              subtext={
                windowText
                  ? 'Counted down from the server reservation expiry'
                  : reserved
                    ? 'No expiry available for this reservation'
                    : 'No live response window'
              }
              highlight={Boolean(windowText)}
            />
          </div>

          <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
            <Info size={16} className="shrink-0" aria-hidden="true" />
            <span>
              {detail.canRespond
                ? 'Allocated stock is temporarily reserved while you review. Respond before the reservation expires.'
                : detail.status === 'held'
                  ? detail.responseUnavailableReason ||
                    'A response is not available for this allocation right now.'
                  : 'This allocation has moved beyond the response stage, so no response is available.'}
            </span>
          </div>

          <p className="text-[11px] text-[var(--muted)] mt-3">
            Expiry times are shown in Asia/Colombo. Whether a response is possible is decided by the server
            using its own clock.
          </p>
        </section>

        <Card title="Delivery information" subtitle="Buyer fulfilment details">
          <div className="flex flex-col gap-5 mt-5">
            <Field label="DESTINATION" value={detail.orderDestinationDistrict} />
            <Field label="DELIVERY WINDOW" value={formatColomboDate(detail.orderDeliveryDate)} />
            <Field label="ORDER STATUS" value={statusLabel(detail.orderStatus)} />
          </div>
        </Card>
      </div>

      {/* 5. Decision area — display only; nothing is submitted here. */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="ready-to-respond-heading"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 id="ready-to-respond-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
            Ready to respond?
          </h2>
          <span className="text-xs text-[var(--muted)]">
            Your selection opens a separate review step; no decision is submitted here.
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {detail.decisionReason && (
            <Alert type="info">
              Decision recorded: {statusLabel(detail.status)} — {detail.decisionReason}
            </Alert>
          )}

          {detail.canRespond ? (
            <Alert type="info">
              This allocation is awaiting your response and the reservation is still active.
            </Alert>
          ) : nonActionableByDesign ? (
            /* Already accepted/decided/fulfilled: normal lifecycle, not a failure. */
            <Alert type="info">
              {detail.responseUnavailableReason ??
                'This allocation is no longer awaiting a response.'}
            </Alert>
          ) : (
            /* `held` but the hold is missing, released or past expiry. */
            <Alert type="error">
              {detail.responseUnavailableReason ??
                'A response is not available for this allocation right now.'}
            </Alert>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={INBOX_PATH}
            className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Inbox
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {detail.canRespond ? (
              /* Task 03C-1: the decision buttons open the review step. */
              <>
                <Link
                  to={`${INBOX_PATH}/${detail.allocationId}/decision?choice=decline`}
                  title="Review the decline before it is submitted"
                  className="ym-button ym-button--danger px-5 py-2.5 text-sm font-semibold rounded-lg"
                >
                  Decline Allocation
                </Link>
                <Link
                  to={`${INBOX_PATH}/${detail.allocationId}/decision?choice=accept`}
                  title="Review the acceptance before it is submitted"
                  className="ym-button ym-button--primary px-5 py-2.5 text-sm font-semibold rounded-lg"
                >
                  Accept Allocation →
                </Link>
              </>
            ) : (
              <>
                <Button variant="danger" disabled title={DECISION_PENDING_TITLE}>
                  Decline Allocation
                </Button>
                <Button variant="primary" disabled title={DECISION_PENDING_TITLE}>
                  Accept Allocation →
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 6. Design note, matching the inbox footer */}
      <footer className="rounded-xl bg-[var(--soft)]/60 border border-[var(--border)] p-3.5 px-4 text-xs text-[var(--muted)] flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="font-bold tracking-wider text-[var(--text)] uppercase text-[10px] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
          DESIGN NOTE
        </span>
        <span>
          Pending decisions open Allocation Details. Expired or decided requests use View Details. No response is
          treated as acceptance.
        </span>
      </footer>
    </div>
  );
}
