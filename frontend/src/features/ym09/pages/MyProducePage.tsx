import { useEffect, useRef, useState } from 'react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ProduceFilters } from '../components/ProduceFilters';
import { ProduceGrid } from '../components/ProduceGrid';
import { ProduceHeader } from '../components/ProduceHeader';
import { ProducePagination } from '../components/ProducePagination';
import { ProduceStatCards } from '../components/ProduceStatCards';
import { ProduceTable } from '../components/ProduceTable';
import {
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  STATUS_FILTER_OPTIONS,
  type ListingStatusActionOption,
} from '../constants/produceConstants';
import {
  fetchMyProduce,
  isRequestAbortedError,
  updateProduceListingStatus,
  type FetchMyProduceOptions,
} from '../services/produceApi';
import type {
  ProduceApiResponse,
  ProduceCategory,
  ProduceFilterState,
  ProduceListingView,
  ProduceViewMode,
} from '../types/produce';
import '../styles/produceDetails.css';

export interface MyProducePageProps {
  debounceMs?: number;
  fetcher?: (
    filters: ProduceFilterState,
    options?: FetchMyProduceOptions
  ) => Promise<ProduceApiResponse>;
}

const EMPTY_CATEGORY_COUNTS: Record<ProduceCategory, number> = {
  All: 0,
  Vegetables: 0,
  Fruits: 0,
  Grains: 0,
  Spices: 0,
  Others: 0,
};

/**
 * Main My Produce page component.
 *
 * Implements:
 * - Page header with description and "+ Add Produce" action
 * - 4 Page-level summary metrics computed strictly from real API data
 * - Category filter pills with item counts
 * - Debounced search input preserving typed text and resetting pagination on search changes
 * - AbortController + monotonic request-sequence protection against stale search responses & unmounts
 */
export default function MyProducePage({
  debounceMs = SEARCH_DEBOUNCE_MS,
  fetcher = fetchMyProduce,
}: MyProducePageProps) {
  const [searchInput, setSearchInput] = useState<string>('');
  const [viewMode, setViewMode] = useState<ProduceViewMode>('grid');
  const [filters, setFilters] = useState<ProduceFilterState>({
    search: '',
    category: 'All',
    status: 'all',
    farm: 'all',
    viewMode: 'grid',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [data, setData] = useState<ProduceApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    listing: ProduceListingView;
    action: ListingStatusActionOption;
  } | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  const isMountedRef = useRef<boolean>(true);
  const latestRequestIdRef = useRef<number>(0);
  const viewModeRef = useRef<ProduceViewMode>(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search input before committing to query filters (and reset page to 1)
  useEffect(() => {
    if (searchInput === filters.search) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }
      );
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, filters.search, debounceMs]);

  // Fetch produce listings with AbortController cancellation and monotonic stale-response guard
  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++latestRequestIdRef.current;

    setLoading(true);
    setError(null);

    const requestFilters: ProduceFilterState = {
      search: filters.search,
      category: filters.category,
      status: filters.status,
      farm: filters.farm,
      viewMode: viewModeRef.current,
      page: filters.page,
      pageSize: filters.pageSize,
    };

    fetcher(requestFilters, {
      signal: controller.signal,
    })
      .then((response) => {
        if (
          !isMountedRef.current ||
          controller.signal.aborted ||
          requestId !== latestRequestIdRef.current
        ) {
          return;
        }
        setData(response);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (
          !isMountedRef.current ||
          controller.signal.aborted ||
          requestId !== latestRequestIdRef.current ||
          isRequestAbortedError(err)
        ) {
          return;
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Failed to fetch produce listings';
        setData(null);
        setError(`Unable to load produce listings (${message}).`);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    filters.search,
    filters.category,
    filters.status,
    filters.farm,
    filters.page,
    filters.pageSize,
    retryToken,
    fetcher,
  ]);

  // Handlers for filter interactions
  const handleCategoryChange = (category: ProduceCategory) => {
    setFilters((prev) => ({
      ...prev,
      search: searchInput,
      category,
      page: 1,
    }));
  };

  const handleStatusChange = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      search: searchInput,
      status,
      page: 1,
    }));
  };

  const handleFarmChange = (farm: string) => {
    setFilters((prev) => ({
      ...prev,
      search: searchInput,
      farm,
      page: 1,
    }));
  };

  const handleSearchChange = (search: string) => {
    setSearchInput(search);
  };

  const handleViewModeChange = (nextViewMode: ProduceViewMode) => {
    setViewMode(nextViewMode);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters((prev) => ({
      ...prev,
      search: '',
      category: 'All',
      status: 'all',
      farm: 'all',
      page: 1,
    }));
  };

  const handleRetry = () => {
    setRetryToken((prev) => prev + 1);
  };

  const handleSelectStatusAction = (
    listing: ProduceListingView,
    action: ListingStatusActionOption
  ) => {
    setStatusError(null);
    setPendingStatusChange({ listing, action });
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange || statusUpdating) return;
    setStatusUpdating(true);
    setStatusError(null);

    try {
      await updateProduceListingStatus(
        pendingStatusChange.listing.id,
        pendingStatusChange.action.targetStatus
      );
      setPendingStatusChange(null);
      setRetryToken((prev) => prev + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to update produce listing status.';
      setStatusError(msg);
      setPendingStatusChange(null);
    } finally {
      setStatusUpdating(false);
    }
  };

  const currentSummary = !error && data ? data.summary : null;
  const currentCategoryCounts = !error && data ? data.categoryCounts : EMPTY_CATEGORY_COUNTS;
  const availableFarms = !error && data ? data.farms : [];

  return (
    <div className="ym09-my-produce-page">
      {/* 1. Real API Connection or Status Mutation Error State */}
      {error && (
        <div style={{ display: 'grid', gap: '12px' }} data-testid="my-produce-error">
          <Alert type="error">{error}</Alert>
          <div>
            <Button variant="outline" onClick={handleRetry}>
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {statusError && (
        <Alert type="error">
          <strong>Unable to update status:</strong> {statusError}
        </Alert>
      )}

      {/* 3. Page Header with Title, Description and "+ Add Produce" Button */}
      <ProduceHeader />

      {/* 4. Page-Level Summary Metrics Cards (4 cards) */}
      <ProduceStatCards
        summary={currentSummary}
        loading={loading}
        error={Boolean(error)}
      />

      {/* 5. Filters Bar: Category Pills, Search Input, Status, Farm, and View Switcher */}
      <ProduceFilters
        search={searchInput}
        onSearchChange={handleSearchChange}
        selectedCategory={filters.category}
        onCategoryChange={handleCategoryChange}
        categoryCounts={currentCategoryCounts}
        selectedStatus={filters.status}
        onStatusChange={handleStatusChange}
        statusOptions={STATUS_FILTER_OPTIONS}
        selectedFarm={filters.farm}
        onFarmChange={handleFarmChange}
        farmOptions={availableFarms}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* 6. Main Content: Grid View or Semantic Table View (suppressed during API error) */}
      {!error &&
        (viewMode === 'grid' ? (
          <ProduceGrid
            listings={data?.listings || []}
            loading={loading}
            onResetFilters={handleResetFilters}
            onSelectStatusAction={handleSelectStatusAction}
          />
        ) : (
          <ProduceTable
            listings={data?.listings || []}
            loading={loading}
            onResetFilters={handleResetFilters}
            onSelectStatusAction={handleSelectStatusAction}
          />
        ))}

      {/* 7. Pagination Controls Footer */}
      {!error && data && data.total > 0 && (
        <ProducePagination
          total={data.total}
          page={data.page}
          pageSize={data.pageSize}
          onPageChange={handlePageChange}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        title={pendingStatusChange?.action.confirmTitle || 'Update listing status'}
        description={pendingStatusChange?.action.confirmDescription || ''}
        confirmLabel={pendingStatusChange?.action.confirmLabel || 'Confirm'}
        busy={statusUpdating}
        onCancel={() => {
          if (!statusUpdating) {
            setPendingStatusChange(null);
          }
        }}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  );
}
