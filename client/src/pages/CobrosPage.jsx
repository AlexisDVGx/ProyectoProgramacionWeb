import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PlusCircle,
  HandCoins,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  X,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import { crearVentaOfflineFirst, registrarAbonoOfflineFirst } from '../services/cobrosService.js';

export default function CobrosPage() {
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], []);
  const ventas = useLiveQuery(() => db.ventas_credito.reverse().toArray(), [], []);
  const abonos = useLiveQuery(() => db.abonos.toArray(), [], []);

  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [ventaExpandida, setVentaExpandida] = useState(null);

  // Modal Nueva Venta
  const [modalVenta, setModalVenta] = useState(false);
  const [formVenta, setFormVenta] = useState({
    cliente_local_id: '',
    concepto: '',
    monto_total: '',
    fecha_venta: new Date().toISOString().split('T')[0],
  });
  const [errorVenta, setErrorVenta] = useState('');

  // Modal Agregar Abono
  const [ventaAbonando, setVentaAbonando] = useState(null);
  const [formAbono, setFormAbono] = useState({ monto: '', notas: '' });
  const [errorAbono, setErrorAbono] = useState('');

  const obtenerClienteDeVenta = (venta) =>
    clientes.find(
      (c) => (venta.cliente_id && c.id === venta.cliente_id) || c.token_acceso === venta.cliente_token
    );

  const obtenerAbonosDeVenta = (venta) =>
    abonos
      .filter(
        (a) =>
          (venta.id && a.venta_id === venta.id) ||
          (venta.sync_uuid && a.venta_sync_uuid === venta.sync_uuid)
      )
      .sort((a, b) => new Date(b.fecha_abono) - new Date(a.fecha_abono));

  const ventasFiltradas = ventas.filter((v) =>
    filtroEstado === 'TODOS' ? true : v.estado === filtroEstado
  );

  const handleCrearVenta = async (e) => {
    e.preventDefault();
    setErrorVenta('');

    const cliente = clientes.find((c) => c.local_id === Number(formVenta.cliente_local_id));
    if (!cliente) return setErrorVenta('Selecciona un cliente válido.');

    try {
      await crearVentaOfflineFirst({
        cliente,
        concepto: formVenta.concepto,
        monto_total: formVenta.monto_total,
        fecha_venta: formVenta.fecha_venta,
      });
      setModalVenta(false);
      setFormVenta({
        cliente_local_id: '',
        concepto: '',
        monto_total: '',
        fecha_venta: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      setErrorVenta(err.message);
    }
  };

  const abrirModalAbono = (venta) => {
    setVentaAbonando(venta);
    setFormAbono({ monto: '', notas: '' });
    setErrorAbono('');
  };

  const handleRegistrarAbono = async (e) => {
    e.preventDefault();
    setErrorAbono('');

    try {
      await registrarAbonoOfflineFirst({
        venta: ventaAbonando,
        monto: formAbono.monto,
        notas: formAbono.notas,
      });
      setVentaAbonando(null);
    } catch (err) {
      setErrorAbono(err.message);
    }
  };

  const abrirWhatsAppEstado = (cliente, venta) => {
    if (!cliente) return;
    const linkPublico = `${window.location.origin}/estado-cuenta/${cliente.token_acceso}`;
    const mensaje = encodeURIComponent(
      `Hola ${cliente.nombre}, te comparto el resumen de tu compra "${venta.concepto}" (Total: $${Number(
        venta.monto_total
      ).toFixed(2)}). Tu saldo pendiente actual es de $${Number(venta.saldo_pendiente).toFixed(
        2
      )}. Consulta tus recibos aquí: ${linkPublico}`
    );
    window.open(`https://wa.me/52${cliente.telefono}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Cobros y Fiados</h2>
          <p className="text-xs text-slate-500">Ventas a crédito y control de abonos</p>
        </div>
        <button
          onClick={() => {
            setErrorVenta('');
            setModalVenta(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm"
        >
          <PlusCircle size={18} />
          Fiado
        </button>
      </div>

      {/* Filtros de Estado */}
      <div className="flex rounded-xl bg-slate-200/70 p-1">
        {[
          { id: 'PENDIENTE', label: 'Pendientes' },
          { id: 'LIQUIDADO', label: 'Liquidados' },
          { id: 'TODOS', label: 'Todos' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFiltroEstado(tab.id)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              filtroEstado === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tarjetas de Ventas */}
      {ventasFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <p className="text-slate-500 text-sm">No hay cuentas en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ventasFiltradas.map((venta) => {
            const cliente = obtenerClienteDeVenta(venta);
            const abonosVenta = obtenerAbonosDeVenta(venta);
            const total = Number(venta.monto_total);
            const saldo = Number(venta.saldo_pendiente);
            const pagado = total - saldo;
            const porcentaje = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
            const expandida = ventaExpandida === venta.local_id;

            return (
              <div
                key={venta.local_id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-teal-700">
                      {cliente ? cliente.nombre : 'Cliente'}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base leading-snug">
                      {venta.concepto}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Fecha: {venta.fecha_venta}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      venta.estado === 'LIQUIDADO'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {venta.estado === 'LIQUIDADO' ? (
                      <>
                        <CheckCircle2 size={13} /> Liquidado
                      </>
                    ) : (
                      <>
                        <Clock size={13} /> Pendiente
                      </>
                    )}
                  </span>
                </div>

                {/* Barra de progreso y montos */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">
                      Abonado: <strong className="text-slate-700">${pagado.toFixed(2)}</strong> de $
                      {total.toFixed(2)}
                    </span>
                    <span className="font-bold text-rose-600">Resta: ${saldo.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        venta.estado === 'LIQUIDADO' ? 'bg-emerald-500' : 'bg-teal-600'
                      }`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {venta.estado === 'PENDIENTE' ? (
                    <button
                      onClick={() => abrirModalAbono(venta)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm"
                    >
                      <HandCoins size={15} /> Agregar Abono
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium">Cuenta saldada</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {cliente && (
                      <button
                        onClick={() => abrirWhatsAppEstado(cliente, venta)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
                        title="Enviar estado por WhatsApp"
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </button>
                    )}

                    <button
                      onClick={() => setVentaExpandida(expandida ? null : venta.local_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"
                    >
                      {abonosVenta.length} {abonosVenta.length === 1 ? 'abono' : 'abonos'}
                      {expandida ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Historial desplegable de abonos */}
                {expandida && (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-200/70">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Historial de Abonos
                    </p>
                    {abonosVenta.length === 0 ? (
                      <p className="text-xs text-slate-500">Aún no se han registrado abonos.</p>
                    ) : (
                      abonosVenta.map((abono) => (
                        <div
                          key={abono.local_id}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-700">
                              {abono.folio}
                            </span>
                            <span className="text-slate-400 ml-2">
                              {new Date(abono.fecha_abono).toLocaleDateString()}
                            </span>
                            {abono.notas && (
                              <p className="text-[11px] text-slate-500">{abono.notas}</p>
                            )}
                          </div>
                          <span className="font-bold text-emerald-600">
                            +${Number(abono.monto).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Registrar Nueva Venta a Crédito */}
      {modalVenta && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Nueva Venta a Crédito</h3>
              <button onClick={() => setModalVenta(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>

            {errorVenta && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {errorVenta}
              </div>
            )}

            <form onSubmit={handleCrearVenta} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente *</label>
                <select
                  required
                  value={formVenta.cliente_local_id}
                  onChange={(e) => setFormVenta({ ...formVenta, cliente_local_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-teal-600"
                >
                  <option value="">-- Selecciona un cliente --</option>
                  {clientes.map((c) => (
                    <option key={c.local_id} value={c.local_id}>
                      {c.nombre} ({c.telefono})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Producto(s) vendido(s) *
                </label>
                <input
                  type="text"
                  required
                  value={formVenta.concepto}
                  onChange={(e) => setFormVenta({ ...formVenta, concepto: e.target.value })}
                  placeholder="Ej. Perfume floral 100ml + Crema corporal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Monto Total ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formVenta.monto_total}
                    onChange={(e) => setFormVenta({ ...formVenta, monto_total: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formVenta.fecha_venta}
                    onChange={(e) => setFormVenta({ ...formVenta, fecha_venta: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm"
              >
                Registrar Cuenta por Cobrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Abono */}
      {ventaAbonando && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800">Registrar Abono</h3>
                <p className="text-xs text-slate-500">{ventaAbonando.concepto}</p>
              </div>
              <button onClick={() => setVentaAbonando(null)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-600">Saldo pendiente actual:</span>
              <span className="text-lg font-bold text-rose-600">
                ${Number(ventaAbonando.saldo_pendiente).toFixed(2)}
              </span>
            </div>

            {errorAbono && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {errorAbono}
              </div>
            )}

            <form onSubmit={handleRegistrarAbono} className="space-y-3.5">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-600">Monto del abono ($) *</label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormAbono({
                        ...formAbono,
                        monto: Number(ventaAbonando.saldo_pendiente).toFixed(2),
                      })
                    }
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Liquidar todo (${Number(ventaAbonando.saldo_pendiente).toFixed(2)})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(ventaAbonando.saldo_pendiente)}
                  required
                  value={formAbono.monto}
                  onChange={(e) => setFormAbono({ ...formAbono, monto: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-bold focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={formAbono.notas}
                  onChange={(e) => setFormAbono({ ...formAbono, notas: e.target.value })}
                  placeholder="Ej. Pago en efectivo / transferencia"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm"
              >
                Confirmar Abono
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}