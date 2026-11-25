import axios from 'axios';
import api from '../../../services/api';
import type {
  ListingStatus,
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
 * Extracts a clean user-facing error message from an Axios/API or runtime error.
 */
export function extractApiErrorMessage(err: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: unknown; message?: unknown; fields?: Record<string, unknown> }
      | undefined;

    if (data && typeof data === 'object') {
      const baseMsg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : typeof data.message === 'string' && data.message.trim()
            ? data.message.trim()
            : '';

      if (data.fields && typeof data.fields === 'object') {
        const fieldMessages = Object.values(data.fields).filter(
          (val): val is string => typeof val === 'string' && val.trim().length > 0
        );
        if (fieldMessages.length > 0) {
          return baseMsg ? `${baseMsg}: ${fieldMessages.join(' ')}` : fieldMessages.join(' ');
        }
      }

      if (baseMsg) {
        return baseMsg;
      }
    }

    if (err.message) {
      return err.message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallbackMessage;
}

function toUtcRangeIso(dateStr: string, boundary: 'start' | 'end'): string {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('T')) return trimmed;
  return boundary === 'start' ? `${trimmed}T00:00:00Z` : `${trimmed}T23:59:59Z`;
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
    batchNumber:
      typeof raw.batchNumber === 'string' && raw.batchNumber.trim()
        ? raw.batchNumber.trim()
        : undefined,
    actualKg:
      raw.actualKg !== undefined && raw.actualKg !== null
        ? Number(raw.actualKg)
        : undefined,
    sellableKg:
      raw.sellableKg !== undefined && raw.sellableKg !== null
        ? Number(raw.sellableKg)
        : undefined,
    imageUrl:
      typeof raw.imageUrl === 'string' && raw.imageUrl.trim()
        ? raw.imageUrl.trim()
        : undefined,
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

/**
 * Fetches the authenticated farmer's produce listings and page-level summary metrics
 * strictly from `GET /api/ym09/produce` with AbortSignal support.
 * Errors propagate cleanly and NEVER silently fall back to sample data.
 */
export async function fetchMyProduce(
  filters: ProduceFilterState,
  options: FetchMyProduceOptions = {}
): Promise<ProduceApiResponse> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Live API call: GET /api/ym09/produce
  const trimmedSearch = filters.search.trim();
  let response;
  try {
    response = await api.get<unknown>('/ym09/produce', {
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
  } catch (err: unknown) {
    if (isRequestAbortedError(err)) {
      throw err;
    }
    throw new Error(extractApiErrorMessage(err, 'Failed to fetch produce listings.'));
  }

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
    };
  }

  throw new Error('Unexpected response format from produce listings endpoint.');
}

/**
 * Retrieves a single produce listing by its unique UUID / identifier
 * from `GET /api/ym09/produce/:id`. Used by EditProducePage.
 */
export async function getProduceListingById(id: string): Promise<ProduceListingView | null> {
  try {
    const response = await api.get<{ success?: boolean; data?: Record<string, unknown> }>(
      `/ym09/produce/${id}`
    );
    const raw =
      response?.data && typeof response.data === 'object' && 'data' in response.data
        ? response.data.data
        : (response?.data as unknown as Record<string, unknown> | undefined);

    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid response received from produce listing endpoint.');
    }

    return normalizeLiveListing(raw as Record<string, unknown>);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw new Error(extractApiErrorMessage(err, 'Failed to load produce listing.'));
  }
}

/**
 * Updates an existing produce listing in-place via `PUT /api/ym09/produce/:id`.
 */
export async function updateProduceListing(
  id: string,
  formData: ProduceListingFormState
): Promise<ProduceListingView> {
  try {
    const response = await api.put<{ success?: boolean; data?: Record<string, unknown> }>(
      `/ym09/produce/${id}`,
      {
        offeredKg: Number(formData.totalQuantity),
        unitPriceCents: Math.round((Number(formData.unitPrice) || 0) * 100),
        validFrom: toUtcRangeIso(formData.availableFrom, 'start'),
        validUntil: toUtcRangeIso(formData.availableUntil, 'end'),
      }
    );

    const raw =
      response?.data && typeof response.data === 'object' && 'data' in response.data
        ? response.data.data
        : (response?.data as unknown as Record<string, unknown> | undefined);

    if (!raw || typeof raw !== 'object') {
      throw new Error('Unexpected response received when updating produce listing.');
    }

    const mergedRaw: Record<string, unknown> = {
      cropName: formData.cropName,
      category: formData.category,
      gradeName: formData.gradeName,
      farmId: formData.farmId,
      farmName: formData.farmName,
      batchNumber: formData.batchNumber,
      ...raw,
    };

    return normalizeLiveListing(mergedRaw);
  } catch (err: unknown) {
    throw new Error(extractApiErrorMessage(err, 'Failed to update produce listing.'));
  }
}

/**
 * Updates a produce listing's lifecycle status (`active`, `paused`, `closed`)
 * via `PATCH /api/ym09/produce/:id/status`.
 */
export async function updateProduceListingStatus(
  id: string,
  status: ListingStatus
): Promise<ProduceListingView> {
  try {
    const response = await api.patch<{ success?: boolean; data?: Record<string, unknown> }>(
      `/ym09/produce/${id}/status`,
      { status }
    );
    const raw =
      response?.data && typeof response.data === 'object' && 'data' in response.data
        ? response.data.data
        : (response?.data as unknown as Record<string, unknown> | undefined);

    if (!raw || typeof raw !== 'object') {
      throw new Error('Unexpected response received when updating listing status.');
    }

    return normalizeLiveListing(raw);
  } catch (err: unknown) {
    throw new Error(extractApiErrorMessage(err, 'Failed to update listing status.'));
  }
}

/**
 * Creates a new produce listing via `POST /api/ym09/produce`.
 */
export async function createProduceListing(
  formData: ProduceListingFormState
): Promise<ProduceListingView> {
  const initialStatus: ListingStatus = formData.status === 'draft' ? 'draft' : 'active';

  try {
    const response = await api.post<{ success?: boolean; data?: Record<string, unknown> }>(
      '/ym09/produce',
      {
        farmId: formData.farmId,
        batchId: formData.batchId,
        offeredKg: Number(formData.totalQuantity),
        unitPriceCents: Math.round((Number(formData.unitPrice) || 0) * 100),
        validFrom: toUtcRangeIso(formData.availableFrom, 'start'),
        validUntil: toUtcRangeIso(formData.availableUntil, 'end'),
        status: initialStatus,
      }
    );

    const raw =
      response?.data && typeof response.data === 'object' && 'data' in response.data
        ? response.data.data
        : (response?.data as unknown as Record<string, unknown> | undefined);

    if (!raw || typeof raw !== 'object') {
      throw new Error('Unexpected response received when creating produce listing.');
    }

    return normalizeLiveListing(raw);
  } catch (err: unknown) {
    throw new Error(extractApiErrorMessage(err, 'Failed to create produce listing.'));
  }
}

/**
 * Retrieves comprehensive details for a single produce listing from
 * `GET /api/ym09/produce/:id/details`. Errors propagate and are never replaced
 * with development sample data.
 */
export async function getProduceListingDetails(id: string): Promise<ProduceListingDetailView | null> {
  try {
    const response = await api.get<{
      success?: boolean;
      data?: Record<string, unknown>;
    }>(`/ym09/produce/${id}/details`);

    const raw = response?.data?.data;
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid response format from produce listing details endpoint.');
    }

    const baseListing = normalizeLiveListing(raw);
    return {
      ...baseListing,
      batchNumber:
        typeof raw.batchNumber === 'string' && raw.batchNumber.trim()
          ? raw.batchNumber.trim()
          : `HB-${baseListing.batchId.slice(0, 8).toUpperCase()}`,
      updatedAt:
        typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      allocations: Array.isArray(raw.allocations)
        ? (raw.allocations as ListingAllocationRecord[])
        : [],
      orders: Array.isArray(raw.orders)
        ? (raw.orders as ListingOrderRecord[])
        : [],
      priceTrend: Array.isArray(raw.priceTrend)
        ? (raw.priceTrend as PriceTrendPoint[])
        : [],
      priceHistory: Array.isArray(raw.priceHistory)
        ? (raw.priceHistory as PriceChangeRecord[])
        : [],
      activityLog: Array.isArray(raw.activityLog)
        ? (raw.activityLog as ActivityEventRecord[])
        : [],
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw new Error(extractApiErrorMessage(err, 'Failed to load produce listing details.'));
  }
}
