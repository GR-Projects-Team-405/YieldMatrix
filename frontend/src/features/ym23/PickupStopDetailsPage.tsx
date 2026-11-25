import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Package, Sprout, UserRound } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import api from '../../services/api';
import './ym23.css';

type PickupStopStatus = 'pending' | 'picked_up' | 'exception';

interface PickupStop {
  id: string;
  sequence: number;
  farmName: string;
  farmerName: string;
  district: string;
  crop: string;
  committedKg: number;
  pickupTime?: string | null;
  status: PickupStopStatus;
}

interface PickupStopDetailsResponse {
  stop: PickupStop;
  requestId: string;
}

interface PickupSchedule {
  date: string;
  time: string;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false;
  const response = error.response;
  return typeof response === 'object'
    && response !== null
    && 'status' in response
    && response.status === 404;
}

function formatPickupSchedule(value: PickupStop['pickupTime']): PickupSchedule {
  const fallback = { date: 'Not scheduled', time: 'Not specified' };
  if (!value || value.trim().toLowerCase() === 'not scheduled') return fallback;

  const commaFormatted = value.match(/^(\d{4}-\d{2}-\d{2}),\s*(\d{1,2}:\d{2}\s*[ap]m)$/i);
  if (commaFormatted) {
    const [, dateValue, timeValue] = commaFormatted;
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    const timeParts = timeValue.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
    if (
      Number.isNaN(date.getTime())
      || date.toISOString().slice(0, 10) !== dateValue
      || !timeParts
      || Number(timeParts[1]) < 1
      || Number(timeParts[1]) > 12
      || Number(timeParts[2]) > 59
    ) return fallback;

    return {
      date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date),
      time: `${timeValue.slice(0, -2).trim()} ${timeParts[3].toUpperCase()}`,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date),
    time: /(?:T|\s)\d{1,2}:\d{2}/i.test(value)
      ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
      : 'Not specified',
  };
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="ym23-detail-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function PickupStopDetailsPage() {
  const { stopId } = useParams<{ stopId: string }>();
  const [stop, setStop] = useState<PickupStop | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    setError(false);
    setStop(null);

    if (!stopId) {
      setNotFound(true);
      setLoading(false);
      return () => controller.abort();
    }

    api.get<PickupStopDetailsResponse>(`/ym23/pickup-stops/${encodeURIComponent(stopId)}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!data.stop || typeof data.stop !== 'object') {
          throw new Error('Invalid pickup stop response');
        }
        setStop(data.stop);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (isNotFoundError(requestError)) setNotFound(true);
        else setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, stopId]);

  if (loading) {
    return (
      <ContentCard className="ym23-details-not-found">
        <Alert type="info">Loading pickup stop details...</Alert>
      </ContentCard>
    );
  }

  if (error) {
    return (
      <ContentCard className="ym23-details-not-found">
        <Alert type="error">Unable to load this pickup stop. Please try again.</Alert>
        <div className="ym23-details-actions">
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
      <ContentCard className="ym23-details-not-found">
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

  const locationParts = stop.district.split(',').map((part) => part.trim());
  const district = locationParts[locationParts.length - 1] || stop.district;
  const farmLocation = locationParts.length > 1 ? locationParts.slice(0, -1).join(', ') : stop.district;
  const { date: scheduledDate, time: scheduledTime } = formatPickupSchedule(stop.pickupTime);
  const statusLabel = stop.status === 'picked_up'
    ? 'Picked up'
    : stop.status.charAt(0).toUpperCase() + stop.status.slice(1);

  return (
    <div className="ym23-details-page">
      <div className="ym23-details-header">
        <div>
          <p className="ym23-details-breadcrumb">
            <Link to="/driver/pickups">Pickup stops</Link>
            <span aria-hidden="true">/</span>
            <span>Stop #{String(stop.sequence).padStart(2, '0')}</span>
          </p>
          <h2>Pickup Stop Details</h2>
          <p className="ym23-details-description">Review the selected pickup location and its committed produce information.</p>
        </div>
        <span className={`ym23-details-status ym23-details-status--${stop.status}`}>
          <StatusBadge status={statusLabel} />
        </span>
      </div>

      <Alert type="info">Pickup stop details are loaded from your assigned trip.</Alert>

      <div className="ym23-details-layout">
        <div className="ym23-details-main">
          <ContentCard className="ym23-details-card" title="Farm and farmer information">
            <div className="ym23-details-card-heading">
              <div className="ym23-details-icon"><MapPin size={20} aria-hidden="true" /></div>
              <div>
                <p className="ym23-details-eyebrow">Pickup stop #{String(stop.sequence).padStart(2, '0')}</p>
                <h3>{stop.farmName}</h3>
                <p>{stop.district}</p>
              </div>
            </div>
            <div className="ym23-details-values">
              <div className="ym23-detail-value">
                <span><UserRound size={14} aria-hidden="true" /> Farmer</span>
                <strong>{stop.farmerName}</strong>
              </div>
              <DetailValue label="Farm location" value={farmLocation} />
              <DetailValue label="District" value={district} />
              <DetailValue label="Pickup stop ID" value={stop.id} />
            </div>
          </ContentCard>

          <ContentCard className="ym23-details-card" title="Crop and quantity">
            <div className="ym23-details-values ym23-details-values--two">
              <div className="ym23-detail-value">
                <span><Sprout size={14} aria-hidden="true" /> Crop / product</span>
                <strong>{stop.crop}</strong>
              </div>
              <div className="ym23-detail-value">
                <span><Package size={14} aria-hidden="true" /> Committed pickup quantity</span>
                <strong>{stop.committedKg} kg</strong>
              </div>
            </div>
          </ContentCard>

          <ContentCard className="ym23-details-card" title="Pickup schedule">
            <div className="ym23-details-values ym23-details-values--two">
              <div className="ym23-detail-value">
                <span><CalendarDays size={14} aria-hidden="true" /> Scheduled date</span>
                <strong>{scheduledDate}</strong>
              </div>
              <div className="ym23-detail-value">
                <span><Clock3 size={14} aria-hidden="true" /> Scheduled time</span>
                <strong>{scheduledTime}</strong>
              </div>
              <DetailValue label="Pickup sequence" value={`Stop #${String(stop.sequence).padStart(2, '0')}`} />
            </div>
          </ContentCard>
        </div>

        <aside className="ym23-details-side" aria-label="Pickup status and actions">
          <ContentCard className="ym23-status-card" title="Pickup status">
            <span className={`ym23-details-status ym23-details-status--${stop.status}`}>
              <StatusBadge status={statusLabel} />
            </span>
            <p className="ym23-status-card-id">Stop ID: {stop.id}</p>
          </ContentCard>

        </aside>
      </div>

      <div className="ym23-details-actions">
        <Link className="ym-button ym-button--outline" to="/driver/pickups">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Pickup Stops
        </Link>
        <Link className="ym-button ym-button--primary" to={`/driver/pickups/${stop.id}/record`}>
          Record Pickup
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <p className="ym23-details-footer">Every pickup connected. Every handover accounted for.</p>
    </div>
  );
}
