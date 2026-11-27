import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Search,
  Sprout,
  Store,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { getProduceImage } from './produceImages';
import type { MarketplaceItem } from './types';
import { formatColomboShortDate, formatKg, formatLkrFromCents } from './utils';

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
  const imageSrc = getProduceImage(item.cropName, item.category);

  const availabilityHref = `/buyer/marketplace/harvest-availability${
    harvestMonth ? `?month=${encodeURIComponent(harvestMonth)}&cropId=${encodeURIComponent(item.cropId)}` : ''
  }`;

  return (
    <article className="ym11-produce-card">
      <div className="ym11-produce-photo-wrap">
        <img
          src={imageSrc}
          alt={`${item.cropName} from ${item.farmName}`}
          className="ym11-produce-photo"
          loading="lazy"
        />

        <div className="ym11-photo-overlay">
          <span
            className={`ym11-photo-pill ${
              isAvailableNow ? 'ym11-photo-pill--now' : 'ym11-photo-pill--planned'
            }`}
          >
            <span className="ym11-photo-pill-dot" aria-hidden="true" />
            {isAvailableNow ? 'Available now' : 'Expected harvest'}
          </span>

          <button
            type="button"
            className={`ym11-fav-btn ${saved ? 'is-saved' : ''}`}
            aria-label={saved ? `Remove ${item.cropName} from saved` : `Save ${item.cropName}`}
            aria-pressed={saved}
            onClick={() => onToggleSave(item.id)}
          >
            <Heart size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
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
          <span className="ym11-farm-badge" aria-hidden="true">
            <Sprout size={14} />
          </span>
          <div className="ym11-grower-meta">
            <p className="ym11-grower-name">{item.farmName}</p>
            <p className="ym11-grower-detail">{item.district}</p>
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
              View harvest availability
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
