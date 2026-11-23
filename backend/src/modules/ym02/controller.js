import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { DUMMY_HASH, verifyPassword } from './passwords.js';

// YM02 · Ashen Ranasingha · Login & account access
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM02', owner: 'Ashen Ranasingha', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

// Simple in-memory limit: 5 failed attempts per IP + email in 15 minutes (resets when the server restarts).
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLimited(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) { attempts.delete(key); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export async function login(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'email' && key !== 'password')) {
      return res.status(422).json({ error: 'Invalid input', requestId: req.requestId });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fields = {};
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = 'Enter a valid email address';
    if (!password || password.length > 128) fields.password = 'Enter your password';
    if (Object.keys(fields).length > 0) return res.status(422).json({ error: 'Invalid input', fields, requestId: req.requestId });

    const key = `${req.ip}|${email}`;
    if (isLimited(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.', requestId: req.requestId });

    const { rows } = await pool.query('SELECT id, name, role, approval_status, password_hash FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const canLogin = user?.role === 'admin' && Boolean(user.password_hash);
    const matches = await verifyPassword(password, canLogin ? user.password_hash : DUMMY_HASH);

    // One generic message for unknown email, wrong password, non-admin account or no password set.
    if (!canLogin || !matches) {
      recordFailure(key);
      return res.status(401).json({ error: 'Email or password is incorrect', requestId: req.requestId });
    }
    if (user.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Account access is restricted', approvalStatus: user.approval_status, requestId: req.requestId });
    }

    attempts.delete(key);
    const token = jwt.sign({ role: user.role, name: user.name }, process.env.JWT_SECRET, {
      subject: user.id, expiresIn: '30m', algorithm: 'HS256', issuer: 'yieldmatrix', audience: 'yieldmatrix-web',
    });
    return res.json({ token, user: { id: user.id, name: user.name, role: user.role }, requestId: req.requestId });
  } catch (error) { next(error); }
}