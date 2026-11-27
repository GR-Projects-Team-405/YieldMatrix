import pool from '../../config/db.js';

/**
 * YM-03 authenticated account status.
 *
 * Requires a valid JWT.
 * Returns information only for the authenticated user
 * when their account is currently approved.
 */
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          name,
          role,
          approval_status
        FROM users
        WHERE id = $1
          AND role = $2
          AND approval_status = 'approved'
      `,
      [req.user.id, req.user.role]
    );

    const user = rows[0];

    if (!user) {
      return res.status(403).json({
        error: 'Account is not approved or is unavailable',
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      module: 'YM03',
      status: 'active',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        approvalStatus: user.approval_status,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}
