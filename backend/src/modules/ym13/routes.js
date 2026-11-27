import express from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { 
  getMyDemands, createDemand, getDemandDetails, updateDemand, getDemandResponses ,updateOfferStatus
} from './controller.js';

const router = express.Router();

// Protect ALL routes in this file: must be logged in AND must be a 'buyer'
router.use(verifyToken, authorizeRoles('buyer'));

router.get('/demands', getMyDemands);
router.post('/demands', createDemand);
router.get('/demands/:id', getDemandDetails);
router.patch('/demands/:id', updateDemand);
router.get('/demands/:id/responses', getDemandResponses);
router.patch('/demands/:demandId/responses/:offerId', updateOfferStatus);


export default router;