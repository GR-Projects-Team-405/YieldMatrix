import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, Package, Sprout, UserRound } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { mockPickupStops } from './mockPickupStops';
import './ym23.css';

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
  const stop = mockPickupStops.find((pickupStop) => pickupStop.id === stopId);

  if (!stop) {
    return (
      <ContentCard className="ym23-details-not-found">
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

  const locationParts = stop.district.split(',').map((part) => part.trim());
  const district = locationParts[locationParts.length - 1] || stop.district;
  const farmLocation = locationParts.length > 1 ? locationParts.slice(0, -1).join(', ') : stop.district;
  const scheduleParts = stop.pickupTime.split(',');
  const scheduledDate = scheduleParts[0]?.trim() || stop.pickupTime;
  const scheduledTime = scheduleParts.slice(1).join(',').trim() || 'Not specified';
  const statusLabel = stop.status.charAt(0).toUpperCase() + stop.status.slice(1);

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

      <Alert type="info">Demo pickup data only — these details are not connected to a live trip.</Alert>

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
