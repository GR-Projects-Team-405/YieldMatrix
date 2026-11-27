import api from '../../../services/api';
import {
  ENABLE_DEV_SAMPLE_DATA,
  SAMPLE_HARVEST_BATCHES,
} from '../constants/produceConstants';
import { inferProduceCategory } from './produceApi';
import type {
  DependencyIntegrationState,
  FarmerFarmOption,
  HarvestBatchOption,
} from '../types/produce';

/**
 * Dependency Integration Configuration for YM09 – Produce Listings
 *
 * YM07 (Farms, owner: Hathiff Haleem) and YM08 (Harvest Batches, owner: Imalka Deshan)
 * currently expose only health routes (`GET /api/ym07/status`, `GET /api/ym08/status`).
 *
 * Enable these flags once each upstream module exposes its verified endpoint, or override
 * base paths via environment/module constants documented in DEPENDENCY_INTEGRATION.md.
 */
export const YM07_FARMS_ENDPOINT = '/ym07/farms';
export const YM08_HARVEST_BATCHES_ENDPOINT = '/ym08/harvest-batches';

export const IS_YM07_FARMS_API_AVAILABLE = false;
export const IS_YM08_BATCHES_API_AVAILABLE = false;

/**
 * YM04 (Reference Data: crops & grades) does not require a separate runtime call from
 * YM09 listing forms because crop and grade are already joined on YM08 harvest batches
 * and YM09 listing responses.
 */
export const YM04_INTEGRATION_NOTE =
  'Crop and grade metadata are derived directly from YM08 harvest batches and YM09 listing payloads.';

export interface DependencyFetchOptions {
  signal?: AbortSignal;
  useSampleData?: boolean;
  farmId?: string;
}

export function isEligibleCreateBatch(batch: HarvestBatchOption): boolean {
  return (
    batch.status === 'harvested' &&
    batch.availableStockKg > 0 &&
    !batch.hasActiveListing
  );
}

function extractResponseArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>[];
    }
    if (Array.isArray(obj.items)) {
      return obj.items as Record<string, unknown>[];
    }
    if (Array.isArray(obj.farms)) {
      return obj.farms as Record<string, unknown>[];
    }
    if (Array.isArray(obj.batches)) {
      return obj.batches as Record<string, unknown>[];
    }
  }
  return [];
}

function normalizeFarmOption(raw: Record<string, unknown>): FarmerFarmOption {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    district: typeof raw.district === 'string' ? raw.district : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  };
}

function normalizeHarvestBatchOption(raw: Record<string, unknown>): HarvestBatchOption {
  const actualKg = Number(raw.actualKg ?? raw.actual_kg) || 0;
  const sellableKg = Number(raw.sellableKg ?? raw.sellable_kg) || 0;
  const activeReservedKg = Number(raw.activeReservedKg ?? raw.reservedKg ?? raw.reserved_kg) || 0;
  const committedKg = Number(raw.committedKg ?? raw.committed_kg) || 0;
  const computedAvailable = Math.max(0, sellableKg - (activeReservedKg + committedKg));
  const rawAvailable = raw.availableStockKg ?? raw.available_stock_kg;
  const availableStockKg =
    rawAvailable !== undefined && rawAvailable !== null
      ? Math.max(0, Number(rawAvailable) || 0)
      : computedAvailable;
  const cropName = String(raw.cropName ?? raw.crop_name ?? '');
  const batchId = String(raw.id ?? '');

  return {
    id: batchId,
    batchNumber: String(
      raw.batchNumber ??
        raw.batch_number ??
        `HB-${batchId.slice(0, 8).toUpperCase()}`
    ),
    farmId: String(raw.farmId ?? raw.farm_id ?? ''),
    farmName: String(raw.farmName ?? raw.farm_name ?? ''),
    cropId: String(raw.cropId ?? raw.crop_id ?? ''),
    cropName,
    category: inferProduceCategory(
      cropName,
      typeof raw.category === 'string' ? raw.category : undefined
    ),
    gradeId: String(raw.gradeId ?? raw.grade_id ?? ''),
    gradeName: String(raw.gradeName ?? raw.grade_name ?? ''),
    harvestDate:
      typeof (raw.harvestDate ?? raw.harvest_date) === 'string'
        ? String(raw.harvestDate ?? raw.harvest_date)
        : undefined,
    status: (raw.status as HarvestBatchOption['status']) || 'harvested',
    actualKg,
    sellableKg,
    activeReservedKg,
    committedKg,
    availableStockKg,
    hasActiveListing: Boolean(raw.hasActiveListing ?? raw.has_active_listing),
  };
}

/**
 * Fetches active certified farms for the authenticated farmer from YM07.
 * Never fabricates live farms when YM07 is unavailable.
 */
export async function fetchFarmerFarms(
  options: DependencyFetchOptions = {}
): Promise<DependencyIntegrationState<FarmerFarmOption>> {
  const useSample = options.useSampleData ?? ENABLE_DEV_SAMPLE_DATA;

  if (useSample) {
    const farmMap = new Map<string, FarmerFarmOption>();
    SAMPLE_HARVEST_BATCHES.forEach((batch) => {
      if (!farmMap.has(batch.farmId)) {
        farmMap.set(batch.farmId, {
          id: batch.farmId,
          name: batch.farmName,
          status: 'active',
        });
      }
    });
    return { status: 'ready', items: Array.from(farmMap.values()), isSampleData: true };
  }

  if (!IS_YM07_FARMS_API_AVAILABLE) {
    return {
      status: 'pending',
      items: [],
      isSampleData: false,
      message:
        'Farm selection awaits YM07 Farm & Land Management API integration (GET /api/ym07/farms).',
    };
  }

  const response = await api.get<unknown>(YM07_FARMS_ENDPOINT, {
    params: { status: 'active' },
    signal: options.signal,
  });

  const farms = extractResponseArray(response?.data)
    .map(normalizeFarmOption)
    .filter((farm) => farm.id && (!farm.status || farm.status === 'active'));

  return { status: 'ready', items: farms, isSampleData: false };
}

/**
 * Fetches harvest batches eligible for listing creation from YM08.
 * Never fabricates live batches when YM08 is unavailable.
 */
export async function fetchEligibleHarvestBatches(
  options: DependencyFetchOptions = {}
): Promise<DependencyIntegrationState<HarvestBatchOption>> {
  const useSample = options.useSampleData ?? ENABLE_DEV_SAMPLE_DATA;

  if (useSample) {
    const filtered = options.farmId
      ? SAMPLE_HARVEST_BATCHES.filter((batch) => batch.farmId === options.farmId)
      : [...SAMPLE_HARVEST_BATCHES];
    return { status: 'ready', items: filtered, isSampleData: true };
  }

  if (!IS_YM08_BATCHES_API_AVAILABLE) {
    return {
      status: 'pending',
      items: [],
      isSampleData: false,
      message:
        'Harvest batch selection awaits YM08 Harvest Batches API integration (GET /api/ym08/harvest-batches).',
    };
  }

  const response = await api.get<unknown>(YM08_HARVEST_BATCHES_ENDPOINT, {
    params: {
      farmId: options.farmId || undefined,
      status: 'harvested',
      eligibleForListing: true,
    },
    signal: options.signal,
  });

  const batches = extractResponseArray(response?.data)
    .map(normalizeHarvestBatchOption)
    .filter((batch) => batch.id && (!options.farmId || batch.farmId === options.farmId));

  return { status: 'ready', items: batches, isSampleData: false };
}
