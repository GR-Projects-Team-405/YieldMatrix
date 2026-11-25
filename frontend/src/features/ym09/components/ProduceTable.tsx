import { Link, useNavigate } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import {
  IMAGE_UNAVAILABLE_MESSAGE,
  type ListingStatusActionOption,
} from '../constants/produceConstants';
import type { ProduceListingView } from '../types/produce';
import {
  formatDisplayDateColombo,
  formatKg,
  formatLkrPrice,
} from '../utils/produceFormatters';
import { ProduceActionMenu } from './ProduceActionMenu';

interface ProduceTableProps {
  listings: ProduceListingView[];
  loading?: boolean;
  onResetFilters: () => void;
  onSelectStatusAction?: (
    listing: ProduceListingView,
    action: ListingStatusActionOption
  ) => void;
}

/**
 * Alternate semantic table view for produce listings.
 * Keeps standard table row semantics (no role="button" on <tr>) while providing
 * keyboard-accessible Link and ProduceActionMenu controls plus row pointer click navigation.
 */
export function ProduceTable({
  listings,
  loading = false,
  onResetFilters,
  onSelectStatusAction,
}: ProduceTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (e: React.MouseEvent, listingId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="menu"], [role="menuitem"]')) {
      return;
    }
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) {
      return;
    }
    navigate(`/farmer/produce/${listingId}`);
  };

  if (loading) {
    return (
      <div className="ym09-table-loading" role="status">
        Loading produce table...
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

  const headers = [
    'Produce',
    'Category',
    'Farm & District',
    'Status',
    'Price / kg',
    'Available',
    'Reserved',
    'Valid Until',
    'Actions',
  ];

  return (
    <div className="ym09-table-card">
      <Table headers={headers}>
        {listings.map((listing) => (
          <TableRow
            key={listing.id}
            className="ym09-table-row-interactive"
            onClick={(e) => handleRowClick(e, listing.id)}
          >
            {/* 1. Produce (Thumbnail + Name Link + Grade) */}
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {listing.imageUrl ? (
                  <img
                    src={listing.imageUrl}
                    alt={listing.cropName}
                    className="ym09-table-thumb"
                  />
                ) : (
                  <div
                    className="ym09-table-thumb-fallback"
                    title={IMAGE_UNAVAILABLE_MESSAGE}
                    aria-label={IMAGE_UNAVAILABLE_MESSAGE}
                  >
                    <ImageOff size={15} aria-hidden="true" />
                  </div>
                )}
                <div>
                  <strong style={{ display: 'block', fontSize: '14px' }}>
                    <Link
                      to={`/farmer/produce/${listing.id}`}
                      className="ym09-produce-link"
                      aria-label={`View details for ${listing.cropName}`}
                    >
                      {listing.cropName}
                    </Link>
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {listing.gradeName}
                  </span>
                </div>
              </div>
            </td>

            {/* 2. Category */}
            <td style={{ color: 'var(--text)', fontSize: '13px' }}>{listing.category}</td>

            {/* 3. Farm & District */}
            <td>
              <span style={{ display: 'block', color: 'var(--text)', fontSize: '13px', fontWeight: 500 }}>
                {listing.farmName}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{listing.district}</span>
            </td>

            {/* 4. Status */}
            <td>
              <StatusBadge status={listing.status} />
            </td>

            {/* 5. Price */}
            <td style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {formatLkrPrice(listing.unitPriceCents)}
            </td>

            {/* 6. Available */}
            <td style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}>
              <strong>{formatKg(listing.availableKg)}</strong>
            </td>

            {/* 7. Reserved */}
            <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {formatKg(listing.reservedKg)}
            </td>

            {/* 8. Valid Until */}
            <td style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {formatDisplayDateColombo(listing.validUntil)}
            </td>

            {/* 9. Actions (stops row click propagation) */}
            <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
              <ProduceActionMenu
                produceName={listing.cropName}
                listingId={listing.id}
                currentStatus={listing.status}
                onSelectStatusAction={
                  onSelectStatusAction
                    ? (action) => onSelectStatusAction(listing, action)
                    : undefined
                }
              />
            </td>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
