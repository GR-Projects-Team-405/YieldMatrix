import pool from '../../config/db.js';
// YM25 · Shathir Sheriff · Traceability
const RECORD_SCOPE_BY_ROLE = {
  farmer: (userParam) => `hb.farmer_id = ${userParam}`,
  buyer: (userParam) => `EXISTS (
    SELECT 1
    FROM allocations scoped_allocation
    JOIN orders scoped_order ON scoped_order.id = scoped_allocation.order_id
    WHERE scoped_allocation.batch_id = hb.id
      AND scoped_order.buyer_id = ${userParam}
      AND scoped_order.status NOT IN ('cancelled', 'expired')
      AND scoped_allocation.status NOT IN ('cancelled', 'declined', 'expired')
  )`,
  driver: (userParam) => `EXISTS (
    SELECT 1
    FROM allocations scoped_allocation
    JOIN orders scoped_order ON scoped_order.id = scoped_allocation.order_id
    JOIN trip_stops scoped_stop ON scoped_stop.allocation_id = scoped_allocation.id
    JOIN trips scoped_trip ON scoped_trip.id = scoped_stop.trip_id
    WHERE scoped_allocation.batch_id = hb.id
      AND scoped_trip.driver_id = ${userParam}
      AND scoped_trip.status <> 'cancelled'
      AND scoped_order.status NOT IN ('cancelled', 'expired')
      AND scoped_allocation.status NOT IN ('cancelled', 'declined', 'expired')
  )`,
  admin: (userParam) => `${userParam}::uuid IS NOT NULL`,
};

const ALLOCATION_SCOPE_BY_ROLE = {
  farmer: (userParam) => `a.farmer_id = ${userParam}`,
  buyer: (userParam) => `o.buyer_id = ${userParam}`,
  driver: (userParam) => `t.driver_id = ${userParam}`,
  admin: (userParam) => `${userParam}::uuid IS NOT NULL`,
};

const TRACE_DATE_RANGES = new Set(['7', '30', '90', 'all']);
const TRACE_STATUSES = new Set(['all', 'Processing', 'In Transit', 'Verified', 'Delivered']);

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function badRequest(res, message, requestId) {
  return res.status(400).json({ error: message, requestId });
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isBatchIdentifier(value) {
  return isUuid(value) || (typeof value === 'string' && /^BM-\d{2,}$/.test(value));
}

async function getAuthorizedBatch(req, batchId) {
  const getScope = RECORD_SCOPE_BY_ROLE[req.user.role];
  if (!getScope) return null;
  const scope = getScope('$2');

  const { rows } = await pool.query(
    `SELECT
      hb.id,
      hb.display_id AS "displayId",
      c.name AS produce,
      g.name AS grade,
      f.name AS farm,
      f.district,
      COALESCE(hb.actual_harvest_date, hb.planned_harvest_date)::text AS "harvestDate",
      COALESCE(NULLIF(hb.sellable_kg, 0), hb.actual_kg, hb.planned_kg)::text AS "quantityKg",
      hb.status AS "batchStatus"
    FROM harvest_batches hb
    JOIN farms f ON f.id = hb.farm_id
    JOIN crops c ON c.id = hb.crop_id
    JOIN grades g ON g.id = hb.grade_id
    WHERE (hb.id::text = $1 OR hb.display_id = $1)
      AND hb.status <> 'cancelled'
      AND (${scope})
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = $2 AND u.role = $3 AND u.approval_status = 'approved'
      )`,
    [batchId, req.user.id, req.user.role],
  );
  return rows[0] || null;
}

export async function getRecords(req, res, next) {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 1000000);
    const limit = parsePositiveInteger(req.query.limit, 20, 100);
    if (page === null) return badRequest(res, 'page must be a positive integer no greater than 1000000', req.requestId);
    if (limit === null) return badRequest(res, 'limit must be a positive integer no greater than 100', req.requestId);

    const search = req.query.q;
    if (search !== undefined && (typeof search !== 'string' || search.trim().length > 100)) {
      return badRequest(res, 'q must be a string of at most 100 characters', req.requestId);
    }

    const dateRange = req.query.dateRange ?? '30';
    if (typeof dateRange !== 'string' || !TRACE_DATE_RANGES.has(dateRange)) {
      return badRequest(res, 'dateRange must be 7, 30, 90, or all', req.requestId);
    }

    const status = req.query.status ?? 'all';
    if (typeof status !== 'string' || !TRACE_STATUSES.has(status)) {
      return badRequest(res, 'status must be a valid trace status or all', req.requestId);
    }

    const getScope = RECORD_SCOPE_BY_ROLE[req.user.role];
    const getAllocationScope = ALLOCATION_SCOPE_BY_ROLE[req.user.role];
    if (!getScope || !getAllocationScope) return res.status(403).json({ error: 'Forbidden for this role', requestId: req.requestId });
    const scope = getScope('$1');
    const allocationScope = getAllocationScope('$1');

    const { rows: users } = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved'],
    );
    if (!users[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      `WITH scoped_batches AS (
        SELECT
          hb.id,
          hb.display_id AS "displayId",
          c.name AS produce,
          f.name AS farm,
          COALESCE(hb.actual_harvest_date, hb.planned_harvest_date)::text AS "harvestDate",
          COALESCE(NULLIF(hb.sellable_kg, 0), hb.actual_kg, hb.planned_kg)::text AS "quantityKg",
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM allocations a
              JOIN orders o ON o.id = a.order_id
              LEFT JOIN trip_stops ts ON ts.allocation_id = a.id
              LEFT JOIN trips t ON t.id = ts.trip_id
              WHERE a.batch_id = hb.id
                AND a.status NOT IN ('cancelled', 'declined', 'expired')
                AND o.status NOT IN ('cancelled', 'expired')
                AND (o.status IN ('delivered', 'closed') OR t.status = 'completed')
                AND (${allocationScope})
            ) THEN 'Delivered'
            WHEN EXISTS (
              SELECT 1
              FROM allocations a
              JOIN orders o ON o.id = a.order_id
              LEFT JOIN trip_stops ts ON ts.allocation_id = a.id
              LEFT JOIN trips t ON t.id = ts.trip_id
              WHERE a.batch_id = hb.id
                AND a.status NOT IN ('cancelled', 'declined', 'expired')
                AND o.status NOT IN ('cancelled', 'expired')
                AND (a.status IN ('picked_up', 'handed_over')
                  OR t.status IN ('in_progress', 'handed_over'))
                AND (${allocationScope})
            ) THEN 'In Transit'
            WHEN EXISTS (
              SELECT 1
              FROM allocations a
              JOIN orders o ON o.id = a.order_id
              LEFT JOIN trip_stops ts ON ts.allocation_id = a.id
              LEFT JOIN trips t ON t.id = ts.trip_id
              WHERE a.batch_id = hb.id
                AND a.status NOT IN ('cancelled', 'declined', 'expired')
                AND o.status NOT IN ('cancelled', 'expired')
                AND (a.status IN ('accepted', 'partially_accepted')
                  OR a.accepted_kg > 0)
                AND (${allocationScope})
            ) THEN 'Verified'
            ELSE 'Processing'
          END AS status
        FROM harvest_batches hb
        JOIN farms f ON f.id = hb.farm_id
        JOIN crops c ON c.id = hb.crop_id
        WHERE hb.status <> 'cancelled'
          AND (${scope})
          AND (
            $2::text IS NULL
            OR hb.display_id ILIKE '%' || $2 || '%'
            OR hb.id::text ILIKE '%' || $2 || '%'
            OR c.name ILIKE '%' || $2 || '%'
            OR f.name ILIKE '%' || $2 || '%'
          )
      ),
      filtered_batches AS (
        SELECT *
        FROM scoped_batches
        WHERE ($4::text = 'all' OR status = $4)
          AND CASE
            WHEN $3::text = 'all' THEN TRUE
            ELSE "harvestDate"::date >= CURRENT_DATE - (($3::integer - 1) * INTERVAL '1 day')
          END
      ),
      total AS (
        SELECT
          COUNT(*)::integer AS count,
          COUNT(*) FILTER (WHERE status = 'Delivered')::integer AS delivered,
          COUNT(*) FILTER (WHERE status = 'Verified')::integer AS verified
        FROM filtered_batches
      ),
      page_records AS (
        SELECT *
        FROM filtered_batches
        ORDER BY "harvestDate" DESC, id
        LIMIT $5 OFFSET $6
      )
      SELECT
        total.count,
        total.delivered,
        total.verified,
        COALESCE(
          json_agg(
            json_build_object(
              'id', page_records.id,
              'displayId', page_records."displayId",
              'produce', page_records.produce,
              'farm', page_records.farm,
              'harvestDate', page_records."harvestDate",
              'quantityKg', page_records."quantityKg",
              'status', page_records.status
            )
            ORDER BY page_records."harvestDate" DESC, page_records.id
          ) FILTER (WHERE page_records.id IS NOT NULL),
          '[]'::json
        ) AS records
      FROM total
      LEFT JOIN page_records ON TRUE
      GROUP BY total.count, total.delivered, total.verified`,
      [req.user.id, search?.trim() || null, dateRange, status, limit, offset],
    );

    const total = rows[0].count;
    return res.json({
      records: rows[0].records,
      summary: {
        total: rows[0].count,
        delivered: rows[0].delivered,
        verified: rows[0].verified,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function getBatchHistory(req, res, next) {
  try {
    const { batchId } = req.params;
    if (!isBatchIdentifier(batchId)) return badRequest(res, 'batchId must be a valid UUID or batch display ID', req.requestId);

    const batch = await getAuthorizedBatch(req, batchId);
    if (!batch) return res.status(404).json({ error: 'Trace record not found', requestId: req.requestId });
    const getAllocationScope = ALLOCATION_SCOPE_BY_ROLE[req.user.role];
    if (!getAllocationScope) return res.status(403).json({ error: 'Forbidden for this role', requestId: req.requestId });
    const allocationScope = getAllocationScope('$2');

    const { rows: traceEvents } = await pool.query(
      `SELECT
        te.id,
        te.event_type AS "eventType",
        te.public_payload AS "publicPayload",
        te.payload_hash AS "payloadHash",
        te.anchor_status AS "anchorStatus",
        te.local_demo AS "localDemo",
        te.occurred_at AS "occurredAt",
        te.recorded_at AS "recordedAt"
      FROM trace_events te
      WHERE te.batch_id = $1
        AND (
          te.allocation_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM allocations a
            JOIN orders o ON o.id = a.order_id
            LEFT JOIN trip_stops ts ON ts.allocation_id = a.id
            LEFT JOIN trips t ON t.id = ts.trip_id
            WHERE a.id = te.allocation_id
              AND (${allocationScope})
          )
        )
      ORDER BY te.occurred_at, te.id`,
      [batch.id, req.user.id],
    );

    const { rows: custodyEvents } = await pool.query(
      `SELECT
        ce.id,
        ce.event_type AS "eventType",
        ce.quantity_kg::text AS "quantityKg",
        ce.occurred_at AS "occurredAt",
        ce.recorded_at AS "recordedAt"
      FROM custody_events ce
      JOIN allocations a ON a.id = ce.allocation_id
      JOIN orders o ON o.id = ce.order_id
      LEFT JOIN trips t ON t.id = ce.trip_id
      WHERE a.batch_id = $1
        AND (${allocationScope})
        AND NOT EXISTS (
          SELECT 1
          FROM trace_events linked_event
          WHERE linked_event.custody_event_id = ce.id
        )
      ORDER BY ce.occurred_at, ce.id`,
      [batch.id, req.user.id],
    );

    const events = [
      ...traceEvents.map((event) => ({
        ...event,
        quantityKg: typeof event.publicPayload?.quantity_kg === 'string' ? event.publicPayload.quantity_kg : undefined,
        source: 'trace',
      })),
      ...custodyEvents.map((event) => ({ ...event, source: 'custody' })),
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    return res.json({
      batch: {
        id: batch.id,
        displayId: batch.displayId,
        produce: batch.produce,
        grade: batch.grade,
        farm: batch.farm,
        district: batch.district,
        harvestDate: batch.harvestDate,
        quantityKg: batch.quantityKg,
        status: batch.batchStatus,
      },
      events,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function getBatchVerification(req, res, next) {
  try {
    const { batchId } = req.params;
    if (!isBatchIdentifier(batchId)) return badRequest(res, 'batchId must be a valid UUID or batch display ID', req.requestId);

    const batch = await getAuthorizedBatch(req, batchId);
    if (!batch) return res.status(404).json({ error: 'Trace record not found', requestId: req.requestId });
    const getAllocationScope = ALLOCATION_SCOPE_BY_ROLE[req.user.role];
    if (!getAllocationScope) return res.status(403).json({ error: 'Forbidden for this role', requestId: req.requestId });
    const allocationScope = getAllocationScope('$2');

    const { rows: events } = await pool.query(
      `SELECT
        te.id,
        te.event_type AS "eventType",
        te.payload_hash AS "payloadHash",
        te.anchor_status AS "anchorStatus",
        te.local_demo AS "localDemo",
        te.chain_id AS "chainId",
        te.contract_reference AS "contractReference",
        te.transaction_hash AS "transactionHash",
        te.occurred_at AS "occurredAt",
        te.recorded_at AS "recordedAt"
      FROM trace_events te
      WHERE te.batch_id = $1
        AND (
          te.allocation_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM allocations a
            JOIN orders o ON o.id = a.order_id
            LEFT JOIN trip_stops ts ON ts.allocation_id = a.id
            LEFT JOIN trips t ON t.id = ts.trip_id
            WHERE a.id = te.allocation_id
              AND (${allocationScope})
          )
        )
      ORDER BY te.occurred_at, te.id`,
      [batch.id, req.user.id],
    );

    const localDemo = events.some((event) => event.localDemo);
    const verifiedCount = events.filter((event) => event.anchorStatus === 'verified' && !event.localDemo).length;
    const status = events.length === 0
      ? 'unavailable'
      : localDemo
        ? 'demo'
        : events.some((event) => event.anchorStatus === 'failed')
          ? 'failed'
          : events.some((event) => event.anchorStatus === 'pending' || event.anchorStatus === 'unanchored')
            ? 'pending'
            : verifiedCount === events.length
              ? 'verified'
              : 'unavailable';

    return res.json({
      batch: {
        id: batch.id,
        displayId: batch.displayId,
        produce: batch.produce,
        grade: batch.grade,
        farm: batch.farm,
        district: batch.district,
        harvestDate: batch.harvestDate,
        quantityKg: batch.quantityKg,
        status: batch.batchStatus,
      },
      verification: {
        status,
        isLiveVerification: status === 'verified',
        eventCount: events.length,
        lastUpdatedAt: events.reduce(
          (latest, event) => event.recordedAt > latest ? event.recordedAt : latest,
          null,
        ),
      },
      events,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM25', owner: 'Shathir Sheriff', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
