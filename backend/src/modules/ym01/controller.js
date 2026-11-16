import pool from '../../config/db.js';
// YM01 · Aathil Hakam · Public pages
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM01', owner: 'Aathil Hakam', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
