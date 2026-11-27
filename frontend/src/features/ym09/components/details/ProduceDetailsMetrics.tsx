import { Package, Box, Bookmark, BarChart3 } from 'lucide-react';
import type { ProduceListingDetailView } from '../../types/produce';
import { formatKg, formatLkrTotal } from '../../utils/produceFormatters';

interface ProduceDetailsMetricsProps {
  listing: ProduceListingDetailView;
}

export function ProduceDetailsMetrics({ listing }: ProduceDetailsMetricsProps) {
  // Authoritative calculations (DR-01 & DR-06):
  // - Backend reservedKg already includes held, supplier_accepted, and uncollected committed/disputed stock
  //   (availableKg = Math.max(0, offeredKg - reservedKg)). Do not add committedKg on top of reservedKg.
  // - Total valuation multiplies offeredKg by integer unitPriceCents before converting to LKR.
  const totalKg = listing.offeredKg;
  const availableKg = listing.availableKg;
  const reservedKg = listing.reservedKg;
  const totalValueCents = Math.round(totalKg * listing.unitPriceCents);

  return (
    <section className="ym09-details-metrics-grid" aria-label="Produce listing summary statistics">
      {/* 1. Total Quantity */}
      <div className="ym09-metric-card">
        <div className="ym09-metric-header">
          <span className="ym09-metric-label">TOTAL QUANTITY</span>
          <div className="ym09-metric-icon">
            <Package size={17} aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="ym09-metric-value">{formatKg(totalKg)}</div>
          <div className="ym09-metric-subtext">• Offered batch stock</div>
        </div>
      </div>

      {/* 2. Available Quantity */}
      <div className="ym09-metric-card">
        <div className="ym09-metric-header">
          <span className="ym09-metric-label">AVAILABLE QUANTITY</span>
          <div className="ym09-metric-icon">
            <Box size={17} aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="ym09-metric-value">{formatKg(availableKg)}</div>
          <div className="ym09-metric-subtext">• Sellable unreserved stock</div>
        </div>
      </div>

      {/* 3. Reserved Quantity */}
      <div className="ym09-metric-card">
        <div className="ym09-metric-header">
          <span className="ym09-metric-label">RESERVED QUANTITY</span>
          <div className="ym09-metric-icon">
            <Bookmark size={17} aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="ym09-metric-value">{formatKg(reservedKg)} Reserved</div>
          <div className="ym09-metric-subtext">• Active buyer holds &amp; orders</div>
        </div>
      </div>

      {/* 4. Total Value (Highlighted card in warm orange) */}
      <div className="ym09-metric-card ym09-metric-card--highlight">
        <div className="ym09-metric-header">
          <span className="ym09-metric-label">TOTAL VALUE</span>
          <div className="ym09-metric-icon">
            <BarChart3 size={17} aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="ym09-metric-value">{formatLkrTotal(totalValueCents)}</div>
          <div className="ym09-metric-subtext">• Total listing valuation</div>
        </div>
      </div>
    </section>
  );
}
