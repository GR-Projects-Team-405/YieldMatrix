
import { Router } from 'express';

import {
  verifyToken,
  authorizeRoles,
} from '../../middleware/authMiddleware.js';

import { getStatus } from './controller.js';
import { registerAccount } from './registerController.js';
import { loginAccount } from './loginController.js';
import {
  checkApprovalStatus,
} from './approvalStatusController.js';

const router = Router();

/**
 * YM-03 Public endpoints
 */

// Farmer, Buyer and Driver registration
router.post('/register', registerAccount);

// Farmer, Buyer and Driver login
router.post('/login', loginAccount);

router.post('/approval-status', checkApprovalStatus);

/**
 * YM-03 Protected endpoints
 */

router.get(
  '/status',
  verifyToken,
  authorizeRoles('farmer', 'buyer', 'driver', 'admin'),
  getStatus
);

export default router;
