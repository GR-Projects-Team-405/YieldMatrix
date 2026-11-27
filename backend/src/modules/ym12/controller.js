import pool from '../../config/db.js';
import { DEMO_BUYER_ID, getSampleListing, getSampleSupplierProfile, getSampleSupplierPerformance, getSampleComparisonListings } from './mockData.js';
import { findApprovedSupplier, findSupplierListings } from './supplierQueries.js';
import { calculatePerformanceMetrics, calculatePerformanceScore, calculateRateMetric } from './performanceMetrics.js';
import { findSupplierMonthlyTrend, findSupplierPerformanceCounts } from './performanceQueries.js';
import { findEligibleComparisonListings } from './comparisonQueries.js';
import { DEFAULT_BUYER_DISTRICT, MAX_COMPARE } from './comparisonConstants.js';
import { getDistanceKm } from './distances.js';
import { rankListings } from './rankListings.js';
// YM12 · MHD Muhthas · Produce & suppliers
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM12', owner: 'MHD Muhthas', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) {
    logDatabaseFailure(error, req);
    next(error);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PERFORMANCE_FROM = '2026-06-01';
const PERFORMANCE_TIMEZONE = 'Asia/Colombo (UTC+05:30)';
const DATABASE_CONNECTION_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'EHOSTUNREACH', 'ENETUNREACH',
  '57P01', '57P02', '57P03', '08000', '08001', '08003', '08004', '08006', '08007',
]);

function isConnectionUnavailable(error) {
  let current = error;
  while (current) {
    if (DATABASE_CONNECTION_CODES.has(current.code)) return true;
    if (/connection terminated unexpectedly|timeout expired/i.test(current.message || '')) return true;
    current = current.cause;
  }
  return false;
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
}

function logDatabaseFailure(error, req) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'DATABASE_ERROR';
  console.error('YM12 request failed', { requestId: req.requestId, code });
}

function centsToLkr(centsValue) {
  const cents = BigInt(String(centsValue));
  const whole = cents / 100n;
  const fraction = cents % 100n;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

function centsToLkrLabel(centsValue) {
  return centsToLkr(centsValue);
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayInColombo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addTwelveMonths(value) {
  const [year, month, day] = value.split('-').map(Number);
  const targetYear = year + 1;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function getPerformancePeriod(query) {
  const to = query.to === undefined ? todayInColombo() : query.to;
  const from = query.from === undefined ? DEFAULT_PERFORMANCE_FROM : query.from;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to || to > addTwelveMonths(from)) return null;
  return { from, to };
}

function safeCount(value) {
  return calculateRateMetric(value, '1').numerator;
}

function makeMonthlyBuckets(from, to, rows) {
  const rowByMonth = new Map(rows.map((row) => [row.month, row]));
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  const currentDate = todayInColombo();
  const currentMonth = currentDate.slice(0, 7);
  const [fromYear, fromMonthNumber] = fromMonth.split('-').map(Number);
  const [toYear, toMonthNumber] = toMonth.split('-').map(Number);
  const buckets = [];

  for (let cursor = new Date(Date.UTC(fromYear, fromMonthNumber - 1, 1));
    cursor <= new Date(Date.UTC(toYear, toMonthNumber - 1, 1));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const year = cursor.getUTCFullYear();
    const monthNumber = cursor.getUTCMonth() + 1;
    const month = `${year}-${String(monthNumber).padStart(2, '0')}`;
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const row = rowByMonth.get(month);
    const completed = String(row?.completed ?? 0);
    const confirmed = String(row?.confirmed ?? 0);
    const sampleThrough = row?.through || null;
    const isPartial = from > monthStart || to < monthEnd || month === currentMonth || sampleThrough !== null;
    const throughDate = to < monthEnd ? to : monthEnd;
    buckets.push({
      month,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(cursor),
      completed: safeCount(completed),
      confirmed: safeCount(confirmed),
      percent: calculateRateMetric(completed, confirmed).percent,
      isPartial,
      through: isPartial ? sampleThrough || (month === currentMonth && currentDate < throughDate ? currentDate : throughDate) : null,
    });
  }
  return buckets;
}

function makeSupplierPerformanceResponse(supplier, counts, monthlyRows, period, dataSource, requestId) {
  const completedOrders = String(counts.completed_orders ?? 0);
  const fulfilment = calculatePerformanceMetrics(completedOrders, counts.confirmed_orders ?? 0);
  const insufficientHistory = fulfilment.insufficientHistory;
  const acceptanceRate = calculateRateMetric(counts.accepted_requests, counts.buyer_requests);
  const onTimePickup = calculateRateMetric(counts.on_time_pickups, counts.pickup_denominator);
  const disputeRate = calculateRateMetric(counts.disputed_completed_orders, completedOrders, 1);
  const trend = insufficientHistory ? [] : makeMonthlyBuckets(period.from, period.to, monthlyRows);

  return {
    supplier,
    period: { ...period, timezone: PERFORMANCE_TIMEZONE },
    insufficientHistory,
    metrics: {
      acceptanceRate: insufficientHistory ? { percent: null, numerator: null, denominator: null } : acceptanceRate,
      fulfilmentRate: insufficientHistory
        ? { percent: null, numerator: null, denominator: null }
        : {
          percent: fulfilment.fulfilmentRatePercent,
          numerator: safeCount(completedOrders),
          denominator: safeCount(counts.confirmed_orders),
        },
      onTimePickup: insufficientHistory ? { percent: null, numerator: null, denominator: null } : onTimePickup,
      disputeRate: insufficientHistory ? { percent: null, numerator: null, denominator: null } : disputeRate,
      completedOrders: { count: fulfilment.completedOrders },
    },
    trend,
    basis: insufficientHistory ? {
      buyerRequests: null,
      confirmedOrders: null,
      completedOrders: null,
    } : {
      buyerRequests: counts.buyer_requests === null ? null : safeCount(counts.buyer_requests),
      confirmedOrders: safeCount(counts.confirmed_orders),
      completedOrders: safeCount(completedOrders),
    },
    dataSource,
    requestId,
  };
}

function categoryFor(cropName) {
  // The current schema has no crop-category column. Seed crops are vegetables;
  // send a category-column proposal to the lead before expanding this mapping.
  const vegetableCrops = new Set(['tomato', 'carrot', 'cabbage', 'potato', 'beans']);
  return vegetableCrops.has(String(cropName).trim().toLowerCase()) ? 'Vegetables' : 'Produce';
}

function shapeDatabaseListing(row, completedOrders) {
  const pricePerKgCents = String(row.price_per_kg_cents);
  const cropName = String(row.crop_name).trim();
  return {
    id: row.listing_id,
    displayId: `YM-${String(row.listing_id).replaceAll('-', '').slice(-4).toUpperCase()}`,
    cropName: `Fresh ${cropName.toLowerCase() === 'tomato' ? 'tomatoes' : cropName.toLowerCase() === 'potato' ? 'potatoes' : cropName.toLowerCase().endsWith('s') ? cropName.toLowerCase() : `${cropName.toLowerCase()}s`}`,
    category: categoryFor(cropName),
    description: 'Supplier-listed produce available for bulk sourcing.',
    grade: row.grade_name,
    status: row.listing_status,
    pricePerKgCents,
    pricePerKgLkr: centsToLkr(pricePerKgCents),
    availableKg: String(row.available_kg),
    harvestStart: row.harvest_start,
    harvestEnd: row.harvest_end,
    district: row.district,
    imageUrl: null,
    updatedAt: row.listed_at,
    supplier: {
      id: row.supplier_id,
      name: row.supplier_name,
      district: row.district,
      // The current schema has account approval, but no separate identity-verification or rating record.
      verified: false,
      completedOrders,
      rating: null,
      ratingCount: null,
    },
  };
}

function parseComparisonIds(rawIds) {
  if (typeof rawIds !== 'string' || rawIds.length === 0) return null;
  const ids = rawIds.split(',');
  if (ids.length > MAX_COMPARE || ids.some((id) => !UUID_PATTERN.test(id))) return null;
  const normalized = ids.map((id) => id.toLowerCase());
  if (new Set(normalized).size !== normalized.length) return null;
  return ids;
}

function makeComparisonItem(row, score, distanceKm) {
  return {
    listingId: String(row.listing_id),
    supplierId: String(row.supplier_id),
    supplierName: row.supplier_name,
    district: row.district,
    pricePerKgCents: String(row.price_per_kg_cents),
    pricePerKgLkr: centsToLkr(row.price_per_kg_cents),
    availableKg: String(row.available_kg),
    distanceKm,
    grade: row.grade,
    harvestStart: row.harvest_start,
    harvestEnd: row.harvest_end,
    performanceScore: score,
    isBestPrice: false,
    crop: row.crop_name,
    cropId: row.crop_id,
  };
}

function completeComparisonResponse(items, unavailable, buyerDistrict, dataSource, requestId) {
  const ranked = rankListings(items);
  const lowestPrice = ranked.length ? BigInt(ranked[0].pricePerKgCents) : null;
  const publicItems = ranked.map((item, index) => {
    const { crop: _crop, cropId: _cropId, ...publicItem } = item;
    return {
      ...publicItem,
      rank: index + 1,
      isBestPrice: lowestPrice !== null && BigInt(item.pricePerKgCents) === lowestPrice,
    };
  });
  const cropIds = new Set(ranked.map((item) => item.cropId));
  const sameCrop = cropIds.size <= 1;
  return {
    crop: ranked[0]?.crop || null,
    sameCrop,
    rankingMethod: 'price, then distance; unknown distances last',
    items: publicItems,
    unavailable,
    buyerDistrict,
    maxCompare: MAX_COMPARE,
    dataSource,
    requestId,
  };
}

function scoreFromCounts(counts) {
  const completed = String(counts.completed_orders ?? 0);
  const confirmed = String(counts.confirmed_orders ?? 0);
  const history = calculatePerformanceMetrics(completed, confirmed);
  return calculatePerformanceScore(
    history.fulfilmentRatePercent,
    calculateRateMetric(counts.on_time_pickups, counts.pickup_denominator).percent,
    calculateRateMetric(counts.accepted_requests, counts.buyer_requests).percent,
    calculateRateMetric(counts.disputed_completed_orders, completed, 1).percent,
    history.insufficientHistory,
  );
}

function sampleComparisonResponse(ids, requestId, period) {
  const { available, unavailable } = getSampleComparisonListings(ids);
  const items = available.map((row) => {
    const performance = getSampleSupplierPerformance(row.supplier.id, period.from, period.to);
    return makeComparisonItem({
      listing_id: row.id,
      supplier_id: row.supplier.id,
      supplier_name: row.supplier.name,
      district: row.district,
      price_per_kg_cents: row.pricePerKgCents,
      available_kg: row.availableKg,
      grade: row.grade,
      harvest_start: row.harvestStart,
      harvest_end: row.harvestEnd,
      crop_name: row.cropName,
      crop_id: row.cropName.toLowerCase(),
    }, performance ? scoreFromCounts(performance.counts) : null, row.distanceKm);
  });
  return completeComparisonResponse(items, unavailable, DEFAULT_BUYER_DISTRICT, 'sample', requestId);
}

function sendSampleListing(req, res) {
  // This UUID is the approved Demo Buyer seeded by the team. Restrict offline
  // fixtures to it so an unknown account is never treated as approved by fallback.
  if (req.user.id !== DEMO_BUYER_ID) {
    return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
  }
  const found = getSampleListing(req.params.listingId);
  if (!found) return res.status(404).json({ error: 'This produce listing is unavailable or no longer active.', requestId: req.requestId });
  const { supplier, ...listing } = found;
  return res.json({ listing, supplier, dataSource: 'sample', requestId: req.requestId });
}

export async function getProduceDetails(req, res, next) {
  if (!UUID_PATTERN.test(req.params.listingId)) {
    return res.status(400).json({ error: 'Invalid listing ID.', requestId: req.requestId });
  }

  if (!process.env.DATABASE_URL && isDevelopment()) return sendSampleListing(req, res);

  try {
    const account = await pool.query(
      'SELECT approval_status FROM users WHERE id = $1 AND role = $2',
      [req.user.id, 'buyer'],
    );
    if (account.rows[0]?.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Buyer account is not approved for trading.', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `SELECT l.id::text AS listing_id,
              l.status AS listing_status,
              l.unit_price_cents::text AS price_per_kg_cents,
              GREATEST(0::numeric, LEAST(l.offered_kg, ba.available_kg))::text AS available_kg,
              COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_start,
              COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_end,
              l.created_at AS listed_at,
              c.name AS crop_name,
              g.name AS grade_name,
              f.district,
              supplier.id::text AS supplier_id,
              supplier.name AS supplier_name
         FROM listings l
         JOIN harvest_batches b ON b.id = l.batch_id
         JOIN batch_availability ba ON ba.batch_id = b.id
         JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
         JOIN users supplier ON supplier.id = b.farmer_id
         JOIN crops c ON c.id = b.crop_id
         JOIN grades g ON g.id = b.grade_id
        WHERE l.id = $1::uuid
          AND l.status = 'active'
          AND l.valid_from <= now()
          AND l.valid_until > now()
          AND b.status IN ('ready', 'harvested')
          AND f.status = 'active'
          AND supplier.approval_status = 'approved'
          AND c.active = true
          AND g.active = true
          AND ba.available_kg > 0
        LIMIT 1`,
      [req.params.listingId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'This produce listing is unavailable or no longer active.', requestId: req.requestId });
    const period = getPerformancePeriod({});
    const performanceCounts = await findSupplierPerformanceCounts(rows[0].supplier_id, period.from, period.to);
    const completedOrders = calculatePerformanceMetrics(
      performanceCounts?.completed_orders,
      performanceCounts?.confirmed_orders,
    ).completedOrders;
    const shaped = shapeDatabaseListing(rows[0], completedOrders);
    const { supplier, ...listing } = shaped;
    return res.json({ listing, supplier, dataSource: 'database', requestId: req.requestId });
  } catch (error) {
    if (isDevelopment() && isConnectionUnavailable(error)) {
      logDatabaseFailure(error, req);
      return sendSampleListing(req, res);
    }
    logDatabaseFailure(error, req);
    return next(error);
  }
}

export async function getSupplierProfile(req, res, next) {
  if (!UUID_PATTERN.test(req.params.supplierId)) {
    return res.status(400).json({ error: 'Invalid supplier ID.', requestId: req.requestId });
  }

  if (!process.env.DATABASE_URL && isDevelopment()) {
    if (req.user.id !== DEMO_BUYER_ID) {
      return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
    }
    const found = getSampleSupplierProfile(req.params.supplierId);
    if (!found) {
      return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
    }
    found.requestId = req.requestId;
    return res.json(found);
  }

  try {
    const account = await pool.query(
      'SELECT approval_status FROM users WHERE id = $1 AND role = $2',
      [req.user.id, 'buyer'],
    );
    if (account.rows[0]?.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Buyer account is not approved for trading.', requestId: req.requestId });
    }

    const supplier = await findApprovedSupplier(req.params.supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
    }

    const period = getPerformancePeriod({});
    const [listingRows, performanceRow] = await Promise.all([
      findSupplierListings(req.params.supplierId),
      findSupplierPerformanceCounts(req.params.supplierId, period.from, period.to),
    ]);

    const activeListings = listingRows.map((row) => {
      const listingId = String(row.listing_id);
      const pricePerKgCents = String(row.price_per_kg_cents);
      return {
        listingId,
        displayId: `YM-${listingId.replaceAll('-', '').slice(-4).toUpperCase()}`,
        cropName: `Fresh ${String(row.crop_name).trim().toLowerCase()}`,
        grade: row.grade_name,
        availableKg: String(row.available_kg),
        district: row.district,
        harvestStart: row.harvest_start,
        harvestEnd: row.harvest_end,
        pricePerKgCents,
        pricePerKgLkr: centsToLkr(pricePerKgCents),
        imageUrl: null,
      };
    });

    const cropsSupplied = [...new Set(activeListings.map((listing) => listing.cropName))];
    const performance = calculatePerformanceMetrics(
      performanceRow.completed_orders,
      performanceRow.confirmed_orders,
    );

    return res.json({
      supplier: {
        id: supplier.supplier_id,
        name: supplier.supplier_name,
        businessType: null,
        district: supplier.district,
        country: 'Sri Lanka',
        tagline: null,
        description: null,
        verified: false,
        operatingSinceYear: null,
        memberSince: supplier.member_since ? new Date(supplier.member_since).toISOString() : null,
        rating: null,
        ratingCount: null,
      },
      performanceSummary: performance,
      cropsSupplied,
      activeListings,
      activeListingCount: activeListings.length,
      dataSource: 'database',
      requestId: req.requestId,
    });
  } catch (error) {
    if (isDevelopment() && isConnectionUnavailable(error)) {
      logDatabaseFailure(error, req);
      if (req.user.id !== DEMO_BUYER_ID) {
        return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
      }
      const found = getSampleSupplierProfile(req.params.supplierId);
      if (!found) {
        return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
      }
      found.requestId = req.requestId;
      return res.json(found);
    }
    logDatabaseFailure(error, req);
    return next(error);
  }
}

export async function getSupplierPerformance(req, res, next) {
  if (!UUID_PATTERN.test(req.params.supplierId)) {
    return res.status(400).json({ error: 'Invalid supplier ID.', requestId: req.requestId });
  }
  const period = getPerformancePeriod(req.query);
  if (!period) {
    return res.status(400).json({ error: 'Invalid performance period. Use ISO dates within a 12-month range.', requestId: req.requestId });
  }

  if (!process.env.DATABASE_URL && isDevelopment()) {
    if (req.user.id !== DEMO_BUYER_ID) {
      return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
    }
    const found = getSampleSupplierPerformance(req.params.supplierId, period.from, period.to);
    if (!found) {
      return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
    }
    return res.json(makeSupplierPerformanceResponse(
      found.supplier,
      found.counts,
      found.trend,
      period,
      found.dataSource,
      req.requestId,
    ));
  }

  try {
    const account = await pool.query(
      'SELECT approval_status FROM users WHERE id = $1 AND role = $2',
      [req.user.id, 'buyer'],
    );
    if (account.rows[0]?.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Buyer account is not approved for trading.', requestId: req.requestId });
    }

    const supplier = await findApprovedSupplier(req.params.supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
    }
    const [counts, monthlyRows] = await Promise.all([
      findSupplierPerformanceCounts(req.params.supplierId, period.from, period.to),
      findSupplierMonthlyTrend(req.params.supplierId, period.from, period.to),
    ]);

    return res.json(makeSupplierPerformanceResponse({
      id: supplier.supplier_id,
      name: supplier.supplier_name,
      district: supplier.district,
      verified: false,
    }, counts || {}, monthlyRows, period, 'database', req.requestId));
  } catch (error) {
    if (isDevelopment() && isConnectionUnavailable(error)) {
      logDatabaseFailure(error, req);
      if (req.user.id !== DEMO_BUYER_ID) {
        return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
      }
      const found = getSampleSupplierPerformance(req.params.supplierId, period.from, period.to);
      if (!found) {
        return res.status(404).json({ error: 'Supplier profile not found or supplier is not approved.', requestId: req.requestId });
      }
      return res.json(makeSupplierPerformanceResponse(
        found.supplier,
        found.counts,
        found.trend,
        period,
        found.dataSource,
        req.requestId,
      ));
    }
    logDatabaseFailure(error, req);
    return next(error);
  }
}

export async function getComparison(req, res, next) {
  const ids = parseComparisonIds(req.query.ids);
  if (!ids) {
    return res.status(400).json({
      error: `Provide 1 to ${MAX_COMPARE} unique listing IDs in the ids query parameter.`,
      requestId: req.requestId,
    });
  }
  const performancePeriod = getPerformancePeriod({});

  if (!process.env.DATABASE_URL && isDevelopment()) {
    if (req.user.id !== DEMO_BUYER_ID) {
      return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
    }
    return res.json(sampleComparisonResponse(ids, req.requestId, performancePeriod));
  }

  try {
    const account = await pool.query(
      'SELECT approval_status, district FROM users WHERE id = $1 AND role = $2',
      [req.user.id, 'buyer'],
    );
    if (account.rows[0]?.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Buyer account is not approved for trading.', requestId: req.requestId });
    }

    const rows = await findEligibleComparisonListings(ids);
    const availableIds = new Set(rows.map((row) => String(row.listing_id).toLowerCase()));
    const unavailable = ids.filter((id) => !availableIds.has(id.toLowerCase())).map((id) => ({
      id,
      reason: 'Listing not found or no longer eligible.',
    }));
    const supplierIds = [...new Set(rows.map((row) => String(row.supplier_id)))];
    const performanceRows = supplierIds.length
      ? await Promise.all(supplierIds.map((supplierId) =>
        findSupplierPerformanceCounts(supplierId, performancePeriod.from, performancePeriod.to)))
      : [];
    const performanceBySupplier = new Map(
      supplierIds.map((supplierId, index) => [supplierId, performanceRows[index]]),
    );
    const buyerDistrict = account.rows[0].district || DEFAULT_BUYER_DISTRICT;
    const items = rows.map((row) => {
      const metrics = performanceBySupplier.get(String(row.supplier_id));
      const distanceKm = getDistanceKm(buyerDistrict, row.district);
      return makeComparisonItem(row, metrics ? scoreFromCounts(metrics) : null, distanceKm);
    });

    return res.json(completeComparisonResponse(items, unavailable, buyerDistrict, 'database', req.requestId));
  } catch (error) {
    if (isDevelopment() && isConnectionUnavailable(error)) {
      logDatabaseFailure(error, req);
      if (req.user.id !== DEMO_BUYER_ID) {
        return res.status(503).json({ error: 'Database is unavailable for account approval checks.', requestId: req.requestId });
      }
      return res.json(sampleComparisonResponse(ids, req.requestId, performancePeriod));
    }
    logDatabaseFailure(error, req);
    return next(error);
  }
}
