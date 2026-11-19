import pool from '../../config/db.js';
import { DEMO_BUYER_ID, getSampleListing } from './mockData.js';
// YM12 · MHD Muhthas · Produce & suppliers
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM12', owner: 'MHD Muhthas', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATABASE_CONNECTION_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
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

function centsToLkr(centsValue) {
  const cents = BigInt(String(centsValue));
  const whole = cents / 100n;
  const fraction = cents % 100n;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

function categoryFor(cropName) {
  // The current schema has no crop-category column. Seed crops are vegetables;
  // send a category-column proposal to the lead before expanding this mapping.
  const vegetableCrops = new Set(['tomato', 'carrot', 'cabbage', 'potato', 'beans']);
  return vegetableCrops.has(String(cropName).trim().toLowerCase()) ? 'Vegetables' : 'Produce';
}

function shapeDatabaseListing(row) {
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
      completedOrders: row.completed_orders === null ? null : Number(row.completed_orders),
      rating: null,
      ratingCount: null,
    },
  };
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
              supplier.name AS supplier_name,
              NULLIF(performance.completed_orders, 0)::int AS completed_orders
         FROM listings l
         JOIN harvest_batches b ON b.id = l.batch_id
         JOIN batch_availability ba ON ba.batch_id = b.id
         JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
         JOIN users supplier ON supplier.id = b.farmer_id
         JOIN crops c ON c.id = b.crop_id
         JOIN grades g ON g.id = b.grade_id
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT o.id)::int AS completed_orders
             FROM allocations a
             JOIN orders o ON o.id = a.order_id
            WHERE a.farmer_id = supplier.id AND o.status = 'closed'
         ) performance ON TRUE
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
    const shaped = shapeDatabaseListing(rows[0]);
    const { supplier, ...listing } = shaped;
    return res.json({ listing, supplier, dataSource: 'database', requestId: req.requestId });
  } catch (error) {
    if (isDevelopment() && isConnectionUnavailable(error)) return sendSampleListing(req, res);
    return next(error);
  }
}
