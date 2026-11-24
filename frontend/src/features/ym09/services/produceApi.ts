import axios from 'axios';
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
  ProduceListingDetailView,
  ProducePageSummary,
  ListingAllocationRecord,
  ListingOrderRecord,
  PriceChangeRecord,
  PriceTrendPoint,
  ActivityEventRecord,
} from '../types/produce';

export interface FetchMyProduceOptions {
  signal?: AbortSignal;
  useSampleData?: boolean;
}

const VALID_PRODUCE_CATEGORIES: ReadonlySet<Exclude<ProduceCategory, 'All'>> = new Set([
  'Vegetables',
  'Fruits',
  'Grains',
  'Spices',
  'Others',
]);

function createAbortError(): Error {
  const err = new Error('Request aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Returns true if an error represents a deliberately cancelled or aborted API request.
 */
export function isRequestAbortedError(err: unknown): boolean {
  if (axios.isCancel(err)) {
    return true;
  }
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as { name?: unknown; code?: unknown; __CANCEL__?: unknown };
  return (
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError' ||
    candidate.code === 'ERR_CANCELED' ||
    candidate.__CANCEL__ === true
  );
}

/**
 * Derives a presentation category when a live backend row omits `category`.
 */
export function inferProduceCategory(
  cropName?: string,
  existingCategory?: string
): Exclude<ProduceCategory, 'All'> {
  if (
    existingCategory &&
    VALID_PRODUCE_CATEGORIES.has(existingCategory as Exclude<ProduceCategory, 'All'>)
  ) {
    return existingCategory as Exclude<ProduceCategory, 'All'>;
  }

  const normalized = (cropName || '').trim().toLowerCase();
  if (!normalized) {
    return 'Others';
  }

  if (
    normalized.includes('sweet potato') ||
    normalized.includes('cassava') ||
    normalized.includes('manioc') ||
    normalized.includes('betel')
  ) {
    return 'Others';
  }

  if (normalized.includes('bell pepper')) {
    return 'Vegetables';
  }

  if (
    /(pepper|cinnamon|turmeric|ginger|cardamom|clove|nutmeg|mace|chilli|chili|coriander|cumin|fennel|curry leaf|spice)/.test(
      normalized
    )
  ) {
    return 'Spices';
  }

  if (
    /(paddy|rice|samba|nadu|millet|kurakkan|maize|corn|sorghum|wheat|grain|mung|cowpea|chickpea|dhal)/.test(
      normalized
    )
  ) {
    return 'Grains';
  }

  if (
    /(banana|papaya|pineapple|mango|watermelon|lime|lemon|orange|avocado|guava|passion|woodapple|rambutan|mangosteen|jackfruit|durian|grape|apple|fruit)/.test(
      normalized
    )
  ) {
    return 'Fruits';
  }

  if (
    /(tomato|carrot|cabbage|capsicum|bean|leek|brinjal|eggplant|okra|pumpkin|potato|onion|cucumber|beetroot|spinach|gourd|radish|cauliflower|lettuce|broccoli|vegetable)/.test(
      normalized
    )
  ) {
    return 'Vegetables';
  }

  return 'Others';
}

function normalizeLiveListing(raw: Record<string, unknown>): ProduceListingView {
  const offeredKg = Number(raw.offeredKg) || 0;
  const reservedKg = Number(raw.reservedKg) || 0;
  const committedKg = Number(raw.committedKg) || 0;
  const availableKg =
    raw.availableKg !== undefined && raw.availableKg !== null
      ? Math.max(0, Number(raw.availableKg) || 0)
      : Math.max(0, offeredKg - reservedKg);
  const cropName = String(raw.cropName ?? '');

  return {
    id: String(raw.id ?? ''),
    batchId: String(raw.batchId ?? ''),
    cropName,
    category: inferProduceCategory(
      cropName,
      typeof raw.category === 'string' ? raw.category : undefined
    ),
    gradeName: String(raw.gradeName ?? ''),
    farmId: String(raw.farmId ?? ''),
    farmName: String(raw.farmName ?? ''),
    district: String(raw.district ?? ''),
    unitPriceCents: Number(raw.unitPriceCents) || 0,
    offeredKg,
    availableKg,
    reservedKg,
    committedKg,
    status: (raw.status as ProduceListingView['status']) || 'active',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    validFrom: String(raw.validFrom ?? ''),
    validUntil: String(raw.validUntil ?? ''),
    createdAt: String(raw.createdAt ?? ''),
  };
}

/**
 * Computes authoritative page-level inventory summary metrics from actual listing records.
 * Uses active listings for inventory quantities and valuation (DR-01 / DR-06).
 */
export function computeSummaryFromListings(
  listings: readonly ProduceListingView[]
): ProducePageSummary {
  const activeListings = listings.filter((item) => item.status === 'active');

  const availableQuantityKg = Number(
    activeListings
      .reduce((sum, item) => sum + (Number(item.availableKg) || 0), 0)
      .toFixed(3)
  );
  const reservedQuantityKg = Number(
    activeListings
      .reduce((sum, item) => sum + (Number(item.reservedKg) || 0), 0)
      .toFixed(3)
  );
  const totalValueCents = activeListings.reduce(
    (sum, item) =>
      sum + Math.round((Number(item.availableKg) || 0) * (Number(item.unitPriceCents) || 0)),
    0
  );

  const totalCount = listings.length;
  return {
    activeListingsCount: activeListings.length,
    activeListingsTrend: `${totalCount} total ${totalCount === 1 ? 'listing' : 'listings'}`,
    availableQuantityKg,
    availableQuantityTrend: 'Available unreserved stock',
    reservedQuantityKg,
    reservedQuantityTrend: 'Held & committed stock',
    totalValueCents,
    totalValueTrend: 'Active inventory valuation',
  };
}

function computeCategoryCounts(
  listings: readonly ProduceListingView[]
): Record<ProduceCategory, number> {
  return {
    All: listings.length,
    Vegetables: listings.filter((p) => p.category === 'Vegetables').length,
    Fruits: listings.filter((p) => p.category === 'Fruits').length,
    Grains: listings.filter((p) => p.category === 'Grains').length,
    Spices: listings.filter((p) => p.category === 'Spices').length,
    Others: listings.filter((p) => p.category === 'Others').length,
  };
}

function extractUniqueFarms(
  listings: readonly ProduceListingView[]
): Array<{ id: string; name: string }> {
  const farmMap = new Map<string, string>();
  listings.forEach((item) => {
    if (item.farmId && item.farmName) {
      farmMap.set(item.farmId, item.farmName);
    }
  });
  return Array.from(farmMap.entries()).map(([id, name]) => ({ id, name }));
}

function applyClientProduceFilters(
  sourceListings: readonly ProduceListingView[],
  filters: ProduceFilterState
): {
  paginatedListings: ProduceListingView[];
  total: number;
  page: number;
} {
  let filtered = [...sourceListings];

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

  const total = filtered.length;
  const safePageSize = Math.max(1, filters.pageSize || 8);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, filters.page || 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    paginatedListings: filtered.slice(startIndex, startIndex + safePageSize),
    total,
    page: safePage,
  };
}

async function waitAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Fetches the authenticated farmer's produce listings and page-level summary metrics.
 *
 * When explicit development sample mode is active (`options.useSampleData ?? ENABLE_DEV_SAMPLE_DATA`),
 * returns the curated sample listings and `DEV_SAMPLE_SUMMARY` with `isSampleData: true`.
 *
 * When live API mode is active, queries `GET /api/ym09/produce` with AbortSignal support
 * and normalizes the live payload, computing summary metrics from real API records when omitted.
 * Errors propagate cleanly and NEVER silently fall back to sample data.
 */
export async function fetchMyProduce(
  filters: ProduceFilterState,
  options: FetchMyProduceOptions = {}
): Promise<ProduceApiResponse> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const shouldUseSampleData = options.useSampleData ?? ENABLE_DEV_SAMPLE_DATA;

  if (shouldUseSampleData) {
    await waitAbortable(150, options.signal);

    const categoryCounts = computeCategoryCounts(DEV_SAMPLE_PRODUCE);
    const farms = extractUniqueFarms(DEV_SAMPLE_PRODUCE);
    const { paginatedListings, total, page } = applyClientProduceFilters(
      DEV_SAMPLE_PRODUCE,
      filters
    );

    return {
      listings: paginatedListings,
      summary: DEV_SAMPLE_SUMMARY,
      total,
      page,
      pageSize: filters.pageSize,
      farms,
      categoryCounts,
      isSampleData: true,
    };
  }

  // Live API call: GET /api/ym09/produce
  const trimmedSearch = filters.search.trim();
  const response = await api.get<unknown>('/ym09/produce', {
    params: {
      search: trimmedSearch || undefined,
      category: filters.category !== 'All' ? filters.category : undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      farm: filters.farm !== 'all' ? filters.farm : undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    },
    signal: options.signal,
  });

  const payload = response?.data as
    | (Partial<ProduceApiResponse> & { success?: boolean; data?: unknown[] })
    | undefined;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid response received from produce listings endpoint.');
  }

  // Backend controller.js shape: { success: true, data: listings[], total }
  if (Array.isArray(payload.data)) {
    const allLiveListings = payload.data.map((row) =>
      normalizeLiveListing((row || {}) as Record<string, unknown>)
    );
    const summary = payload.summary ?? computeSummaryFromListings(allLiveListings);
    const categoryCounts = payload.categoryCounts ?? computeCategoryCounts(allLiveListings);
    const farms = Array.isArray(payload.farms)
      ? payload.farms
      : extractUniqueFarms(allLiveListings);
    const { paginatedListings, total, page } = applyClientProduceFilters(
      allLiveListings,
      filters
    );

    return {
      listings: paginatedListings,
      summary,
      total,
      page,
      pageSize: filters.pageSize,
      farms,
      categoryCounts,
      isSampleData: false,
    };
  }

  // Pre-shaped ProduceApiResponse contract: { listings, summary?, total?, ... }
  if (Array.isArray(payload.listings)) {
    const normalizedListings = payload.listings.map((row) =>
      normalizeLiveListing((row as unknown as Record<string, unknown>) || {})
    );
    const summary = payload.summary ?? computeSummaryFromListings(normalizedListings);
    const categoryCounts = payload.categoryCounts ?? computeCategoryCounts(normalizedListings);
    const farms = Array.isArray(payload.farms)
      ? payload.farms
      : extractUniqueFarms(normalizedListings);

    return {
      listings: normalizedListings,
      summary,
      total: typeof payload.total === 'number' ? payload.total : normalizedListings.length,
      page: typeof payload.page === 'number' ? payload.page : filters.page,
      pageSize: typeof payload.pageSize === 'number' ? payload.pageSize : filters.pageSize,
      farms,
      categoryCounts,
      isSampleData: false,
    };
  }

  throw new Error('Unexpected response format from produce listings endpoint.');
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
    // reservedKg already includes uncollected committed/disputed quantities per live backend DR-01
    const activeHolds = existing.reservedKg || 0;

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
      availableKg: Math.max(0, totalQty - activeHolds),
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

/**
 * Retrieves comprehensive details for a single produce listing.
 * In development sample mode, returns enriched mock details.
 * In live backend mode, calls GET /api/ym09/produce/:id/details.
 * NEVER silently falls back to sample data if live API fails.
 */
export async function getProduceListingDetails(id: string): Promise<ProduceListingDetailView | null> {
  if (ENABLE_DEV_SAMPLE_DATA && id.startsWith('prod-')) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const found = DEV_SAMPLE_PRODUCE.find((item) => item.id === id);
    if (!found) return null;

    if (id === 'prod-001') {
      return {
        ...found,
        batchNumber: 'HB-2026-001',
        description:
          'Fresh, high quality tomatoes from our current harvest. Grade A with uniform size and good shelf life. Suitable for retail and bulk orders.',
        updatedAt: '2026-11-05T14:17:00Z',
        allocations: [
          {
            id: 'AL-2026-014',
            orderId: 'ORD-2026-009',
            buyerName: 'FreshMart Shop',
            allocatedKg: 60,
            agreedUnitPriceCents: 32000,
            agreedValueCents: 1920000,
            status: 'supplier_accepted',
            displayStatus: 'Confirmed',
            allocatedOn: '2026-11-05T09:40:00Z',
          },
          {
            id: 'AL-2026-015',
            orderId: 'ORD-2026-010',
            buyerName: 'City Foods',
            allocatedKg: 40,
            agreedUnitPriceCents: 32000,
            agreedValueCents: 1280000,
            status: 'held',
            displayStatus: 'Pending',
            allocatedOn: '2026-11-06T14:15:00Z',
          },
        ],
        orders: [
          {
            id: 'ORD-2026-009',
            buyerName: 'FreshMart Shop',
            orderKg: 40,
            orderValueCents: 1280000,
            status: 'delivered',
            displayStatus: 'Completed',
            orderDate: '2026-11-07T11:05:00Z',
          },
          {
            id: 'ORD-2026-010',
            buyerName: 'City Foods',
            orderKg: 20,
            orderValueCents: 640000,
            status: 'in_fulfilment',
            displayStatus: 'Processing',
            orderDate: '2026-11-08T16:20:00Z',
          },
        ],
        priceTrend: [
          { timestamp: '2026-11-05T09:40:00Z', unitPriceCents: 30000, dateLabel: '05 Nov' },
          { timestamp: '2026-11-07T11:05:00Z', unitPriceCents: 32000, dateLabel: '07 Nov' },
          { timestamp: '2026-11-09T14:00:00Z', unitPriceCents: 34000, dateLabel: '09 Nov' },
          { timestamp: '2026-11-11T14:31:00Z', unitPriceCents: 32000, dateLabel: '11 Nov' },
          { timestamp: '2026-11-13T09:17:00Z', unitPriceCents: 32000, dateLabel: '13 Nov' },
        ],
        priceHistory: [
          { id: 'ph-5', timestamp: '2026-11-17T10:24:00Z', unitPriceCents: 32000, previousUnitPriceCents: 32000, deltaCents: 0 },
          { id: 'ph-4', timestamp: '2026-11-13T09:17:00Z', unitPriceCents: 32000, previousUnitPriceCents: 34000, deltaCents: -2000 },
          { id: 'ph-3', timestamp: '2026-11-11T14:31:00Z', unitPriceCents: 34000, previousUnitPriceCents: 32000, deltaCents: 2000 },
          { id: 'ph-2', timestamp: '2026-11-07T11:05:00Z', unitPriceCents: 32000, previousUnitPriceCents: 30000, deltaCents: 2000 },
          { id: 'ph-1', timestamp: '2026-11-05T09:40:00Z', unitPriceCents: 30000, previousUnitPriceCents: undefined, deltaCents: 0 },
        ],
        activityLog: [
          {
            id: 'act-1',
            eventType: 'price_update',
            title: 'Listing price updated',
            description: 'Price changed from LKR 300 / kg to LKR 320 / kg.',
            timestamp: '2026-11-17T10:24:00Z',
          },
          {
            id: 'act-2',
            eventType: 'allocation_confirmed',
            title: 'Allocation confirmed',
            description: '60 kg allocated to FreshMart Shop (AL-2026-014).',
            timestamp: '2026-11-15T16:10:00Z',
          },
          {
            id: 'act-3',
            eventType: 'order_completed',
            title: 'Order completed',
            description: '40 kg order completed by City Foods (ORD-2026-009).',
            timestamp: '2026-11-11T11:59:00Z',
          },
          {
            id: 'act-4',
            eventType: 'listing_updated',
            title: 'Listing updated',
            description: 'Description was updated.',
            timestamp: '2026-11-07T09:17:00Z',
          },
          {
            id: 'act-5',
            eventType: 'listing_created',
            title: 'Listing created',
            description: `Produce listing published with ${found.offeredKg} kg at LKR ${(found.unitPriceCents / 100).toFixed(0)} / kg.`,
            timestamp: '2026-11-05T09:40:00Z',
          },
        ],
      };
    }

    // Default minimal detail view for other sample items (tests empty states)
    return {
      ...found,
      batchNumber: `HB-2026-${id.slice(5).padStart(3, '0')}`,
      description: undefined, // Demonstrates empty description state
      updatedAt: found.createdAt,
      allocations: [], // Demonstrates empty allocations table
      orders: [], // Demonstrates empty orders table
      priceTrend: [], // Demonstrates empty price trend chart
      priceHistory: [], // Demonstrates empty price history table
      activityLog: [
        {
          id: `act-init-${id}`,
          eventType: 'listing_created',
          title: 'Listing created',
          description: `Produce listing published with ${found.offeredKg} kg at LKR ${(found.unitPriceCents / 100).toFixed(0)} / kg.`,
          timestamp: found.createdAt,
        },
      ],
    };
  }

  // Live API call: GET /api/ym09/produce/:id/details
  // If request fails (e.g. 404, 500, network error), error propagates and is not silently masked
  const response = await api.get<{ success: boolean; data: ProduceListingDetailView }>(`/ym09/produce/${id}/details`);
  return response.data.data;
}
