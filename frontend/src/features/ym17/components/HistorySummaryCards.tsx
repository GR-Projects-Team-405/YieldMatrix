import { ArrowUpRight } from 'lucide-react';
import type { HistorySummary, HistoryTabKey } from '../types';

interface HistorySummaryCardsProps {
  /** Live summary from GET /api/ym17/allocations/history */
  summary: HistorySummary | null;
  /** True while the summary/history request is loading */
  loading?: boolean;
  /**
   * Activated by click or keyboard: selects the quick tab that lists exactly
   * the records the card counts (total -> all, the rest -> their own tab).
   * The FARMER ACCEPTED card is informational and never triggers it.
   */
  onSelect?: (tab: HistoryTabKey) => void;
}

/** Visual card base shared by every card, interactive or not. */
const CARD_BASE =
  'ym-stat-card block w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-sm transition-colors';

/**
 * Interactive styling for the clickable cards: the whole card is the target,
 * with visible hover, focus-visible and active states so the arrow affordance
 * never suggests a click that does nothing.
 */
const CARD_CLASSES =
  CARD_BASE +
  ' group cursor-pointer' +
  ' hover:border-[var(--accent-text)] hover:bg-[var(--canvas)]' +
  ' focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]' +
  ' active:bg-[var(--canvas)]';

/**
 * FARMER ACCEPTED is informational only: its number counts append-only
 * `allocation.accepted` audit events, and no history tab lists exactly those
 * records (the API groups operational statuses only). It therefore keeps the
 * same visual card — same count, label and subtext — but with no pointer
 * cursor, hover/focus/active states, arrow affordance or click action, so it
 * can never imply a navigation that would show a different record set.
 */
const STATIC_CARD_CLASSES = CARD_BASE;

/**
 * 4 metric cards for the Farmer Allocation History page:
 * - TOTAL HISTORICAL ALLOCATIONS -> All tab
 * - FARMER ACCEPTED              -> NON-CLICKABLE: genuine `allocation.accepted`
 *                                   audit events (recorded farmer decisions
 *                                   only — not an operational status group)
 * - DECLINED                      -> Declined tab
 * - EXPIRED                       -> Expired tab
 *
 * Each clickable card opens the quick tab its number is counted with, so a
 * card never promises more (or fewer) records than it shows. FARMER ACCEPTED
 * is the exception: it counts append-only audit events that no tab can list,
 * so it is rendered as a static card instead of linking to a mismatched view.
 * Values come strictly from the backend summary object, independent of active
 * page filters; while loading or after a failure the cards show an unavailable
 * state instead of a fabricated zero.
 */
export function HistorySummaryCards({ summary, loading = false, onSelect }: HistorySummaryCardsProps) {
  const cards: { key: HistoryTabKey; label: string; value: number | undefined; subtext: string }[] = [
    {
      key: 'all',
      label: 'TOTAL HISTORICAL ALLOCATIONS',
      value: summary?.totalHistoricalAllocations,
      subtext: 'All non-held historical allocations',
    },
    {
      key: 'accepted',
      label: 'FARMER ACCEPTED',
      value: summary?.accepted,
      subtext: 'Recorded farmer acceptance decisions',
    },
    {
      key: 'declined',
      label: 'DECLINED',
      value: summary?.declined,
      subtext: 'Declined by farmer',
    },
    {
      key: 'expired',
      label: 'EXPIRED',
      value: summary?.expired,
      subtext: 'Reservation / system expiry',
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      role="region"
      aria-label="Allocation history summary metrics"
    >
      {cards.map((card) => {
        const interactive = card.key !== 'accepted';
        const content = (
          <>
            <div className="flex items-center justify-between">
              <span className="ym-stat-label text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
                {card.label}
              </span>
              {interactive && (
                <ArrowUpRight
                  size={16}
                  className="text-[var(--muted)] opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]"
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="ym-stat-value text-3xl font-bold mt-3 text-[var(--text)]">
              {loading ? '—' : card.value === undefined ? '—' : String(card.value).padStart(2, '0')}
            </p>
            <p className="ym-stat-subtext text-xs text-[var(--muted)] mt-2">
              {loading ? 'Loading…' : card.value === undefined ? 'Temporarily unavailable' : card.subtext}
            </p>
          </>
        );

        // FARMER ACCEPTED: same visual card, but purely informational — no
        // button, no click action, no arrow, no pointer/hover affordances.
        if (!interactive) {
          return (
            <div key={card.key} className={STATIC_CARD_CLASSES}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={card.key}
            type="button"
            className={CARD_CLASSES}
            aria-label={`${card.label}: open this list`}
            onClick={() => onSelect?.(card.key)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
