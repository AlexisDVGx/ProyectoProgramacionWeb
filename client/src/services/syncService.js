import { db } from '../db/dexieDb.js';
import { apiRequest } from './api.js';

export const syncWithServer = async () => {
  if (!navigator.onLine) {
    return { ok: false, offline: true, mensaje: 'Sin conexión. Guardado localmente.' };
  }

  const token = localStorage.getItem('auth_token');
  if (!token) return { ok: false, mensaje: 'Sesión no iniciada.' };

  // 1. Recolectar registros pendientes en IndexedDB
  const [
    pendingClientes,
    pendingVentas,
    pendingAbonos,
    pendingTandaPagos,
    pendingGastos,
    pendingTandasFinalizadas,
  ] = await Promise.all([
    db.clientes.where('sync_status').equals('pending').toArray(),
    db.ventas_credito.where('sync_status').equals('pending').toArray(),
    db.abonos.where('sync_status').equals('pending').toArray(),
    db.tanda_pagos.where('sync_status').equals('pending').toArray(),
    db.gastos.where('sync_status').equals('pending').toArray(),
    db.tandas.filter((t) => t.sync_status === 'pending' && t.estado === 'FINALIZADA').toArray(),
  ]);

  const hayPendientes =
    pendingClientes.length > 0 ||
    pendingVentas.length > 0 ||
    pendingAbonos.length > 0 ||
    pendingTandaPagos.length > 0 ||
    pendingGastos.length > 0 ||
    pendingTandasFinalizadas.length > 0;

  // 2. Subir lote pendiente al servidor si existe
  if (hayPendientes) {
    await apiRequest('/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        clientes: pendingClientes,
        ventas: pendingVentas,
        abonos: pendingAbonos,
        tanda_pagos: pendingTandaPagos,
        gastos: pendingGastos,
        tandas_finalizadas: pendingTandasFinalizadas.map((t) => t.id).filter(Boolean),
      }),
    });
  }

  // 3. Descargar estado actualizado desde PostgreSQL y refrescar IndexedDB
  const snapshot = await apiRequest('/sync/pull');
  const { clientes, ventas_credito, abonos, tandas, tanda_participantes, tanda_pagos, gastos } =
    snapshot.data;

  await db.transaction(
    'rw',
    [db.clientes, db.ventas_credito, db.abonos, db.tandas, db.tanda_participantes, db.tanda_pagos, db.gastos],
    async () => {
      await db.clientes.clear();
      await db.ventas_credito.clear();
      await db.abonos.clear();
      await db.tandas.clear();
      await db.tanda_participantes.clear();
      await db.tanda_pagos.clear();
      await db.gastos.clear();

      if (clientes.length) await db.clientes.bulkAdd(clientes.map((c) => ({ ...c, sync_status: 'synced' })));
      if (ventas_credito.length)
        await db.ventas_credito.bulkAdd(ventas_credito.map((v) => ({ ...v, sync_status: 'synced' })));
      if (abonos.length) await db.abonos.bulkAdd(abonos.map((a) => ({ ...a, sync_status: 'synced' })));
      if (tandas.length) await db.tandas.bulkAdd(tandas.map((t) => ({ ...t, sync_status: 'synced' })));
      if (tanda_participantes.length) await db.tanda_participantes.bulkAdd(tanda_participantes);
      if (tanda_pagos.length)
        await db.tanda_pagos.bulkAdd(tanda_pagos.map((p) => ({ ...p, sync_status: 'synced' })));
      if (gastos.length) await db.gastos.bulkAdd(gastos.map((g) => ({ ...g, sync_status: 'synced' })));
    }
  );

  localStorage.setItem('last_sync', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  return { ok: true, mensaje: 'Sincronizado con la nube' };
};