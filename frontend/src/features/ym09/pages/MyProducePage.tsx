import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ProduceFilters } from '../components/ProduceFilters';
import { ProduceGrid } from '../components/ProduceGrid';
import { ProduceHeader } from '../components/ProduceHeader';
import { ProducePagination } from '../components/ProducePagination';
import { ProduceStatCards } from '../components/ProduceStatCards';
import { ProduceTable } from '../components/ProduceTable';
import {
  DEFAULT_PAGE_SIZE,
  DEV_SAMPLE_SUMMARY,
  STATUS_FILTER_OPTIONS,
} from '../constants/produceConstants';
import { fetchMyProduce } from '../services/produceApi';
import type {
  ProduceApiResponse,
  ProduceCategory,
  ProduceFilterState,
  ProduceViewMode,
} from '../types/produce';

/**
 * Main My Produce page component.
 *
 * Implements:
 * - Page header with description and disabled "+ Add Produce" action
 * - 4 Page-level summary metrics (Active listings, Available kg, Reserved kg, Total value)
 * - Category filter pills with item counts
 * - Search bar with live filtering
 * - Status and Farm dropdown filters (farm options dynamically generated from data)
 * - Grid view and semantic Table view toggle
 * - Pagination controls
 * - Explicit development preview banner (when sample data mode is active)
 * - Accessible error and loading states
 */
export default function MyProducePage() {
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

  const loadProduceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMyProduce(filters);
      setData(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch produce listings';
      setError(
        `Unable to load produce listings. Backend endpoint /api/ym09/produce is currently unreachable (${message}).`
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadProduceData();
  }, [loadProduceData]);

  // Handlers for filter interactions
  const handleCategoryChange = (category: ProduceCategory) => {
    setFilters((prev) => ({ ...prev, category, page: 1 }));
  };

  const handleStatusChange = (status: string) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  };

  const handleFarmChange = (farm: string) => {
    setFilters((prev) => ({ ...prev, farm, page: 1 }));
  };

  const handleSearchChange = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleViewModeChange = (viewMode: ProduceViewMode) => {
    setFilters((prev) => ({ ...prev, viewMode }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleResetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      category: 'All',
      status: 'all',
      farm: 'all',
      page: 1,
    }));
  };

  const currentSummary = data?.summary || DEV_SAMPLE_SUMMARY;
  const currentCategoryCounts = data?.categoryCounts || {
    All: 0,
    Vegetables: 0,
    Fruits: 0,
    Grains: 0,
    Spices: 0,
    Others: 0,
  };
  const availableFarms = data?.farms || [];

  return (
    <div
      className="ym09-my-produce-page"
      style={{
        display: 'grid',
        gap: '24px',
        maxWidth: '100%',
      }}
    >
      {/* 1. Explicit Development Sample Data Notice */}
      {data?.isSampleData && (
        <Alert type="info">
          <strong>DEVELOPMENT PREVIEW:</strong> Displaying {data.total} illustrative sample produce listings. Live backend endpoint is configured for <code>/api/ym09/produce</code>.
        </Alert>
      )}

      {/* 2. Real API Connection Error State */}
      {error && (
        <div style={{ display: 'grid', gap: '12px' }}>
          <Alert type="error">{error}</Alert>
          <div>
            <Button variant="outline" onClick={loadProduceData}>
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {/* 3. Page Header with Title, Description and "+ Add Produce" Button */}
      <ProduceHeader />

      {/* 4. Page-Level Summary Metrics Cards (4 cards) */}
      <ProduceStatCards summary={currentSummary} />

      {/* 5. Filters Bar: Category Pills, Search Input, Status, Farm, and View Switcher */}
      <ProduceFilters
        search={filters.search}
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
        viewMode={filters.viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* 6. Main Content: Grid View or Semantic Table View */}
      {filters.viewMode === 'grid' ? (
        <ProduceGrid
          listings={data?.listings || []}
          loading={loading}
          onResetFilters={handleResetFilters}
        />
      ) : (
        <ProduceTable
          listings={data?.listings || []}
          loading={loading}
          onResetFilters={handleResetFilters}
        />
      )}

      {/* 7. Pagination Controls Footer */}
      {data && data.total > 0 && (
        <ProducePagination
          total={data.total}
          page={filters.page}
          pageSize={filters.pageSize}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
