
import pool from '../../config/db.js';

import {
  hashPassword,
  verifyPassword,
} from './passwordHasher.js';

import {
  authenticateUser,
  InvalidCredentialsError,
  AccountRestrictedError,
} from './loginService.js';

import {
  createLoginRateLimiter,
} from './loginRateLimiter.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate the dummy hash lazily, then reuse it.
// No database connection is required for this operation.
let dummyHashPromise;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      'YM03DummyPassword2026!NotAnAccount'
    ).catch((error) => {
      dummyHashPromise = undefined;
      throw error;
    });
  }

  return dummyHashPromise;
}

const sharedLimiter = createLoginRateLimiter();

export function createLoginHandler({
  dbPool = pool,
  passwordVerifier = verifyPassword,
  dummyHashProvider = getDummyHash,
  authenticate = authenticateUser,
  jwtSecret = () => process.env.JWT_SECRET,
  limiter = sharedLimiter,
} = {}) {
  return async function login(req, res, next) {
    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => key !== 'email' && key !== 'password'
      )
    ) {
      return res.status(422).json({
        error: 'Invalid login request',
        requestId: req.requestId,
      });
    }

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password =
      typeof body.password === 'string'
        ? body.password
        : '';

    const fields = {};

    if (
      email.length > 254 ||
      !EMAIL_PATTERN.test(email)
    ) {
      fields.email = 'Enter a valid email address';
    }

    if (!password || password.length > 128) {
      fields.password = 'Enter your password';
    }

    if (Object.keys(fields).length > 0) {
      return res.status(422).json({
        error: 'Invalid login request',
        fields,
        requestId: req.requestId,
      });
    }

    const ip = req.ip || 'unknown';

    if (limiter.isLimited(ip, email)) {
      return res.status(429).json({
        error: 'Too many login attempts. Try again later.',
        requestId: req.requestId,
      });
    }

    try {
      const result = await authenticate({
        pool: dbPool,
        verifyPassword: passwordVerifier,
        dummyHash: await dummyHashProvider(),
        email,
        password,
        jwtSecret: jwtSecret(),
      });

      limiter.clear(ip, email);

      return res.status(200).json({
        token: result.token,
        user: result.user,
        requestId: req.requestId,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        limiter.recordFailure(ip, email);

        return res.status(401).json({
          error: 'Email or password is incorrect',
          requestId: req.requestId,
        });
      }

      if (error instanceof AccountRestrictedError) {
        return res.status(403).json({
          error: 'Account access is restricted',
          approvalStatus: error.approvalStatus,
          requestId: req.requestId,
        });
      }

      return next(error);
    }
  };
}

export const loginAccount = createLoginHandler();
