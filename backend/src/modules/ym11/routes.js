import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getDashboard,
  getProcurementActivity,
  getBuyingInsights,
  getMarketplaceOverview,
  searchMarketplace,
  getHarvestAvailability,
} from './controller.js';

// YM11 · Meranga Akash · Buyer marketplace
const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/dashboard', verifyToken, authorizeRoles('buyer'), getDashboard);
router.get('/dashboard/procurement-activity', verifyToken, authorizeRoles('buyer'), getProcurementActivity);
router.get('/dashboard/insights', verifyToken, authorizeRoles('buyer'), getBuyingInsights);

router.get('/marketplace', verifyToken, authorizeRoles('buyer'), getMarketplaceOverview);
router.get('/marketplace/search', verifyToken, authorizeRoles('buyer'), searchMarketplace);
router.get('/marketplace/harvest-availability', verifyToken, authorizeRoles('buyer'), getHarvestAvailability);

export default router;
