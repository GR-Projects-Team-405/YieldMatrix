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
    const [notificationsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, title, message, category, target_path, channel, status, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [req.user.id, limit],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_count,
                COUNT(*) FILTER (WHERE status <> 'read')::int AS unread_count
         FROM notifications
         WHERE user_id = $1`,
        [req.user.id],
      ),
    ]);
    return res.json({
      notifications: notificationsResult.rows,
      unreadCount: countResult.rows[0].unread_count,
      totalCount: countResult.rows[0].total_count,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications
       SET status = 'read', read_at = COALESCE(read_at, now())
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, message, category, target_path, channel, status, read_at, created_at`,
      [req.params.id, req.user.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Notification not found', requestId: req.requestId });
    }
    return res.json({ notification: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}
