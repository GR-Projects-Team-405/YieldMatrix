import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getOrders,
  getOrderDetails,
  getOrderTimeline,
  getOrderDelivery,
  cancelOrder
} from './controller.js';

// YM18 · Nipuni Thakshila · Buyer orders
const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer', 'admin'), getStatus);
router.get('/orders', verifyToken, authorizeRoles('buyer', 'admin'), getOrders);
router.get('/orders/:id', verifyToken, authorizeRoles('buyer', 'admin'), getOrderDetails);
router.get('/orders/:id/timeline', verifyToken, authorizeRoles('buyer', 'admin'), getOrderTimeline);
router.get('/orders/:id/delivery', verifyToken, authorizeRoles('buyer', 'admin'), getOrderDelivery);
router.post('/orders/:id/cancel', verifyToken, authorizeRoles('buyer', 'admin'), cancelOrder);

export default router;
