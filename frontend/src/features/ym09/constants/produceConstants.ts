import type {
  HarvestBatchOption,
  ListingStatus,
  ProduceCategory,
} from '../types/produce';

/**
 * EXPLICIT ADD PRODUCE DEVELOPMENT PREVIEW FLAG
 *
 * Disabled by default (`false`) so normal runtime relies strictly on live APIs.
 * Can be enabled ONLY in Vite dev mode when `VITE_YM09_USE_SAMPLE_DATA=true`
 * to preview Add Produce farm/batch dropdowns temporarily while YM07 and YM08 APIs
 * are pending. Sample batches are NEVER treated as real database records or used as
 * fallbacks for failed API requests.
 */
export const ENABLE_DEV_SAMPLE_DATA = Boolean(
  import.meta.env?.DEV && import.meta.env?.VITE_YM09_USE_SAMPLE_DATA === 'true'
);

/** Standard user-facing copy when a produce listing has no backend image URL */
export const IMAGE_UNAVAILABLE_MESSAGE = 'Image cannot be shown';

/** Default number of items per page */
export const DEFAULT_PAGE_SIZE = 8;

/** Default debounce delay (ms) for My Produce search input */
export const SEARCH_DEBOUNCE_MS = 350;

/** Allowed listing lifecycle transitions matching backend VALID_LISTING_TRANSITIONS */
export const LISTING_STATUS_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ['active', 'closed'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  expired: ['closed'],
  closed: [],
};

export interface ListingStatusActionOption {
  targetStatus: ListingStatus;
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
}

export function getAvailableListingStatusActions(
  currentStatus: ListingStatus,
  cropName: string
): ListingStatusActionOption[] {
  const allowedTargets = LISTING_STATUS_TRANSITIONS[currentStatus] || [];
  const actions: ListingStatusActionOption[] = [];

  if (allowedTargets.includes('active')) {
    const isDraft = currentStatus === 'draft';
    actions.push({
      targetStatus: 'active',
      label: isDraft ? 'Activate listing' : 'Resume listing',
      confirmTitle: isDraft ? `Activate ${cropName} listing?` : `Resume ${cropName} listing?`,
      confirmDescription: isDraft
        ? `Publishing this listing will make ${cropName} visible to buyers on the marketplace.`
        : `Resuming this listing will make ${cropName} visible to buyers again.`,
      confirmLabel: isDraft ? 'Activate' : 'Resume',
    });
  }

  if (allowedTargets.includes('paused')) {
    actions.push({
      targetStatus: 'paused',
      label: 'Pause listing',
      confirmTitle: `Pause ${cropName} listing?`,
      confirmDescription: `Pausing hides ${cropName} from new buyer orders while preserving any existing reservations and commitments.`,
      confirmLabel: 'Pause listing',
    });
  }

  if (allowedTargets.includes('closed')) {
    actions.push({
      targetStatus: 'closed',
      label: 'Archive listing',
      confirmTitle: `Archive ${cropName} listing?`,
      confirmDescription: `Archiving permanently closes this ${cropName} listing. Closed listings cannot be reopened.`,
      confirmLabel: 'Archive listing',
    });
  }

  return actions;
}

/** Status filter options for the SelectField dropdown */
export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Status: All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
  { value: 'closed', label: 'Closed' },
];

/** Category definitions matching the design pill bar */
export const CATEGORY_DEFINITIONS: Array<{
  key: ProduceCategory;
  label: string;
  iconName: 'grid' | 'vegetable' | 'fruit' | 'grain' | 'spice' | 'other';
}> = [
  { key: 'All', label: 'All', iconName: 'grid' },
  { key: 'Vegetables', label: 'Vegetables', iconName: 'vegetable' },
  { key: 'Fruits', label: 'Fruits', iconName: 'fruit' },
  { key: 'Grains', label: 'Grains', iconName: 'grain' },
  { key: 'Spices', label: 'Spices', iconName: 'spice' },
  { key: 'Others', label: 'Others', iconName: 'other' },
];

/**
 * Sample harvested batches from certified farmer holdings.
 * Reflects schema.sql table `harvest_batches`:
 * - Only batches with status === 'harvested' and actual_kg > 0 are eligible for listing.
 * - availableStockKg is strictly computed: sellableKg - (activeReservedKg + committedKg).
 * - Batches with existing active listings (hasActiveListing: true) are flagged to enforce one_active_listing_per_batch.
 */
export const SAMPLE_HARVEST_BATCHES: HarvestBatchOption[] = [
  // Farm 1: GreenField Farm (Nuwara Eliya)
  {
    id: 'batch-001',
    batchNumber: 'HB-2026-001 (Tomato)',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    cropId: 'crop-001',
    cropName: 'Tomato',
    category: 'Vegetables',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 150,
    sellableKg: 120,
    activeReservedKg: 10,
    committedKg: 10,
    availableStockKg: 100, // 120 - (10 + 10) = 100 kg
  },
  {
    id: 'batch-002',
    batchNumber: 'HB-2026-002 (Carrot)',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    cropId: 'crop-002',
    cropName: 'Carrot',
    category: 'Vegetables',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 90,
    sellableKg: 80,
    activeReservedKg: 10,
    committedKg: 0,
    availableStockKg: 70, // 80 - 10 = 70 kg
  },
  {
    id: 'batch-003',
    batchNumber: 'HB-2026-003 (Bell Pepper)',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    cropId: 'crop-006',
    cropName: 'Bell Pepper',
    category: 'Vegetables',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 65,
    sellableKg: 55,
    activeReservedKg: 5,
    committedKg: 0,
    availableStockKg: 50, // 55 - 5 = 50 kg
  },
  {
    id: 'batch-004-unharvested',
    batchNumber: 'HB-2026-004 (Cabbage - Ready)',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    cropId: 'crop-005',
    cropName: 'Cabbage',
    category: 'Vegetables',
    gradeId: 'grade-002',
    gradeName: 'Grade B',
    status: 'ready', // Demonstrates status filter: not harvested yet
    actualKg: 0,
    sellableKg: 0,
    activeReservedKg: 0,
    committedKg: 0,
    availableStockKg: 0,
  },
  {
    id: 'batch-005-active',
    batchNumber: 'HB-2026-005 (Tomato - Already Listed)',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    cropId: 'crop-001',
    cropName: 'Tomato',
    category: 'Vegetables',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 120,
    sellableKg: 100,
    activeReservedKg: 40,
    committedKg: 0,
    availableStockKg: 60,
    hasActiveListing: true, // Demonstrates duplicate listing constraint
  },

  // Farm 2: Riverside Farm (Kandy)
  {
    id: 'batch-006',
    batchNumber: 'HB-2026-006 (Banana Kolikuttu)',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    cropId: 'crop-003',
    cropName: 'Banana (Kolikuttu)',
    category: 'Fruits',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 110,
    sellableKg: 100,
    activeReservedKg: 15,
    committedKg: 0,
    availableStockKg: 85, // 100 - 15 = 85 kg
  },
  {
    id: 'batch-007',
    batchNumber: 'HB-2026-007 (Papaya Red Lady)',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    cropId: 'crop-009',
    cropName: 'Papaya (Red Lady)',
    category: 'Fruits',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 80,
    sellableKg: 70,
    activeReservedKg: 10,
    committedKg: 0,
    availableStockKg: 60, // 70 - 10 = 60 kg
  },
  {
    id: 'batch-008',
    batchNumber: 'HB-2026-008 (Black Pepper)',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    cropId: 'crop-014',
    cropName: 'Black Pepper',
    category: 'Spices',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 30,
    sellableKg: 28,
    activeReservedKg: 3,
    committedKg: 0,
    availableStockKg: 25, // 28 - 3 = 25 kg
  },

  // Farm 3: Hillview Farm (Anuradhapura)
  {
    id: 'batch-009',
    batchNumber: 'HB-2026-009 (Paddy Samba)',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    cropId: 'crop-004',
    cropName: 'Paddy (Samba)',
    category: 'Grains',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 250,
    sellableKg: 240,
    activeReservedKg: 40,
    committedKg: 0,
    availableStockKg: 200, // 240 - 40 = 200 kg
  },
  {
    id: 'batch-010',
    batchNumber: 'HB-2026-010 (Finger Millet)',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    cropId: 'crop-013',
    cropName: 'Finger Millet (Kurakkan)',
    category: 'Grains',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 140,
    sellableKg: 130,
    activeReservedKg: 10,
    committedKg: 0,
    availableStockKg: 120, // 130 - 10 = 120 kg
  },

  // Farm 4: Green Valley Farm (Badulla)
  {
    id: 'batch-011',
    batchNumber: 'HB-2026-011 (Green Beans)',
    farmId: 'farm-004',
    farmName: 'Green Valley Farm',
    cropId: 'crop-007',
    cropName: 'Green Beans',
    category: 'Vegetables',
    gradeId: 'grade-001',
    gradeName: 'Grade A',
    status: 'harvested',
    actualKg: 60,
    sellableKg: 55,
    activeReservedKg: 10,
    committedKg: 0,
    availableStockKg: 45, // 55 - 10 = 45 kg
  },
  {
    id: 'batch-012',
    batchNumber: 'HB-2026-012 (Sweet Potato)',
    farmId: 'farm-004',
    farmName: 'Green Valley Farm',
    cropId: 'crop-016',
    cropName: 'Sweet Potato',
    category: 'Others',
    gradeId: 'grade-002',
    gradeName: 'Grade B',
    status: 'harvested',
    actualKg: 100,
    sellableKg: 95,
    activeReservedKg: 5,
    committedKg: 0,
    availableStockKg: 90, // 95 - 5 = 90 kg
  },
];
