import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Database } from 'lucide-react';
import { ContentCard } from '../../components/ContentCard';
import tomatoImage from './Assets/Tomato.png';
import { INITIAL_RECORDS } from './TraceRecords';

const JOURNEY_CHECKS = [
  { label: 'Farm Record Verified', timestamp: '28 Oct 2026, 08:30 AM' },
  { label: 'Transport Verified', timestamp: '28 Oct 2026, 11:00 AM' },
  { label: 'Delivery Confirmed', timestamp: '29 Oct 2026, 10:15 AM' },
];

export default function VerificationDetails() {
  const { batchId } = useParams<{ batchId: string }>();
  const batch = INITIAL_RECORDS.find((record) => record.id === batchId);

  if (!batch) {
    return (
      <div className="space-y-5">
        <Link to="../.." relative="path" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-text)] hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Back To Trace Records
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Verification Details</h1>
        <ContentCard>
          <p className="text-sm text-[var(--muted)]">No trace record was found for batch {batchId}.</p>
        </ContentCard>
      </div>
    );
  }

  const recordId = `YM25-${batch.id.slice(-3).padStart(5, '0')}-7F3A`;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link to="../.." relative="path" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-text)] hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Back To Trace Records
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Verification Details</h1>
        <p className="text-sm text-[var(--muted)]">Complete details about this batch's authenticity and journey.</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
        <div className="space-y-3">
          <section className="flex items-center gap-4 rounded-xl border border-emerald-700/10 bg-emerald-50 px-5 py-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check size={30} strokeWidth={3} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight">This batch is authentic!</h2>
              <p className="mt-1 text-sm">Verified by YieldMatrix · 29 Oct 2026, 10:45 AM</p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-[1.15fr_0.85fr]">
            <ContentCard title="Batch Information" className="!p-4">
              <dl className="space-y-3 text-sm">
                {[
                  ['Batch ID', batch.id],
                  ['Produce', batch.produce],
                  ['Farm', batch.farm],
                  ['Harvest Date', batch.harvestDate],
                  ['Quantity', batch.quantity],
                  ['Grade', 'A+'],
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
              <ul className="space-y-4">
                {JOURNEY_CHECKS.map(({ label, timestamp }) => (
                  <li key={label} className="flex items-start gap-3">
                    <CheckCircle2 size={21} className="mt-0.5 shrink-0 fill-emerald-600 text-white" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{timestamp}</p>
                    </div>
                  </li>
                ))}
              </ul>
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
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">Record ID: {recordId}</p>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-[var(--muted)]">Last Updated: 29 Oct 2026, 10:45 AM</p>
                <span className="ym-status ym-tone--success mt-2">Verified</span>
              </div>
            </div>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
              Demonstration verification data — live blockchain verification is not connected.
            </p>
          </section>
        </div>

        <img
          src={tomatoImage}
          alt="From our farms to your table with trust"
          className="mx-auto w-full max-w-[280px] rounded-xl object-cover min-[960px]:max-w-none"
        />
      </div>
    </div>
  );
}
