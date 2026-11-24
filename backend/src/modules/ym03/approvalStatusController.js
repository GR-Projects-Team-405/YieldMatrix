
import pool from '../../config/db.js';

import {
  hashPassword,
  verifyPassword,
} from './passwordHasher.js';

import {
  InvalidCredentialsError,
} from './loginService.js';

import {
  getRegistrationApprovalStatus,
} from './approvalStatusService.js';

import {
  createLoginRateLimiter,
} from './loginRateLimiter.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limiter = createLoginRateLimiter();

// Use a dummy hash for unknown accounts.
// Do not create a new hash for every request.
let dummyHashPromise;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      'YM03ApprovalDummyPassword2026!'
    ).catch((error) => {
      dummyHashPromise = undefined;
      throw error;
    });
  }

  return dummyHashPromise;
}

export function createApprovalStatusHandler({
  dbPool = pool,
  passwordVerifier = verifyPassword,
  dummyHashProvider = getDummyHash,
  lookupStatus = getRegistrationApprovalStatus,
  rateLimiter = limiter,
} = {}) {
  return async function approvalStatus(req, res, next) {
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
        error: 'Invalid approval status request',
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

    if (
      email.length > 254 ||
      !EMAIL_PATTERN.test(email) ||
      !password ||
      password.length > 128
    ) {
      return res.status(422).json({
        error: 'Invalid email or password',
        requestId: req.requestId,
      });
    }

    const ip = req.ip || 'unknown';

    if (rateLimiter.isLimited(ip, email)) {
      return res.status(429).json({
        error: 'Too many attempts. Try again later.',
        requestId: req.requestId,
      });
    }

    try {
      const result = await lookupStatus({
        pool: dbPool,
        verifyPassword: passwordVerifier,
        dummyHash: await dummyHashProvider(),
        email,
        password,
      });

      rateLimiter.clear(ip, email);

      return res.status(200).json({
        registrationId: result.registrationId,
        role: result.role,
        approvalStatus: result.approvalStatus,
        reason: result.reason,
        requestId: req.requestId,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        rateLimiter.recordFailure(ip, email);

        return res.status(401).json({
          error: 'Email or password is incorrect',
          requestId: req.requestId,
        });
      }

      return next(error);
    }
  };
}

export const checkApprovalStatus =
  createApprovalStatusHandler();
