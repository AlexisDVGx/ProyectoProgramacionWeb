import { query, getClient } from '../config/db.js';

const generarFolio = (prefijo) =>
  `${prefijo}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

export const getVentas = async (req, res, next) => {
  try {
    const ventasRes = await query(
      `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.token_acceso
       FROM ventas_credito v
       JOIN clientes c ON v.cliente_id = c.id
       WHERE c.usuario_id = $1
       ORDER BY v.estado DESC, v.creado_en DESC`,
      [req.user.id]
    );

    const abonosRes = await query(
      `SELECT a.*
       FROM abonos a
       JOIN ventas_credito v ON a.venta_id = v.id
       JOIN clientes c ON v.cliente_id = c.id
       WHERE c.usuario_id = $1
       ORDER BY a.fecha_abono DESC`,
      [req.user.id]
    );

    res.json({
      ok: true,
      ventas: ventasRes.rows,
      abonos: abonosRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createVenta = async (req, res, next) => {
  try {
    const { cliente_id, concepto, monto_total, fecha_venta, sync_uuid } = req.body;

    const clienteCheck = await query(
      'SELECT id, nombre, telefono, token_acceso FROM clientes WHERE id = $1 AND usuario_id = $2 AND activo = TRUE',
      [cliente_id, req.user.id]
    );
    if (clienteCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Cliente no válido.' });
    }

    const total = Number(Number(monto_total).toFixed(2));
    const result = await query(
      `INSERT INTO ventas_credito (cliente_id, concepto, monto_total, saldo_pendiente, estado, fecha_venta, sync_uuid)
       VALUES ($1, $2, $3, $3, 'PENDIENTE', COALESCE($4::date, CURRENT_DATE), $5)
       ON CONFLICT (sync_uuid) DO UPDATE SET concepto = EXCLUDED.concepto
       RETURNING *`,
      [cliente_id, concepto, total, fecha_venta || null, sync_uuid || null]
    );

    res.status(201).json({
      ok: true,
      venta: {
        ...result.rows[0],
        cliente_nombre: clienteCheck.rows[0].nombre,
        cliente_telefono: clienteCheck.rows[0].telefono,
        token_acceso: clienteCheck.rows[0].token_acceso,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addAbono = async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params; // venta_id
    const { monto, notas, folio, sync_uuid } = req.body;
    const montoAbono = Number(Number(monto).toFixed(2));

    await client.query('BEGIN');

    // Si el abono ya se sincronizó previamente por sync_uuid, evitar duplicarlo
    if (sync_uuid) {
      const dupCheck = await client.query('SELECT * FROM abonos WHERE sync_uuid = $1', [sync_uuid]);
      if (dupCheck.rows.length > 0) {
        await client.query('COMMIT');
        return res.json({ ok: true, abono: dupCheck.rows[0], duplicado_omitido: true });
      }
    }

    const ventaRes = await client.query(
      `SELECT v.id, v.saldo_pendiente, v.estado
       FROM ventas_credito v
       JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1 AND c.usuario_id = $2
       FOR UPDATE`,
      [id, req.user.id]
    );

    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, mensaje: 'Venta no encontrada.' });
    }

    const saldoActual = Number(ventaRes.rows[0].saldo_pendiente);
    if (montoAbono <= 0 || montoAbono > saldoActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `El abono debe ser mayor a $0 y no exceder el saldo pendiente ($${saldoActual.toFixed(2)}).`,
      });
    }

    const nuevoSaldo = Number((saldoActual - montoAbono).toFixed(2));
    const nuevoEstado = nuevoSaldo === 0 ? 'LIQUIDADO' : 'PENDIENTE';
    const folioFinal = folio || generarFolio('ABN');

    const abonoRes = await client.query(
      `INSERT INTO abonos (venta_id, monto, folio, notas, sync_uuid)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, montoAbono, folioFinal, notas || null, sync_uuid || null]
    );

    const ventaUpdated = await client.query(
      `UPDATE ventas_credito
       SET saldo_pendiente = $1, estado = $2
       WHERE id = $3
       RETURNING *`,
      [nuevoSaldo, nuevoEstado, id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      abono: abonoRes.rows[0],
      venta: ventaUpdated.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};