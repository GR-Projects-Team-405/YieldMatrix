import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import type { ListingStatusActionOption } from '../constants/produceConstants';
import type { ProduceListingView } from '../types/produce';
import { ProduceCard } from './ProduceCard';

interface ProduceGridProps {
  listings: ProduceListingView[];
  loading?: boolean;
  onResetFilters: () => void;
  onSelectStatusAction?: (
    listing: ProduceListingView,
    action: ListingStatusActionOption
  ) => void;
}

/**
 * Responsive 4-column grid container for produce listing cards.
 * Handles loading skeletons and empty filter states.
 */
export function ProduceGrid({
  listings,
  loading = false,
  onResetFilters,
  onSelectStatusAction,
}: ProduceGridProps) {
  if (loading) {
    return (
      <div
        className="ym09-produce-grid"
        role="status"
        aria-label="Loading produce listings"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ym09-grid-skeleton-card">
            <div style={{ height: '180px', background: 'var(--soft)' }} />
            <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
              <div style={{ height: '18px', width: '60%', background: 'var(--canvas)', borderRadius: '4px' }} />
              <div style={{ height: '14px', width: '40%', background: 'var(--canvas)', borderRadius: '4px' }} />
              <div style={{ height: '14px', width: '50%', background: 'var(--canvas)', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No produce found"
        description="No listings match your selected category, farm, or search criteria. Try adjusting your filters."
        action={
          <Button variant="outline" onClick={onResetFilters}>
            Reset Filters
          </Button>
        }
      />
    );
  }

  return (
    <div className="ym09-produce-grid">
      {listings.map((listing) => (
        <ProduceCard
          key={listing.id}
          listing={listing}
          onSelectStatusAction={onSelectStatusAction}
        />
      ))}
    </div>
  );
}
