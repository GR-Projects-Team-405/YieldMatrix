import pool from '../../config/db.js';
// YM17 · Nimesh De Alwis · Farmer allocations
// Task 01A: two read-only endpoints (allocation inbox list + summary cards).
// Every query is parameterised and scoped to req.user.id; no writes, no expiry side effects.

// Mirrors the allocations.status CHECK constraint in backend/database/schema.sql.
const ALLOCATION_STATUSES = Object.freeze([
  'held', 'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted',
  'partially_accepted', 'disputed', 'resolved', 'declined', 'expired', 'cancelled',
]);

// Whitelisted sort keys. Values are static SQL fragments, never raw user input.
const SORTS = Object.freeze({
  newest: 'a.created_at DESC, a.id DESC',
  oldest: 'a.created_at ASC, a.id ASC',
  expiry: 'r.expires_at ASC NULLS LAST, a.created_at DESC, a.id DESC',
});

// Provisional only: the schema defines a 30 minute reservation window but no
// "expiring soon" rule. Requires product confirmation before release.
// Cards must be counted with the DB clock (now()), never the API server clock.
const EXPIRING_SOON_MINUTES = 10;

// Statuses that mean the farmer already accepted and fulfilment moved on.
// KNOWN LIMITATION (documented, deliberately unchanged): the schema keeps no
// historical decision trail, so an allocation's status only shows its CURRENT
// state. We therefore count every non-terminal accepted/fulfilment status once
// (single-valued status => no double counting). disputed/resolved are excluded
// because we cannot prove from current state alone that acceptance happened.
// Revisit once reliable historical decision information exists.
const ACCEPTED_STATUSES = Object.freeze([
  'supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted', 'partially_accepted',
]);

// Highest OFFSET we will ever send to PostgreSQL. Keeps (page - 1) * limit far
// below the int64 boundary and inside Number.MAX_SAFE_INTEGER.
const MAX_OFFSET = 10_000_000;

const MAX_SEARCH_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared FROM clause: every join is at most one row, so no allocation can duplicate.
// The lateral reservation pick prefers the authoritative active hold, then the most
// recent one, and always LIMIT 1 so the cardinality stays one.
const BASE_FROM = `
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  JOIN users u ON u.id = o.buyer_id
  JOIN harvest_batches hb ON hb.id = a.batch_id AND hb.farmer_id = a.farmer_id
  JOIN crops c ON c.id = hb.crop_id
  JOIN grades g ON g.id = hb.grade_id
  LEFT JOIN LATERAL (
    SELECT rr.status, rr.expires_at
    FROM reservations rr
    WHERE rr.allocation_id = a.id
    ORDER BY (rr.status = 'active') DESC, rr.created_at DESC
    LIMIT 1
  ) r ON true`;

/* ----------------------------- small helpers ----------------------------- */

function badRequest(req, res, message) {
  return res.status(400).json({ error: message, requestId: req.requestId });
}

// Existing approved-account rule, reused by all three YM17 endpoints.
async function getApprovedFarmer(req) {
  const { rows } = await pool.query(
    'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
    [req.user.id, req.user.role, 'approved'],
  );
  return rows[0] || null;
}

function parsePositiveInt(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

// Empty/whitespace-only optional filters are treated exactly like an omitted
// filter, so "?status=" and no ?status behave identically. Non-string values
// (repeated params such as ?status=a&status=b) are still rejected.
// The frontend should prefer omitting unused filters entirely.
function readOptionalString(raw) {
  if (raw === undefined) return { value: null };
  if (typeof raw !== 'string') return { error: 'must be a single value' };
  const value = raw.trim();
  return { value: value === '' ? null : value };
}

// Makes user text a literal substring instead of letting % and _ act as wildcards.
function escapeLike(value) {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

/* ------------------------------- endpoint 1 ------------------------------ */

function mapAllocationRow(row) {
  return {
    allocationId: row.id,
    allocationReference: row.operation_key,
    orderId: row.order_id,
    orderReference: row.order_operation_key,
    buyerName: row.buyer_name,
    batchId: row.batch_id,
    cropName: row.crop_name,
    gradeName: row.grade_name,
    agreedKg: row.agreed_kg,
    agreedUnitPriceCents: row.agreed_unit_price_cents,
    agreedValueCents: row.agreed_value_cents,
    status: row.status,
    reservationStatus: row.reservation_status ?? null,
    reservationExpiresAt: row.reservation_expires_at ? toIso(row.reservation_expires_at) : null,
    createdAt: toIso(row.created_at),
  };
}

export async function getAllocations(req, res, next) {
  try {
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    // ---- validate query parameters (reject instead of silently coercing) ----
    const pageInput = readOptionalString(req.query.page);
    if (pageInput.error) return badRequest(req, res, `page ${pageInput.error}`);
    const page = pageInput.value === null ? 1 : parsePositiveInt(pageInput.value);
    if (page === null) return badRequest(req, res, 'page must be a positive integer');

    const limitInput = readOptionalString(req.query.limit);
    if (limitInput.error) return badRequest(req, res, `limit ${limitInput.error}`);
    const limit = limitInput.value === null ? 10 : parsePositiveInt(limitInput.value);
    if (limit === null || limit > 100) {
      return badRequest(req, res, 'limit must be a positive integer no greater than 100');
    }

    // Validate the offset arithmetic before any query runs: (page - 1) * limit
    // must be a safe non-negative integer, otherwise OFFSET could wrap silently
    // into a completely different (and wrong) page of results.
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
      return badRequest(req, res, 'page is too large for the requested limit');
    }

    const statusInput = readOptionalString(req.query.status);
    if (statusInput.error) return badRequest(req, res, `status ${statusInput.error}`);
    const status = statusInput.value;
    if (status !== null && !ALLOCATION_STATUSES.includes(status)) {
      return badRequest(req, res, `status must be one of: ${ALLOCATION_STATUSES.join(', ')}`);
    }

    const sortInput = readOptionalString(req.query.sort);
    if (sortInput.error) return badRequest(req, res, `sort ${sortInput.error}`);
    const sort = sortInput.value === null ? 'newest' : sortInput.value.toLowerCase();
    if (!SORTS[sort]) return badRequest(req, res, 'sort must be one of: newest, oldest, expiry');

    const searchInput = readOptionalString(req.query.search);
    if (searchInput.error) return badRequest(req, res, `search ${searchInput.error}`);
    const search = searchInput.value;
    if (search !== null && search.length > MAX_SEARCH_LENGTH) {
      return badRequest(req, res, `search must be at most ${MAX_SEARCH_LENGTH} characters`);
    }

    // Crop filter is validated against the real crops table, by id or by name.
    let cropId = null;
    const cropInput = readOptionalString(req.query.crop);
    if (cropInput.error) return badRequest(req, res, `crop ${cropInput.error}`);
    if (cropInput.value !== null) {
      const crop = cropInput.value;
      if (crop.length > MAX_SEARCH_LENGTH) {
        return badRequest(req, res, 'crop must be an existing crop id or name');
      }
      const { rows } = await pool.query(
        UUID_PATTERN.test(crop)
          ? 'SELECT id FROM crops WHERE id = $1'
          : 'SELECT id FROM crops WHERE lower(name) = lower($1)',
        [crop],
      );
      if (!rows[0]) return badRequest(req, res, 'crop does not match an existing crop');
      cropId = rows[0].id;
    }

    // ---- build one WHERE clause shared by the list and the count ----
    const params = [req.user.id];
    let where = 'WHERE a.farmer_id = $1';
    if (status) {
      params.push(status);
      where += ` AND a.status = $${params.length}`;
    }
    if (cropId) {
      params.push(cropId);
      where += ` AND c.id = $${params.length}`;
    }
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      const index = params.length;
      where += ` AND (a.operation_key ILIKE $${index} ESCAPE '!'`
        + ` OR a.id::text ILIKE $${index} ESCAPE '!'`
        + ` OR u.name ILIKE $${index} ESCAPE '!'`
        + ` OR c.name ILIKE $${index} ESCAPE '!')`;
    }

    const { rows: countRows } = await pool.query(
      `SELECT count(*) AS total ${BASE_FROM} ${where}`,
      params,
    );
    const total = Number(countRows[0].total);

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.operation_key,
         a.order_id,
         o.operation_key AS order_operation_key,
         u.name AS buyer_name,
         a.batch_id,
         c.name AS crop_name,
         g.name AS grade_name,
         a.agreed_kg,
         a.agreed_unit_price_cents,
         a.agreed_value_cents,
         a.status,
         a.created_at,
         r.status AS reservation_status,
         r.expires_at AS reservation_expires_at
       ${BASE_FROM}
       ${where}
       ORDER BY ${SORTS[sort]}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
    );

    return res.json({
      allocations: rows.map(mapAllocationRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------- endpoint 2 ------------------------------ */

export async function getSummary(req, res, next) {
  try {
    const farmer = await getApprovedFarmer(req);
    if (!farmer) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    // One pass over the farmer's allocations; FILTER keeps each card a single
    // count and guarantees an allocation can never be counted twice per card.
    // The lateral subquery only ever returns an ACTIVE reservation, so a
    // non-null r.expires_at means "has an active hold".
    //   pending    = held AND that active hold has not expired yet
    //   expiring   = pending AND the hold expires within the 10 minute window
    //                (strictly in the future, so overdue/past holds are excluded)
    //   accepted   = accepted-status set only, per the limitation noted above
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE a.status = 'held'
             AND r.expires_at IS NOT NULL
             AND r.expires_at > now()
         ) AS pending_responses,
         COUNT(*) FILTER (WHERE a.status IN ('${ACCEPTED_STATUSES.join("', '")}')) AS accepted_allocations,
         COUNT(*) FILTER (WHERE a.status = 'declined') AS declined_allocations,
         COUNT(*) FILTER (
           WHERE a.status = 'held'
             AND r.expires_at IS NOT NULL
             AND r.expires_at > now()
             AND r.expires_at <= now() + make_interval(mins => $2::int)
         ) AS expiring_soon
       FROM allocations a
       LEFT JOIN LATERAL (
         SELECT rr.expires_at
         FROM reservations rr
         WHERE rr.allocation_id = a.id AND rr.status = 'active'
         LIMIT 1
       ) r ON true
       WHERE a.farmer_id = $1`,
      [req.user.id, EXPIRING_SOON_MINUTES],
    );

    const row = rows[0];
    return res.json({
      summary: {
        pendingResponses: Number(row.pending_responses),
        acceptedAllocations: Number(row.accepted_allocations),
        declinedAllocations: Number(row.declined_allocations),
        expiringSoon: Number(row.expiring_soon),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------- status --------------------------------- */

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const user = await getApprovedFarmer(req);
    if (!user) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM17', owner: 'Nimesh De Alwis', status: 'scaffold', user, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}
