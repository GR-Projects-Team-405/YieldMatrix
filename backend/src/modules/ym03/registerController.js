
import pool from '../../config/db.js';

import { validateRegistration } from './validation.js';
import { hashPassword } from './passwordHasher.js';

import {
  createFarmerRegistration,
  RegistrationConflictError,
} from './registrationService.js';

export async function registerAccount(req, res, next) {
  try {
    const validation = validateRegistration(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Registration validation failed',
        fields: validation.errors,
        requestId: req.requestId,
      });
    }

    const data = validation.value;

    // Buyer and Driver need the approved storage schema.
    // Never discard their required registration details.
    if (data.role !== 'farmer') {
      return res.status(501).json({
        error: 'Registration for this role is not yet available',
        code: 'ROLE_REGISTRATION_NOT_IMPLEMENTED',
        requestId: req.requestId,
      });
    }

    // Explicit opt-in protects the shared Neon database.
    if (process.env.YM03_REGISTRATION_ENABLED !== 'true') {
      return res.status(501).json({
        error: 'Registration is not yet available',
        code: 'REGISTRATION_NOT_IMPLEMENTED',
        requestId: req.requestId,
      });
    }

    const registration = await createFarmerRegistration({
      pool,
      hashPassword,
      data,
    });

    return res.status(201).json({
      message: 'Registration submitted for approval',
      registrationId: registration.registrationId,
      role: registration.role,
      approvalStatus: registration.approvalStatus,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error instanceof RegistrationConflictError) {
      return res.status(409).json({
        error: 'An account with this email already exists',
        fields: {
          email: 'Email already registered',
        },
        requestId: req.requestId,
      });
    }

    next(error);
  }
}
