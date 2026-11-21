import { useEffect, useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SummaryCards } from './components/SummaryCards';
import { AllocationFilterBar } from './components/AllocationFilterBar';
import { AllocationTable } from './components/AllocationTable';
import {
  fetchAllocations,
  fetchSummary,
  getApiErrorMessage,
  toAllocationItem,
} from './api';
import { formatDashboardDate } from './format';
import type { AllocationItem, AllocationSummary, Pagination, TabKey } from './types';

type LoadState = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 10;
/** Pause between keystrokes and the search request (requirement: ~300 ms). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Single-status mapping for the tabs the backend can express.
 * `all` and `accepted` are absent: `all` sends no status, and `accepted` groups
 * several statuses which a one-status-per-request API cannot filter, so that tab
 * is disabled in the UI and refused in handleTabChange.
 */
const TAB_STATUS: Partial<Record<TabKey, string>> = {
  awaiting: 'held',
  declined: 'declined',
  expired: 'expired',
};

/** Reverse lookup so the dropdown and the tab can never disagree. */
function tabForStatus(status: string): TabKey | undefined {
  return (Object.entries(TAB_STATUS) as [TabKey, string][]).find(([, value]) => value === status)?.[0];
}

/**
 * YM17: Farmer Allocations - Allocation Inbox
 * Task 01B-3: live search, status tabs, status dropdown, sorting and
 * server-side pagination. Summary cards stay independent of every table filter.
 */
export default function YM17() {
  // --- table filters (all of these drive GET /api/ym17/allocations) ---
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState(''); // what the input shows straight away
  const [debouncedSearch, setDebouncedSearch] = useState(''); // what the API is asked for
  const [statusFilter, setStatusFilter] = useState('');
  const [cropFilter, setCropFilter] = useState(''); // control is disabled, stays empty
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(1);

  // Summary request (never affected by the table filters).
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [summaryState, setSummaryState] = useState<LoadState>('loading');
  const [summaryError, setSummaryError] = useState('');
  const [summaryAttempt, setSummaryAttempt] = useState(0);

  // Allocation list request.
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [tableState, setTableState] = useState<LoadState>('loading');
  const [tableError, setTableError] = useState('');
  const [tableAttempt, setTableAttempt] = useState(0);

  /** The tab and the dropdown are two views of the same single status filter. */
  const effectiveStatus = statusFilter || TAB_STATUS[activeTab] || undefined;

  // Debounce: hold the raw search for 300 ms, then publish it and jump to page 1.
  useEffect(() => {
    const value = search.trim();
    if (value === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  // GET /api/ym17/summary — independent of every table filter.
  useEffect(() => {
    const controller = new AbortController();
    setSummaryState('loading');
    fetchSummary(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSummary(data);
        setSummaryError('');
        setSummaryState('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = getApiErrorMessage(error);
        if (!message) return; // request was cancelled, not a failure
        setSummary(null);
        setSummaryError(message);
        setSummaryState('error');
      });
    return () => controller.abort();
  }, [summaryAttempt]);

  // GET /api/ym17/allocations — re-runs on any filter, page or retry change.
  // The previous request is aborted by the cleanup, so a slow old response can
  // never overwrite the results of a newer filter selection.
  useEffect(() => {
    const controller = new AbortController();
    setTableState('loading');
    fetchAllocations(
      {
        page,
        limit: PAGE_SIZE,
        status: effectiveStatus,
        search: debouncedSearch,
        crop: cropFilter || undefined,
        sort: sortOrder,
      },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setAllocations(data.allocations.map(toAllocationItem));
        setPagination(data.pagination);
        setTableError('');
        setTableState('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = getApiErrorMessage(error);
        if (!message) return;
        setAllocations([]);
        setPagination(null);
        setTableError(message);
        setTableState('error');
      });
    return () => controller.abort();
  }, [page, effectiveStatus, debouncedSearch, cropFilter, sortOrder, tableAttempt]);

  /* ----------------------------- filter handlers ---------------------------- */

  const handleTabChange = (tab: TabKey) => {
    if (tab === 'accepted') return; // grouped filtering is not supported yet
    setActiveTab(tab);
    setStatusFilter(''); // the tab is now the only status source
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    // Keep the highlighted tab in step with the dropdown so they never disagree.
    if (value !== '') setActiveTab(tabForStatus(value) ?? 'all');
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortOrder(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setActiveTab('all');
    setPage(1);
  };

  const hasActiveFilters = activeTab !== 'all' || statusFilter !== '' || debouncedSearch !== '';

  /* -------------------------------- derived -------------------------------- */

  const rangeStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = pagination ? (pagination.page - 1) * pagination.limit + allocations.length : 0;
  const totalLabel =
    tableState === 'ready' && pagination
      ? `${pagination.total} allocation${pagination.total === 1 ? '' : 's'}`
      : tableState === 'loading'
        ? 'Loading…'
        : 'Unavailable';
  const canPrevious = tableState === 'ready' && pagination !== null && pagination.page > 1;
  const canNext = tableState === 'ready' && pagination !== null && pagination.page < pagination.totalPages;
  const currentPage = tableState === 'ready' && pagination ? pagination.page : page;
  const pageButtonClass = (enabled: boolean) =>
    `px-2.5 py-1 rounded text-xs transition-colors ${
      enabled ? 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)]' : 'text-[var(--muted)] opacity-50 cursor-not-allowed'
    }`;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text)]">
            Allocation Inbox
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1.5">
            Review and respond to bulk order allocations from buyers.
          </p>
        </div>

        <div className="flex flex-col md:items-end text-left md:text-right">
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--muted)]">
            DEMO DASHBOARD &bull; {formatDashboardDate()}
          </span>
          <span className="text-sm font-semibold text-[#b45309] mt-1">
            {summaryState === 'ready' && summary
              ? `${summary.pendingResponses} allocation${summary.pendingResponses === 1 ? '' : 's'} need your response`
              : summaryState === 'loading'
                ? 'Checking pending responses…'
                : 'Pending response count unavailable'}
          </span>
          <button
            type="button"
            disabled
            title="Allocation history will be implemented in a future task"
            className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)] mt-1 opacity-70 cursor-not-allowed group transition-colors"
          >
            <span>View allocation history</span>
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Summary failure: an explicit unavailable state with its own retry. */}
      {summaryState === 'error' && (
        <Alert type="error">
          <span className="flex flex-wrap items-center gap-3">
            <span>Allocation summary could not be loaded{summaryError ? `: ${summaryError}` : '.'}</span>
            <Button variant="outline" onClick={() => setSummaryAttempt((attempt) => attempt + 1)}>
              Retry
            </Button>
          </span>
        </Alert>
      )}

      {/* 2. Four Summary Cards */}
      <SummaryCards summary={summary} loading={summaryState === 'loading'} />

      {/* 3. Main Allocation Requests Card Container */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="allocation-requests-heading"
      >
        {/* Section title & subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 id="allocation-requests-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
              Allocation Requests
            </h2>
            <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
              Manage incoming requests for your available harvest batches.
            </p>
          </div>
          <span className="text-xs text-[var(--muted)]">{totalLabel}</span>
        </div>

        {/* Filter controls & tabs */}
        <AllocationFilterBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          cropFilter={cropFilter}
          onCropChange={setCropFilter}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />

        {/* Allocation Table */}
        {tableState === 'loading' && (
          <div
            role="status"
            className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-8 text-center text-sm text-[var(--muted)]"
          >
            Loading allocations…
          </div>
        )}

        {tableState === 'error' && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-6 text-center">
            <Alert type="error">{tableError}</Alert>
            <Button variant="outline" className="mt-4" onClick={() => setTableAttempt((attempt) => attempt + 1)}>
              Retry
            </Button>
          </div>
        )}

        {tableState === 'ready' && allocations.length === 0 && hasActiveFilters && (
          <EmptyState
            title="No allocations match your filters"
            description="Try a different search term or status, or clear the filters to see every allocation."
            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        )}

        {tableState === 'ready' && allocations.length === 0 && !hasActiveFilters && (
          <EmptyState
            title="No allocation requests yet"
            description="When a buyer requests one of your harvest batches, the allocation will appear here for your response."
            action={
              <Button variant="outline" onClick={() => setTableAttempt((attempt) => attempt + 1)}>
                Refresh
              </Button>
            }
          />
        )}

        {tableState === 'ready' && allocations.length > 0 && <AllocationTable allocations={allocations} />}

        {/* Reservation Information Notice Banner */}
        <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
          <Info size={16} className="shrink-0" aria-hidden="true" />
          <span>
            Allocated stock is temporarily reserved while you review. Respond before the reservation expires.
          </span>
        </div>

        {/* Pagination & Status Footer */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[var(--muted)]">
          <p>
            {tableState === 'ready' && pagination
              ? `Showing ${rangeStart}-${rangeEnd} of ${pagination.total} allocation${pagination.total === 1 ? '' : 's'}`
              : tableState === 'loading'
                ? 'Loading allocations…'
                : 'Allocation list unavailable'}
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
          DESIGN NOTE
        </span>
        <span>
          Pending decisions open Allocation Details. Expired or decided requests use View Details. No response is treated as acceptance.
        </span>
      </footer>
    </div>
  );
}
