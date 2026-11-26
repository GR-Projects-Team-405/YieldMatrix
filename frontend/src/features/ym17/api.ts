import axios from 'axios';
import api from '../../services/api';
import { formatColomboDateTime, formatKg, formatLkrCents, statusLabel } from './format';
import type {
  AllocationDetail,
  AllocationItem,
  AllocationSummary,
  ApiHistoryAllocation,
  ApiHistoryResponse,
  DecisionFilter,
  EligibilityFilter,
  HistoryItem,
  HistoryQuery,
  HoldState,
  Pagination,
} from './types';

/**
 * Feature-local API helper for YM17.
 * Talks to the three Task 01A/02A endpoints through the shared Axios client,
 * which already adds the `/api` base URL and the bearer token.
 */

/** Mirrors EXPIRING_SOON_MINUTES in backend/src/modules/ym17/controller.js. */
const EXPIRING_SOON_MS = 10 * 60 * 1000;

/** Mirrors MAX_REASON_LENGTH in backend/src/modules/ym17/controller.js. */
export const MAX_DECISION_REASON_LENGTH = 500;

/** Raw shape returned by GET /api/ym17/allocations. */
export interface ApiAllocation {
  allocationId: string;
  orderId: string;
  buyerName: string;
  batchId: string;
  /** Public batch display reference when the platform has one; null otherwise. */
  batchDisplayId: string | null;
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

/** Raw shape returned by GET /api/ym17/allocations/:allocationId. */
export interface ApiAllocationDetailResponse {
  allocation: AllocationDetail;
  requestId: string;
}

/** Same shape as the backend's UUID_PATTERN check. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client-side id guard: a mangled URL is answered locally instead of firing a
 * request the backend can only reject with 400.
 */
export function isValidAllocationId(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/** True when the API answered 404 (allocation missing or owned by someone else). */
export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

/** HTTP status of an API failure; undefined for network or unknown errors. */
export function getHttpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * True when the API answered 409: the allocation is no longer `held`, or the
 * reservation is missing/expired. The decision endpoints are authoritative, so
 * a 409 means the page's copy of the allocation is stale.
 */
export function isConflictError(error: unknown): boolean {
  return getHttpStatus(error) === 409;
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
  /**
   * Server-side response-eligibility filter (mirrors the summary predicates).
   * When set, the backend derives the status condition itself, so `status` is
   * left unset by the caller for `held`/`expired`.
   */
  eligibility?: EligibilityFilter;
  /**
   * Genuine farmer-decision filter (audit-backed, Inbox "Accepted" tab).
   * When set, the backend narrows the list to allocations whose earliest
   * recorded farmer decision is `allocation.accepted`; `status` is left unset
   * by the caller so no operational status group is ever fabricated.
   */
  decision?: DecisionFilter;
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
  if (query.eligibility) params.eligibility = query.eligibility;
  if (query.decision) params.decision = query.decision;
  if (query.search) params.search = query.search;
  if (query.crop) params.crop = query.crop;
  if (query.sort) params.sort = query.sort;
  const { data } = await api.get<ApiAllocationList>('/ym17/allocations', { params, signal });
  if (!Array.isArray(data.allocations)) throw new Error('Unexpected allocations response');
  return data;
}

/**
 * GET /api/ym17/allocations/:allocationId
 * One allocation's read-only details. The id is URL-encoded and must already
 * have passed isValidAllocationId, so the request is always well formed.
 */
export async function fetchAllocationDetails(
  allocationId: string,
  signal?: AbortSignal,
): Promise<AllocationDetail> {
  const { data } = await api.get<ApiAllocationDetailResponse>(
    `/ym17/allocations/${encodeURIComponent(allocationId.trim())}`,
    { signal },
  );
  return requireDetail(data?.allocation);
}

/**
 * POST /api/ym17/allocations/:allocationId/accept (Task 03C-2)
 * No request body. The backend moves the allocation `held -> supplier_accepted`
 * and deliberately keeps the active reservation untouched (SRS: the stock stays
 * protected until the buyer confirms the order). The response is the same
 * `{ allocation, requestId }` shape as the GET, so the caller can replace its
 * copy of the allocation with the server's post-decision record.
 */
export async function submitAllocationAccept(
  allocationId: string,
  signal?: AbortSignal,
): Promise<AllocationDetail> {
  const id = requireAllocationId(allocationId);
  const { data } = await api.post<ApiAllocationDetailResponse>(
    `/ym17/allocations/${encodeURIComponent(id)}/accept`,
    undefined,
    { signal },
  );
  return requireDetail(data?.allocation);
}

/**
 * POST /api/ym17/allocations/:allocationId/decline (Task 03C-2)
 * Body: `{ reason }`, trimmed to 1..500 characters and validated here so an
 * obviously empty reason never reaches the network — the backend validates it
 * again inside its own check. The backend moves `held -> declined` and releases
 * the active reservation in the same transaction. Same response shape as GET.
 */
export async function submitAllocationDecline(
  allocationId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<AllocationDetail> {
  const id = requireAllocationId(allocationId);
  const value = requireDecisionReason(reason);
  const { data } = await api.post<ApiAllocationDetailResponse>(
    `/ym17/allocations/${encodeURIComponent(id)}/decline`,
    { reason: value },
    { signal },
  );
  return requireDetail(data?.allocation);
}

/** URL id guard for the mutating helpers; same rule as isValidAllocationId. */
function requireAllocationId(allocationId: string): string {
  const id = (allocationId ?? '').trim();
  if (!UUID_PATTERN.test(id)) throw new Error('allocationId must be a valid UUID');
  return id;
}

/** Reason guard mirroring readDecisionReason() in the YM17 controller. */
function requireDecisionReason(reason: string): string {
  const value = typeof reason === 'string' ? reason.trim() : '';
  if (value.length < 1 || value.length > MAX_DECISION_REASON_LENGTH) {
    throw new Error(`reason must be between 1 and ${MAX_DECISION_REASON_LENGTH} characters`);
  }
  return value;
}

/** Shared shape check for every single-allocation response (GET and POSTs). */
function requireDetail(allocation: AllocationDetail | undefined): AllocationDetail {
  if (!allocation || typeof allocation.allocationId !== 'string' || typeof allocation.canRespond !== 'boolean') {
    throw new Error('Unexpected allocation details response');
  }
  return allocation;
}

/** Extracts a safe, user-facing message; returns '' when the request was cancelled. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong while loading this data.'): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return '';
    const payload = error.response?.data as { error?: unknown } | undefined;
    if (typeof payload?.error === 'string' && payload.error) return payload.error;
    return 'The request could not be completed. Check your connection and try again.';
  }
  return fallback;
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
    orderId: raw.orderId,
    batchId: raw.batchId,
    batchDisplayId: raw.batchDisplayId ?? null,
    buyerName: raw.buyerName,
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

/* -------------------- Allocation History (Task 04B-2) -------------------- */

/**
 * Historical operational statuses allowed by GET /api/ym17/allocations/history.
 * 'held' is excluded because held allocations remain in the inbox.
 */
export const HISTORY_OPERATIONAL_STATUSES = [
  'supplier_accepted',
  'committed',
  'picked_up',
  'handed_over',
  'accepted',
  'partially_accepted',
  'declined',
  'expired',
  'cancelled',
  'disputed',
  'resolved',
] as const;

/**
 * GET /api/ym17/allocations/history
 * Fetches farmer's historical allocations with audit-backed decisions and operational statuses.
 */
export async function fetchAllocationHistory(
  query: HistoryQuery = {},
  signal?: AbortSignal,
): Promise<ApiHistoryResponse> {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.status) params.status = query.status;
  if (query.search) params.search = query.search;
  if (query.sort) params.sort = query.sort;
  const { data } = await api.get<ApiHistoryResponse>('/ym17/allocations/history', { params, signal });
  if (!Array.isArray(data?.allocations)) throw new Error('Unexpected allocation history response');
  return data;
}

/** Backend History DTO -> Formatted HistoryItem */
export function toHistoryItem(raw: ApiHistoryAllocation): HistoryItem {
  let farmerDecisionDisplay = 'Not recorded';
  if (raw.farmerDecision === 'accepted') farmerDecisionDisplay = 'Accepted';
  if (raw.farmerDecision === 'declined') farmerDecisionDisplay = 'Declined';

  return {
    allocationId: raw.allocationId,
    orderId: raw.orderId,
    buyerName: raw.buyerName,
    batchId: raw.batchId,
    batchDisplayId: raw.batchDisplayId ?? null,
    cropName: raw.cropName,
    gradeName: raw.gradeName,
    agreedKg: formatKg(raw.agreedKg),
    agreedUnitPriceFormatted: `${formatLkrCents(raw.agreedUnitPriceCents)}/kg`,
    agreedValueFormatted: formatLkrCents(raw.agreedValueCents),
    farmerDecision: raw.farmerDecision,
    farmerDecisionDisplay,
    farmerDecisionAtFormatted: raw.farmerDecisionAt ? formatColomboDateTime(raw.farmerDecisionAt) : '—',
    farmerDecisionReason: raw.farmerDecisionReason,
    operationalStatus: raw.operationalStatus,
    operationalStatusDisplay: statusLabel(raw.operationalStatus),
    orderStatus: raw.orderStatus,
    orderStatusDisplay: statusLabel(raw.orderStatus),
    createdAtFormatted: formatColomboDateTime(raw.createdAt),
    createdAtIso: raw.createdAt,
  };
}
