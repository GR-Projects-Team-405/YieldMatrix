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
              COALESCE(array_agg(a.status) FILTER (WHERE a.id IS NOT NULL), '{}') AS alloc_statuses
         FROM trips t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.buyer_id
         JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN trip_stops ts ON ts.trip_id = t.id
         LEFT JOIN allocations a ON a.id = ts.allocation_id
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
          ? { id: incident.id, code: shortCode('INC-', incident.id), text: incident.description, status: incident.status }
          : null,
      },
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}