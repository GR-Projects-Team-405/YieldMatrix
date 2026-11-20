import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getOrders, getOrderDetails, getOrderTimeline } from './controller.js';

// YM18 · Nipuni Thakshila · Buyer orders
const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/orders', verifyToken, authorizeRoles('buyer'), getOrders);
router.get('/orders/:id', verifyToken, authorizeRoles('buyer'), getOrderDetails);
router.get('/orders/:id/timeline', verifyToken, authorizeRoles('buyer'), getOrderTimeline);

export default router;
