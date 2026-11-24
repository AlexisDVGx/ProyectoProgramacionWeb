import { Router } from 'express';
import { body, param } from 'express-validator';
import { getVentas, createVenta, addAbono } from '../controllers/ventasController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/errorHandler.js';

const router = Router();
router.use(verifyToken);

router.get('/', getVentas);

router.post(
  '/',
  [
    body('cliente_id').isInt().withMessage('Cliente inválido'),
    body('concepto').trim().escape().notEmpty().withMessage('Concepto requerido'),
    body('monto_total').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
    body('sync_uuid').optional({ nullable: true }).isUUID(),
    validateRequest,
  ],
  createVenta
);

router.post(
  '/:id/abonos',
  [
    param('id').isInt(),
    body('monto').isFloat({ gt: 0 }).withMessage('El abono debe ser mayor a 0'),
    body('notas').optional({ nullable: true }).trim().escape(),
    body('sync_uuid').optional({ nullable: true }).isUUID(),
    validateRequest,
  ],
  addAbono
);

export default router;