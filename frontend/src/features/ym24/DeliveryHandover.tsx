import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { Toast } from '../../components/Toast';
import { createHandover, errorMessage, getDelivery, getPendingHandovers } from './ym24Api';
import type { DeliveryDetail, PendingHandover } from './ym24Api';
import './DeliveryHistory.css'; // shared page styles (panels, stats, rows)
import './DeliveryDetails.css'; // shared bars and record rows
import './DeliveryHandover.css';

// Timestamps are stored in UTC and shown in Asia/Colombo.
const TZ = 'Asia/Colombo';
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }) : '-';

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmtKg = (n: number) => round3(n).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' kg';
const lkr = (cents: number) => 'LKR ' + (cents / 100).toLocaleString('en-US');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

// One key per confirm, so a double click or a retry never records the handover twice.
function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'ym24-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function validateKg(raw: string, max: number): string | undefined {
  const value = raw.trim();
  if (value === '') return 'Enter the handed-over kg.';
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Use a number with up to 3 decimals.';
  const n = Number(value);
  if (n <= 0) return 'Handed-over kg must be more than 0.';
  if (n > max) return 'Handover kg cannot exceed picked-up kg (' + fmtKg(max) + ').';
  return undefined;
}

function validateRecipient(raw: string): string | undefined {
  const value = raw.trim();
  if (value.length < 2) return 'Enter the recipient name.';
  if (value.length > 100) return 'Use 100 characters or fewer.';
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
  const [params] = useSearchParams();
  const wantedTrip = params.get('trip');

  const [trips, setTrips] = useState<PendingHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tripId, setTripId] = useState('');
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [detailError, setDetailError] = useState('');

  const [handedKg, setHandedKg] = useState('');
  const [kgTouched, setKgTouched] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const keyRef = useRef<string>(newKey());

  // 1. Trips waiting for a handover
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getPendingHandovers();
        if (cancelled) return;
        setTrips(rows);
        const first = rows.find((r) => r.id === wantedTrip) ?? rows[0];
        setTripId(first ? first.id : '');
        setHandedKg(first ? String(first.pickedUpKg) : '');
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, 'Could not load your trips.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wantedTrip]);

  // 2. Pickup records of the selected trip
  useEffect(() => {
    if (!tripId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailError('');
    getDelivery(tripId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(errorMessage(e, 'Could not load the pickup records.')); });
    return () => { cancelled = true; };
  }, [tripId]);

  const trip = trips.find((t) => t.id === tripId);
  const pickups = detail ? detail.allocations : [];
  const pickedUpKg = trip ? trip.pickedUpKg : 0;
  const orderValueCents = pickups.reduce((sum, a) => sum + Math.round(a.pickedUpKg * a.priceCentsPerKg), 0);

  const kgError = trip && (kgTouched || submitted) ? validateKg(handedKg, pickedUpKg) : undefined;
  const recipientError = submitted ? validateRecipient(recipient) : undefined;
  const fileError = file ? validateFile(file) : undefined;

  const handed = /^\d+(\.\d{1,3})?$/.test(handedKg.trim()) ? Number(handedKg) : 0;
  const over = round3(handed - pickedUpKg);
  const isOver = over > 0;
  const scale = Math.max(pickedUpKg, handed, 1);

  const steps: { label: string; sub: string; state: StepState }[] = [
    { label: 'Pickup', sub: pickups.length + ' farms · ' + fmtKg(pickedUpKg), state: 'done' },
    { label: 'In transit', sub: trip?.vehicle ?? '-', state: 'done' },
    { label: 'Handover', sub: confirmed ? 'Recorded' : 'You are here', state: confirmed ? 'done' : 'current' },
    { label: 'Acceptance', sub: confirmed ? 'Awaiting buyer' : 'By buyer', state: confirmed ? 'current' : 'todo' },
  ];

  function selectTrip(id: string) {
    const next = trips.find((t) => t.id === id);
    setTripId(id);
    setHandedKg(next ? String(next.pickedUpKg) : '');
    setKgTouched(false);
    setSubmitted(false);
    setSubmitError('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setKgTouched(true);
    setSubmitError('');
    if (!trip) return;
    if (validateKg(handedKg, pickedUpKg) || validateRecipient(recipient) || (file && validateFile(file))) return;
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!trip) return;
    setBusy(true);
    setSubmitError('');
    try {
      await createHandover(trip.id, {
        handedOverKg: Number(handedKg.trim()),
        recipientName: recipient.trim(),
        evidence: file ? [{ name: file.name, type: file.type, size: file.size }] : [],
        operationKey: keyRef.current,
      });
      setConfirmOpen(false);
      setConfirmed(true);
      setToastOpen(true);
    } catch (e) {
      // The answers and the key are kept so the driver can retry safely.
      setConfirmOpen(false);
      setSubmitError(errorMessage(e, 'Your handover has not been saved. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  function removeFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  if (loading) {
    return (
      <div className="ym24-page">
        <div className="ym24-panel ym24-empty">Loading your trips…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="ym24-page">
        <Alert type="error">{loadError}</Alert>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="ym24-page">
        <div className="ym24-panel ym24-empty">
          <p>No trip is waiting for a handover right now.</p>
          <Link className="ym24-back" to="/driver/history">View delivery history</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ym24-page">
      <div className="ym24-head">
        <div>
          <p>Record what you handed over at the destination. Times use {TZ}.</p>
        </div>
        <span className="ym24-pill">Trip {trip.code} • {trip.destination}</span>
      </div>

      {trips.length > 1 && !confirmed && (
        <div className="ym24-panel">
          <SelectField
            label="Trip to hand over"
            value={tripId}
            options={trips.map((t) => ({ value: t.id, label: t.code + ' • ' + t.destination }))}
            onChange={(e) => selectTrip(e.target.value)}
          />
        </div>
      )}

      <div className="ym24-panel">
        <ol className="ym24-stepper">
          {steps.map((step, i) => (
            <li key={step.label} className={'ym24-step ym24-step--' + step.state}>
              <span className="ym24-step-dot" aria-hidden="true">{step.state === 'done' ? '✓' : i + 1}</span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.sub}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {detailError && <Alert type="error">{detailError}</Alert>}

      <div className="ym24-stats">
        <StatCard label="Picked up" value={fmtKg(pickedUpKg)} subtext={'Across ' + pickups.length + ' pickup farms'} />
        <StatCard label="Pickup stops" value={String(pickups.length).padStart(2, '0')} subtext="Completed" />
        <StatCard label="Order value" value={lkr(orderValueCents)} subtext="Simulated wallet" />
        <StatCard
          label="Vehicle load"
          value={trip.capacityKg > 0 ? Math.round((pickedUpKg / trip.capacityKg) * 100) + '%' : '-'}
          subtext={'Capacity ' + fmtKg(trip.capacityKg)}
        />
      </div>

      <div className="ym24-row">
        <div className="ym24-panel">
          <h3>Destination</h3>
          <p className="ym24-panel-sub">Where this load is going</p>
          <div className="ym24-kv"><span>Buyer</span><span>{trip.buyer}</span></div>
          <div className="ym24-kv"><span>Destination</span><span>{trip.destination}</span></div>
          <div className="ym24-kv"><span>Vehicle</span><span>{trip.vehicle ?? '-'}</span></div>
          <div className="ym24-kv"><span>Load to deliver</span><span>{fmtKg(pickedUpKg)}</span></div>
        </div>

        <div className="ym24-panel">
          <h3>Load check</h3>
          <p className="ym24-panel-sub">Handed over vs picked up</p>
          <div className="ym24-farm">
            <span>Picked up</span>
            <div className="ym24-track"><div className="ym24-fill" style={{ width: (pickedUpKg / scale) * 100 + '%' }} /></div>
            <span className="ym24-farm-kg">{fmtKg(pickedUpKg)}</span>
          </div>
          <div className="ym24-farm">
            <span>Handing over</span>
            <div className="ym24-track"><div className={'ym24-fill ' + (isOver ? 'ym24-fill--over' : '')} style={{ width: (handed / scale) * 100 + '%' }} /></div>
            <span className="ym24-farm-kg">{fmtKg(handed)}</span>
          </div>
          {isOver && (
            <div className="ym24-gap-top">
              <Alert type="error">{fmtKg(over)} over the picked-up load. Fix before confirming.</Alert>
            </div>
          )}
          <div className="ym24-max"><span>Maximum you can hand over</span><strong>{fmtKg(pickedUpKg)}</strong></div>
        </div>
      </div>

      <div className="ym24-row">
        <form className="ym24-panel" onSubmit={handleSubmit} noValidate>
          <h3>Handover details</h3>
          <div className="ym24-form">
            <InputField label="Destination" value={trip.buyer + ', ' + trip.destination} readOnly />

            <div className="ym24-form-grid">
              <InputField
                label="Handed over (kg)"
                unit="kg"
                inputMode="decimal"
                autoComplete="off"
                value={handedKg}
                disabled={confirmed || busy}
                error={kgError}
                onChange={(e) => {
                  setHandedKg(e.target.value);
                  setKgTouched(true);
                }}
              />
              <InputField
                label="Handover time"
                value="Recorded when you confirm"
                unit={TZ}
                readOnly
              />
            </div>

            <InputField
              label="Recipient name"
              autoComplete="off"
              value={recipient}
              disabled={confirmed || busy}
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
                  disabled={confirmed || busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <strong>{file ? file.name : 'Upload a photo or signed note'}</strong>
                <span>{file ? Math.max(1, Math.round(file.size / 1024)) + ' KB' : 'JPEG, PNG or PDF · up to 5 MB'}</span>
              </label>
              {file && !confirmed && (
                <button type="button" className="ym24-link-btn ym24-gap-top" onClick={removeFile}>Remove file</button>
              )}
              {fileError && <p className="ym-field-error" role="alert">{fileError}</p>}
            </div>

            {submitError && <Alert type="error"><strong>Could not record the handover.</strong> {submitError}</Alert>}

            <div className="ym24-actions">
              <Button variant="outline" onClick={() => navigate('/driver/history')}>Cancel</Button>
              <Button type="submit" disabled={confirmed || busy}>Confirm handover</Button>
            </div>
          </div>
        </form>

        <div className="ym24-stack">
          <div className="ym24-panel">
            <h3>Trip {trip.code}</h3>
            <p className="ym24-panel-sub">Pickup records</p>
            <div className="ym24-stack">
              {pickups.map((p) => (
                <div className="ym24-record" key={p.id}>
                  <i className="ym24-record-dot ym24-record-dot--pickup" />
                  <div>
                    <strong>{p.farm}</strong>
                    <span>{fmtTime(p.pickedUpAt)} · {fmtKg(p.pickedUpKg)} recorded</span>
                  </div>
                </div>
              ))}
              <div className="ym24-record">
                <i className="ym24-record-dot ym24-record-dot--handover" />
                <div>
                  <strong>{trip.buyer}</strong>
                  <span>{confirmed ? fmtKg(handed) + ' handed over' : 'Handover pending'}</span>
                </div>
              </div>
            </div>
            {confirmed && (
              <div className="ym24-gap-top">
                <Link className="ym24-back" to={'/driver/history/' + trip.id}>View this delivery</Link>
              </div>
            )}
          </div>

          <Alert type="error">Short on delivery? Hand over the actual kg, then report an incident for the difference.</Alert>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm handover?"
        description={'Record ' + fmtKg(handed) + ' handed over to ' + trip.buyer + '. This cannot be changed afterwards.'}
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