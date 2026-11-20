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
  isExpiringSoon?: boolean;
  status: string;
  statusDisplay: string;
  createdAt?: string;
}

export type TabKey = 'all' | 'awaiting' | 'accepted' | 'declined' | 'expired';

export interface FilterState {
  activeTab: TabKey;
  search: string;
  status: string;
  crop: string;
  sort: string;
}
