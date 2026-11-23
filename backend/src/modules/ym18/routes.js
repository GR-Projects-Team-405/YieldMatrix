import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getOrders, getOrderDetails, getOrderTimeline, getOrderDelivery } from './controller.js';


const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/orders', verifyToken, authorizeRoles('buyer'), getOrders);
router.get('/orders/:id', verifyToken, authorizeRoles('buyer'), getOrderDetails);
router.get('/orders/:id/timeline', verifyToken, authorizeRoles('buyer'), getOrderTimeline);
router.get('/orders/:id/delivery', verifyToken, authorizeRoles('buyer'), getOrderDelivery);

export default router;
