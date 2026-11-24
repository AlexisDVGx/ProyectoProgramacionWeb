import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, AlertCircle, Repeat } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function EstadoCuentaPublico({ token }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarEstado = async () => {
      try {
        const res = await fetch(`${API_URL}/public/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.mensaje || 'Enlace inválido');
        setDatos(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    cargarEstado();
  }, [token]);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <p className="text-sm font-medium text-slate-600">Cargando estado de cuenta...</p>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl p-6 text-center shadow border border-slate-200 space-y-3">
          <AlertCircle size={40} className="mx-auto text-red-500" />
          <h1 className="font-bold text-slate-800 text-lg">Enlace no disponible</h1>
          <p className="text-xs text-slate-500">
            {error || 'Verifica que el enlace compartido sea correcto.'}
          </p>
        </div>
      </div>
    );
  }

  const saldoTotalPendiente = datos.ventas
    .filter((v) => v.estado === 'PENDIENTE')
    .reduce((acc, v) => acc + Number(v.saldo_pendiente), 0);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Cabecera */}
        <div className="bg-teal-700 text-white rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-teal-200 font-semibold">
              {datos.negocio}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] bg-teal-800 px-2.5 py-0.5 rounded-full">
              <ShieldCheck size={13} /> Solo lectura
            </span>
          </div>
          <h1 className="text-xl font-bold">{datos.cliente.nombre}</h1>
          <p className="text-xs text-teal-100">Tel: {datos.cliente.telefono}</p>

          <div className="mt-4 pt-3 border-t border-teal-600 flex justify-between items-baseline">
            <span className="text-xs text-teal-100">Saldo total por pagar:</span>
            <span className="text-2xl font-bold">${saldoTotalPendiente.toFixed(2)}</span>
          </div>
        </div>

        {/* Compras y Abonos */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 px-1">Mis Compras y Abonos</h2>
          {datos.ventas.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-xs text-slate-500 border border-slate-200">
              No tienes compras registradas.
            </div>
          ) : (
            datos.ventas.map((venta) => {
              const abonosVenta = datos.abonos.filter((a) => a.venta_id === venta.id);
              return (
                <div
                  key={venta.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{venta.concepto}</h3>
                      <p className="text-[11px] text-slate-400">
                        Total: ${Number(venta.monto_total).toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        venta.estado === 'LIQUIDADO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {venta.estado === 'LIQUIDADO' ? (
                        <>
                          <CheckCircle2 size={12} /> Liquidado
                        </>
                      ) : (
                        <>
                          <Clock size={12} /> Resta ${Number(venta.saldo_pendiente).toFixed(2)}
                        </>
                      )}
                    </span>
                  </div>

                  {abonosVenta.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 border border-slate-200/70">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Pagos recibidos
                      </p>
                      {abonosVenta.map((ab) => (
                        <div key={ab.id} className="flex justify-between text-xs">
                          <span className="text-slate-600">
                            <strong className="font-mono">{ab.folio}</strong> ·{' '}
                            {new Date(ab.fecha_abono).toLocaleDateString()}
                          </span>
                          <span className="font-bold text-emerald-600">
                            ${Number(ab.monto).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Participación en Tandas */}
        {datos.tandas.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 px-1">Mis Tandas</h2>
            {datos.tandas.map((t) => {
              const pagos = datos.tanda_pagos.filter((p) => p.participante_id === t.participante_id);
              return (
                <div
                  key={t.participante_id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat size={16} className="text-teal-700" />
                      <h3 className="font-bold text-slate-800 text-sm">{t.tanda_nombre}</h3>
                    </div>
                    <span className="text-xs font-bold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full">
                      Turno #{t.numero_turno}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Aportación: ${Number(t.monto_aportacion).toFixed(2)} ({t.frecuencia}) ·{' '}
                    {pagos.length} de {t.total_rondas} rondas pagadas
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}