import { db } from '../db/dexieDb.js';
import { apiRequest } from './api.js';
import { syncWithServer } from './syncService.js';

const generarFolioLocal = (prefijo) =>
  `${prefijo}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

// ============================================================================
// OPERACIONES DE CLIENTES
// ============================================================================

export const crearClienteOfflineFirst = async ({ nombre, telefono, notas }) => {
  const nuevoCliente = {
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    notas: notas?.trim() || '',
    token_acceso: crypto.randomUUID(),
    activo: true,
    creado_en: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.clientes.add(nuevoCliente);

  if (navigator.onLine) {
    syncWithServer().catch((err) => console.error('Sync pendiente:', err.message));
  }
  return nuevoCliente;
};

export const editarClienteOfflineFirst = async (cliente, { nombre, telefono, notas }) => {
  const datosActualizados = {
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    notas: notas?.trim() || '',
  };

  await db.clientes.update(cliente.local_id, datosActualizados);

  if (navigator.onLine && cliente.id) {
    try {
      await apiRequest(`/clientes/${cliente.id}`, {
        method: 'PUT',
        body: JSON.stringify(datosActualizados),
      });
    } catch (err) {
      console.error('Error al actualizar cliente en servidor:', err.message);
    }
  }
};

export const eliminarClienteOfflineFirst = async (cliente) => {
  await db.clientes.delete(cliente.local_id);

  if (navigator.onLine && cliente.id) {
    try {
      await apiRequest(`/clientes/${cliente.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error al eliminar cliente en servidor:', err.message);
    }
  }
};

// ============================================================================
// OPERACIONES DE VENTAS A CRÉDITO Y ABONOS
// ============================================================================

export const crearVentaOfflineFirst = async ({ cliente, concepto, monto_total, fecha_venta }) => {
  const total = Number(Number(monto_total).toFixed(2));
  if (total <= 0) throw new Error('El monto total debe ser mayor a $0.00');

  const nuevaVenta = {
    cliente_id: cliente.id || null,
    cliente_token: cliente.token_acceso,
    concepto: concepto.trim(),
    monto_total: total.toFixed(2),
    saldo_pendiente: total.toFixed(2),
    estado: 'PENDIENTE',
    fecha_venta: fecha_venta || new Date().toISOString().split('T')[0],
    sync_uuid: crypto.randomUUID(),
    creado_en: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.ventas_credito.add(nuevaVenta);

  if (navigator.onLine) {
    syncWithServer().catch((err) => console.error('Sync pendiente:', err.message));
  }
  return nuevaVenta;
};

export const registrarAbonoOfflineFirst = async ({ venta, monto, notas }) => {
  const saldoActual = Number(venta.saldo_pendiente);
  const montoAbono = Number(Number(monto).toFixed(2));

  if (isNaN(montoAbono) || montoAbono <= 0) {
    throw new Error('El abono debe ser mayor a $0.00');
  }
  if (montoAbono > saldoActual) {
    throw new Error(`El abono no puede superar el saldo pendiente ($${saldoActual.toFixed(2)})`);
  }

  const nuevoSaldo = Number((saldoActual - montoAbono).toFixed(2));
  const nuevoEstado = nuevoSaldo === 0 ? 'LIQUIDADO' : 'PENDIENTE';

  const nuevoAbono = {
    venta_id: venta.id || null,
    venta_sync_uuid: venta.sync_uuid || null,
    monto: montoAbono.toFixed(2),
    fecha_abono: new Date().toISOString(),
    folio: generarFolioLocal('ABN'),
    notas: notas?.trim() || '',
    sync_uuid: crypto.randomUUID(),
    sync_status: 'pending',
  };

  await db.transaction('rw', [db.ventas_credito, db.abonos], async () => {
    await db.abonos.add(nuevoAbono);
    await db.ventas_credito.update(venta.local_id, {
      saldo_pendiente: nuevoSaldo.toFixed(2),
      estado: nuevoEstado,
    });
  });

  if (navigator.onLine) {
    syncWithServer().catch((err) => console.error('Sync pendiente:', err.message));
  }

  return {
    abono: nuevoAbono,
    ventaActualizada: {
      ...venta,
      saldo_pendiente: nuevoSaldo.toFixed(2),
      estado: nuevoEstado,
    },
  };
};