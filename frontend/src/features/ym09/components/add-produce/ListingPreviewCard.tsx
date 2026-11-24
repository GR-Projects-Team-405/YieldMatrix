import { Eye, MapPin, Package, CalendarDays, Info, ArrowUpRight } from 'lucide-react';
import type { AddProduceFormState } from '../../types/produce';
import { formatDateRangePreview, formatKg } from '../../utils/produceFormatters';

interface ListingPreviewCardProps {
  formState: AddProduceFormState;
  activeImageUrl: string;
}

export function ListingPreviewCard({ formState, activeImageUrl }: ListingPreviewCardProps) {
  const cropTitle = formState.cropName || 'Produce Listing';
  const category = formState.category || 'Vegetables';
  const grade = formState.gradeName || 'Grade A';
  const farm = formState.farmName || 'Certified Farm';
  const price = typeof formState.unitPrice === 'number' && formState.unitPrice > 0 ? formState.unitPrice : 0;
  const quantity = typeof formState.totalQuantity === 'number' && formState.totalQuantity > 0 ? formState.totalQuantity : 0;
  const dateRange = formatDateRangePreview(formState.availableFrom, formState.availableUntil);

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
          <img
            src={activeImageUrl}
            alt={cropTitle}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />

          <div className="ym09-preview-badge">
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#D97706',
              }}
              aria-hidden="true"
            />
            <span>Draft</span>
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
                fontSize: '13px',
                color: 'var(--muted)',
                marginTop: '4px',
              }}
            >
              <ArrowUpRight size={14} color="var(--accent-text)" aria-hidden="true" />
              <span>{category}</span>
              <span aria-hidden="true">•</span>
              <span>{grade}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--muted)',
                marginTop: '4px',
              }}
            >
              <MapPin size={14} color="var(--muted)" aria-hidden="true" />
              <span>{farm}</span>
            </div>
          </div>

          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--green)',
              letterSpacing: '-0.02em',
              margin: '2px 0',
            }}
          >
            LKR {price.toLocaleString('en-US')} / kg
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Package size={16} color="var(--muted)" style={{ marginTop: '2px' }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Quantity
                </span>
                <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                  {formatKg(quantity)}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <CalendarDays size={16} color="var(--muted)" style={{ marginTop: '2px' }} aria-hidden="true" />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Available
                </span>
                <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
                  {dateRange}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Notice Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--canvas)',
          border: '1px solid var(--border)',
          fontSize: '13px',
          color: 'var(--muted)',
          lineHeight: 1.4,
        }}
      >
        <Info size={16} color="var(--muted)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
        <span>The listing will be reviewed and published to the marketplace.</span>
      </div>
    </div>
  );
}
