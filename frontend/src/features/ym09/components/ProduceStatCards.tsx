import type { ReactNode } from 'react';
import { BarChart3, Bookmark, Package, Tag } from 'lucide-react';
import type { ProducePageSummary } from '../types/produce';

interface ProduceStatCardsProps {
  summary: ProducePageSummary | null;
  loading?: boolean;
  error?: boolean;
}

interface StatItemProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon: ReactNode;
  highlight?: boolean;
  busy?: boolean;
}

function StatItem({
  label,
  value,
  subtext,
  icon,
  highlight = false,
  busy = false,
}: StatItemProps) {
  return (
    <section
      className={`ym-stat-card ${highlight ? 'ym-stat-card--highlight' : ''}`}
      style={{ position: 'relative' }}
      aria-busy={busy || undefined}
    >
      <div className="ym09-stat-card-top">
        <p className="ym-stat-label" style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <div
          className={`ym09-stat-icon ${highlight ? 'ym09-stat-icon--highlight' : ''}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <div className="ym-stat-value" style={{ display: 'flex', alignItems: 'baseline', marginTop: '16px' }}>
        {value}
      </div>

      {subtext && (
        <p className="ym-stat-subtext" style={{ marginTop: '12px' }}>
          {subtext}
        </p>
      )}
    </section>
  );
}

function formatMetricKgValue(kg: number): string {
  return Number(kg.toFixed(3)).toLocaleString('en-US');
}

/**
 * 4 Page-level summary metric cards for My Produce.
 * Renders real metrics when available, skeleton placeholders while loading,
 * and an explicit "Unavailable" state when live API data cannot be loaded
 * (never substituting development sample figures).
 */
export function ProduceStatCards({
  summary,
  loading = false,
  error = false,
}: ProduceStatCardsProps) {
  const isInitialLoading = loading && !summary;
  const isUnavailable = error || (!loading && !summary);

  const formattedValue = summary
    ? Math.round(summary.totalValueCents / 100).toLocaleString('en-US')
    : null;

  const placeholderValue = isInitialLoading ? '...' : '—';
  const placeholderSubtext = isInitialLoading ? 'Loading metrics...' : 'Data unavailable';

  return (
    <div
      className="ym09-produce-stats-grid"
      data-testid="produce-stat-cards"
      data-state={
        isInitialLoading ? 'loading' : isUnavailable ? 'unavailable' : 'ready'
      }
    >
      {/* 1. Active Produce Listings */}
      <StatItem
        label="ACTIVE PRODUCE LISTINGS"
        icon={<Tag size={16} />}
        busy={isInitialLoading}
        value={
          summary && !isUnavailable ? (
            <>
              <span>{summary.activeListingsCount}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
                products
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{placeholderValue}</span>
          )
        }
        subtext={summary && !isUnavailable ? summary.activeListingsTrend : placeholderSubtext}
      />

      {/* 2. Available Quantity */}
      <StatItem
        label="AVAILABLE QUANTITY"
        icon={<Package size={16} />}
        busy={isInitialLoading}
        value={
          summary && !isUnavailable ? (
            <>
              <span>{formatMetricKgValue(summary.availableQuantityKg)}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
                kg
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{placeholderValue}</span>
          )
        }
        subtext={summary && !isUnavailable ? summary.availableQuantityTrend : placeholderSubtext}
      />

      {/* 3. Reserved Quantity */}
      <StatItem
        label="RESERVED QUANTITY"
        icon={<Bookmark size={16} />}
        busy={isInitialLoading}
        value={
          summary && !isUnavailable ? (
            <>
              <span>{formatMetricKgValue(summary.reservedQuantityKg)}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
                Reserved
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{placeholderValue}</span>
          )
        }
        subtext={summary && !isUnavailable ? summary.reservedQuantityTrend : placeholderSubtext}
      />

      {/* 4. Total Value (Highlight Warm Orange Card) */}
      <StatItem
        label="TOTAL VALUE"
        highlight={true}
        icon={<BarChart3 size={16} />}
        busy={isInitialLoading}
        value={
          summary && !isUnavailable ? (
            <>
              <span style={{ fontSize: '16px', fontWeight: 600, marginRight: '4px' }}>LKR</span>
              <span>{formattedValue}</span>
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{placeholderValue}</span>
          )
        }
        subtext={summary && !isUnavailable ? summary.totalValueTrend : placeholderSubtext}
      />
    </div>
  );
}
