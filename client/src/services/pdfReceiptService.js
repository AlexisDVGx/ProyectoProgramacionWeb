import { jsPDF } from 'jspdf';

const formatearMoneda = (valor) => `$${Number(valor || 0).toFixed(2)}`;

const formatearFechaHora = (fechaIso) => {
  const fecha = fechaIso ? new Date(fechaIso) : new Date();
  return fecha.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const dibujarEncabezado = (doc, tituloComprobante, folio) => {
  // Franja superior verde institucional
  doc.setFillColor(15, 118, 110); // #0F766E (teal-700)
  doc.rect(0, 0, 80, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Aromas y Bienestar', 40, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(tituloComprobante.toUpperCase(), 40, 16, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text(`FOLIO: ${folio || 'SIN-FOLIO'}`, 40, 21, { align: 'center' });

  doc.setTextColor(30, 41, 59); // slate-800
};

const dibujarPie = (doc, yFinal) => {
  doc.setDrawColor(203, 213, 225);
  doc.line(6, yFinal, 74, yFinal);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Comprobante digital de pago.', 40, yFinal + 5, { align: 'center' });
  doc.text('Gracias por su preferencia y puntualidad.', 40, yFinal + 9, { align: 'center' });
};

/**
 * Genera y descarga el comprobante PDF de un abono de venta a crédito
 */
export const generarComprobanteAbonoPDF = ({ cliente, venta, abono }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 145],
  });

  dibujarEncabezado(doc, 'Recibo de Abono', abono.folio);

  let y = 31;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 6, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatearFechaHora(abono.fecha_abono), 24, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 6, y);
  doc.setFont('helvetica', 'normal');
  const nombreCliente = doc.splitTextToSize(cliente?.nombre || 'Cliente general', 50);
  doc.text(nombreCliente, 24, y);
  y += nombreCliente.length * 4 + 2;

  if (venta?.descripcion) {
    doc.setFont('helvetica', 'bold');
    doc.text('Concepto:', 6, y);
    doc.setFont('helvetica', 'normal');
    const conceptoLineas = doc.splitTextToSize(venta.descripcion, 50);
    doc.text(conceptoLineas, 24, y);
    y += conceptoLineas.length * 4 + 2;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(6, y, 74, y);
  y += 7;

  // Monto abonado destacado
  doc.setFillColor(240, 253, 250); // teal-50
  doc.rect(6, y - 4, 68, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('MONTO ABONADO:', 9, y + 4);
  doc.setFontSize(11);
  doc.text(formatearMoneda(abono.monto), 71, y + 4, { align: 'right' });

  y += 16;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);

  if (venta) {
    const saldoActual = Number(venta.saldo_pendiente || 0);
    doc.setFont('helvetica', 'normal');
    doc.text('Total de la nota:', 6, y);
    doc.text(formatearMoneda(venta.monto_total), 74, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo pendiente:', 6, y);
    doc.text(formatearMoneda(saldoActual), 74, y, { align: 'right' });

    y += 6;
    doc.setFontSize(7.5);
    doc.setTextColor(saldoActual <= 0 ? 22 : 180, saldoActual <= 0 ? 163 : 83, saldoActual <= 0 ? 74 : 9);
    doc.text(
      saldoActual <= 0 ? 'ESTADO: CUENTA LIQUIDADA' : 'ESTADO: SALDO PENDIENTE',
      40,
      y,
      { align: 'center' }
    );
  }

  dibujarPie(doc, 126);
  doc.save(`Recibo_Abono_${abono.folio || Date.now()}.pdf`);
};

/**
 * Genera y descarga el comprobante PDF de una aportación de tanda
 */
export const generarComprobanteTandaPDF = ({ cliente, tanda, participante, pago }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 145],
  });

  dibujarEncabezado(doc, 'Recibo de Tanda', pago.folio);

  let y = 31;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 6, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatearFechaHora(pago.fecha_pago), 24, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Tanda:', 6, y);
  doc.setFont('helvetica', 'normal');
  const nombreTanda = doc.splitTextToSize(tanda?.nombre || 'Tanda', 50);
  doc.text(nombreTanda, 24, y);
  y += nombreTanda.length * 4 + 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Integrante:', 6, y);
  doc.setFont('helvetica', 'normal');
  const nombrePart = doc.splitTextToSize(cliente?.nombre || 'Participante', 50);
  doc.text(nombrePart, 24, y);
  y += nombrePart.length * 4 + 3;

  doc.setDrawColor(203, 213, 225);
  doc.line(6, y, 74, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Número asignado:', 6, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Turno #${participante?.numero_turno || '-'}`, 74, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Ronda pagada:', 6, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ronda ${pago.numero_ronda} de ${tanda?.total_rondas || '-'}`, 74, y, {
    align: 'right',
  });

  y += 9;
  doc.setFillColor(240, 253, 250);
  doc.rect(6, y - 4, 68, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 118, 110);
  doc.text('APORTACIÓN:', 9, y + 4);
  doc.setFontSize(11);
  doc.text(formatearMoneda(pago.monto_pagado), 71, y + 4, { align: 'right' });

  y += 17;
  doc.setFontSize(7.5);
  doc.setTextColor(22, 163, 74);
  doc.text('APORTACIÓN REGISTRADA CON ÉXITO', 40, y, { align: 'center' });

  dibujarPie(doc, 126);
  doc.save(`Recibo_Tanda_${pago.folio || Date.now()}.pdf`);
};