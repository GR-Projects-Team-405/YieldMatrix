import api from '../../../services/api';
import {
  DEV_SAMPLE_PRODUCE,
  DEV_SAMPLE_SUMMARY,
  ENABLE_DEV_SAMPLE_DATA,
  SAMPLE_HARVEST_BATCHES,
} from '../constants/produceConstants';
import type {
  ProduceApiResponse,
  ProduceCategory,
  ProduceFilterState,
  ProduceListingFormState,
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

/**
 * Retrieves a single produce listing by its unique UUID / identifier.
 * Used by EditProducePage to load existing listing details for editing.
 */
export async function getProduceListingById(id: string): Promise<ProduceListingView | null> {
  if (ENABLE_DEV_SAMPLE_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const found = DEV_SAMPLE_PRODUCE.find((item) => item.id === id);
    return found ? { ...found } : null;
  }

  // Live API call: GET /api/ym09/produce/:id
  try {
    const response = await api.get<ProduceListingView>(`/ym09/produce/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Updates an existing produce listing in-place.
 * In development sample-data mode, mutates DEV_SAMPLE_PRODUCE in-place,
 * preserving listing.id and preventing duplicates.
 * In live mode, calls PUT /api/ym09/produce/:id.
 */
export async function updateProduceListing(
  id: string,
  formData: ProduceListingFormState
): Promise<ProduceListingView> {
  if (ENABLE_DEV_SAMPLE_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 80));

    const index = DEV_SAMPLE_PRODUCE.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Produce listing with ID "${id}" was not found.`);
    }

    const existing = DEV_SAMPLE_PRODUCE[index];
    const activeHolds = (existing.reservedKg || 0) + (existing.committedKg || 0);

    // Business rule: Reassignment blocked if active reservations or commitments exist
    if (formData.batchId !== existing.batchId && activeHolds > 0) {
      throw new Error(
        `Cannot change harvest batch on a listing with active reservations or commitments (${activeHolds} kg held).`
      );
    }

    // Verify target batch eligibility
    const targetBatch = SAMPLE_HARVEST_BATCHES.find((b) => b.id === formData.batchId);
    if (!targetBatch) {
      throw new Error('Selected harvest batch does not exist.');
    }
    if (targetBatch.status !== 'harvested') {
      throw new Error('Harvest batch must be in harvested status before listing.');
    }

    const totalQty = typeof formData.totalQuantity === 'number' ? formData.totalQuantity : 0;
    const unitPrice = typeof formData.unitPrice === 'number' ? formData.unitPrice : 0;

    // Check stock ceiling on reassignment
    if (formData.batchId !== existing.batchId) {
      if (totalQty > targetBatch.availableStockKg) {
        throw new Error(
          `Offered quantity (${totalQty} kg) exceeds batch available stock (${targetBatch.availableStockKg} kg).`
        );
      }
    }

    // In-place mutation (preserves existing ID and array index!)
    const updatedListing: ProduceListingView = {
      ...existing,
      batchId: formData.batchId,
      farmId: formData.farmId,
      farmName: formData.farmName,
      cropName: formData.cropName,
      category: formData.category,
      gradeName: formData.gradeName,
      offeredKg: totalQty,
      availableKg: totalQty - (existing.reservedKg || 0),
      unitPriceCents: Math.round(unitPrice * 100),
      validFrom: formData.availableFrom ? `${formData.availableFrom}T00:00:00Z` : existing.validFrom,
      validUntil: formData.availableUntil ? `${formData.availableUntil}T23:59:59Z` : existing.validUntil,
    };

    DEV_SAMPLE_PRODUCE[index] = updatedListing;
    return updatedListing;
  }

  // Live API call: PUT /api/ym09/produce/:id
  const response = await api.put<ProduceListingView>(`/ym09/produce/${id}`, {
    batchId: formData.batchId,
    farmId: formData.farmId,
    offeredKg: formData.totalQuantity,
    unitPriceCents: Math.round((Number(formData.unitPrice) || 0) * 100),
    validFrom: formData.availableFrom,
    validUntil: formData.availableUntil,
  });

  return response.data;
}

/**
 * Creates a new produce listing.
 * In development sample-data mode, prepends to DEV_SAMPLE_PRODUCE.
 * In live mode, calls POST /api/ym09/produce.
 */
export async function createProduceListing(
  formData: ProduceListingFormState
): Promise<ProduceListingView> {
  if (ENABLE_DEV_SAMPLE_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 80));

    const targetBatch = SAMPLE_HARVEST_BATCHES.find((b) => b.id === formData.batchId);
    if (!targetBatch) {
      throw new Error('Selected harvest batch does not exist.');
    }
    if (targetBatch.status !== 'harvested') {
      throw new Error('Harvest batch must be in harvested status before listing.');
    }

    const newId = `prod-${String(DEV_SAMPLE_PRODUCE.length + 1).padStart(3, '0')}`;
    const totalQty = typeof formData.totalQuantity === 'number' ? formData.totalQuantity : 0;
    const unitPrice = typeof formData.unitPrice === 'number' ? formData.unitPrice : 0;

    const newListing: ProduceListingView = {
      id: newId,
      batchId: formData.batchId,
      farmId: formData.farmId,
      farmName: formData.farmName,
      cropName: formData.cropName,
      category: formData.category,
      gradeName: formData.gradeName,
      district: 'Nuwara Eliya',
      unitPriceCents: Math.round(unitPrice * 100),
      offeredKg: totalQty,
      availableKg: totalQty,
      reservedKg: 0,
      committedKg: 0,
      status: 'active',
      validFrom: formData.availableFrom ? `${formData.availableFrom}T00:00:00Z` : new Date().toISOString(),
      validUntil: formData.availableUntil ? `${formData.availableUntil}T23:59:59Z` : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    DEV_SAMPLE_PRODUCE.unshift(newListing);
    return newListing;
  }

  // Live API call: POST /api/ym09/produce
  const response = await api.post<ProduceListingView>('/ym09/produce', {
    batchId: formData.batchId,
    farmId: formData.farmId,
    offeredKg: formData.totalQuantity,
    unitPriceCents: Math.round((Number(formData.unitPrice) || 0) * 100),
    validFrom: formData.availableFrom,
    validUntil: formData.availableUntil,
  });

  return response.data;
}
