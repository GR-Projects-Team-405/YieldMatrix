import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProducePaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

/**
 * Pagination footer control for My Produce.
 * Displays "Showing X - Y of Z products" on the left
 * and numbered page navigation buttons on the right.
 */
export function ProducePagination({
  total,
  page,
  pageSize,
  onPageChange,
}: ProducePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  const pageNumbers: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav
      className="ym09-produce-pagination"
      aria-label="Produce listing pages"
    >
      {/* 1. Showing range summary */}
      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Showing <strong>{startIndex}</strong> – <strong>{endIndex}</strong> of{' '}
        <strong>{total}</strong> products
      </div>

      {/* 2. Page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="ym09-page-btn"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {pageNumbers.map((p) => {
          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={`ym09-page-btn ${isCurrent ? 'ym09-page-btn--active' : ''}`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="ym09-page-btn"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
