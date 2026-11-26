import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AllocationSummary, SummaryCardKey } from '../types';

interface SummaryCardsProps {
  /** Live summary from GET /api/ym17/summary, or null while loading or after a failure. */
  summary: AllocationSummary | null;
  /** True while the summary request is in flight. */
  loading?: boolean;
  /**
   * Activated by click or keyboard on an inbox card. The Progressed card
   * navigates on its own (it needs a route), the other three are handled by
   * the inbox so they can reuse its filter state without duplicating links.
   */
  onSelect?: (card: SummaryCardKey) => void;
}

/**
 * Allocation History renders exactly these operational statuses under its
 * "Progressed" quick tab. The internal `tab=accepted` value is kept for URL
 * compatibility; only the visible label changed.
 */
const HISTORY_PROGRESSED_PATH = '/farmer/allocations/history?tab=accepted';

/**
 * Shared interactive styling for the cards: the whole card is the target,
 * with visible hover, focus-visible and active states so the arrow affordance
 * never suggests a click that does nothing.
 */
const CARD_CLASSES =
  'ym-stat-card group block w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm transition-colors cursor-pointer ' +
  'hover:border-[var(--accent-text)] hover:bg-[var(--canvas)] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] ' +
  'active:bg-[var(--canvas)]';

/**
 * 4 metric cards for the Allocation Inbox matching Figma layout:
 * - Pending Responses   -> inbox, server-filtered to live pending holds
 * - Progressed Allocations -> Allocation History, Progressed tab (grouped
 *               operational statuses: supplier_accepted, committed, picked_up,
 *               handed_over, accepted, partially_accepted — i.e. everything
 *               beyond `held`, NOT farmer acceptance decisions; those are
 *               counted only by the history page's FARMER ACCEPTED card)
 * - Declined Allocations-> inbox, declined tab
 * - Expiring Soon       -> inbox, pending holds nearest their deadline
 *
 * Each destination uses the same predicate the card's number is counted with,
 * so a card never promises more (or fewer) records than it shows. Values always
 * come from the API; while loading or after a failure the cards show an
 * unavailable state instead of a fabricated zero.
 */
export function SummaryCards({ summary, loading = false, onSelect }: SummaryCardsProps) {
  const cards: { key: SummaryCardKey; label: string; value: number | undefined; subtext: string }[] = [
    {
      key: 'pending',
      label: 'PENDING RESPONSES',
      value: summary?.pendingResponses,
      subtext: 'Waiting for your decision',
    },
    {
      key: 'accepted',
      label: 'PROGRESSED ALLOCATIONS',
      value: summary?.acceptedAllocations,
      subtext: 'Supplier accepted or later workflow stage',
    },
    {
      key: 'declined',
      label: 'DECLINED ALLOCATIONS',
      value: summary?.declinedAllocations,
      subtext: 'Requests declined',
    },
    {
      key: 'expiring',
      label: 'EXPIRING SOON',
      value: summary?.expiringSoon,
      subtext: 'Respond before the hold expires',
    },
  ];

  const renderCard = (card: (typeof cards)[number]) => (
    <>
      <div className="flex items-center justify-between">
        <span className="ym-stat-label text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
          {card.label}
        </span>
        <ArrowUpRight
          size={16}
          className="text-[var(--muted)] opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]"
          aria-hidden="true"
        />
      </div>
      <p className="ym-stat-value text-3xl font-bold mt-3 text-[var(--text)]">
        {loading ? '—' : card.value === undefined ? '—' : String(card.value).padStart(2, '0')}
      </p>
      <p className="ym-stat-subtext text-xs text-[var(--muted)] mt-2">
        {loading ? 'Loading…' : card.value === undefined ? 'Temporarily unavailable' : card.subtext}
      </p>
    </>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="region" aria-label="Allocation summary metrics">
      {cards.map((card) =>
        card.key === 'accepted' ? (
          <Link key={card.key} to={HISTORY_PROGRESSED_PATH} className={CARD_CLASSES} aria-label={`${card.label}: open progressed allocations`}>
            {renderCard(card)}
          </Link>
        ) : (
          <button
            key={card.key}
            type="button"
            className={CARD_CLASSES}
            aria-label={`${card.label}: filter the allocation inbox`}
            onClick={() => onSelect?.(card.key)}
          >
            {renderCard(card)}
          </button>
        ),
      )}
    </div>
  );
}
