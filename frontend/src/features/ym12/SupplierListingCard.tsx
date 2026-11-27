import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ProduceImage } from './ProduceImage';
import { formatDateRange, formatKg, formatLkr } from './formatters';
import type { SupplierActiveListing } from './types';

export function SupplierListingCard({ listing }: { listing: SupplierActiveListing }) {
  return <article className="ym12-profile-listing">
    <ProduceImage imageUrl={listing.imageUrl} cropName={listing.cropName} />
    <div className="ym12-profile-listing-content">
      <div className="ym12-profile-listing-heading">
        <h3>{listing.cropName}</h3>
        <StatusBadge status={listing.grade} />
      </div>
      <p className="ym12-profile-listing-quantity">{formatKg(listing.availableKg)} available · {listing.district}</p>
      <p className="ym12-profile-listing-harvest">Harvest: {formatDateRange(listing.harvestStart, listing.harvestEnd)}</p>
      <p className="ym12-profile-listing-price"><strong>{formatLkr(listing.pricePerKgCents)} LKR per kg</strong></p>
      <Link className="ym-button ym-button--primary ym12-view-produce" to={`/buyer/produce/${encodeURIComponent(listing.listingId)}`}>
        View produce <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  </article>;
}
