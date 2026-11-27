/**
 * YM09 – Produce Listings
 * Types and interfaces for the My Produce page.
 *
 * All database fields correspond directly to schema.sql:
 * - listings (id, batch_id, unit_price_cents, offered_kg, valid_from, valid_until, status, created_at)
 * - harvest_batches (id, farm_id, farmer_id, crop_id, grade_id, planned_kg, actual_kg, sellable_kg, status)
 * - crops (id, name, active)
 * - grades (id, name, description, active)
 * - farms (id, farmer_id, name, district, pickup_address, status)
 * - reservations (held_kg, status)
 */

/** Valid listing status values as constrained by listings.status CHECK constraint in schema.sql */
export type ListingStatus = 'draft' | 'active' | 'paused' | 'expired' | 'closed';

/** Produce category classifications for the UI filters */
export type ProduceCategory = 'All' | 'Vegetables' | 'Fruits' | 'Grains' | 'Spices' | 'Others';

/** View mode for produce listings display */
export type ProduceViewMode = 'grid' | 'table';

/**
 * Enriched view model of a produce listing for the My Produce page.
 * Corresponds to listings JOIN harvest_batches JOIN crops JOIN grades JOIN farms.
 */
export interface ProduceListingView {
  /** Listing UUID from listings.id */
  id: string;
  /** Harvest batch UUID from listings.batch_id */
  batchId: string;
  /** Crop name from crops.name (e.g. "Tomato", "Carrot") */
  cropName: string;
  /** Presentation category derived from crop classification */
  category: Exclude<ProduceCategory, 'All'>;
  /** Quality grade from grades.name (e.g. "Grade A") */
  gradeName: string;
  /** Farm UUID from farms.id */
  farmId: string;
  /** Farm name from farms.name (e.g. "GreenField Farm") */
  farmName: string;
  /** Farm district from farms.district */
  district: string;
  /** Unit price in integer LKR cents from listings.unit_price_cents (e.g. 32000 cents = LKR 320.00) */
  unitPriceCents: number;
  /** Total offered weight in kg from listings.offered_kg */
  offeredKg: number;
  /** Available unreserved sellable weight in kg (DR-01: Math.max(0, offeredKg - reservedKg)) */
  availableKg: number;
  /** Total active encumbered weight in kg (held + supplier_accepted + uncollected committed/disputed) */
  reservedKg: number;
  /** Subset of committed weight in kg from allocations WHERE status = 'committed' (already included in reservedKg while uncollected) */
  committedKg: number;
  /** Listing status from listings.status */
  status: ListingStatus;
  /** Optional human-readable batch reference returned by backend */
  batchNumber?: string;
  /** Harvest batch harvested total kg (when included by GET /produce/:id) */
  actualKg?: number;
  /** Harvest batch net sellable kg ceiling (when included by GET /produce/:id) */
  sellableKg?: number;
  /** Optional image URL returned by backend */
  imageUrl?: string;
  /** Listing validity start timestamp (UTC ISO string) from listings.valid_from */
  validFrom: string;
  /** Listing validity expiry timestamp (UTC ISO string) from listings.valid_until */
  validUntil: string;
  /** Record creation timestamp (UTC ISO string) from listings.created_at */
  createdAt: string;
}

/**
 * Page-level summary metrics for the My Produce page.
 * These are page-level inventory metrics, not an overview dashboard.
 */
export interface ProducePageSummary {
  /** Count of active listings published by this farmer */
  activeListingsCount: number;
  /** Trend subtext, e.g. "+2 published this week" */
  activeListingsTrend: string;
  /** Total available unreserved kg across all active listings */
  availableQuantityKg: number;
  /** Trend subtext, e.g. "+30 kg this week" */
  availableQuantityTrend: string;
  /** Total reserved kg held across all active listings */
  reservedQuantityKg: number;
  /** Trend subtext, e.g. "+50 Reserved this week" */
  reservedQuantityTrend: string;
  /** Total estimated value in integer LKR cents (sum of availableKg * unitPriceCents) */
  totalValueCents: number;
  /** Trend subtext, e.g. "+2 published this week" */
  totalValueTrend: string;
}

/** Filter and pagination query parameters for My Produce */
export interface ProduceFilterState {
  search: string;
  category: ProduceCategory;
  status: string;
  farm: string;
  viewMode: ProduceViewMode;
  page: number;
  pageSize: number;
}

/** Unified response structure for live produce listings query */
export interface ProduceApiResponse {
  listings: ProduceListingView[];
  summary: ProducePageSummary;
  total: number;
  page: number;
  pageSize: number;
  farms: Array<{ id: string; name: string }>;
  categoryCounts: Record<ProduceCategory, number>;
}

/**
 * Harvest batch candidate for produce listing creation.
 * Reflects schema.sql table harvest_batches with computed available sellable stock:
 * availableStockKg = sellable_kg - (activeReservedKg + committedKg)
 */
export interface HarvestBatchOption {
  /** Harvest batch UUID from harvest_batches.id */
  id: string;
  /** Human-readable batch identifier / code, e.g. "HB-2026-001 (Tomato)" */
  batchNumber: string;
  /** Farm UUID from harvest_batches.farm_id */
  farmId: string;
  /** Farm name from farms.name */
  farmName: string;
  /** Crop UUID from harvest_batches.crop_id */
  cropId: string;
  /** Crop name from crops.name */
  cropName: string;
  /** Presentation category mapped from crop name */
  category: Exclude<ProduceCategory, 'All'>;
  /** Grade UUID from harvest_batches.grade_id */
  gradeId: string;
  /** Grade name from grades.name, e.g. "Grade A" */
  gradeName: string;
  /** Harvest date recorded in YM08 harvest batch (ISO string or YYYY-MM-DD) */
  harvestDate?: string;
  /** Batch lifecycle status from harvest_batches.status */
  status: 'planned' | 'ready' | 'harvested' | 'depleted' | 'cancelled';
  /** Total harvested weight in kg from harvest_batches.actual_kg */
  actualKg: number;
  /** Net sellable weight in kg after grading/spoilage from harvest_batches.sellable_kg */
  sellableKg: number;
  /** Weight held in active reservations from reservations.held_kg */
  activeReservedKg: number;
  /** Weight committed to accepted buyer contracts from allocations.committed_kg */
  committedKg: number;
  /** Available unencumbered weight: sellableKg - (activeReservedKg + committedKg) */
  availableStockKg: number;
  /** Flag indicating if the batch already has an active trade listing (one_active_listing_per_batch) */
  hasActiveListing?: boolean;
}

/** Certified farm option sourced from YM07 */
export interface FarmerFarmOption {
  id: string;
  name: string;
  district?: string;
  status?: string;
}

/** Explicit state for external YM07 / YM08 dependency adapters */
export interface DependencyIntegrationState<T> {
  status: 'ready' | 'pending' | 'error';
  items: T[];
  message?: string;
  isSampleData?: boolean;
}

/**
 * State of the Produce Listing form (shared between Add and Edit modes).
 * Captures all user inputs across Sections 1 to 4 and the live preview.
 */
export interface AddProduceFormState {
  listingId?: string;
  farmId: string;
  farmName: string;
  cropId: string;
  cropName: string;
  category: Exclude<ProduceCategory, 'All'>;
  batchId: string;
  batchNumber: string;
  gradeId: string;
  gradeName: string;
  totalQuantity: number | '';
  unitPrice: number | ''; // In LKR per kg (e.g. 320)
  availableFrom: string; // YYYY-MM-DD
  availableUntil: string; // YYYY-MM-DD
  status?: ListingStatus;
}

/** Type alias for shared form state in create and edit modes */
export type ProduceListingFormState = AddProduceFormState;

/** Field-level validation error messages */
export interface AddProduceValidationErrors {
  farmId?: string;
  cropId?: string;
  batchId?: string;
  gradeId?: string;
  totalQuantity?: string;
  unitPrice?: string;
  availableFrom?: string;
  availableUntil?: string;
}

/** Available tabs on the Produce Listing Details page */
export type ListingDetailsTabId = 'overview' | 'allocations' | 'price-history' | 'activity';

/**
 * Itemized buyer allocation record linked to a produce listing's harvest batch.
 * Reflects schema.sql table allocations JOIN orders JOIN users.
 */
export interface ListingAllocationRecord {
  id: string; // e.g. "AL-2026-014"
  orderId: string; // e.g. "ORD-2026-009"
  buyerName: string; // e.g. "FreshMart Shop"
  buyerShopType?: string;
  allocatedKg: number;
  agreedUnitPriceCents: number;
  agreedValueCents: number;
  status: 'held' | 'supplier_accepted' | 'committed' | 'picked_up' | 'handed_over' | 'accepted' | 'partially_accepted' | 'disputed' | 'resolved' | 'declined' | 'expired' | 'cancelled';
  displayStatus: 'Confirmed' | 'Pending' | 'Committed' | 'Completed' | 'Disputed' | 'Declined';
  allocatedOn: string; // ISO UTC string
}

/**
 * Confirmed purchase order linked to the produce listing.
 * Reflects schema.sql table orders JOIN allocations JOIN users.
 */
export interface ListingOrderRecord {
  id: string; // e.g. "ORD-2026-009"
  buyerName: string; // e.g. "FreshMart Shop"
  orderKg: number;
  orderValueCents: number | null;
  status: string;
  displayStatus: 'Completed' | 'Processing' | 'Confirmed' | 'Delivered' | 'Cancelled';
  orderDate: string; // ISO UTC string
}

/**
 * Data point for the SVG price history trend chart.
 */
export interface PriceTrendPoint {
  timestamp: string;
  unitPriceCents: number;
  dateLabel: string; // e.g. "05 Nov"
}

/**
 * Change record for the Price Change History table.
 * Corresponds to audit_logs safe_changes diffs for target_type = 'listing'.
 */
export interface PriceChangeRecord {
  id: string;
  timestamp: string; // ISO UTC string
  unitPriceCents: number;
  previousUnitPriceCents?: number;
  deltaCents?: number;
  reason?: string;
}

/**
 * Chronological timeline event for the Activity tab.
 * Sourced from persisted audit_logs, allocations, and orders records.
 */
export interface ActivityEventRecord {
  id: string;
  eventType: 'price_update' | 'allocation_confirmed' | 'allocation_created' | 'order_completed' | 'order_placed' | 'listing_updated' | 'listing_created' | 'status_change';
  title: string;
  description: string;
  timestamp: string; // ISO UTC string
  actorName?: string;
}

/**
 * Comprehensive view model for the Produce Listing Details page.
 * Combines listing summary, stock invariants, and tab-specific collections.
 */
export interface ProduceListingDetailView extends ProduceListingView {
  batchNumber: string;
  updatedAt?: string;
  allocations: ListingAllocationRecord[];
  orders: ListingOrderRecord[];
  priceHistory: PriceChangeRecord[];
  priceTrend: PriceTrendPoint[];
  activityLog: ActivityEventRecord[];
}

export type ProduceImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ProduceImageSignatureRequest {
  contentType: ProduceImageMimeType;
  fileSizeBytes: number;
}

export interface ProduceImageSignatureResponse {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  fullPublicId: string;
}

export interface ProduceImageConfirmResponse {
  id: string;
  imageUrl: string | null;
}

export interface ProduceImageDeleteResponse {
  id: string;
  imageUrl: null;
  removed: boolean;
}

export interface Ym09ModuleCapabilities {
  imageStorageEnabled: boolean;
}

export interface Ym09ModuleStatusResponse {
  module: string;
  owner: string;
  status: string;
  capabilities?: Ym09ModuleCapabilities;
}
