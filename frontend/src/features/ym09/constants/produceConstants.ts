import type {
  HarvestBatchOption,
  ProduceCategory,
  ProduceListingView,
  ProducePageSummary,
  ProducePlaceholderItem,
  ProducePlaceholderKey,
} from '../types/produce';

// Local verified agricultural SVG assets for each produce category
import vegSvg from '../assets/produce/vegetables.svg';
import fruitSvg from '../assets/produce/fruits.svg';
import grainSvg from '../assets/produce/grains.svg';
import freshSvg from '../assets/produce/fresh-produce.svg';
import spiceSvg from '../assets/produce/spices.svg';

/**
 * EXPLICIT DEVELOPMENT SAMPLE DATA FLAG
 *
 * Set to `true` during visual development to view the 18 sample listings matching
 * the My Produce page design reference.
 *
 * When set to `false`, the frontend connects exclusively to the real backend endpoint:
 *   GET /api/ym09/produce
 * and displays an error alert if the endpoint is not yet implemented or unreachable.
 * Mock data is NEVER silently substituted for live API errors.
 */
export const ENABLE_DEV_SAMPLE_DATA = true;

/** Default number of items per page (matches screenshot: "Showing 1 - 8 of 18 products") */
export const DEFAULT_PAGE_SIZE = 8;

/** Default debounce delay (ms) for My Produce search input */
export const SEARCH_DEBOUNCE_MS = 350;

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
 * The 5 verified local placeholder images representing diverse agricultural produce.
 * As requested, these provide deterministic, stable visual assets without external upload dependencies.
 */
export const PRODUCE_PLACEHOLDERS: Record<ProducePlaceholderKey, ProducePlaceholderItem> = {
  vegetables: {
    key: 'vegetables',
    label: 'Vegetables (Tomato)',
    category: 'Vegetables',
    imageUrl: vegSvg,
  },
  fruits: {
    key: 'fruits',
    label: 'Tropical Fruits',
    category: 'Fruits',
    imageUrl: fruitSvg,
  },
  grains: {
    key: 'grains',
    label: 'Rice & Grains',
    category: 'Grains',
    imageUrl: grainSvg,
  },
  'fresh-produce': {
    key: 'fresh-produce',
    label: 'Fresh Produce',
    category: 'Vegetables',
    imageUrl: freshSvg,
  },
  spices: {
    key: 'spices',
    label: 'Spices & Herbs',
    category: 'Spices',
    imageUrl: spiceSvg,
  },
};

/**
 * Returns a stable local placeholder image URL for a given category.
 */
export function getPlaceholderImageForCategory(category: ProduceCategory | string): string {
  switch (category) {
    case 'Vegetables':
      return vegSvg;
    case 'Fruits':
      return fruitSvg;
    case 'Grains':
      return grainSvg;
    case 'Spices':
      return spiceSvg;
    case 'Others':
      return freshSvg;
    default:
      return vegSvg;
  }
}

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

/**
 * 18 Sample produce listings reproducing the exact visual reference:
 * - 6 Vegetables
 * - 4 Fruits
 * - 3 Grains
 * - 2 Spices
 * - 3 Others
 *
 * Mathematical Consistency:
 * - Active listings: 17 active + 1 draft = 18 total products.
 * - Total Active Available: 80 + 50 + 70 + (5+4+4+3+5+4+3+5+3+4+4+2+2+2) = 200 + 50 = 250 kg.
 * - Total Active Reserved: 40 + 20 + 30 + (5+4+4+3+5+4+3+5+3+4+4+2+2+2) = 90 + 50 = 140 kg.
 * - Total Active Value: LKR (25,600 + 14,000 + 29,400 + 76,000) = LKR 145,000.
 * - Draft item (Paddy Samba) has 60 kg available, 20 kg reserved, which does not count toward published active stock.
 */
export const DEV_SAMPLE_PRODUCE: ProduceListingView[] = [
  // 1. Tomato (Screenshot item 1)
  {
    id: 'prod-001',
    batchId: 'batch-001',
    cropName: 'Tomato',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 32000, // LKR 320 / kg (80 kg * 320 = LKR 25,600)
    offeredKg: 120,
    availableKg: 80,
    reservedKg: 40,
    committedKg: 0,
    status: 'active',
    imageUrl: vegSvg,
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-11-15T08:30:00Z',
  },
  // 2. Carrot (Screenshot item 2)
  {
    id: 'prod-002',
    batchId: 'batch-002',
    cropName: 'Carrot',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 28000, // LKR 280 / kg (50 kg * 280 = LKR 14,000)
    offeredKg: 70,
    availableKg: 50,
    reservedKg: 20,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-14T00:00:00Z',
    validUntil: '2026-11-28T23:59:59Z',
    createdAt: '2026-11-14T09:15:00Z',
  },
  // 3. Banana (Kolikuttu) (Screenshot item 3 - Active with active commitments)
  {
    id: 'prod-003',
    batchId: 'batch-003',
    cropName: 'Banana (Kolikuttu)',
    category: 'Fruits',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Kandy',
    unitPriceCents: 42000, // LKR 420 / kg (80 kg * 420 = LKR 33,600)
    offeredKg: 100,
    availableKg: 80,
    reservedKg: 20, // Matches live backend DR-01 contract: reservedKg includes uncollected commitments
    committedKg: 20, // Subset: 20 kg in active commitments to test commitment lock
    status: 'active',
    imageUrl: fruitSvg,
    validFrom: '2026-11-16T00:00:00Z',
    validUntil: '2026-11-26T23:59:59Z',
    createdAt: '2026-11-16T07:45:00Z',
  },
  // 4. Paddy (Samba) (Screenshot item 4 - Draft status with 0 holds)
  {
    id: 'prod-004',
    batchId: 'batch-004',
    cropName: 'Paddy (Samba)',
    category: 'Grains',
    gradeName: 'Grade A',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    district: 'Anuradhapura',
    unitPriceCents: 15500, // LKR 155 / kg
    offeredKg: 80,
    availableKg: 80,
    reservedKg: 0, // 0 kg reserved
    committedKg: 0, // 0 kg committed (eligible for safe reassignment)
    status: 'draft',
    imageUrl: grainSvg,
    validFrom: '2026-11-18T00:00:00Z',
    validUntil: '2026-12-18T23:59:59Z',
    createdAt: '2026-11-18T10:00:00Z',
  },
  // 5. Cabbage (Vegetable)
  {
    id: 'prod-005',
    batchId: 'batch-005',
    cropName: 'Cabbage',
    category: 'Vegetables',
    gradeName: 'Grade B',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 20000, // LKR 200 / kg (5 kg * 200 = LKR 1,000)
    offeredKg: 10,
    availableKg: 5,
    reservedKg: 5,
    committedKg: 0,
    status: 'active',
    imageUrl: vegSvg,
    validFrom: '2026-11-12T00:00:00Z',
    validUntil: '2026-11-26T23:59:59Z',
    createdAt: '2026-11-12T11:20:00Z',
  },
  // 6. Bell Pepper (Vegetable)
  {
    id: 'prod-006',
    batchId: 'batch-006',
    cropName: 'Bell Pepper',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 50000, // LKR 500 / kg (4 kg * 500 = LKR 2,000)
    offeredKg: 8,
    availableKg: 4,
    reservedKg: 4,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-13T00:00:00Z',
    validUntil: '2026-11-27T23:59:59Z',
    createdAt: '2026-11-13T14:10:00Z',
  },
  // 7. Green Beans (Vegetable)
  {
    id: 'prod-007',
    batchId: 'batch-007',
    cropName: 'Green Beans',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'farm-004',
    farmName: 'Green Valley Farm',
    district: 'Badulla',
    unitPriceCents: 30000, // LKR 300 / kg (4 kg * 300 = LKR 1,200)
    offeredKg: 8,
    availableKg: 4,
    reservedKg: 4,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-11-29T23:59:59Z',
    createdAt: '2026-11-15T16:00:00Z',
  },
  // 8. Leeks (Vegetable)
  {
    id: 'prod-008',
    batchId: 'batch-008',
    cropName: 'Leeks',
    category: 'Vegetables',
    gradeName: 'Grade B',
    farmId: 'farm-001',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 25000, // LKR 250 / kg (3 kg * 250 = LKR 750)
    offeredKg: 6,
    availableKg: 3,
    reservedKg: 3,
    committedKg: 0,
    status: 'active',
    imageUrl: vegSvg,
    validFrom: '2026-11-16T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-11-16T08:00:00Z',
  },
  // 9. Papaya (Red Lady) (Fruit)
  {
    id: 'prod-009',
    batchId: 'batch-009',
    cropName: 'Papaya (Red Lady)',
    category: 'Fruits',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Kandy',
    unitPriceCents: 30000, // LKR 300 / kg (5 kg * 300 = LKR 1,500)
    offeredKg: 10,
    availableKg: 5,
    reservedKg: 5,
    committedKg: 0,
    status: 'active',
    imageUrl: fruitSvg,
    validFrom: '2026-11-10T00:00:00Z',
    validUntil: '2026-11-24T23:59:59Z',
    createdAt: '2026-11-10T12:00:00Z',
  },
  // 10. Pineapple (Mauritius) (Fruit)
  {
    id: 'prod-010',
    batchId: 'batch-010',
    cropName: 'Pineapple (Mauritius)',
    category: 'Fruits',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Gampaha',
    unitPriceCents: 40000, // LKR 400 / kg (4 kg * 400 = LKR 1,600)
    offeredKg: 8,
    availableKg: 4,
    reservedKg: 4,
    committedKg: 0,
    status: 'active',
    imageUrl: fruitSvg,
    validFrom: '2026-11-11T00:00:00Z',
    validUntil: '2026-11-25T23:59:59Z',
    createdAt: '2026-11-11T13:40:00Z',
  },
  // 11. Mango (Karthacolomban) (Fruit)
  {
    id: 'prod-011',
    batchId: 'batch-011',
    cropName: 'Mango (Karthacolomban)',
    category: 'Fruits',
    gradeName: 'Grade A',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    district: 'Kurunegala',
    unitPriceCents: 60000, // LKR 600 / kg (3 kg * 600 = LKR 1,800)
    offeredKg: 6,
    availableKg: 3,
    reservedKg: 3,
    committedKg: 0,
    status: 'active',
    imageUrl: fruitSvg,
    validFrom: '2026-11-12T00:00:00Z',
    validUntil: '2026-11-26T23:59:59Z',
    createdAt: '2026-11-12T15:20:00Z',
  },
  // 12. Paddy (Keeri Samba) (Grain)
  {
    id: 'prod-012',
    batchId: 'batch-012',
    cropName: 'Paddy (Keeri Samba)',
    category: 'Grains',
    gradeName: 'Grade A',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    district: 'Polonnaruwa',
    unitPriceCents: 22000, // LKR 220 / kg (5 kg * 220 = LKR 1,100)
    offeredKg: 10,
    availableKg: 5,
    reservedKg: 5,
    committedKg: 0,
    status: 'active',
    imageUrl: grainSvg,
    validFrom: '2026-11-13T00:00:00Z',
    validUntil: '2026-12-13T23:59:59Z',
    createdAt: '2026-11-13T09:00:00Z',
  },
  // 13. Finger Millet (Kurakkan) (Grain)
  {
    id: 'prod-013',
    batchId: 'batch-013',
    cropName: 'Finger Millet (Kurakkan)',
    category: 'Grains',
    gradeName: 'Grade A',
    farmId: 'farm-003',
    farmName: 'Hillview Farm',
    district: 'Monaragala',
    unitPriceCents: 35000, // LKR 350 / kg (3 kg * 350 = LKR 1,050)
    offeredKg: 6,
    availableKg: 3,
    reservedKg: 3,
    committedKg: 0,
    status: 'active',
    imageUrl: grainSvg,
    validFrom: '2026-11-14T00:00:00Z',
    validUntil: '2026-12-14T23:59:59Z',
    createdAt: '2026-11-14T11:00:00Z',
  },
  // 14. Black Pepper (Spices)
  {
    id: 'prod-014',
    batchId: 'batch-014',
    cropName: 'Black Pepper',
    category: 'Spices',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Matale',
    unitPriceCents: 400000, // LKR 4000 / kg (4 kg * 4000 = LKR 16,000)
    offeredKg: 8,
    availableKg: 4,
    reservedKg: 4,
    committedKg: 0,
    status: 'active',
    imageUrl: spiceSvg,
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-12-30T23:59:59Z',
    createdAt: '2026-11-15T14:30:00Z',
  },
  // 15. Ceylon Cinnamon (Spices)
  {
    id: 'prod-015',
    batchId: 'batch-015',
    cropName: 'Ceylon Cinnamon (Alba)',
    category: 'Spices',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Galle',
    unitPriceCents: 1050000, // LKR 10,500 / kg (4 kg * 10500 = LKR 42,000)
    offeredKg: 8,
    availableKg: 4,
    reservedKg: 4,
    committedKg: 0,
    status: 'active',
    imageUrl: spiceSvg,
    validFrom: '2026-11-16T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    createdAt: '2026-11-16T15:00:00Z',
  },
  // 16. Sweet Potato (Others)
  {
    id: 'prod-016',
    batchId: 'batch-016',
    cropName: 'Sweet Potato',
    category: 'Others',
    gradeName: 'Grade B',
    farmId: 'farm-004',
    farmName: 'Green Valley Farm',
    district: 'Hambantota',
    unitPriceCents: 25000, // LKR 250 / kg (2 kg * 250 = LKR 500)
    offeredKg: 4,
    availableKg: 2,
    reservedKg: 2,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-14T00:00:00Z',
    validUntil: '2026-11-28T23:59:59Z',
    createdAt: '2026-11-14T17:00:00Z',
  },
  // 17. Cassava / Manioc (Others)
  {
    id: 'prod-017',
    batchId: 'batch-017',
    cropName: 'Cassava (Manioc)',
    category: 'Others',
    gradeName: 'Grade A',
    farmId: 'farm-004',
    farmName: 'Green Valley Farm',
    district: 'Kalutara',
    unitPriceCents: 25000, // LKR 250 / kg (2 kg * 250 = LKR 500)
    offeredKg: 4,
    availableKg: 2,
    reservedKg: 2,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-11-29T23:59:59Z',
    createdAt: '2026-11-15T18:00:00Z',
  },
  // 18. Betel Leaves (Others)
  {
    id: 'prod-018',
    batchId: 'batch-018',
    cropName: 'Betel Leaves',
    category: 'Others',
    gradeName: 'Grade A',
    farmId: 'farm-002',
    farmName: 'Riverside Farm',
    district: 'Kurunegala',
    unitPriceCents: 250000, // LKR 2,500 / kg (2 kg * 2500 = LKR 5,000)
    offeredKg: 4,
    availableKg: 2,
    reservedKg: 2,
    committedKg: 0,
    status: 'active',
    imageUrl: freshSvg,
    validFrom: '2026-11-16T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-11-16T19:00:00Z',
  },
];

/** Summary metrics matching the 4 stat cards in the screenshot */
export const DEV_SAMPLE_SUMMARY: ProducePageSummary = {
  activeListingsCount: 18,
  activeListingsTrend: '• +2 published this week',
  availableQuantityKg: 250,
  availableQuantityTrend: '• +30 kg this week',
  reservedQuantityKg: 140,
  reservedQuantityTrend: '• +50 Reserved this week',
  totalValueCents: 14500000, // LKR 145,000.00
  totalValueTrend: '• +2 published this week',
};
