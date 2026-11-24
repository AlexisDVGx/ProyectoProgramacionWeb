import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  UserPlus,
  Search,
  Phone,
  Edit2,
  Trash2,
  Link2,
  Check,
  Clock,
  CloudCheck,
  X,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import {
  crearClienteOfflineFirst,
  editarClienteOfflineFirst,
  eliminarClienteOfflineFirst,
} from '../services/cobrosService.js';
import {
  LADAS_PAISES,
  separarLadaYNumero,
  formatearTelefonoVisible,
} from '../utils/phoneUtils.js';

export default function ClientesPage() {
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], []);
  const ventas = useLiveQuery(() => db.ventas_credito.toArray(), [], []);

  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', lada: '52', telefono: '', notas: '' });
  const [error, setError] = useState('');
  const [copiadoToken, setCopiadoToken] = useState(null);

  const calcularDeudaCliente = (cliente) => {
    return ventas
      .filter(
        (v) =>
          v.estado === 'PENDIENTE' &&
          ((cliente.id && v.cliente_id === cliente.id) || v.cliente_token === cliente.token_acceso)
      )
      .reduce((acc, v) => acc + Number(v.saldo_pendiente), 0);
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.telefono.includes(busqueda)
  );

  const abrirModalNuevo = () => {
    setClienteEditando(null);
    setForm({ nombre: '', lada: '52', telefono: '', notas: '' });
    setError('');
    setModalAbierto(true);
  };

  const abrirModalEditar = (cliente) => {
    const { lada, numero } = separarLadaYNumero(cliente.telefono);
    setClienteEditando(cliente);
    setForm({
      nombre: cliente.nombre,
      lada,
      telefono: numero,
      notas: cliente.notas || '',
    });
    setError('');
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');

    if (form.nombre.trim().length < 2) {
      return setError('Ingresa el nombre completo del cliente.');
    }

    const numeroLimpio = form.telefono.replace(/\D/g, '');
    if (!/^\d{7,12}$/.test(numeroLimpio)) {
      return setError('Ingresa un número válido (entre 7 y 10 dígitos sin la lada).');
    }

    const telefonoCompleto = `${form.lada}${numeroLimpio}`;
    if (telefonoCompleto.length > 15) {
      return setError('El teléfono con lada no puede superar los 15 dígitos.');
    }

    const payload = {
      nombre: form.nombre,
      telefono: telefonoCompleto,
      notas: form.notas,
    };

    try {
      if (clienteEditando) {
        await editarClienteOfflineFirst(clienteEditando, payload);
      } else {
        await crearClienteOfflineFirst(payload);
      }
      setModalAbierto(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminar = async (cliente) => {
    const deuda = calcularDeudaCliente(cliente);
    if (deuda > 0) {
      alert(
        `No puedes eliminar a ${cliente.nombre} porque tiene un saldo pendiente de $${deuda.toFixed(2)}.`
      );
      return;
    }
    if (confirm(`¿Eliminar a ${cliente.nombre} de tu directorio?`)) {
      await eliminarClienteOfflineFirst(cliente);
    }
  };

  const copiarEnlacePublico = (token) => {
    const url = `${window.location.origin}/estado-cuenta/${token}`;
    navigator.clipboard.writeText(url);
    setCopiadoToken(token);
    setTimeout(() => setCopiadoToken(null), 2500);
  };

  const paisSeleccionado = LADAS_PAISES.find((p) => p.code === form.lada) || LADAS_PAISES[0];

  return (
    <div className="space-y-4">
      {/* Encabezado y Botón Nuevo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Mis Clientes</h2>
          <p className="text-xs text-slate-500">{clientes.length} registrados en directorio</p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm"
        >
          <UserPlus size={18} />
          Nuevo
        </button>
      </div>

      {/* Buscador en tiempo real */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
        />
      </div>

      {/* Listado de Clientes */}
      {clientesFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <p className="text-slate-500 text-sm">No hay clientes que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientesFiltrados.map((cliente) => {
            const deuda = calcularDeudaCliente(cliente);
            const telFormateado = formatearTelefonoVisible(cliente.telefono);
            return (
              <div
                key={cliente.local_id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{cliente.nombre}</h3>
                      {cliente.sync_status === 'pending' ? (
                        <span
                          title="Pendiente de subir a la nube"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800"
                        >
                          <Clock size={11} /> Local
                        </span>
                      ) : (
                        <CloudCheck size={15} className="text-emerald-600" title="Sincronizado" />
                      )}
                    </div>
                    <a
                      href={`tel:${telFormateado.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 mt-0.5 hover:text-teal-700"
                    >
                      <Phone size={13} /> {telFormateado}
                    </a>
                    {cliente.notas && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{cliente.notas}"</p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 block">
                      Por cobrar
                    </span>
                    <span
                      className={`text-base font-bold ${
                        deuda > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      ${deuda.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Acciones rápidas */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => copiarEnlacePublico(cliente.token_acceso)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                  >
                    {copiadoToken === cliente.token_acceso ? (
                      <>
                        <Check size={14} className="text-emerald-600" /> Enlace copiado
                      </>
                    ) : (
                      <>
                        <Link2 size={14} /> Link estado de cuenta
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirModalEditar(cliente)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleEliminar(cliente)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">
                {clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. Sofía Ramírez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Teléfono (WhatsApp) *
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.lada}
                    onChange={(e) => setForm({ ...form, lada: e.target.value })}
                    className="w-40 px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50 focus:outline-none focus:border-teal-600 shrink-0"
                  >
                    {LADAS_PAISES.map((pais) => (
                      <option key={pais.code} value={pais.code}>
                        {pais.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    maxLength={paisSeleccionado.maxDigits}
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder={form.lada === '1' ? 'Ej. 9842842923' : 'Ej. 7821001122'}
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
                {form.telefono && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Número WhatsApp: <strong>+{form.lada} {form.telefono}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notas o referencia
                </label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Ej. Paga los viernes, prefiere aromas dulces"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm"
              >
                {clienteEditando ? 'Guardar Cambios' : 'Guardar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}