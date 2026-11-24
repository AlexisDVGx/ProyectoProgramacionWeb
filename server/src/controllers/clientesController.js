import { query } from '../config/db.js';

export const getClientes = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.nombre, c.telefono, c.notas, c.token_acceso, c.activo, c.creado_en,
              COALESCE(SUM(v.saldo_pendiente) FILTER (WHERE v.estado = 'PENDIENTE'), 0) AS deuda_actual
       FROM clientes c
       LEFT JOIN ventas_credito v ON c.id = v.cliente_id
       WHERE c.usuario_id = $1 AND c.activo = TRUE
       GROUP BY c.id
       ORDER BY c.nombre ASC`,
      [req.user.id]
    );
    res.json({ ok: true, clientes: result.rows });
  } catch (error) {
    next(error);
  }
};

export const createCliente = async (req, res, next) => {
  try {
    const { nombre, telefono, notas, token_acceso } = req.body;
    const result = await query(
      `INSERT INTO clientes (usuario_id, nombre, telefono, notas, token_acceso)
       VALUES ($1, $2, $3, $4, COALESCE($5::uuid, gen_random_uuid()))
       ON CONFLICT (token_acceso) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, nombre, telefono, notas, token_acceso, activo, creado_en`,
      [req.user.id, nombre, telefono, notas || null, token_acceso || null]
    );
    res.status(201).json({ ok: true, cliente: { ...result.rows[0], deuda_actual: '0.00' } });
  } catch (error) {
    next(error);
  }
};

export const updateCliente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, notas } = req.body;

    const result = await query(
      `UPDATE clientes
       SET nombre = $1, telefono = $2, notas = $3
       WHERE id = $4 AND usuario_id = $5 AND activo = TRUE
       RETURNING id, nombre, telefono, notas, token_acceso, activo, creado_en`,
      [nombre, telefono, notas || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado.' });
    }
    res.json({ ok: true, cliente: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const deleteCliente = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Borrado lógico para preservar historial de ventas y recibos previos
    const result = await query(
      `UPDATE clientes SET activo = FALSE
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado.' });
    }
    res.json({ ok: true, mensaje: 'Cliente eliminado del directorio.' });
  } catch (error) {
    next(error);
  }
};