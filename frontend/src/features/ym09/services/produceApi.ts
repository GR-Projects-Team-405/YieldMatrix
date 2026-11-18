import api from '../../../services/api';
import {
  DEV_SAMPLE_PRODUCE,
  DEV_SAMPLE_SUMMARY,
  ENABLE_DEV_SAMPLE_DATA,
} from '../constants/produceConstants';
import type {
  ProduceApiResponse,
  ProduceCategory,
  ProduceFilterState,
  ProduceListingView,
} from '../types/produce';

/**
 * Fetches the authenticated farmer's produce listings and page-level summary metrics.
 *
 * If `ENABLE_DEV_SAMPLE_DATA` is true, returns the 18 sample listings matching
 * the My Produce page design reference with `isSampleData: true`.
 *
 * If `ENABLE_DEV_SAMPLE_DATA` is false, calls the real API endpoint `GET /api/ym09/produce`.
 * Errors are NOT caught or swallowed here; they propagate to the caller to display
 * an accessible error alert with a retry button.
 */
export async function fetchMyProduce(filters: ProduceFilterState): Promise<ProduceApiResponse> {
  if (ENABLE_DEV_SAMPLE_DATA) {
    // Simulate brief asynchronous delay for natural UI feel
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Calculate category counts across the entire sample set
    const categoryCounts: Record<ProduceCategory, number> = {
      All: DEV_SAMPLE_PRODUCE.length,
      Vegetables: DEV_SAMPLE_PRODUCE.filter((p) => p.category === 'Vegetables').length,
      Fruits: DEV_SAMPLE_PRODUCE.filter((p) => p.category === 'Fruits').length,
      Grains: DEV_SAMPLE_PRODUCE.filter((p) => p.category === 'Grains').length,
      Spices: DEV_SAMPLE_PRODUCE.filter((p) => p.category === 'Spices').length,
      Others: DEV_SAMPLE_PRODUCE.filter((p) => p.category === 'Others').length,
    };

    // Extract unique farms for the farm filter dropdown
    const farmMap = new Map<string, string>();
    DEV_SAMPLE_PRODUCE.forEach((item) => {
      farmMap.set(item.farmId, item.farmName);
    });
    const farms = Array.from(farmMap.entries()).map(([id, name]) => ({ id, name }));

    // Apply client-side filters
    let filtered = [...DEV_SAMPLE_PRODUCE];

    if (filters.category !== 'All') {
      filtered = filtered.filter((item) => item.category === filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter((item) => item.status === filters.status);
    }

    if (filters.farm && filters.farm !== 'all') {
      filtered = filtered.filter((item) => item.farmId === filters.farm);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.cropName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.farmName.toLowerCase().includes(q) ||
          item.district.toLowerCase().includes(q)
      );
    }

    // Pagination slice
    const total = filtered.length;
    const startIndex = (filters.page - 1) * filters.pageSize;
    const paginatedListings = filtered.slice(startIndex, startIndex + filters.pageSize);

    return {
      listings: paginatedListings,
      summary: DEV_SAMPLE_SUMMARY,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      farms,
      categoryCounts,
      isSampleData: true,
    };
  }

  // Live API call: GET /api/ym09/produce
  // services/api.ts automatically prefixes baseURL and attaches Bearer token
  const response = await api.get<ProduceApiResponse>('/ym09/produce', {
    params: {
      search: filters.search || undefined,
      category: filters.category !== 'All' ? filters.category : undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      farm: filters.farm !== 'all' ? filters.farm : undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });

  return {
    ...response.data,
    isSampleData: false,
  };
}
