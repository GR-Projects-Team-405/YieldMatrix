import { createHash } from 'node:crypto';
import pool from '../../config/db.js';
// YM23 · Sandeepa Subashini · Pickup management

const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pickupTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parseKilograms(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;

  const match = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/.exec(String(value));
  if (!match) return null;

  const milliKg = Number(match[1]) * 1000 + Number((match[2] || '').padEnd(3, '0'));
  if (!Number.isSafeInteger(milliKg) || milliKg >= 1000000000000) return null;

  return {
    milliKg,
    decimal: `${match[1]}.${(match[2] || '').padEnd(3, '0')}`,
  };
}

function kilogramsFromMilli(milliKg) {
  return Number((milliKg / 1000).toFixed(3));
}

function pickupStopSummary(row, pickedUpMilli, status) {
  const committedMilli = parseKilograms(row.committedKg).milliKg;
  return {
    id: row.id,
    status,
    committedKg: kilogramsFromMilli(committedMilli),
    pickedUpKg: kilogramsFromMilli(pickedUpMilli),
    remainingKg: kilogramsFromMilli(committedMilli - pickedUpMilli),
  };
}

function isUniqueViolation(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function rollbackAndRespond(client, res, status, error, requestId, additional = {}) {
  await client.query('ROLLBACK');
  return res.status(status).json({ error, ...additional, requestId });
}

export async function getPickupStops(req, res, next) {
  try {
    const approval = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved'],
    );
    if (!approval.rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    const { rows } = await pool.query(
      `SELECT
         ts.id,
         ts.sequence,
         f.name AS "farmName",
         farmer.name AS "farmerName",
         f.district,
         c.name AS crop,
         a.committed_kg AS "committedKg",
         ts.scheduled_at AS "pickupTime",
         CASE ts.status
           WHEN 'picked_up' THEN 'completed'
           ELSE ts.status
         END AS status
       FROM trip_stops ts
       JOIN trips t
         ON t.id = ts.trip_id AND t.order_id = ts.order_id
       JOIN allocations a
         ON a.id = ts.allocation_id AND a.order_id = ts.order_id
       JOIN harvest_batches b
         ON b.id = a.batch_id AND b.farmer_id = a.farmer_id
       JOIN farms f
         ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN users farmer
         ON farmer.id = f.farmer_id
       JOIN crops c
         ON c.id = b.crop_id
       WHERE t.driver_id = $1
         AND t.status IN ('assigned', 'in_progress')
       ORDER BY t.scheduled_start, ts.sequence, ts.id`,
      [req.user.id],
    );

    return res.json({
      stops: rows.map((row) => ({
        ...row,
        committedKg: Number(row.committedKg),
        pickupTime: row.pickupTime ?? 'Not scheduled',
      })),
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function getPickupStopDetails(req, res, next) {
  try {
    const approval = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved'],
    );
    if (!approval.rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });

    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(req.params.stopId)) {
      return res.status(404).json({ error: 'Pickup stop not found', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `SELECT
         ts.id,
         ts.sequence,
         f.name AS "farmName",
         farmer.name AS "farmerName",
         concat(f.pickup_address, ', ', f.district) AS district,
         c.name AS crop,
         a.committed_kg AS "committedKg",
         a.picked_up_kg AS "pickedUpKg",
         to_char(ts.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD, HH12:MI AM') AS "pickupTime",
         ts.status
       FROM trip_stops ts
       JOIN trips t
         ON t.id = ts.trip_id AND t.order_id = ts.order_id
       JOIN allocations a
         ON a.id = ts.allocation_id AND a.order_id = ts.order_id
       JOIN harvest_batches b
         ON b.id = a.batch_id AND b.farmer_id = a.farmer_id
       JOIN farms f
         ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN users farmer
         ON farmer.id = f.farmer_id
       JOIN crops c
         ON c.id = b.crop_id
       WHERE ts.id = $1::uuid
         AND t.driver_id = $2`,
      [req.params.stopId, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pickup stop not found', requestId: req.requestId });

    const committedKg = Number(rows[0].committedKg);
    const pickedUpKg = Number(rows[0].pickedUpKg);
    const stop = {
      ...rows[0],
      committedKg,
      pickedUpKg,
      remainingKg: committedKg - pickedUpKg,
      pickupTime: rows[0].pickupTime ?? 'Not scheduled',
    };
    return res.json({ stop, requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getPickupHistory(req, res, next) {
  try {
    const approval = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, 'driver', 'approved'],
    );
    if (!approval.rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `WITH pickup_event_history AS (
         SELECT
           ce.id,
           ce.allocation_id,
           ce.trip_id,
           ce.order_id,
           ce.actor_id,
           ce.quantity_kg,
           ce.occurred_at,
           ce.recorded_at,
           SUM(ce.quantity_kg) OVER (
             PARTITION BY ce.allocation_id
             ORDER BY ce.occurred_at, ce.recorded_at, ce.id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS cumulative_picked_up_kg
         FROM custody_events ce
         WHERE ce.event_type = 'pickup'
           AND ce.quantity_kg > 0
       )
       SELECT
         peh.id AS "eventId",
         peh.occurred_at AS "occurredAt",
         peh.quantity_kg::text AS "quantityKg",
         peh.cumulative_picked_up_kg::text AS "cumulativePickedUpKg",
         f.name AS "farmName",
         f.pickup_address AS "pickupAddress",
         f.district,
         farmer.name AS "farmerName",
         c.name AS "cropType",
         o.id AS "orderId",
         t.id AS "tripId",
         ts.id AS "stopId",
         ts.sequence AS "stopSequence",
         a.committed_kg::text AS "committedKg",
         ts.status AS "currentStopStatus"
       FROM pickup_event_history peh
       JOIN trips t
         ON t.id = peh.trip_id AND t.order_id = peh.order_id
       JOIN orders o
         ON o.id = peh.order_id
       JOIN allocations a
         ON a.id = peh.allocation_id AND a.order_id = peh.order_id
       LEFT JOIN trip_stops ts
         ON ts.trip_id = peh.trip_id
        AND ts.order_id = peh.order_id
        AND ts.allocation_id = peh.allocation_id
       JOIN harvest_batches b
         ON b.id = a.batch_id AND b.farmer_id = a.farmer_id
       JOIN farms f
         ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN users farmer
         ON farmer.id = f.farmer_id
       JOIN crops c
         ON c.id = b.crop_id
       WHERE peh.actor_id = $1
       ORDER BY peh.occurred_at DESC, peh.recorded_at DESC, peh.id DESC`,
      [req.user.id],
    );

    return res.json({
      records: rows.map((row) => ({
        ...row,
        quantityKg: Number(row.quantityKg),
        cumulativePickedUpKg: Number(row.cumulativePickedUpKg),
        committedKg: Number(row.committedKg),
        currentStopStatus: row.currentStopStatus ?? null,
      })),
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function recordPickup(req, res, next) {
  const stopId = req.params.stopId;
  if (!uuidPattern.test(stopId)) {
    return res.status(404).json({ error: 'Pickup stop not found', requestId: req.requestId });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'A valid pickup request is required', requestId: req.requestId });
  }

  const { outcome } = req.body;
  if (outcome !== 'collected' && outcome !== 'unable_to_collect') {
    return res.status(400).json({ error: 'Outcome must be collected or unable_to_collect', requestId: req.requestId });
  }

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || !uuidPattern.test(idempotencyKey)) {
    return res.status(400).json({ error: 'A valid Idempotency-Key header is required', requestId: req.requestId });
  }
  const operationKey = `ym23-pickup:${createHash('sha256').update(`${req.user.id.toLowerCase()}:${idempotencyKey.toLowerCase()}`).digest('hex')}`;

  let quantity;
  let occurredAt;
  if (outcome === 'collected') {
    quantity = parseKilograms(req.body.quantityKg);
    if (!quantity || quantity.milliKg <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero with at most three decimal places', requestId: req.requestId });
    }

    const pickupTime = req.body.occurredAt;
    if (typeof pickupTime !== 'string' || !pickupTimePattern.test(pickupTime)) {
      return res.status(400).json({ error: 'A valid pickup date and time is required', requestId: req.requestId });
    }
    const parsedPickupTime = new Date(pickupTime);
    if (Number.isNaN(parsedPickupTime.getTime()) || parsedPickupTime.toISOString() !== pickupTime) {
      return res.status(400).json({ error: 'A valid pickup date and time is required', requestId: req.requestId });
    }
    occurredAt = pickupTime;
  }

  let client;
  let transactionStarted = false;
  let releaseError;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const approval = await client.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND approval_status = $3 FOR SHARE',
      [req.user.id, 'driver', 'approved'],
    );
    if (!approval.rows[0]) {
      return await rollbackAndRespond(client, res, 403, 'Account is not approved', req.requestId);
    }

    const batchResult = await client.query(
      `SELECT b.id
       FROM trip_stops ts
       JOIN trips t
         ON t.id = ts.trip_id AND t.order_id = ts.order_id
       JOIN allocations a
         ON a.id = ts.allocation_id AND a.order_id = ts.order_id
       JOIN harvest_batches b
         ON b.id = a.batch_id AND b.farmer_id = a.farmer_id
       WHERE ts.id = $1::uuid
         AND t.driver_id = $2
       FOR UPDATE OF b`,
      [stopId, req.user.id],
    );
    if (!batchResult.rows[0]) {
      return await rollbackAndRespond(client, res, 404, 'Pickup stop not found', req.requestId);
    }

    const stopResult = await client.query(
      `SELECT
         ts.id,
         ts.trip_id AS "tripId",
         ts.order_id AS "orderId",
         ts.allocation_id AS "allocationId",
         ts.status AS "stopStatus",
         t.status AS "tripStatus",
         a.committed_kg::text AS "committedKg",
         a.picked_up_kg::text AS "pickedUpKg",
         a.status AS "allocationStatus"
       FROM trip_stops ts
       JOIN trips t
         ON t.id = ts.trip_id AND t.order_id = ts.order_id
       JOIN allocations a
         ON a.id = ts.allocation_id AND a.order_id = ts.order_id
       WHERE ts.id = $1::uuid
         AND t.driver_id = $2
       FOR UPDATE OF ts, t, a`,
      [stopId, req.user.id],
    );
    const stop = stopResult.rows[0];
    if (!stop) {
      return await rollbackAndRespond(client, res, 404, 'Pickup stop not found', req.requestId);
    }

    const committed = parseKilograms(stop.committedKg);
    const pickedUp = parseKilograms(stop.pickedUpKg);
    if (!committed || !pickedUp || pickedUp.milliKg > committed.milliKg) {
      return await rollbackAndRespond(client, res, 409, 'Pickup quantities are inconsistent; contact support', req.requestId);
    }

    const previousEvent = await client.query(
      `SELECT id, event_type AS "eventType", actor_id AS "actorId", trip_id AS "tripId", order_id AS "orderId",
              allocation_id AS "allocationId", quantity_kg::text AS "quantityKg", occurred_at AS "occurredAt"
       FROM custody_events
       WHERE operation_key = $1`,
      [operationKey],
    );
    if (previousEvent.rows[0]) {
      const event = previousEvent.rows[0];
      if (outcome === 'unable_to_collect') {
        return await rollbackAndRespond(client, res, 409, 'Idempotency key was already used for a different operation', req.requestId);
      }

      const sameSubmission = event.eventType === 'pickup'
        && event.actorId.toLowerCase() === req.user.id.toLowerCase()
        && event.tripId === stop.tripId
        && event.orderId === stop.orderId
        && event.allocationId === stop.allocationId
        && parseKilograms(event.quantityKg)?.milliKg === quantity.milliKg
        && new Date(event.occurredAt).getTime() === new Date(occurredAt).getTime();
      if (!sameSubmission) {
        return await rollbackAndRespond(client, res, 409, 'Idempotency key was already used for a different pickup', req.requestId);
      }

      await client.query('COMMIT');
      transactionStarted = false;
      return res.json({
        pickup: {
          id: event.id,
          quantityKg: kilogramsFromMilli(quantity.milliKg),
          occurredAt: event.occurredAt,
          duplicate: true,
        },
        stop: pickupStopSummary(stop, pickedUp.milliKg, stop.stopStatus),
        requestId: req.requestId,
      });
    }

    if (outcome === 'unable_to_collect' && stop.stopStatus === 'exception') {
      await client.query('COMMIT');
      transactionStarted = false;
      return res.json({
        pickup: null,
        stop: pickupStopSummary(stop, pickedUp.milliKg, 'exception'),
        requestId: req.requestId,
      });
    }

    if (stop.tripStatus !== 'assigned' && stop.tripStatus !== 'in_progress') {
      return await rollbackAndRespond(client, res, 409, 'Pickup is not available for this trip', req.requestId);
    }
    if (!['pending', 'exception'].includes(stop.stopStatus) || stop.allocationStatus !== 'committed') {
      return await rollbackAndRespond(client, res, 409, 'Pickup stop is no longer available', req.requestId);
    }

    if (outcome === 'unable_to_collect') {
      await client.query(
        'UPDATE trip_stops SET status = $1 WHERE id = $2::uuid',
        ['exception', stopId],
      );
      await client.query('COMMIT');
      transactionStarted = false;
      return res.json({
        pickup: null,
        stop: pickupStopSummary(stop, pickedUp.milliKg, 'exception'),
        requestId: req.requestId,
      });
    }

    const remainingMilliKg = committed.milliKg - pickedUp.milliKg;
    if (quantity.milliKg > remainingMilliKg) {
      return await rollbackAndRespond(
        client,
        res,
        409,
        `Collected quantity exceeds the remaining committed quantity (${kilogramsFromMilli(remainingMilliKg)} kg)`,
        req.requestId,
        { remainingKg: kilogramsFromMilli(remainingMilliKg) },
      );
    }

    const nextPickedUpMilliKg = pickedUp.milliKg + quantity.milliKg;
    const complete = nextPickedUpMilliKg === committed.milliKg;
    const allocationResult = await client.query(
      `UPDATE allocations
       SET picked_up_kg = picked_up_kg + $1::numeric,
           status = CASE
             WHEN picked_up_kg + $1::numeric = committed_kg THEN 'picked_up'
             ELSE status
           END
       WHERE id = $2::uuid
         AND order_id = $3::uuid
         AND status = 'committed'
       RETURNING committed_kg::text AS "committedKg", picked_up_kg::text AS "pickedUpKg"`,
      [quantity.decimal, stop.allocationId, stop.orderId],
    );
    if (!allocationResult.rows[0]) {
      return await rollbackAndRespond(client, res, 409, 'Allocation is no longer available for pickup', req.requestId);
    }

    if (complete) {
      await client.query(
        `UPDATE trip_stops
         SET completed_at = $1::timestamptz, status = 'picked_up'
         WHERE id = $2::uuid`,
        [occurredAt, stopId],
      );
    }

    const eventResult = await client.query(
      `INSERT INTO custody_events
         (allocation_id, trip_id, order_id, event_type, quantity_kg, actor_id, occurred_at, operation_key)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'pickup', $4::numeric, $5::uuid, $6::timestamptz, $7)
       RETURNING id, occurred_at AS "occurredAt"`,
      [stop.allocationId, stop.tripId, stop.orderId, quantity.decimal, req.user.id, occurredAt, operationKey],
    );

    await client.query('COMMIT');
    transactionStarted = false;

    const updatedAllocation = allocationResult.rows[0];
    const updatedPickedUp = parseKilograms(updatedAllocation.pickedUpKg);
    return res.status(201).json({
      pickup: {
        id: eventResult.rows[0].id,
        quantityKg: kilogramsFromMilli(quantity.milliKg),
        occurredAt: eventResult.rows[0].occurredAt,
        duplicate: false,
      },
      stop: pickupStopSummary(
        { ...stop, committedKg: updatedAllocation.committedKg },
        updatedPickedUp.milliKg,
        complete ? 'picked_up' : stop.stopStatus,
      ),
      requestId: req.requestId,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        releaseError = rollbackError;
        return next(rollbackError);
      }
    }
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Idempotency key was already used', requestId: req.requestId });
    }
    return next(error);
  } finally {
    if (client) client.release(releaseError);
  }
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM23', owner: 'Sandeepa Subashini', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
