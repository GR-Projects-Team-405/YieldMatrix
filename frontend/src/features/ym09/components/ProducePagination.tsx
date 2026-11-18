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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingTop: '8px',
      }}
    >
      {/* 1. Showing range summary */}
      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Showing <strong>{startIndex}</strong> – <strong>{endIndex}</strong> of{' '}
        <strong>{total}</strong> products
      </div>

      {/* 2. Page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Previous Button */}
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
            opacity: page <= 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {/* Numbered Pages */}
        {pageNumbers.map((p) => {
          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isCurrent ? 600 : 500,
                border: isCurrent ? '1px solid #315A42' : '1px solid var(--border)',
                background: isCurrent ? '#315A42' : 'var(--surface)',
                color: isCurrent ? '#ffffff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            opacity: page >= totalPages ? 0.4 : 1,
          }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
