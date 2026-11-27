import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  archiveFarm, createFarm, getFarm, getStatus, listFarms,
  requireApprovedFarmer, updateFarm, validateFarmId
} from './controller.js';

const router = Router();
const farmerAccess = [verifyToken, authorizeRoles('farmer'), requireApprovedFarmer];

router.get('/status', farmerAccess, getStatus);
router.get('/farms', farmerAccess, listFarms);
router.post('/farms', farmerAccess, createFarm);
router.get('/farms/:farmId', farmerAccess, validateFarmId, getFarm);
router.patch('/farms/:farmId', farmerAccess, validateFarmId, updateFarm);
router.patch('/farms/:farmId/archive', farmerAccess, validateFarmId, archiveFarm);

export default router;
