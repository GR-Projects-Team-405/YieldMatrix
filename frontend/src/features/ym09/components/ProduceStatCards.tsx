import type { ReactNode } from 'react';
import { BarChart3, Bookmark, Package, Tag } from 'lucide-react';
import type { ProducePageSummary } from '../types/produce';

interface ProduceStatCardsProps {
  summary: ProducePageSummary;
}

interface StatItemProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  highlight?: boolean;
}

function StatItem({ label, value, subtext, icon, iconBg, iconColor, highlight = false }: StatItemProps) {
  return (
    <section className={`ym-stat-card ${highlight ? 'ym-stat-card--highlight' : ''}`} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <p className="ym-stat-label" style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: iconBg || 'var(--soft)',
            color: iconColor || 'var(--accent-text)',
            flexShrink: 0,
          }}
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

/**
 * 4 Page-level summary metric cards for My Produce.
 * These metrics provide immediate inventory visibility for the farmer's own listings:
 * 1. Active Produce Listings
 * 2. Available Quantity (kg)
 * 3. Reserved Quantity
 * 4. Total Value (LKR)
 */
export function ProduceStatCards({ summary }: ProduceStatCardsProps) {
  const formattedValue = Math.round(summary.totalValueCents / 100).toLocaleString('en-US');

  return (
    <div
      className="ym09-produce-stats-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}
    >
      {/* 1. Active Produce Listings */}
      <StatItem
        label="ACTIVE PRODUCE LISTINGS"
        icon={<Tag size={16} />}
        value={
          <>
            <span>{summary.activeListingsCount}</span>
            <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
              products
            </span>
          </>
        }
        subtext={summary.activeListingsTrend}
      />

      {/* 2. Available Quantity */}
      <StatItem
        label="AVAILABLE QUANTITY"
        icon={<Package size={16} />}
        value={
          <>
            <span>{summary.availableQuantityKg}</span>
            <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
              kg
            </span>
          </>
        }
        subtext={summary.availableQuantityTrend}
      />

      {/* 3. Reserved Quantity */}
      <StatItem
        label="RESERVED QUANTITY"
        icon={<Bookmark size={16} />}
        value={
          <>
            <span>{summary.reservedQuantityKg}</span>
            <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '6px', color: 'var(--muted)' }}>
              Reserved
            </span>
          </>
        }
        subtext={summary.reservedQuantityTrend}
      />

      {/* 4. Total Value (Highlight Warm Orange Card) */}
      <StatItem
        label="TOTAL VALUE"
        highlight={true}
        icon={<BarChart3 size={16} />}
        iconBg="#263A31"
        iconColor="#ffffff"
        value={
          <>
            <span style={{ fontSize: '16px', fontWeight: 600, marginRight: '4px' }}>LKR</span>
            <span>{formattedValue}</span>
          </>
        }
        subtext={summary.totalValueTrend}
      />
    </div>
  );
}
