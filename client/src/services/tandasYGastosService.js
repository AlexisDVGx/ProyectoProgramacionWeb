import { db } from '../db/dexieDb.js';
import { apiRequest } from './api.js';
import { syncWithServer } from './syncService.js';

const generarFolioTanda = () =>
  `TND-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

export const normalizarTexto = (texto = '') =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ============================================================================
// OPERACIONES DE TANDAS
// ============================================================================

export const asegurarClienteAdmin = async (usuario) => {
  if (!usuario?.nombre) {
    throw new Error('No se encontró el nombre de la cuenta administradora.');
  }

  const nombreNormalizado = normalizarTexto(usuario.nombre);
  const existentes = await db.clientes.toArray();
  const encontrado = existentes.find((c) => normalizarTexto(c.nombre) === nombreNormalizado);

  if (encontrado && encontrado.id) {
    return encontrado;
  }

  if (!navigator.onLine) {
    throw new Error('Conéctate a internet para registrarte automáticamente en el directorio.');
  }

  await apiRequest('/clientes', {
    method: 'POST',
    body: JSON.stringify({
      nombre: usuario.nombre.trim(),
      telefono: '0000000000',
      notas: 'Administrador de tanda',
      token_acceso: crypto.randomUUID(),
    }),
  });

  await syncWithServer();

  const actualizados = await db.clientes.toArray();
  return actualizados.find((c) => normalizarTexto(c.nombre) === nombreNormalizado);
};

export const crearTandaOnline = async ({
  nombre,
  monto_aportacion,
  frecuencia,
  fecha_inicio,
  participantes,
}) => {
  if (!navigator.onLine) {
    throw new Error('Necesitas conexión a internet para crear una tanda nueva y asignar sus turnos.');
  }

  if (!Array.isArray(participantes) || participantes.length < 2) {
    throw new Error('Agrega al menos 2 participantes para iniciar la tanda.');
  }

  const payload = {
    nombre: nombre.trim(),
    monto_aportacion: Number(Number(monto_aportacion).toFixed(2)),
    frecuencia,
    total_rondas: participantes.length,
    fecha_inicio,
    participantes: participantes.map((p, index) => ({
      cliente_id: p.cliente_id,
      numero_turno: index + 1,
      fecha_entrega_estimada: p.fecha_entrega_estimada,
    })),
  };

  const res = await apiRequest('/tandas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  await syncWithServer();
  return res.tanda;
};

export const registrarPagoTandaOfflineFirst = async ({ tanda, participante, numero_ronda }) => {
  if (!participante.id) {
    throw new Error('Sincroniza primero los datos de esta tanda antes de registrar pagos.');
  }

  const yaPagado = await db.tanda_pagos
    .where('participante_id')
    .equals(participante.id)
    .and((p) => Number(p.numero_ronda) === Number(numero_ronda))
    .first();

  if (yaPagado) {
    throw new Error(`El pago de la ronda ${numero_ronda} ya está registrado para este participante.`);
  }

  const nuevoPago = {
    participante_id: participante.id,
    numero_ronda: Number(numero_ronda),
    monto_pagado: Number(tanda.monto_aportacion).toFixed(2),
    fecha_pago: new Date().toISOString(),
    folio: generarFolioTanda(),
    sync_uuid: crypto.randomUUID(),
    sync_status: 'pending',
  };

  await db.tanda_pagos.add(nuevoPago);

  if (navigator.onLine) {
    syncWithServer().catch((err) => console.error('Sync pendiente de pago tanda:', err.message));
  }

  return nuevoPago;
};

export const toggleEntregaTurno = async ({ tandaId, participante, entregado }) => {
  await db.tanda_participantes.update(participante.local_id, {
    entregado: Boolean(entregado),
  });

  if (navigator.onLine && tandaId && participante.id) {
    try {
      await apiRequest(`/tandas/${tandaId}/participantes/${participante.id}/entregar`, {
        method: 'PATCH',
        body: JSON.stringify({ entregado: Boolean(entregado) }),
      });
    } catch (err) {
      console.error('Error al actualizar entrega de turno:', err.message);
    }
  }
};

export const finalizarTandaOfflineFirst = async (tanda) => {
  await db.tandas.update(tanda.local_id, {
    estado: 'FINALIZADA',
    sync_status: 'pending',
  });

  if (navigator.onLine && tanda.id) {
    try {
      await apiRequest(`/tandas/${tanda.id}/finalizar`, { method: 'PATCH' });
      await db.tandas.update(tanda.local_id, { sync_status: 'synced' });
    } catch (err) {
      console.error('Error al finalizar tanda en servidor:', err.message);
    }
  }
};

// ============================================================================
// OPERACIONES DE GASTOS
// ============================================================================

export const crearGastoOfflineFirst = async ({ categoria, descripcion, monto, fecha_gasto }) => {
  const montoNumerico = Number(Number(monto).toFixed(2));
  if (isNaN(montoNumerico) || montoNumerico <= 0) {
    throw new Error('El monto del gasto debe ser mayor a $0.00');
  }

  const nuevoGasto = {
    categoria,
    descripcion: descripcion.trim(),
    monto: montoNumerico.toFixed(2),
    fecha_gasto: fecha_gasto || new Date().toISOString().split('T')[0],
    sync_uuid: crypto.randomUUID(),
    creado_en: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.gastos.add(nuevoGasto);

  if (navigator.onLine) {
    syncWithServer().catch((err) => console.error('Sync pendiente de gasto:', err.message));
  }

  return nuevoGasto;
};

export const eliminarGastoOfflineFirst = async (gasto) => {
  await db.gastos.delete(gasto.local_id);

  if (navigator.onLine && gasto.id) {
    try {
      await apiRequest(`/gastos/${gasto.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error al eliminar gasto en servidor:', err.message);
    }
  }
};