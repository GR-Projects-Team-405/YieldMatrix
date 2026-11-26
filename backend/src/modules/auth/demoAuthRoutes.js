import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { verifyToken } from '../../middleware/authMiddleware.js';
import { AuthInputError, hashPassword, validateBuyerRegistration, validateLogin, verifyPassword } from './credentials.js';
const router = Router();
// Development-only identities match database/seed.sql; no database query is needed to log in.
const users = {
  farmer: { id: '11111111-1111-1111-1111-111111111111', name: 'Demo Farmer', role: 'farmer' },
  driver: { id: '33333333-3333-3333-3333-333333333333', name: 'Demo Driver', role: 'driver' },
  admin: { id: '44444444-4444-4444-4444-444444444444', name: 'Demo Admin', role: 'admin' },
};

function createToken(user, demo = false) {
  return jwt.sign(
    { role: user.role, name: user.name, ...(demo ? { demo: true } : {}) },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '30m', algorithm: 'HS256', issuer: 'yieldmatrix', audience: 'yieldmatrix-web' },
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const input = validateBuyerRegistration(req.body);
    const passwordHash = await hashPassword(input.password);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, role, approval_status, password_hash)
       VALUES ($1, $2, 'buyer', 'approved', $3)
       RETURNING id, name, email, role, approval_status AS "approvalStatus"`,
      [input.name, input.email, passwordHash],
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, message: 'Buyer account created', user: rows[0], requestId: req.requestId });
  } catch (error) {
    if (error instanceof AuthInputError) return res.status(422).json({ error: error.message, requestId: req.requestId });
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.', requestId: req.requestId });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const input = validateLogin(req.body);
    const { rows } = await pool.query(
      `SELECT id, name, email, role, approval_status AS "approvalStatus", password_hash
       FROM users WHERE email = $1 LIMIT 1`,
      [input.email],
    );
    const account = rows[0];
    const passwordMatches = await verifyPassword(input.password, account?.password_hash);
    if (!account || !passwordMatches) return res.status(401).json({ error: 'Email or password is incorrect.', requestId: req.requestId });
    if (input.role && account.role !== input.role) {
      return res.status(403).json({ error: `This account is registered as ${account.role}, not ${input.role}.`, requestId: req.requestId });
    }
    const user = { id: account.id, name: account.name, email: account.email, role: account.role, approvalStatus: account.approvalStatus };
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ token: createToken(user), user, requestId: req.requestId });
  } catch (error) {
    if (error instanceof AuthInputError) return res.status(422).json({ error: error.message, requestId: req.requestId });
    return next(error);
  }
});

router.post('/demo-login', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Demo login is disabled', requestId: req.requestId });
  const role = req.body?.role;
  if (!req.body || Object.keys(req.body).some((key) => key !== 'role') || typeof role !== 'string' || !Object.hasOwn(users, role)) {
    return res.status(422).json({ error: 'Invalid input', fields: { role: 'Choose farmer, driver or admin' }, requestId: req.requestId });
  }
  const user = users[role];
  const token = createToken(user, true);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token, user, requestId: req.requestId });
});

router.get('/me', verifyToken, async (req, res, next) => {
  if (req.user.demo) {
    return res.json({ user: { id: req.user.id, name: req.user.name, role: req.user.role, approvalStatus: 'approved' }, requestId: req.requestId });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, approval_status AS "approvalStatus"
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id],
    );
    if (!rows[0]) return res.status(401).json({ error: 'Session account is no longer available', requestId: req.requestId });
    return res.json({ user: rows[0], requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
});
export default router;
