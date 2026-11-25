import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Calendar,
  ImageOff,
  Layers,
  MapPin,
  Maximize2,
  PauseCircle,
  Pencil,
  PlayCircle,
  Sprout,
  Tag,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import {
  getAvailableListingStatusActions,
  IMAGE_UNAVAILABLE_MESSAGE,
  type ListingStatusActionOption,
} from '../../constants/produceConstants';
import { updateProduceListingStatus } from '../../services/produceApi';
import type { ListingStatus, ProduceListingDetailView } from '../../types/produce';
import {
  formatDisplayDateColombo,
  formatListingStatusLabel,
  formatLkrTotal,
  getListingStatusTone,
} from '../../utils/produceFormatters';

function formatColomboDateRange(fromStr?: string, untilStr?: string): string {
  if (!fromStr && !untilStr) return '—';
  const start = fromStr ? formatDisplayDateColombo(fromStr) : '';
  const end = untilStr ? formatDisplayDateColombo(untilStr) : '';
  return `${start} – ${end}`;
}

function getActionButtonIcon(targetStatus: ListingStatus) {
  switch (targetStatus) {
    case 'active':
      return <PlayCircle size={15} aria-hidden="true" />;
    case 'paused':
      return <PauseCircle size={15} aria-hidden="true" />;
    case 'closed':
    default:
      return <Archive size={15} aria-hidden="true" />;
  }
}

interface ProduceSummaryCardProps {
  listing: ProduceListingDetailView;
  onEditListing?: () => void;
  onStatusUpdated?: (completedAction: ListingStatusActionOption) => void;
  onStatusError?: (message: string) => void;
}

export function ProduceSummaryCard({
  listing,
  onEditListing,
  onStatusUpdated,
  onStatusError,
}: ProduceSummaryCardProps) {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [pendingAction, setPendingAction] = useState<ListingStatusActionOption | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const lightboxTitleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setImageError(false);
  }, [listing.id, listing.imageUrl, listing.status]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousFocus = document.activeElement;
    closeBtnRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [lightboxOpen]);

  const handleEdit = onEditListing || (() => navigate(`/farmer/produce/${listing.id}/edit`));

  const hasValidImage = Boolean(!imageError && listing.imageUrl);
  const statusTone = getListingStatusTone(listing.status);
  const statusLabel = formatListingStatusLabel(listing.status);
  const priceDisplay = formatLkrTotal(listing.unitPriceCents);
  const statusActions = getAvailableListingStatusActions(listing.status, listing.cropName);

  const handleConfirmStatusChange = async () => {
    if (!pendingAction || statusUpdating) return;
    const completedAction = pendingAction;
    setStatusUpdating(true);

    try {
      await updateProduceListingStatus(listing.id, completedAction.targetStatus);
      setPendingAction(null);
      onStatusUpdated?.(completedAction);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to update produce listing status.';
      setPendingAction(null);
      onStatusError?.(msg);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <>
      <section className="ym09-summary-card">
        {/* Left Column: Produce Image Box */}
        <div className="ym09-summary-image-box">
          {hasValidImage ? (
            <>
              <img
                src={listing.imageUrl}
                alt={listing.cropName}
                className="ym09-summary-image"
                onError={() => setImageError(true)}
              />
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="ym09-image-expand-btn"
                aria-label={`Expand ${listing.cropName} image preview`}
                title="Expand produce image"
              >
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="ym09-image-unavailable-fill">
              <ImageOff size={28} strokeWidth={1.5} color="var(--muted)" aria-hidden="true" />
              <span className="ym09-image-unavailable-text">{IMAGE_UNAVAILABLE_MESSAGE}</span>
            </div>
          )}
        </div>

        {/* Middle Column: Title, Status & Metadata */}
        <div className="ym09-summary-info">
          <div className="ym09-summary-title-row">
            <h2 className="ym09-summary-name">{listing.cropName}</h2>
            <span
              className={`ym-status ym-tone--${statusTone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'currentColor',
                }}
                aria-hidden="true"
              />
              {statusLabel}
            </span>
          </div>

          <div className="ym09-summary-meta-list">
            <div className="ym09-summary-meta-item">
              <Sprout size={15} color="var(--green)" aria-hidden="true" />
              <span>
                {listing.category} • {listing.gradeName}
              </span>
            </div>
            <div className="ym09-summary-meta-item">
              <MapPin size={15} color="var(--green)" aria-hidden="true" />
              <span>
                {listing.farmName} ({listing.district})
              </span>
            </div>
            <div className="ym09-summary-meta-item">
              <Layers size={15} color="var(--green)" aria-hidden="true" />
              <span>Harvest Batch: {listing.batchNumber || listing.batchId}</span>
            </div>
            <div className="ym09-summary-meta-item">
              <Calendar size={15} color="var(--green)" aria-hidden="true" />
              <span>Available: {formatColomboDateRange(listing.validFrom, listing.validUntil)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Highlight Price Box */}
        <div className="ym09-summary-actions-col">
          <div className="ym09-summary-action-btns">
            <button
              type="button"
              onClick={handleEdit}
              className="ym09-edit-listing-btn"
              disabled={statusUpdating}
            >
              <Pencil size={15} aria-hidden="true" />
              <span>Edit Listing</span>
            </button>

            {statusActions.map((action) => (
              <button
                key={action.targetStatus}
                type="button"
                onClick={() => setPendingAction(action)}
                className="ym09-status-action-btn"
                disabled={statusUpdating}
              >
                {getActionButtonIcon(action.targetStatus)}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="ym09-price-box">
            <div className="ym09-price-box-icon">
              <Tag size={18} aria-hidden="true" />
            </div>
            <div className="ym09-price-box-content">
              <span className="ym09-price-box-label">Price per kg</span>
              <span className="ym09-price-box-value">
                {priceDisplay} <span className="ym09-price-box-unit">/ kg</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox Modal Dialog (only opened when real imageUrl is present) */}
      {lightboxOpen && hasValidImage && (
        <div
          className="ym09-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={lightboxTitleId}
          onClick={() => setLightboxOpen(false)}
        >
          <div className="ym09-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              ref={closeBtnRef}
              type="button"
              className="ym09-modal-close-btn"
              onClick={() => setLightboxOpen(false)}
              aria-label={`Close ${listing.cropName} image preview`}
              title="Close preview (Esc)"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <h3 id={lightboxTitleId} className="ym09-modal-title">
              {listing.cropName} ({listing.gradeName})
            </h3>
            <div className="ym09-lightbox-stage">
              <img
                src={listing.imageUrl}
                alt={listing.cropName}
                className="ym09-lightbox-image"
              />
            </div>
            <p className="ym09-lightbox-caption">
              {listing.cropName} ({listing.category}) from {listing.farmName}.
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.confirmTitle || 'Update listing status'}
        description={pendingAction?.confirmDescription || ''}
        confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
        busy={statusUpdating}
        onCancel={() => {
          if (!statusUpdating) {
            setPendingAction(null);
          }
        }}
        onConfirm={handleConfirmStatusChange}
      />
    </>
  );
}
