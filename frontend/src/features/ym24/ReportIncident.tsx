import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import './DeliveryHistory.css'; // shared page styles
import './DeliveryDetails.css'; // back link
import './DeliveryHandover.css'; // upload area
import './ReportIncident.css';

type TripStatus = 'Completed' | 'Partially accepted' | 'Disputed';

interface TripOption {
  id: string;
  destination: string;
  pickedUpKg: number;
  handedOverKg: number;
  acceptedKg: number;
  status: TripStatus;
  allocations: { farm: string; kg: number }[];
}

// Demo data for now. Replaced with API data after the backend endpoint is ready.
const trips: TripOption[] = [
  {
    id: '1041', destination: 'Kandy', pickedUpKg: 600, handedOverKg: 600, acceptedKg: 580, status: 'Partially accepted',
    allocations: [{ farm: 'Green Valley Farm', kg: 400 }, { farm: 'Highland Harvest', kg: 200 }],
  },
  {
    id: '1039', destination: 'Galle', pickedUpKg: 350, handedOverKg: 350, acceptedKg: 0, status: 'Disputed',
    allocations: [{ farm: 'Hill Country Farm', kg: 350 }],
  },
  {
    id: '1034', destination: 'Colombo', pickedUpKg: 500, handedOverKg: 500, acceptedKg: 500, status: 'Completed',
    allocations: [{ farm: 'Lakeside Farm', kg: 500 }],
  },
];

const incidentTypes = [
  'Spoilage',
  'Short quantity at pickup',
  'Refused load at handover',
  'Delay',
  'Packaging damage',
];

const recentIncidents = [
  { id: 'INC-0031', label: 'Spoilage', status: 'Open' },
  { id: 'INC-0029', label: 'Refused load', status: 'Under review' },
  { id: 'INC-0026', label: 'Short quantity', status: 'Resolved' },
];

const statusClass: Record<string, string> = {
  Open: 'ym-tone--error',
  'Under review': 'ym-tone--warning',
  Resolved: 'ym-tone--success',
  Completed: 'ym-tone--success',
  'Partially accepted': 'ym-tone--warning',
  Disputed: 'ym-tone--error',
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 500;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmtKg = (n: number) => `${round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function validateQty(raw: string, max?: number): string | undefined {
  const value = raw.trim();
  if (value === '') return 'Enter the affected quantity in kg.';
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Use a number with up to 3 decimals.';
  const n = Number(value);
  if (n <= 0) return 'Quantity must be more than 0.';
  if (max !== undefined && n > max) return `Quantity cannot exceed the allocation (${fmtKg(max)}).`;
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

// Demo only: the real version will POST the report to the API and reject on network errors.
async function submitIncident(): Promise<{ id: string }> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { id: 'INC-0032' };
}



export default function ReportIncident() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTrip = trips.find((t) => t.id === params.get('trip'))?.id ?? trips[0].id;

  const [type, setType] = useState('');
  const [tripId, setTripId] = useState(initialTrip);
  const [allocationFarm, setAllocationFarm] = useState('');
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'success'; id: string } | { kind: 'error' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const trip = trips.find((t) => t.id === tripId) ?? trips[0];
  const allocation = trip.allocations.find((a) => a.farm === allocationFarm);

  const typeError = submitted && type === '' ? 'Choose an incident type.' : undefined;
  const allocationError = submitted && !allocation ? 'Choose the allocation affected.' : undefined;
  const qtyError = submitted ? validateQty(qty, allocation?.kg) : undefined;
  const descriptionError = submitted ? validateDescription(description) : undefined;
  const fileError = file ? validateFile(file) : undefined;

  const checks = [
    { text: 'Choose the right trip and allocation.', done: allocation !== undefined },
    { text: 'Enter the affected quantity in kg', done: qty.trim() !== '' && !validateQty(qty, allocation?.kg) },
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
    setAllocationFarm('');
    setQty('');
    setDescription('');
    setSubmitted(false);
    chooseFile(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setResult(null);
    const invalid =
      type === '' ||
      !allocation ||
      validateQty(qty, allocation.kg) ||
      validateDescription(description) ||
      (file && validateFile(file));
    if (invalid) return;

    setBusy(true);
    try {
      const created = await submitIncident();
      setResult({ kind: 'success', id: created.id });
      resetForm();
    } catch {
      setResult({ kind: 'error' }); // answers are kept so the driver can retry
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
          <span className="ym24-demo-tag">DEMO DASHBOARD</span>
          <span className="ym24-date-note">02 NOV 2026</span>
        </div>
      </div>

      <div className="ym24-panel">
        <h3>Selected trip</h3>
        <p className="ym24-panel-sub">YM {trip.id} • {trip.destination}</p>
        <div className="ym24-trip-facts">
          <div><span>Picked up</span><strong>{fmtKg(trip.pickedUpKg)}</strong></div>
          <div><span>Handed over</span><strong>{fmtKg(trip.handedOverKg)}</strong></div>
          <div><span>Accepted</span><strong>{fmtKg(trip.acceptedKg)}</strong></div>
          <div><span>Status</span><span className={`ym-status ${statusClass[trip.status]}`}>{trip.status}</span></div>
        </div>
      </div>

      <div className="ym24-row">
        <form className="ym24-panel" onSubmit={handleSubmit} noValidate>
          <h3>Incident details</h3>
          <div className="ym24-form">
            <div className="ym24-form-grid">
                <SelectField
                label="Incident type"
                value={type}
                options={[{ value: '', label: 'Select a type' }, ...incidentTypes.map((t) => ({ value: t, label: t }))]}
                error={typeError}
                disabled={busy}
                onChange={(e) => setType(e.target.value)}
              />
              <SelectField
                label="Related trip"
                value={tripId}
                options={trips.map((t) => ({ value: t.id, label: `YM ${t.id} • ${t.destination}` }))}
                disabled={busy}
                onChange={(e) => {
                  setTripId(e.target.value);
                  setAllocationFarm('');
                }}
              />
            </div>

            <div className="ym24-form-grid">
                <SelectField
                label="Allocation"
                value={allocationFarm}
                options={[
                  { value: '', label: 'Select an allocation' },
                  ...trip.allocations.map((a) => ({ value: a.farm, label: `${a.farm} · ${a.kg} kg` })),
                ]}
                error={allocationError}
                disabled={busy}
                onChange={(e) => setAllocationFarm(e.target.value)}
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
                className={`ym24-upload ${dragOver ? 'ym24-upload--drag' : ''}`}
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
              <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</Button>
            </div>
          </div>
        </form>

        <div className="ym24-stack">
          <div className="ym24-panel">
            <h3>Before you submit</h3>
            <ul className="ym24-checks">
              {checks.map((c) => (
                <li key={c.text}>
                  <span className={`ym24-tick ${c.done ? 'ym24-tick--done' : ''}`} aria-hidden="true">✓</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ym24-panel">
            <h3>Recent incidents</h3>
            {recentIncidents.map((i) => (
              <div className="ym24-recent" key={i.id}>
                <p>{i.id} · {i.label}</p>
                <span className={`ym-status ${statusClass[i.status]}`}>{i.status}</span>
              </div>
            ))}
          </div>

          {result?.kind === 'success' && (
            <Alert type="success">
              <strong>Report submitted.</strong> {result.id} is now Open and visible to the admin team.
            </Alert>
          )}
          {result?.kind === 'error' && (
            <Alert type="error">
              <strong>Could not submit.</strong> Your report has not been saved. Check your connection and try again. Your answers are kept.
            </Alert>
          )}
        </div>
      </div>
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
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ym24-counter">{value.length}/{MAX_DESCRIPTION}</div>
      {error && <p className="ym-field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}