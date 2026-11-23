import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getOfferDetails,
  getOfferComparison,
  acceptOffer,
  declineOffer,
  getCommitmentsList,
  getCommitmentDetails,
  getChangeProposal,
  approveChange,
  rejectChange,
  cancelCommitment,
} from './controller.js';

// YM14 · Mohomad Mushrif · Offers & commitments
const router = Router();

// Module status & diagnostic endpoint
router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer'), getStatus);

// FR-YM14-02: Multi-offer side-by-side comparison for a demand (Buyer role only)
router.get('/offers/compare/:demandId', verifyToken, authorizeRoles('buyer'), getOfferComparison);

// FR-YM14-01: Received offer details (Buyer role only)
router.get('/offers/:id', verifyToken, authorizeRoles('buyer'), getOfferDetails);

// FR-YM14-01 / FR-YM14-03: Accept offer into commitment & escrow hold (Buyer role only)
router.post('/offers/:id/accept', verifyToken, authorizeRoles('buyer'), acceptOffer);

// FR-YM14-01: Decline received offer with mandatory reason (Buyer role only)
router.post('/offers/:id/decline', verifyToken, authorizeRoles('buyer'), declineOffer);

// FR-YM14-03: Commitments list & filtering (Both Buyer and Farmer roles)
router.get('/commitments', verifyToken, authorizeRoles('buyer', 'farmer'), getCommitmentsList);

// FR-YM14-05: Harvest change review diff & financial impact (Buyer role only)
router.get('/commitments/:id/change-proposal', verifyToken, authorizeRoles('buyer'), getChangeProposal);

// FR-YM14-05: Approve harvest change with escrow refund adjustment (Buyer role only)
router.post('/commitments/:id/approve-change', verifyToken, authorizeRoles('buyer'), approveChange);

// FR-YM14-05: Reject harvest change keeping original terms binding (Buyer role only)
router.post('/commitments/:id/reject-change', verifyToken, authorizeRoles('buyer'), rejectChange);

// FR-YM14-04 / FR-YM14-05: Cancel commitment with mandatory reason and 100% escrow release (Buyer role only)
router.post('/commitments/:id/cancel', verifyToken, authorizeRoles('buyer'), cancelCommitment);

// FR-YM14-04: Commitment details & contract view (Both Buyer and Farmer roles)
router.get('/commitments/:id', verifyToken, authorizeRoles('buyer', 'farmer'), getCommitmentDetails);

export default router;
