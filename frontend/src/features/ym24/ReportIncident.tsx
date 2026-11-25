import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { createIncident, errorMessage, getDeliveries, getDelivery, getIncidents } from './ym24Api';
import type { DeliveryDetail, DeliveryRow, IncidentRow, IncidentType } from './ym24Api';
import './DeliveryHistory.css'; // shared page styles
import './DeliveryDetails.css'; // back link
import './DeliveryHandover.css'; // upload area
import './ReportIncident.css';

const incidentTypes: { value: IncidentType; label: string }[] = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'short_quantity', label: 'Short quantity at pickup' },
  { value: 'refused_load', label: 'Refused load at handover' },
  { value: 'delay', label: 'Delay' },
  { value: 'packaging', label: 'Packaging damage' },
  { value: 'other', label: 'Other' },
];
const typeShort: Record<IncidentType, string> = {
  spoilage: 'Spoilage',
  short_quantity: 'Short quantity',
  refused_load: 'Refused load',
  delay: 'Delay',
  packaging: 'Packaging',
  other: 'Other',
};

const statusClass: Record<string, string> = {
  open: 'ym-tone--error',
  under_review: 'ym-tone--warning',
  resolved: 'ym-tone--success',
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};
const statusLabel: Record<string, string> = { open: 'Open', under_review: 'Under review', resolved: 'Resolved' };

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 500;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmtKg = (n: number) => round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' kg';
const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';

// One key per report, so a double click or a retry never saves the same report twice.
function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'ym24-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function validateQty(raw: string, max?: number): string | undefined {
  const value = raw.trim();
  if (value === '') return 'Enter the affected quantity in kg.';
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Use a number with up to 3 decimals.';
  const n = Number(value);
  if (n <= 0) return 'Quantity must be more than 0.';
  if (max !== undefined && n > max) return 'Quantity cannot exceed the allocation (' + fmtKg(max) + ').';
  return undefined;
}

function validateDescription(raw: string): string | undefined {
  if (raw.trim().length < 10) return 'Describe what happened (at least 10 characters).';
  return undefined;
}

function validateFile(file: File): string | undefined {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPEG, PNG or PDF file.';
  if (file.size > MAX_BYTES) return 'The file must be 5 MB or smaller.';
  return undefined;
}

export default function ReportIncident() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wantedTrip = params.get('trip');

  const [trips, setTrips] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tripId, setTripId] = useState('');
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [recent, setRecent] = useState<IncidentRow[]>([]);

  const [type, setType] = useState<IncidentType | ''>('');
  const [allocationId, setAllocationId] = useState('');
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'success'; code: string } | { kind: 'error'; message: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const keyRef = useRef<string>(newKey());

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await getIncidents()).slice(0, 3));
    } catch {
      // The recent list is optional, the form still works without it.
    }
  }, []);

  // 1. The driver's trips
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getDeliveries();
        if (cancelled) return;
        setTrips(rows);
        setTripId(rows.find((r) => r.id === wantedTrip)?.id ?? rows[0]?.id ?? '');
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, 'Could not load your trips.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wantedTrip]);

  // 2. The selected trip with its allocations
  useEffect(() => {
    if (!tripId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    getDelivery(tripId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(errorMessage(e, 'Could not load this trip.')); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [tripId]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  const allocations = detail ? detail.allocations : [];
  const allocation = allocations.find((a) => a.id === allocationId);
  const pickedUpKg = round3(allocations.reduce((sum, a) => sum + a.pickedUpKg, 0));
  const acceptedKg = round3(allocations.reduce((sum, a) => sum + a.acceptedKg, 0));

  const typeError = submitted && type === '' ? 'Choose an incident type.' : undefined;
  const allocationError = submitted && !allocation ? 'Choose the allocation affected.' : undefined;
  const qtyError = submitted ? validateQty(qty, allocation?.pickedUpKg) : undefined;
  const descriptionError = submitted ? validateDescription(description) : undefined;
  const fileError = file ? validateFile(file) : undefined;

  const checks = [
    { text: 'Choose the right trip and allocation.', done: allocation !== undefined },
    { text: 'Enter the affected quantity in kg', done: qty.trim() !== '' && !validateQty(qty, allocation?.pickedUpKg) },
    { text: 'Add a photo or PDF (up to 5 MB).', done: file !== null && !fileError },
  ];

  function chooseFile(next: File | null) {
    setFile(next);
    if (!next && fileInput.current) fileInput.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function resetForm() {
    setType('');
    setAllocationId('');
    setQty('');
    setDescription('');
    setSubmitted(false);
    chooseFile(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setResult(null);
    if (type === '' || !allocation) return;
    if (validateQty(qty, allocation.pickedUpKg)) return;
    if (validateDescription(description)) return;
    if (file && validateFile(file)) return;

    setBusy(true);
    try {
      const created = await createIncident({
        tripId,
        allocationId: allocation.id,
        type,
        quantityKg: Number(qty.trim()),
        description: description.trim(),
        evidence: file ? [{ name: file.name, type: file.type, size: file.size }] : [],
        operationKey: keyRef.current,
      });
      setResult({ kind: 'success', code: created.code });
      keyRef.current = newKey();
      resetForm();
      void loadRecent();
    } catch (e) {
      // The answers and the key are kept so the driver can retry safely.
      setResult({ kind: 'error', message: errorMessage(e, 'Your report has not been saved. Check your connection and try again.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <Link className="ym24-back" to="/driver/incidents">← Back to incidents</Link>
          <p>Tell us what went wrong. Your report is saved to the trip record.</p>
        </div>
      </div>

      {loading && <div className="ym24-panel ym24-empty">Loading your trips…</div>}

      {!loading && loadError && <Alert type="error">{loadError}</Alert>}

      {!loading && !loadError && trips.length === 0 && (
        <div className="ym24-panel ym24-empty">You have no trips to report an incident on yet.</div>
      )}

      {!loading && !loadError && trips.length > 0 && (
        <>
          <div className="ym24-panel">
            <h3>Selected trip</h3>
            {detailLoading && <p className="ym24-panel-sub">Loading trip…</p>}
            {detailError && <Alert type="error">{detailError}</Alert>}
            {detail && !detailLoading && (
              <>
                <p className="ym24-panel-sub">{detail.code} • {detail.destination}</p>
                <div className="ym24-trip-facts">
                  <div><span>Picked up</span><strong>{fmtKg(pickedUpKg)}</strong></div>
                  <div><span>Handed over</span><strong>{fmtKg(detail.handedOverKg)}</strong></div>
                  <div><span>Accepted</span><strong>{fmtKg(acceptedKg)}</strong></div>
                  <div><span>Status</span><span className={'ym-status ' + statusClass[detail.status]}>{detail.status}</span></div>
                </div>
              </>
            )}
          </div>

          <div className="ym24-row">
            <form className="ym24-panel" onSubmit={handleSubmit} noValidate>
              <h3>Incident details</h3>
              <div className="ym24-form">
                <div className="ym24-form-grid">
                  <SelectField
                    label="Incident type"
                    value={type}
                    options={[{ value: '', label: 'Select a type' }, ...incidentTypes]}
                    error={typeError}
                    disabled={busy}
                    onChange={(e) => setType(e.target.value as IncidentType | '')}
                  />
                  <SelectField
                    label="Related trip"
                    value={tripId}
                    options={trips.map((t) => ({ value: t.id, label: t.code + ' • ' + t.destination }))}
                    disabled={busy}
                    onChange={(e) => {
                      setTripId(e.target.value);
                      setAllocationId('');
                    }}
                  />
                </div>

                <div className="ym24-form-grid">
                  <SelectField
                    label="Allocation"
                    value={allocationId}
                    options={[
                      { value: '', label: 'Select an allocation' },
                      ...allocations.map((a) => ({ value: a.id, label: a.farm + ' · ' + a.pickedUpKg + ' kg' })),
                    ]}
                    error={allocationError}
                    disabled={busy || detailLoading}
                    onChange={(e) => setAllocationId(e.target.value)}
                  />
                  <InputField
                    label="Quantity affected"
                    unit="kg"
                    inputMode="decimal"
                    autoComplete="off"
                    value={qty}
                    disabled={busy}
                    error={qtyError}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>

                <DescriptionField
                  value={description}
                  error={descriptionError}
                  disabled={busy}
                  onChange={setDescription}
                />

                <div>
                  <p className="ym24-field-title">Evidence</p>
                  <label
                    className={'ym24-upload ' + (dragOver ? 'ym24-upload--drag' : '')}
                    htmlFor="ym24-evidence"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      id="ym24-evidence"
                      ref={fileInput}
                      className="ym24-file"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      disabled={busy}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <strong>Drag a file here or choose a file</strong>
                    <span>JPEG, PNG or PDF · up to 5 MB</span>
                  </label>
                  {file && (
                    <div className="ym24-file-chip">
                      <p style={{ margin: 0 }}>{file.name}</p>
                      <span>{fmtSize(file.size)}</span>
                      <button type="button" className="ym24-link-btn" onClick={() => chooseFile(null)}>Remove</button>
                    </div>
                  )}
                  {fileError && <p className="ym-field-error" role="alert">{fileError}</p>}
                </div>

                <div className="ym24-actions">
                  <Button variant="outline" disabled={busy} onClick={() => navigate('/driver/incidents')}>Cancel</Button>
                  <Button type="submit" disabled={busy || detailLoading}>{busy ? 'Submitting…' : 'Submit report'}</Button>
                </div>
              </div>
            </form>

            <div className="ym24-stack">
              <div className="ym24-panel">
                <h3>Before you submit</h3>
                <ul className="ym24-checks">
                  {checks.map((c) => (
                    <li key={c.text}>
                      <span className={'ym24-tick ' + (c.done ? 'ym24-tick--done' : '')} aria-hidden="true">✓</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ym24-panel">
                <h3>Recent incidents</h3>
                {recent.length === 0 ? (
                  <p className="ym24-panel-sub">No incidents reported yet.</p>
                ) : (
                  recent.map((i) => (
                    <div className="ym24-recent" key={i.id}>
                      <p>{i.code} · {typeShort[i.type]}</p>
                      <span className={'ym-status ' + statusClass[i.status]}>{statusLabel[i.status]}</span>
                    </div>
                  ))
                )}
              </div>

              {result?.kind === 'success' && (
                <Alert type="success">
                  <strong>Report submitted.</strong> {result.code} is now Open and visible to the admin team.
                </Alert>
              )}
              {result?.kind === 'error' && (
                <Alert type="error">
                  <strong>Could not submit.</strong> {result.message} Your answers are kept.
                </Alert>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface DescriptionFieldProps {
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function DescriptionField({ value, error, disabled, onChange }: DescriptionFieldProps) {
  const id = useId();
  return (
    <div className="ym-field">
      <label htmlFor={id}>Description</label>
      <textarea
        id={id}
        className="ym24-textarea"
        value={value}
        maxLength={MAX_DESCRIPTION}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? id + '-error' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ym24-counter">{value.length}/{MAX_DESCRIPTION}</div>
      {error && <p className="ym-field-error" id={id + '-error'}>{error}</p>}
    </div>
  );
}