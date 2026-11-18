import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import type { ProduceListingView } from '../types/produce';
import { formatKg, formatLkrPrice } from '../utils/produceFormatters';
import { ProduceActionMenu } from './ProduceActionMenu';

interface ProduceTableProps {
  listings: ProduceListingView[];
  loading?: boolean;
  onResetFilters: () => void;
}

/**
 * Alternate semantic table view for produce listings.
 * Reuses the shared Table and TableRow components.
 */
export function ProduceTable({ listings, loading = false, onResetFilters }: ProduceTableProps) {
  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }} role="status">
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
    <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <Table headers={headers}>
        {listings.map((listing) => {
          const formattedDate = new Date(listing.validUntil).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          return (
            <TableRow key={listing.id}>
              {/* 1. Produce (Thumbnail + Name + Grade) */}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {listing.imageUrl ? (
                    <img
                      src={listing.imageUrl}
                      alt=""
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'var(--soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-text)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {listing.cropName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '14px' }}>
                      {listing.cropName}
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
                {formattedDate}
              </td>

              {/* 9. Actions */}
              <td style={{ textAlign: 'right' }}>
                <ProduceActionMenu produceName={listing.cropName} />
              </td>
            </TableRow>
          );
        })}
      </Table>
    </div>
  );
}
