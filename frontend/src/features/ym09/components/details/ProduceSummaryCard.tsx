import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Sprout, Layers, Calendar, Tag, Pencil, Maximize2, X } from 'lucide-react';
import type { ProduceListingDetailView } from '../../types/produce';
import { getPlaceholderImageForCategory } from '../../constants/produceConstants';
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

interface ProduceSummaryCardProps {
  listing: ProduceListingDetailView;
  onEditListing?: () => void;
}

export function ProduceSummaryCard({ listing, onEditListing }: ProduceSummaryCardProps) {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const lightboxTitleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setImageError(false);
  }, [listing.id, listing.imageUrl]);

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

  const fallbackImage = getPlaceholderImageForCategory(listing.category);
  const imageSrc = !imageError && listing.imageUrl ? listing.imageUrl : fallbackImage;
  const statusTone = getListingStatusTone(listing.status);
  const statusLabel = formatListingStatusLabel(listing.status);
  const priceDisplay = formatLkrTotal(listing.unitPriceCents);

  return (
    <>
      <section className="ym09-summary-card">
        {/* Left Column: Produce Image Box */}
        <div className="ym09-summary-image-box">
          <img
            src={imageSrc}
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
          <button
            type="button"
            onClick={handleEdit}
            className="ym09-edit-listing-btn"
          >
            <Pencil size={15} aria-hidden="true" />
            <span>Edit Listing</span>
          </button>

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

      {/* Lightbox Modal Dialog */}
      {lightboxOpen && (
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
                src={imageSrc}
                alt={listing.cropName}
                className="ym09-lightbox-image"
              />
            </div>
            <p className="ym09-lightbox-caption">
              Standard certified agricultural commodity visual for {listing.cropName} ({listing.category}).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
