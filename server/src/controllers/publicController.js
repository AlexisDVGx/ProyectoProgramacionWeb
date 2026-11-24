import { query } from '../config/db.js';

export const getEstadoCuentaPublico = async (req, res, next) => {
  try {
    const { token } = req.params;

    const clienteRes = await query(
      `SELECT c.id, c.nombre, c.telefono, u.negocio_nombre
       FROM clientes c
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.token_acceso = $1::uuid AND c.activo = TRUE`,
      [token]
    );

    if (clienteRes.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Enlace de estado de cuenta no válido.' });
    }

    const cliente = clienteRes.rows[0];

    const ventasRes = await query(
      `SELECT id, concepto, monto_total, saldo_pendiente, estado, fecha_venta
       FROM ventas_credito
       WHERE cliente_id = $1
       ORDER BY estado DESC, fecha_venta DESC`,
      [cliente.id]
    );

    const abonosRes = await query(
      `SELECT a.id, a.venta_id, a.monto, a.fecha_abono, a.folio, a.notas
       FROM abonos a
       JOIN ventas_credito v ON a.venta_id = v.id
       WHERE v.cliente_id = $1
       ORDER BY a.fecha_abono DESC`,
      [cliente.id]
    );

    const tandasRes = await query(
      `SELECT tp.id AS participante_id, tp.numero_turno, tp.fecha_entrega_estimada, tp.entregado,
              t.nombre AS tanda_nombre, t.monto_aportacion, t.frecuencia, t.total_rondas
       FROM tanda_participantes tp
       JOIN tandas t ON tp.tanda_id = t.id
       WHERE tp.cliente_id = $1`,
      [cliente.id]
    );

    const pagosTandaRes = await query(
      `SELECT pg.id, pg.participante_id, pg.numero_ronda, pg.monto_pagado, pg.fecha_pago, pg.folio
       FROM tanda_pagos pg
       JOIN tanda_participantes tp ON pg.participante_id = tp.id
       WHERE tp.cliente_id = $1
       ORDER BY pg.numero_ronda ASC`,
      [cliente.id]
    );

    res.json({
      ok: true,
      negocio: cliente.negocio_nombre,
      cliente: { nombre: cliente.nombre, telefono: cliente.telefono },
      ventas: ventasRes.rows,
      abonos: abonosRes.rows,
      tandas: tandasRes.rows,
      tanda_pagos: pagosTandaRes.rows,
    });
  } catch (error) {
    next(error);
  }
};