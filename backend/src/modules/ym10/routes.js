import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  createOffer,
  getBuyerRequest,
  getStatus,
  listBuyerRequests,
  listMyOffers,
} from './controller.js';
// YM10 · Kasuni Madeesha · Farmer offers
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/buyer-requests', verifyToken, authorizeRoles('farmer'), listBuyerRequests);
router.get('/buyer-requests/:requestId', verifyToken, authorizeRoles('farmer'), getBuyerRequest);
router.post('/buyer-requests/:requestId/offers', verifyToken, authorizeRoles('farmer'), createOffer);
router.get('/offers', verifyToken, authorizeRoles('farmer'), listMyOffers);
export default router;
