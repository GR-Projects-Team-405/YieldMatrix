import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Table, TableRow } from '../../components/Table';
import { getApiErrorMessage, getTraceHistory, formatTraceDate, formatTraceQuantity, formatTraceTimestamp, type TraceHistoryResponse } from './api';

function getEventLabel(eventType: string) {
  return eventType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEventTone(eventType: string) {
  if (eventType === 'acceptance' || eventType === 'handover') return 'ym-tone--success';
  if (eventType === 'pickup') return 'ym-tone--info';
  return 'ym-tone--neutral';
}

function getPublicLocation(payload: Record<string, unknown> | undefined, district: string) {
  const value = payload?.district ?? payload?.locality;
  return typeof value === 'string' && value.trim() ? value : district;
}

export default function BatchTraceHistory() {
  const { batchId = '' } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [history, setHistory] = useState<TraceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTraceHistory(batchId, controller.signal)
      .then(({ data }) => setHistory(data))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [batchId]);

  return (
    <div className="space-y-5">
      <Link to="../.." relative="path" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-text)] hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Back To Trace Records
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Batch Trace History</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Trace events and custody history for batch {history?.batch.displayId || batchId}.</p>
      </header>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]" role="status">
          Loading batch history…
        </div>
      ) : history ? (
        <>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Batch Summary</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{history.batch.displayId}</p>
              </div>
              <span className="ym-status ym-tone--neutral">{getEventLabel(history.batch.status)}</span>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Produce / Grade', `${history.batch.produce} · ${history.batch.grade}`],
                ['Farm Origin', history.batch.farm],
                ['District', history.batch.district],
                ['Harvest Date', formatTraceDate(history.batch.harvestDate)],
                ['Quantity', formatTraceQuantity(history.batch.quantityKg)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[var(--canvas)] p-3">
                  <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-4 py-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Trace &amp; Custody Events</h2>
            </div>
            {history.events.length > 0 ? (
              <Table headers={['Event Timestamp', 'Record', 'Location', 'Quantity', 'Event']}>
                {history.events.map((event) => (
                  <TableRow key={`${event.source}-${event.id}`}>
                    <td className="whitespace-nowrap text-sm text-[var(--text)]">{formatTraceTimestamp(event.occurredAt)}</td>
                    <td className="text-sm text-[var(--text)]">{event.source === 'trace' ? 'Trace record' : 'Custody record'}</td>
                    <td className="text-sm text-[var(--text)]">{getPublicLocation(event.publicPayload, history.batch.district)}</td>
                    <td className="text-sm text-[var(--text)]">{event.quantityKg ? formatTraceQuantity(event.quantityKg) : '—'}</td>
                    <td><span className={`ym-status ${getEventTone(event.eventType)}`}>{getEventLabel(event.eventType)}</span></td>
                  </TableRow>
                ))}
              </Table>
            ) : (
              <p className="p-5 text-sm text-[var(--muted)]">No trace or custody events have been recorded for this batch.</p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="font-semibold text-[var(--text)]">Batch QR Code</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Open the QR preview for this batch.</p>
              </div>
              <Button variant="primary" onClick={() => navigate(`../../preview/${encodeURIComponent(history.batch.displayId)}`, { relative: 'path' })}>
                <QrCode size={16} aria-hidden="true" /> QR Preview
              </Button>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-semibold text-[var(--text)]">Verification</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Inspect trace event fingerprints and anchoring status.</p>
              <Button variant="outline" className="mt-3" onClick={() => navigate(`../../verify/${encodeURIComponent(history.batch.displayId)}`, { relative: 'path' })}>
                View Verification Details
              </Button>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
