import pool from '../../config/db.js';

const ORDER_PERIOD_PREDICATE = `o.updated_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Colombo')
        AND o.updated_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')`;

export async function findSupplierPerformanceCounts(supplierId, from, to) {
  const { rows } = await pool.query(
    `WITH supplier_orders AS (
       SELECT o.id, o.status
         FROM orders o
        WHERE EXISTS (
          SELECT 1
            FROM allocations a
           WHERE a.order_id = o.id
             AND a.farmer_id = $1::uuid
        )
          AND o.status IN ('confirmed','in_fulfilment','delivered','closed')
          AND ${ORDER_PERIOD_PREDICATE}
     ),
     completed_orders AS (
       SELECT id FROM supplier_orders WHERE status = 'closed'
     ),
     buyer_requests AS (
       SELECT fc.status
         FROM future_commitments fc
        WHERE fc.farmer_id = $1::uuid
          AND fc.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Colombo')
          AND fc.created_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
     ),
     pickup_records AS (
       SELECT c.id AS order_id,
              COUNT(DISTINCT a.id) AS allocation_count,
              COUNT(DISTINCT ts.id) FILTER (WHERE ts.status = 'picked_up') AS pickup_stops,
              COUNT(DISTINCT ts.id) FILTER (
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
         JOIN allocations a ON a.order_id = c.id AND a.farmer_id = $1::uuid
         LEFT JOIN trip_stops ts ON ts.allocation_id = a.id AND ts.order_id = c.id
        GROUP BY c.id
     ),
     dispute_counts AS (
       SELECT COUNT(DISTINCT c.id)::text AS disputed_completed_orders
         FROM completed_orders c
         JOIN allocations a ON a.order_id = c.id AND a.farmer_id = $1::uuid
         JOIN disputes d ON d.allocation_id = a.id
     )
     SELECT
       (SELECT COUNT(*)::text FROM buyer_requests) AS buyer_requests,
       (SELECT COUNT(*)::text
          FROM buyer_requests
         WHERE status IN ('accepted','change_pending','ready_to_fulfil','fulfilled')
       ) AS accepted_requests,
       (SELECT COUNT(*)::text FROM completed_orders) AS completed_orders,
       (SELECT COUNT(*)::text FROM supplier_orders) AS confirmed_orders,
       (SELECT COUNT(*)::text FROM completed_orders) AS pickup_denominator,
       (SELECT COUNT(*)::text
          FROM pickup_records
         WHERE pickup_stops = allocation_count
           AND pickup_stops = timed_pickup_stops
           AND all_pickups_on_time
       ) AS on_time_pickups,
       dispute_counts.disputed_completed_orders
       FROM dispute_counts`,
    [supplierId, from, to],
  );
  return rows[0] || null;
}

export async function findSupplierMonthlyTrend(supplierId, from, to) {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', o.updated_at AT TIME ZONE 'Asia/Colombo'), 'YYYY-MM') AS month,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'closed')::text AS completed,
            COUNT(DISTINCT o.id)::text AS confirmed
       FROM orders o
      WHERE EXISTS (
        SELECT 1
          FROM allocations a
         WHERE a.order_id = o.id
           AND a.farmer_id = $1::uuid
      )
        AND o.status IN ('confirmed','in_fulfilment','delivered','closed')
        AND ${ORDER_PERIOD_PREDICATE}
      GROUP BY DATE_TRUNC('month', o.updated_at AT TIME ZONE 'Asia/Colombo')
      ORDER BY month`,
    [supplierId, from, to],
  );
  return rows;
}
