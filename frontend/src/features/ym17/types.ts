/**
 * Feature-local TypeScript types for YM17: Farmer Allocations Inbox.
 * Follows the backend database schema and Task 01A response contracts.
 */

export interface AllocationSummary {
  pendingResponses: number;
  acceptedAllocations: number;
  declinedAllocations: number;
  expiringSoon: number;
}

export interface AllocationItem {
  allocationId: string;
  orderId: string;
  batchId: string;
  /**
   * Public batch display reference (e.g. "BM-08") when the platform has one.
   * Null means "no reference available": raw UUIDs are never rendered as if
   * they were business references (see PROPOSALS.md for the reference plan).
   */
  batchDisplayId?: string | null;
  buyerName: string;
  cropName: string;
  gradeName: string;
  agreedKg: string | number;
  agreedUnitPriceCents?: string | number;
  agreedValueFormatted: string;
  reservationStatus?: string | null;
  reservationExpiresAt?: string | null;
  reservationExpiryFormatted: string;
  expirySubtext: string;
  isExpiringSoon: boolean;
  /** Derived from the reservation row; never changes the stored status. */
  holdState: HoldState;
  status: string;
  statusDisplay: string;
  createdAt?: string;
}

/** Lifecycle of the reservation hold attached to an allocation, for display only. */
export type HoldState = 'active' | 'expired' | 'consumed' | 'none';

export type TabKey = 'all' | 'awaiting' | 'accepted' | 'declined' | 'expired';

/** Which dashboard summary card was activated; drives inbox navigation. */
export type SummaryCardKey = 'pending' | 'accepted' | 'declined' | 'expiring';

/**
 * Read-side response-eligibility filters accepted by GET /api/ym17/allocations.
 * They mirror the dashboard summary predicates exactly:
 * pending = live hold awaiting a decision, expiring = pending inside the
 * deadline window, expired = stored-expired or a held row whose hold is dead.
 */
export type EligibilityFilter = 'pending' | 'expiring' | 'expired';

/**
 * Read-side farmer-DEcision filters accepted by GET /api/ym17/allocations.
 * Audit-backed only: `accepted` matches allocations whose earliest recorded
 * farmer decision is the `allocation.accepted` audit event — never an
 * operational status, and never an allocation without a decision event
 * (SRS FR-RES-04).
 */
export type DecisionFilter = 'accepted';

export interface FilterState {
  activeTab: TabKey;
  search: string;
  status: string;
  crop: string;
  sort: string;
}

/** Pagination block returned by GET /api/ym17/allocations. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * One allocation as returned by GET /api/ym17/allocations/:allocationId
 * (Task 02A). NUMERIC and BIGINT columns arrive as strings; timestamps are ISO
 * strings; no idempotency operation keys are ever included.
 */
export interface AllocationDetail {
  allocationId: string;
  orderId: string;
  batchId: string;
  /** Public batch display reference when available; null when none exists. */
  batchDisplayId?: string | null;
  buyerName: string;
  cropName: string;
  gradeName: string;
  farmName: string;
  farmDistrict: string;
  agreedKg: string;
  agreedUnitPriceCents: string;
  agreedValueCents: string;
  status: string;
  /** Farmer's recorded decision reason, when the backend has one. */
  decisionReason: string | null;
  reservationStatus: string | null;
  reservationExpiresAt: string | null;
  reservationHeldKg: string | null;
  orderStatus: string;
  /** Calendar date, "YYYY-MM-DD". */
  orderDeliveryDate: string;
  orderDestinationDistrict: string;
  createdAt: string;
  /** Informational only: true when the backend says a response is possible now. */
  canRespond: boolean;
  /** Why the farmer cannot respond right now; null when canRespond is true. */
  responseUnavailableReason: string | null;
}

/* -------------------- Allocation History (Task 04B-2) -------------------- */

export interface HistorySummary {
  totalHistoricalAllocations: number;
  accepted: number;
  declined: number;
  expired: number;
}

export type FarmerDecision = 'accepted' | 'declined' | null;

/** Raw DTO row returned by GET /api/ym17/allocations/history. */
export interface ApiHistoryAllocation {
  allocationId: string;
  orderId: string;
  buyerName: string;
  batchId: string;
  /** Public batch display reference when available; null when none exists. */
  batchDisplayId?: string | null;
  cropName: string;
  gradeName: string;
  agreedKg: string;
  agreedUnitPriceCents: string;
  agreedValueCents: string;
  farmerDecision: FarmerDecision;
  farmerDecisionAt: string | null;
  farmerDecisionReason: string | null;
  operationalStatus: string;
  orderStatus: string;
  createdAt: string;
}

export interface ApiHistoryResponse {
  allocations: ApiHistoryAllocation[];
  summary: HistorySummary;
  pagination: Pagination;
  requestId: string;
}

/** Formatted allocation record rendered by the History table. */
export interface HistoryItem {
  allocationId: string;
  orderId: string;
  batchId: string;
  /** Public batch display reference when available; null when none exists. */
  batchDisplayId?: string | null;
  buyerName: string;
  cropName: string;
  gradeName: string;
  agreedKg: string;
  agreedUnitPriceFormatted: string;
  agreedValueFormatted: string;
  farmerDecision: FarmerDecision;
  farmerDecisionDisplay: string;
  farmerDecisionAtFormatted: string;
  farmerDecisionReason: string | null;
  operationalStatus: string;
  operationalStatusDisplay: string;
  orderStatus: string;
  orderStatusDisplay: string;
  createdAtFormatted: string;
  createdAtIso: string;
}

/**
 * Quick tabs of the Allocation History page. The internal value `accepted`
 * is the visible "Progressed" tab (operational statuses beyond `held`); it
 * is kept unchanged so existing `?tab=accepted` deep links stay valid.
 */
export type HistoryTabKey = 'all' | 'accepted' | 'declined' | 'expired' | 'other';

export interface HistoryQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort?: string;
}
