import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getProfile } from '../controllers/authController.js';
import { validateRequest } from '../middlewares/errorHandler.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post(
  '/register',
  [
    body('nombre').trim().escape().notEmpty().withMessage('El nombre es obligatorio'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Correo inválido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('negocio_nombre').optional().trim().escape(),
    validateRequest,
  ],
  register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Correo inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    validateRequest,
  ],
  login
);

router.get('/me', verifyToken, getProfile);

export default router;