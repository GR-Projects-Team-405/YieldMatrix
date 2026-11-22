
import { Router } from 'express';

import {
  verifyToken,
  authorizeRoles,
} from '../../middleware/authMiddleware.js';

import { getStatus } from './controller.js';
import { registerAccount } from './registerController.js';

const router = Router();

// Public registration: validation-only at this checkpoint.
router.post('/register', registerAccount);

// Existing protected status endpoint.
router.get(
  '/status',
  verifyToken,
  authorizeRoles('farmer', 'buyer', 'driver', 'admin'),
  getStatus
);

export default router;
