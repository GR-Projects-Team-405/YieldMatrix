import pool from '../../config/db.js';
// YM23 · Sandeepa Subashini · Pickup management
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

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM23', owner: 'Sandeepa Subashini', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
