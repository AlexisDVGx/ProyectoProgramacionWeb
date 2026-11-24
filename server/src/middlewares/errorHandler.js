import { validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Datos de entrada inválidos',
      errores: errors.array().map((err) => ({
        campo: err.path,
        mensaje: err.msg,
      })),
    });
  }
  next();
};

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  // Manejo de errores específicos de PostgreSQL (ej. llaves duplicadas o restricciones CHECK)
  if (err.code === '23505') {
    return res.status(409).json({
      ok: false,
      mensaje: 'El registro ya existe (conflicto de unicidad).',
    });
  }

  if (err.code === '23514' || err.code === '23503') {
    return res.status(400).json({
      ok: false,
      mensaje: 'Operación rechazada por integridad de datos.',
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    mensaje: err.statusCode ? err.message : 'Error interno del servidor',
  });
};