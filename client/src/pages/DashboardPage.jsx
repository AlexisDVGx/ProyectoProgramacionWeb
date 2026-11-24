import { useLiveQuery } from 'dexie-react-hooks';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  HandCoins,
  UserPlus,
  Repeat,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Award,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import { normalizarTexto } from '../services/tandasYGastosService.js';

export default function DashboardPage({ user, onNavigate, isOnline, syncing, onSync }) {
  const usuarioActual =
    user || JSON.parse(localStorage.getItem('user_data') || 'null');

  const clientes = useLiveQuery(() => db.clientes.toArray(), [], []);
  const ventas = useLiveQuery(() => db.ventas_credito.toArray(), [], []);
  const abonos = useLiveQuery(() => db.abonos.toArray(), [], []);
  const tandas = useLiveQuery(() => db.tandas.toArray(), [], []);
  const tandaParticipantes = useLiveQuery(() => db.tanda_participantes.toArray(), [], []);
  const tandaPagos = useLiveQuery(() => db.tanda_pagos.toArray(), [], []);
  const gastos = useLiveQuery(() => db.gastos.toArray(), [], []);

  // Contar registros pendientes de sincronizar en IndexedDB
  const pendientesSync =
    clientes.filter((c) => c.sync_status === 'pending').length +
    ventas.filter((v) => v.sync_status === 'pending').length +
    abonos.filter((a) => a.sync_status === 'pending').length +
    tandaPagos.filter((p) => p.sync_status === 'pending').length +
    gastos.filter((g) => g.sync_status === 'pending').length +
    tandas.filter((t) => t.sync_status === 'pending' && t.estado === 'FINALIZADA').length;

  // Cálculos financieros del negocio
  const totalPorCobrar = ventas
    .filter((v) => v.estado === 'PENDIENTE')
    .reduce((acc, v) => acc + Number(v.saldo_pendiente), 0);

  const totalCobradoAbonos = abonos.reduce((acc, a) => acc + Number(a.monto), 0);

  // Cálculo exclusivo de tandas recibidas por la persona administradora
  const tandasActivas = tandas.filter((t) => t.estado !== 'FINALIZADA');
  const nombreAdminNorm = normalizarTexto(usuarioActual?.nombre || '');
  const misClientesIds = clientes
    .filter((c) => c.id && nombreAdminNorm && normalizarTexto(c.nombre) === nombreAdminNorm)
    .map((c) => c.id);

  const misTurnosEntregados = tandaParticipantes.filter(
    (tp) => misClientesIds.includes(tp.cliente_id) && Boolean(tp.entregado)
  );

  const totalRecibidoAdminTandas = misTurnosEntregados.reduce((acc, tp) => {
    const tanda = tandas.find((t) => t.id === tp.tanda_id);
    if (!tanda) return acc;
    const rondasPagadoras = Math.max(1, Number(tanda.total_rondas) - 1);
    return acc + rondasPagadoras * Number(tanda.monto_aportacion);
  }, 0);

  const gastosSurtido = gastos
    .filter((g) => g.categoria === 'SURTIDO')
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const gastosHogar = gastos
    .filter((g) => g.categoria === 'HOGAR')
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const gastosOtros = gastos
    .filter((g) => g.categoria === 'OTROS')
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const totalGastos = gastosSurtido + gastosHogar + gastosOtros;
  const balanceNetoNegocio = totalCobradoAbonos - totalGastos;

  const pctSurtido = totalGastos > 0 ? Math.round((gastosSurtido / totalGastos) * 100) : 0;
  const pctHogar = totalGastos > 0 ? Math.round((gastosHogar / totalGastos) * 100) : 0;

  // Últimos 5 movimientos combinados
  const movimientosRecientes = [
    ...abonos.map((a) => ({
      id: `abn-${a.local_id}`,
      tipo: 'INGRESO',
      titulo: `Abono recibido (${a.folio})`,
      fecha: a.fecha_abono,
      monto: Number(a.monto),
    })),
    ...tandaPagos.map((p) => ({
      id: `tnd-${p.local_id}`,
      tipo: 'INGRESO',
      titulo: `Pago tanda Ronda ${p.numero_ronda} (${p.folio})`,
      fecha: p.fecha_pago,
      monto: Number(p.monto_pagado),
    })),
    ...gastos.map((g) => ({
      id: `gst-${g.local_id}`,
      tipo: 'EGRESO',
      titulo: `${g.categoria}: ${g.descripcion}`,
      fecha: g.creado_en || g.fecha_gasto,
      monto: Number(g.monto),
    })),
  ]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);

  const lastSync = localStorage.getItem('last_sync');

  return (
    <div className="space-y-4">
      {/* Alerta de registros locales pendientes de subir */}
      {pendientesSync > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-900">
            <Clock size={18} className="shrink-0 text-amber-600" />
            <p className="text-xs font-medium">
              Tienes <strong>{pendientesSync}</strong>{' '}
              {pendientesSync === 1 ? 'registro guardado' : 'registros guardados'} localmente sin
              subir a la nube.
            </p>
          </div>
          {isOnline && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Subir
            </button>
          )}
        </div>
      )}

      {/* Tarjeta Principal de Balance Neto */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 text-white rounded-2xl p-5 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-teal-200 font-semibold">
            Balance Neto (Cobros - Gastos)
          </span>
          {lastSync && (
            <span className="text-[11px] text-teal-200">Sincronizado: {lastSync}</span>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-extrabold">
            {balanceNetoNegocio < 0 ? '-' : ''}${Math.abs(balanceNetoNegocio).toFixed(2)}
          </p>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              balanceNetoNegocio >= 0
                ? 'bg-emerald-400/20 text-emerald-100'
                : 'bg-rose-400/20 text-rose-100'
            }`}
          >
            {balanceNetoNegocio >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {balanceNetoNegocio >= 0 ? 'Superávit' : 'Déficit'}
          </span>
        </div>

        <div className="pt-3 border-t border-teal-600/70 flex items-center justify-between text-xs">
          <div>
            <span className="text-teal-200 block">Por cobrar en calle</span>
            <strong className="text-base text-amber-300">${totalPorCobrar.toFixed(2)}</strong>
          </div>
          <div className="text-right">
            <span className="text-teal-200 block">Tandas vigentes</span>
            <strong className="text-base text-white">{tandasActivas.length}</strong>
          </div>
        </div>
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Abonos Cobrados</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            +${totalCobradoAbonos.toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{abonos.length} pagos recibidos</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Gastos Totales</p>
          <p className="text-xl font-bold text-rose-600 mt-1">-${totalGastos.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{gastos.length} egresos registrados</p>
        </div>
      </div>

      {/* Nuevo contenedor: Recaudado en tandas de la persona administradora */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase">
            Recaudado en tandas
          </p>
          <p className="text-2xl font-bold text-teal-700 mt-0.5">
            +${totalRecibidoAdminTandas.toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {misTurnosEntregados.length === 1
              ? '1 turno recibido'
              : `${misTurnosEntregados.length} turnos recibidos`}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-teal-50 text-teal-700">
          <Award size={24} />
        </div>
      </div>

      {/* Separación Negocio vs Hogar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Distribución de Gastos</h3>
          <span className="text-xs text-slate-400">Negocio vs. Hogar</span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-medium text-slate-600">Surtido de Mercancía</span>
              <span className="font-bold text-indigo-700">
                ${gastosSurtido.toFixed(2)} ({pctSurtido}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600" style={{ width: `${pctSurtido}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="font-medium text-slate-600">Gastos del Hogar</span>
              <span className="font-bold text-amber-700">
                ${gastosHogar.toFixed(2)} ({pctHogar}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${pctHogar}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { tab: 'clientes', label: 'Cliente', icon: UserPlus, color: 'text-teal-700 bg-teal-50' },
          { tab: 'cobros', label: 'Cobrar', icon: HandCoins, color: 'text-emerald-700 bg-emerald-50' },
          {
            tab: 'tandas',
            label: `Tandas (${tandasActivas.length})`,
            icon: Repeat,
            color: 'text-indigo-700 bg-indigo-50',
          },
          { tab: 'gastos', label: 'Gasto', icon: Wallet, color: 'text-rose-700 bg-rose-50' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              onClick={() => onNavigate(item.tab)}
              className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-col items-center gap-1.5 shadow-sm hover:border-teal-500 transition"
            >
              <div className={`p-2 rounded-xl ${item.color}`}>
                <Icon size={18} />
              </div>
              <span className="text-[11px] font-bold text-slate-700">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Últimos Movimientos */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Movimientos Recientes</h3>
        {movimientosRecientes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">
            Aún no hay movimientos registrados.
          </p>
        ) : (
          <div className="space-y-2">
            {movimientosRecientes.map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-2 pr-2">
                  {mov.tipo === 'INGRESO' ? (
                    <ArrowUpRight size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowDownRight size={16} className="text-rose-600 shrink-0" />
                  )}
                  <span className="text-slate-700 font-medium line-clamp-1">{mov.titulo}</span>
                </div>
                <span
                  className={`font-bold shrink-0 ${
                    mov.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {mov.tipo === 'INGRESO' ? '+' : '-'}${mov.monto.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}