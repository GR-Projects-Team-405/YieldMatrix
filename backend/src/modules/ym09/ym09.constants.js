/**
 * Centralized domain constants, workflow state transitions, and HTTP error types
 * for YieldMatrix Module YM09 – Produce Listings.
 */

export const YM09_MODULE_META = Object.freeze({
  module: 'YM09',
  owner: 'Imalka Randev',
  status: 'active',
  farmerRole: 'farmer',
  approvedAccountStatus: 'approved',
});

export const LISTING_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  CLOSED: 'closed',
});

export const VALID_LISTING_STATUSES = Object.freeze(Object.values(LISTING_STATUS));

/**
 * Permitted server-controlled status transitions for produce listings.
 * Self-transitions (no change) are permitted on partial/idempotent updates.
 */
export const VALID_LISTING_TRANSITIONS = Object.freeze({
  [LISTING_STATUS.DRAFT]: Object.freeze([LISTING_STATUS.ACTIVE, LISTING_STATUS.CLOSED]),
  [LISTING_STATUS.ACTIVE]: Object.freeze([
    LISTING_STATUS.PAUSED,
    LISTING_STATUS.EXPIRED,
    LISTING_STATUS.CLOSED,
  ]),
  [LISTING_STATUS.PAUSED]: Object.freeze([
    LISTING_STATUS.ACTIVE,
    LISTING_STATUS.EXPIRED,
    LISTING_STATUS.CLOSED,
  ]),
  [LISTING_STATUS.EXPIRED]: Object.freeze([LISTING_STATUS.CLOSED]),
  [LISTING_STATUS.CLOSED]: Object.freeze([]),
});

export const HARVEST_BATCH_ELIGIBLE_STATUS = 'harvested';
export const FARM_ACTIVE_STATUS = 'active';
export const CREATE_ALLOWED_INITIAL_STATUSES = Object.freeze([
  LISTING_STATUS.ACTIVE,
  LISTING_STATUS.DRAFT,
]);
export const PG_UNIQUE_VIOLATION = '23505';

export const ALLOCATION_STATUS = Object.freeze({
  HELD: 'held',
  SUPPLIER_ACCEPTED: 'supplier_accepted',
  COMMITTED: 'committed',
  PICKED_UP: 'picked_up',
  HANDED_OVER: 'handed_over',
  ACCEPTED: 'accepted',
  PARTIALLY_ACCEPTED: 'partially_accepted',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

/**
 * Allocation states that actively encumber batch stock (DR-01):
 * - held & supplier_accepted lock full agreed_kg
 * - committed & disputed lock uncollected (committed_kg - picked_up_kg)
 */
export const ENCUMBERED_ALLOCATION_STATUSES = Object.freeze([
  ALLOCATION_STATUS.HELD,
  ALLOCATION_STATUS.SUPPLIER_ACCEPTED,
  ALLOCATION_STATUS.COMMITTED,
  ALLOCATION_STATUS.DISPUTED,
]);

export const COMMITTED_ALLOCATION_STATUSES = Object.freeze([
  ALLOCATION_STATUS.COMMITTED,
]);

export const ALLOWED_UPDATE_FIELDS = Object.freeze([
  'batchId',
  'farmId',
  'offeredKg',
  'unitPriceCents',
  'validFrom',
  'validUntil',
  'status',
]);

export const ALLOWED_CREATE_FIELDS = Object.freeze([
  'batchId',
  'farmId',
  'offeredKg',
  'unitPriceCents',
  'validFrom',
  'validUntil',
  'status',
]);

export const MAX_KG_DECIMALS = 3;
export const MAX_KG_EXCLUSIVE = 1000000000;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const AUDIT_TARGET_TYPE_LISTING = 'listing';
export const AUDIT_ACTION_CREATE = 'create_listing';
export const AUDIT_ACTION_UPDATE = 'update_listing';
export const AUDIT_ACTION_PRICE_UPDATE = 'update_listing_price';
export const AUDIT_ACTION_STATUS_UPDATE = 'update_listing_status';
export const AUDIT_ACTION_IMAGE_UPDATE = 'update_listing_image';
export const AUDIT_ACTION_IMAGE_DELETE = 'delete_listing_image';

export const IMAGE_MIME_TO_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze(Object.keys(IMAGE_MIME_TO_EXT));
export const ALLOWED_CLOUDINARY_IMAGE_FORMATS = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);
export const ALLOWED_IMAGE_UPLOAD_FIELDS = Object.freeze(['contentType', 'fileSizeBytes']);
export const ALLOWED_IMAGE_CONFIRM_FIELDS = Object.freeze(['publicId']);
export const DEFAULT_MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
export const CLOUDINARY_BASE_FOLDER = 'yieldmatrix/produce';

export function isYm09ImageStorageEnabled() {
  return String(process.env.YM09_IMAGE_STORAGE_ENABLED ?? 'false').trim().toLowerCase() === 'true';
}

export function getMaxImageFileSizeBytes() {
  const configured = Number(process.env.YM09_IMAGE_MAX_BYTES);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_MAX_IMAGE_FILE_BYTES;
}

/**
 * Base operational error with HTTP status code and optional field-level errors.
 */
export class Ym09AppError extends Error {
  constructor(statusCode, message, fields = undefined) {
    super(message);
    this.name = 'Ym09AppError';
    this.statusCode = statusCode;
    if (fields && Object.keys(fields).length > 0) {
      this.fields = fields;
    }
  }
}

export function createValidationError(message, fields = undefined) {
  return new Ym09AppError(400, message, fields);
}

export function createUnauthorizedError(message) {
  return new Ym09AppError(401, message);
}

export function createForbiddenError(message) {
  return new Ym09AppError(403, message);
}

export function createNotFoundError(message) {
  return new Ym09AppError(404, message);
}

export function createConflictError(message) {
  return new Ym09AppError(409, message);
}

export function createBadGatewayError(message) {
  return new Ym09AppError(502, message);
}

export function createServiceUnavailableError(message) {
  return new Ym09AppError(503, message);
}
