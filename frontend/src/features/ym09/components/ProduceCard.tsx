import { useState } from 'react';
import { MapPin, Package, Sprout } from 'lucide-react';
import type { ProduceListingView } from '../types/produce';
import { formatKg, formatListingStatusLabel } from '../utils/produceFormatters';
import { ProduceActionMenu } from './ProduceActionMenu';

interface ProduceCardProps {
  listing: ProduceListingView;
}

/**
 * Individual produce listing card for the grid view.
 * Matches the design reference:
 * - High-quality photo with floating status badge (and SVG placeholder fallback)
 * - Crop title and category
 * - Farm location
 * - Price per kg in LKR
 * - Available stock, reserved quantity, and context action trigger
 */
export function ProduceCard({ listing }: ProduceCardProps) {
  const [imageError, setImageError] = useState(false);

  const priceRupees = Math.round(listing.unitPriceCents / 100).toLocaleString('en-US');
  const statusLabel = formatListingStatusLabel(listing.status);

  // Status badge tone styling
  const isStatusActive = listing.status === 'active';
  const isStatusDraft = listing.status === 'draft';
  const statusBg = isStatusActive
    ? 'rgba(234, 242, 232, 0.95)'
    : isStatusDraft
    ? 'rgba(255, 240, 227, 0.95)'
    : 'rgba(238, 241, 236, 0.95)';
  const statusColor = isStatusActive
    ? '#315A42'
    : isStatusDraft
    ? '#854500'
    : '#4f6155';
  const dotColor = isStatusActive ? '#2e7d32' : isStatusDraft ? '#e65100' : '#757575';

  return (
    <article
      className="ym09-produce-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      {/* 1. Image Header with Floating Status Badge */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '180px',
          background: 'var(--canvas)',
          overflow: 'hidden',
        }}
      >
        {!imageError && listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.cropName}
            onError={() => setImageError(true)}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          /* FR-FARM-10: Fallback placeholder when no image exists or load fails */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--soft) 0%, var(--canvas) 100%)',
              color: 'var(--accent-text)',
              gap: '8px',
            }}
          >
            <Sprout size={36} strokeWidth={1.5} aria-hidden="true" />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>
              {listing.cropName}
            </span>
          </div>
        )}

        {/* Floating Status Badge */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: statusBg,
            color: statusColor,
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: dotColor,
            }}
            aria-hidden="true"
          />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* 2. Card Body */}
      <div style={{ padding: '16px', display: 'grid', gap: '8px', flex: '1 0 auto' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {listing.cropName}
        </h2>

        {/* Category Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--muted)' }}>
          <Sprout size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} aria-hidden="true" />
          <span>{listing.category}</span>
        </div>

        {/* Farm Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--muted)' }}>
          <MapPin size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} aria-hidden="true" />
          <span>{listing.farmName}</span>
        </div>

        {/* Price Line */}
        <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text)' }}>
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
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface)',
          gap: '8px',
        }}
      >
        {/* Available Stock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ fontSize: '11px', lineHeight: 1.2 }}>
            <span style={{ color: 'var(--muted)', display: 'block' }}>Available</span>
            <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
              {formatKg(listing.availableKg)}
            </strong>
          </div>
        </div>

        {/* Reserved Stock */}
        <div style={{ fontSize: '11px', lineHeight: 1.2 }}>
          <span style={{ color: 'var(--muted)', display: 'block' }}>Reserved</span>
          <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
            {formatKg(listing.reservedKg)}
          </strong>
        </div>

        {/* Action Menu */}
        <ProduceActionMenu produceName={listing.cropName} listingId={listing.id} />
      </div>
    </article>
  );
}
