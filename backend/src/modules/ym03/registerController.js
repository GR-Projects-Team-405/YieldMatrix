
import pool from '../../config/db.js';
import { validateRegistration } from './validation.js';
import { hashPassword } from './passwordHasher.js';

import {
  createFarmerRegistration,
  RegistrationConflictError,
} from './registrationService.js';

import {
  createBuyerRegistration,
} from './buyerRegistrationService.js';

import {
  createDriverRegistration,
} from './driverRegistrationService.js';

/**
 * YM-03 registration controller.
 *
 * Dependency injection allows database-free unit tests.
 * Production uses the existing PostgreSQL pool.
 */
export function createRegisterAccountHandler({
  dbPool = pool,
  passwordHasher = hashPassword,
  farmerService = createFarmerRegistration,
  buyerService = createBuyerRegistration,
  driverService = createDriverRegistration,
  registrationEnabled = () =>
    process.env.YM03_REGISTRATION_ENABLED === 'true',
  profilesEnabled = () =>
    process.env.YM03_PROFILES_ENABLED === 'true',
} = {}) {
  return async function handleRegistration(req, res, next) {
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

      // No real registration while the feature is disabled.
      if (!registrationEnabled()) {
        const isFarmer = data.role === 'farmer';

        return res.status(501).json({
          error: isFarmer
            ? 'Registration is not yet available'
            : 'Registration for this role is not yet available',
          code: isFarmer
            ? 'REGISTRATION_NOT_IMPLEMENTED'
            : 'ROLE_REGISTRATION_NOT_IMPLEMENTED',
          requestId: req.requestId,
        });
      }

      // Buyer/Driver need the approved profile migration.
      if (data.role !== 'farmer' && !profilesEnabled()) {
        return res.status(501).json({
          error: 'Registration for this role is not yet available',
          code: 'ROLE_REGISTRATION_NOT_IMPLEMENTED',
          requestId: req.requestId,
        });
      }

      const services = {
        farmer: farmerService,
        buyer: buyerService,
        driver: driverService,
      };

      const registration = await services[data.role]({
        pool: dbPool,
        hashPassword: passwordHasher,
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
        const field = error.field === 'registrationNumber'
          ? 'registrationNumber'
          : 'email';

        return res.status(409).json({
          error: field === 'email'
            ? 'An account with this email already exists'
            : 'This vehicle registration is already registered',
          fields: {
            [field]: field === 'email'
              ? 'Email already registered'
              : 'Vehicle registration already registered',
          },
          requestId: req.requestId,
        });
      }

      return next(error);
    }
  };
}

export const registerAccount = createRegisterAccountHandler();
