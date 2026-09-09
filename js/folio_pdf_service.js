/**
 * Hotel 3 Vagos S.A. - FolioPdfService
 * Generador de Comprobantes Oficiales de Folio y Facturas Legales en PDF
 * Cumple con estándares de la SET (RUC 80092341-2, Timbrado 16789423)
 * Incluye membrete institucional y Escarapela de la República del Paraguay.
 */

(function () {
  'use strict';

  const FolioPdfService = {
    /**
     * Construye el documento jsPDF con diseño institucional de alta fidelidad
     * @param {Object} booking 
     * @param {Object} folio 
     * @returns {jsPDF}
     */
    generatePdfDoc(booking, folio = null) {
      const jsPdfConstructor = (window.jspdf && window.jspdf.jsPDF)
        ? window.jspdf.jsPDF
        : (typeof jsPDF !== 'undefined' ? jsPDF : null);

      if (!jsPdfConstructor) {
        throw new Error('La librería jsPDF no está disponible en la página.');
      }

      const doc = new jsPdfConstructor({
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
      const gravada10 = granTotal - iva10;

      const fmtGs = (n) => {
        return new Intl.NumberFormat('es-PY').format(Math.round(n || 0)) + ' Gs.';
      };

      const fmtDate = (dStr) => {
        if (!dStr) return '-';
        const parts = dStr.split('T')[0].split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return dStr;
      };

      // Paleta Corporativa
      const navy = [15, 23, 42];        // #0F172A
      const gold = [197, 160, 89];       // #C5A059
      const slate = [100, 116, 139];     // #64748B
      const border = [226, 232, 240];    // #E2E8F0
      const cardBg = [248, 250, 252];    // #F8FAFC
      const green = [22, 101, 52];       // #166534
      const red = [185, 28, 28];         // #B91C1C

      // 1. Barra superior institucional sobria
      doc.setFillColor(...navy);
      doc.rect(0, 0, 210, 3.5, 'F');

      // 2. Membrete Institucional Limpio y Directo (Sin escarapela)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(...navy);
      doc.text('HOTEL 3 VAGOS S.A.', 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...slate);
      doc.text('Servicios de Alojamiento y Hospedaje Turístico de Alta Gama', 14, 19);
      doc.text('Asunción, Paraguay • Convenio Académico e Institucional UTCD', 14, 23);
      doc.text('Tel: +595 21 555-0199 | E-mail: recepcion@hotel3vagos.com.py', 14, 27);

      // Recuadro Timbrado Legal SET
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...border);
      doc.setLineWidth(0.4);
      doc.roundedRect(128, 6, 68, 24, 2, 2, 'FD');

      const masterRuc = (typeof SettingsModule !== 'undefined' && SettingsModule.currentSettings?.ruc) || window.HOTEL_GLOBAL_SETTINGS?.ruc || '80092341-2';
      const masterName = (typeof SettingsModule !== 'undefined' && SettingsModule.currentSettings?.hotel_name) || window.HOTEL_GLOBAL_SETTINGS?.hotel_name || 'Hotel 3 Vagos';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...navy);
      doc.text('RUC: ' + masterRuc, 132, 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('Timbrado Nº: 16789423', 132, 15);
      doc.text('Válido hasta: 31/12/2026', 132, 19);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...gold);
      doc.text('COMPROBANTE OFICIAL DE FOLIO', 132, 25);

      // Línea divisora
      doc.setDrawColor(...border);
      doc.setLineWidth(0.5);
      doc.line(14, 33, 196, 33);

      // 3. Tarjeta Huésped (Izquierda)
      doc.setFillColor(...cardBg);
      doc.roundedRect(14, 36, 88, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('TITULAR DE LA RESERVA / CLIENTE', 18, 42);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(String(user.full_name || 'Kevin Santacruz'), 18, 47);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('C.I. / RUC: ' + String(user.cedula || user.documento || '4.850.123-K'), 18, 52);
      doc.text('Correo: ' + String(user.email || 'cliente@hotel3vagos.com'), 18, 57);
      doc.text('Teléfono: ' + String(user.phone || '+595 981 123 456'), 18, 62);

      // Tarjeta Hospedaje (Derecha)
      doc.setFillColor(...cardBg);
      doc.roundedRect(108, 36, 88, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('DATOS DE HOSPEDAJE & ESTADÍA', 112, 42);

      const numHab = hab.numero || '101';
      const nomTipo = tipo.nombre || 'Suite Presidencial';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('Habitación ' + numHab + ' (' + nomTipo + ')', 112, 47);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('Código Reserva: ' + String(booking.codigo_reserva || 'RES-0000'), 112, 52);
      doc.text('Check-in: ' + fmtDate(booking.check_in) + ' | Check-out: ' + fmtDate(booking.check_out), 112, 57);
      const adultos = booking.cantidad_personas || booking.adultos || 2;
      const estadoStr = String(booking.estado || 'CONFIRMADA').toUpperCase();
      doc.text('Huéspedes: ' + adultos + ' pers. | Estado: ' + estadoStr, 112, 62);

      let currentY = 70;

      // 4. Tabla de Conceptos & Cargos del Folio
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...navy);
      doc.text('1. DETALLE DE CARGOS Y CONSUMOS DE LA ESTADÍA', 14, currentY);
      currentY += 3;

      let noches = 1;
      if (booking.check_in && booking.check_out) {
        const d1 = new Date(booking.check_in);
        const d2 = new Date(booking.check_out);
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diff > 0) noches = diff;
      }

      const tarifaNoche = Math.round(totalAlojam / noches);

      const itemsCargos = [
        [
          'Alojamiento en Habitación ' + numHab + ' (' + nomTipo + ')\nPeriodo: ' + fmtDate(booking.check_in) + ' al ' + fmtDate(booking.check_out),
          String(noches) + ' noches',
          fmtGs(tarifaNoche),
          fmtGs(totalAlojam)
        ]
      ];

      // Si hay consumos extra registrados en el folio
      if (totalConsumos > 0) {
        itemsCargos.push([
          'Consumos Adicionales de Estadía (Frigobar, Room Service & Lavandería)\nRegistrados durante la estancia en la cuenta de habitación',
          'Varios',
          fmtGs(totalConsumos),
          fmtGs(totalConsumos)
        ]);
      }

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: currentY,
          head: [['Descripción del Concepto / Servicio', 'Cant.', 'Precio Unit.', 'Subtotal (Gs.)']],
          body: itemsCargos,
          theme: 'grid',
          headStyles: {
            fillColor: navy,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left'
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: navy,
            lineColor: border,
            lineWidth: 0.2
          },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 24, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 6;
      } else {
        // Fallback básico sin autotable
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Alojamiento Hab. ' + numHab + ': ' + fmtGs(totalAlojam), 14, currentY + 6);
        if (totalConsumos > 0) {
          doc.text('Consumos extra: ' + fmtGs(totalConsumos), 14, currentY + 11);
        }
        currentY += 18;
      }

      // 5. Tabla de Pagos & Anticipos
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...navy);
      doc.text('2. PAGOS, SEÑAS Y ANTICIPOS REGISTRADOS', 14, currentY);
      currentY += 3;

      const itemsPagos = [
        [
          fmtDate(booking.created_at || booking.check_in),
          'Anticipo / Seña de Confirmación de Reserva',
          booking.metodo_pago || 'Bancard POS / Tarjeta',
          'PAGADO',
          fmtGs(anticipo)
        ]
      ];

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: currentY,
          head: [['Fecha', 'Concepto del Pago', 'Método / Comprobante', 'Estado', 'Monto Acreditado']],
          body: itemsPagos,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59], // Slate 800
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left'
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: navy,
            lineColor: border,
            lineWidth: 0.2
          },
          columnStyles: {
            0: { cellWidth: 26 },
            1: { cellWidth: 66 },
            2: { cellWidth: 42 },
            3: { cellWidth: 22, halign: 'center', textColor: green, fontStyle: 'bold' },
            4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 6;
      } else {
        currentY += 15;
      }

      // 6. Recuadros de Cierre Contable: Liquidación IVA y Totales
      // Caja Izquierda: Liquidación del IVA (Exigencia Legal SET)
      doc.setFillColor(...cardBg);
      doc.roundedRect(14, currentY, 94, 34, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('LIQUIDACIÓN DEL IVA (Art. 85 Ley 6380/19)', 18, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('Gravadas 10%:', 18, currentY + 12);
      doc.text(fmtGs(gravada10), 65, currentY + 12);

      doc.text('Gravadas 5%:', 18, currentY + 17);
      doc.text('0 Gs.', 65, currentY + 17);

      doc.text('Exentas:', 18, currentY + 22);
      doc.text('0 Gs.', 65, currentY + 22);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...navy);
      doc.text('TOTAL LIQUIDACIÓN IVA (10%):', 18, currentY + 28);
      doc.text(fmtGs(iva10), 65, currentY + 28);

      // Caja Derecha: Resumen de Cuenta & Saldo
      doc.setFillColor(...cardBg);
      doc.roundedRect(114, currentY, 82, 34, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('ESTADO DE CUENTA & TOTALES', 118, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('Total Cargos Estadía:', 118, currentY + 12);
      doc.text(fmtGs(granTotal), 190, currentY + 12, { align: 'right' });

      doc.text('Total Pagos / Anticipos:', 118, currentY + 17);
      doc.setTextColor(...green);
      doc.text('- ' + fmtGs(anticipo), 190, currentY + 17, { align: 'right' });

      doc.setDrawColor(...border);
      doc.line(118, currentY + 20, 192, currentY + 20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      if (saldo <= 0) {
        doc.setTextColor(...green);
        doc.text('SALDO PENDIENTE:', 118, currentY + 26);
        doc.text('0 Gs. (PAGADO)', 190, currentY + 26, { align: 'right' });
      } else {
        doc.setTextColor(...red);
        doc.text('SALDO PENDIENTE:', 118, currentY + 26);
        doc.text(fmtGs(saldo), 190, currentY + 26, { align: 'right' });
      }

      currentY += 40;

      // 7. Cláusula Legal y Firmas
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      doc.setTextColor(...slate);
      const legalText = 'Comprobante administrativo emitido con validez tributaria conforme a las disposiciones legales del Ministerio de Economía y Finanzas (SET) de la República del Paraguay. El titular de la reserva reconoce la conformidad de los servicios y consumos detallados.';
      doc.text(legalText, 14, currentY, { maxWidth: 182 });

      currentY += 15;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(24, currentY, 84, currentY);
      doc.line(126, currentY, 186, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...navy);
      doc.text('Firma y Sello de Recepción & Caja', 54, currentY + 4, { align: 'center' });
      doc.text('Firma de Conformidad del Huésped', 156, currentY + 4, { align: 'center' });

      // 8. Pie de Página Institucional
      doc.setFillColor(...navy);
      doc.rect(0, 287, 210, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Hotel 3 Vagos S.A. | Excelencia en Hospitalidad & Confort - Asunción, Paraguay', 105, 293.5, { align: 'center' });

      return doc;
    },

    /**
     * Convierte un número en Guaraníes a texto en mayúsculas (Formato Legal SET)
     * @param {number} amount 
     * @returns {string} Monto en letras
     */
    numeroALetrasGs(amount) {
      const n = Math.round(Number(amount) || 0);
      if (n === 0) return 'CERO GUARANÍES';

      const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
      const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
      const diezAlQuince = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
      const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

      function leerCentenas(num) {
        if (num === 100) return 'CIEN';
        let res = '';
        const c = Math.floor(num / 100);
        const d = Math.floor((num % 100) / 10);
        const u = num % 10;

        if (c > 0) res += centenas[c] + ' ';

        if (d === 1 && u > 0) {
          res += diezAlQuince[u] + ' ';
        } else if (d === 2 && u > 0) {
          res += 'VEINTI' + unidades[u].toLowerCase() + ' ';
        } else {
          if (d > 0) res += decenas[d] + (u > 0 ? ' Y ' : ' ');
          if (u > 0) res += unidades[u] + ' ';
        }
        return res.trim();
      }

      let millones = Math.floor(n / 1000000);
      let miles = Math.floor((n % 1000000) / 1000);
      let resto = n % 1000;
      let resultado = '';

      if (millones > 0) {
        resultado += (millones === 1 ? 'UN MILLÓN' : leerCentenas(millones) + ' MILLONES') + ' ';
      }
      if (miles > 0) {
        resultado += (miles === 1 ? 'MIL' : leerCentenas(miles) + ' MIL') + ' ';
      }
      if (resto > 0) {
        resultado += leerCentenas(resto) + ' ';
      }

      return (resultado.trim() + ' GUARANÍES').toUpperCase();
    },

    /**
     * Genera la Factura Legal Oficial SET / DNIT Paraguay (A4 con 3 columnas IVA)
     * @param {Object} data Datos de la factura
     * @returns {jsPDF}
     */
    generateFacturaLegalSetPdf(data) {
      const jsPdfConstructor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (typeof jsPDF !== 'undefined' ? jsPDF : null);
      if (!jsPdfConstructor) throw new Error('jsPDF no disponible');

      const doc = new jsPdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const navy = [15, 23, 42];
      const slate = [100, 116, 139];
      const border = [203, 213, 225];

      const invNo = data.numero_factura || '001-001-0000125';
      const clientName = data.razon_social || 'Consumidor Final';
      const rucCi = data.ruc_ci || '44444401-7';
      const total = Number(data.monto_total || data.total || 576000);
      const iva10 = Math.round(total / 11);
      const gravada10 = total - iva10;
      const concepto = data.concepto || 'Servicio de Alojamiento y Hospedaje Hotelero';
      const fecha = data.fecha_emision ? data.fecha_emision.split('T')[0] : new Date().toLocaleDateString('es-PY');

      const masterRuc = (typeof SettingsModule !== 'undefined' && SettingsModule.currentSettings?.ruc) || window.HOTEL_GLOBAL_SETTINGS?.ruc || '80092341-2';
      const masterName = (typeof SettingsModule !== 'undefined' && SettingsModule.currentSettings?.hotel_name) || window.HOTEL_GLOBAL_SETTINGS?.hotel_name || 'Hotel 3 Vagos';

      // 1. Membrete Fiscal SET
      doc.setFillColor(...navy);
      doc.rect(0, 0, 210, 3.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...navy);
      doc.text(masterName.toUpperCase() + ' S.A.', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...slate);
      doc.text('Servicios de Alojamiento, Gastronomía y Eventos Turísticos', 14, 20);
      doc.text('Casa Central: Asunción, Paraguay • Tel: +595 21 600 000', 14, 24);
      doc.text('Email: facturacion@hotel3vagos.com.py', 14, 28);

      // Recuadro Timbrado Legal SET (Derecha)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...border);
      doc.roundedRect(128, 6, 68, 26, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...navy);
      doc.text('TIMBRADO Nº: 16789423', 132, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Vigencia: 01/01/2026 al 31/12/2026', 132, 16);
      doc.setFont('helvetica', 'bold');
      doc.text('RUC: ' + masterRuc, 132, 21);
      doc.setFontSize(10);
      doc.setTextColor(180, 83, 9);
      doc.text(`FACTURA: ${invNo}`, 132, 28);

      // 2. Datos del Cliente y Operación
      doc.setDrawColor(...border);
      doc.roundedRect(14, 35, 182, 22, 2, 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...navy);
      doc.text(`Fecha de Emisión: ${fecha}`, 18, 41);
      doc.text('Condición de Venta: CONTADO', 120, 41);
      doc.text(`Nombre o Razón Social: ${clientName}`, 18, 47);
      doc.text(`RUC / C.I. Nº: ${rucCi}`, 120, 47);
      doc.text(`Dirección: Asunción, Paraguay`, 18, 53);
      doc.text(`Moneda: Guaraníes (PYG)`, 120, 53);

      // 3. Tabla con 3 Columnas Reglamentarias de IVA (Exentas, 5%, 10%)
      let y = 62;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Cant.', 17, y + 5.5);
      doc.text('Descripción del Servicio / Producto', 30, y + 5.5);
      doc.text('Precio Unit.', 96, y + 5.5);
      doc.text('Exentas', 125, y + 5.5);
      doc.text('IVA 5%', 150, y + 5.5);
      doc.text('IVA 10%', 174, y + 5.5);

      y += 8;
      doc.rect(14, y, 182, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('1', 19, y + 8);
      doc.text(concepto, 30, y + 8);
      doc.text(new Intl.NumberFormat('es-PY').format(total), 96, y + 8);
      doc.text('0', 130, y + 8);
      doc.text('0', 154, y + 8);
      doc.text(new Intl.NumberFormat('es-PY').format(total), 172, y + 8);

      // Fila de Subtotales
      y += 50;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('SUBTOTALES:', 30, y + 5.5);
      doc.text('0 Gs.', 125, y + 5.5);
      doc.text('0 Gs.', 150, y + 5.5);
      doc.text(new Intl.NumberFormat('es-PY').format(total) + ' Gs.', 170, y + 5.5);

      // 4. Total a Pagar y Total en Letras
      y += 8;
      doc.rect(14, y, 182, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL A PAGAR (Gs.):', 18, y + 6);
      doc.setFontSize(11);
      doc.setTextColor(22, 101, 52);
      doc.text(new Intl.NumberFormat('es-PY').format(total) + ' GUARANÍES', 70, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('SON: ' + this.numeroALetrasGs(total), 18, y + 12);

      // 5. Liquidación del IVA (Exentas, 5%, 10% y Total IVA)
      y += 16;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 10, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('LIQUIDACIÓN DEL IVA:', 18, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('(5%): 0 Gs.', 65, y + 6.5);
      doc.text(`(10%): ${new Intl.NumberFormat('es-PY').format(iva10)} Gs.`, 105, y + 6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL IVA: ${new Intl.NumberFormat('es-PY').format(iva10)} Gs.`, 150, y + 6.5);

      // Firmas y sellos
      y += 35;
      doc.line(25, y, 85, y);
      doc.line(125, y, 185, y);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma y Sello del Emisor (Hotel 3 Vagos)', 30, y + 5);
      doc.text('Firma / Aceptación del Cliente', 135, y + 5);

      // Pie fiscal
      doc.setFontSize(6.8);
      doc.setTextColor(...slate);
      doc.text('Original: Cliente • Duplicado: Archivo Tributario • Constancia emitida conforme a las normas de la DNIT / SET Paraguay', 105, 285, { align: 'center' });

      return doc;
    },

    /**
     * Genera el Ticket / Recibo Térmico continuo de 80mm para POS y App Móvil
     * @param {Object} data Datos del comprobante
     * @returns {jsPDF}
     */
    generateTicketReciboPdf(data) {
      const jsPdfConstructor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (typeof jsPDF !== 'undefined' ? jsPDF : null);
      if (!jsPdfConstructor) throw new Error('jsPDF no disponible');

      // Formato continuo estándar 80mm x 180mm
      const doc = new jsPdfConstructor({ orientation: 'portrait', unit: 'mm', format: [80, 180] });

      const total = Number(data.monto_total || data.monto || 576000);
      const iva10 = Math.round(total / 11);
      const client = data.razon_social || data.full_name || 'Consumidor Final';
      const ruc = data.ruc_ci || data.cedula || '44444401-7';
      const comprobante = data.numero_factura || data.comprobante || `TK-${Date.now().toString().slice(-6)}`;
      const metodo = data.metodo_pago || 'Tarjeta Débito (App)';

      let y = 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('HOTEL 3 VAGOS S.A.', 40, y, { align: 'center' });
      y += 5;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('RUC: 80092341-2 • Timbrado: 16789423', 40, y, { align: 'center' });
      y += 4;
      doc.text('Asunción, Paraguay • Tel: +595 21 555-0199', 40, y, { align: 'center' });
      y += 4;
      doc.text('---------------------------------------------------------', 40, y, { align: 'center' });
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TICKET DE COBRO & RECIBO OFICIAL', 40, y, { align: 'center' });
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Ticket N°: ${comprobante}`, 8, y);
      y += 4;
      doc.text(`Fecha/Hora: ${new Date().toLocaleString('es-PY')}`, 8, y);
      y += 4;
      doc.text(`Cliente: ${client}`, 8, y);
      y += 4;
      doc.text(`RUC / C.I.: ${ruc}`, 8, y);
      y += 4;
      doc.text(`Medio de Pago: ${metodo}`, 8, y);
      y += 4;
      doc.text('---------------------------------------------------------', 40, y, { align: 'center' });
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DEL SERVICIO:', 8, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.text('1x Alojamiento & Consumos Hoteleros', 8, y);
      y += 4;
      doc.text(`Subtotal Gravado (IVA 10%): ${new Intl.NumberFormat('es-PY').format(total - iva10)} Gs.`, 8, y);
      y += 4;
      doc.text(`Liquidación IVA 10%: ${new Intl.NumberFormat('es-PY').format(iva10)} Gs.`, 8, y);
      y += 5;
      doc.text('=========================================================', 40, y, { align: 'center' });
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`TOTAL COBRADO:`, 8, y);
      doc.text(`${new Intl.NumberFormat('es-PY').format(total)} Gs.`, 72, y, { align: 'right' });
      y += 6;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(this.numeroALetrasGs(total), 40, y, { align: 'center' });
      y += 10;

      doc.text('¡Gracias por elegir Hotel 3 Vagos!', 40, y, { align: 'center' });
      y += 4;
      doc.text('Conserve este comprobante de pago.', 40, y, { align: 'center' });

      return doc;
    },

    /**
     * Retorna el string base64 puro (sin prefijo data:application/pdf;base64,) para adjuntar en Brevo
     * @param {Object} booking 
     * @param {Object} folio 
     * @returns {string} Base64 data
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
      const cod = (booking && booking.codigo_reserva) ? booking.codigo_reserva : 'STAY';
      const filename = 'Folio_Reserva_' + cod + '.pdf';
      doc.save(filename);
      if (typeof showToast === 'function') {
        showToast('✓ Descargando comprobante oficial en PDF: ' + filename, 'success');
      }
    },

    /**
     * Abre el documento PDF en una pestaña nueva para inspección o impresión
     * @param {Object} booking 
     * @param {Object} folio 
     */
    previewPdfInNewTab(booking, folio = null) {
      const doc = this.generatePdfDoc(booking, folio);
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    }
  };

  window.FolioPdfService = FolioPdfService;
})();
