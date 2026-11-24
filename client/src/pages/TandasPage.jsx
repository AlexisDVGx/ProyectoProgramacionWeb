import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PlusCircle,
  Repeat,
  CheckCircle2,
  Clock,
  Award,
  Users,
  Calendar,
  Trash2,
  Archive,
  UserCheck,
  X,
} from 'lucide-react';
import { db } from '../db/dexieDb.js';
import {
  asegurarClienteAdmin,
  crearTandaOnline,
  finalizarTandaOfflineFirst,
  registrarPagoTandaOfflineFirst,
  toggleEntregaTurno,
} from '../services/tandasYGastosService.js';

const calcularFechaEstimada = (fechaInicio, frecuencia, indiceTurno) => {
  if (!fechaInicio) return '';
  const base = new Date(`${fechaInicio}T12:00:00`);
  const diasPorRonda = frecuencia === 'SEMANAL' ? 7 : 15;
  base.setDate(base.getDate() + diasPorRonda * indiceTurno);
  return base.toISOString().split('T')[0];
};

export default function TandasPage({ user }) {
  const usuarioActual =
    user || JSON.parse(localStorage.getItem('user_data') || 'null');

  const tandas = useLiveQuery(() => db.tandas.toArray(), [], []);
  const participantes = useLiveQuery(() => db.tanda_participantes.toArray(), [], []);
  const pagos = useLiveQuery(() => db.tanda_pagos.toArray(), [], []);
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), [], []);

  const [vistaEstado, setVistaEstado] = useState('ACTIVA'); // 'ACTIVA' | 'FINALIZADA'
  const [rondaActivaPorTanda, setRondaActivaPorTanda] = useState({});

  // Modal Nueva Tanda
  const [modalNueva, setModalNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [agregandoAdmin, setAgregandoAdmin] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState('');
  const [formTanda, setFormTanda] = useState({
    nombre: '',
    monto_aportacion: '',
    frecuencia: 'QUINCENAL',
    fecha_inicio: new Date().toISOString().split('T')[0],
    turnos: [],
  });

  const obtenerCliente = (clienteId) => clientes.find((c) => c.id === clienteId);

  const tandasActivas = tandas.filter((t) => t.estado !== 'FINALIZADA');
  const tandasTerminadas = tandas.filter((t) => t.estado === 'FINALIZADA');
  const tandasMostradas = vistaEstado === 'FINALIZADA' ? tandasTerminadas : tandasActivas;

  // Verifica si todas las rondas están pagadas y todos los turnos entregados
  const puedeTerminarTanda = (tanda, listaParticipantes) => {
    if (tanda.estado === 'FINALIZADA' || listaParticipantes.length < 2) return false;

    const todosEntregados = listaParticipantes.every((p) => Boolean(p.entregado));
    if (!todosEntregados) return false;

    for (let ronda = 1; ronda <= Number(tanda.total_rondas); ronda++) {
      const pagadoresRonda = listaParticipantes.filter(
        (p) => Number(p.numero_turno) !== ronda
      );
      const todosPagaronRonda = pagadoresRonda.every((p) =>
        pagos.some(
          (pg) => pg.participante_id === p.id && Number(pg.numero_ronda) === ronda
        )
      );
      if (!todosPagaronRonda) return false;
    }

    return true;
  };

  const agregarParticipanteATurno = () => {
    const idNum = Number(clienteSeleccionadoId);
    if (!idNum) return;
    const cliente = clientes.find((c) => c.id === idNum);
    if (!cliente) return;

    setFormTanda((prev) => ({
      ...prev,
      turnos: [...prev.turnos, { cliente_id: cliente.id, nombre: cliente.nombre }],
    }));
    setClienteSeleccionadoId('');
  };

  const handleIncluirAdmin = async () => {
    setErrorModal('');
    setAgregandoAdmin(true);
    try {
      const clienteAdmin = await asegurarClienteAdmin(usuarioActual);
      if (!clienteAdmin?.id) {
        throw new Error('No se pudo vincular tu usuario como participante.');
      }
      setFormTanda((prev) => ({
        ...prev,
        turnos: [
          ...prev.turnos,
          { cliente_id: clienteAdmin.id, nombre: clienteAdmin.nombre },
        ],
      }));
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setAgregandoAdmin(false);
    }
  };

  const quitarParticipanteDeTurno = (index) => {
    setFormTanda((prev) => ({
      ...prev,
      turnos: prev.turnos.filter((_, idx) => idx !== index),
    }));
  };

  const handleCrearTanda = async (e) => {
    e.preventDefault();
    setErrorModal('');
    setGuardando(true);

    try {
      const participantesConFechas = formTanda.turnos.map((t, index) => ({
        cliente_id: t.cliente_id,
        fecha_entrega_estimada: calcularFechaEstimada(
          formTanda.fecha_inicio,
          formTanda.frecuencia,
          index
        ),
      }));

      await crearTandaOnline({
        nombre: formTanda.nombre,
        monto_aportacion: formTanda.monto_aportacion,
        frecuencia: formTanda.frecuencia,
        fecha_inicio: formTanda.fecha_inicio,
        participantes: participantesConFechas,
      });

      setModalNueva(false);
      setVistaEstado('ACTIVA');
      setFormTanda({
        nombre: '',
        monto_aportacion: '',
        frecuencia: 'QUINCENAL',
        fecha_inicio: new Date().toISOString().split('T')[0],
        turnos: [],
      });
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleCobrarRonda = async (tanda, participante, numeroRonda) => {
    try {
      await registrarPagoTandaOfflineFirst({
        tanda,
        participante,
        numero_ronda: numeroRonda,
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTerminarTanda = async (tanda) => {
    if (
      confirm(
        `¿Marcar "${tanda.nombre}" como terminada? Podrás consultarla en la pestaña Terminadas.`
      )
    ) {
      await finalizarTandaOfflineFirst(tanda);
    }
  };

  const clientesSincronizados = clientes.filter((c) => Boolean(c.id));

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Tandas y Ahorro</h2>
          <p className="text-xs text-slate-500">Control de rondas, turnos y entregas</p>
        </div>

        <button
          onClick={() => {
            setErrorModal('');
            setModalNueva(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm shrink-0"
        >
          <PlusCircle size={18} />
          Nueva Tanda
        </button>
      </div>

      {/* Pestañas Activas vs. Terminadas */}
      <div className="flex rounded-xl bg-slate-200/80 p-1">
        <button
          onClick={() => setVistaEstado('ACTIVA')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            vistaEstado === 'ACTIVA'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Activas ({tandasActivas.length})
        </button>
        <button
          onClick={() => setVistaEstado('FINALIZADA')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
            vistaEstado === 'FINALIZADA'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Archive size={14} /> Terminadas ({tandasTerminadas.length})
        </button>
      </div>

      {/* Listado de Tandas */}
      {tandasMostradas.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
          <Repeat size={32} className="mx-auto text-slate-300" />
          <p className="text-slate-600 font-medium text-sm">
            {vistaEstado === 'FINALIZADA'
              ? 'No tienes tandas terminadas aún'
              : 'No tienes tandas activas'}
          </p>
          <p className="text-xs text-slate-400">
            {vistaEstado === 'FINALIZADA'
              ? 'Cuando completes todas las rondas y entregas de una tanda podrás archivarla aquí.'
              : 'Crea una tanda semanal o quincenal para llevar el control de pagos por ronda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tandasMostradas.map((tanda) => {
            const listaParticipantes = participantes
              .filter((p) => p.tanda_id === tanda.id)
              .sort((a, b) => a.numero_turno - b.numero_turno);

            const esTerminada = tanda.estado === 'FINALIZADA';
            const listaParaTerminar = puedeTerminarTanda(tanda, listaParticipantes);

            const rondaActual = rondaActivaPorTanda[tanda.id] || 1;
            const participanteEnTurno = listaParticipantes.find(
              (p) => Number(p.numero_turno) === Number(rondaActual)
            );
            const clienteEnTurno = participanteEnTurno
              ? obtenerCliente(participanteEnTurno.cliente_id)
              : null;

            const aportantesEsperados = Math.max(1, Number(tanda.total_rondas) - 1);
            const pozoEfectivo = Number(tanda.monto_aportacion) * aportantesEsperados;

            const participantesQuePagan = listaParticipantes.filter(
              (p) => Number(p.numero_turno) !== Number(rondaActual)
            );

            const pagosEnRonda = participantesQuePagan.filter((p) =>
              pagos.some(
                (pg) =>
                  pg.participante_id === p.id && Number(pg.numero_ronda) === Number(rondaActual)
              )
            ).length;

            return (
              <div
                key={tanda.local_id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4"
              >
                {/* Cabecera de la Tanda */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-base">{tanda.nombre}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700">
                        {tanda.frecuencia}
                      </span>
                      {esTerminada && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                          Finalizada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Aportación: <strong>${Number(tanda.monto_aportacion).toFixed(2)}</strong> ·
                      Pozo a entregar:{' '}
                      <strong className="text-teal-700">${pozoEfectivo.toFixed(2)}</strong>
                    </p>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                    {tanda.total_rondas} rondas
                  </span>
                </div>

                {/* Selector de Rondas */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                    Selecciona Ronda
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {Array.from({ length: tanda.total_rondas }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        onClick={() =>
                          setRondaActivaPorTanda((prev) => ({ ...prev, [tanda.id]: num }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                          rondaActual === num
                            ? 'bg-teal-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Ronda {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tarjeta del Beneficiario de la Ronda */}
                {participanteEnTurno && (
                  <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-teal-800">
                        <Award size={13} /> Recibe Tanda (Turno #{participanteEnTurno.numero_turno})
                      </span>
                      <p className="font-bold text-slate-800 text-sm">
                        {clienteEnTurno ? clienteEnTurno.nombre : 'Participante'}
                      </p>
                      {participanteEnTurno.fecha_entrega_estimada && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar size={11} /> Entrega:{' '}
                          {String(participanteEnTurno.fecha_entrega_estimada).slice(0, 10)}
                        </p>
                      )}
                    </div>

                    {esTerminada ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white">
                        ✓ Entregada
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          toggleEntregaTurno({
                            tandaId: tanda.id,
                            participante: participanteEnTurno,
                            entregado: !participanteEnTurno.entregado,
                          })
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                          participanteEnTurno.entregado
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-teal-600 text-teal-700 hover:bg-teal-700 hover:text-white'
                        }`}
                      >
                        {participanteEnTurno.entregado ? '✓ Entregada' : 'Marcar Entrega'}
                      </button>
                    )}
                  </div>
                )}

                {/* Lista de Aportaciones de la Ronda */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold flex items-center gap-1">
                      <Users size={13} /> Pagos Ronda {rondaActual}
                    </span>
                    <span>
                      <strong>{pagosEnRonda}</strong> de {participantesQuePagan.length} pagados
                    </span>
                  </div>

                  <div className="space-y-2">
                    {listaParticipantes.map((part) => {
                      const cli = obtenerCliente(part.cliente_id);
                      const esSuTurno = Number(part.numero_turno) === Number(rondaActual);
                      const pagoRegistrado = pagos.find(
                        (pg) =>
                          pg.participante_id === part.id &&
                          Number(pg.numero_ronda) === Number(rondaActual)
                      );

                      return (
                        <div
                          key={part.local_id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border ${
                            esSuTurno
                              ? 'bg-teal-50/40 border-teal-200'
                              : 'bg-slate-50 border-slate-200/80'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                #{part.numero_turno}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {cli ? cli.nombre : `Cliente #${part.cliente_id}`}
                              </span>
                            </div>
                            {pagoRegistrado && (
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                Folio: {pagoRegistrado.folio}
                              </p>
                            )}
                          </div>

                          {esSuTurno ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                              <Award size={13} /> Su turno (No paga)
                            </span>
                          ) : pagoRegistrado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 size={13} /> Pagado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCobrarRonda(tanda, part, rondaActual)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm"
                            >
                              <Clock size={13} /> Cobrar ${Number(tanda.monto_aportacion).toFixed(0)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Botón Terminar Tanda cuando todas las rondas y entregas están completas */}
                {listaParaTerminar && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleTerminarTanda(tanda)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5 transition"
                    >
                      <CheckCircle2 size={16} /> Terminar tanda y archivar en Terminadas
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Nueva Tanda */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Crear Nueva Tanda</h3>
              <button onClick={() => setModalNueva(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>

            {errorModal && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleCrearTanda} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre de la tanda *
                </label>
                <input
                  type="text"
                  required
                  value={formTanda.nombre}
                  onChange={(e) => setFormTanda({ ...formTanda, nombre: e.target.value })}
                  placeholder="Ej. Tanda Quincenal Navidad"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Aportación ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="10"
                    required
                    value={formTanda.monto_aportacion}
                    onChange={(e) =>
                      setFormTanda({ ...formTanda, monto_aportacion: e.target.value })
                    }
                    placeholder="500.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Frecuencia *
                  </label>
                  <select
                    value={formTanda.frecuencia}
                    onChange={(e) => setFormTanda({ ...formTanda, frecuencia: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-teal-600"
                  >
                    <option value="QUINCENAL">Quincenal</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Fecha de inicio (Ronda 1) *
                </label>
                <input
                  type="date"
                  required
                  value={formTanda.fecha_inicio}
                  onChange={(e) => setFormTanda({ ...formTanda, fecha_inicio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Asignación de Turnos */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Turnos ({formTanda.turnos.length})
                  </label>
                  {usuarioActual && (
                    <button
                      type="button"
                      onClick={handleIncluirAdmin}
                      disabled={agregandoAdmin}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-bold border border-teal-200"
                    >
                      <UserCheck size={13} />
                      {agregandoAdmin ? 'Agregando...' : '+ Incluirme a mí'}
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={clienteSeleccionadoId}
                    onChange={(e) => setClienteSeleccionadoId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-teal-600"
                  >
                    <option value="">-- Elegir cliente --</option>
                    {clientesSincronizados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={agregarParticipanteATurno}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                  >
                    + Turno
                  </button>
                </div>

                {formTanda.turnos.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {formTanda.turnos.map((turno, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200"
                      >
                        <span>
                          <strong className="text-teal-700">Turno #{idx + 1}:</strong> {turno.nombre}
                        </span>
                        <button
                          type="button"
                          onClick={() => quitarParticipanteDeTurno(idx)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm disabled:opacity-50"
              >
                {guardando
                  ? 'Creando Tanda...'
                  : `Guardar Tanda (${formTanda.turnos.length} rondas)`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}