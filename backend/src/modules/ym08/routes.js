import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getMyHarvestBatches,
  getBatchFormOptions,
  createHarvestBatch,
  getHarvestBatch,
  updateHarvestBatch
} from './controller.js';
// YM08 · Imalka Deshan · Harvest management
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/harvest-batches', verifyToken, authorizeRoles('farmer'), getMyHarvestBatches);
router.get('/form-options', verifyToken, authorizeRoles('farmer'), getBatchFormOptions);
router.post('/harvest-batches', verifyToken, authorizeRoles('farmer'), createHarvestBatch);
router.get('/harvest-batches/:id', verifyToken, authorizeRoles('farmer'), getHarvestBatch);
router.patch('/harvest-batches/:id', verifyToken, authorizeRoles('farmer'), updateHarvestBatch);
export default router;