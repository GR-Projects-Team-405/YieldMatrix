import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImageOff, MapPin, Package, Sprout } from 'lucide-react';
import {
  IMAGE_UNAVAILABLE_MESSAGE,
  type ListingStatusActionOption,
} from '../constants/produceConstants';
import type { ProduceListingView } from '../types/produce';
import {
  formatKg,
  formatListingStatusLabel,
  getListingStatusTone,
} from '../utils/produceFormatters';
import { ProduceActionMenu } from './ProduceActionMenu';

interface ProduceCardProps {
  listing: ProduceListingView;
  onSelectStatusAction?: (
    listing: ProduceListingView,
    action: ListingStatusActionOption
  ) => void;
}

/**
 * Individual produce listing card for the grid view.
 * Avoids nested interactive ARIA roles: the crop heading Link and ProduceActionMenu
 * are independent focusable controls, while pointer clicks on card whitespace open Details.
 */
export function ProduceCard({ listing, onSelectStatusAction }: ProduceCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [listing.id, listing.imageUrl]);

  const priceRupees = Math.round(listing.unitPriceCents / 100).toLocaleString('en-US');
  const statusLabel = formatListingStatusLabel(listing.status);
  const statusTone = getListingStatusTone(listing.status);
  const titleId = `produce-card-title-${listing.id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="menu"], [role="menuitem"]')) {
      return;
    }
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) {
      return;
    }
    navigate(`/farmer/produce/${listing.id}`);
  };

  return (
    <article
      className="ym09-produce-card ym09-card-interactive"
      aria-labelledby={titleId}
      onClick={handleCardClick}
    >
      {/* 1. Image Header with Semantic Status Badge */}
      <div className="ym09-produce-card-media">
        {!imageError && listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.cropName}
            onError={() => setImageError(true)}
            loading="lazy"
            className="ym09-produce-card-img"
          />
        ) : (
          <div className="ym09-produce-card-fallback">
            <ImageOff size={28} strokeWidth={1.5} color="var(--muted)" aria-hidden="true" />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>
              {IMAGE_UNAVAILABLE_MESSAGE}
            </span>
          </div>
        )}

        <span className={`ym-status ym-tone--${statusTone} ym09-produce-card-status`}>
          <span className="ym09-produce-card-status-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>
      </div>

      {/* 2. Card Body */}
      <div className="ym09-produce-card-body">
        <h2 id={titleId} className="ym09-produce-card-title">
          <Link
            to={`/farmer/produce/${listing.id}`}
            className="ym09-produce-link"
            aria-label={`View details for ${listing.cropName}`}
          >
            {listing.cropName}
          </Link>
        </h2>

        <div className="ym09-produce-card-meta">
          <Sprout size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} aria-hidden="true" />
          <span>{listing.category}</span>
        </div>

        <div className="ym09-produce-card-meta">
          <MapPin size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} aria-hidden="true" />
          <span>{listing.farmName}</span>
        </div>

        <div className="ym09-produce-card-price">
          <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--muted)', marginRight: '4px' }}>
            LKR
          </span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
            {priceRupees}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '4px' }}>
            / kg
          </span>
        </div>
      </div>

      {/* 3. Card Footer / Stock Row */}
      <div className="ym09-produce-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ fontSize: '11px', lineHeight: 1.2 }}>
            <span style={{ color: 'var(--muted)', display: 'block' }}>Available</span>
            <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
              {formatKg(listing.availableKg)}
            </strong>
          </div>
        </div>

        <div style={{ fontSize: '11px', lineHeight: 1.2 }}>
          <span style={{ color: 'var(--muted)', display: 'block' }}>Reserved</span>
          <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
            {formatKg(listing.reservedKg)}
          </strong>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <ProduceActionMenu
            produceName={listing.cropName}
            listingId={listing.id}
            currentStatus={listing.status}
            onSelectStatusAction={
              onSelectStatusAction
                ? (action) => onSelectStatusAction(listing, action)
                : undefined
            }
          />
        </div>
      </div>
    </article>
  );
}
