import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock3, MapPin, Package, Sprout, UserRound } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { Toast } from '../../components/Toast';
import { mockPickupStops } from './mockPickupStops';
import './ym23.css';

type PickupResult = '' | 'completed' | 'partially-collected' | 'unable-to-collect';
type PickupField = 'quantity' | 'date' | 'time' | 'result';
type PickupErrors = Partial<Record<PickupField, string>>;

const resultOptions = [
  { value: '', label: 'Select pickup result', disabled: true },
  { value: 'completed', label: 'Completed' },
  { value: 'partially-collected', label: 'Partially Collected' },
  { value: 'unable-to-collect', label: 'Unable to Collect' },
];

export default function RecordPickupPage() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const stop = mockPickupStops.find((pickupStop) => pickupStop.id === stopId);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [result, setResult] = useState<PickupResult>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<PickupErrors>({});
  const [showToast, setShowToast] = useState(false);

  if (!stop) {
    return (
      <ContentCard className="ym23-record-not-found">
        <EmptyState
          title="Pickup stop not found"
          description="This pickup stop ID does not match a stop in the current demo schedule."
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

  function validateForm(): PickupErrors {
    const nextErrors: PickupErrors = {};
    const collectedQuantity = Number(quantity);

    if (!quantity.trim()) {
      nextErrors.quantity = 'Enter the actual collected quantity.';
    } else if (!Number.isFinite(collectedQuantity) || collectedQuantity <= 0) {
      nextErrors.quantity = 'Quantity must be a number greater than zero.';
    }
    if (!date) nextErrors.date = 'Select the pickup date.';
    if (!time) nextErrors.time = 'Select the pickup time.';
    if (!result) nextErrors.result = 'Select the pickup result.';

    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm();
    setErrors(nextErrors);
    setShowToast(false);
    if (Object.keys(nextErrors).length > 0) return;
    setShowToast(true);
  }

  function updateField<Field extends PickupField>(field: Field, update: () => void) {
    update();
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setShowToast(false);
  }

  const statusLabel = stop.status.charAt(0).toUpperCase() + stop.status.slice(1);
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
          <p className="ym23-record-description">Record the collected quantity and pickup details for this stop.</p>
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

      <Alert type="info">Demo pickup data only — submitting this form will not save a pickup record.</Alert>

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
      </ContentCard>

      <form className="ym23-record-form" onSubmit={handleSubmit} noValidate>
        <ContentCard className="ym23-record-form-card" title="Pickup information" subtitle="Fields marked * are required.">
          <div className="ym23-record-fields">
            <InputField
              label="Actual collected quantity *"
              type="number"
              min="0.01"
              step="any"
              inputMode="decimal"
              placeholder="Enter quantity"
              unit="kg"
              required
              value={quantity}
              error={errors.quantity}
              onChange={(event) => updateField('quantity', () => setQuantity(event.target.value))}
            />
            <SelectField
              label="Pickup result *"
              options={resultOptions}
              required
              value={result}
              error={errors.result}
              onChange={(event) => updateField('result', () => setResult(event.target.value as PickupResult))}
            />
            <InputField
              label="Pickup date *"
              type="date"
              required
              value={date}
              error={errors.date}
              onChange={(event) => updateField('date', () => setDate(event.target.value))}
            />
            <InputField
              label="Pickup time *"
              type="time"
              required
              value={time}
              error={errors.time}
              onChange={(event) => updateField('time', () => setTime(event.target.value))}
            />
            <div className="ym-field ym23-record-notes">
              <label htmlFor="ym23-record-notes">Driver notes <span>(optional)</span></label>
              <textarea
                id="ym23-record-notes"
                rows={4}
                placeholder="Add collection notes or describe any problems..."
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setShowToast(false);
                }}
              />
            </div>
          </div>
        </ContentCard>

        <div className="ym23-record-actions">
          <Button variant="outline" onClick={() => navigate(`/driver/pickups/${stop.id}`)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Record Pickup
          </Button>
        </div>
      </form>

      <p className="ym23-record-footer">Every pickup connected. Every handover accounted for.</p>
      <Toast
        message="Demo only: pickup details validated. No record was saved."
        open={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
