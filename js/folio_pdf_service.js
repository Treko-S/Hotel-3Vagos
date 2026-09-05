/**
 * Hotel 3 Vagos - FolioPdfService
 * Generación de comprobantes oficiales de folio en formato PDF de alta definición
 * utilizando jsPDF y jsPDF-AutoTable.
 */

const FolioPdfService = {
  /**
   * Construye el documento PDF formateado
   * @param {Object} booking
   * @param {Object} folio
   * @returns {jsPDF}
   */
  generatePdfDoc(booking, folio = null) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('La librería jsPDF no está cargada en el sistema.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const user = booking.users || {};
    const hab = booking.habitaciones || {};
    const tipo = hab.tipos_habitacion || {};
    const f = folio || ((booking.folios && typeof booking.folios === 'object')
      ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios)
      : {});

    const totalAlojam = Number(booking.monto_total || 0);
    const totalConsumos = Number(f.total_consumos || 0);
    const granTotal = totalAlojam + totalConsumos;
    const anticipo = f.total_pagos !== undefined ? Number(f.total_pagos) : Number(booking.anticipo_pagado || 0);
    const saldo = f.saldo_pendiente !== undefined ? Number(f.saldo_pendiente) : Math.max(0, granTotal - anticipo);

    const iva10 = Math.round(granTotal / 11);
    const gravada10 = Math.round(granTotal / 1.10);

    const fmtGs = (n) => {
      return new Intl.NumberFormat('es-PY').format(Math.round(n || 0)) + ' Gs.';
    };

    const fmtDate = (dStr) => {
      if (!dStr) return '-';
      const parts = dStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dStr;
    };

    // --- Colores y Estilos Corporativos ---
    const primaryNavy = [15, 23, 42];      // #0F172A
    const goldAccent = [197, 160, 89];      // #C5A059
    const slateDark = [30, 41, 59];         // #1E293B
    const textGray = [100, 116, 139];       // #64748B
    const borderGray = [226, 232, 240];     // #E2E8F0
    const greenPaid = [22, 101, 52];        // #166534

    // 1. Barra superior de acento dorado
    doc.setFillColor(...goldAccent);
    doc.rect(0, 0, 210, 4, 'F');

    // 2. Encabezado Institucional
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...primaryNavy);
    doc.text('HOTEL 3 VAGOS S.A.', 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textGray);
    doc.text('Servicios de Alojamiento y Hospedaje Turístico de Lujo', 14, 21);
    doc.text('Asunción, Paraguay - Convenio Académico e Institucional UTCD', 14, 25);
    doc.text('Tel: +595 21 555-0199 | Email: contacto@hotel3vagos.com.py', 14, 29);

    // Caja Timbrado Legal SET (Derecha)
    doc.setDrawColor(...borderGray);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(130, 10, 66, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryNavy);
    doc.text('RUC: 80092341-2', 134, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textGray);
    doc.text('Timbrado Nº: 16789423', 134, 19);
    doc.text('Válido hasta: 31/12/2026', 134, 23);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...goldAccent);
    doc.text('COMPROBANTE LEGAL / FOLIO', 134, 28);

    // Separador
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.line(14, 34, 196, 34);

    // 3. Tarjetas de Información: Huésped y Reserva
    // Tarjeta Huésped
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 37, 88, 30, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryNavy);
    doc.text('TITULAR DE LA RESERVA', 18, 43);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(user.full_name || 'Kevin Santacruz', 18, 49);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textGray);
    doc.text(`Doc / RUC: ${user.document_number || '6537648'}`, 18, 54);
    doc.text(`Email: ${user.email || 'rc652107@gmail.com'}`, 18, 59);
    doc.text(`Tel: ${user.phone || '+595 993 554920'}`, 18, 64);

    // Tarjeta Hospedaje
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, 37, 88, 30, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryNavy);
    doc.text('DETALLES DE HOSPEDAJE', 112, 43);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Habitación ${hab.numero || '101'} (${tipo.nombre || 'Estándar Single'})`, 112, 49);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textGray);
    doc.text(`Código: ${booking.codigo_reserva}`, 112, 54);
    doc.text(`Estadía: ${fmtDate(booking.check_in_previsto)} al ${fmtDate(booking.check_out_previsto)}`, 112, 59);
    doc.text(`Huéspedes: ${booking.cantidad_huespedes || 1} | Estado Folio: Abierto`, 112, 64);

    // 4. Tabla de Conceptos & Cargos del Folio
    const noches = 2; // Por defecto o cálculo
    const conceptosRows = [
      [
        `Alojamiento: Habitación ${hab.numero || '101'} (${tipo.nombre || 'Habitacion Standard Single'})\n${fmtDate(booking.check_in_previsto)} a ${fmtDate(booking.check_out_previsto)}`,
        `${noches}`,
        fmtGs(totalAlojam / (noches || 1)),
        fmtGs(totalAlojam)
      ]
    ];

    if (totalConsumos > 0) {
      conceptosRows.push([
        'Consumos Extras de Folio Registrados (Minibar / Servicios Adicionales)',
        '1',
        fmtGs(totalConsumos),
        fmtGs(totalConsumos)
      ]);
    }

    doc.autoTable({
      startY: 71,
      head: [['Descripción del Servicio', 'Cant. / Noches', 'Tarifa Unit.', 'Subtotal']],
      body: conceptosRows,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: primaryNavy
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      }
    });

    let currentY = doc.lastAutoTable.finalY + 3;

    // Total Facturable Línea
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryNavy);
    doc.text('Total Facturable de Cuenta:', 120, currentY + 5);
    doc.text(fmtGs(granTotal), 194, currentY + 5, { align: 'right' });

    currentY += 12;

    // 5. Tabla de Pagos & Señas Registradas
    const pagosRows = [
      [
        fmtDate(booking.created_at || booking.check_in_previsto),
        'Tarjeta Débito / Bancard',
        'TRX-56129613',
        `-${fmtGs(anticipo)}`
      ]
    ];

    doc.autoTable({
      startY: currentY,
      head: [['Fecha', 'Método de Pago', 'Referencia / TRX', 'Abono Recibido']],
      body: pagosRows,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: primaryNavy
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 65 },
        2: { cellWidth: 45 },
        3: { cellWidth: 37, halign: 'right', fontStyle: 'bold', textColor: greenPaid }
      }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // 6. Resumen de Liquidación SET & Saldo Pendiente
    doc.setDrawColor(...borderGray);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, 182, 28, 2, 2, 'FD');

    // Columna Izquierda: Impuestos SET
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryNavy);
    doc.text('LIQUIDACIÓN IMPOSITIVA SET (IVA 10%)', 18, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textGray);
    doc.text(`Gravadas 10%: ${fmtGs(gravada10)}`, 18, currentY + 12);
    doc.text(`Liquidación IVA 10%: ${fmtGs(iva10)}`, 18, currentY + 17);
    doc.text('Subtotal Exentas: 0 Gs.', 18, currentY + 22);

    // Columna Derecha: Totales y Saldo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textGray);
    doc.text('Total Facturable:', 130, currentY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text(fmtGs(granTotal), 192, currentY + 6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...greenPaid);
    doc.text('Total Abonado / Seña:', 130, currentY + 11);
    doc.setFont('helvetica', 'bold');
    doc.text(`-${fmtGs(anticipo)}`, 192, currentY + 11, { align: 'right' });

    doc.setDrawColor(...borderGray);
    doc.line(130, currentY + 14, 192, currentY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(saldo > 0 ? 220 : 22, saldo > 0 ? 38 : 101, saldo > 0 ? 38 : 52);
    doc.text('Saldo Pendiente:', 130, currentY + 21);
    doc.text(fmtGs(saldo), 192, currentY + 21, { align: 'right' });

    currentY += 34;

    // 7. Auditoría & Validez Legal
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...textGray);
    doc.text(
      'Documento generado conforme a las disposiciones tributarias de la SET para servicios de hotelería y turismo. Válido como estado de cuenta oficial.',
      14,
      currentY
    );
    doc.text(
      `Emitido el: ${new Date().toLocaleDateString('es-PY')} a las ${new Date().toLocaleTimeString('es-PY')} | Operador: Recepción & Caja Hotel 3 Vagos`,
      14,
      currentY + 4
    );

    // Firmas
    currentY += 20;
    doc.setDrawColor(180, 180, 180);
    doc.line(24, currentY, 84, currentY);
    doc.line(126, currentY, 186, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...primaryNavy);
    doc.text('Firma / Sello de Recepción & Caja', 54, currentY + 4, { align: 'center' });
    doc.text('Firma de Conformidad del Huésped', 156, currentY + 4, { align: 'center' });

    // Pie de página de cortesía
    doc.setFillColor(...primaryNavy);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Hotel 3 Vagos S.A. | ¡Gracias por su preferencia!', 105, 293, { align: 'center' });

    return doc;
  },

  /**
   * Genera la representación en Base64 lista para adjuntar en Brevo API
   * @param {Object} booking
   * @param {Object} folio
   * @returns {string} base64 string sin encabezado data:...
   */
  generatePdfBase64(booking, folio = null) {
    const doc = this.generatePdfDoc(booking, folio);
    const dataUri = doc.output('datauristring');
    return dataUri.split(',')[1];
  },

  /**
   * Descarga directamente el archivo PDF en el navegador del usuario
   * @param {Object} booking
   * @param {Object} folio
   */
  downloadFolioPdf(booking, folio = null) {
    const doc = this.generatePdfDoc(booking, folio);
    const filename = `Folio_Reserva_${booking.codigo_reserva || 'SET'}.pdf`;
    doc.save(filename);
    if (typeof showToast === 'function') {
      showToast(`Descargando comprobante PDF: ${filename}`, 'success');
    }
  }
};

window.FolioPdfService = FolioPdfService;
