import {
  ALLOWED_CREATE_FIELDS,
  ALLOWED_UPDATE_FIELDS,
  CREATE_ALLOWED_INITIAL_STATUSES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  LISTING_STATUS,
  MAX_KG_DECIMALS,
  MAX_KG_EXCLUSIVE,
  MAX_PAGE_SIZE,
  VALID_LISTING_STATUSES,
  VALID_LISTING_TRANSITIONS,
  createValidationError,
} from './ym09.constants.js';

/**
 * Accepts standard hex UUIDs including synthetic development seed IDs (matching authMiddleware.js).
 */
const UUID_REGEX = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const STRICT_DECIMAL_REGEX = /^\d+(?:\.\d+)?$/;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates that a listing or entity ID is a well-formed UUID string.
 */
export function validateListingId(id) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw createValidationError('Invalid listing ID format. Must be a valid UUID.');
  }
  return id;
}

/**
 * Validates an optional or required UUID field.
 */
export function validateUuidField(value, fieldName) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value.trim())) {
    throw createValidationError(`Invalid ${fieldName} format. Must be a valid UUID.`, {
      [fieldName]: 'Must be a valid UUID.',
    });
  }
  return value.trim();
}

/**
 * Rejects request bodies containing unexpected/protected properties.
 */
export function assertAllowedFields(body, allowedFields) {
  const allowedSet = new Set(allowedFields);
  const unknownKeys = Object.keys(body).filter((key) => !allowedSet.has(key));
  if (unknownKeys.length > 0) {
    const fields = Object.fromEntries(
      unknownKeys.map((key) => [key, `Field '${key}' is not supported.`])
    );
    throw createValidationError(
      `Unsupported request field(s): ${unknownKeys.join(', ')}.`,
      fields
    );
  }
}

/**
 * Validates a positive quantity in kg with at most 3 decimal places (DR-06).
 * Rejects unsupported fractional precision instead of silently rounding.
 */
export function validateKgQuantity(rawValue, fieldName = 'offeredKg') {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    throw createValidationError(`${fieldName} is required.`, {
      [fieldName]: 'Quantity is required.',
    });
  }

  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw createValidationError(`${fieldName} must be a valid number.`, {
      [fieldName]: 'Quantity must be a positive number.',
    });
  }

  let decimalStr;
  let numericValue;

  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      throw createValidationError(`${fieldName} must be a finite number.`, {
        [fieldName]: 'Quantity must be a finite number.',
      });
    }
    decimalStr = rawValue.toString();
    if (!STRICT_DECIMAL_REGEX.test(decimalStr)) {
      throw createValidationError(
        `${fieldName} must be positive with at most ${MAX_KG_DECIMALS} decimal places.`,
        { [fieldName]: `Quantity must be positive with at most ${MAX_KG_DECIMALS} decimal places.` }
      );
    }
    numericValue = rawValue;
  } else {
    decimalStr = rawValue.trim();
    if (!STRICT_DECIMAL_REGEX.test(decimalStr)) {
      throw createValidationError(
        `${fieldName} must be a non-negative decimal string with at most ${MAX_KG_DECIMALS} decimal places.`,
        { [fieldName]: `Quantity must be positive with at most ${MAX_KG_DECIMALS} decimal places.` }
      );
    }
    numericValue = Number(decimalStr);
  }

  const parts = decimalStr.split('.');
  const fractionalDigits = parts[1] || '';
  if (fractionalDigits.length > MAX_KG_DECIMALS) {
    throw createValidationError(
      `${fieldName} supports at most ${MAX_KG_DECIMALS} decimal places (cannot silently round ${rawValue}).`,
      { [fieldName]: `At most ${MAX_KG_DECIMALS} decimal places are allowed.` }
    );
  }

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue >= MAX_KG_EXCLUSIVE) {
    throw createValidationError(
      `${fieldName} must be greater than 0 and less than ${MAX_KG_EXCLUSIVE} kg.`,
      { [fieldName]: 'Quantity must be greater than 0 kg.' }
    );
  }

  return numericValue;
}

/**
 * Validates positive integer minor currency units in LKR cents (DR-06).
 */
export function validatePositiveIntegerCents(rawValue, fieldName = 'unitPriceCents') {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    throw createValidationError(`${fieldName} is required.`, {
      [fieldName]: 'Unit price is required.',
    });
  }

  let numericValue;
  if (typeof rawValue === 'number') {
    numericValue = rawValue;
  } else if (typeof rawValue === 'string' && /^\d+$/.test(rawValue.trim())) {
    numericValue = Number(rawValue.trim());
  } else {
    throw createValidationError(`${fieldName} must be a positive integer in LKR cents.`, {
      [fieldName]: 'Unit price must be a positive integer.',
    });
  }

  if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
    throw createValidationError(`${fieldName} must be a positive safe integer in LKR cents.`, {
      [fieldName]: 'Unit price must be greater than 0 cents.',
    });
  }

  return numericValue;
}

/**
 * Parses and validates an input date string (YYYY-MM-DD or UTC ISO timestamp) or existing Date instance.
 */
export function validateDateValue(rawValue, fieldName) {
  if (rawValue instanceof Date) {
    if (Number.isNaN(rawValue.getTime())) {
      throw createValidationError(`${fieldName} is not a valid date.`, {
        [fieldName]: 'Invalid date.',
      });
    }
    return {
      isoValue: rawValue.toISOString(),
      timeMs: rawValue.getTime(),
    };
  }

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw createValidationError(`${fieldName} must be a valid date string.`, {
      [fieldName]: 'Valid date is required.',
    });
  }

  const trimmed = rawValue.trim();
  const dateOnlyMatch = DATE_ONLY_REGEX.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() + 1 !== month ||
      utcDate.getUTCDate() !== day
    ) {
      throw createValidationError(`${fieldName} is not a valid calendar date.`, {
        [fieldName]: 'Invalid calendar date.',
      });
    }
    return {
      isoValue: trimmed,
      timeMs: utcDate.getTime(),
    };
  }

  if (!ISO_DATETIME_REGEX.test(trimmed)) {
    throw createValidationError(`${fieldName} must be an ISO-8601 date or UTC timestamp.`, {
      [fieldName]: 'Use YYYY-MM-DD or ISO-8601 UTC timestamp format.',
    });
  }

  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) {
    throw createValidationError(`${fieldName} is not a valid date.`, {
      [fieldName]: 'Invalid date.',
    });
  }

  return {
    isoValue: trimmed,
    timeMs: parsedMs,
  };
}

/**
 * Ensures the effective availability window satisfies validUntil > validFrom.
 */
export function validateDateRange(validFromValue, validUntilValue) {
  const start = validateDateValue(validFromValue, 'validFrom');
  const end = validateDateValue(validUntilValue, 'validUntil');

  if (end.timeMs <= start.timeMs) {
    throw createValidationError('validUntil must be strictly after validFrom.', {
      validUntil: 'End date/time must be after start date/time.',
    });
  }

  return {
    validFrom: start.isoValue,
    validUntil: end.isoValue,
  };
}

/**
 * Validates listing status value against allowed database enum values.
 */
export function validateListingStatus(status) {
  if (typeof status !== 'string' || !VALID_LISTING_STATUSES.includes(status)) {
    throw createValidationError(
      `Invalid listing status. Must be one of: ${VALID_LISTING_STATUSES.join(', ')}.`,
      { status: 'Unsupported status value.' }
    );
  }
  return status;
}

/**
 * Checks whether transitioning from currentStatus to nextStatus is allowed.
 */
export function isValidListingTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return true;
  }
  const allowedNext = VALID_LISTING_TRANSITIONS[currentStatus] || [];
  return allowedNext.includes(nextStatus);
}

/**
 * Validates and parses pagination query parameters without mutating legacy callers that omit them.
 */
export function validateListQueryParams(query = {}) {
  if (!isPlainObject(query)) {
    return { page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE };
  }

  let page = DEFAULT_PAGE;
  let pageSize = DEFAULT_PAGE_SIZE;

  if (query.page !== undefined && query.page !== '') {
    const rawPage = typeof query.page === 'number' ? String(query.page) : String(query.page).trim();
    if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1) {
      throw createValidationError('Query parameter page must be a positive integer >= 1.', {
        page: 'Must be an integer >= 1.',
      });
    }
    page = Number(rawPage);
  }

  const rawSizeParam = query.pageSize ?? query.limit;
  if (rawSizeParam !== undefined && rawSizeParam !== '') {
    const rawSize = typeof rawSizeParam === 'number' ? String(rawSizeParam) : String(rawSizeParam).trim();
    if (!/^\d+$/.test(rawSize) || Number(rawSize) < 1 || Number(rawSize) > MAX_PAGE_SIZE) {
      throw createValidationError(
        `Query parameter pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
        { pageSize: `Must be an integer between 1 and ${MAX_PAGE_SIZE}.` }
      );
    }
    pageSize = Number(rawSize);
  }

  return { page, pageSize };
}

/**
 * Validates the payload for PUT /api/ym09/produce/:id.
 */
export function validateUpdateListingPayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be a JSON object.');
  }

  assertAllowedFields(body, ALLOWED_UPDATE_FIELDS);

  if (Object.keys(body).length === 0) {
    throw createValidationError('Request body must include at least one updatable field.');
  }

  const sanitized = {};

  if (body.batchId !== undefined) {
    sanitized.batchId = validateUuidField(body.batchId, 'batchId');
  }

  if (body.farmId !== undefined) {
    sanitized.farmId = validateUuidField(body.farmId, 'farmId');
  }

  if (body.offeredKg !== undefined) {
    sanitized.offeredKg = validateKgQuantity(body.offeredKg, 'offeredKg');
  }

  if (body.unitPriceCents !== undefined) {
    sanitized.unitPriceCents = validatePositiveIntegerCents(body.unitPriceCents, 'unitPriceCents');
  }

  if (body.validFrom !== undefined) {
    if (body.validFrom === null || body.validFrom === '') {
      throw createValidationError('validFrom cannot be empty.', {
        validFrom: 'Start date cannot be empty.',
      });
    }
    sanitized.validFrom = validateDateValue(body.validFrom, 'validFrom').isoValue;
  }

  if (body.validUntil !== undefined) {
    if (body.validUntil === null || body.validUntil === '') {
      throw createValidationError('validUntil cannot be empty.', {
        validUntil: 'End date cannot be empty.',
      });
    }
    sanitized.validUntil = validateDateValue(body.validUntil, 'validUntil').isoValue;
  }

  if (body.status !== undefined) {
    sanitized.status = validateListingStatus(body.status);
  }

  return sanitized;
}

/**
 * Validates a full creation payload (required fields, quantities, cents, dates).
 */
export function validateCreateListingPayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be a JSON object.');
  }

  assertAllowedFields(body, ALLOWED_CREATE_FIELDS);

  const errors = {};
  if (!body.farmId) errors.farmId = 'farmId is required.';
  if (!body.batchId) errors.batchId = 'batchId is required.';
  if (body.offeredKg === undefined || body.offeredKg === null || body.offeredKg === '') {
    errors.offeredKg = 'offeredKg is required.';
  }
  if (
    body.unitPriceCents === undefined ||
    body.unitPriceCents === null ||
    body.unitPriceCents === ''
  ) {
    errors.unitPriceCents = 'unitPriceCents is required.';
  }
  if (!body.validFrom) errors.validFrom = 'validFrom is required.';
  if (!body.validUntil) errors.validUntil = 'validUntil is required.';

  if (Object.keys(errors).length > 0) {
    throw createValidationError('Missing required produce listing fields.', errors);
  }

  const batchId = validateUuidField(body.batchId, 'batchId');
  const farmId = validateUuidField(body.farmId, 'farmId');
  const offeredKg = validateKgQuantity(body.offeredKg, 'offeredKg');
  const unitPriceCents = validatePositiveIntegerCents(body.unitPriceCents, 'unitPriceCents');
  const { validFrom, validUntil } = validateDateRange(body.validFrom, body.validUntil);
  const status =
    body.status !== undefined ? validateListingStatus(body.status) : LISTING_STATUS.ACTIVE;

  if (!CREATE_ALLOWED_INITIAL_STATUSES.includes(status)) {
    throw createValidationError(
      `Invalid initial listing status '${status}'. New listings may only start as draft or active.`,
      { status: 'Initial status must be draft or active.' }
    );
  }

  return {
    batchId,
    farmId,
    offeredKg,
    unitPriceCents,
    validFrom,
    validUntil,
    status,
  };
}

/**
 * Validates the payload for PATCH /api/ym09/produce/:id/status.
 */
export function validateUpdateStatusPayload(body) {
  if (!isPlainObject(body)) {
    throw createValidationError('Request body must be a JSON object.');
  }

  assertAllowedFields(body, ['status']);

  if (!body.status) {
    throw createValidationError('status is required.', {
      status: 'Target listing status is required.',
    });
  }

  return {
    status: validateListingStatus(body.status),
  };
}
