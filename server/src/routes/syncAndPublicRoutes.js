import { Router } from 'express';
import { param } from 'express-validator';
import { pullAllData, pushOfflineBatch } from '../controllers/syncController.js';
import { getEstadoCuentaPublico } from '../controllers/publicController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/errorHandler.js';

const router = Router();

// Portal público de solo lectura por token UUID (sin JWT)
router.get('/public/:token', [param('token').isUUID(), validateRequest], getEstadoCuentaPublico);

// Endpoints de sincronización Offline-First (requieren JWT)
router.get('/sync/pull', verifyToken, pullAllData);
router.post('/sync/push', verifyToken, pushOfflineBatch);

export default router;