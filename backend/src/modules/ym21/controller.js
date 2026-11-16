import pool from '../../config/db.js';
// YM21 · Rashmika Ravihara · Driver overview & vehicle
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM21', owner: 'Rashmika Ravihara', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
