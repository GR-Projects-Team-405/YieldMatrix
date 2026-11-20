import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getSummary,
  getDeliveries,
  getAllocationDetail,
  acceptFullDelivery,
  acceptPartialDelivery,
  raiseFullDispute,
  getDisputes,
  getDisputeDetail
} from './controller.js';

// YM19 · Pasan Kalhara · Acceptance & disputes
const router = Router();

// Module status & summary metrics
router.get('/status', verifyToken, authorizeRoles('buyer', 'admin'), getStatus);
router.get('/summary', verifyToken, authorizeRoles('buyer', 'admin'), getSummary);

// Delivery acceptance review
router.get('/deliveries', verifyToken, authorizeRoles('buyer', 'admin'), getDeliveries);
router.get('/allocations/:id', verifyToken, authorizeRoles('buyer', 'admin'), getAllocationDetail);
router.post('/allocations/:id/accept', verifyToken, authorizeRoles('buyer', 'admin'), acceptFullDelivery);
router.post('/allocations/:id/partial-accept', verifyToken, authorizeRoles('buyer', 'admin'), acceptPartialDelivery);
router.post('/allocations/:id/dispute', verifyToken, authorizeRoles('buyer', 'admin'), raiseFullDispute);

// Disputes management
router.get('/disputes', verifyToken, authorizeRoles('buyer', 'admin'), getDisputes);
router.get('/disputes/:id', verifyToken, authorizeRoles('buyer', 'admin'), getDisputeDetail);

export default router;
