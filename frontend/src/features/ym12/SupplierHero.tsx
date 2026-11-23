import { BadgeCheck, Building2, MapPin, Sprout, Star } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { SupplierProfileResponse } from './types';
import { formatDateRange } from './formatters';

export function SupplierHero({ data }: { data: SupplierProfileResponse }) {
  const { supplier } = data;
  const location = [supplier.businessType, `${supplier.district} district`, supplier.country]
    .filter(Boolean)
    .join(' · ');
  const memberSince = supplier.memberSince
    ? formatDateRange(supplier.memberSince, supplier.memberSince)
    : null;

  return <section className="ym12-profile-hero" aria-label="Supplier information">
    <div className="ym12-profile-identity">
      <span className="ym12-profile-logo" aria-hidden="true">
        {supplier.businessType ? <Building2 size={30} /> : <Sprout size={30} />}
      </span>
      <div className="ym12-profile-identity-copy">
        <div className="ym12-profile-name-line">
          <h2>{supplier.name}</h2>
          {supplier.verified
            ? <StatusBadge status="Verified supplier" />
            : <span className="ym12-profile-unverified"><BadgeCheck size={16} aria-hidden="true" />Verification not recorded</span>}
          {data.dataSource === 'sample' && <StatusBadge status="Sample data" />}
        </div>
        <p className="ym12-profile-location"><MapPin size={16} aria-hidden="true" />{location}</p>
        {supplier.tagline && <p className="ym12-profile-tagline">{supplier.tagline}</p>}
        {supplier.operatingSinceYear !== null && <p className="ym12-profile-tagline">
          Supplying fresh, seasonal vegetables since {supplier.operatingSinceYear}
        </p>}
      </div>
    </div>
    <div className="ym12-profile-trust">
      {supplier.rating !== null
        ? <div className="ym12-profile-rating">
          <Star size={20} aria-hidden="true" />
          <strong>{supplier.rating.toFixed(1)} / 5</strong>
          <span>{supplier.ratingCount === null ? 'Buyer rating' : `Based on ${supplier.ratingCount} buyer reviews`}</span>
        </div>
        : <p className="ym12-profile-no-rating">No reviews yet</p>}
      {memberSince && <p className="ym12-profile-member">Member since {memberSince}</p>}
    </div>
  </section>;
}
