import 'dotenv/config';
import jwt from 'jsonwebtoken';
const roles = ['farmer', 'buyer', 'driver', 'admin'];
export function verifyToken(req, res, next) {
  const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Authentication required', requestId: req.requestId });
  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'yieldmatrix', audience: 'yieldmatrix-web' });
    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claims.sub) || !roles.includes(claims.role)) throw new Error('Invalid claims');
    if (claims.demo && process.env.NODE_ENV === 'production') throw new Error('Demo session disabled');
    if (claims.demo && claims.role === 'buyer') throw new Error('Buyer demo login disabled');
    req.user = { id: claims.sub, role: claims.role, name: claims.name, demo: claims.demo === true };
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
