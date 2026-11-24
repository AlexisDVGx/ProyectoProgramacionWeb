import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PlusCircle,
  ShoppingBag,
  Home,
  Tag,
  Trash2,
  Clock,
  CloudCheck,
  X,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import { crearGastoOfflineFirst, eliminarGastoOfflineFirst } from '../services/tandasYGastosService.js';

const CATEGORIAS_CONFIG = {
  SURTIDO: {
    label: 'Surtido Negocio',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    icon: ShoppingBag,
  },
  HOGAR: {
    label: 'Gasto del Hogar',
    badgeClass: 'bg-amber-100 text-amber-800',
    icon: Home,
  },
  OTROS: {
    label: 'Otros Gastos',
    badgeClass: 'bg-slate-200 text-slate-700',
    icon: Tag,
  },
};

export default function GastosPage() {
  const gastos = useLiveQuery(() => db.gastos.reverse().toArray(), [], []);

  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    categoria: 'SURTIDO',
    descripcion: '',
    monto: '',
    fecha_gasto: new Date().toISOString().split('T')[0],
  });

  const gastosFiltrados = gastos
    .filter((g) => (filtroCategoria === 'TODOS' ? true : g.categoria === filtroCategoria))
    .sort((a, b) => String(b.fecha_gasto).localeCompare(String(a.fecha_gasto)));

  const totalFiltrado = gastosFiltrados.reduce((acc, g) => acc + Number(g.monto), 0);

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await crearGastoOfflineFirst(form);
      setModalAbierto(false);
      setForm({
        categoria: 'SURTIDO',
        descripcion: '',
        monto: '',
        fecha_gasto: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminar = async (gasto) => {
    if (confirm(`¿Eliminar el gasto "${gasto.descripcion}" por $${Number(gasto.monto).toFixed(2)}?`)) {
      await eliminarGastoOfflineFirst(gasto);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Control de Gastos</h2>
          <p className="text-xs text-slate-500">Surtido de mercancía vs. gastos del hogar</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setModalAbierto(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm"
        >
          <PlusCircle size={18} />
          Gasto
        </button>
      </div>

      {/* Tarjeta resumen de categoría seleccionada */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Total acumulado ({filtroCategoria === 'TODOS' ? 'Todas las categorías' : CATEGORIAS_CONFIG[filtroCategoria].label})
          </p>
          <p className="text-2xl font-bold text-rose-600 mt-0.5">${totalFiltrado.toFixed(2)}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">
          {gastosFiltrados.length} {gastosFiltrados.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'TODOS', label: 'Todos' },
          { id: 'SURTIDO', label: 'Surtido' },
          { id: 'HOGAR', label: 'Hogar' },
          { id: 'OTROS', label: 'Otros' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFiltroCategoria(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
              filtroCategoria === tab.id
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de Gastos */}
      {gastosFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <p className="text-slate-500 text-sm">No hay gastos registrados en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {gastosFiltrados.map((gasto) => {
            const config = CATEGORIAS_CONFIG[gasto.categoria] || CATEGORIAS_CONFIG.OTROS;
            const Icon = config.icon;

            return (
              <div
                key={gasto.local_id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${config.badgeClass}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                        {config.label}
                      </span>
                      {gasto.sync_status === 'pending' ? (
                        <Clock size={12} className="text-amber-600" title="Pendiente de sincronizar" />
                      ) : (
                        <CloudCheck size={13} className="text-emerald-600" title="Sincronizado" />
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mt-1">{gasto.descripcion}</h3>
                    <p className="text-[11px] text-slate-400">
                      Fecha: {String(gasto.fecha_gasto).slice(0, 10)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-rose-600 text-sm">
                    -${Number(gasto.monto).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleEliminar(gasto)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar gasto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nuevo Gasto */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Registrar Nuevo Gasto</h3>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardar} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'SURTIDO', label: 'Surtido' },
                    { id: 'HOGAR', label: 'Hogar' },
                    { id: 'OTROS', label: 'Otros' },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setForm({ ...form, categoria: cat.id })}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        form.categoria === cat.id
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Concepto o descripción *
                </label>
                <input
                  type="text"
                  required
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej. Pedido de 5 perfumes / Pago de luz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_gasto}
                    onChange={(e) => setForm({ ...form, fecha_gasto: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm"
              >
                Guardar Gasto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}