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
  /** Available unreserved sellable weight in kg (DR-01: sellable_kg - active holds - commitments) */
  availableKg: number;
  /** Active reserved weight in kg from reservations.held_kg WHERE status = 'active' */
  reservedKg: number;
  /** Committed weight in kg from allocations.committed_kg */
  committedKg: number;
  /** Listing status from listings.status */
  status: ListingStatus;
  /** Optional image URL or asset path (FR-FARM-10: fallback placeholder used if omitted) */
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

/** Category tab item with display label, category key, count, and icon identifier */
export interface CategoryFilterItem {
  key: ProduceCategory;
  label: string;
  count: number;
  iconName: 'grid' | 'vegetable' | 'fruit' | 'grain' | 'spice' | 'other';
}

/** Unified response structure for produce listings query */
export interface ProduceApiResponse {
  listings: ProduceListingView[];
  summary: ProducePageSummary;
  total: number;
  page: number;
  pageSize: number;
  farms: Array<{ id: string; name: string }>;
  categoryCounts: Record<ProduceCategory, number>;
  /** Explicitly flags whether the returned data is development sample data */
  isSampleData?: boolean;
}
