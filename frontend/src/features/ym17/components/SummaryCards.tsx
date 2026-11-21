import { ArrowUpRight } from 'lucide-react';
import type { AllocationSummary } from '../types';

interface SummaryCardsProps {
  /** Live summary from GET /api/ym17/summary, or null while loading or after a failure. */
  summary: AllocationSummary | null;
  /** True while the summary request is in flight. */
  loading?: boolean;
}

/**
 * 4 metric cards for the Allocation Inbox matching Figma layout:
 * - Pending Responses
 * - Accepted Allocations
 * - Declined Allocations
 * - Expiring Soon
 *
 * Values always come from the API. While loading or after a failure the cards
 * show an unavailable state instead of a fabricated zero.
 */
export function SummaryCards({ summary, loading = false }: SummaryCardsProps) {
  const cards = [
    {
      label: 'PENDING RESPONSES',
      value: summary?.pendingResponses,
      subtext: 'Waiting for your decision',
    },
    {
      label: 'ACCEPTED ALLOCATIONS',
      value: summary?.acceptedAllocations,
      subtext: 'Supplier accepted',
    },
    {
      label: 'DECLINED ALLOCATIONS',
      value: summary?.declinedAllocations,
      subtext: 'Requests declined',
    },
    {
      label: 'EXPIRING SOON',
      value: summary?.expiringSoon,
      subtext: 'Respond before the hold expires',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="region" aria-label="Allocation summary metrics">
      {cards.map((card) => (
        <section
          key={card.label}
          className="ym-stat-card bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="ym-stat-label text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              {card.label}
            </span>
            <ArrowUpRight size={16} className="text-[var(--muted)] opacity-70" aria-hidden="true" />
          </div>
          <p className="ym-stat-value text-3xl font-bold mt-3 text-[var(--text)]">
            {loading ? '—' : card.value === undefined ? '—' : String(card.value).padStart(2, '0')}
          </p>
          <p className="ym-stat-subtext text-xs text-[var(--muted)] mt-2">
            {loading ? 'Loading…' : card.value === undefined ? 'Temporarily unavailable' : card.subtext}
          </p>
        </section>
      ))}
    </div>
  );
}
