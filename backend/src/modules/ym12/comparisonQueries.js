import pool from '../../config/db.js';

export async function findEligibleComparisonListings(ids) {
  const { rows } = await pool.query(
    `SELECT l.id::text AS listing_id,
            b.farmer_id::text AS supplier_id,
            supplier.name AS supplier_name,
            f.district,
            c.id::text AS crop_id,
            c.name AS crop_name,
            l.unit_price_cents::text AS price_per_kg_cents,
            GREATEST(0::numeric, LEAST(l.offered_kg, ba.available_kg))::text AS available_kg,
            g.name AS grade,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_start,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_end
       FROM listings l
       JOIN harvest_batches b ON b.id = l.batch_id
       JOIN batch_availability ba ON ba.batch_id = b.id
       JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN users supplier ON supplier.id = b.farmer_id
       JOIN crops c ON c.id = b.crop_id
       JOIN grades g ON g.id = b.grade_id
      WHERE l.id = ANY($1::uuid[])
        AND l.status = 'active'
        AND l.valid_from <= now()
        AND l.valid_until > now()
        AND b.status IN ('ready','harvested')
        AND ba.available_kg > 0
        AND f.status = 'active'
        AND supplier.role = 'farmer'
        AND supplier.approval_status = 'approved'
        AND c.active = true
        AND g.active = true`,
    [ids],
  );
  return rows;
}

export async function findComparisonPerformance(supplierIds) {
  const { rows } = await pool.query(
    `WITH supplier_orders AS (
       SELECT a.farmer_id,
              o.id AS order_id,
              o.status
         FROM allocations a
         JOIN orders o ON o.id = a.order_id
        WHERE a.farmer_id = ANY($1::uuid[])
          AND o.status IN ('confirmed','in_fulfilment','delivered','closed')
        GROUP BY a.farmer_id, o.id, o.status
     ),
     completed_orders AS (
       SELECT farmer_id, order_id
         FROM supplier_orders
        WHERE status = 'closed'
     ),
     pickup_records AS (
       SELECT c.farmer_id, c.order_id,
              COUNT(ts.id) FILTER (WHERE ts.status = 'picked_up') AS pickup_stops,
              COUNT(ts.id) FILTER (
                WHERE ts.status = 'picked_up'
                  AND ts.scheduled_at IS NOT NULL
                  AND ts.completed_at IS NOT NULL
              ) AS timed_pickup_stops,
              BOOL_AND(ts.completed_at <= ts.scheduled_at) FILTER (
                WHERE ts.status = 'picked_up'
                  AND ts.scheduled_at IS NOT NULL
                  AND ts.completed_at IS NOT NULL
              ) AS all_pickups_on_time
         FROM completed_orders c
         JOIN allocations a ON a.order_id = c.order_id AND a.farmer_id = c.farmer_id
         LEFT JOIN trip_stops ts ON ts.allocation_id = a.id AND ts.order_id = c.order_id
        GROUP BY c.farmer_id, c.order_id
     ),
     supplier_disputes AS (
       SELECT c.farmer_id, COUNT(DISTINCT c.order_id)::text AS disputed_orders
         FROM completed_orders c
         JOIN allocations a ON a.order_id = c.order_id AND a.farmer_id = c.farmer_id
         JOIN disputes d ON d.allocation_id = a.id
        GROUP BY c.farmer_id
     ),
     supplier_buyer_requests AS (
       SELECT fc.farmer_id,
              COUNT(*)::text AS requests_received,
              COUNT(*) FILTER (
                WHERE fc.status IN ('accepted','change_pending','ready_to_fulfil','fulfilled')
              )::text AS requests_accepted
         FROM future_commitments fc
        WHERE fc.farmer_id = ANY($1::uuid[])
        GROUP BY fc.farmer_id
     )
     SELECT u.id::text AS supplier_id,
            COUNT(DISTINCT so.order_id) FILTER (WHERE so.status = 'closed')::text AS completed_orders,
            COUNT(DISTINCT so.order_id)::text AS confirmed_orders,
            COALESCE(sbr.requests_received, '0') AS buyer_requests,
            COALESCE(sbr.requests_accepted, '0') AS accepted_requests,
            COUNT(DISTINCT pr.order_id) FILTER (
              WHERE pr.pickup_stops > 0 AND pr.pickup_stops = pr.timed_pickup_stops
            )::text AS pickup_denominator,
            COUNT(DISTINCT pr.order_id) FILTER (
              WHERE pr.pickup_stops > 0
                AND pr.pickup_stops = pr.timed_pickup_stops
                AND pr.all_pickups_on_time
            )::text AS on_time_pickups,
            COALESCE(sd.disputed_orders, '0') AS disputed_completed_orders
       FROM users u
       LEFT JOIN supplier_orders so ON so.farmer_id = u.id
       LEFT JOIN pickup_records pr ON pr.farmer_id = u.id
       LEFT JOIN supplier_disputes sd ON sd.farmer_id = u.id
       LEFT JOIN supplier_buyer_requests sbr ON sbr.farmer_id = u.id
      WHERE u.id = ANY($1::uuid[])
      GROUP BY u.id, sbr.requests_received, sbr.requests_accepted, sd.disputed_orders`,
    [supplierIds],
  );
  return rows;
}
