import pool from '../../config/db.js';
// YM06 · Eshan Harshana · Farmer overview

async function requireApprovedFarmer(req, res) {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND role = 'farmer' AND approval_status = 'approved'",
    [req.user.id],
  );
  if (rows[0]) return true;
  res.status(403).json({ error: 'Approved farmer account required', requestId: req.requestId });
  return false;
}

const upcomingHarvestQuery = `
  SELECT hb.id, hb.planned_harvest_date, hb.planned_kg::TEXT AS planned_kg,
         hb.status, f.name AS farm, f.district, c.name AS crop, g.name AS grade
  FROM harvest_batches hb
  JOIN farms f ON f.id = hb.farm_id AND f.farmer_id = hb.farmer_id
  JOIN crops c ON c.id = hb.crop_id
  JOIN grades g ON g.id = hb.grade_id
  WHERE hb.farmer_id = $1
    AND hb.status IN ('planned', 'ready')
    AND hb.planned_harvest_date >= CURRENT_DATE
`;

async function getFarmerMarketInsights(farmerId) {
  const { rows } = await pool.query(`
    WITH farmer_districts AS (
      SELECT district FROM farms WHERE farmer_id = $1 AND status = 'active'
      UNION
      SELECT district FROM users WHERE id = $1 AND district IS NOT NULL
    ), observations AS (
      SELECT mo.crop_id, mo.grade_id, mo.district, mo.observation_date,
             mo.demand_kg, mo.price_per_kg_cents, mo.sample_data,
             c.name AS crop, g.name AS grade
      FROM market_observations mo
      JOIN farmer_districts fd ON fd.district = mo.district
      JOIN crops c ON c.id = mo.crop_id
      JOIN grades g ON g.id = mo.grade_id
      WHERE mo.is_current = true
        AND mo.observation_date >= CURRENT_DATE - 13
    )
    SELECT crop_id, grade_id, crop, grade, district,
           AVG(demand_kg) FILTER (WHERE observation_date >= CURRENT_DATE - 6)::TEXT AS recent_demand_kg,
           AVG(demand_kg) FILTER (WHERE observation_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE - 7)::TEXT AS prior_demand_kg,
           ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_kg_cents)
             FILTER (WHERE observation_date >= CURRENT_DATE - 13))::BIGINT::TEXT AS price_low_cents,
           ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_kg_cents)
             FILTER (WHERE observation_date >= CURRENT_DATE - 13))::BIGINT::TEXT AS price_high_cents,
           COUNT(*)::INTEGER AS observation_count,
           BOOL_OR(sample_data) AS includes_sample_data,
           MAX(observation_date) AS observed_through
    FROM observations
    GROUP BY crop_id, grade_id, crop, grade, district
    ORDER BY AVG(demand_kg) FILTER (WHERE observation_date >= CURRENT_DATE - 6) DESC NULLS LAST,
             MAX(observation_date) DESC
    LIMIT 4
  `, [farmerId]);

  return rows.map((row) => {
    const recent = row.recent_demand_kg === null ? null : Number(row.recent_demand_kg);
    const prior = row.prior_demand_kg === null ? null : Number(row.prior_demand_kg);
    let demandTrend = 'insufficient_data';
    let changePercent = null;
    if (recent !== null && prior !== null) {
      changePercent = prior === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - prior) / prior) * 1000) / 10;
      demandTrend = changePercent > 5 ? 'rising' : changePercent < -5 ? 'falling' : 'steady';
    }
    return {
      cropId: row.crop_id,
      gradeId: row.grade_id,
      crop: row.crop,
      grade: row.grade,
      district: row.district,
      recentDemandKg: row.recent_demand_kg,
      priorDemandKg: row.prior_demand_kg,
      demandTrend,
      changePercent,
      suggestedPriceLowCents: row.price_low_cents,
      suggestedPriceHighCents: row.price_high_cents,
      observationCount: row.observation_count,
      includesSampleData: row.includes_sample_data,
      observedThrough: row.observed_through,
      reason: demandTrend === 'rising'
        ? 'Recent local demand is above the previous week. Compare your offer with the observed local price range.'
        : demandTrend === 'falling'
          ? 'Recent local demand is below the previous week. Review your timing and compare against current local prices.'
          : demandTrend === 'steady'
            ? 'Local demand has been broadly steady. The price range reflects recent observations for this crop and grade.'
            : 'There are not enough recent observations to compare demand yet.',
    };
  });
}

export async function getOverview(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const farmerId = req.user.id;
    const [summaryResult, harvestResult, allocationResult, insightResult] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE((SELECT SUM(ROUND(a.accepted_kg * a.agreed_unit_price_cents))::TEXT
            FROM allocations a JOIN orders o ON o.id = a.order_id
            WHERE a.farmer_id = $1 AND a.accepted_kg > 0
              AND a.status IN ('accepted','partially_accepted','resolved')
              AND o.updated_at >= now() - INTERVAL '30 days'), '0') AS accepted_sales_cents,
          COALESCE((SELECT SUM(GREATEST(ba.available_kg, 0))::TEXT
            FROM harvest_batches hb JOIN batch_availability ba ON ba.batch_id = hb.id
            WHERE hb.farmer_id = $1 AND hb.status IN ('ready','harvested')), '0') AS available_kg,
          (SELECT COUNT(*)::INTEGER FROM allocations a
            WHERE a.farmer_id = $1 AND a.status IN ('held','supplier_accepted','committed','picked_up','handed_over')) AS pending_allocations,
          (SELECT COUNT(DISTINCT o.id)::INTEGER FROM orders o
            JOIN allocations a ON a.order_id = o.id
            WHERE a.farmer_id = $1 AND a.accepted_kg > 0 AND o.status IN ('delivered','closed')
              AND o.updated_at >= now() - INTERVAL '30 days') AS completed_orders,
          (SELECT COUNT(*)::INTEGER FROM listings l
            JOIN harvest_batches hb ON hb.id = l.batch_id
            WHERE hb.farmer_id = $1 AND l.status = 'active' AND l.valid_until > now()) AS active_listings
      `, [farmerId]),
      pool.query(`${upcomingHarvestQuery} ORDER BY hb.planned_harvest_date ASC, hb.created_at DESC LIMIT 4`, [farmerId]),
      pool.query(`
        SELECT a.id, a.status, a.agreed_kg::TEXT AS agreed_kg,
               ROUND(a.agreed_kg * a.agreed_unit_price_cents)::BIGINT::TEXT AS agreed_value_cents,
               o.id AS order_id, o.status AS order_status, u.name AS buyer,
               c.name AS crop, g.name AS grade, a.created_at
        FROM allocations a
        JOIN orders o ON o.id = a.order_id
        JOIN users u ON u.id = o.buyer_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        JOIN crops c ON c.id = hb.crop_id
        JOIN grades g ON g.id = hb.grade_id
        WHERE a.farmer_id = $1
        ORDER BY a.created_at DESC
        LIMIT 5
      `, [farmerId]),
      getFarmerMarketInsights(farmerId),
    ]);

    return res.json({
      summary: summaryResult.rows[0],
      upcomingHarvests: harvestResult.rows,
      recentAllocations: allocationResult.rows,
      marketInsights: insightResult,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function getSalesPerformance(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'Days must be 7, 30 or 90', requestId: req.requestId });
    const cropId = req.query.cropId || null;
    if (cropId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cropId)) {
      return res.status(400).json({ error: 'Invalid crop filter', requestId: req.requestId });
    }
    const farmerId = req.user.id;
    const filter = `a.farmer_id = $1 AND a.accepted_kg > 0
      AND a.status IN ('accepted','partially_accepted','resolved')
      AND COALESCE(accepted.accepted_at, o.updated_at) >= CURRENT_DATE - ($2::INTEGER * INTERVAL '1 day')
      AND ($3::UUID IS NULL OR hb.crop_id = $3)`;
    const [summaryResult, trendResult, cropResult, transactionResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(DISTINCT a.order_id)::INTEGER AS completed_orders,
               COALESCE(SUM(a.accepted_kg), 0)::TEXT AS accepted_kg,
               COALESCE(SUM(ROUND(a.accepted_kg * a.agreed_unit_price_cents)), 0)::BIGINT::TEXT AS sales_cents,
               COALESCE(SUM(a.settled_cents), 0)::BIGINT::TEXT AS settled_cents,
               COUNT(DISTINCT hb.crop_id)::INTEGER AS active_crops
        FROM allocations a
        JOIN orders o ON o.id = a.order_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        LEFT JOIN LATERAL (
          SELECT MAX(ce.occurred_at) AS accepted_at
          FROM custody_events ce WHERE ce.allocation_id = a.id AND ce.event_type = 'acceptance'
        ) accepted ON true
        WHERE ${filter}
      `, [farmerId, days, cropId]),
      pool.query(`
        SELECT DATE_TRUNC(CASE WHEN $2::INTEGER = 7 THEN 'day' ELSE 'week' END,
                          COALESCE(accepted.accepted_at, o.updated_at))::DATE AS period_start,
               COALESCE(SUM(a.accepted_kg), 0)::TEXT AS accepted_kg,
               COALESCE(SUM(ROUND(a.accepted_kg * a.agreed_unit_price_cents)), 0)::BIGINT::TEXT AS sales_cents
        FROM allocations a
        JOIN orders o ON o.id = a.order_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        LEFT JOIN LATERAL (
          SELECT MAX(ce.occurred_at) AS accepted_at
          FROM custody_events ce WHERE ce.allocation_id = a.id AND ce.event_type = 'acceptance'
        ) accepted ON true
        WHERE ${filter}
        GROUP BY period_start ORDER BY period_start
      `, [farmerId, days, cropId]),
      pool.query(`
        SELECT c.id AS crop_id, c.name AS crop, g.name AS grade,
               COALESCE(SUM(a.accepted_kg), 0)::TEXT AS accepted_kg,
               COALESCE(SUM(ROUND(a.accepted_kg * a.agreed_unit_price_cents)), 0)::BIGINT::TEXT AS sales_cents
        FROM allocations a
        JOIN orders o ON o.id = a.order_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        JOIN crops c ON c.id = hb.crop_id
        JOIN grades g ON g.id = hb.grade_id
        LEFT JOIN LATERAL (
          SELECT MAX(ce.occurred_at) AS accepted_at
          FROM custody_events ce WHERE ce.allocation_id = a.id AND ce.event_type = 'acceptance'
        ) accepted ON true
        WHERE ${filter}
        GROUP BY c.id, c.name, g.name ORDER BY SUM(a.accepted_kg) DESC
      `, [farmerId, days, cropId]),
      pool.query(`
        SELECT o.id AS order_id, o.destination_district, o.status AS order_status,
               o.updated_at, u.name AS buyer, c.name AS crop, g.name AS grade,
               a.accepted_kg::TEXT AS accepted_kg,
               a.agreed_unit_price_cents::TEXT AS price_cents_per_kg,
               ROUND(a.accepted_kg * a.agreed_unit_price_cents)::BIGINT::TEXT AS sales_cents,
               a.settled_cents::TEXT AS settled_cents
        FROM allocations a
        JOIN orders o ON o.id = a.order_id
        JOIN users u ON u.id = o.buyer_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        JOIN crops c ON c.id = hb.crop_id
        JOIN grades g ON g.id = hb.grade_id
        LEFT JOIN LATERAL (
          SELECT MAX(ce.occurred_at) AS accepted_at
          FROM custody_events ce WHERE ce.allocation_id = a.id AND ce.event_type = 'acceptance'
        ) accepted ON true
        WHERE ${filter}
        ORDER BY COALESCE(accepted.accepted_at, o.updated_at) DESC LIMIT 100
      `, [farmerId, days, cropId]),
    ]);
    return res.json({ summary: summaryResult.rows[0], trend: trendResult.rows, crops: cropResult.rows, transactions: transactionResult.rows, days, requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getUpcomingHarvests(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const { rows } = await pool.query(`${upcomingHarvestQuery} ORDER BY hb.planned_harvest_date ASC, hb.created_at DESC`, [req.user.id]);
    return res.json({ harvests: rows, requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getCompletedOrders(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const days = Number(req.query.days ?? 30);
    if (![30, 90, 365].includes(days)) return res.status(400).json({ error: 'Days must be 30, 90 or 365', requestId: req.requestId });
    const [summaryResult, trendResult, ordersResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(DISTINCT o.id)::INTEGER AS completed_orders,
               COALESCE(SUM(a.accepted_kg), 0)::TEXT AS accepted_kg,
               COALESCE(SUM(ROUND(a.accepted_kg * a.agreed_unit_price_cents)), 0)::BIGINT::TEXT AS sales_cents,
               COALESCE(SUM(a.settled_cents), 0)::BIGINT::TEXT AS settled_cents,
               COUNT(DISTINCT hb.crop_id)::INTEGER AS active_crops
        FROM orders o JOIN allocations a ON a.order_id = o.id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        WHERE a.farmer_id = $1 AND o.status IN ('delivered','closed')
          AND a.accepted_kg > 0
          AND o.updated_at >= CURRENT_DATE - ($2::INTEGER * INTERVAL '1 day')
      `, [req.user.id, days]),
      pool.query(`
        SELECT DATE_TRUNC('week', o.updated_at)::DATE AS week_start,
               COALESCE(SUM(a.accepted_kg), 0)::TEXT AS accepted_kg,
               COUNT(DISTINCT o.id)::INTEGER AS completed_orders
        FROM orders o JOIN allocations a ON a.order_id = o.id
        WHERE a.farmer_id = $1 AND o.status IN ('delivered','closed')
          AND a.accepted_kg > 0
          AND o.updated_at >= CURRENT_DATE - ($2::INTEGER * INTERVAL '1 day')
        GROUP BY week_start ORDER BY week_start
      `, [req.user.id, days]),
      pool.query(`
        SELECT o.id AS order_id, o.status AS order_status, o.destination_district,
               o.updated_at AS completed_at, u.name AS buyer,
               c.name AS crop, g.name AS grade,
               a.agreed_kg::TEXT AS ordered_kg, a.accepted_kg::TEXT AS accepted_kg,
               a.agreed_unit_price_cents::TEXT AS price_cents_per_kg,
               ROUND(a.accepted_kg * a.agreed_unit_price_cents)::BIGINT::TEXT AS sales_cents,
               a.settled_cents::TEXT AS settled_cents,
               a.status AS allocation_status
        FROM orders o JOIN allocations a ON a.order_id = o.id
        JOIN users u ON u.id = o.buyer_id
        JOIN harvest_batches hb ON hb.id = a.batch_id
        JOIN crops c ON c.id = hb.crop_id
        JOIN grades g ON g.id = hb.grade_id
        WHERE a.farmer_id = $1 AND o.status IN ('delivered','closed')
          AND a.accepted_kg > 0
          AND o.updated_at >= CURRENT_DATE - ($2::INTEGER * INTERVAL '1 day')
        ORDER BY o.updated_at DESC, o.id LIMIT 200
      `, [req.user.id, days]),
    ]);
    return res.json({ summary: summaryResult.rows[0], trend: trendResult.rows, orders: ordersResult.rows, days, requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getMarketInsights(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const insights = await getFarmerMarketInsights(req.user.id);
    return res.json({ insights, methodology: 'Recent market observations in the farmer’s active farm districts; suggested range uses the 25th–75th percentile of observed prices.', requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getStatus(req, res, next) {
  try {
    if (!(await requireApprovedFarmer(req, res))) return;
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [req.user.id]);
    return res.json({ module: 'YM06', owner: 'Eshan Harshana', status: 'ready', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
