import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getCompletedOrders, getFarmerPriceAlerts, getMarketInsights, getOverview, getSalesPerformance, getStatus, getUpcomingHarvests, saveFarmerPriceAlert } from './controller.js';
// YM06 · Eshan Harshana · Farmer overview
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/overview', verifyToken, authorizeRoles('farmer'), getOverview);
router.get('/sales', verifyToken, authorizeRoles('farmer'), getSalesPerformance);
router.get('/harvests', verifyToken, authorizeRoles('farmer'), getUpcomingHarvests);
router.get('/completed-orders', verifyToken, authorizeRoles('farmer'), getCompletedOrders);
router.get('/market-insights', verifyToken, authorizeRoles('farmer'), getMarketInsights);
router.get('/price-alerts', verifyToken, authorizeRoles('farmer'), getFarmerPriceAlerts);
router.post('/price-alerts', verifyToken, authorizeRoles('farmer'), saveFarmerPriceAlert);
export default router;
