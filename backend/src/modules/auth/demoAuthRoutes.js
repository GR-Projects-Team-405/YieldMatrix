import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../middleware/authMiddleware.js';
const router = Router();
// Development-only identities match database/seed.sql; no database query is needed to log in.
const users = {
  farmer: { id: '11111111-1111-1111-1111-111111111111', name: 'Demo Farmer', role: 'farmer' },
  buyer: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
  driver: { id: '33333333-3333-3333-3333-333333333333', name: 'Demo Driver', role: 'driver' },
  admin: { id: '44444444-4444-4444-4444-444444444444', name: 'Demo Admin', role: 'admin' },
};
router.post('/demo-login', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Demo login is disabled', requestId: req.requestId });
  const role = req.body?.role;
  if (!req.body || Object.keys(req.body).some((key) => key !== 'role') || typeof role !== 'string' || !Object.hasOwn(users, role)) {
    return res.status(422).json({ error: 'Invalid input', fields: { role: 'Choose farmer, buyer, driver or admin' }, requestId: req.requestId });
  }
  const user = users[role];
  const token = jwt.sign({ role: user.role, name: user.name, demo: true }, process.env.JWT_SECRET, { subject: user.id, expiresIn: '30m', algorithm: 'HS256', issuer: 'yieldmatrix', audience: 'yieldmatrix-web' });
  res.json({ token, user, requestId: req.requestId });
});
router.get('/me', verifyToken, (req, res) => res.json({ user: req.user, requestId: req.requestId }));
export default router;
