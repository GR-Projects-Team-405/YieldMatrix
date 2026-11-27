import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
const roles = ['farmer', 'buyer', 'driver', 'admin'];
export async function verifyToken(req, res, next) {
  const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Authentication required', requestId: req.requestId });
  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'yieldmatrix', audience: 'yieldmatrix-web' });
    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claims.sub) || !roles.includes(claims.role)) throw new Error('Invalid claims');
    if (claims.demo && process.env.NODE_ENV === 'production') throw new Error('Demo session disabled');
    if (!claims.demo) {
      if (!Number.isInteger(claims.session_version) || claims.session_version < 0) throw new Error('Invalid session version');
      let account;
      try {
        const { rows } = await pool.query(
          'SELECT id, name, role, approval_status, session_version FROM users WHERE id = $1',
          [claims.sub],
        );
        account = rows[0];
      } catch (error) {
        return next(error);
      }
      if (!account || account.session_version !== claims.session_version || account.role !== claims.role) {
        throw new Error('Session revoked');
      }
      if (account.approval_status !== 'approved') {
        return res.status(403).json({ error: 'Account access is restricted', requestId: req.requestId });
      }
      req.user = { id: account.id, role: account.role, name: account.name };
    } else {
      req.user = { id: claims.sub, role: claims.role, name: claims.name };
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session', requestId: req.requestId });
  }
}
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required', requestId: req.requestId });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden for this role', requestId: req.requestId });
    next();
  };
}
