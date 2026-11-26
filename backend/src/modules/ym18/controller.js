import pool from '../../config/db.js';
// YM18 · Nipuni Thakshila · Buyer orders
export async function getStatus(req, res, next) {
  try {
    // Buyer access is based on authentication and role; buyer approval is not required.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2', [req.user.id, req.user.role]);
    if (!rows[0]) return res.status(403).json({ error: 'Buyer account is unavailable', requestId: req.requestId });
    return res.json({ module: 'YM18', owner: 'Nipuni Thakshila', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
