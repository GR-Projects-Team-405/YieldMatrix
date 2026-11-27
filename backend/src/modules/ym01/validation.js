const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_FILTER_LENGTH = 100;
const MAX_PRICE_CENTS = 100_000_000_000;
const ALLOWED_QUERY_KEYS = new Set([
  'page', 'limit', 'pageSize', 'search', 'crop', 'category', 'district', 'grade',
  'minPrice', 'maxPrice', 'sort', 'availability',
]);

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

function oneString(value, name) {
  if (Array.isArray(value) || (value !== undefined && typeof value !== 'string')) {
    throw new InputError(`${name} must be a single value`);
  }
  return value;
}

function positiveInteger(value, name, fallback, maximum) {
  value = oneString(value, name);
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new InputError(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new InputError(`${name} must be between 1 and ${maximum}`);
  }
  return parsed;
}

function optionalText(value, name, maxLength = MAX_FILTER_LENGTH) {
  value = oneString(value, name);
  if (value === undefined || value === '') return undefined;
  const parsed = value.trim();
  if (parsed.length === 0) return undefined;
  if (parsed.length > maxLength) throw new InputError(`${name} must be at most ${maxLength} characters`);
  return parsed;
}

function priceCents(value, name) {
  value = oneString(value, name);
  if (value === undefined || value === '') return undefined;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new InputError(`${name} must be a non-negative price with up to two decimal places`);
  }
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) {
    throw new InputError(`${name} is outside the allowed range`);
  }
  return cents;
}

export function validateUuid(value, label = 'id') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new InputError(`${label} must be a valid UUID`);
  }
  return value;
}

export function validateCatalogueQuery(query) {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) throw new InputError(`Unsupported filter: ${key}`);
  }

  const page = positiveInteger(query.page, 'page', 1, 1_000_000);
  if (query.limit !== undefined && query.pageSize !== undefined) {
    throw new InputError('Use either limit or pageSize, not both');
  }
  const limit = positiveInteger(query.limit ?? query.pageSize, 'limit', 12, MAX_PAGE_SIZE);
  const search = optionalText(query.search, 'search', MAX_SEARCH_LENGTH);
  const crop = optionalText(query.crop ?? query.category, query.crop !== undefined ? 'crop' : 'category');
  if (query.crop !== undefined && query.category !== undefined) {
    throw new InputError('Use either crop or category, not both');
  }
  const district = optionalText(query.district, 'district');
  const grade = optionalText(query.grade, 'grade');

  const sort = oneString(query.sort, 'sort') ?? 'newest';
  if (!['newest', 'price_asc', 'price_desc', 'harvest_date_asc', 'harvest_date_desc'].includes(sort)) {
    throw new InputError('sort must be newest, price_asc, price_desc, harvest_date_asc or harvest_date_desc');
  }
  const availability = oneString(query.availability, 'availability') ?? 'available';
  if (!['available', 'all'].includes(availability)) {
    throw new InputError('availability must be available or all');
  }

  const minPriceCents = priceCents(query.minPrice, 'minPrice');
  const maxPriceCents = priceCents(query.maxPrice, 'maxPrice');
  if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
    throw new InputError('minPrice cannot be greater than maxPrice');
  }

  return { page, limit, search, crop, district, grade, sort, availability, minPriceCents, maxPriceCents };
}

export function paginationOffset({ page, limit }) {
  return (page - 1) * limit;
}
