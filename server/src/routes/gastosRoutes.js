import { Router } from 'express';
import { body, param } from 'express-validator';
import { getGastos, createGasto, deleteGasto } from '../controllers/gastosController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/errorHandler.js';

const router = Router();
router.use(verifyToken);

router.get('/', getGastos);

router.post(
  '/',
  [
    body('categoria').isIn(['HOGAR', 'SURTIDO', 'OTROS']),
    body('descripcion').trim().escape().notEmpty(),
    body('monto').isFloat({ gt: 0 }),
    body('sync_uuid').optional({ nullable: true }).isUUID(),
    validateRequest,
  ],
  createGasto
);

router.delete('/:id', [param('id').isInt(), validateRequest], deleteGasto);

export default router;