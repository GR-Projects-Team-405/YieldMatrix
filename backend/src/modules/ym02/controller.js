import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './passwords.js';

// YM02 · Ashen Ranasingha · Login & account access
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM02', owner: 'Ashen Ranasingha', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

// Simple in-memory limit: 5 failed attempts per key in 15 minutes (resets when the server restarts).
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESET_MINUTES = 30;
const MIN_PASSWORD = 15;
const MAX_PASSWORD = 128;
const FORGOT_MESSAGE = 'If an account exists for this email, a password reset link has been sent.';

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

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (body, allowed) => Object.keys(body).every((key) => allowed.includes(key));
// audit_logs.request_id is a UUID column, so only pass a value that really is a UUID.
const auditRequestId = (req) => (typeof req.requestId === 'string' && UUID_PATTERN.test(req.requestId) ? req.requestId : null);

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

// Creates a single-use reset token (only its SHA-256 hash is stored), a mail-sink notification
// and an audit row in one transaction. Failures are logged, never shown, so the response
// cannot reveal whether the email has an account.
async function createResetRequest(userId, req) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);

    const token = randomBytes(32).toString('hex');
    const tokenId = randomUUID();
    await client.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4::int), now())`,
      [tokenId, userId, sha256(token), RESET_MINUTES],
    );
    // The notification never contains the token or the link.
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, target_path, channel, status, operation_key)
       VALUES ($1, 'Password reset requested', 'A password reset link was sent to your email address.', 'security', '/account/reset-password', 'local_mail_sink', 'sent', $2)`,
      [userId, `ym02-reset-${tokenId}`],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, safe_changes)
       VALUES (NULL, 'password_reset_requested', 'user', $1, $2, '{}')`,
      [userId, auditRequestId(req)],
    );
    await client.query('COMMIT');

    if (process.env.NODE_ENV !== 'production') {
      const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      console.log(`[YM02 dev mail sink] Password reset link: ${base}/account/reset-password?token=${token}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[YM02] Could not create password reset request:', error.message);
  } finally {
    client.release();
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const body = req.body;
    if (!isPlainObject(body) || !hasOnlyKeys(body, ['email'])) {
      return res.status(422).json({ error: 'Invalid input', requestId: req.requestId });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(422).json({ error: 'Invalid input', fields: { email: 'Enter a valid email address' }, requestId: req.requestId });
    }

    const key = `forgot|${req.ip}|${email}`;
    if (isLimited(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.', requestId: req.requestId });
    recordFailure(key); // every request counts, so the endpoint cannot be used to flood an inbox

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows[0]) await createResetRequest(rows[0].id, req);

    return res.json({ message: FORGOT_MESSAGE, requestId: req.requestId });
  } catch (error) { next(error); }
}

export async function resetPassword(req, res, next) {
  let client;
  try {
    const body = req.body;
    if (!isPlainObject(body) || !hasOnlyKeys(body, ['token', 'password'])) {
      return res.status(422).json({ error: 'Invalid input', requestId: req.requestId });
    }
    const token = typeof body.token === 'string' ? body.token : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const length = Array.from(password).length;
    if (length < MIN_PASSWORD || length > MAX_PASSWORD) {
      return res.status(422).json({ error: 'Invalid input', fields: { password: `Use ${MIN_PASSWORD} to ${MAX_PASSWORD} characters` }, requestId: req.requestId });
    }

    const key = `reset|${req.ip}`;
    if (isLimited(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.', requestId: req.requestId });
    const invalidLink = () => {
      recordFailure(key);
      return res.status(400).json({ error: 'Reset link is not valid or has expired', requestId: req.requestId });
    };
    if (!TOKEN_PATTERN.test(token)) return invalidLink();

    client = await pool.connect();
    await client.query('BEGIN');
    // FOR UPDATE makes a second request with the same token wait, then fail as already used.
    const { rows } = await client.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE',
      [sha256(token)],
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return invalidLink();
    }

    const passwordHash = await hashPassword(password);
    // Bumping session_version marks older sessions as outdated (enforced where session_version is checked).
    await client.query('UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = now() WHERE id = $2', [passwordHash, row.user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, safe_changes)
       VALUES ($1, 'password_reset_completed', 'user', $1, $2, '{}')`,
      [row.user_id, auditRequestId(req)],
    );
    await client.query('COMMIT');

    return res.json({ message: 'Password updated', requestId: req.requestId });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
}

// Own status for any signed-in role, so pending, rejected and suspended users can see it.
export async function getAccountStatus(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT approval_status FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    return res.json({ status: rows[0].approval_status, requestId: req.requestId });
  } catch (error) { next(error); }
}