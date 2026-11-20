import crypto from 'node:crypto';
import pool from '../../config/db.js';
import { validateOfferInput, validateRequestFilters, validateRequestId, validateOfferFilters, validateIdempotencyKey } from './validators.js';

let offerOptionalColumnsPromise;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Discover optional offers fields once per process so deployments with either schema work.
async function getOfferOptionalColumns() {
  if (!offerOptionalColumnsPromise) {
    offerOptionalColumnsPromise = pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1
         AND column_name = ANY($2::text[])`,
      ['offers', ['available_from', 'notes']]
    ).then(({ rows }) => {
      const columns = new Set(rows.map((row) => row.column_name));
      return {
        availableFrom: columns.has('available_from'),
        notes: columns.has('notes'),
      };
    }).catch((error) => {
      offerOptionalColumnsPromise = undefined;
      throw error;
    });
  }
  return offerOptionalColumnsPromise;
}

function offerOptionalSelect(columns, alias = 'o') {
  const fields = [];
  const prefix = alias ? `${alias}.` : '';
  // Cast DATE values before node-postgres can interpret them in the server's local timezone.
  if (columns.availableFrom) fields.push(`${prefix}available_from::text AS "availableFrom"`);
  if (columns.notes) fields.push(`${prefix}notes AS notes`);
  return fields.length ? `, ${fields.join(', ')}` : '';
}

function formatOffer(row, includeOptionalColumns = false) {
  if (!row) return null;
  const offer = {
    id: row.id,
    offerCode: `OF-${String(row.id).slice(0, 6).toUpperCase()}`,
    requestId: row.request_id,
    quantityKg: Number(row.quantity_kg),
    pricePerKgCents: Number(row.unit_price_cents),
    totalCents: Number(row.total_cents),
    status: row.status,
    createdAt: row.created_at,
  };
  if (includeOptionalColumns) {
    if (Object.prototype.hasOwnProperty.call(row, 'availableFrom')) offer.availableFrom = row.availableFrom;
    if (Object.prototype.hasOwnProperty.call(row, 'notes')) offer.notes = row.notes;
  }
  return offer;
}

function formatRequest(row, includeDetailFields = false) {
  const request = {
    id: row.id,
    requestCode: `BR-${String(row.id).slice(0, 8).toUpperCase()}`,
    buyerName: row.buyer_name,
    cropName: row.crop_name,
    gradeName: row.grade_name,
    district: row.destination_district,
    quantityKg: Number(row.quantity_kg),
    deliveryFrom: row.delivery_from,
    deliveryUntil: row.delivery_until,
    budgetCents: row.budget_cents === null ? null : Number(row.budget_cents),
    maxPricePerKgCents: row.max_price_per_kg_cents === null ? null : Number(row.max_price_per_kg_cents),
    expiresAt: row.expires_at,
    closingSoon: row.closing_soon,
    hasMatchingStock: row.has_matching_stock,
    myOfferStatus: row.my_offer_status,
  };
  if (includeDetailFields) {
    request.destination = row.destination;
    request.allowPartial = row.allow_partial;
  }
  return request;
}

function logAndRespond(res, error) {
  if (error instanceof HttpError || (Number.isInteger(error.status) && error.status >= 400 && error.status < 500)) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error('YM10 request failed:', error);
  return res.status(500).json({ message: 'Internal server error' });
}

// Escape LIKE metacharacters so supplied text is searched literally rather than as a pattern.
function escapeLikeWildcards(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

// Return the current open-request metrics for this farmer, independent of list filters.
async function getRequestSummary(farmerId) {
  // Aggregate open, matching-stock, and closing-soon requests alongside this farmer's offer counts.
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)
        FROM demands d
        WHERE d.status = 'open' AND d.expires_at > NOW()) AS open_requests,
       (SELECT COUNT(*)
        FROM demands d
        WHERE d.status = 'open' AND d.expires_at > NOW()
          AND EXISTS (
            SELECT 1
            FROM harvest_batches hb
            JOIN batch_availability ba ON ba.batch_id = hb.id
            WHERE hb.farmer_id = $1
              AND hb.crop_id = d.crop_id
              AND hb.grade_id = d.grade_id
              AND hb.status IN ('ready', 'harvested')
              AND ba.available_kg > 0
          )) AS matching_requests,
       (SELECT COUNT(*) FROM offers o WHERE o.farmer_id = $1) AS offers_submitted,
       (SELECT COUNT(*) FROM offers o WHERE o.farmer_id = $1 AND o.status = 'pending') AS awaiting_reply,
       (SELECT COUNT(*)
        FROM demands d
        WHERE d.status = 'open' AND d.expires_at > NOW()
          AND d.expires_at <= NOW() + INTERVAL '48 hours') AS closing_soon`,
    [farmerId]
  );
  const row = rows[0];
  return {
    openRequests: Number(row.open_requests),
    matchingRequests: Number(row.matching_requests),
    offersSubmitted: Number(row.offers_submitted),
    awaitingReply: Number(row.awaiting_reply),
    closingSoon: Number(row.closing_soon),
  };
}

export async function listBuyerRequests(req, res) {
  try {
    // Validate optional filters before constructing the parameterized list query.
    const filters = validateRequestFilters(req.query);
    const values = [req.user.id];
    const conditions = ["d.status = 'open'", 'd.expires_at > NOW()'];

    if (filters.cropId) {
      values.push(filters.cropId);
      conditions.push(`d.crop_id = $${values.length}`);
    }
    if (filters.gradeId) {
      values.push(filters.gradeId);
      conditions.push(`d.grade_id = $${values.length}`);
    }
    if (filters.district) {
      values.push(`%${escapeLikeWildcards(filters.district)}%`);
      conditions.push(`d.destination_district ILIKE $${values.length}`);
    }
    if (filters.deliveryWithinDays !== null) {
      values.push(filters.deliveryWithinDays);
      conditions.push(`d.delivery_from <= CURRENT_DATE + ($${values.length}::double precision * INTERVAL '1 day')`);
      conditions.push(`d.delivery_until >= CURRENT_DATE`);
    }
    if (filters.search) {
      const searchIndex = values.length + 1;
      const requestCodeSearch = filters.search.replace(/^br-/i, '');
      values.push(`%${escapeLikeWildcards(filters.search)}%`);
      values.push(`%${escapeLikeWildcards(requestCodeSearch)}%`);
      conditions.push(`(buyer.name ILIKE $${searchIndex}
        OR crop.name ILIKE $${searchIndex}
        OR d.id::text ILIKE $${searchIndex + 1})`);
    }

    // Retrieve matching open requests, stock availability, and the farmer's latest offer status.
    const { rows } = await pool.query(
      `SELECT d.id, d.crop_id, d.grade_id, buyer.name AS buyer_name, crop.name AS crop_name, grade.name AS grade_name,
         d.destination_district, d.quantity_kg, d.delivery_from::text AS delivery_from,
         d.delivery_until::text AS delivery_until, d.budget_cents,
         CASE WHEN d.budget_cents IS NULL THEN NULL
              ELSE ROUND(d.budget_cents::numeric / NULLIF(d.quantity_kg, 0)) END AS max_price_per_kg_cents,
         d.expires_at, (d.expires_at <= NOW() + INTERVAL '48 hours') AS closing_soon,
         EXISTS (
           SELECT 1
           FROM harvest_batches hb
           JOIN batch_availability ba ON ba.batch_id = hb.id
           WHERE hb.farmer_id = $1
             AND hb.crop_id = d.crop_id
             AND hb.grade_id = d.grade_id
             AND hb.status IN ('ready', 'harvested')
             AND ba.available_kg > 0
         ) AS has_matching_stock,
         (SELECT o.status
          FROM offers o
          WHERE o.demand_id = d.id AND o.farmer_id = $1
          ORDER BY o.created_at DESC
          LIMIT 1) AS my_offer_status
       FROM demands d
       JOIN users buyer ON buyer.id = d.buyer_id
       JOIN crops crop ON crop.id = d.crop_id
       JOIN grades grade ON grade.id = d.grade_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC`,
      values
    );
    // Summarize all current requests and farmer offers; list filters do not alter dashboard totals.
    const summary = await getRequestSummary(req.user.id);
    return res.json({ summary, requests: rows.map((row) => formatRequest(row)) });
  } catch (error) {
    return logAndRespond(res, error);
  }
}

export async function getBuyerRequest(req, res) {
  try {
    // Reject malformed request identifiers before making any database query.
    const requestId = validateRequestId(req.params.requestId);
    const farmerId = req.user.id;

    // Load the request and its current match/latest-offer fields for the detail view.
    const result = await pool.query(
      `SELECT d.id, d.crop_id, d.grade_id, buyer.name AS buyer_name, crop.name AS crop_name, grade.name AS grade_name,
         d.destination_district, d.quantity_kg, d.delivery_from::text AS delivery_from,
         d.delivery_until::text AS delivery_until, d.budget_cents,
         CASE WHEN d.budget_cents IS NULL THEN NULL
              ELSE ROUND(d.budget_cents::numeric / NULLIF(d.quantity_kg, 0)) END AS max_price_per_kg_cents,
         d.expires_at, (d.expires_at <= NOW() + INTERVAL '48 hours') AS closing_soon,
         d.destination, d.allow_partial,
         EXISTS (
           SELECT 1
           FROM harvest_batches hb
           JOIN batch_availability ba ON ba.batch_id = hb.id
           WHERE hb.farmer_id = $2
             AND hb.crop_id = d.crop_id
             AND hb.grade_id = d.grade_id
             AND hb.status IN ('ready', 'harvested')
             AND ba.available_kg > 0
         ) AS has_matching_stock,
         (SELECT o.status
          FROM offers o
          WHERE o.demand_id = d.id AND o.farmer_id = $2
          ORDER BY o.created_at DESC
          LIMIT 1) AS my_offer_status
       FROM demands d
       JOIN users buyer ON buyer.id = d.buyer_id
       JOIN crops crop ON crop.id = d.crop_id
       JOIN grades grade ON grade.id = d.grade_id
       WHERE d.id = $1`,
      [requestId, farmerId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Request not found' });

    // Return only this farmer's available batches matching the request's crop and grade.
    const batchResult = await pool.query(
      `SELECT hb.id, ba.available_kg, hb.actual_harvest_date::text AS actual_harvest_date
       FROM harvest_batches hb
       JOIN batch_availability ba ON ba.batch_id = hb.id
       WHERE hb.farmer_id = $1
         AND hb.crop_id = $2
         AND hb.grade_id = $3
         AND hb.status IN ('ready', 'harvested')
         AND ba.available_kg > 0
       ORDER BY hb.actual_harvest_date DESC NULLS LAST`,
      [farmerId, result.rows[0].crop_id, result.rows[0].grade_id]
    );

    // Fetch optional offer fields only when the deployed schema contains them.
    const optionalColumns = await getOfferOptionalColumns();
    const myOfferResult = await pool.query(
      `SELECT o.id, o.demand_id AS request_id, o.quantity_kg, o.unit_price_cents,
         ROUND(o.quantity_kg * o.unit_price_cents) AS total_cents, o.status, o.created_at
         ${offerOptionalSelect(optionalColumns)}
       FROM offers o
       WHERE o.demand_id = $1 AND o.farmer_id = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [requestId, farmerId]
    );
    const matchingBatches = batchResult.rows.map((batch) => ({
      id: batch.id,
      batchCode: `HB-${String(batch.id).slice(0, 4).toUpperCase()}`,
      availableKg: Number(batch.available_kg),
      harvestDate: batch.actual_harvest_date,
    }));
    return res.json({
      request: formatRequest(result.rows[0], true),
      matchingBatches,
      myOffer: formatOffer(myOfferResult.rows[0], true),
    });
  } catch (error) {
    return logAndRespond(res, error);
  }
}

export async function createOffer(req, res) {
  let client;
  let transactionStarted = false;
  try {
    // Validate identifiers and raw numeric/date/note inputs before acquiring a database connection.
    const requestId = validateRequestId(req.params.requestId);
    const input = validateOfferInput(req.body);
    const farmerId = req.user.id;
    const headerKey = req.get('Idempotency-Key');
    // Validate explicit keys before using them to identify a repeated offer operation.
    validateIdempotencyKey(headerKey);
    const operationKey = `ym10:${farmerId}:${headerKey || crypto.randomUUID()}`;
    const optionalColumns = await getOfferOptionalColumns();
    const optionalNames = [];
    const optionalValues = [];
    if (optionalColumns.availableFrom && input.availableFrom) {
      optionalNames.push('available_from');
      optionalValues.push(input.availableFrom);
    }
    if (optionalColumns.notes && input.notes !== null) {
      optionalNames.push('notes');
      optionalValues.push(input.notes);
    }

    client = await pool.connect();
    // Begin a transaction so the request, batch stock, and duplicate-offer checks stay consistent.
    await client.query('BEGIN');
    transactionStarted = true;

    // Lock the request to serialize concurrent offers against the same demand.
    const demandResult = await client.query(
      `SELECT id, crop_id, grade_id, delivery_until::text AS delivery_until, expires_at, status
       FROM demands
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    const demand = demandResult.rows[0];
    if (!demand) throw new HttpError(404, 'Request not found');
    if (demand.status !== 'open' || new Date(demand.expires_at).getTime() <= Date.now()) {
      throw new HttpError(409, 'Request is closed');
    }
    // Both dates are YYYY-MM-DD strings, so comparison avoids timezone conversion entirely.
    if (input.availableFrom && input.availableFrom > demand.delivery_until) {
      throw new HttpError(400, 'availableFrom cannot be after the request delivery date');
    }

    // Return a prior result for a repeated key before checking whether its batch is still available.
    const existingResult = await client.query(
      `SELECT o.id, o.demand_id AS request_id, o.quantity_kg, o.unit_price_cents,
         ROUND(o.quantity_kg * o.unit_price_cents) AS total_cents, o.status, o.created_at
         ${offerOptionalSelect(optionalColumns)}
       FROM offers o
       WHERE o.operation_key = $1`,
      [operationKey]
    );
    if (existingResult.rows[0]) {
      if (existingResult.rows[0].request_id !== requestId) {
        throw new HttpError(409, 'Idempotency key has already been used');
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return res.status(200).json({ offer: formatOffer(existingResult.rows[0], true) });
    }

    // Lock the batch row, then enforce farmer ownership, usable status, and crop/grade compatibility.
    const batchResult = await client.query(
      `SELECT id, farmer_id, crop_id, grade_id, status
       FROM harvest_batches
       WHERE id = $1
       FOR UPDATE`,
      [input.batchId]
    );
    const batch = batchResult.rows[0];
    if (!batch || batch.farmer_id !== farmerId) throw new HttpError(404, 'Batch not found');
    if (!['ready', 'harvested'].includes(batch.status)
      || batch.crop_id !== demand.crop_id
      || batch.grade_id !== demand.grade_id) {
      throw new HttpError(400, 'Batch must be ready or harvested and match the request crop and grade');
    }

    // Read the locked batch's available quantity and reject offers that exceed current stock.
    const availabilityResult = await client.query(
      'SELECT available_kg FROM batch_availability WHERE batch_id = $1',
      [input.batchId]
    );
    const availableKg = availabilityResult.rows[0] ? Number(availabilityResult.rows[0].available_kg) : 0;
    if (input.quantityKg > availableKg) {
      throw new HttpError(400, `quantityKg exceeds available stock (${availableKg} kg available)`);
    }

    // Prevent multiple pending offers by the same farmer for one request.
    const pendingResult = await client.query(
      `SELECT id
       FROM offers
       WHERE demand_id = $1 AND farmer_id = $2 AND status = 'pending'
       LIMIT 1`,
      [requestId, farmerId]
    );
    if (pendingResult.rows[0]) throw new HttpError(409, 'You already have a pending offer for this request');

    // Insert the offer with the request expiry and optional columns supported by this database.
    const insertColumns = ['demand_id', 'farmer_id', 'batch_id', 'quantity_kg', 'unit_price_cents', 'expires_at', 'status', 'operation_key', ...optionalNames];
    const insertValues = [requestId, farmerId, input.batchId, input.quantityKgRaw, input.pricePerKgCents, demand.expires_at, 'pending', operationKey, ...optionalValues];
    const placeholders = insertValues.map((_, index) => `$${index + 1}`);
    const offerResult = await client.query(
      `INSERT INTO offers (${insertColumns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (operation_key) DO NOTHING
       RETURNING id, demand_id AS request_id, quantity_kg, unit_price_cents,
         ROUND(quantity_kg * unit_price_cents) AS total_cents, status, created_at
         ${offerOptionalSelect(optionalColumns, '')}`,
      insertValues
    );
    if (!offerResult.rows[0]) {
      // Resolve an idempotency key inserted concurrently by another transaction.
      const concurrentResult = await client.query(
        `SELECT o.id, o.demand_id AS request_id, o.quantity_kg, o.unit_price_cents,
           ROUND(o.quantity_kg * o.unit_price_cents) AS total_cents, o.status, o.created_at
           ${offerOptionalSelect(optionalColumns)}
         FROM offers o
         WHERE o.operation_key = $1`,
        [operationKey]
      );
      if (!concurrentResult.rows[0] || concurrentResult.rows[0].request_id !== requestId) {
        throw new HttpError(409, 'Idempotency key has already been used');
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return res.status(200).json({ offer: formatOffer(concurrentResult.rows[0], true) });
    }
    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json({ offer: formatOffer(offerResult.rows[0], true) });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('YM10 offer rollback failed:', rollbackError);
      }
    }
    return logAndRespond(res, error);
  } finally {
    if (client) client.release();
  }
}

export async function listMyOffers(req, res) {
  try {
    // Validate list filters, including the supported offer states, before querying.
    const filters = validateOfferFilters(req.query);
    const optionalColumns = await getOfferOptionalColumns();
    const values = [req.user.id];
    const conditions = ['o.farmer_id = $1'];
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`o.status = $${values.length}`);
    }
    if (filters.search) {
      const searchIndex = values.length + 1;
      const offerCodeSearch = filters.search.replace(/^of-/i, '');
      values.push(`%${escapeLikeWildcards(filters.search)}%`);
      values.push(`%${escapeLikeWildcards(offerCodeSearch)}%`);
      conditions.push(`(buyer.name ILIKE $${searchIndex}
        OR crop.name ILIKE $${searchIndex}
        OR o.id::text ILIKE $${searchIndex + 1})`);
    }

    // Fetch this farmer's matching offers and compute each rounded total in cents.
    const { rows } = await pool.query(
      `SELECT o.id, o.demand_id AS request_id, d.id AS demand_id,
         buyer.name AS buyer_name, crop.name AS crop_name, grade.name AS grade_name,
         o.quantity_kg, o.unit_price_cents,
         ROUND(o.quantity_kg * o.unit_price_cents) AS total_cents,
         o.status, o.created_at
         ${offerOptionalSelect(optionalColumns)}
       FROM offers o
       JOIN demands d ON d.id = o.demand_id
       JOIN users buyer ON buyer.id = d.buyer_id
       JOIN crops crop ON crop.id = d.crop_id
       JOIN grades grade ON grade.id = d.grade_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC`,
      values
    );

    // Count each status and sum rounded offer totals across all of this farmer's offers.
    const summaryResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
         COUNT(*) FILTER (WHERE status = 'withdrawn') AS withdrawn,
         COUNT(*) FILTER (WHERE status = 'expired') AS expired,
         COALESCE(SUM(ROUND(quantity_kg * unit_price_cents)), 0) AS total_offered_cents,
         COUNT(*) AS offer_count
       FROM offers
       WHERE farmer_id = $1`,
      [req.user.id]
    );
    const totals = summaryResult.rows[0];
    const offers = rows.map((row) => ({
      id: row.id,
      offerCode: `OF-${String(row.id).slice(0, 6).toUpperCase()}`,
      requestId: row.request_id,
      requestCode: `BR-${String(row.demand_id).slice(0, 8).toUpperCase()}`,
      buyerName: row.buyer_name,
      cropName: row.crop_name,
      gradeName: row.grade_name,
      quantityKg: Number(row.quantity_kg),
      pricePerKgCents: Number(row.unit_price_cents),
      totalCents: Number(row.total_cents),
      status: row.status,
      createdAt: row.created_at,
      ...(optionalColumns.availableFrom ? { availableFrom: row.availableFrom } : {}),
      ...(optionalColumns.notes ? { notes: row.notes } : {}),
    }));
    return res.json({
      summary: {
        pending: Number(totals.pending),
        accepted: Number(totals.accepted),
        rejected: Number(totals.rejected),
        withdrawn: Number(totals.withdrawn),
        expired: Number(totals.expired),
        totalOfferedCents: Number(totals.total_offered_cents),
        offerCount: Number(totals.offer_count),
      },
      offers,
    });
  } catch (error) {
    return logAndRespond(res, error);
  }
}

export async function getStatus(req, res) {
  try {
    // Keep the existing status behavior and use the authenticated farmer id.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ message: 'Account is not approved' });
    return res.json({ module: 'YM10', owner: 'Kasuni Madeesha', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('YM10 status lookup failed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
