import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, Field, responseWindow } from './components/detailBits';
import {
  fetchAllocationDetails,
  getApiErrorMessage,
  getHttpStatus,
  isConflictError,
  isNotFoundError,
  isValidAllocationId,
  MAX_DECISION_REASON_LENGTH,
  submitAllocationAccept,
  submitAllocationDecline,
} from './api';
import { formatColomboDateTime, formatKg, formatLkrCents, statusLabel } from './format';
import type { AllocationDetail } from './types';

/** Absolute paths inside the feature (see App.tsx and index.tsx). */
const INBOX_PATH = '/farmer/allocations';

type LoadState = 'loading' | 'ready' | 'error';
type ErrorKind = 'invalid' | 'notfound' | 'failed';
type Choice = 'accept' | 'decline';

/** Why a submission failed; drives the banner copy and the 409 refresh. */
type SubmitErrorKind = 'validation' | 'auth' | 'notfound' | 'conflict' | 'failed';

interface SubmitFailure {
  kind: SubmitErrorKind;
  message: string;
}

/* --------------------------------- page ---------------------------------- */

/**
 * YM17 · Allocation Decision Review (Task 03C-1 + 03C-2)
 * Rendered by the feature-local route `/farmer/allocations/:allocationId/decision`.
 *
 * It loads the SAME allocation record as the details page
 * (GET /api/ym17/allocations/:allocationId), walks the farmer through the
 * choice, the acknowledgement and the decline reason, then submits the decision
 * to POST .../accept or .../decline. The server stays authoritative: its
 * response replaces the displayed allocation, a 409 re-reads the record, and
 * once a decision is recorded the controls disappear entirely.
 */
export default function DecisionReview() {
  const { allocationId } = useParams();
  const [searchParams] = useSearchParams();
  const id = (allocationId ?? '').trim();
  const validId = isValidAllocationId(id);

  const [detail, setDetail] = useState<AllocationDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorKind, setErrorKind] = useState<ErrorKind>('failed');
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Decision form state.
  const requested = searchParams.get('choice');
  const [choice, setChoice] = useState<Choice | null>(
    requested === 'accept' || requested === 'decline' ? requested : null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState('');

  // Submission state (Task 03C-2): `inFlight` is a synchronous duplicate guard
  // for fast double-clicks, `submitting` drives the disabled/loading UI, `failure`
  // survives a 409 refresh, and `outcome` is the recorded decision.
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [outcome, setOutcome] = useState<Choice | null>(null);

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

  /**
   * Sends the decision to the backend (Task 03C-2). The client-side checks
   * only stop obvious mistakes — the server re-validates ownership, status and
   * the live hold inside its own transaction and can still answer 404/409.
   */
  async function submitDecision(): Promise<void> {
    // Duplicate guard: one request at a time, nothing after a decision exists,
    // and never fire for an allocation the server said cannot be responded to.
    if (inFlight.current || submitting || outcome || !detail || !detail.canRespond || !choice) return;
    if (choice === 'accept' && !acknowledged) return;
    const trimmedReason = reason.trim();
    if (choice === 'decline' && (trimmedReason.length < 1 || trimmedReason.length > MAX_DECISION_REASON_LENGTH)) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);
    try {
      const updated =
        choice === 'accept'
          ? await submitAllocationAccept(id)
          : await submitAllocationDecline(id, trimmedReason);
      // The response is the server's post-decision record: status flipped,
      // canRespond false — so the controls vanish with the state update.
      setDetail(updated);
      setOutcome(choice);
    } catch (error: unknown) {
      const status = getHttpStatus(error);
      const serverMessage = getApiErrorMessage(error, '');
      if (status === 401) {
        setFailure({
          kind: 'auth',
          message: 'Your session has expired. Sign in again, then repeat your decision.',
        });
      } else if (status === 403) {
        setFailure({
          kind: 'auth',
          message: serverMessage || 'Your account cannot respond to allocations right now.',
        });
      } else if (status === 404) {
        setFailure({
          kind: 'notfound',
          message:
            'This allocation no longer exists, or it belongs to another farmer. Open it from your Allocation Inbox.',
        });
      } else if (isConflictError(error)) {
        await refreshAfterConflict(serverMessage);
      } else if (status === 400) {
        setFailure({
          kind: 'validation',
          message: serverMessage || 'The decision was rejected as submitted. Check the form and try again.',
        });
      } else {
        setFailure({
          kind: 'failed',
          message: serverMessage || 'The decision could not be sent. Check your connection and try again.',
        });
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  /**
   * 409 means the record moved on since the page loaded (expired hold, or the
   * decision was already made). Explain that, then re-read the allocation from
   * GET so the screen reflects the authoritative state instead of the stale one.
   */
  async function refreshAfterConflict(serverMessage: string): Promise<void> {
    const headline = serverMessage || 'This allocation is no longer available for a decision.';
    try {
      const latest = await fetchAllocationDetails(id);
      setDetail(latest);
      setFailure({
        kind: 'conflict',
        message: `${headline} The allocation may no longer be available; the details below have been refreshed.`,
      });
    } catch {
      setFailure({
        kind: 'conflict',
        message: `${headline} The allocation may no longer be available, and the latest details could not be refreshed.`,
      });
    }
  }

  /** Choosing an option clears a failure that belonged to the other option. */
  function selectChoice(next: Choice): void {
    if (submitting) return;
    setChoice(next);
    setFailure(null);
  }

  const detailsPath = `${INBOX_PATH}/${id}`;
  const backLink = (
    <Link
      to={detailsPath}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text)] hover:text-[var(--accent-text)] transition-colors"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      <span>Back to Allocation Details</span>
    </Link>
  );
  const backButton = (
    <Link
      to={detailsPath}
      className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
    >
      Back to Allocation Details
    </Link>
  );

  /* -------------------------------- states -------------------------------- */

  if (loadState === 'loading') {
    return (
      <div
        role="status"
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center text-sm text-[var(--muted)]"
      >
        Loading decision review…
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
            description="This link does not contain a valid allocation reference, so a decision cannot be reviewed. Copy the link again or go back to the details page."
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
            The decision review could not be loaded{errorMessage ? `: ${errorMessage}` : '.'}
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

  const windowText = responseWindow(detail.reservationStatus, detail.reservationExpiresAt);
  const reasonTrimmed = reason.trim();
  const reasonValid =
    reasonTrimmed.length >= 1 && reasonTrimmed.length <= MAX_DECISION_REASON_LENGTH;

  const summaryFields = [
    { label: 'BUYER', value: detail.buyerName },
    { label: 'PRODUCE', value: `${detail.cropName} • ${detail.gradeName}` },
    { label: 'FARM', value: detail.farmName },
    ...(detail.batchDisplayId ? [{ label: 'BATCH', value: detail.batchDisplayId }] : []),
    { label: 'ALLOCATED QUANTITY', value: formatKg(detail.agreedKg) },
    { label: 'AGREED UNIT PRICE', value: `${formatLkrCents(detail.agreedUnitPriceCents)}/kg` },
    { label: 'TOTAL VALUE', value: formatLkrCents(detail.agreedValueCents) },
    { label: 'CREATED', value: formatColomboDateTime(detail.createdAt) },
  ];

  const optionClass = (active: boolean) =>
    `text-left rounded-xl border p-4 transition-colors ${
      active
        ? 'border-[var(--accent-text)] bg-[var(--soft)]'
        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--canvas)]'
    }`;

  return (
    <div className="space-y-6">
      {/* 1. Page heading */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text)]">
            Allocation Decision Review
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1.5">
            Review your decision before responding to this allocation request.
          </p>
        </div>

        <div className="flex flex-col md:items-end text-left md:text-right gap-2">
          <StatusBadge status={statusLabel(detail.status)} />
          {backLink}
        </div>
      </header>

      {/* Submission failure banner — survives a 409 refresh so the farmer
          still sees why the controls changed. */}
      {failure && (
        <div className="space-y-3">
          <Alert type="error">{failure.message}</Alert>
          {failure.kind === 'conflict' && (
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              Reload allocation details
            </Button>
          )}
        </div>
      )}

      {/* 2. Allocation Summary — real data from GET /allocations/:allocationId */}
      <Card title="Allocation Summary" subtitle="Agreed terms for this allocation request.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
          {summaryFields.map((field) => (
            <Field key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      </Card>

      {/* 3. Decision unavailable: explain, never offer the controls. A
          recorded decision shows the success card instead (its own copy of the
          state already explains the outcome). */}
      {!outcome && !detail.canRespond && (
        <section
          className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
          aria-labelledby="decision-unavailable-heading"
        >
          <h2 id="decision-unavailable-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
            Decisions are unavailable for this allocation
          </h2>
          <div className="mt-4">
            {detail.status === 'held' ? (
              <Alert type="error">
                {detail.responseUnavailableReason ??
                  'A response is not available for this allocation right now.'}
              </Alert>
            ) : (
              <Alert type="info">
                {detail.responseUnavailableReason ??
                  'This allocation is no longer awaiting a response.'}
              </Alert>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {backButton}
            <Link
              to={INBOX_PATH}
              className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Allocation Inbox
            </Link>
          </div>
        </section>
      )}

      {/* 4a. Decision recorded: the server's answer replaced our copy, so the
          controls are gone; confirm the outcome and offer navigation. */}
      {outcome && (
        <section
          className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
          aria-labelledby="decision-recorded-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="decision-recorded-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
              {outcome === 'accept' ? 'Allocation accepted' : 'Allocation declined'}
            </h2>
            <StatusBadge status={statusLabel(detail.status)} />
          </div>

          <div className="mt-4">
            <Alert type="success">
              {outcome === 'accept'
                ? `Your acceptance of ${formatKg(detail.agreedKg)} of ${detail.cropName} for ${detail.buyerName} has been recorded.`
                : `Your decline of ${formatKg(detail.agreedKg)} of ${detail.cropName} for ${detail.buyerName} has been recorded.`}
            </Alert>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
            <Field label="CURRENT STATUS" value={statusLabel(detail.status)} />
            <Field label="YOUR DECISION" value={outcome === 'accept' ? 'Accepted' : 'Declined'} />
            <Field
              label="RESERVATION"
              value={detail.reservationStatus ? statusLabel(detail.reservationStatus) : 'No active hold'}
            />
            <Field label="TOTAL VALUE" value={formatLkrCents(detail.agreedValueCents)} />
          </div>

          <div className="mt-4">
            <Alert type="info">
              {outcome === 'accept'
                ? 'The stock reservation stays active until the buyer confirms the overall order; no wallet settlement happens here.'
                : 'Reserved stock released and allocation marked as declined.'}
            </Alert>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {backButton}
            <Link
              to={INBOX_PATH}
              className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Allocation Inbox
            </Link>
          </div>
        </section>
      )}

      {/* 4b. Decision options + confirmation (only while no decision exists
          and the server still says a response is possible). */}
      {!outcome && detail.canRespond && (
        <section
          className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
          aria-labelledby="decision-options-heading"
        >
          <h2 id="decision-options-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
            Choose your response
          </h2>
          <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
            Acceptance confirms your supply agreement; declining releases the reserved stock.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <button
              type="button"
              aria-pressed={choice === 'accept'}
              disabled={submitting}
              onClick={() => selectChoice('accept')}
              className={`${optionClass(choice === 'accept')} ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span className="text-sm font-semibold text-[var(--text)]">Accept Allocation</span>
              <p className="text-xs text-[var(--muted)] mt-1">
                Confirm that you can supply {formatKg(detail.agreedKg)} of {detail.cropName}.
              </p>
            </button>
            <button
              type="button"
              aria-pressed={choice === 'decline'}
              disabled={submitting}
              onClick={() => selectChoice('decline')}
              className={`${optionClass(choice === 'decline')} ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span className="text-sm font-semibold text-[var(--text)]">Decline Allocation</span>
              <p className="text-xs text-[var(--muted)] mt-1">
                Decline this request and release the reserved stock.
              </p>
            </button>
          </div>

          {/* Acceptance panel */}
          {choice === 'accept' && (
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--canvas)] p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base md:text-lg font-bold text-[var(--text)]">
                  Confirm Allocation Acceptance
                </h3>
                <span className="ym-status ym-tone--success">SELECTION: ACCEPT</span>
              </div>

              <p className="text-sm text-[var(--text)] mt-3">
                You are agreeing to supply {formatKg(detail.agreedKg)} of {detail.cropName} (
                {detail.gradeName}) at the agreed price of {formatLkrCents(detail.agreedUnitPriceCents)}/kg.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <Field label="ALLOCATED QUANTITY" value={formatKg(detail.agreedKg)} />
                <Field label="TOTAL VALUE" value={formatLkrCents(detail.agreedValueCents)} />
                {detail.batchDisplayId && <Field label="BATCH" value={detail.batchDisplayId} />}
                <Field label="BUYER" value={detail.buyerName} />
              </div>

              <label className="flex items-start gap-2.5 mt-4 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={submitting}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent-text)]"
                />
                <span>
                  I have reviewed the allocation details and confirm I can supply the requested quantity.
                </span>
              </label>

              <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
                <Info size={16} className="shrink-0" aria-hidden="true" />
                <span>
                  Acceptance records your supply agreement. The buyer must confirm the overall order; no wallet
                  settlement occurs here.
                </span>
              </div>
            </div>
          )}

          {/* Decline panel */}
          {choice === 'decline' && (
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--canvas)] p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base md:text-lg font-bold text-[var(--text)]">
                  Confirm Allocation Decline
                </h3>
                <span className="ym-status ym-tone--error">SELECTION: DECLINE</span>
              </div>

              <p className="text-sm text-[var(--text)] mt-3">
                You are about to decline this request for {formatKg(detail.agreedKg)} of {detail.cropName} to{' '}
                {detail.buyerName}.
              </p>

              <ul className="text-sm text-[var(--muted)] mt-3 space-y-1.5 list-disc pl-5">
                <li>Your allocation will not be accepted.</li>
                <li>Reserved stock will be released.</li>
                <li>The buyer will be informed.</li>
              </ul>

              <div className="mt-4">
                <label
                  htmlFor="decline-reason"
                  className="block text-xs font-semibold tracking-wider text-[var(--muted)] uppercase"
                >
                  Allocation decision reason
                </label>
                <textarea
                  id="decline-reason"
                  value={reason}
                  disabled={submitting}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={MAX_DECISION_REASON_LENGTH}
                  rows={3}
                  placeholder="Choose a reason, e.g. need to meet existing orders."
                  className="mt-1.5 w-full rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm p-3 placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)] disabled:opacity-60"
                />
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  Required, 1–{MAX_DECISION_REASON_LENGTH} characters. {reason.length}/{MAX_DECISION_REASON_LENGTH}
                </p>
              </div>

              <div className="mt-4">
                <Alert type="error">
                  Declining removes the temporary stock reservation, and the buyer will be informed.
                </Alert>
              </div>
            </div>
          )}

          {/* Confirmation summary + actions */}
          {choice && (
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">
                Final confirmation is only available after acknowledgement and while reservation validity remains.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {backButton}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={submitting}
                    onClick={() => {
                      setChoice(null);
                      setFailure(null);
                    }}
                  >
                    Cancel
                  </Button>
                  {choice === 'accept' ? (
                    <Button
                      variant="primary"
                      disabled={submitting || !acknowledged}
                      onClick={submitDecision}
                      title={!acknowledged ? 'Tick the acknowledgement first' : undefined}
                    >
                      {submitting ? 'Accepting…' : 'Confirm Acceptance →'}
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      disabled={submitting || !reasonValid}
                      onClick={submitDecision}
                      title={!reasonValid ? 'Enter a valid reason first' : undefined}
                    >
                      {submitting ? 'Declining…' : 'Confirm Decline →'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Alert type="info">
                  The server re-checks eligibility when you confirm: your response is only recorded if the
                  allocation is still awaiting your decision.
                </Alert>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. Reservation status */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="reservation-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="reservation-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
              Reservation status
            </h2>
            <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
              {outcome
                ? 'Reservation state after your decision, as reported by the server.'
                : 'The stock stays reserved while your decision is reviewed.'}
            </p>
          </div>
          {detail.reservationStatus ? (
            <StatusBadge status={statusLabel(detail.reservationStatus)} />
          ) : (
            <span className="ym-status ym-tone--neutral">No active hold</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
          <Field
            label="RESERVED QUANTITY"
            value={detail.reservationHeldKg ? formatKg(detail.reservationHeldKg) : '—'}
          />
          <Field label="ALLOCATION CREATED" value={formatColomboDateTime(detail.createdAt)} />
          <Field label="RESERVATION EXPIRY" value={formatColomboDateTime(detail.reservationExpiresAt)} />
          <Field label="RESPONSE WINDOW" value={windowText ?? '—'} />
        </div>

        <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
          <Info size={16} className="shrink-0" aria-hidden="true" />
          <span>
            {outcome
              ? 'Figures above are reported by the server after your decision was recorded.'
              : 'Review the decision carefully before confirming. No response is recorded until final confirmation.'}
          </span>
        </div>

        <p className="text-[11px] text-[var(--muted)] mt-3">
          Times are shown in Asia/Colombo. Whether a response is possible is decided by the server using its own
          clock.
        </p>
      </section>
    </div>
  );
}
