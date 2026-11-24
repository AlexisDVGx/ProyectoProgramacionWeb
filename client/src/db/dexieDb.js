import Dexie from 'dexie';

export const db = new Dexie('GestorCobrosOfflineDB');

db.version(1).stores({
  clientes: '++local_id, id, token_acceso, nombre, sync_status',
  ventas_credito: '++local_id, id, sync_uuid, cliente_id, cliente_token, estado, sync_status',
  abonos: '++local_id, id, sync_uuid, venta_id, venta_sync_uuid, sync_status',
  tandas: '++local_id, id, nombre, estado',
  tanda_participantes: '++local_id, id, tanda_id, cliente_id',
  tanda_pagos: '++local_id, id, sync_uuid, participante_id, numero_ronda, sync_status',
  gastos: '++local_id, id, sync_uuid, categoria, fecha_gasto, sync_status',
});

export const clearLocalDatabase = async () => {
  await Promise.all([
    db.clientes.clear(),
    db.ventas_credito.clear(),
    db.abonos.clear(),
    db.tandas.clear(),
    db.tanda_participantes.clear(),
    db.tanda_pagos.clear(),
    db.gastos.clear(),
  ]);
};