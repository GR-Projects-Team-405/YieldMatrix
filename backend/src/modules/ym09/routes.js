import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getProduceListings,
  getProduceListingById,
  getProduceListingDetails,
  createProduceListing,
  updateProduceListing,
  updateProduceListingStatus,
} from './controller.js';

// YM09 · Imalka Randev · Produce listings
const router = Router();

router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/produce', verifyToken, authorizeRoles('farmer'), getProduceListings);
router.post('/produce', verifyToken, authorizeRoles('farmer'), createProduceListing);
router.get('/produce/:id/details', verifyToken, authorizeRoles('farmer'), getProduceListingDetails);
router.get('/produce/:id', verifyToken, authorizeRoles('farmer'), getProduceListingById);
router.put('/produce/:id', verifyToken, authorizeRoles('farmer'), updateProduceListing);
router.patch('/produce/:id/status', verifyToken, authorizeRoles('farmer'), updateProduceListingStatus);

export default router;
