import React from 'react';
import { DollarSign } from 'lucide-react';
import { ProduceListingDetailView } from '../../types/produce';
import {
  formatDisplayDateColombo,
  formatDisplayDateTimeColombo,
  formatKg,
  formatLkrTotal,
} from '../../utils/produceFormatters';

interface OverviewTabProps {
  listing: ProduceListingDetailView;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ listing }) => {
  const totalKg = listing.offeredKg || 0;
  const availPeriod =
    !listing.validFrom && !listing.validUntil
      ? '—'
      : `${formatDisplayDateColombo(listing.validFrom)} – ${formatDisplayDateColombo(listing.validUntil)}`;

  return (
    <div className="ym09-overview-stack" data-testid="overview-tab">
      {/* Listing Information (Full width, 2-column layout on desktop) */}
      <section className="ym09-details-card" aria-labelledby="listing-info-title">
        <header className="ym09-details-card-header">
          <h3 id="listing-info-title" className="ym09-details-card-title">
            <DollarSign size={20} aria-hidden="true" />
            Listing Information
          </h3>
        </header>

        <div className="ym09-overview-info-grid">
          {/* Left Column */}
          <div className="ym09-info-column">
            <table className="ym09-kv-table">
              <tbody>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Produce</th>
                  <td className="ym09-kv-val font-semibold">{listing.cropName}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Grade</th>
                  <td className="ym09-kv-val">{listing.gradeName}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Harvest Batch</th>
                  <td className="ym09-kv-val">{listing.batchNumber || listing.batchId}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Total Quantity</th>
                  <td className="ym09-kv-val">{formatKg(totalKg)}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Created On</th>
                  <td className="ym09-kv-val">{formatDisplayDateTimeColombo(listing.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Column */}
          <div className="ym09-info-column">
            <table className="ym09-kv-table">
              <tbody>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Category</th>
                  <td className="ym09-kv-val">{listing.category}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Farm</th>
                  <td className="ym09-kv-val">{listing.farmName}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Price per kg</th>
                  <td className="ym09-kv-val">{formatLkrTotal(listing.unitPriceCents)}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Availability Period</th>
                  <td className="ym09-kv-val">{availPeriod}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Last Updated</th>
                  <td className="ym09-kv-val">
                    {formatDisplayDateTimeColombo(listing.updatedAt || listing.createdAt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
