const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFER_STATUSES = new Set(['pending', 'accepted', 'rejected', 'withdrawn', 'expired']);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function requireUuid(value, fieldName) {
  // Keep all user-supplied identifiers in canonical UUID syntax before they reach SQL.
  if (!isUuid(value)) throw new ValidationError(`${fieldName} must be a valid UUID`);
  return value;
}

// Keep raw decimal text intact so excess precision cannot be hidden by floating-point rounding.
function parseDecimal(value, maxDecimals, fieldName) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  const raw = String(value).trim();
  const decimalPattern = new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`);
  if (!decimalPattern.test(raw)) {
    throw new ValidationError(`${fieldName} must be a positive number with at most ${maxDecimals} decimal places`);
  }
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return { raw, number };
}

// Require a real YYYY-MM-DD calendar date, not just a string with a matching shape.
function validateDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

// Validate list filters, including UUIDs and a non-negative delivery window.
export function validateRequestFilters(query) {
  let deliveryWithinDays = null;
  if (query.deliveryWithinDays !== undefined && query.deliveryWithinDays !== '') {
    const rawDays = String(query.deliveryWithinDays);
    deliveryWithinDays = Number(rawDays);
    if (!/^\d+(?:\.\d+)?$/.test(rawDays) || !Number.isFinite(deliveryWithinDays)) {
      throw new ValidationError('deliveryWithinDays must be a non-negative number');
    }
  }
  return {
    search: typeof query.search === 'string' ? query.search.trim() : '',
    cropId: query.cropId ? requireUuid(query.cropId, 'cropId') : null,
    gradeId: query.gradeId ? requireUuid(query.gradeId, 'gradeId') : null,
    district: typeof query.district === 'string' ? query.district.trim() : '',
    deliveryWithinDays,
  };
}

// Validate the path identifier before any request-detail or offer query is issued.
export function validateRequestId(value) {
  return requireUuid(value, 'requestId');
}

// Validate offer body fields while preserving the original quantity precision for PostgreSQL.
export function validateOfferInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object');
  }
  // Validate both UUIDs and preserve quantity text so PostgreSQL receives the submitted precision.
  const batchId = requireUuid(body.batchId, 'batchId');
  const quantity = parseDecimal(body.quantityKg, 3, 'quantityKg');
  // Keep the accepted quantity within the precision of the database numeric(12,3) column.
  if (quantity.number >= 1000000000) {
    throw new ValidationError('quantityKg must be less than 1,000,000,000');
  }

  // Convert the validated LKR amount to integer cents only after enforcing its two-decimal limit.
  const price = parseDecimal(body.pricePerKgLkr, 2, 'pricePerKgLkr');
  // Cap the per-kilogram price at the supported business limit before converting it to cents.
  if (price.number > 100000000) {
    throw new ValidationError('pricePerKgLkr must not exceed 100,000,000');
  }
  const pricePerKgCents = Math.round(price.number * 100);
  if (!Number.isSafeInteger(pricePerKgCents) || pricePerKgCents <= 0) {
    throw new ValidationError('pricePerKgLkr is outside the supported range');
  }

  // Validate the optional date shape here; its delivery-window bound is checked against the loaded request.
  const availableFrom = body.availableFrom === undefined || body.availableFrom === null || body.availableFrom === ''
    ? null
    : validateDate(body.availableFrom, 'availableFrom');

  // Normalize notes before checking the length so surrounding whitespace is not counted or stored.
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    throw new ValidationError('notes must be a string');
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
  if (notes !== null && notes.length > 500) {
    throw new ValidationError('notes must be at most 500 characters');
  }

  return {
    batchId,
    quantityKgRaw: quantity.raw,
    quantityKg: quantity.number,
    pricePerKgCents,
    availableFrom,
    notes,
  };
}

// Restrict caller-provided idempotency keys to a short, header-safe token.
export function validateIdempotencyKey(value) {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ValidationError('Idempotency-Key must be at most 100 characters and contain only letters, numbers, hyphens, and underscores');
  }
}

// Restrict offer history filters to documented states and normalize empty search text.
export function validateOfferFilters(query) {
  const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim() : null;
  if (status && !OFFER_STATUSES.has(status)) {
    throw new ValidationError('status must be pending, accepted, rejected, withdrawn, or expired');
  }
  return {
    status,
    search: typeof query.search === 'string' ? query.search.trim() : '',
  };
}
