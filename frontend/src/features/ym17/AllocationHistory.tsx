import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { HistorySummaryCards } from './components/HistorySummaryCards';
import { HistoryFilterBar } from './components/HistoryFilterBar';
import { HistoryTable } from './components/HistoryTable';
import {
  fetchAllocationHistory,
  getApiErrorMessage,
  toHistoryItem,
} from './api';
import { formatDashboardDate } from './format';
import type {
  HistoryItem,
  HistoryQuery,
  HistorySummary,
  HistoryTabKey,
  Pagination,
} from './types';

type LoadState = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/** Statuses grouped under the "Progressed" quick tab (operational progress beyond `held`) */
const PROGRESSED_GROUP = 'supplier_accepted,committed,picked_up,handed_over,accepted,partially_accepted';
/** Statuses grouped under the "Other Outcomes" quick tab */
const OTHER_GROUP = 'cancelled,disputed,resolved';

/** Mapping from quick tabs to comma-separated backend status parameters */
const TAB_STATUS_MAP: Partial<Record<HistoryTabKey, string>> = {
  accepted: PROGRESSED_GROUP,
  declined: 'declined',
  expired: 'expired',
  other: OTHER_GROUP,
};

/** Every tab key the page can open from a `?tab=` link; anything else -> all. */
const HISTORY_TAB_KEYS: readonly HistoryTabKey[] = ['all', 'accepted', 'declined', 'expired', 'other'];

function readTabParam(raw: string | null): HistoryTabKey {
  return raw !== null && (HISTORY_TAB_KEYS as readonly string[]).includes(raw)
    ? (raw as HistoryTabKey)
    : 'all';
}

/**
 * YM17: Farmer Allocations - Allocation History Page (Task 04B-2)
 *
 * Displays historical farmer allocations, separating original audit-backed
 * farmer decisions from operational fulfillment statuses.
 */
export function AllocationHistory() {
  // Deep links such as /history?tab=accepted (used by the inbox summary card's
  // PROGRESSED ALLOCATIONS shortcut; the tab renders as "Progressed") open the
  // matching quick tab; the value is validated against the known tab keys, so a
  // crafted URL can never smuggle anything else into the filter.
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<HistoryTabKey>(() => readTabParam(searchParams.get('tab')));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [allocations, setAllocations] = useState<HistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [historyState, setHistoryState] = useState<LoadState>('loading');
  const [historyError, setHistoryError] = useState('');
  const [attempt, setAttempt] = useState(0);

  /**
   * Status filter sent to backend:
   * Explicit status dropdown selection takes precedence; otherwise the quick tab status applies.
   */
  const effectiveStatus = statusFilter || TAB_STATUS_MAP[activeTab] || undefined;

  // Debounce search input by 300 ms
  useEffect(() => {
    const value = search.trim();
    if (value === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  // Fetch history data with AbortController for cancelable requests
  useEffect(() => {
    const controller = new AbortController();
    setHistoryState('loading');

    const query: HistoryQuery = {
      page,
      limit: PAGE_SIZE,
      status: effectiveStatus,
      search: debouncedSearch || undefined,
      sort: sortOrder,
    };

    fetchAllocationHistory(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSummary(data.summary);
        setAllocations(data.allocations.map(toHistoryItem));
        setPagination(data.pagination);
        setHistoryError('');
        setHistoryState('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = getApiErrorMessage(error);
        if (!message) return; // Request was aborted
        setAllocations([]);
        setPagination(null);
        setHistoryError(message);
        setHistoryState('error');
      });

    return () => controller.abort();
  }, [page, effectiveStatus, debouncedSearch, sortOrder, attempt]);

  /* ----------------------------- filter handlers ---------------------------- */

  /** Applies a quick-tab change and keeps `?tab=` in step (replace, not push). */
  const applyTab = (tab: HistoryTabKey) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'all') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleTabChange = (tab: HistoryTabKey) => {
    applyTab(tab);
    setStatusFilter('');
    setPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    if (status !== '') {
      if (PROGRESSED_GROUP.includes(status)) {
        applyTab('accepted');
      } else if (status === 'declined') {
        applyTab('declined');
      } else if (status === 'expired') {
        applyTab('expired');
      } else {
        applyTab('other');
      }
    } else {
      applyTab('all');
    }
    setPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortOrder(sort);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    applyTab('all');
    setSortOrder('newest');
    setPage(1);
  };

  /**
   * Summary-card shortcuts: each clickable card selects the quick tab whose
   * server-side status group is the set the card counts, and clears the other
   * filters so the destination really shows the records the card counted.
   * The FARMER ACCEPTED card is informational (audit events only) and never
   * triggers this handler.
   */
  const handleSummaryCard = (tab: HistoryTabKey) => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    applyTab(tab);
    setPage(1);
  };

  const hasActiveFilters = activeTab !== 'all' || statusFilter !== '' || debouncedSearch !== '';

  /* -------------------------------- derived -------------------------------- */

  const rangeStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = pagination ? (pagination.page - 1) * pagination.limit + allocations.length : 0;
  const totalLabel =
    historyState === 'ready' && pagination
      ? `${pagination.total} historical record${pagination.total === 1 ? '' : 's'}`
      : historyState === 'loading'
        ? 'Loading…'
        : 'Unavailable';
  const canPrevious = historyState === 'ready' && pagination !== null && pagination.page > 1;
  const canNext = historyState === 'ready' && pagination !== null && pagination.page < pagination.totalPages;
  const currentPage = historyState === 'ready' && pagination ? pagination.page : page;

  const pageButtonClass = (enabled: boolean) =>
    `px-2.5 py-1 rounded text-xs transition-colors ${
      enabled
        ? 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)]'
        : 'text-[var(--muted)] opacity-50 cursor-not-allowed'
    }`;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-2">
        <div>
          <Link
            to="/farmer/allocations"
            className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg mb-6"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Allocation Inbox</span>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text)]">
            Allocation History
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1.5">
            Review past allocation decisions and completed fulfillment outcomes.
          </p>
        </div>

        <div className="flex flex-col md:items-end text-left md:text-right">
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--muted)]">
            {formatDashboardDate()}
          </span>
          <span className="text-sm font-semibold text-[var(--muted)] mt-1">
            {summary
              ? `${summary.totalHistoricalAllocations} total historical allocation${
                  summary.totalHistoricalAllocations === 1 ? '' : 's'
                }`
              : 'Historical archive'}
          </span>
        </div>
      </header>

      {/* 2. Four Summary Cards — each one opens the tab it counts (Issue 04
          pattern, mirrored here so the history arrow affordance also works) */}
      <HistorySummaryCards
        summary={summary}
        loading={historyState === 'loading' && !summary}
        onSelect={handleSummaryCard}
      />

      {/* 3. Main History Card Container */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="allocation-history-heading"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 id="allocation-history-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
              Historical Allocations
            </h2>
            <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
              Audit-backed farmer decisions and operational fulfillment states.
            </p>
          </div>
          <span className="text-xs text-[var(--muted)]">{totalLabel}</span>
        </div>

        {/* Filter Bar */}
        <HistoryFilterBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />

        {/* Loading State */}
        {historyState === 'loading' && allocations.length === 0 && (
          <div
            role="status"
            className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-8 text-center text-sm text-[var(--muted)]"
          >
            Loading allocation history…
          </div>
        )}

        {/* Error State */}
        {historyState === 'error' && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-6 text-center">
            <Alert type="error">{historyError || 'Failed to load allocation history.'}</Alert>
            <Button variant="outline" className="mt-4" onClick={() => setAttempt((att) => att + 1)}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty State: No results matching filters */}
        {historyState === 'ready' && allocations.length === 0 && hasActiveFilters && (
          <EmptyState
            title="No historical allocations match your filters"
            description="Try a different search term or status, or clear the filters to see all historical allocations."
            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        )}

        {/* Empty State: No history at all */}
        {historyState === 'ready' && allocations.length === 0 && !hasActiveFilters && (
          <EmptyState
            title="No allocation history yet"
            description="Completed, decided, or expired allocations will appear in this history log."
            action={
              <Button variant="outline" onClick={() => setAttempt((att) => att + 1)}>
                Refresh
              </Button>
            }
          />
        )}

        {/* History Table */}
        {allocations.length > 0 && <HistoryTable allocations={allocations} />}

        {/* Audit Trail Information Banner */}
        <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
          <Info size={16} className="shrink-0" aria-hidden="true" />
          <span>
            Farmer decisions are verified through append-only audit events. Operational outcomes reflect current delivery and order progression.
          </span>
        </div>

        {/* Pagination & Status Footer */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[var(--muted)]">
          <p>
            {pagination
              ? `Showing ${rangeStart}-${rangeEnd} of ${pagination.total} historical record${pagination.total === 1 ? '' : 's'}`
              : historyState === 'loading'
                ? 'Loading records…'
                : 'History list unavailable'}
          </p>

          <nav className="flex items-center gap-1.5 self-center sm:self-auto" aria-label="Pagination">
            <button
              type="button"
              disabled={!canPrevious}
              aria-label="Previous page"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className={pageButtonClass(canPrevious)}
            >
              &lsaquo; Previous
            </button>
            <span
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-semibold bg-[var(--soft)] text-[var(--accent-text)]"
              aria-current="page"
            >
              {currentPage}
            </span>
            <button
              type="button"
              disabled={!canNext}
              aria-label="Next page"
              onClick={() => setPage((current) => current + 1)}
              className={pageButtonClass(canNext)}
            >
              Next &rsaquo;
            </button>
          </nav>
        </div>
      </section>

      {/* 4. Bottom Design Note */}
      <footer className="rounded-xl bg-[var(--soft)]/60 border border-[var(--border)] p-3.5 px-4 text-xs text-[var(--muted)] flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="font-bold tracking-wider text-[var(--text)] uppercase text-[10px] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
          HISTORY ARCHIVE
        </span>
        <span>
          Historical records are read-only. For detailed batch, farm, and buyer information, select View Details on any record.
        </span>
      </footer>
    </div>
  );
}

export default AllocationHistory;
