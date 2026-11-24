import { query, getClient } from '../config/db.js';

export const pullAllData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [clientes, ventas, abonos, tandas, participantes, tandaPagos, gastos] = await Promise.all([
      query('SELECT * FROM clientes WHERE usuario_id = $1 AND activo = TRUE ORDER BY nombre ASC', [userId]),
      query(
        `SELECT v.* FROM ventas_credito v JOIN clientes c ON v.cliente_id = c.id WHERE c.usuario_id = $1`,
        [userId]
      ),
      query(
        `SELECT a.* FROM abonos a JOIN ventas_credito v ON a.venta_id = v.id JOIN clientes c ON v.cliente_id = c.id WHERE c.usuario_id = $1`,
        [userId]
      ),
      query('SELECT * FROM tandas WHERE usuario_id = $1', [userId]),
      query(
        `SELECT tp.* FROM tanda_participantes tp JOIN tandas t ON tp.tanda_id = t.id WHERE t.usuario_id = $1`,
        [userId]
      ),
      query(
        `SELECT pg.* FROM tanda_pagos pg JOIN tanda_participantes tp ON pg.participante_id = tp.id JOIN tandas t ON tp.tanda_id = t.id WHERE t.usuario_id = $1`,
        [userId]
      ),
      query('SELECT * FROM gastos WHERE usuario_id = $1 ORDER BY fecha_gasto DESC', [userId]),
    ]);

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      data: {
        clientes: clientes.rows,
        ventas_credito: ventas.rows,
        abonos: abonos.rows,
        tandas: tandas.rows,
        tanda_participantes: participantes.rows,
        tanda_pagos: tandaPagos.rows,
        gastos: gastos.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const pushOfflineBatch = async (req, res, next) => {
  const client = await getClient();
  try {
    const userId = req.user.id;
    const { clientes = [], ventas = [], abonos = [], tanda_pagos = [], gastos = [] } = req.body;

    await client.query('BEGIN');

    // 1. Sincronizar clientes nuevos creados offline (usando token_acceso como llave natural)
    for (const c of clientes) {
      await client.query(
        `INSERT INTO clientes (usuario_id, nombre, telefono, notas, token_acceso)
         VALUES ($1, $2, $3, $4, $5::uuid)
         ON CONFLICT (token_acceso) DO NOTHING`,
        [userId, c.nombre, c.telefono, c.notas || null, c.token_acceso]
      );
    }

    // 2. Sincronizar ventas a crédito creadas offline
    for (const v of ventas) {
      // Resolver cliente_id real mediante token_acceso si se creó offline
      let clienteIdReal = v.cliente_id;
      if (v.cliente_token) {
        const cRes = await client.query('SELECT id FROM clientes WHERE token_acceso = $1::uuid', [v.cliente_token]);
        if (cRes.rows.length > 0) clienteIdReal = cRes.rows[0].id;
      }

      if (clienteIdReal) {
        const total = Number(Number(v.monto_total).toFixed(2));
        await client.query(
          `INSERT INTO ventas_credito (cliente_id, concepto, monto_total, saldo_pendiente, estado, fecha_venta, sync_uuid)
           VALUES ($1, $2, $3, $3, 'PENDIENTE', COALESCE($4::date, CURRENT_DATE), $5::uuid)
           ON CONFLICT (sync_uuid) DO NOTHING`,
          [clienteIdReal, v.concepto, total, v.fecha_venta || null, v.sync_uuid]
        );
      }
    }

    // 3. Sincronizar abonos capturados offline y recalcular saldos
    for (const a of abonos) {
      const dup = await client.query('SELECT id FROM abonos WHERE sync_uuid = $1::uuid', [a.sync_uuid]);
      if (dup.rows.length > 0) continue;

      let ventaIdReal = a.venta_id;
      if (a.venta_sync_uuid) {
        const vRes = await client.query('SELECT id FROM ventas_credito WHERE sync_uuid = $1::uuid', [a.venta_sync_uuid]);
        if (vRes.rows.length > 0) ventaIdReal = vRes.rows[0].id;
      }

      if (ventaIdReal) {
        const ventaRow = await client.query(
          'SELECT saldo_pendiente FROM ventas_credito WHERE id = $1 FOR UPDATE',
          [ventaIdReal]
        );
        if (ventaRow.rows.length > 0) {
          const saldoActual = Number(ventaRow.rows[0].saldo_pendiente);
          const montoAbono = Math.min(Number(Number(a.monto).toFixed(2)), saldoActual);
          if (montoAbono > 0) {
            const nuevoSaldo = Number((saldoActual - montoAbono).toFixed(2));
            const nuevoEstado = nuevoSaldo === 0 ? 'LIQUIDADO' : 'PENDIENTE';

            await client.query(
              `INSERT INTO abonos (venta_id, monto, fecha_abono, folio, notas, sync_uuid)
               VALUES ($1, $2, COALESCE($3::timestamptz, CURRENT_TIMESTAMP), $4, $5, $6::uuid)`,
              [ventaIdReal, montoAbono, a.fecha_abono || null, a.folio, a.notas || null, a.sync_uuid]
            );
            await client.query(
              'UPDATE ventas_credito SET saldo_pendiente = $1, estado = $2 WHERE id = $3',
              [nuevoSaldo, nuevoEstado, ventaIdReal]
            );
          }
        }
      }
    }

    // 4. Sincronizar pagos de tanda capturados offline
    for (const pg of tanda_pagos) {
      await client.query(
        `INSERT INTO tanda_pagos (participante_id, numero_ronda, monto_pagado, fecha_pago, folio, sync_uuid)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP), $5, $6::uuid)
         ON CONFLICT (sync_uuid) DO NOTHING`,
        [pg.participante_id, pg.numero_ronda, pg.monto_pagado, pg.fecha_pago || null, pg.folio, pg.sync_uuid]
      );
    }

    // 5. Sincronizar gastos capturados offline
    for (const g of gastos) {
      await client.query(
        `INSERT INTO gastos (usuario_id, categoria, descripcion, monto, fecha_gasto, sync_uuid)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6::uuid)
         ON CONFLICT (sync_uuid) DO NOTHING`,
        [userId, g.categoria, g.descripcion, g.monto, g.fecha_gasto || null, g.sync_uuid]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Sincronización completada correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};