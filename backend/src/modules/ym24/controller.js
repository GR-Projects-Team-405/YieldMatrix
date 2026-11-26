import pool from '../../config/db.js';
// YM24 · Sasindu Lakshan · Delivery & incidents

const UUID_RE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const shortCode = (prefix, id) => `${prefix}${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

// Delivery status shown to the driver, worked out from the allocation rows.
function deliveryStatus(allocStatuses, handedOverKg, acceptedKg) {
  if (allocStatuses.includes('disputed')) return 'Disputed';
  if (acceptedKg < handedOverKg) return 'Partially accepted';
  return 'Completed';
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM24', owner: 'Sasindu Lakshan', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

// GET /api/ym24/deliveries: finished trips of the logged-in driver (newest first).
export async function listDeliveries(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id,
              o.destination,
              u.name AS buyer,
              v.registration AS vehicle,
              (SELECT max(ce.occurred_at) FROM custody_events ce
                 WHERE ce.trip_id = t.id AND ce.event_type = 'handover') AS delivered_at,
              COALESCE(SUM(a.picked_up_kg), 0)::float8 AS picked_up_kg,
              COALESCE(SUM(a.handed_over_kg), 0)::float8 AS handed_over_kg,
              COALESCE(SUM(a.accepted_kg), 0)::float8 AS accepted_kg,
              COUNT(DISTINCT hb.farm_id)::int AS farm_count,
              COALESCE(array_agg(a.status) FILTER (WHERE a.id IS NOT NULL), '{}') AS alloc_statuses
         FROM trips t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.buyer_id
         JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN trip_stops ts ON ts.trip_id = t.id
         LEFT JOIN allocations a ON a.id = ts.allocation_id
         LEFT JOIN harvest_batches hb ON hb.id = a.batch_id
        WHERE t.driver_id = $1 AND t.status IN ('handed_over', 'completed')
        GROUP BY t.id, o.destination, u.name, v.registration
        ORDER BY delivered_at DESC NULLS LAST
        LIMIT 200`,
      [req.user.id]
    );
    const trips = rows.map((r) => ({
      id: r.id,
      code: shortCode('YM ', r.id),
      destination: r.destination,
      buyer: r.buyer,
      farms: r.farm_count,
      vehicle: r.vehicle,
      deliveredAt: r.delivered_at,
      pickedUpKg: r.picked_up_kg,
      handedOverKg: r.handed_over_kg,
      acceptedKg: r.accepted_kg,
      status: deliveryStatus(r.alloc_statuses, r.handed_over_kg, r.accepted_kg),
    }));
    return res.json({ trips, requestId: req.requestId });
  } catch (error) { next(error); }
}

// GET /api/ym24/deliveries/:tripId: one trip, only if it belongs to this driver.
export async function getDelivery(req, res, next) {
  try {
    const { tripId } = req.params;
    if (!UUID_RE.test(tripId)) return res.status(400).json({ error: 'Invalid trip id', requestId: req.requestId });

    const tripResult = await pool.query(
      `SELECT t.id, t.status, o.destination, u.name AS buyer, v.registration AS vehicle
         FROM trips t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.buyer_id
         JOIN vehicles v ON v.id = t.vehicle_id
        WHERE t.id = $1 AND t.driver_id = $2`,
      [tripId, req.user.id]
    );
    const trip = tripResult.rows[0];
    if (!trip) return res.status(404).json({ error: 'Trip not found', requestId: req.requestId });

    const [allocResult, handoverResult, incidentResult] = await Promise.all([
      pool.query(
        `SELECT a.id, f.name AS farm, ts.sequence, ts.completed_at,
                a.picked_up_kg::float8 AS picked_up_kg,
                a.accepted_kg::float8 AS accepted_kg,
                a.agreed_unit_price_cents::float8 AS price_cents_per_kg,
                a.status
           FROM trip_stops ts
           JOIN allocations a ON a.id = ts.allocation_id
           JOIN harvest_batches hb ON hb.id = a.batch_id
           JOIN farms f ON f.id = hb.farm_id
          WHERE ts.trip_id = $1
          ORDER BY ts.sequence`,
        [tripId]
      ),
      pool.query(
        `SELECT occurred_at, acknowledgement, sum(quantity_kg)::float8 AS handed_over_kg
           FROM custody_events
          WHERE trip_id = $1 AND event_type = 'handover'
          GROUP BY occurred_at, acknowledgement
          ORDER BY occurred_at DESC
          LIMIT 1`,
        [tripId]
      ),
      pool.query(
        `SELECT id, description, status
           FROM incidents
          WHERE trip_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [tripId]
      ),
    ]);

    const allocations = allocResult.rows.map((a) => ({
      id: a.id,
      farm: a.farm,
      sequence: a.sequence,
      pickedUpAt: a.completed_at,
      pickedUpKg: a.picked_up_kg,
      acceptedKg: a.accepted_kg,
      priceCentsPerKg: a.price_cents_per_kg,
    }));
    const handover = handoverResult.rows[0];
    const handedOverKg = handover ? handover.handed_over_kg : 0;
    const acceptedKg = allocations.reduce((sum, a) => sum + a.acceptedKg, 0);
    const incident = incidentResult.rows[0];

    return res.json({
      trip: {
        id: trip.id,
        code: shortCode('YM ', trip.id),
        destination: trip.destination,
        buyer: trip.buyer,
        vehicle: trip.vehicle,
        deliveredAt: handover ? handover.occurred_at : null,
        recipient: handover ? handover.acknowledgement : null,
        handedOverKg,
        status: deliveryStatus(allocResult.rows.map((a) => a.status), handedOverKg, acceptedKg),
        allocations,
        incident: incident
          ? { id: incident.id, code: shortCode('INC-', incident.id), text: splitDescription(incident.description).text, status: incident.status }
          : null,
      },
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

// ---------- Incidents ----------
// The incidents table has no type column, so the type is saved as a tag at the start
// of the description, like "[spoilage] text", and split again when reading.
const INCIDENT_TYPES = ['spoilage', 'short_quantity', 'refused_load', 'delay', 'packaging', 'other'];
const TYPE_TAG = /^\[(spoilage|short_quantity|refused_load|delay|packaging|other)\]\s*/;
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function splitDescription(text) {
  const match = TYPE_TAG.exec(text);
  return match ? { type: match[1], text: text.slice(match[0].length) } : { type: 'other', text };
}

// GET /api/ym24/incidents: incidents on the logged-in driver's trips (newest first).
export async function listIncidents(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.trip_id, i.allocation_id, i.description, i.status, i.created_at,
              i.shortage_kg::float8 AS shortage_kg,
              jsonb_array_length(i.evidence) AS evidence_count,
              f.name AS farm
         FROM incidents i
         JOIN trips t ON t.id = i.trip_id
         LEFT JOIN allocations a ON a.id = i.allocation_id
         LEFT JOIN harvest_batches hb ON hb.id = a.batch_id
         LEFT JOIN farms f ON f.id = hb.farm_id
        WHERE t.driver_id = $1
        ORDER BY i.created_at DESC
        LIMIT 200`,
      [req.user.id]
    );
    const incidents = rows.map((r) => {
      const { type, text } = splitDescription(r.description);
      return {
        id: r.id,
        code: shortCode('INC-', r.id),
        type,
        description: text,
        tripId: r.trip_id,
        tripCode: shortCode('YM ', r.trip_id),
        allocationId: r.allocation_id,
        farm: r.farm,
        shortageKg: r.shortage_kg,
        evidenceCount: r.evidence_count,
        status: r.status,
        createdAt: r.created_at,
      };
    });
    return res.json({ incidents, requestId: req.requestId });
  } catch (error) { next(error); }
}

// POST /api/ym24/incidents: the driver reports a problem on one of their own trips.
export async function createIncident(req, res, next) {
  try {
    const b = req.body || {};
    const errors = [];

    const tripId = typeof b.tripId === 'string' ? b.tripId : '';
    if (!UUID_RE.test(tripId)) errors.push('tripId is invalid');

    const allocationId = b.allocationId ? String(b.allocationId) : null;
    if (allocationId && !UUID_RE.test(allocationId)) errors.push('allocationId is invalid');

    const type = typeof b.type === 'string' ? b.type : '';
    if (!INCIDENT_TYPES.includes(type)) errors.push('type is invalid');

    const description = typeof b.description === 'string' ? b.description.trim() : '';
    if (description.length < 10 || description.length > 500) errors.push('description must be 10 to 500 characters');

    let shortageKg = null;
    if (b.quantityKg !== undefined && b.quantityKg !== null && b.quantityKg !== '') {
      const n = Number(b.quantityKg);
      if (!Number.isFinite(n) || n <= 0 || n > 1000000 || Math.round(n * 1000) / 1000 !== n) errors.push('quantityKg must be above 0 with at most 3 decimals');
      else shortageKg = n;
    }

    const operationKey = typeof b.operationKey === 'string' ? b.operationKey.trim() : '';
    if (operationKey.length < 8 || operationKey.length > 100) errors.push('operationKey must be 8 to 100 characters');

    const evidenceIn = Array.isArray(b.evidence) ? b.evidence : [];
    if (evidenceIn.length > 5) errors.push('at most 5 evidence files');
    const evidence = [];
    for (const f of evidenceIn.slice(0, 5)) {
      if (!f || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 200 || !EVIDENCE_TYPES.includes(f.type) || !Number.isInteger(f.size) || f.size <= 0 || f.size > MAX_FILE_BYTES) {
        errors.push('an evidence file is invalid (JPEG, PNG or PDF, up to 5 MB)');
        break;
      }
      evidence.push({ name: f.name.trim(), type: f.type, size: f.size });
    }

    if (errors.length) return res.status(400).json({ error: 'Invalid request', details: errors, requestId: req.requestId });

    // The trip must belong to this driver.
    const trip = await pool.query('SELECT id FROM trips WHERE id = $1 AND driver_id = $2', [tripId, req.user.id]);
    if (!trip.rows[0]) return res.status(404).json({ error: 'Trip not found', requestId: req.requestId });

    // The allocation must be part of this trip, and the quantity cannot be more than picked up.
    if (allocationId) {
      const alloc = await pool.query(
        `SELECT a.picked_up_kg::float8 AS picked_up_kg
           FROM trip_stops ts JOIN allocations a ON a.id = ts.allocation_id
          WHERE ts.trip_id = $1 AND a.id = $2`,
        [tripId, allocationId]
      );
      if (!alloc.rows[0]) return res.status(400).json({ error: 'Invalid request', details: ['allocation is not part of this trip'], requestId: req.requestId });
      if (shortageKg !== null && shortageKg > alloc.rows[0].picked_up_kg) {
        return res.status(400).json({ error: 'Invalid request', details: ['quantityKg is more than the picked up quantity'], requestId: req.requestId });
      }
    }

    // The key is tied to the driver, so a double click returns the same incident and never saves two.
    const key = `ym24-incident:${req.user.id}:${operationKey}`;
    const inserted = await pool.query(
      `INSERT INTO incidents (trip_id, allocation_id, reported_by, description, shortage_kg, evidence, operation_key)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (operation_key) DO NOTHING
       RETURNING id, status, created_at`,
      [tripId, allocationId, req.user.id, `[${type}] ${description}`, shortageKg, JSON.stringify(evidence), key]
    );
    let row = inserted.rows[0];
    const created = Boolean(row);
    if (!row) {
      const existing = await pool.query('SELECT id, status, created_at FROM incidents WHERE operation_key = $1 AND reported_by = $2', [key, req.user.id]);
      row = existing.rows[0];
    }
    return res.status(created ? 201 : 200).json({
      incident: { id: row.id, code: shortCode('INC-', row.id), type, status: row.status, createdAt: row.created_at },
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

// ---------- Handover ----------

const ALLOWED_EVIDENCE = ['image/jpeg', 'image/png', 'application/pdf'];

// Trips this driver can hand over now (picked up, still in transit).
export async function listPendingHandovers(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.capacity_kg, o.destination, u.name AS buyer, v.registration AS vehicle,
              COALESCE(SUM(a.picked_up_kg), 0) AS picked_up_kg
         FROM trips t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.buyer_id
         LEFT JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN trip_stops ts ON ts.trip_id = t.id
         LEFT JOIN allocations a ON a.id = ts.allocation_id
        WHERE t.driver_id = $1 AND t.status = 'in_progress'
        GROUP BY t.id, t.capacity_kg, o.destination, u.name, v.registration
        ORDER BY t.id`,
      [req.user.id]
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        code: shortCode('YM ', r.id),
        destination: r.destination,
        buyer: r.buyer,
        vehicle: r.vehicle,
        capacityKg: Number(r.capacity_kg),
        pickedUpKg: Number(r.picked_up_kg),
      }))
    );
  } catch (error) {
    next(error);
  }
}

// Runs inside the caller's transaction. Returns { status, body }.
export async function recordHandover(client, { userId, tripId, handedOverKg, recipient, evidence, operationKey }) {
  const baseKey = `ym24-handover:${userId}:${operationKey}`;

  const trip = await client.query(
    `SELECT id, order_id, status FROM trips WHERE id = $1 AND driver_id = $2 FOR UPDATE`,
    [tripId, userId]
  );
  if (trip.rowCount === 0) return { status: 404, body: { message: 'Trip not found.' } };

  // Same key again (double click or retry): nothing new is saved.
  const dup = await client.query(
    `SELECT 1 FROM custody_events WHERE starts_with(operation_key, $1) LIMIT 1`,
    [baseKey + ':']
  );
  if (dup.rowCount > 0) return { status: 200, body: { duplicate: true } };

  if (trip.rows[0].status !== 'in_progress') {
    return { status: 409, body: { message: 'This trip is not waiting for a handover.' } };
  }

  const allocs = await client.query(
    `SELECT a.id, a.picked_up_kg
       FROM trip_stops ts
       JOIN allocations a ON a.id = ts.allocation_id
      WHERE ts.trip_id = $1
      ORDER BY ts.sequence
      FOR UPDATE OF a`,
    [tripId]
  );

  const grams = (v) => Math.round(Number(v) * 1000);
  const totalPicked = allocs.rows.reduce((sum, a) => sum + grams(a.picked_up_kg), 0);
  let remaining = grams(handedOverKg);
  if (totalPicked === 0) return { status: 409, body: { message: 'Nothing has been picked up on this trip.' } };
  if (remaining > totalPicked) {
    return { status: 400, body: { message: 'Handover kg cannot exceed the picked-up kg.' } };
  }

  for (const a of allocs.rows) {
    const take = Math.min(grams(a.picked_up_kg), remaining);
    remaining -= take;
    if (take === 0) continue;
    const kg = (take / 1000).toFixed(3);
    await client.query(
      `INSERT INTO custody_events
         (allocation_id, trip_id, order_id, event_type, quantity_kg, actor_id, acknowledgement, evidence, operation_key)
       VALUES ($1, $2, $3, 'handover', $4, $5, $6, $7::jsonb, $8)`,
      [a.id, tripId, trip.rows[0].order_id, kg, userId, recipient, JSON.stringify(evidence), `${baseKey}:${a.id}`]
    );
    await client.query(
      `UPDATE allocations
          SET handed_over_kg = $2,
              status = CASE WHEN status = 'picked_up' THEN 'handed_over' ELSE status END
        WHERE id = $1`,
      [a.id, kg]
    );
  }

  await client.query(`UPDATE trips SET status = 'handed_over' WHERE id = $1`, [tripId]);
  return { status: 201, body: { duplicate: false, handedOverKg: grams(handedOverKg) / 1000 } };
}

export async function createHandover(req, res, next) {
  const { tripId } = req.params;
  if (!UUID_RE.test(tripId)) return res.status(400).json({ message: 'Invalid trip.' });

  const body = req.body || {};
  const kgText = String(body.handedOverKg ?? '').trim();
  if (!/^\d+(\.\d{1,3})?$/.test(kgText) || Number(kgText) <= 0) {
    return res.status(400).json({ message: 'Handed-over kg must be a number above 0 with up to 3 decimals.' });
  }
  const recipient = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  if (recipient.length < 2 || recipient.length > 100) {
    return res.status(400).json({ message: 'Recipient name must be 2 to 100 characters.' });
  }
  const operationKey = typeof body.operationKey === 'string' ? body.operationKey.trim() : '';
  if (operationKey.length < 8 || operationKey.length > 100) {
    return res.status(400).json({ message: 'A valid operation key is required.' });
  }
  const rawEvidence = Array.isArray(body.evidence) ? body.evidence : [];
  if (rawEvidence.length > 5) return res.status(400).json({ message: 'Attach at most 5 files.' });
  const evidence = [];
  for (const e of rawEvidence) {
    if (!e || typeof e.name !== 'string' || !ALLOWED_EVIDENCE.includes(e.type) || !(e.size > 0) || e.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Each file must be a JPEG, PNG or PDF up to 5 MB.' });
    }
    evidence.push({ name: e.name.slice(0, 200), type: e.type, size: e.size });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await recordHandover(client, {
      userId: req.user.id,
      tripId,
      handedOverKg: Number(kgText),
      recipient,
      evidence,
      operationKey,
    });
    if (result.status === 201 || result.status === 200) await client.query('COMMIT');
    else await client.query('ROLLBACK');
    res.status(result.status).json(result.body);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}