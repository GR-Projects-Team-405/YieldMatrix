import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getProduceListings,
  getProduceListingById,
  updateProduceListing,
} from './controller.js';

// YM09 · Imalka Randev · Produce listings
const router = Router();

router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/produce', verifyToken, authorizeRoles('farmer'), getProduceListings);
router.get('/produce/:id', verifyToken, authorizeRoles('farmer'), getProduceListingById);
router.put('/produce/:id', verifyToken, authorizeRoles('farmer'), updateProduceListing);

export default router;
