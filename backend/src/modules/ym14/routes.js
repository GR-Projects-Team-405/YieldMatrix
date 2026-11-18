import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getOfferDetails,
  getCommitmentsList,
  getCommitmentDetails,
} from './controller.js';

// YM14 · Mohomad Mushrif · Offers & commitments
const router = Router();

// Module status & diagnostic endpoint
router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer'), getStatus);

// FR-YM14-01: Received offer details (Buyer role only)
router.get('/offers/:id', verifyToken, authorizeRoles('buyer'), getOfferDetails);

// FR-YM14-03: Commitments list & filtering (Both Buyer and Farmer roles)
router.get('/commitments', verifyToken, authorizeRoles('buyer', 'farmer'), getCommitmentsList);

// FR-YM14-04: Commitment details & contract view (Both Buyer and Farmer roles)
router.get('/commitments/:id', verifyToken, authorizeRoles('buyer', 'farmer'), getCommitmentDetails);

export default router;