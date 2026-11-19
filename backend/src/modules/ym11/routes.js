import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getDashboard,
  getProcurementActivity,
  getBuyingInsights,
} from './controller.js';

// YM11 · Meranga Akash · Buyer marketplace
const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/dashboard', verifyToken, authorizeRoles('buyer'), getDashboard);
router.get('/dashboard/procurement-activity', verifyToken, authorizeRoles('buyer'), getProcurementActivity);
router.get('/dashboard/insights', verifyToken, authorizeRoles('buyer'), getBuyingInsights);

export default router;
