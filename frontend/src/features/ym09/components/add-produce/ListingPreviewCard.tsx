import { useEffect, useState } from 'react';
import { Eye, MapPin, Package, CalendarDays, Info, ArrowUpRight, ImageOff } from 'lucide-react';
import { IMAGE_UNAVAILABLE_MESSAGE } from '../../constants/produceConstants';
import type { AddProduceFormState, ListingStatus } from '../../types/produce';
import {
  formatDateRangePreview,
  formatKg,
  formatListingStatusLabel,
} from '../../utils/produceFormatters';

interface ListingPreviewCardProps {
  formState: AddProduceFormState;
  activeImageUrl?: string;
}

function getPreviewStatusDotColor(status: ListingStatus): string {
  switch (status) {
    case 'active':
      return '#15803D';
    case 'draft':
      return '#D97706';
    case 'expired':
      return '#B91C1C';
    case 'paused':
    case 'closed':
    default:
      return '#6B7280';
  }
}

export function ListingPreviewCard({ formState, activeImageUrl }: ListingPreviewCardProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [activeImageUrl]);

  const cropTitle = formState.cropName || 'Produce Listing';
  const category = formState.category || 'Vegetables';
  const grade = formState.gradeName || 'Grade pending';
  const farm = formState.farmName || 'Certified Farm';
  const price = typeof formState.unitPrice === 'number' && formState.unitPrice > 0 ? formState.unitPrice : 0;
  const quantity = typeof formState.totalQuantity === 'number' && formState.totalQuantity > 0 ? formState.totalQuantity : 0;
  const dateRange = formatDateRangePreview(formState.availableFrom, formState.availableUntil);
  const previewStatus: ListingStatus = formState.status || 'active';
  const statusLabel = formatListingStatusLabel(previewStatus);
  const hasImage = Boolean(!imageError && activeImageUrl);

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--soft)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Eye size={20} aria-hidden="true" />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Listing Preview
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            How your produce will appear to buyers.
          </p>
        </div>
      </div>

      {/* Preview Card */}
      <div className="ym-content-card ym09-listing-preview-card ym09-preview-card">
        {/* Produce Image Container with Status Badge */}
        <div className="ym09-preview-media">
          {hasImage ? (
            <img
              src={activeImageUrl}
              alt={cropTitle}
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div className="ym09-image-unavailable-fill">
              <ImageOff size={28} strokeWidth={1.5} color="var(--muted)" aria-hidden="true" />
              <span className="ym09-image-unavailable-text">{IMAGE_UNAVAILABLE_MESSAGE}</span>
            </div>
          )}

          <div className="ym09-preview-badge">
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: getPreviewStatusDotColor(previewStatus),
              }}
              aria-hidden="true"
            />
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: '20px', display: 'grid', gap: '12px' }}>
          <div>
            <h4
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              {cropTitle}
            </h4>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                color: 'var(--muted)',
                marginTop: '4px',
              }}
            >
              <span>{category}</span>
              <span>•</span>
              <span>{grade}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={15} color="var(--green)" aria-hidden="true" />
              <span>{farm}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={15} color="var(--green)" aria-hidden="true" />
              <span>Available: {formatKg(quantity)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={15} color="var(--green)" aria-hidden="true" />
              <span>{dateRange}</span>
            </div>
          </div>

          {/* Highlighted Pricing Bar */}
          <div className="ym09-preview-price-bar">
            <span className="ym09-preview-price-label">Price per kg</span>
            <div className="ym09-preview-price-value">
              <span className="ym09-preview-price-num">
                LKR {price > 0 ? price.toLocaleString('en-US') : '—'}
              </span>
              {price > 0 && <span className="ym09-preview-price-unit"> / kg</span>}
            </div>
          </div>
        </div>

        {/* Footer Info Note */}
        <div className="ym09-preview-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontSize: '11.5px' }}>
            <Info size={14} color="var(--muted)" aria-hidden="true" />
            <span>Prices update automatically based on grade</span>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--muted)',
            }}
          >
            <span>Preview</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
