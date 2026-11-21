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
  allocationReference: string;
  orderId: string;
  orderReference?: string;
  buyerName: string;
  batchId: string;
  batchReference: string;
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
