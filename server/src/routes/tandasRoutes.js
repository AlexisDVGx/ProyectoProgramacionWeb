import { Router } from 'express';
import { body, param } from 'express-validator';
import { getTandas, createTanda, addPagoTanda, marcarEntregaTurno } from '../controllers/tandasController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/errorHandler.js';

const router = Router();
router.use(verifyToken);

router.get('/', getTandas);

router.post(
  '/',
  [
    body('nombre').trim().escape().notEmpty(),
    body('monto_aportacion').isFloat({ gt: 0 }),
    body('frecuencia').isIn(['SEMANAL', 'QUINCENAL']),
    body('total_rondas').isInt({ min: 2 }),
    body('fecha_inicio').isISO8601(),
    validateRequest,
  ],
  createTanda
);

router.post(
  '/:id/pagos',
  [
    param('id').isInt(),
    body('participante_id').isInt(),
    body('numero_ronda').isInt({ min: 1 }),
    body('sync_uuid').optional({ nullable: true }).isUUID(),
    validateRequest,
  ],
  addPagoTanda
);

router.patch(
  '/:id/participantes/:participanteId/entregar',
  [param('id').isInt(), param('participanteId').isInt(), body('entregado').isBoolean(), validateRequest],
  marcarEntregaTurno
);

export default router;