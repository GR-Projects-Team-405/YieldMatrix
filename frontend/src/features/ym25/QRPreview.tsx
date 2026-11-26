import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, Info } from 'lucide-react';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import QRCodeGraphic, { createQrMatrix } from '../../components/QRCodeGraphic';
import { getApiErrorMessage, getTraceHistory, formatTraceDate, formatTraceQuantity, type TraceBatchDto } from './api';
import { Alert } from '../../components/Alert';

const getStatusToneClass = (status: string) => {
  switch (status) {
    case 'harvested':
    case 'delivered':
    case 'closed':
      return 'ym-tone--success';
    case 'ready':
    case 'in_fulfilment':
      return 'ym-tone--info';
    default:
      return 'ym-tone--neutral';
  }
};

export default function QRPreview() {
  const { batchId = '' } = useParams<{ batchId: string }>();
  const [record, setRecord] = useState<TraceBatchDto | null>(null);
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTraceHistory(batchId, controller.signal)
      .then(({ data }) => setRecord(data.batch))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [batchId]);

  useEffect(() => {
    try {
      setMatrix(createQrMatrix(window.location.href));
      setQrError(null);
    } catch (error) {
      setMatrix(null);
      setQrError(error instanceof Error ? error.message : 'Unable to generate the batch QR code.');
    }
  }, [batchId]);

  const downloadQrCode = () => {
    if (!qrRef.current || !record) return;
    const svg = new XMLSerializer().serializeToString(qrRef.current);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.displayId}-qr.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link to="../.." relative="path" className="inline-flex items-center gap-2 text-sm font-medium text-[#315A42] hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Back To Trace Records
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text)]">QR Preview</h1>
        <p className="text-sm text-[var(--muted)]">Preview the QR code for this batch's authenticity and traceability information.</p>
      </header>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <ContentCard><p className="text-sm text-[var(--muted)]">Loading batch QR information…</p></ContentCard>
      ) : !record ? (
        <ContentCard>
          <p className="text-sm text-[var(--muted)]">Batch information is unavailable.</p>
        </ContentCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 min-[960px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ContentCard className="flex min-h-[410px] flex-col items-center justify-center text-center">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Batch QR Code</p>
            <div className="mb-4 aspect-square w-52 max-w-full">
              {matrix && <QRCodeGraphic ref={qrRef} matrix={matrix} label={`QR code for batch ${record.displayId}`} />}
              {qrError && <p role="alert" className="text-sm text-red-700">{qrError}</p>}
            </div>
            <p className="font-semibold text-[var(--text)]">Batch ID: {record.displayId}</p>
            <p className="mt-1 text-sm text-[var(--accent-text)]">Produce: {record.produce}</p>
            <Button
              onClick={downloadQrCode}
              disabled={!matrix}
              className="mt-5 min-w-56 !rounded-lg"
            >
              <ArrowDownToLine size={17} aria-hidden="true" />
              Download QR Code
            </Button>
          </ContentCard>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <header className="bg-[var(--soft)] px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">QR Information</h2>
              </header>
              <dl className="px-5">
                {[
                  ['Batch ID', record.displayId],
                  ['Farm', record.farm],
                  ['Harvest Date', formatTraceDate(record.harvestDate)],
                  ['Quantity', formatTraceQuantity(record.quantityKg)],
                ].map(([label, value]) => (
                  <div key={label} className="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] items-center gap-3 border-b border-[var(--border)] py-2 text-sm">
                    <dt className="text-[var(--muted)]">{label}</dt>
                    <dd className="font-semibold text-[var(--text)]">{value}</dd>
                  </div>
                ))}
                <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] items-center gap-3 border-b border-[var(--border)] py-2 text-sm">
                  <dt className="text-[var(--muted)]">Status</dt>
                  <dd><span className={`ym-status ${getStatusToneClass(record.status)}`}>{record.status}</span></dd>
                </div>
              </dl>
            </section>

            <aside className="flex min-h-24 items-center gap-2 rounded-lg bg-[var(--soft)] px-4 py-4 text-sm font-medium text-[var(--accent-text)]">
              <Info size={16} className="shrink-0" aria-hidden="true" />
              <p>This QR code links to this batch’s traceability preview. Verification status is shown separately.</p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}