import { query } from '../config/db.js';

export const getGastos = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM gastos WHERE usuario_id = $1 ORDER BY fecha_gasto DESC, creado_en DESC',
      [req.user.id]
    );
    res.json({ ok: true, gastos: result.rows });
  } catch (error) {
    next(error);
  }
};

export const createGasto = async (req, res, next) => {
  try {
    const { categoria, descripcion, monto, fecha_gasto, sync_uuid } = req.body;
    const result = await query(
      `INSERT INTO gastos (usuario_id, categoria, descripcion, monto, fecha_gasto, sync_uuid)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
       ON CONFLICT (sync_uuid) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING *`,
      [req.user.id, categoria, descripcion, Number(monto).toFixed(2), fecha_gasto || null, sync_uuid || null]
    );
    res.status(201).json({ ok: true, gasto: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const deleteGasto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM gastos WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Gasto no encontrado.' });
    }
    res.json({ ok: true, mensaje: 'Gasto eliminado.' });
  } catch (error) {
    next(error);
  }
};