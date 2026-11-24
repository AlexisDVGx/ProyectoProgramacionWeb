import { query, getClient } from '../config/db.js';

const generarFolio = () =>
  `TND-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

export const getTandas = async (req, res, next) => {
  try {
    const tandasRes = await query(
      'SELECT * FROM tandas WHERE usuario_id = $1 ORDER BY estado ASC, creado_en DESC',
      [req.user.id]
    );

    const participantesRes = await query(
      `SELECT tp.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.token_acceso
       FROM tanda_participantes tp
       JOIN tandas t ON tp.tanda_id = t.id
       JOIN clientes c ON tp.cliente_id = c.id
       WHERE t.usuario_id = $1
       ORDER BY tp.tanda_id, tp.numero_turno ASC`,
      [req.user.id]
    );

    const pagosRes = await query(
      `SELECT pg.*, tp.tanda_id, tp.cliente_id, tp.numero_turno
       FROM tanda_pagos pg
       JOIN tanda_participantes tp ON pg.participante_id = tp.id
       JOIN tandas t ON tp.tanda_id = t.id
       WHERE t.usuario_id = $1
       ORDER BY pg.fecha_pago DESC`,
      [req.user.id]
    );

    res.json({
      ok: true,
      tandas: tandasRes.rows,
      participantes: participantesRes.rows,
      pagos: pagosRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createTanda = async (req, res, next) => {
  const client = await getClient();
  try {
    const { nombre, monto_aportacion, frecuencia, total_rondas, fecha_inicio, participantes } = req.body;

    await client.query('BEGIN');

    const tandaRes = await client.query(
      `INSERT INTO tandas (usuario_id, nombre, monto_aportacion, frecuencia, total_rondas, fecha_inicio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, nombre, Number(monto_aportacion).toFixed(2), frecuencia, total_rondas, fecha_inicio]
    );

    const tanda = tandaRes.rows[0];
    const participantesInsertados = [];

    if (Array.isArray(participantes)) {
      for (const p of participantes) {
        const pRes = await client.query(
          `INSERT INTO tanda_participantes (tanda_id, cliente_id, numero_turno, fecha_entrega_estimada)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [tanda.id, p.cliente_id, p.numero_turno, p.fecha_entrega_estimada || null]
        );
        participantesInsertados.push(pRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, tanda, participantes: participantesInsertados });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const addPagoTanda = async (req, res, next) => {
  try {
    const { id } = req.params; // tanda_id
    const { participante_id, numero_ronda, monto_pagado, folio, sync_uuid } = req.body;

    const checkRes = await query(
      `SELECT tp.id, t.monto_aportacion
       FROM tanda_participantes tp
       JOIN tandas t ON tp.tanda_id = t.id
       WHERE tp.id = $1 AND t.id = $2 AND t.usuario_id = $3`,
      [participante_id, id, req.user.id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Participante o tanda no encontrados.' });
    }

    const montoFinal = monto_pagado || checkRes.rows[0].monto_aportacion;
    const folioFinal = folio || generarFolio();

    const pagoRes = await query(
      `INSERT INTO tanda_pagos (participante_id, numero_ronda, monto_pagado, folio, sync_uuid)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sync_uuid) DO UPDATE SET folio = EXCLUDED.folio
       RETURNING *`,
      [participante_id, numero_ronda, montoFinal, folioFinal, sync_uuid || null]
    );

    res.status(201).json({ ok: true, pago: pagoRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const marcarEntregaTurno = async (req, res, next) => {
  try {
    const { id, participanteId } = req.params;
    const { entregado } = req.body;

    const result = await query(
      `UPDATE tanda_participantes tp
       SET entregado = $1
       FROM tandas t
       WHERE tp.tanda_id = t.id AND tp.id = $2 AND t.id = $3 AND t.usuario_id = $4
       RETURNING tp.*`,
      [Boolean(entregado), participanteId, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Turno no encontrado.' });
    }
    res.json({ ok: true, participante: result.rows[0] });
  } catch (error) {
    next(error);
  }


  
};

export const finalizarTanda = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE tandas
       SET estado = 'FINALIZADA'
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Tanda no encontrada.' });
    }

    res.json({ ok: true, tanda: result.rows[0] });
  } catch (error) {
    next(error);
  }
};