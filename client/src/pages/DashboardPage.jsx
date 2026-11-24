import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  ChevronRight,
  ArrowLeft,
  Search,
  ShoppingBag,
  Home,
  Tag,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import { normalizarTexto } from '../services/tandasYGastosService.js';

const ETIQUETA_GASTO = {
  SURTIDO: 'Surtido de mercancía',
  HOGAR: 'Gasto del hogar',
  OTROS: 'Otros gastos',
};

const formatearFechaCorta = (fechaStr) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return String(fechaStr).slice(0, 10);
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatearFechaHora = (fechaStr) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return String(fechaStr).slice(0, 10);
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DashboardPage({ user, isOnline, syncing, onSync }) {
  const usuarioActual = user || JSON.parse(localStorage.getItem('user_data') || 'null');

  // 'inicio' | 'resumen' | 'movimientos'
  const [vista, setVista] = useState('inicio');
  const [filtroMov, setFiltroMov] = useState('TODOS');
  const [busquedaMov, setBusquedaMov] = useState('');

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

  // Cálculos financieros
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
  const dineroLibreCaja = totalCobradoAbonos - totalGastos;

  const pctSurtido = totalGastos > 0 ? Math.round((gastosSurtido / totalGastos) * 100) : 0;
  const pctHogar = totalGastos > 0 ? Math.round((gastosHogar / totalGastos) * 100) : 0;
  const pctOtros = totalGastos > 0 ? Math.round((gastosOtros / totalGastos) * 100) : 0;

  // Resolver nombres reales para cada movimiento
  const todosLosMovimientos = [
    ...abonos.map((a) => {
      const venta = ventas.find(
        (v) =>
          (a.venta_id && v.id === a.venta_id) ||
          (a.venta_sync_uuid && v.sync_uuid === a.venta_sync_uuid)
      );
      const cliente = venta
        ? clientes.find(
            (c) =>
              (venta.cliente_id && c.id === venta.cliente_id) ||
              c.token_acceso === venta.cliente_token
          )
        : null;

      return {
        id: `abn-${a.local_id}`,
        tipo: 'INGRESO',
        origen: 'Abono de venta',
        titulo: cliente ? `Abono de ${cliente.nombre}` : 'Abono de cliente',
        subtitulo: `${venta?.concepto || 'Compra a crédito'} · Folio ${a.folio}`,
        nota: a.notas || '',
        folio: a.folio,
        fecha: a.fecha_abono,
        monto: Number(a.monto),
      };
    }),
    ...tandaPagos.map((p) => {
      const part = tandaParticipantes.find((tp) => tp.id === p.participante_id);
      const cliente = part ? clientes.find((c) => c.id === part.cliente_id) : null;
      const tanda = part ? tandas.find((t) => t.id === part.tanda_id) : null;

      return {
        id: `tnd-${p.local_id}`,
        tipo: 'INGRESO',
        origen: 'Aportación de tanda',
        titulo: cliente ? `Tanda: ${cliente.nombre}` : 'Pago de tanda',
        subtitulo: `${tanda?.nombre || 'Tanda'} · Ronda ${p.numero_ronda} (${p.folio})`,
        nota: '',
        folio: p.folio,
        fecha: p.fecha_pago,
        monto: Number(p.monto_pagado),
      };
    }),
    ...gastos.map((g) => ({
      id: `gst-${g.local_id}`,
      tipo: 'EGRESO',
      origen: ETIQUETA_GASTO[g.categoria] || 'Gasto',
      titulo: `Gasto: ${g.descripcion}`,
      subtitulo: `${ETIQUETA_GASTO[g.categoria] || g.categoria} · ${formatearFechaCorta(g.fecha_gasto)}`,
      nota: '',
      folio: '',
      fecha: g.creado_en || g.fecha_gasto,
      monto: Number(g.monto),
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const movimientosRecientes = todosLosMovimientos.slice(0, 5);
  const lastSync = localStorage.getItem('last_sync');

  // ============================================================================
  // SUBVISTA 1: RESUMEN DETALLADO DE CUENTAS Y GASTOS (Explicación coloquial)
  // ============================================================================
  if (vista === 'resumen') {
    const gastosOrdenados = [...gastos].sort((a, b) =>
      String(b.fecha_gasto).localeCompare(String(a.fecha_gasto))
    );
    const gastoMayor =
      gastosOrdenados.length > 0
        ? [...gastosOrdenados].sort((a, b) => Number(b.monto) - Number(a.monto))[0]
        : null;

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setVista('inicio')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-100"
        >
          <ArrowLeft size={15} /> Volver al inicio
        </button>

        <div>
          <h2 className="text-lg font-bold text-slate-800">Resumen Claro de tus Cuentas</h2>
          <p className="text-xs text-slate-500">Explicación paso a paso de entradas, salidas y gastos</p>
        </div>

        {/* Diagnóstico en lenguaje sencillo */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-2 text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-teal-900 text-sm">¿Cómo van tus números hoy?</p>
          <p>
            • Has cobrado <strong>${totalCobradoAbonos.toFixed(2)}</strong> en abonos de tus
            clientes y has gastado <strong>${totalGastos.toFixed(2)}</strong> en total.
          </p>
          <p>
            •{' '}
            {dineroLibreCaja >= 0 ? (
              <>
                Te quedan <strong className="text-emerald-700">${dineroLibreCaja.toFixed(2)}</strong>{' '}
                libres en caja (vas ganando).
              </>
            ) : (
              <>
                Has gastado{' '}
                <strong className="text-rose-700">
                  ${Math.abs(dineroLibreCaja).toFixed(2)}
                </strong>{' '}
                más de lo que has cobrado en abonos.
              </>
            )}
          </p>
          {totalPorCobrar > 0 && (
            <p>
              • Además, todavía tienes{' '}
              <strong className="text-amber-700">${totalPorCobrar.toFixed(2)}</strong> pendientes por
              cobrarle a tus clientes en la calle.
            </p>
          )}
          {gastoMayor && (
            <p>
              • Tu gasto más fuerte hasta ahora fue <strong>"{gastoMayor.descripcion}"</strong> por{' '}
              <strong>${Number(gastoMayor.monto).toFixed(2)}</strong> (
              {ETIQUETA_GASTO[gastoMayor.categoria] || gastoMayor.categoria}).
            </p>
          )}
        </div>

        {/* Distribución de Gastos (Negocio vs Hogar) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">¿En qué se fue el dinero?</h3>
            <span className="text-xs text-slate-400">Negocio vs. Hogar</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Surtido de Mercancía</span>
                <span className="font-bold text-indigo-700">
                  ${gastosSurtido.toFixed(2)} ({pctSurtido}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${pctSurtido}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700">Gastos del Hogar</span>
                <span className="font-bold text-amber-700">
                  ${gastosHogar.toFixed(2)} ({pctHogar}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${pctHogar}%` }} />
              </div>
            </div>

            {gastosOtros > 0 && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-700">Otros Gastos</span>
                  <span className="font-bold text-slate-700">
                    ${gastosOtros.toFixed(2)} ({pctOtros}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-500" style={{ width: `${pctOtros}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lista detallada de cada gasto */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-slate-800 px-1">
            Detalle de cada gasto ({gastosOrdenados.length})
          </h3>

          {gastosOrdenados.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-500">
              No tienes gastos registrados todavía.
            </div>
          ) : (
            gastosOrdenados.map((g) => {
              const Icon =
                g.categoria === 'SURTIDO'
                  ? ShoppingBag
                  : g.categoria === 'HOGAR'
                    ? Home
                    : Tag;
              const badgeStyle =
                g.categoria === 'SURTIDO'
                  ? 'bg-indigo-100 text-indigo-700'
                  : g.categoria === 'HOGAR'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700';

              return (
                <div
                  key={g.local_id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${badgeStyle}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{g.descripcion}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ETIQUETA_GASTO[g.categoria] || g.categoria} ·{' '}
                        {formatearFechaCorta(g.fecha_gasto)}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-rose-600 text-sm shrink-0">
                    -${Number(g.monto).toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUBVISTA 2: HISTORIAL DETALLADO DE TODOS LOS MOVIMIENTOS
  // ============================================================================
  if (vista === 'movimientos') {
    const movimientosFiltrados = todosLosMovimientos.filter((mov) => {
      if (filtroMov !== 'TODOS' && mov.tipo !== filtroMov) return false;
      if (!busquedaMov.trim()) return true;
      const q = busquedaMov.toLowerCase();
      return (
        mov.titulo.toLowerCase().includes(q) ||
        mov.subtitulo.toLowerCase().includes(q) ||
        mov.nota.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setVista('inicio')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-100"
        >
          <ArrowLeft size={15} /> Volver al inicio
        </button>

        <div>
          <h2 className="text-lg font-bold text-slate-800">Historial de Movimientos</h2>
          <p className="text-xs text-slate-500">
            Detalle completo de abonos recibidos, tandas y gastos
          </p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={busquedaMov}
            onChange={(e) => setBusquedaMov(e.target.value)}
            placeholder="Buscar por cliente, producto, tanda o folio..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
          />
        </div>

        {/* Filtros de tipo */}
        <div className="flex rounded-xl bg-slate-200/80 p-1">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'INGRESO', label: 'Entradas (+)' },
            { id: 'EGRESO', label: 'Salidas (-)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroMov(tab.id)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                filtroMov === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lista detallada */}
        {movimientosFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
            <p className="text-slate-500 text-sm">No hay movimientos que coincidan.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {movimientosFiltrados.map((mov) => (
              <div
                key={mov.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                      mov.tipo === 'INGRESO'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {mov.tipo === 'INGRESO' ? (
                      <ArrowUpRight size={17} />
                    ) : (
                      <ArrowDownRight size={17} />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {mov.origen}
                    </span>
                    <h3 className="text-xs font-bold text-slate-800">{mov.titulo}</h3>
                    <p className="text-[11px] text-slate-600">{mov.subtitulo}</p>
                    {mov.nota && (
                      <p className="text-[11px] text-slate-500 italic">Nota: "{mov.nota}"</p>
                    )}
                    <p className="text-[10px] text-slate-400 pt-0.5">
                      {formatearFechaHora(mov.fecha)}
                    </p>
                  </div>
                </div>

                <span
                  className={`font-bold text-sm shrink-0 ${
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
    );
  }

  // ============================================================================
  // VISTA PRINCIPAL DE INICIO
  // ============================================================================
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

      {/* Tarjeta Principal con términos coloquiales */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 text-white rounded-2xl p-5 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-teal-200 font-semibold">
            Lo que te queda en caja
          </span>
          {lastSync && (
            <span className="text-[11px] text-teal-200">Sincronizado: {lastSync}</span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="text-3xl font-extrabold">
            {dineroLibreCaja < 0 ? '-' : ''}${Math.abs(dineroLibreCaja).toFixed(2)}
          </p>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              dineroLibreCaja >= 0
                ? 'bg-emerald-400/20 text-emerald-100'
                : 'bg-rose-400/20 text-rose-100'
            }`}
          >
            {dineroLibreCaja >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {dineroLibreCaja >= 0 ? 'Vas ganando' : 'En contra'}
          </span>
        </div>

        <div className="pt-3 border-t border-teal-600/70 flex items-center justify-between text-xs">
          <div>
            <span className="text-teal-200 block">Te deben clientes</span>
            <strong className="text-base text-amber-300">${totalPorCobrar.toFixed(2)}</strong>
          </div>
          <div className="text-right">
            <span className="text-teal-200 block">Tandas activas</span>
            <strong className="text-base text-white">{tandasActivas.length}</strong>
          </div>
        </div>

        {/* Acceso al resumen detallado de cuentas y gastos */}
        <button
          type="button"
          onClick={() => setVista('resumen')}
          className="w-full mt-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-teal-50 text-xs font-semibold flex items-center justify-between transition"
        >
          <span>Ver resumen detallado de cuentas y gastos</span>
          <ChevronRight size={15} />
        </button>
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

      {/* Recaudado en tandas de la persona administradora */}
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

      {/* Últimos Movimientos (Clickeable hacia el historial completo) */}
      <div
        onClick={() => setVista('movimientos')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setVista('movimientos')}
        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 cursor-pointer hover:border-teal-500 transition"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Movimientos Recientes</h3>
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-teal-700">
            Ver todos <ChevronRight size={14} />
          </span>
        </div>

        {movimientosRecientes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">
            Aún no hay movimientos registrados.
          </p>
        ) : (
          <div className="space-y-2.5">
            {movimientosRecientes.map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {mov.tipo === 'INGRESO' ? (
                    <ArrowUpRight size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDownRight size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-slate-800 font-semibold truncate">{mov.titulo}</p>
                    <p className="text-[11px] text-slate-400 truncate">{mov.subtitulo}</p>
                  </div>
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