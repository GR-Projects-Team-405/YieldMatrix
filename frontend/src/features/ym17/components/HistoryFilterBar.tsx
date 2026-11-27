import { Search } from 'lucide-react';
import { HISTORY_OPERATIONAL_STATUSES } from '../api';
import { statusLabel } from '../format';
import type { HistoryTabKey } from '../types';

interface HistoryFilterBarProps {
  activeTab: HistoryTabKey;
  onTabChange?: (tab: HistoryTabKey) => void;
  search: string;
  onSearchChange?: (val: string) => void;
  statusFilter: string;
  onStatusChange?: (val: string) => void;
  sortOrder: string;
  onSortChange?: (val: string) => void;
}

const HISTORY_TABS: { key: HistoryTabKey; label: string }[] = [
  { key: 'all', label: 'All History' },
  { key: 'accepted', label: 'Progressed' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired', label: 'Expired' },
  { key: 'other', label: 'Other Outcomes' },
];

/**
 * Filter bar for the Allocation History page:
 * - Status tabs (All History, Progressed, Declined, Expired, Other Outcomes).
 *   The Progressed tab keeps the internal value `accepted` for URL/query
 *   compatibility; it groups the operational statuses that have moved beyond
 *   `held` (supplier accepted through partially accepted). It is NOT a list
 *   of farmer acceptance decisions — those are counted by the FARMER
 *   ACCEPTED summary card from the audit trail.
 * - Server-side search input (debounced by parent)
 * - Operational status dropdown (all 11 non-held statuses)
 * - Sort order dropdown (newest, oldest)
 */
export function HistoryFilterBar({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortOrder,
  onSortChange,
}: HistoryFilterBarProps) {
  return (
    <div className="space-y-4 mb-4">
      {/* Quick status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter historical allocations by category">
        {HISTORY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange?.(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--soft)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter controls row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search (debounced 300 ms in parent before firing API) */}
        <div className="md:col-span-6 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search buyer, crop, or allocation ID"
            aria-label="Search buyer, crop, or allocation ID"
            maxLength={100}
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          />
        </div>

        {/* Operational status filter dropdown */}
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange?.(e.target.value)}
            aria-label="Filter by operational status"
            className="w-full h-11 px-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          >
            <option value="">Status: All Operational</option>
            {HISTORY_OPERATIONAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort dropdown */}
        <div className="md:col-span-3">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange?.(e.target.value)}
            aria-label="Sort historical allocations"
            className="w-full h-11 px-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          >
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
          </select>
        </div>
      </div>
    </div>
  );
}
