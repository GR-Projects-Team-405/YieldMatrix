import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InputField } from '../../components/InputField';
import { StatCard } from '../../components/StatCard';
import { Toast } from '../../components/Toast';
import './DeliveryHistory.css'; // shared page styles (panels, stats, rows)
import './DeliveryDetails.css'; // shared bars and record rows
import './DeliveryHandover.css';

// Demo data for now. Replaced with API data after the backend endpoint is ready.
const trip = {
  id: '1041',
  destination: 'Kandy',
  buyer: 'Sunrise Supermarket',
  location: 'Kandy',
  manager: 'N. Perera',
  vehicle: 'WP LO 4811',
  capacityKg: 1500,
  pickedUpKg: 600,
  orderValueCents: 17400000, // integer LKR cents
  windowStart: '2026-11-05T09:30:00Z', // UTC
  windowEnd: '2026-11-05T10:30:00Z',
  handoverAt: '2026-11-05T10:10:00Z',
  pickups: [
    { farm: 'Green Valley Farm', at: '2026-10-31T04:00:00Z', kg: 400 },
    { farm: 'Highland Harvest', at: '2026-10-31T05:30:00Z', kg: 200 },
  ],
};

// Timestamps are stored in UTC and shown in Asia/Colombo.
const TZ = 'Asia/Colombo';
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmtKg = (n: number) => `${round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
const lkr = (cents: number) => `LKR ${(cents / 100).toLocaleString('en-US')}`;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

function validateKg(raw: string, max: number): string | undefined {
  const value = raw.trim();
  if (value === '') return 'Enter the handed-over kg.';
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Use a number with up to 3 decimals.';
  const n = Number(value);
  if (n <= 0) return 'Handed-over kg must be more than 0.';
  if (n > max) return `Handover kg cannot exceed picked-up kg (${fmtKg(max)}).`;
  return undefined;
}

function validateFile(file: File): string | undefined {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPEG, PNG or PDF file.';
  if (file.size > MAX_BYTES) return 'The file must be 5 MB or smaller.';
  return undefined;
}

type StepState = 'done' | 'current' | 'todo';

export default function DeliveryHandover() {
  const navigate = useNavigate();
  const [handedKg, setHandedKg] = useState(String(trip.pickedUpKg));
  const [kgTouched, setKgTouched] = useState(false);
  const [recipient, setRecipient] = useState(`${trip.manager}, Receiving Manager`);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const kgError = kgTouched || submitted ? validateKg(handedKg, trip.pickedUpKg) : undefined;
  const recipientError = submitted && recipient.trim() === '' ? 'Enter the recipient name.' : undefined;
  const fileError = file ? validateFile(file) : undefined;

  const handed = /^\d+(\.\d{1,3})?$/.test(handedKg.trim()) ? Number(handedKg) : 0;
  const over = round3(handed - trip.pickedUpKg);
  const isOver = over > 0;
  const scale = Math.max(trip.pickedUpKg, handed, 1);

  const steps: { label: string; sub: string; state: StepState }[] = [
    { label: 'Pickup', sub: `${trip.pickups.length} farms · ${fmtKg(trip.pickedUpKg)}`, state: 'done' },
    { label: 'In transit', sub: trip.vehicle, state: 'done' },
    { label: 'Handover', sub: confirmed ? 'Recorded' : 'You are here', state: confirmed ? 'done' : 'current' },
    { label: 'Acceptance', sub: confirmed ? 'Awaiting buyer' : 'By buyer', state: confirmed ? 'current' : 'todo' },
  ];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setKgTouched(true);
    if (validateKg(handedKg, trip.pickedUpKg) || recipient.trim() === '' || (file && validateFile(file))) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setBusy(true);
    // Demo only: the real version will send the handover to the API.
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setConfirmOpen(false);
      setConfirmed(true);
      setToastOpen(true);
    }, 700);
  }

  function removeFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <p>Record what you handed over at the destination. Times use {TZ}.</p>
          <span className="ym24-demo-tag">DEMO DASHBOARD</span>
          <span className="ym24-date-note">05 NOV 2026</span>
        </div>
        <span className="ym24-pill">Trip YM {trip.id} • {trip.destination}</span>
      </div>

      <div className="ym24-panel">
        <ol className="ym24-stepper">
          {steps.map((step, i) => (
            <li key={step.label} className={`ym24-step ym24-step--${step.state}`}>
              <span className="ym24-step-dot" aria-hidden="true">{step.state === 'done' ? '✓' : i + 1}</span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.sub}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="ym24-stats">
        <StatCard label="Picked up" value={fmtKg(trip.pickedUpKg)} subtext={`Across ${trip.pickups.length} pickup farms`} />
        <StatCard label="Pickup stops" value={String(trip.pickups.length).padStart(2, '0')} subtext="Both completed" />
        <StatCard label="Order value" value={lkr(trip.orderValueCents)} subtext="Simulated wallet" />
        <StatCard label="Handover window" value={fmtTime(trip.windowStart)} subtext={`Until ${fmtTime(trip.windowEnd)} · ${TZ}`} />
      </div>

      <div className="ym24-row">
        <div className="ym24-panel">
          <h3>Destination</h3>
          <p className="ym24-panel-sub">Where this load is going</p>
          <div className="ym24-kv"><span>Buyer</span><span>{trip.buyer}</span></div>
          <div className="ym24-kv"><span>Location</span><span>{trip.location}</span></div>
          <div className="ym24-kv"><span>Receiving manager</span><span>{trip.manager}</span></div>
          <div className="ym24-kv"><span>Handover window</span><span>{fmtTime(trip.windowStart)} – {fmtTime(trip.windowEnd)}</span></div>
          <div className="ym24-kv"><span>Load to deliver</span><span>{fmtKg(trip.pickedUpKg)}</span></div>
        </div>

        <div className="ym24-panel">
          <h3>Load check</h3>
          <p className="ym24-panel-sub">Handed over vs picked up</p>
          <div className="ym24-farm">
            <span>Picked up</span>
            <div className="ym24-track"><div className="ym24-fill" style={{ width: `${(trip.pickedUpKg / scale) * 100}%` }} /></div>
            <span className="ym24-farm-kg">{fmtKg(trip.pickedUpKg)}</span>
          </div>
          <div className="ym24-farm">
            <span>Handing over</span>
            <div className="ym24-track"><div className={`ym24-fill ${isOver ? 'ym24-fill--over' : ''}`} style={{ width: `${(handed / scale) * 100}%` }} /></div>
            <span className="ym24-farm-kg">{fmtKg(handed)}</span>
          </div>
          {isOver && (
            <div className="ym24-gap-top">
              <Alert type="error">{fmtKg(over)} over the picked-up load. Fix before confirming.</Alert>
            </div>
          )}
          <div className="ym24-max"><span>Maximum you can hand over</span><strong>{fmtKg(trip.pickedUpKg)}</strong></div>
        </div>
      </div>

      <div className="ym24-row">
        <form className="ym24-panel" onSubmit={handleSubmit} noValidate>
          <h3>Handover details</h3>
          <div className="ym24-form">
            <InputField label="Destination" value={`${trip.buyer}, ${trip.location}`} readOnly />

            <div className="ym24-form-grid">
              <InputField
                label="Handed over (kg)"
                unit="kg"
                inputMode="decimal"
                autoComplete="off"
                value={handedKg}
                disabled={confirmed}
                error={kgError}
                onChange={(e) => {
                  setHandedKg(e.target.value);
                  setKgTouched(true);
                }}
              />
              <InputField
                label="Handover time"
                value={`${fmtDate(trip.handoverAt)}, ${fmtTime(trip.handoverAt)}`}
                unit={TZ}
                readOnly
              />
            </div>

            <InputField
              label="Recipient name"
              autoComplete="off"
              value={recipient}
              disabled={confirmed}
              error={recipientError}
              onChange={(e) => setRecipient(e.target.value)}
            />

            <div>
              <label className="ym24-upload" htmlFor="ym24-proof">
                <input
                  id="ym24-proof"
                  ref={fileInput}
                  className="ym24-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  disabled={confirmed}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <strong>{file ? file.name : 'Upload a photo or signed note'}</strong>
                <span>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'JPEG, PNG or PDF · up to 5 MB'}</span>
              </label>
              {file && !confirmed && (
                <button type="button" className="ym24-link-btn ym24-gap-top" onClick={removeFile}>Remove file</button>
              )}
              {fileError && <p className="ym-field-error" role="alert">{fileError}</p>}
            </div>

            <div className="ym24-actions">
              <Button variant="outline" onClick={() => navigate('/driver/history')}>Cancel</Button>
              <Button type="submit" disabled={confirmed}>Confirm handover</Button>
            </div>
          </div>
        </form>

        <div className="ym24-stack">
          <div className="ym24-panel">
            <h3>Trip YM {trip.id}</h3>
            <p className="ym24-panel-sub">Pickup records</p>
            <div className="ym24-stack">
              {trip.pickups.map((p) => (
                <div className="ym24-record" key={p.farm}>
                  <i className="ym24-record-dot ym24-record-dot--pickup" />
                  <div>
                    <strong>{p.farm}</strong>
                    <span>{fmtTime(p.at)} · {fmtKg(p.kg)} recorded</span>
                  </div>
                </div>
              ))}
              <div className="ym24-record">
                <i className="ym24-record-dot ym24-record-dot--handover" />
                <div>
                  <strong>{trip.buyer}</strong>
                  <span>{confirmed ? `${fmtKg(handed)} handed over` : 'Handover pending'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ym24-panel">
            <h3>Vehicle</h3>
            <div className="ym24-kv"><span>Vehicle</span><span>{trip.vehicle}</span></div>
            <div className="ym24-kv"><span>Capacity</span><span>{fmtKg(trip.capacityKg)}</span></div>
            <div className="ym24-kv">
              <span>Loaded</span>
              <span>{fmtKg(trip.pickedUpKg)} · {Math.round((trip.pickedUpKg / trip.capacityKg) * 100)}%</span>
            </div>
          </div>

          <Alert type="error">Short on delivery? Hand over the actual kg, then report an incident for the difference.</Alert>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm handover?"
        description={`Record ${fmtKg(handed)} handed over to ${trip.buyer}. This cannot be changed afterwards.`}
        simulationNote="Simulated handover: no real stock or money moves."
        confirmLabel="Confirm handover"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
      <Toast open={toastOpen} message="Handover recorded. Waiting for buyer acceptance." onClose={() => setToastOpen(false)} />
    </div>
  );
}