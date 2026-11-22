import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Database } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { ContentCard } from '../../components/ContentCard';
import { getApiErrorMessage, getTraceVerification, formatTraceDate, formatTraceQuantity, formatTraceTimestamp, type VerificationResponse } from './api';
import tomatoImage from './Assets/Tomato.png';

function getStatusLabel(status: VerificationResponse['verification']['status']) {
  switch (status) {
    case 'verified': return 'Live verified';
    case 'demo': return 'Demonstration only';
    case 'pending': return 'Verification pending';
    case 'failed': return 'Verification failed';
    default: return 'Verification unavailable';
  }
}

function getEventLabel(eventType: string) {
  return eventType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAnchorTone(status: string) {
  if (status === 'verified') return 'ym-tone--success';
  if (status === 'failed') return 'ym-tone--error';
  if (status === 'pending') return 'ym-tone--info';
  return 'ym-tone--neutral';
}

export default function VerificationDetails() {
  const { batchId = '' } = useParams<{ batchId: string }>();
  const [data, setData] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTraceVerification(batchId, controller.signal)
      .then(({ data: response }) => setData(response))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [batchId]);

  const verified = data?.verification.status === 'verified';
  const statusTone = verified ? 'ym-tone--success' : 'ym-tone--neutral';

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link to="../.." relative="path" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-text)] hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Back To Trace Records
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Verification Details</h1>
        <p className="text-sm text-[var(--muted)]">Trace event fingerprints and anchoring status for this batch.</p>
      </header>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]" role="status">
          Loading verification details…
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
          <div className="space-y-3">
            <section className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${verified ? 'border-emerald-700/10 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'}`}>
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${verified ? 'bg-emerald-600' : 'bg-[var(--muted)]'}`}>
                {verified ? <Check size={30} strokeWidth={3} aria-hidden="true" /> : <Database size={24} aria-hidden="true" />}
              </span>
              <div>
                <h2 className="text-lg font-bold leading-tight">{verified ? 'This batch is authentic!' : getStatusLabel(data.verification.status)}</h2>
                <p className="mt-1 text-sm">
                  {data.verification.isLiveVerification
                    ? `Verified by YieldMatrix · ${data.verification.lastUpdatedAt ? formatTraceTimestamp(data.verification.lastUpdatedAt) : 'timestamp unavailable'}`
                    : 'No live blockchain verification is claimed for this record.'}
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-[1.15fr_0.85fr]">
              <ContentCard title="Batch Information" className="!p-4">
                <dl className="space-y-3 text-sm">
                  {[
                    ['Batch ID', data.batch.displayId],
                    ['Produce', data.batch.produce],
                    ['Farm', data.batch.farm],
                    ['Harvest Date', formatTraceDate(data.batch.harvestDate)],
                    ['Quantity', formatTraceQuantity(data.batch.quantityKg)],
                    ['Grade', data.batch.grade],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[96px_10px_minmax(0,1fr)] items-start gap-2">
                      <dt className="text-[var(--muted)]">{label}</dt>
                      <span aria-hidden="true" className="text-[var(--muted)]">:</span>
                      <dd className="font-medium text-[var(--text)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </ContentCard>

              <ContentCard title="Journey Verification" className="!p-4">
                {data.events.length ? (
                  <ul className="space-y-4">
                    {data.events.map((event) => (
                      <li key={event.id} className="flex items-start gap-3">
                        <CheckCircle2 size={21} className={`mt-0.5 shrink-0 ${event.anchorStatus === 'verified' && !event.localDemo ? 'fill-emerald-600 text-white' : 'text-[var(--muted)]'}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)]">{getEventLabel(event.eventType)}</p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{formatTraceTimestamp(event.occurredAt)}</p>
                          <span className={`ym-status mt-1 ${getAnchorTone(event.localDemo ? 'demo' : event.anchorStatus ?? 'unavailable')}`}>
                            {event.localDemo ? 'Demo record' : getStatusLabel(event.anchorStatus === 'verified' ? 'verified' : event.anchorStatus === 'failed' ? 'failed' : event.anchorStatus === 'pending' ? 'pending' : 'unavailable')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No trace verification events are available.</p>
                )}
              </ContentCard>
            </div>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--soft)] text-[var(--accent-text)]">
                    <Database size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">Blockchain-linked Record</h2>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      {data.verification.eventCount} trace event{data.verification.eventCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-[var(--muted)]">
                    Last Updated: {data.verification.lastUpdatedAt ? formatTraceTimestamp(data.verification.lastUpdatedAt) : 'Not available'}
                  </p>
                  <span className={`ym-status mt-2 ${statusTone}`}>{getStatusLabel(data.verification.status)}</span>
                </div>
              </div>
              {data.events.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                  {data.events.map((event) => (
                    <li key={event.id} className="break-all text-xs text-[var(--muted)]">
                      <span className="font-medium text-[var(--text)]">{getEventLabel(event.eventType)}:</span> {event.payloadHash}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                Verification state reflects recorded anchor metadata. It does not independently validate the original batch claims.
              </p>
            </section>
          </div>

          <img
            src={tomatoImage}
            alt="From our farms to your table with trust"
            className="mx-auto w-full max-w-[280px] rounded-xl object-cover min-[960px]:max-w-none"
          />
        </div>
      ) : null}
    </div>
  );
}
