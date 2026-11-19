import pool from '../../config/db.js';
// YM05 · Chamidu Pethum · Notifications
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM05', owner: 'Chamidu Pethum', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getNotifications(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const { rows } = await pool.query(
      `SELECT id, title, message, category, target_path, status, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit],
    );
    return res.json({
      notifications: rows,
      unreadCount: rows.filter((notification) => notification.status !== 'read').length,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}
