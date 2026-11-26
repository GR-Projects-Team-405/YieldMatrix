import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  categories,
  districts,
  getStatus,
  harvestDetails,
  harvestTraceability,
  harvests,
  landing,
  roles,
} from './controller.js';

const router = Router();
router.get('/landing', landing);
router.get('/harvests', harvests);
router.get('/harvests/:id/traceability', harvestTraceability);
router.get('/harvests/:id', harvestDetails);
router.get('/categories', categories);
router.get('/districts', districts);
router.get('/roles', roles);
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);

export default router;
