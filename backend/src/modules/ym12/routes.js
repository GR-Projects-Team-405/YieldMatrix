import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getProduceDetails, getSupplierProfile, getSupplierPerformance, getComparison } from './controller.js';
// YM12 · MHD Muhthas · Produce & suppliers
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/produce/:listingId', verifyToken, authorizeRoles('buyer'), getProduceDetails);
router.get('/suppliers/:supplierId', verifyToken, authorizeRoles('buyer'), getSupplierProfile);
router.get('/suppliers/:supplierId/performance', verifyToken, authorizeRoles('buyer'), getSupplierPerformance);
router.get('/comparison', verifyToken, authorizeRoles('buyer'), getComparison);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
