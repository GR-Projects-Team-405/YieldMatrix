import pool from '../../config/db.js';
// YM05 · Chamidu Pethum · Notifications
const notificationTopicsByRole = {
  farmer: ['farm_updates', 'orders_commitments', 'delivery_updates', 'market_advisories'],
  buyer: ['orders_reservations', 'delivery_updates', 'wallet_refunds', 'market_advisories'],
  driver: ['delivery_requests', 'pickup_route_updates', 'earnings_settlements', 'account_updates'],
  admin: ['account_approvals', 'order_delivery_issues', 'settlement_exceptions', 'security_audit'],
};
const notificationChannels = ['in_app', 'local_mail_sink', 'sms'];
const marketAdvisoryTopics = ['price_changes', 'supply_demand', 'new_opportunities', 'weekly_summary'];

function isPreferenceMap(value, allowedKeys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([key, enabled]) => allowedKeys.includes(key) && typeof enabled === 'boolean');
}

export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM05', owner: 'Chamidu Pethum', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function getPreferences(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT notification_preferences, market_advisory_preferences
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    return res.json({
      notificationPreferences: rows[0].notification_preferences,
      marketAdvisoryPreferences: rows[0].market_advisory_preferences,
      requestId: req.requestId,
    });
  } catch (error) { next(error); }
}

export async function updatePreferences(req, res, next) {
  try {
    const notificationPreferences = req.body?.notificationPreferences;
    const marketAdvisoryPreferences = req.body?.marketAdvisoryPreferences;
    const allowedNotificationKeys = [...notificationChannels, ...(notificationTopicsByRole[req.user.role] || [])];
    if (!isPreferenceMap(notificationPreferences, allowedNotificationKeys) ||
        !isPreferenceMap(marketAdvisoryPreferences, marketAdvisoryTopics)) {
      return res.status(400).json({ error: 'Invalid notification preferences', requestId: req.requestId });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET notification_preferences = $1::jsonb,
           market_advisory_preferences = $2::jsonb,
           updated_at = now()
       WHERE id = $3
       RETURNING notification_preferences, market_advisory_preferences`,
      [JSON.stringify(notificationPreferences), JSON.stringify(marketAdvisoryPreferences), req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    return res.json({
      notificationPreferences: rows[0].notification_preferences,
      marketAdvisoryPreferences: rows[0].market_advisory_preferences,
      requestId: req.requestId,
    });
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
