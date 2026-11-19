import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Heart,
  MapPin,
  Search,
  Store,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import type { MarketplaceItem } from './types';
import { formatColomboShortDate, formatKg, formatLkrFromCents, getInitials } from './utils';

export function MarketplaceSubnav() {
  return (
    <nav className="ym11-subnav" aria-label="Marketplace views">
      <NavLink
        to="/buyer/marketplace"
        end
        className={({ isActive }) => `ym11-subnav-link ${isActive ? 'is-active' : ''}`}
      >
        <Store size={14} aria-hidden="true" />
        Explore Marketplace
      </NavLink>
      <NavLink
        to="/buyer/marketplace/search"
        className={({ isActive }) => `ym11-subnav-link ${isActive ? 'is-active' : ''}`}
      >
        <Search size={14} aria-hidden="true" />
        Search Results
      </NavLink>
      <NavLink
        to="/buyer/marketplace/harvest-availability"
        className={({ isActive }) => `ym11-subnav-link ${isActive ? 'is-active' : ''}`}
      >
        <CalendarDays size={14} aria-hidden="true" />
        Harvest Availability
      </NavLink>
    </nav>
  );
}

interface ProduceCardProps {
  item: MarketplaceItem;
  saved: boolean;
  onToggleSave: (id: string) => void;
  showAvailabilityButton?: boolean;
}

export function ProduceCard({
  item,
  saved,
  onToggleSave,
  showAvailabilityButton = false,
}: ProduceCardProps) {
  const navigate = useNavigate();
  const isAvailableNow = item.availabilityStatus === 'available_now';
  const harvestMonth = item.harvestDate ? item.harvestDate.slice(0, 7) : '';

  const availabilityHref = `/buyer/marketplace/harvest-availability${
    harvestMonth ? `?month=${encodeURIComponent(harvestMonth)}&cropId=${encodeURIComponent(item.cropId)}` : ''
  }`;

  return (
    <article className="ym11-produce-card">
      <div className={`ym11-produce-banner ym11-produce-banner--${item.category}`}>
        <svg className="ym11-banner-art" viewBox="0 0 320 140" preserveAspectRatio="none" aria-hidden="true">
          <circle cx="270" cy="24" r="56" fill="#ffffff" opacity="0.22" />
          <circle cx="64" cy="128" r="68" fill="#ffffff" opacity="0.16" />
          <path d="M0 110 Q100 68 200 100 T320 82 L320 140 L0 140 Z" fill="#ffffff" opacity="0.2" />
        </svg>

        <div className="ym11-banner-overlay">
          <StatusBadge status={isAvailableNow ? 'Active' : 'Pending'} />
          <button
            type="button"
            className={`ym11-fav-btn ${saved ? 'is-saved' : ''}`}
            aria-label={saved ? `Remove ${item.cropName} from saved` : `Save ${item.cropName}`}
            aria-pressed={saved}
            onClick={() => onToggleSave(item.id)}
          >
            <Heart size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="ym11-produce-body">
        <div className="ym11-produce-top">
          <div>
            <h4 className="ym11-produce-name">{item.cropName}</h4>
            <p className="ym11-produce-grade">{item.gradeName}</p>
          </div>
          <p className="ym11-produce-price">
            {item.unitPriceCents !== null ? `${formatLkrFromCents(item.unitPriceCents)}/kg` : 'Price on inquiry'}
          </p>
        </div>

        <div className="ym11-produce-farm">
          <span className="ym11-avatar ym11-avatar--0" aria-hidden="true">
            {getInitials(item.farmName)}
          </span>
          <div className="ym11-grower-meta">
            <p className="ym11-grower-name">{item.farmName}</p>
            <p className="ym11-grower-detail" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} aria-hidden="true" />
              {item.district}
            </p>
          </div>
        </div>

        <div className="ym11-produce-metrics">
          <div>
            <p className="ym11-metric-label">{isAvailableNow ? 'Available' : 'Expected qty'}</p>
            <p className="ym11-metric-val">{formatKg(item.availableKg)}</p>
          </div>
          <div>
            <p className="ym11-metric-label">{isAvailableNow ? 'Harvest' : 'Expected date'}</p>
            <p className="ym11-metric-val">
              {item.harvestDate ? formatColomboShortDate(item.harvestDate) : isAvailableNow ? 'Available now' : 'Planned'}
            </p>
          </div>
        </div>

        <div className="ym11-produce-actions">
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                `/buyer/produce?batchId=${encodeURIComponent(item.batchId)}${
                  item.listingId ? `&listingId=${encodeURIComponent(item.listingId)}` : ''
                }`
              )
            }
          >
            View details
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
          {showAvailabilityButton && (
            <Button variant="outline" onClick={() => navigate(availabilityHref)}>
              Harvest availability
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
