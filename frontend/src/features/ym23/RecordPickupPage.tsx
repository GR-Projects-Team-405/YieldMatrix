import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock3, MapPin, Package, Sprout, UserRound } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import api from '../../services/api';
import './ym23.css';

type PickupOutcome = 'collected' | 'unable_to_collect';
type PickupStopStatus = 'pending' | 'picked_up' | 'exception';
type PickupField = 'quantity' | 'date' | 'time';
type PickupErrors = Partial<Record<PickupField, string>>;
type RecordPickupPayload =
  | { outcome: 'unable_to_collect' }
  | { outcome: 'collected'; quantityKg: number; occurredAt: string };

interface PendingPickupRequest {
  payload: RecordPickupPayload;
  idempotencyKey: string;
  storageKey: string;
  legacyStorageKey?: string;
}

interface PickupStop {
  id: string;
  sequence: number;
  farmName: string;
  farmerName: string;
  district: string;
  crop: string;
  committedKg: number;
  pickedUpKg: number;
  remainingKg: number;
  pickupTime: string;
  status: PickupStopStatus;
}

interface PickupStopResponse {
  stop: PickupStop;
  requestId: string;
}

interface RecordPickupResponse {
  pickup: {
    id: string;
    quantityKg: number;
    occurredAt: string;
    duplicate: boolean;
  } | null;
  stop: Pick<PickupStop, 'id' | 'status' | 'committedKg' | 'pickedUpKg' | 'remainingKg'>;
  requestId: string;
}

const outcomeOptions = [
  { value: 'collected', label: 'Pickup collected' },
  { value: 'unable_to_collect', label: 'Unable to collect' },
];

function getErrorResponse(error: unknown): object | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = error.response;
  return typeof response === 'object' && response !== null ? response : null;
}

function getApiErrorMessage(error: unknown) {
  const response = getErrorResponse(error);
  if (!response) {
    if (error instanceof Error && error.message === 'Invalid pickup response') {
      return 'The server response could not be verified. Retry the saved request to confirm its outcome.';
    }
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if ('data' in response) {
    const data = response.data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }

  return 'The pickup could not be saved. Please try again.';
}

function isNotFoundError(error: unknown) {
  const response = getErrorResponse(error);
  return response !== null && 'status' in response && response.status === 404;
}

function getPendingRequestStorageKey(stopId: string) {
  return `ym23:pickup:pending:${encodeURIComponent(stopId)}`;
}

function isPickupPayload(value: unknown): value is RecordPickupPayload {
  if (!value || typeof value !== 'object' || !('outcome' in value)) return false;
  if (value.outcome === 'unable_to_collect') return true;
  if (value.outcome !== 'collected' || !('quantityKg' in value) || !('occurredAt' in value)) return false;
  return typeof value.quantityKg === 'number'
    && Number.isFinite(value.quantityKg)
    && value.quantityKg > 0
    && typeof value.occurredAt === 'string'
    && !Number.isNaN(new Date(value.occurredAt).getTime());
}

function isStoredRequest(value: unknown): value is {
  payload: RecordPickupPayload;
  idempotencyKey: string;
  legacyStorageKey?: string;
} {
  if (!value || typeof value !== 'object') return false;
  return 'payload' in value
    && isPickupPayload(value.payload)
    && 'idempotencyKey' in value
    && typeof value.idempotencyKey === 'string'
    && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.idempotencyKey)
    && (!('legacyStorageKey' in value) || typeof value.legacyStorageKey === 'string');
}

function restorePendingRequest(stopId: string): PendingPickupRequest | null {
  const storageKey = getPendingRequestStorageKey(stopId);
  const savedRequest = sessionStorage.getItem(storageKey);
  if (savedRequest) {
    const parsedRequest: unknown = JSON.parse(savedRequest);
    if (!isStoredRequest(parsedRequest)) throw new Error('Stored pickup retry data is invalid.');
    return { ...parsedRequest, storageKey };
  }

  const legacyPrefix = 'ym23:pickup:';
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const legacyStorageKey = sessionStorage.key(index);
    if (!legacyStorageKey || !legacyStorageKey.startsWith(legacyPrefix) || legacyStorageKey.startsWith(`${legacyPrefix}pending:`)) {
      continue;
    }

    let legacyData: unknown;
    try {
      legacyData = JSON.parse(decodeURIComponent(legacyStorageKey.slice(legacyPrefix.length)));
    } catch {
      continue;
    }
    if (!Array.isArray(legacyData) || legacyData.length !== 2 || legacyData[0] !== stopId || !isPickupPayload(legacyData[1])) {
      continue;
    }

    const idempotencyKey = sessionStorage.getItem(legacyStorageKey);
    if (!idempotencyKey || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      continue;
    }
    const request = { payload: legacyData[1], idempotencyKey, legacyStorageKey };
    sessionStorage.setItem(storageKey, JSON.stringify(request));
    return { ...request, storageKey };
  }

  return null;
}

function createPendingRequest(stopId: string, payload: RecordPickupPayload): PendingPickupRequest {
  const request = { payload, idempotencyKey: crypto.randomUUID() };
  const storageKey = getPendingRequestStorageKey(stopId);
  sessionStorage.setItem(storageKey, JSON.stringify(request));
  return { ...request, storageKey };
}

function clearPendingRequest(request: PendingPickupRequest) {
  try {
    sessionStorage.removeItem(request.storageKey);
    if (request.legacyStorageKey) sessionStorage.removeItem(request.legacyStorageKey);
    return true;
  } catch {
    return false;
  }
}

function isDefinitiveRejection(error: unknown) {
  const response = getErrorResponse(error);
  return response !== null
    && 'status' in response
    && [400, 409].includes(Number(response.status));
}

function restoreFormFields(payload: RecordPickupPayload) {
  if (payload.outcome === 'unable_to_collect') {
    return { outcome: payload.outcome, quantity: '', date: '', time: '' };
  }

  const pickupDate = new Date(payload.occurredAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    outcome: payload.outcome,
    quantity: String(payload.quantityKg),
    date: `${pickupDate.getFullYear()}-${pad(pickupDate.getMonth() + 1)}-${pad(pickupDate.getDate())}`,
    time: `${pad(pickupDate.getHours())}:${pad(pickupDate.getMinutes())}`,
  };
}

export default function RecordPickupPage() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const [stop, setStop] = useState<PickupStop | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [outcome, setOutcome] = useState<PickupOutcome>('collected');
  const [errors, setErrors] = useState<PickupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingRequest, setPendingRequest] = useState<PendingPickupRequest | null>(null);
  const [pendingRequestLoaded, setPendingRequestLoaded] = useState(false);
  const [pendingRequestError, setPendingRequestError] = useState<string | null>(null);

  const applyRestoredRequest = useCallback((request: PendingPickupRequest | null) => {
    setPendingRequest(request);
    if (request) {
      const fields = restoreFormFields(request.payload);
      setOutcome(fields.outcome);
      setQuantity(fields.quantity);
      setDate(fields.date);
      setTime(fields.time);
    }
  }, []);

  useEffect(() => {
    setPendingRequest(null);
    setPendingRequestLoaded(false);
    setPendingRequestError(null);
    setQuantity('');
    setDate('');
    setTime('');
    setOutcome('collected');

    if (!stopId) {
      setPendingRequestLoaded(true);
      return;
    }

    try {
      const request = restorePendingRequest(stopId);
      applyRestoredRequest(request);
    } catch {
      setPendingRequestError('Saved pickup retry data could not be read. Do not submit a new pickup until it is recovered.');
    } finally {
      setPendingRequestLoaded(true);
    }
  }, [stopId, applyRestoredRequest]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    setStop(null);

    if (!stopId) {
      setNotFound(true);
      setLoading(false);
      return () => controller.abort();
    }

    api.get<PickupStopResponse>(`/ym23/pickup-stops/${encodeURIComponent(stopId)}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!data.stop || typeof data.stop !== 'object') {
          throw new Error('Invalid pickup stop response');
        }
        setStop(data.stop);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isNotFoundError(error)) setNotFound(true);
        else setLoadError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, stopId]);

  if (loading) {
    return (
      <ContentCard className="ym23-record-not-found">
        <Alert type="info">Loading pickup stop...</Alert>
      </ContentCard>
    );
  }

  if (loadError) {
    return (
      <ContentCard className="ym23-record-not-found">
        <Alert type="error">{loadError}</Alert>
        <div className="ym23-record-actions">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
          <Link className="ym-button ym-button--outline" to="/driver/pickups">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Pickup Stops
          </Link>
        </div>
      </ContentCard>
    );
  }

  if (notFound || !stop) {
    return (
      <ContentCard className="ym23-record-not-found">
        <EmptyState
          title="Pickup stop not found"
          description="This pickup stop does not exist or is not assigned to your driver account."
          action={
            <Link className="ym-button ym-button--outline" to="/driver/pickups">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Pickup Stops
            </Link>
          }
        />
      </ContentCard>
    );
  }

  const currentStop = stop;

  function validateForm(): PickupErrors {
    const nextErrors: PickupErrors = {};
    if (outcome === 'collected') {
      const collectedQuantity = Number(quantity);
      if (!quantity.trim()) {
        nextErrors.quantity = 'Enter the newly collected quantity.';
      } else if (!/^\d+(?:\.\d{1,3})?$/.test(quantity.trim()) || !Number.isFinite(collectedQuantity) || collectedQuantity <= 0) {
        nextErrors.quantity = 'Quantity must be greater than zero and have at most three decimal places.';
      } else if (Math.round(collectedQuantity * 1000) > Math.round(currentStop.remainingKg * 1000)) {
        nextErrors.quantity = `Quantity cannot exceed ${currentStop.remainingKg} kg remaining.`;
      }
      if (!date) nextErrors.date = 'Select the pickup date.';
      if (!time) nextErrors.time = 'Select the pickup time.';
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !stopId || !pendingRequestLoaded || pendingRequestError) return;

    let request: PendingPickupRequest;
    if (pendingRequest) {
      request = pendingRequest;
    } else {
      const nextErrors = validateForm();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const payload: RecordPickupPayload = outcome === 'unable_to_collect'
        ? { outcome }
        : {
          outcome,
          quantityKg: Number(quantity),
          occurredAt: new Date(`${date}T${time}:00`).toISOString(),
        };
      try {
        request = createPendingRequest(stopId, payload);
      } catch {
        setSubmitError('The pickup request could not be saved for safe retry. The request was not sent.');
        return;
      }
      setPendingRequest(request);
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const { data } = await api.post<RecordPickupResponse>(
        `/ym23/pickup-stops/${encodeURIComponent(stopId)}/record`,
        request.payload,
        { headers: { 'Idempotency-Key': request.idempotencyKey } },
      );

      if (!data.stop || !['pending', 'picked_up', 'exception'].includes(data.stop.status)) {
        throw new Error('Invalid pickup response');
      }
      setStop((currentStop) => currentStop ? { ...currentStop, ...data.stop } : currentStop);
      const retryRequestCleared = clearPendingRequest(request);
      let nextPendingRequest: PendingPickupRequest | null = request;
      if (retryRequestCleared) {
        try {
          nextPendingRequest = restorePendingRequest(stopId);
          applyRestoredRequest(nextPendingRequest);
        } catch {
          setPendingRequestError('Another saved pickup retry could not be read. Do not submit a new pickup until it is recovered.');
        }
      }
      if (request.payload.outcome === 'unable_to_collect') {
        setSuccessMessage('The stop was marked as unable to collect.');
      } else if (data.stop.status === 'picked_up') {
        setSuccessMessage('Pickup completed. The full committed quantity has been collected.');
      } else {
        setSuccessMessage(`Pickup recorded. ${data.stop.remainingKg} kg remains to be collected.`);
      }
      if (!retryRequestCleared) {
        setSubmitError('Pickup was saved, but its retry data could not be cleared. Retry the same request before recording another pickup.');
      }
      if (data.stop.status !== 'picked_up' && retryRequestCleared && !nextPendingRequest) {
        setQuantity('');
        setDate('');
        setTime('');
        setOutcome('collected');
      }
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error);
      if (isDefinitiveRejection(error)) {
        if (clearPendingRequest(request)) {
          setSubmitError(errorMessage);
          try {
            applyRestoredRequest(restorePendingRequest(stopId));
          } catch {
            setPendingRequestError('Another saved pickup retry could not be read. Do not submit a new pickup until it is recovered.');
          }
        } else {
          setSubmitError(`${errorMessage} The retry data could not be cleared; retry or resolve the saved request before continuing.`);
        }
      } else {
        setSubmitError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function updateField<Field extends PickupField>(field: Field, update: () => void) {
    update();
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setSubmitError(null);
    setSuccessMessage(null);
  }

  const statusLabel = stop.status === 'picked_up'
    ? 'Picked up'
    : stop.status.charAt(0).toUpperCase() + stop.status.slice(1);
  const sequenceLabel = `Stop #${String(stop.sequence).padStart(2, '0')}`;

  return (
    <div className="ym23-record-page">
      <header className="ym23-record-header">
        <div>
          <p className="ym23-record-breadcrumb">
            <Link to="/driver/pickups">Pickup stops</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/driver/pickups/${stop.id}`}>{stop.farmName}</Link>
            <span aria-hidden="true">/</span>
            <span>Record pickup</span>
          </p>
          <h2>Record Pickup</h2>
          <p className="ym23-record-description">Record a new pickup quantity or mark the stop as unable to collect.</p>
        </div>
        <Button
          variant="outline"
          className="ym23-record-back"
          onClick={() => navigate(`/driver/pickups/${stop.id}`)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Pickup Stop Details
        </Button>
      </header>

      {successMessage && <Alert type="success">{successMessage}</Alert>}
      {submitError && <Alert type="error">{submitError}</Alert>}
      {pendingRequestError && <Alert type="error">{pendingRequestError}</Alert>}
      {pendingRequest && (
        <Alert type="info">
          A previous pickup request may still have completed. Retry it to reuse its saved payload and idempotency key before recording another pickup.
        </Alert>
      )}

      <ContentCard className="ym23-record-stop-card">
        <div className="ym23-record-stop-heading">
          <div className="ym23-record-stop-icon"><MapPin size={20} aria-hidden="true" /></div>
          <div className="ym23-record-stop-name">
            <span className="ym23-record-sequence">{sequenceLabel} · {stop.id}</span>
            <h3>{stop.farmName}</h3>
            <p><MapPin size={14} aria-hidden="true" />{stop.district}</p>
          </div>
          <div className="ym23-record-stop-status">
            <span>Current status</span>
            <StatusBadge status={statusLabel} />
          </div>
        </div>
        <dl className="ym23-record-stop-details">
          <div><dt><UserRound size={14} aria-hidden="true" /> Farmer</dt><dd>{stop.farmerName}</dd></div>
          <div><dt><Sprout size={14} aria-hidden="true" /> Expected crop</dt><dd>{stop.crop}</dd></div>
          <div><dt><Package size={14} aria-hidden="true" /> Expected quantity</dt><dd>{stop.committedKg} kg</dd></div>
          <div><dt><CalendarDays size={14} aria-hidden="true" /> Scheduled pickup</dt><dd>{stop.pickupTime}</dd></div>
        </dl>
        <p>Collected so far: {stop.pickedUpKg} kg · Remaining: {stop.remainingKg} kg</p>
      </ContentCard>

      {stop.status === 'pending' || stop.status === 'exception' || pendingRequest ? (
      <form className="ym23-record-form" onSubmit={handleSubmit} noValidate>
        <ContentCard
          className="ym23-record-form-card"
          title="Pickup information"
          subtitle={pendingRequest
            ? 'The saved request is locked until its outcome is resolved.'
            : outcome === 'collected' ? 'Fields marked * are required.' : 'No quantity or pickup event will be recorded.'}
        >
          <div className="ym23-record-fields">
            <SelectField
              label="Pickup outcome"
              options={outcomeOptions}
              value={outcome}
              disabled={submitting || Boolean(pendingRequest) || !pendingRequestLoaded || Boolean(pendingRequestError)}
              onChange={(event) => {
                setOutcome(event.target.value as PickupOutcome);
                setErrors({});
                setSubmitError(null);
                setSuccessMessage(null);
              }}
            />
            {outcome === 'collected' && (
              <>
                <InputField
                  label="Newly collected quantity *"
                  type="number"
                  min="0.001"
                  max={stop.remainingKg}
                  step="0.001"
                  inputMode="decimal"
                  placeholder="Enter quantity"
                  unit="kg"
                  required
                  disabled={submitting || Boolean(pendingRequest) || !pendingRequestLoaded || Boolean(pendingRequestError)}
                  value={quantity}
                  error={errors.quantity}
                  onChange={(event) => updateField('quantity', () => setQuantity(event.target.value))}
                />
                <InputField
                  label="Pickup date *"
                  type="date"
                  required
                  disabled={submitting || Boolean(pendingRequest) || !pendingRequestLoaded || Boolean(pendingRequestError)}
                  value={date}
                  error={errors.date}
                  onChange={(event) => updateField('date', () => setDate(event.target.value))}
                />
                <InputField
                  label="Pickup time *"
                  type="time"
                  required
                  disabled={submitting || Boolean(pendingRequest) || !pendingRequestLoaded || Boolean(pendingRequestError)}
                  value={time}
                  error={errors.time}
                  onChange={(event) => updateField('time', () => setTime(event.target.value))}
                />
              </>
            )}
          </div>
        </ContentCard>

        <div className="ym23-record-actions">
          <Button variant="outline" disabled={submitting} onClick={() => navigate(`/driver/pickups/${stop.id}`)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !pendingRequestLoaded || Boolean(pendingRequestError)}>
            {submitting
              ? 'Saving pickup...'
              : pendingRequest
                ? 'Retry Previous Request'
                : outcome === 'collected' ? 'Record Pickup' : 'Mark Unable to Collect'}
          </Button>
        </div>
      </form>
      ) : (
        <ContentCard title="Pickup recording unavailable">
          <Alert type="info">
            {stop.status === 'picked_up'
              ? 'This stop is fully collected.'
              : 'This stop is marked as unable to collect.'}
          </Alert>
        </ContentCard>
      )}

      <p className="ym23-record-footer">Every pickup connected. Every handover accounted for.</p>
    </div>
  );
}
