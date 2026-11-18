import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import type { ProduceListingView } from '../types/produce';
import { ProduceCard } from './ProduceCard';

interface ProduceGridProps {
  listings: ProduceListingView[];
  loading?: boolean;
  onResetFilters: () => void;
}

/**
 * Responsive 4-column grid container for produce listing cards.
 * Handles loading skeletons and empty filter states.
 */
export function ProduceGrid({ listings, loading = false, onResetFilters }: ProduceGridProps) {
  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '20px',
        }}
        role="status"
        aria-label="Loading produce listings"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: '340px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              opacity: 0.6,
            }}
          >
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
    <div
      className="ym09-produce-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '20px',
      }}
    >
      {listings.map((listing) => (
        <ProduceCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
