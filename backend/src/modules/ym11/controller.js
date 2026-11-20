import pool from '../../config/db.js';

// YM11 · Meranga Akash · Buyer marketplace
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const KG_REGEX = /^\d+(?:\.\d{1,3})?$/;
const ACTIVITY_RANGES = { '7d': 7, '30d': 30 };
const DEFAULT_RECENT_ORDERS_LIMIT = 5;
const MAX_RECENT_ORDERS_LIMIT = 20;
const DEFAULT_SEARCH_PAGE_SIZE = 12;
const MAX_SEARCH_PAGE_SIZE = 50;

const CROP_CATEGORIES = [
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'fruits', label: 'Fruits' },
  { key: 'leafy_greens', label: 'Leafy greens' },
  { key: 'root_crops', label: 'Root crops' },
  { key: 'grains', label: 'Grains' },
  { key: 'other', label: 'Other produce' },
];
const CATEGORY_KEYS = new Set(CROP_CATEGORIES.map((c) => c.key));
const SEARCH_AVAILABILITY_MODES = new Set(['all', 'available_now', 'within_7_days', 'within_30_days', 'planned']);
const AVAILABILITY_STATUS_MODES = new Set(['all', 'available_now', 'planned']);
const SEARCH_SORT_MODES = new Set(['price_asc', 'price_desc', 'quantity_desc', 'harvest_asc', 'newest']);

function isTransientDbError(error) {
  const msg = String(error?.message || '');
  const code = String(error?.code || '');
  if (/timeout/i.test(msg)) return false;
  return (
    /connection terminated unexpectedly|econnreset|socket hang up/i.test(msg) ||
    ['57P01', '57P02', '57P03', '08006', '08003', '08000'].includes(code)
  );
}

async function runQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    return await pool.query(sql, params);
  }
}

function classifyCropCategory(cropName) {
  const name = String(cropName || '').trim().toLowerCase();
  if (!name) return 'other';
  if (/(spinach|leafy|lettuce|kale|gotukola|kankun|mukunuwenna|greens)/.test(name)) return 'leafy_greens';
  if (/(carrot|potato|beetroot|radish|yam|manioc|cassava|ginger|turmeric|onion|garlic)/.test(name)) return 'root_crops';
  if (/(rice|paddy|maize|corn|millet|kurakkan|grain|lentil|gram|cowpea|oat|wheat)/.test(name)) return 'grains';
  if (/(banana|mango|papaya|pineapple|watermelon|avocado|guava|passion|orange|lime|apple|grape|berry|fruit)/.test(name)) return 'fruits';
  if (/(tomato|cabbage|bean|brinjal|eggplant|okra|pumpkin|chili|chilli|capsicum|cucumber|gourd|leek|broccoli|cauliflower|pepper|squash)/.test(name)) return 'vegetables';
  return 'other';
}

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
    if (match) return match[0];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getCurrentColomboMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function getMonthBounds(monthStr) {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthNumStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    monthStart: `${yearStr}-${monthNumStr}-01`,
    monthEnd: `${yearStr}-${monthNumStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

function toKg(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : 0;
}

function toCents(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.parseInt(String(value), 10) || 0;
}

function toOptionalCents(value) {
  if (value === null || value === undefined) return null;
  return toCents(value);
}

function formatOrderCode(operationKey, orderId) {
  if (typeof operationKey === 'string') {
    const parts = operationKey.split(':');
    const candidate = parts[parts.length - 1]?.trim();
    if (candidate && /^YM[-_A-Z0-9]+$/i.test(candidate)) {
      return candidate.toUpperCase();
    }
  }
  return `YM-${String(orderId).slice(0, 6).toUpperCase()}`;
}

function validateActivityRange(rawRange) {
  if (rawRange === undefined || rawRange === '') {
    return { range: '7d', days: ACTIVITY_RANGES['7d'] };
  }
  if (typeof rawRange !== 'string' || !Object.hasOwn(ACTIVITY_RANGES, rawRange)) {
    return { error: 'Use 7d or 30d' };
  }
  return { range: rawRange, days: ACTIVITY_RANGES[rawRange] };
}

function validateRecentLimit(rawLimit) {
  if (rawLimit === undefined || rawLimit === '') {
    return { limit: DEFAULT_RECENT_ORDERS_LIMIT };
  }
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RECENT_ORDERS_LIMIT) {
    return { error: `Use an integer between 1 and ${MAX_RECENT_ORDERS_LIMIT}` };
  }
  return { limit: parsed };
}

function validateInsightFilters(query) {
  const fields = {};
  let cropId = null;
  let gradeId = null;
  let district = null;

  if (query.cropId !== undefined && query.cropId !== '') {
    if (typeof query.cropId !== 'string' || !UUID_REGEX.test(query.cropId.trim())) {
      fields.cropId = 'Must be a valid UUID';
    } else {
      cropId = query.cropId.trim();
    }
  }

  if (query.gradeId !== undefined && query.gradeId !== '') {
    if (typeof query.gradeId !== 'string' || !UUID_REGEX.test(query.gradeId.trim())) {
      fields.gradeId = 'Must be a valid UUID';
    } else {
      gradeId = query.gradeId.trim();
    }
  }

  if (query.district !== undefined && query.district !== '') {
    if (typeof query.district !== 'string' || query.district.trim().length > 100) {
      fields.district = 'Must be a valid district name up to 100 characters';
    } else {
      district = query.district.trim();
    }
  }

  if (Object.keys(fields).length > 0) {
    return { fields };
  }
  return { cropId, gradeId, district };
}

async function getApprovedBuyerWithWallet(userId, role) {
  const { rows } = await runQuery(
    `SELECT u.id,
            u.name,
            u.role,
            u.district,
            COALESCE(w.available_cents, 0) AS available_cents,
            COALESCE(w.held_cents, 0) AS held_cents,
            COALESCE(w.currency, 'LKR') AS currency,
            COALESCE(w.simulated, true) AS simulated
     FROM users u
     LEFT JOIN wallets w ON w.owner_id = u.id AND w.account_type = 'buyer'
     WHERE u.id = $1 AND u.role = $2 AND u.approval_status = $3`,
    [userId, role, 'approved']
  );
  return rows[0] || null;
}

async function loadDashboardStats(buyerId, buyerAccount) {
  const orderStatsResult = await runQuery(
    `SELECT
       COUNT(*) FILTER (
         WHERE status IN ('draft', 'awaiting_suppliers', 'ready_to_confirm', 'confirmed', 'in_fulfilment')
       )::int AS active_orders_count,
       COUNT(*) FILTER (
         WHERE status = 'awaiting_suppliers'
       )::int AS awaiting_supplier_count,
       COUNT(*) FILTER (
         WHERE status IN ('delivered', 'closed')
       )::int AS completed_orders_count,
       COUNT(*) FILTER (
         WHERE status IN ('delivered', 'closed')
           AND updated_at >= now() - INTERVAL '30 days'
       )::int AS completed_last_30_days_count
     FROM orders
     WHERE buyer_id = $1`,
    [buyerId]
  );

  const supplyStatsResult = await runQuery(
    `WITH combined_supply AS (
       SELECT
         b.id AS batch_id,
         b.farm_id,
         l.id AS listing_id,
         CASE
           WHEN l.id IS NOT NULL THEN LEAST(l.offered_kg, GREATEST(ba.available_kg, 0))
           ELSE GREATEST(ba.available_kg, 0)
         END::NUMERIC(12,3) AS effective_kg
       FROM harvest_batches b
       JOIN batch_availability ba ON ba.batch_id = b.id
       JOIN farms f ON f.id = b.farm_id AND f.status = 'active'
       JOIN users u ON u.id = b.farmer_id AND u.role = 'farmer' AND u.approval_status = 'approved'
       LEFT JOIN listings l
         ON l.batch_id = b.id
        AND l.status = 'active'
        AND l.valid_from <= now()
        AND l.valid_until > now()
       WHERE b.status IN ('ready', 'harvested')
         AND ba.available_kg > 0
     )
     SELECT
       COALESCE(SUM(effective_kg), 0)::NUMERIC(12,3) AS total_supply_kg,
       COALESCE(SUM(effective_kg) FILTER (WHERE listing_id IS NOT NULL), 0)::NUMERIC(12,3) AS listed_supply_kg,
       COALESCE(SUM(effective_kg) FILTER (WHERE listing_id IS NULL), 0)::NUMERIC(12,3) AS batch_supply_kg,
       COUNT(DISTINCT farm_id)::int AS active_growers_count
     FROM combined_supply`
  );

  const orderRow = orderStatsResult.rows[0] || {};
  const supplyRow = supplyStatsResult.rows[0] || {};
  const totalSupplyKg = toKg(supplyRow.total_supply_kg);
  const listedSupplyKg = toKg(supplyRow.listed_supply_kg);
  const batchSupplyKg = toKg(supplyRow.batch_supply_kg);

  return {
    activeOrdersCount: orderRow.active_orders_count || 0,
    awaitingSupplierCount: orderRow.awaiting_supplier_count || 0,
    availableSupplyKg: totalSupplyKg,
    listedSupplyKg,
    batchSupplyKg,
    supplySource: listedSupplyKg > 0 ? 'active_listings' : batchSupplyKg > 0 ? 'harvest_batches' : 'none',
    activeGrowersCount: supplyRow.active_growers_count || 0,
    completedOrdersCount: orderRow.completed_orders_count || 0,
    completedLast30DaysCount: orderRow.completed_last_30_days_count || 0,
    heldFundsCents: toCents(buyerAccount.held_cents),
    availableFundsCents: toCents(buyerAccount.available_cents),
    currency: buyerAccount.currency || 'LKR',
    simulatedWallet: Boolean(buyerAccount.simulated),
  };
}

async function loadProcurementActivity(buyerId, range, days) {
  const { rows } = await runQuery(
    `WITH bounds AS (
       SELECT ((now() AT TIME ZONE 'Asia/Colombo')::DATE - ($2::int - 1)) AS start_day,
              (now() AT TIME ZONE 'Asia/Colombo')::DATE AS end_day
     ),
     days AS (
       SELECT generate_series(start_day, end_day, INTERVAL '1 day')::DATE AS day
       FROM bounds
     ),
     daily_orders AS (
       SELECT
         (o.created_at AT TIME ZONE 'Asia/Colombo')::DATE AS day,
         COUNT(DISTINCT o.id)::int AS order_count,
         COALESCE(SUM(a.agreed_kg), 0)::NUMERIC(12,3) AS total_kg,
         COALESCE(SUM(a.agreed_value_cents), 0)::BIGINT AS total_cents
       FROM orders o
       LEFT JOIN allocations a ON a.order_id = o.id
       CROSS JOIN bounds
       WHERE o.buyer_id = $1
         AND o.status NOT IN ('cancelled', 'expired')
         AND (o.created_at AT TIME ZONE 'Asia/Colombo')::DATE BETWEEN bounds.start_day AND bounds.end_day
       GROUP BY (o.created_at AT TIME ZONE 'Asia/Colombo')::DATE
     )
     SELECT
       to_char(d.day, 'YYYY-MM-DD') AS date,
       to_char(d.day, 'Dy') AS day_label,
       COALESCE(o.order_count, 0)::int AS order_count,
       COALESCE(o.total_kg, 0)::NUMERIC(12,3) AS total_kg,
       COALESCE(o.total_cents, 0)::BIGINT AS total_cents
     FROM days d
     LEFT JOIN daily_orders o ON o.day = d.day
     ORDER BY d.day ASC`,
    [buyerId, days]
  );

  const series = rows.map((row) => ({
    date: row.date,
    dayLabel: row.day_label,
    orderCount: row.order_count,
    totalKg: toKg(row.total_kg),
    totalCents: toCents(row.total_cents),
  }));

  const totalKg = Number(series.reduce((sum, item) => sum + item.totalKg, 0).toFixed(3));
  const totalCents = series.reduce((sum, item) => sum + item.totalCents, 0);
  const peakKg = series.reduce((max, item) => (item.totalKg > max ? item.totalKg : max), 0);

  return {
    range,
    days,
    timezone: 'Asia/Colombo',
    totalKg,
    totalCents,
    peakKg,
    series,
  };
}

async function loadLatestBulkMatch(buyerId) {
  const { rows: orderRows } = await runQuery(
    `SELECT o.id,
            o.operation_key,
            o.status,
            o.agreed_total_cents,
            o.delivery_date,
            o.created_at,
            COUNT(DISTINCT b.farm_id)::int AS grower_count
     FROM orders o
     JOIN allocations a ON a.order_id = o.id
     JOIN harvest_batches b ON b.id = a.batch_id
     WHERE o.buyer_id = $1
       AND o.status NOT IN ('cancelled', 'expired')
     GROUP BY o.id
     ORDER BY (COUNT(DISTINCT b.farm_id) > 1) DESC, o.created_at DESC
     LIMIT 1`,
    [buyerId]
  );

  if (!orderRows[0]) return null;
  const order = orderRows[0];

  const { rows: allocationRows } = await runQuery(
    `SELECT a.id AS allocation_id,
            a.batch_id,
            f.id AS farm_id,
            f.name AS farm_name,
            f.district,
            c.id AS crop_id,
            c.name AS crop_name,
            g.id AS grade_id,
            g.name AS grade_name,
            a.agreed_kg,
            a.agreed_unit_price_cents,
            a.agreed_value_cents,
            a.status
     FROM allocations a
     JOIN harvest_batches b ON b.id = a.batch_id
     JOIN farms f ON f.id = b.farm_id
     JOIN crops c ON c.id = b.crop_id
     JOIN grades g ON g.id = b.grade_id
     WHERE a.order_id = $1
     ORDER BY a.agreed_kg DESC, f.name ASC`,
    [order.id]
  );

  const growers = allocationRows.map((row) => ({
    allocationId: row.allocation_id,
    batchId: row.batch_id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    district: row.district,
    cropId: row.crop_id,
    cropName: row.crop_name,
    gradeId: row.grade_id,
    gradeName: row.grade_name,
    agreedKg: toKg(row.agreed_kg),
    agreedUnitPriceCents: toCents(row.agreed_unit_price_cents),
    agreedValueCents: toCents(row.agreed_value_cents),
    status: row.status,
  }));

  const totalKg = Number(growers.reduce((sum, item) => sum + item.agreedKg, 0).toFixed(3));
  const primaryCrop = growers[0]?.cropName || null;
  const primaryGrade = growers[0]?.gradeName || null;

  return {
    orderId: order.id,
    orderCode: formatOrderCode(order.operation_key, order.id),
    status: order.status,
    growerCount: order.grower_count,
    totalKg,
    goodsTotalCents: toCents(order.agreed_total_cents),
    primaryCrop,
    primaryGrade,
    deliveryDate: order.delivery_date,
    createdAt: order.created_at,
    growers,
  };
}

async function loadSuggestedHarvestMatches({ cropId = null, gradeId = null, district = null, limit = 5 }) {
  const result = await runQuery(
    `SELECT l.id AS listing_id,
            b.id AS batch_id,
            f.id AS farm_id,
            f.name AS farm_name,
            f.district,
            c.id AS crop_id,
            c.name AS crop_name,
            g.id AS grade_id,
            g.name AS grade_name,
            CASE
              WHEN l.id IS NOT NULL THEN LEAST(l.offered_kg, GREATEST(ba.available_kg, 0))
              ELSE GREATEST(ba.available_kg, 0)
            END::NUMERIC(12,3) AS available_kg,
            l.unit_price_cents,
            b.status AS batch_status,
            b.planned_harvest_date
     FROM harvest_batches b
     JOIN batch_availability ba ON ba.batch_id = b.id
     JOIN farms f ON f.id = b.farm_id AND f.status = 'active'
     JOIN users u ON u.id = b.farmer_id AND u.role = 'farmer' AND u.approval_status = 'approved'
     JOIN crops c ON c.id = b.crop_id
     JOIN grades g ON g.id = b.grade_id
     LEFT JOIN listings l
       ON l.batch_id = b.id
      AND l.status = 'active'
      AND l.valid_from <= now()
      AND l.valid_until > now()
     WHERE b.status IN ('ready', 'harvested')
       AND ba.available_kg > 0
       AND ($1::uuid IS NULL OR b.crop_id = $1::uuid OR lower(regexp_replace(c.name, '(es|s)$', '')) = (SELECT lower(regexp_replace(name, '(es|s)$', '')) FROM crops WHERE id = $1::uuid))
       AND ($2::uuid IS NULL OR b.grade_id = $2::uuid)
       AND ($3::text IS NULL OR lower(f.district) = lower($3::text))
     ORDER BY (l.id IS NOT NULL) DESC, l.unit_price_cents ASC NULLS LAST, available_kg DESC, f.name ASC
     LIMIT $4`,
    [cropId, gradeId, district, limit]
  );

  const matches = result.rows.map((row) => ({
    listingId: row.listing_id || null,
    batchId: row.batch_id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    district: row.district,
    cropId: row.crop_id,
    cropName: row.crop_name,
    gradeId: row.grade_id,
    gradeName: row.grade_name,
    availableKg: toKg(row.available_kg),
    unitPriceCents: toOptionalCents(row.unit_price_cents),
    batchStatus: row.batch_status,
    plannedHarvestDate: row.planned_harvest_date,
  }));

  const totalAvailableKg = Number(matches.reduce((sum, item) => sum + item.availableKg, 0).toFixed(3));
  const pricedMatches = matches.filter((item) => item.unitPriceCents !== null);
  const estimatedTotalCents =
    pricedMatches.length > 0
      ? pricedMatches.reduce((sum, item) => sum + Math.round(item.availableKg * item.unitPriceCents), 0)
      : null;

  return {
    source: pricedMatches.length > 0 ? 'active_listings' : matches.length > 0 ? 'harvest_batches' : 'none',
    totalAvailableKg,
    estimatedTotalCents,
    growerCount: new Set(matches.map((item) => item.farmId)).size,
    matches,
  };
}

async function loadBuyingInsights({ cropId = null, gradeId = null, district = null }) {
  const filterMetaRes = await runQuery(
    `SELECT
       COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name ASC) FROM crops c WHERE c.active = true), '[]'::json) AS crops,
       COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name ASC) FROM grades g WHERE g.active = true), '[]'::json) AS grades,
       COALESCE((SELECT json_agg(d.district ORDER BY d.district ASC) FROM (
         SELECT district FROM farms WHERE status = 'active'
         UNION
         SELECT district FROM market_observations WHERE is_current = true
         UNION
         SELECT district FROM forecast_runs
       ) d WHERE d.district IS NOT NULL AND length(trim(d.district)) > 0), '[]'::json) AS districts`
  );

  const metaRow = filterMetaRes.rows[0] || {};
  const cropsList = Array.isArray(metaRow.crops) ? metaRow.crops : [];
  const gradesList = Array.isArray(metaRow.grades) ? metaRow.grades : [];
  const districtsList = Array.isArray(metaRow.districts) ? metaRow.districts : [];

  const forecastRes = await runQuery(
    `SELECT fr.id,
            fr.crop_id,
            c.name AS crop_name,
            fr.district,
            fr.method,
            fr.model_version,
            fr.input_from,
            fr.input_until,
            fr.horizon_days,
            fr.series,
            fr.model_mae_kg,
            fr.baseline_mae_kg,
            fr.explanation,
            fr.status,
            fr.sample_data,
            fr.generated_at
     FROM forecast_runs fr
     JOIN crops c ON c.id = fr.crop_id
     WHERE ($1::uuid IS NULL OR fr.crop_id = $1::uuid OR lower(regexp_replace(c.name, '(es|s)$', '')) = (SELECT lower(regexp_replace(name, '(es|s)$', '')) FROM crops WHERE id = $1::uuid))
       AND ($2::text IS NULL OR lower(fr.district) = lower($2::text))
     ORDER BY (fr.status = 'available') DESC, fr.generated_at DESC
     LIMIT 1`,
    [cropId, district]
  );

  const priceRes = await runQuery(
    `SELECT
       COUNT(*)::int AS observation_count,
       MIN(mo.price_per_kg_cents) AS min_price_cents,
       MAX(mo.price_per_kg_cents) AS max_price_cents,
       ROUND(AVG(mo.price_per_kg_cents))::BIGINT AS avg_price_cents,
       MIN(mo.observation_date) AS date_from,
       MAX(mo.observation_date) AS date_until,
       MAX(mo.imported_at) AS last_updated,
       COALESCE(BOOL_OR(mo.sample_data), false) AS sample_data
     FROM market_observations mo
     JOIN crops c ON c.id = mo.crop_id
     WHERE mo.is_current = true
       AND ($1::uuid IS NULL OR mo.crop_id = $1::uuid OR lower(regexp_replace(c.name, '(es|s)$', '')) = (SELECT lower(regexp_replace(name, '(es|s)$', '')) FROM crops WHERE id = $1::uuid))
       AND ($2::uuid IS NULL OR mo.grade_id = $2::uuid)
       AND ($3::text IS NULL OR lower(mo.district) = lower($3::text))`,
    [cropId, gradeId, district]
  );

  const suggestedHarvestMatches = await loadSuggestedHarvestMatches({ cropId, gradeId, district, limit: 5 });

  const forecastRow = forecastRes.rows[0] || null;
  let demandForecast;
  if (forecastRow) {
    const series = Array.isArray(forecastRow.series) ? forecastRow.series : [];
    const firstVal = series.length > 0 ? Number(series[0]?.demand_kg ?? series[0]?.demandKg ?? 0) : 0;
    const lastVal = series.length > 0 ? Number(series[series.length - 1]?.demand_kg ?? series[series.length - 1]?.demandKg ?? 0) : 0;
    const trend = series.length < 2
      ? 'flat'
      : lastVal > firstVal
        ? 'upward'
        : lastVal < firstVal
          ? 'downward'
          : 'flat';

    demandForecast = {
      available: forecastRow.status === 'available',
      status: forecastRow.status,
      cropId: forecastRow.crop_id,
      cropName: forecastRow.crop_name,
      district: forecastRow.district,
      method: forecastRow.method,
      modelVersion: forecastRow.model_version,
      horizonDays: forecastRow.horizon_days,
      inputFrom: forecastRow.input_from,
      inputUntil: forecastRow.input_until,
      modelMaeKg: forecastRow.model_mae_kg !== null ? toKg(forecastRow.model_mae_kg) : null,
      baselineMaeKg: forecastRow.baseline_mae_kg !== null ? toKg(forecastRow.baseline_mae_kg) : null,
      trend,
      explanation: forecastRow.explanation,
      sampleData: Boolean(forecastRow.sample_data),
      generatedAt: forecastRow.generated_at,
      series,
    };
  } else {
    demandForecast = {
      available: false,
      status: 'insufficient_data',
      cropId,
      cropName: cropsList.find((c) => c.id === cropId)?.name || null,
      district,
      method: null,
      modelVersion: null,
      horizonDays: 7,
      inputFrom: null,
      inputUntil: null,
      modelMaeKg: null,
      baselineMaeKg: null,
      trend: 'flat',
      explanation: 'No demand forecast run is available for the selected crop and district yet.',
      sampleData: false,
      generatedAt: null,
      series: [],
    };
  }

  const priceRow = priceRes.rows[0] || {};
  const observationCount = priceRow.observation_count || 0;
  const marketPriceInsights = {
    available: observationCount > 0,
    method: 'Recent price observations',
    observationCount,
    minPriceCents: toOptionalCents(priceRow.min_price_cents),
    maxPriceCents: toOptionalCents(priceRow.max_price_cents),
    avgPriceCents: toOptionalCents(priceRow.avg_price_cents),
    dateFrom: priceRow.date_from || null,
    dateUntil: priceRow.date_until || null,
    lastUpdated: priceRow.last_updated || null,
    sampleData: Boolean(priceRow.sample_data),
    advisoryNote: 'Comparable prices are guidance and do not automatically change supplier prices.',
  };

  return {
    advisoryNotice: 'Insights are advisory only. All orders require buyer confirmation.',
    filters: {
      selected: { cropId, gradeId, district },
      crops: cropsList,
      grades: gradesList,
      districts: districtsList,
    },
    demandForecast,
    marketPriceInsights,
    suggestedHarvestMatches,
  };
}

async function loadRecentOrders(buyerId, limit) {
  const { rows } = await runQuery(
    `SELECT o.id,
            o.operation_key,
            o.status,
            o.agreed_total_cents,
            o.destination,
            o.destination_district,
            o.delivery_date,
            o.created_at,
            COUNT(a.id)::int AS allocation_count,
            COUNT(DISTINCT f.id)::int AS grower_count,
            MIN(f.name) AS primary_farm_name,
            MIN(c.name) AS primary_crop_name,
            MIN(g.name) AS primary_grade_name,
            COUNT(DISTINCT c.id)::int AS crop_count,
            COALESCE(SUM(a.agreed_kg), 0)::NUMERIC(12,3) AS total_kg
     FROM orders o
     LEFT JOIN allocations a ON a.order_id = o.id
     LEFT JOIN harvest_batches b ON b.id = a.batch_id
     LEFT JOIN farms f ON f.id = b.farm_id
     LEFT JOIN crops c ON c.id = b.crop_id
     LEFT JOIN grades g ON g.id = b.grade_id
     WHERE o.buyer_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [buyerId, limit]
  );

  return rows.map((row) => {
    const growerCount = row.grower_count || 0;
    const cropCount = row.crop_count || 0;
    return {
      id: row.id,
      orderCode: formatOrderCode(row.operation_key, row.id),
      sourceLabel: growerCount > 1 ? `${growerCount} growers` : (row.primary_farm_name || 'Pending grower'),
      growerCount,
      allocationCount: row.allocation_count || 0,
      cropName: cropCount > 1 && row.primary_crop_name
        ? `${row.primary_crop_name} +${cropCount - 1}`
        : (row.primary_crop_name || 'Produce'),
      gradeName: row.primary_grade_name || null,
      totalKg: toKg(row.total_kg),
      agreedTotalCents: toCents(row.agreed_total_cents),
      status: row.status,
      destination: row.destination,
      destinationDistrict: row.destination_district,
      deliveryDate: row.delivery_date,
      createdAt: row.created_at,
    };
  });
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM11', owner: 'Meranga Akash', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const activityCheck = validateActivityRange(req.query.range);
    const limitCheck = validateRecentLimit(req.query.recentLimit);
    const filterCheck = validateInsightFilters(req.query);

    const validationFields = {
      ...(activityCheck.error ? { range: activityCheck.error } : {}),
      ...(limitCheck.error ? { recentLimit: limitCheck.error } : {}),
      ...(filterCheck.fields || {}),
    };
    if (Object.keys(validationFields).length > 0) {
      return res.status(422).json({
        error: 'Invalid query parameters',
        fields: validationFields,
        requestId: req.requestId,
      });
    }

    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const stats = await loadDashboardStats(buyer.id, buyer);
    const procurementActivity = await loadProcurementActivity(
      buyer.id,
      activityCheck.range,
      activityCheck.days
    );
    const latestBulkMatch = await loadLatestBulkMatch(buyer.id);
    const insights = await loadBuyingInsights(filterCheck);
    const recentOrders = await loadRecentOrders(buyer.id, limitCheck.limit);

    return res.json({
      buyer: {
        id: buyer.id,
        name: buyer.name,
        role: buyer.role,
        district: buyer.district,
      },
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Colombo',
      stats,
      matchingNow: insights.suggestedHarvestMatches,
      latestBulkMatch,
      procurementActivity,
      insights,
      recentOrders,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProcurementActivity(req, res, next) {
  try {
    const activityCheck = validateActivityRange(req.query.range);
    if (activityCheck.error) {
      return res.status(422).json({
        error: 'Invalid query parameters',
        fields: { range: activityCheck.error },
        requestId: req.requestId,
      });
    }

    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const procurementActivity = await loadProcurementActivity(
      buyer.id,
      activityCheck.range,
      activityCheck.days
    );

    return res.json({
      procurementActivity,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

export async function getBuyingInsights(req, res, next) {
  try {
    const filterCheck = validateInsightFilters(req.query);
    if (filterCheck.fields) {
      return res.status(422).json({
        error: 'Invalid query parameters',
        fields: filterCheck.fields,
        requestId: req.requestId,
      });
    }

    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const insights = await loadBuyingInsights(filterCheck);

    return res.json({
      insights,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

async function loadMarketplaceFilterOptions() {
  const { rows } = await runQuery(
    `SELECT
       COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name ASC) FROM crops c WHERE c.active = true), '[]'::json) AS crops,
       COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name ASC) FROM grades g WHERE g.active = true), '[]'::json) AS grades,
       COALESCE((SELECT json_agg(d.district ORDER BY d.district ASC) FROM (SELECT DISTINCT district FROM farms WHERE status = 'active' AND district IS NOT NULL AND length(trim(district)) > 0) d), '[]'::json) AS districts`
  );
  const row = rows[0] || {};
  const rawCrops = Array.isArray(row.crops) ? row.crops : [];
  const rawGrades = Array.isArray(row.grades) ? row.grades : [];
  const rawDistricts = Array.isArray(row.districts) ? row.districts : [];
  return {
    crops: rawCrops.map((crop) => ({
      id: crop.id,
      name: crop.name,
      category: classifyCropCategory(crop.name),
    })),
    grades: rawGrades,
    districts: rawDistricts,
  };
}

function mapMarketplaceRow(row) {
  const isAvailableNow = row.availability_status === 'available_now';
  const effectiveDate = formatDateOnly(
    isAvailableNow ? (row.actual_harvest_date || row.planned_harvest_date) : row.planned_harvest_date
  );
  return {
    id: row.listing_id || row.batch_id,
    listingId: row.listing_id || null,
    batchId: row.batch_id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    district: row.district,
    cropId: row.crop_id,
    cropName: row.crop_name,
    category: classifyCropCategory(row.crop_name),
    gradeId: row.grade_id,
    gradeName: row.grade_name,
    availableKg: toKg(row.effective_kg),
    unitPriceCents: toOptionalCents(row.unit_price_cents),
    isListed: Boolean(row.listing_id),
    batchStatus: row.batch_status,
    availabilityStatus: row.availability_status,
    readyToPurchase: isAvailableNow,
    harvestDate: effectiveDate,
    plannedHarvestDate: formatDateOnly(row.planned_harvest_date),
    actualHarvestDate: formatDateOnly(row.actual_harvest_date),
    validUntil: row.valid_until || null,
    publicTraceToken: row.public_trace_token,
    createdAt: row.created_at,
  };
}

const MARKETPLACE_BASE_CTE = `
  WITH marketplace_items AS (
    SELECT
      l.id AS listing_id,
      b.id AS batch_id,
      f.id AS farm_id,
      f.name AS farm_name,
      f.district,
      c.id AS crop_id,
      c.name AS crop_name,
      g.id AS grade_id,
      g.name AS grade_name,
      b.status AS batch_status,
      CASE
        WHEN b.status IN ('ready', 'harvested') AND ba.available_kg > 0 THEN 'available_now'
        ELSE 'planned'
      END AS availability_status,
      CASE
        WHEN b.status IN ('ready', 'harvested') AND ba.available_kg > 0 THEN
          CASE
            WHEN l.id IS NOT NULL THEN LEAST(l.offered_kg, ba.available_kg)
            ELSE ba.available_kg
          END
        ELSE b.planned_kg
      END::NUMERIC(12,3) AS effective_kg,
      l.unit_price_cents,
      b.planned_harvest_date,
      b.actual_harvest_date,
      COALESCE(
        CASE WHEN b.status IN ('ready', 'harvested') THEN b.actual_harvest_date ELSE NULL END,
        b.planned_harvest_date
      ) AS availability_date,
      l.valid_until,
      b.public_trace_token,
      COALESCE(l.created_at, b.created_at) AS created_at
    FROM harvest_batches b
    JOIN batch_availability ba ON ba.batch_id = b.id
    JOIN farms f ON f.id = b.farm_id AND f.status = 'active'
    JOIN users u ON u.id = b.farmer_id AND u.role = 'farmer' AND u.approval_status = 'approved'
    JOIN crops c ON c.id = b.crop_id AND c.active = true
    JOIN grades g ON g.id = b.grade_id AND g.active = true
    LEFT JOIN listings l
      ON l.batch_id = b.id
     AND l.status = 'active'
     AND l.valid_from <= now()
     AND l.valid_until > now()
    WHERE (
      (b.status IN ('ready', 'harvested') AND ba.available_kg > 0)
      OR (b.status = 'planned' AND b.planned_kg > 0)
    )
  )
`;

export async function getMarketplaceOverview(req, res, next) {
  try {
    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const filterOptions = await loadMarketplaceFilterOptions();
    const itemsResult = await runQuery(
      `${MARKETPLACE_BASE_CTE}
       SELECT *
       FROM marketplace_items
       ORDER BY
         (availability_status = 'available_now') DESC,
         (listing_id IS NOT NULL) DESC,
         unit_price_cents ASC NULLS LAST,
         effective_kg DESC,
         planned_harvest_date ASC`
    );

    const mapped = itemsResult.rows.map(mapMarketplaceRow);
    const availableItems = mapped.filter((item) => item.availabilityStatus === 'available_now');
    const plannedItems = mapped.filter((item) => item.availabilityStatus === 'planned');

    const categoryCounts = new Map(CROP_CATEGORIES.map((c) => [c.key, 0]));
    for (const item of availableItems) {
      categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
    }

    const categories = CROP_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      count: categoryCounts.get(c.key) || 0,
    }));

    const availableNowTotalKg = Number(
      availableItems.reduce((sum, item) => sum + item.availableKg, 0).toFixed(3)
    );
    const comingSoonTotalKg = Number(
      plannedItems.reduce((sum, item) => sum + item.availableKg, 0).toFixed(3)
    );
    const activeSuppliersCount = new Set(mapped.map((item) => item.farmId)).size;

    return res.json({
      summary: {
        availableNowCount: availableItems.length,
        availableNowTotalKg,
        comingSoonCount: plannedItems.length,
        comingSoonTotalKg,
        activeSuppliersCount,
      },
      categories,
      availableNow: availableItems.slice(0, 12),
      comingSoon: plannedItems.slice(0, 6),
      filters: filterOptions,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

export async function searchMarketplace(req, res, next) {
  try {
    const fields = {};

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length > 100) {
      fields.q = 'Search term must be 100 characters or fewer';
    }

    let cropId = null;
    if (req.query.cropId !== undefined && req.query.cropId !== '') {
      if (typeof req.query.cropId !== 'string' || !UUID_REGEX.test(req.query.cropId.trim())) {
        fields.cropId = 'Must be a valid UUID';
      } else {
        cropId = req.query.cropId.trim();
      }
    }

    let category = null;
    if (req.query.category !== undefined && req.query.category !== '') {
      if (typeof req.query.category !== 'string' || !CATEGORY_KEYS.has(req.query.category.trim())) {
        fields.category = 'Unsupported category';
      } else {
        category = req.query.category.trim();
      }
    }

    let gradeIds = [];
    const rawGrades = req.query.gradeIds ?? req.query.gradeId;
    if (rawGrades !== undefined && rawGrades !== '') {
      const parts = Array.isArray(rawGrades)
        ? rawGrades.flatMap((v) => String(v).split(','))
        : String(rawGrades).split(',');
      const cleaned = parts.map((v) => v.trim()).filter(Boolean);
      if (cleaned.some((id) => !UUID_REGEX.test(id))) {
        fields.gradeIds = 'All grade IDs must be valid UUIDs';
      } else {
        gradeIds = [...new Set(cleaned)];
      }
    }

    let district = null;
    if (req.query.district !== undefined && req.query.district !== '') {
      if (typeof req.query.district !== 'string' || req.query.district.trim().length > 100) {
        fields.district = 'Must be a valid district name up to 100 characters';
      } else {
        district = req.query.district.trim();
      }
    }

    let minPriceCents = null;
    if (req.query.minPriceCents !== undefined && req.query.minPriceCents !== '') {
      const parsed = Number(req.query.minPriceCents);
      if (!Number.isInteger(parsed) || parsed < 0) {
        fields.minPriceCents = 'Must be a non-negative integer in LKR cents';
      } else {
        minPriceCents = parsed;
      }
    }

    let maxPriceCents = null;
    if (req.query.maxPriceCents !== undefined && req.query.maxPriceCents !== '') {
      const parsed = Number(req.query.maxPriceCents);
      if (!Number.isInteger(parsed) || parsed < 0) {
        fields.maxPriceCents = 'Must be a non-negative integer in LKR cents';
      } else {
        maxPriceCents = parsed;
      }
    }

    if (minPriceCents !== null && maxPriceCents !== null && minPriceCents > maxPriceCents) {
      fields.maxPriceCents = 'Must be greater than or equal to minPriceCents';
    }

    let minKg = null;
    if (req.query.minKg !== undefined && req.query.minKg !== '') {
      const raw = String(req.query.minKg).trim();
      if (!KG_REGEX.test(raw) || Number(raw) >= 1000000000) {
        fields.minKg = 'Must be a non-negative kg value with at most 3 decimal places';
      } else {
        minKg = Number(raw);
      }
    }

    const availability =
      req.query.availability === undefined || req.query.availability === ''
        ? 'all'
        : String(req.query.availability).trim();
    if (!SEARCH_AVAILABILITY_MODES.has(availability)) {
      fields.availability = 'Use all, available_now, within_7_days, within_30_days, or planned';
    }

    const sort =
      req.query.sort === undefined || req.query.sort === ''
        ? 'price_asc'
        : String(req.query.sort).trim();
    if (!SEARCH_SORT_MODES.has(sort)) {
      fields.sort = 'Use price_asc, price_desc, quantity_desc, harvest_asc, or newest';
    }

    const page =
      req.query.page === undefined || req.query.page === '' ? 1 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) {
      fields.page = 'Must be a positive integer';
    }

    const pageSize =
      req.query.pageSize === undefined || req.query.pageSize === ''
        ? DEFAULT_SEARCH_PAGE_SIZE
        : Number(req.query.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_SEARCH_PAGE_SIZE) {
      fields.pageSize = `Must be an integer between 1 and ${MAX_SEARCH_PAGE_SIZE}`;
    }

    if (Object.keys(fields).length > 0) {
      return res.status(422).json({
        error: 'Invalid search parameters',
        fields,
        requestId: req.requestId,
      });
    }

    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const whereClauses = ['1=1'];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (q) {
      const p = addParam(`%${q}%`);
      whereClauses.push(
        `(crop_name ILIKE ${p} OR farm_name ILIKE ${p} OR district ILIKE ${p} OR grade_name ILIKE ${p})`
      );
    }
    if (cropId) {
      const p = addParam(cropId);
      whereClauses.push(
        `(crop_id = ${p}::uuid OR lower(regexp_replace(crop_name, '(es|s)$', '')) = (SELECT lower(regexp_replace(name, '(es|s)$', '')) FROM crops WHERE id = ${p}::uuid))`
      );
    }
    if (gradeIds.length > 0) {
      whereClauses.push(`grade_id = ANY(${addParam(gradeIds)}::uuid[])`);
    }
    if (district) {
      whereClauses.push(`lower(district) = lower(${addParam(district)})`);
    }
    if (minPriceCents !== null) {
      whereClauses.push(`unit_price_cents IS NOT NULL AND unit_price_cents >= ${addParam(minPriceCents)}::bigint`);
    }
    if (maxPriceCents !== null) {
      whereClauses.push(`unit_price_cents IS NOT NULL AND unit_price_cents <= ${addParam(maxPriceCents)}::bigint`);
    }
    if (minKg !== null) {
      whereClauses.push(`effective_kg >= ${addParam(minKg)}::numeric`);
    }

    if (availability === 'available_now') {
      whereClauses.push(`availability_status = 'available_now'`);
    } else if (availability === 'planned') {
      whereClauses.push(`availability_status = 'planned'`);
    } else if (availability === 'within_7_days') {
      whereClauses.push(
        `(availability_status = 'available_now' OR (availability_status = 'planned' AND planned_harvest_date <= ((now() AT TIME ZONE 'Asia/Colombo')::DATE + 7)))`
      );
    } else if (availability === 'within_30_days') {
      whereClauses.push(
        `(availability_status = 'available_now' OR (availability_status = 'planned' AND planned_harvest_date <= ((now() AT TIME ZONE 'Asia/Colombo')::DATE + 30)))`
      );
    }

    const orderByMap = {
      price_asc: 'unit_price_cents ASC NULLS LAST, effective_kg DESC, farm_name ASC',
      price_desc: 'unit_price_cents DESC NULLS LAST, effective_kg DESC, farm_name ASC',
      quantity_desc: 'effective_kg DESC, unit_price_cents ASC NULLS LAST, farm_name ASC',
      harvest_asc: 'availability_date ASC, effective_kg DESC, farm_name ASC',
      newest: 'created_at DESC, effective_kg DESC',
    };

    const filterOptions = await loadMarketplaceFilterOptions();
    const result = await runQuery(
      `${MARKETPLACE_BASE_CTE}
       SELECT *
       FROM marketplace_items
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY ${orderByMap[sort]}`,
      params
    );

    let items = result.rows.map(mapMarketplaceRow);
    if (category) {
      items = items.filter((item) => item.category === category);
    }

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const offset = (page - 1) * pageSize;
    const pagedItems = items.slice(offset, offset + pageSize);

    return res.json({
      items: pagedItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      appliedFilters: {
        q,
        cropId,
        category,
        gradeIds,
        district,
        minPriceCents,
        maxPriceCents,
        minKg,
        availability,
        sort,
      },
      filters: {
        ...filterOptions,
        categories: CROP_CATEGORIES,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

export async function getHarvestAvailability(req, res, next) {
  try {
    const fields = {};

    const month =
      req.query.month === undefined || req.query.month === ''
        ? getCurrentColomboMonth()
        : String(req.query.month).trim();
    if (!MONTH_REGEX.test(month)) {
      fields.month = 'Use YYYY-MM format';
    }

    let cropId = null;
    if (req.query.cropId !== undefined && req.query.cropId !== '') {
      if (typeof req.query.cropId !== 'string' || !UUID_REGEX.test(req.query.cropId.trim())) {
        fields.cropId = 'Must be a valid UUID';
      } else {
        cropId = req.query.cropId.trim();
      }
    }

    let gradeId = null;
    if (req.query.gradeId !== undefined && req.query.gradeId !== '') {
      if (typeof req.query.gradeId !== 'string' || !UUID_REGEX.test(req.query.gradeId.trim())) {
        fields.gradeId = 'Must be a valid UUID';
      } else {
        gradeId = req.query.gradeId.trim();
      }
    }

    let district = null;
    if (req.query.district !== undefined && req.query.district !== '') {
      if (typeof req.query.district !== 'string' || req.query.district.trim().length > 100) {
        fields.district = 'Must be a valid district name up to 100 characters';
      } else {
        district = req.query.district.trim();
      }
    }

    const status =
      req.query.status === undefined || req.query.status === ''
        ? 'all'
        : String(req.query.status).trim();
    if (!AVAILABILITY_STATUS_MODES.has(status)) {
      fields.status = 'Use all, available_now, or planned';
    }

    if (Object.keys(fields).length > 0) {
      return res.status(422).json({
        error: 'Invalid query parameters',
        fields,
        requestId: req.requestId,
      });
    }

    const buyer = await getApprovedBuyerWithWallet(req.user.id, req.user.role);
    if (!buyer) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { monthStart, monthEnd } = getMonthBounds(month);

    const filterOptions = await loadMarketplaceFilterOptions();
    const result = await runQuery(
      `${MARKETPLACE_BASE_CTE}
       SELECT *
       FROM marketplace_items
       WHERE ($1::uuid IS NULL OR crop_id = $1::uuid OR lower(regexp_replace(crop_name, '(es|s)$', '')) = (SELECT lower(regexp_replace(name, '(es|s)$', '')) FROM crops WHERE id = $1::uuid))
         AND ($2::uuid IS NULL OR grade_id = $2::uuid)
         AND ($3::text IS NULL OR lower(district) = lower($3::text))
         AND ($4::text = 'all' OR availability_status = $4::text)
       ORDER BY availability_date ASC, effective_kg DESC, farm_name ASC`,
      [cropId, gradeId, district, status]
    );

    const entries = result.rows.map((row) => {
      const mapped = mapMarketplaceRow(row);
      return {
        ...mapped,
        quantityKg: mapped.availableKg,
        availabilityDate: formatDateOnly(row.availability_date),
      };
    });

    const todayColombo = formatDateOnly(new Date());
    const in30Days = formatDateOnly(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const availableNowKg = Number(
      entries
        .filter((e) => e.availabilityStatus === 'available_now')
        .reduce((sum, e) => sum + e.quantityKg, 0)
        .toFixed(3)
    );
    const upcoming30DaysKg = Number(
      entries
        .filter(
          (e) =>
            e.availabilityStatus === 'planned' &&
            e.availabilityDate &&
            todayColombo &&
            in30Days &&
            e.availabilityDate >= todayColombo &&
            e.availabilityDate <= in30Days
        )
        .reduce((sum, e) => sum + e.quantityKg, 0)
        .toFixed(3)
    );
    const activeSuppliersCount = new Set(entries.map((e) => e.farmId)).size;

    const calendarDays = {};
    for (const entry of entries) {
      if (entry.availabilityDate && entry.availabilityDate >= monthStart && entry.availabilityDate <= monthEnd) {
        if (!calendarDays[entry.availabilityDate]) {
          calendarDays[entry.availabilityDate] = [];
        }
        calendarDays[entry.availabilityDate].push(entry);
      }
    }

    return res.json({
      month,
      monthStart,
      monthEnd,
      timezone: 'Asia/Colombo',
      summary: {
        availableNowKg,
        upcoming30DaysKg,
        activeSuppliersCount,
        totalEntries: entries.length,
      },
      entries,
      calendarDays,
      filters: filterOptions,
      appliedFilters: {
        month,
        cropId,
        gradeId,
        district,
        status,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}
