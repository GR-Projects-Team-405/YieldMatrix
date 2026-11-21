import axios from 'axios';
import api from '../../services/api';
import { formatColomboDateTime, formatKg, formatLkrCents, shortId, statusLabel } from './format';
import type { AllocationItem, AllocationSummary, HoldState, Pagination } from './types';

/**
 * Feature-local API helper for YM17.
 * Talks to the two Task 01A endpoints through the shared Axios client, which
 * already adds the `/api` base URL and the bearer token.
 */

/** Mirrors EXPIRING_SOON_MINUTES in backend/src/modules/ym17/controller.js. */
const EXPIRING_SOON_MS = 10 * 60 * 1000;

/** Raw shape returned by GET /api/ym17/allocations. */
export interface ApiAllocation {
  allocationId: string;
  allocationReference: string;
  orderId: string;
  orderReference: string | null;
  buyerName: string;
  batchId: string;
  cropName: string;
  gradeName: string;
  agreedKg: string;
  agreedUnitPriceCents: string;
  agreedValueCents: string;
  status: string;
  reservationStatus: string | null;
  reservationExpiresAt: string | null;
  createdAt: string;
}

export interface ApiAllocationList {
  allocations: ApiAllocation[];
  pagination: Pagination;
  requestId: string;
}

export interface ApiSummary {
  summary: AllocationSummary;
  requestId: string;
}

/**
 * Status values accepted by GET /api/ym17/allocations.
 * Mirrors the allocations.status CHECK constraint in backend/database/schema.sql.
 * The backend accepts exactly ONE status per request.
 */
export const ALLOCATION_STATUSES = [
  'held',
  'supplier_accepted',
  'committed',
  'picked_up',
  'handed_over',
  'accepted',
  'partially_accepted',
  'disputed',
  'resolved',
  'declined',
  'expired',
  'cancelled',
] as const;

export interface AllocationQuery {
  page?: number;
  limit?: number;
  /** A single allocation status; omitted when not filtering by status. */
  status?: string;
  /** Free-text search over allocation id, buyer name and crop. */
  search?: string;
  /** Crop id or name; omitted unless supplied. */
  crop?: string;
  /** newest | oldest | expiry */
  sort?: string;
}

/** GET /api/ym17/summary */
export async function fetchSummary(signal?: AbortSignal): Promise<AllocationSummary> {
  const { data } = await api.get<ApiSummary>('/ym17/summary', { signal });
  return requireSummary(data.summary);
}

/**
 * GET /api/ym17/allocations
 * Every optional filter is only added to `params` when it actually has a value,
 * so unused parameters are never sent to the backend.
 */
export async function fetchAllocations(query: AllocationQuery = {}, signal?: AbortSignal): Promise<ApiAllocationList> {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.status) params.status = query.status;
  if (query.search) params.search = query.search;
  if (query.crop) params.crop = query.crop;
  if (query.sort) params.sort = query.sort;
  const { data } = await api.get<ApiAllocationList>('/ym17/allocations', { params, signal });
  if (!Array.isArray(data.allocations)) throw new Error('Unexpected allocations response');
  return data;
}

/** Extracts a safe, user-facing message; returns '' when the request was cancelled. */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return '';
    const payload = error.response?.data as { error?: unknown } | undefined;
    if (typeof payload?.error === 'string' && payload.error) return payload.error;
    return 'The request could not be completed. Check your connection and try again.';
  }
  return 'Something went wrong while loading this data.';
}

/* ------------------------------- mapping -------------------------------- */

/** Rejects a malformed summary instead of rendering fabricated zeros. */
function requireSummary(summary: AllocationSummary | undefined): AllocationSummary {
  if (!summary) throw new Error('Unexpected summary response');
  const values = [summary.pendingResponses, summary.acceptedAllocations, summary.declinedAllocations, summary.expiringSoon];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('Unexpected summary response');
  }
  return {
    pendingResponses: summary.pendingResponses,
    acceptedAllocations: summary.acceptedAllocations,
    declinedAllocations: summary.declinedAllocations,
    expiringSoon: summary.expiringSoon,
  };
}

interface HoldInfo {
  state: HoldState;
  subtext: string;
  isExpiringSoon: boolean;
}

/**
 * Reads the reservation hold from the row alone.
 * A hold counts as actionable only while it is active *and* still in the
 * future, so an expired reservation is never presented as a pending request.
 */
function evaluateHold(reservationStatus: string | null, reservationExpiresAt: string | null): HoldInfo {
  if (!reservationStatus || !reservationExpiresAt) {
    return { state: 'none', subtext: 'No active hold', isExpiringSoon: false };
  }
  const expiresAt = new Date(reservationExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return { state: 'none', subtext: 'No active hold', isExpiringSoon: false };
  if (reservationStatus === 'consumed') return { state: 'consumed', subtext: 'Hold used', isExpiringSoon: false };
  const now = Date.now();
  if (reservationStatus !== 'active' || expiresAt <= now) {
    return { state: 'expired', subtext: 'Expired', isExpiringSoon: false };
  }
  if (expiresAt <= now + EXPIRING_SOON_MS) {
    return { state: 'active', subtext: 'Expires soon', isExpiringSoon: true };
  }
  return { state: 'active', subtext: 'Asia/Colombo', isExpiringSoon: false };
}

/** Backend DTO -> the shape the existing AllocationTable already renders. */
export function toAllocationItem(raw: ApiAllocation): AllocationItem {
  const hold = evaluateHold(raw.reservationStatus, raw.reservationExpiresAt);
  return {
    allocationId: raw.allocationId,
    allocationReference: shortId(raw.allocationId),
    orderId: raw.orderId,
    buyerName: raw.buyerName,
    batchId: raw.batchId,
    batchReference: shortId(raw.batchId),
    cropName: raw.cropName,
    gradeName: raw.gradeName,
    agreedKg: formatKg(raw.agreedKg),
    agreedValueFormatted: formatLkrCents(raw.agreedValueCents),
    reservationStatus: raw.reservationStatus,
    reservationExpiresAt: raw.reservationExpiresAt,
    reservationExpiryFormatted: formatColomboDateTime(raw.reservationExpiresAt),
    expirySubtext: hold.subtext,
    isExpiringSoon: hold.isExpiringSoon,
    holdState: hold.state,
    status: raw.status,
    statusDisplay: statusLabel(raw.status),
    createdAt: raw.createdAt,
  };
}
