import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { History, Info } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SummaryCards } from './components/SummaryCards';
import { AllocationFilterBar } from './components/AllocationFilterBar';
import { AllocationTable } from './components/AllocationTable';
import AllocationDetails from './AllocationDetails';
import DecisionReview from './DecisionReview';
import AllocationHistory from './AllocationHistory';
import {
  fetchAllocations,
  fetchSummary,
  getApiErrorMessage,
  toAllocationItem,
} from './api';
import { formatDashboardDate } from './format';
import type {
  AllocationItem,
  AllocationSummary,
  DecisionFilter,
  EligibilityFilter,
  Pagination,
  SummaryCardKey,
  TabKey,
} from './types';

type LoadState = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 10;
/** Pause between keystrokes and the search request (requirement: ~300 ms). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Single-status mapping for the tabs the backend can express as a stored
 * status. `all` and `accepted` are absent: `all` sends no status, and
 * `accepted` is not a status filter at all — it is filtered by the
 * audit-backed farmer decision (see TAB_DECISION).
 */
const TAB_STATUS: Partial<Record<TabKey, string>> = {
  awaiting: 'held',
  declined: 'declined',
  expired: 'expired',
};

/**
 * Tabs whose filter is a genuine, audit-backed farmer decision instead of an
 * operational status. `accepted` asks the backend for `decision=accepted`,
 * which matches only allocations whose earliest recorded farmer decision is
 * the `allocation.accepted` audit event. Allocations with no decision event
 * are excluded (SRS FR-RES-04: a missing response is never acceptance), and
 * no status group is ever fabricated for this tab.
 */
const TAB_DECISION: Partial<Record<TabKey, DecisionFilter>> = {
  accepted: 'accepted',
};

/**
 * Statuses whose business meaning is a server-side response-eligibility
 * filter instead of the raw column value, so the list can never offer a
 * response the server would refuse:
 *   'held'    -> eligibility=pending (live hold, deadline in the future) — the
 *                exact predicate the Pending Responses card counts, so the tab
 *                and the dashboard can never disagree;
 *   'expired' -> eligibility=expired (stored `expired`, or still `held` while
 *                its reservation is no longer live).
 * Stored-`held` rows whose deadline passed stay visible under the All tab with
 * their real status; nothing here ever writes to the backend.
 */
const STATUS_ELIGIBILITY: Partial<Record<string, EligibilityFilter>> = {
  held: 'pending',
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
 *
 * Mounted by App.tsx at `allocations/*`; the nested routes live in the default
 * export at the bottom of this file.
 */
export function AllocationInbox() {
  // --- table filters (all of these drive GET /api/ym17/allocations) ---
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState(''); // what the input shows straight away
  const [debouncedSearch, setDebouncedSearch] = useState(''); // what the API is asked for
  const [statusFilter, setStatusFilter] = useState('');
  /**
   * One-off response-eligibility override, set only by the summary-card
   * shortcuts (e.g. "Expiring Soon" = pending holds inside the deadline
   * window). Any manual tab/status change clears it back to the tab default.
   */
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter | ''>('');
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

  /**
   * What the table actually asks the server for. `held` and `expired` are
   * expressed as eligibility predicates (see STATUS_ELIGIBILITY), and an
   * eligibility filter always implies its own status condition, so the status
   * parameter is only sent for plain stored-status filters such as `declined`.
   * The Accepted tab sends `decision=accepted` and never a status.
   */
  const eligibility: EligibilityFilter | undefined =
    eligibilityFilter || STATUS_ELIGIBILITY[effectiveStatus ?? ''] || undefined;
  const statusParam = eligibility ? undefined : effectiveStatus;
  const decision = TAB_DECISION[activeTab];

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
        status: statusParam,
        eligibility,
        decision,
        search: debouncedSearch,
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
  }, [page, statusParam, eligibility, decision, debouncedSearch, sortOrder, tableAttempt]);

  /* ----------------------------- filter handlers ---------------------------- */

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setStatusFilter(''); // the tab is now the only status source
    setEligibilityFilter(''); // and the tab's own eligibility default applies
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setEligibilityFilter('');
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
    setEligibilityFilter('');
    setActiveTab('all');
    setPage(1);
  };

  /**
   * Summary-card shortcuts (Issue 04). Every destination is the list counted
   * with the card's own server-side predicate:
   *   pending  -> Awaiting Response tab (eligibility=pending)
   *   expiring -> same tab, narrowed to the deadline window, soonest first
   *   declined -> Declined tab (status=declined)
   *   accepted -> Allocation History's Progressed tab (the URL keeps
   *               ?tab=accepted for compatibility), the one endpoint that can
   *               filter the several progressed statuses as a group
   * Existing filters are cleared so the destination really shows the records
   * the card counted.
   */
  const navigate = useNavigate();
  const handleSummaryCard = (card: SummaryCardKey) => {
    if (card === 'accepted') {
      navigate('/farmer/allocations/history?tab=accepted');
      return;
    }
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPage(1);
    if (card === 'pending') {
      setActiveTab('awaiting');
      setEligibilityFilter('');
    } else if (card === 'expiring') {
      setActiveTab('awaiting');
      setEligibilityFilter('expiring');
      setSortOrder('expiry');
    } else {
      setActiveTab('declined');
      setEligibilityFilter('');
    }
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
            {formatDashboardDate()}
          </span>
          <span className="text-sm font-semibold text-[#b45309] mt-1">
            {summaryState === 'ready' && summary
              ? `${summary.pendingResponses} allocation${summary.pendingResponses === 1 ? '' : 's'} need your response`
              : summaryState === 'loading'
                ? 'Checking pending responses…'
                : 'Pending response count unavailable'}
          </span>
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
      <SummaryCards summary={summary} loading={summaryState === 'loading'} onSelect={handleSummaryCard} />

      {/* 3. Main Allocation Requests Card Container */}
      <section
        className="ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm"
        aria-labelledby="allocation-requests-heading"
      >
        {/* Section title, record count and the history action (Issue 05) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 id="allocation-requests-heading" className="text-lg md:text-xl font-bold text-[var(--text)]">
              Allocation Requests
            </h2>
            <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
              Manage incoming requests for your available harvest batches.
            </p>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            <span className="text-xs text-[var(--muted)]">{totalLabel}</span>
            <Link
              to="/farmer/allocations/history"
              className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg"
            >
              <History size={14} aria-hidden="true" />
              <span>View History</span>
            </Link>
          </div>
        </div>

        {/* Filter controls & tabs */}
        <AllocationFilterBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
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

        {tableState === 'ready' && allocations.length === 0 && activeTab === 'accepted' && debouncedSearch === '' && (
          <EmptyState
            title="No accepted allocations found."
            description="Allocations you have accepted will be listed here. Requests still waiting for your response appear under the Awaiting Response tab."
            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          />
        )}

        {tableState === 'ready' && allocations.length === 0 && hasActiveFilters && !(activeTab === 'accepted' && debouncedSearch === '') && (
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

        {/* Reservation Information Notice Banner (Issue 03) — conditional on the
            server's own pending-response count, the same predicate the Pending
            Responses card uses. While the summary is loading or unavailable no
            claim is made either way, so the banner can never contradict the
            dashboard. */}
        {summaryState === 'ready' && summary && summary.pendingResponses > 0 && (
          <div className="mt-4 rounded-xl bg-[var(--soft)] text-[var(--accent-text)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
            <Info size={16} className="shrink-0" aria-hidden="true" />
            <span>
              {summary.pendingResponses} allocation{summary.pendingResponses === 1 ? ' is' : 's are'} awaiting your
              response. Allocated stock is temporarily reserved while you review &mdash; respond before the reservation
              expires.
            </span>
          </div>
        )}
        {summaryState === 'ready' && summary && summary.pendingResponses === 0 && (
          <div className="mt-4 rounded-xl bg-[var(--canvas)] border border-[var(--border)] text-[var(--muted)] p-3 px-4 flex items-center gap-2.5 text-xs md:text-sm">
            <Info size={16} className="shrink-0" aria-hidden="true" />
            <span>
              No allocations currently require your response. Requests whose response window has closed remain listed for
              reference.
            </span>
          </div>
        )}

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

/* -------------------------------- routing -------------------------------- */

/**
 * App.tsx mounts this module at `allocations/*`, so the feature owns its own
 * sub-routes without touching App.tsx:
 *   /farmer/allocations                        -> Allocation Inbox (unchanged)
 *   /farmer/allocations/history                -> Allocation History (Task 04B-2)
 *   /farmer/allocations/:allocationId/decision -> Decision Review (Task 03C-1)
 *   /farmer/allocations/:allocationId          -> Allocation Details (Task 02B-1)
 * Anything else under the wildcard returns to the inbox.
 */
export { AllocationHistory };

export default function YM17() {
  return (
    <Routes>
      <Route index element={<AllocationInbox />} />
      <Route path="history" element={<AllocationHistory />} />
      <Route path=":allocationId/decision" element={<DecisionReview />} />
      <Route path=":allocationId" element={<AllocationDetails />} />
      <Route path="*" element={<Navigate to="/farmer/allocations" replace />} />
    </Routes>
  );
}
