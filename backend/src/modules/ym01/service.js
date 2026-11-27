import pool from '../../config/db.js';
import { PLATFORM_INFO } from './constants.js';
import { paginationOffset } from './validation.js';

// All public listing queries use this same eligibility rule. Availability is
// computed by the existing batch_availability view and capped to offered stock.
const ELIGIBLE_LISTING = `
  l.status = 'active'
  AND l.valid_from <= now()
  AND l.valid_until > now()
  AND u.role = 'farmer'
  AND u.approval_status = 'approved'
  AND f.status = 'active'
  AND c.active = true
  AND g.active = true
  AND b.status IN ('harvested', 'ready')
  AND ba.available_kg > 0
  AND b.id NOT IN (
    'b1111111-1111-4111-8111-111111111105'::uuid,
    'b1111111-1111-4111-8111-111111111106'::uuid
  )`;

const LISTING_FROM = `
  FROM listings l
  JOIN harvest_batches b ON b.id = l.batch_id
  JOIN batch_availability ba ON ba.batch_id = b.id
  JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
  JOIN users u ON u.id = b.farmer_id
  JOIN crops c ON c.id = b.crop_id
  JOIN grades g ON g.id = b.grade_id`;

const PUBLIC_LISTING_SELECT = `
  SELECT b.id AS id,
    l.id AS listing_id,
    b.public_trace_token,
    c.name AS crop_name,
    g.name AS grade_name,
    g.description AS grade_description,
    f.name AS farm_name,
    f.district,
    l.unit_price_cents,
    l.offered_kg,
    LEAST(ba.available_kg, l.offered_kg)::numeric(12,3) AS available_kg,
    b.planned_kg,
    b.actual_kg,
    b.planned_harvest_date,
    b.actual_harvest_date,
    b.status AS harvest_status,
    l.status AS listing_status,
    l.valid_from,
    l.valid_until,
    l.created_at
  ${LISTING_FROM}
  WHERE ${ELIGIBLE_LISTING}`;

function toPublicHarvest(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    cropName: row.crop_name,
    category: row.crop_name,
    grade: row.grade_name,
    farmName: row.farm_name,
    supplierName: row.farm_name,
    district: row.district,
    harvestDate: row.actual_harvest_date ?? row.planned_harvest_date,
    plannedQuantityKg: Number(row.planned_kg),
    actualQuantityKg: row.actual_kg === null ? null : Number(row.actual_kg),
    offeredQuantityKg: Number(row.offered_kg),
    availableQuantityKg: Number(row.available_kg),
    unitPriceLkrPerKg: Number(row.unit_price_cents) / 100,
    listingValidFrom: row.valid_from,
    listingValidUntil: row.valid_until,
    listingStatus: row.listing_status,
    harvestStatus: row.harvest_status,
  };
}

export async function getLanding() {
  const [statistics, featured, recent] = await Promise.all([
    pool.query(`SELECT
      count(*)::int AS total_eligible_public_listings,
      (SELECT count(*)::int FROM crops WHERE active = true) AS total_active_crop_categories,
      count(DISTINCT u.id)::int AS total_participating_approved_farmers,
      COALESCE(sum(LEAST(ba.available_kg, l.offered_kg)), 0)::numeric(14,3) AS total_eligible_available_quantity_kg
      ${LISTING_FROM}
      WHERE ${ELIGIBLE_LISTING}`),
    pool.query(`${PUBLIC_LISTING_SELECT} ORDER BY l.created_at DESC, l.id ASC LIMIT 4`),
    pool.query(`${PUBLIC_LISTING_SELECT} ORDER BY l.created_at DESC, l.id ASC LIMIT 6`),
  ]);

  return {
    platform: PLATFORM_INFO,
    statistics: statistics.rows[0],
    featuredHarvests: featured.rows.map(toPublicHarvest),
    recentlyPublished: recent.rows.map(toPublicHarvest),
  };
}

export async function getHarvests(filters) {
  const values = [];
  const conditions = [ELIGIBLE_LISTING];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.search) conditions.push(`c.name ILIKE '%' || ${bind(filters.search)} || '%'`);
  if (filters.crop) conditions.push(`c.name ILIKE ${bind(filters.crop)}`);
  if (filters.district) conditions.push(`f.district ILIKE ${bind(filters.district)}`);
  if (filters.grade) conditions.push(`g.name ILIKE ${bind(filters.grade)}`);
  if (filters.minPriceCents !== undefined) conditions.push(`l.unit_price_cents >= ${bind(filters.minPriceCents)}`);
  if (filters.maxPriceCents !== undefined) conditions.push(`l.unit_price_cents <= ${bind(filters.maxPriceCents)}`);

  const where = conditions.join('\n AND ');
  const countValues = [...values];
  const countSql = `SELECT count(*)::int AS total ${LISTING_FROM} WHERE ${where}`;
  const orderBy = {
    newest: 'l.created_at DESC, l.id ASC',
    price_asc: 'l.unit_price_cents ASC, l.created_at DESC, l.id ASC',
    price_desc: 'l.unit_price_cents DESC, l.created_at DESC, l.id ASC',
    harvest_date_asc: 'COALESCE(b.actual_harvest_date, b.planned_harvest_date) ASC, l.id ASC',
    harvest_date_desc: 'COALESCE(b.actual_harvest_date, b.planned_harvest_date) DESC, l.id ASC',
  }[filters.sort];
  const limit = bind(filters.limit);
  const offset = bind(paginationOffset(filters));
  const rowsSql = `${PUBLIC_LISTING_SELECT.replace(ELIGIBLE_LISTING, where)} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;

  const [countResult, listingResult] = await Promise.all([
    pool.query(countSql, countValues),
    pool.query(rowsSql, values),
  ]);
  const totalRecords = countResult.rows[0].total;

  return {
    data: listingResult.rows.map(toPublicHarvest),
    pagination: {
      page: filters.page,
      pageSize: filters.limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / filters.limit),
    },
  };
}

export async function getHarvestDetails(id) {
  const { rows } = await pool.query(`${PUBLIC_LISTING_SELECT} AND b.id = $1 LIMIT 1`, [id]);
  const row = rows[0];
  if (!row) return null;

  return {
    ...toPublicHarvest(row),
    publicTraceToken: row.public_trace_token,
    gradeDescription: row.grade_description,
  };
}

export async function getHarvestTraceability(publicTraceToken) {
  const batch = await pool.query(`SELECT b.id
    ${LISTING_FROM}
    WHERE ${ELIGIBLE_LISTING} AND b.public_trace_token = $1
    LIMIT 1`, [publicTraceToken]);
  if (!batch.rows[0]) return null;

  const { rows } = await pool.query(`SELECT event_type, occurred_at,
      public_payload->>'description' AS description,
      public_payload->>'locality' AS locality,
      anchor_status
    FROM trace_events
    WHERE batch_id = $1 AND event_type <> 'resolution'
    ORDER BY occurred_at ASC, id ASC`, [batch.rows[0].id]);

  return rows.map((row) => ({
    eventType: row.event_type,
    eventDateTime: row.occurred_at,
    description: row.description || null,
    locality: row.locality || null,
    verificationStatus: row.anchor_status,
  }));
}

export async function getCategories() {
  const { rows } = await pool.query('SELECT name FROM crops WHERE active = true ORDER BY name ASC');
  return rows.map((row) => row.name);
}

export async function getDistricts() {
  const { rows } = await pool.query(`SELECT DISTINCT f.district
    ${LISTING_FROM}
    WHERE ${ELIGIBLE_LISTING}
    ORDER BY f.district ASC`);
  return rows.map((row) => row.district);
}
