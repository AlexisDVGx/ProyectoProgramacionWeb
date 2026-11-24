import { Router } from 'express';
import { body, param } from 'express-validator';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../controllers/clientesController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/errorHandler.js';

const router = Router();
router.use(verifyToken);

router.get('/', getClientes);

router.post(
  '/',
  [
    body('nombre').trim().escape().notEmpty().withMessage('Nombre requerido'),
    body('telefono').trim().isLength({ min: 8, max: 15 }).withMessage('Teléfono inválido'),
    body('notas').optional({ nullable: true }).trim().escape(),
    body('token_acceso').optional({ nullable: true }).isUUID(),
    validateRequest,
  ],
  createCliente
);

router.put(
  '/:id',
  [
    param('id').isInt(),
    body('nombre').trim().escape().notEmpty(),
    body('telefono').trim().isLength({ min: 8, max: 15 }),
    body('notas').optional({ nullable: true }).trim().escape(),
    validateRequest,
  ],
  updateCliente
);

router.delete('/:id', [param('id').isInt(), validateRequest], deleteCliente);

export default router;