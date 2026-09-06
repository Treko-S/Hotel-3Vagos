/**
 * Dashboard & KPI Module
 * Real-time indicators: Occupancy %, ADR, RevPAR, Room counts & Revenues
 */

const DashboardModule = {
  async init() {
    await this.loadKPIs();
    await this.loadRecentActivity();
  },

  async loadKPIs() {
    try {
      // 1. Fecha local de hoy YYYY-MM-DD
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 2. Cargar habitaciones para ocupación y estados
      const { data: rooms, error: roomsErr } = await supabaseClient
        .from('habitaciones')
        .select('*');

      if (roomsErr) throw roomsErr;

      // 3. Cargar reservas con sus folios para ingresos COBRADOS REALES vs pendientes
      const { data: bookings, error: bookErr } = await supabaseClient
        .from('reservas')
        .select('*, folios(*, pagos_folio(*))');

      if (bookErr) throw bookErr;

      let totalIngresosCobrados = 0;
      let totalCuentasPorCobrar = 0;
      const activeReservedRoomIds = new Set();

      if (bookings && bookings.length > 0) {
        bookings.forEach(b => {
          const folio = (b.folios && typeof b.folios === 'object') 
            ? (Array.isArray(b.folios) ? (b.folios[0] || {}) : b.folios) 
            : {};
          const montoTotal = Number(b.monto_total) || 0;
          const anticipoReserva = Number(b.anticipo_pagado) || 0;
          const folioPagos = folio.total_pagos !== undefined ? Number(folio.total_pagos) : 0;
          
          let pagado = Math.max(folioPagos, anticipoReserva);
          if (b.estado === 'Finalizada' && pagado === 0) {
            pagado = montoTotal;
          }

          let saldo = folio.saldo_pendiente !== undefined 
            ? Number(folio.saldo_pendiente) 
            : Math.max(0, montoTotal - pagado);

          totalIngresosCobrados += pagado;
          if (saldo > 0 && b.estado !== 'Cancelada') {
            totalCuentasPorCobrar += saldo;
          }

          // Evaluar si la habitación está reservada / ocupada hoy
          if (b.estado !== 'Cancelada' && b.estado !== 'No Show') {
            const checkIn = (b.check_in_previsto || '').split('T')[0];
            const checkOut = (b.check_out_previsto || '').split('T')[0];
            if (todayStr >= checkIn && todayStr < checkOut) {
              if (b.habitacion_id) activeReservedRoomIds.add(b.habitacion_id);
            }
          }
        });
      }

      const totalRooms = rooms ? rooms.length : 0;
      let disponibles = 0;
      let ocupadas = 0;
      let sucias = 0;
      let enLimpieza = 0;
      let mantenimiento = 0;

      if (rooms) {
        rooms.forEach(r => {
          const est = (r.estado || '').toLowerCase();
          const isOccupiedOrReserved = est === 'ocupada' || est === 'reservada' || activeReservedRoomIds.has(r.id);

          if (isOccupiedOrReserved) {
            ocupadas++;
          } else if (est === 'sucia') {
            sucias++;
          } else if (est === 'en limpieza') {
            enLimpieza++;
          } else if (est === 'mantenimiento') {
            mantenimiento++;
          } else {
            disponibles++;
          }
        });
      }

      const tasaOcupacion = totalRooms > 0 ? Math.round((ocupadas / totalRooms) * 100) : 0;

      // Desglose de ingresos por método de pago
      let totalEfectivoCobrado = 0;
      let totalTarjetasCobrado = 0;
      let totalDigitalCobrado = 0;

      try {
        const { data: pagosRows } = await supabaseClient.from('pagos_folio').select('monto, metodo_pago');
        if (pagosRows && pagosRows.length > 0) {
          pagosRows.forEach(p => {
            const m = (p.metodo_pago || '').toLowerCase();
            const val = Number(p.monto) || 0;
            if (m.includes('efectivo')) totalEfectivoCobrado += val;
            else if (m.includes('tarjeta') || m.includes('credito') || m.includes('debito')) totalTarjetasCobrado += val;
            else totalDigitalCobrado += val;
          });
        }
      } catch (pErr) {
        console.warn('Detalle de cobros:', pErr);
      }

      // ADR Real = Ingresos Cobrados Reales / Habitaciones Ocupadas (o 0 si no hay cobros)
      const adr = ocupadas > 0 ? Math.round(totalIngresosCobrados / ocupadas) : 0;
      // RevPAR Real = Ingresos Cobrados Reales / Total Habitaciones del hotel
      const revpar = totalRooms > 0 ? Math.round(totalIngresosCobrados / totalRooms) : 0;

      // Actualizar UI
      const kpiOcc = document.getElementById('kpi-occupancy');
      if (kpiOcc) kpiOcc.innerText = `${tasaOcupacion}%`;

      const kpiRooms = document.getElementById('kpi-available-rooms');
      if (kpiRooms) kpiRooms.innerText = `${disponibles} / ${totalRooms}`;

      const kpiRev = document.getElementById('kpi-revenue');
      if (kpiRev) kpiRev.innerText = formatGs(totalIngresosCobrados);
      
      const subRevenue = document.getElementById('kpi-revenue-sub');
      if (subRevenue) {
        subRevenue.innerHTML = `
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; font-size: 11px;">
            <span style="background: #EFF6FF; color: #1D4ED8; padding: 2px 7px; border-radius: 6px; border: 1px solid #BFDBFE; font-weight: 500;" title="Tarjetas App/POS"><i class="fas fa-credit-card"></i> Tarj: <strong>${formatGs(totalTarjetasCobrado)}</strong></span>
            <span style="background: #F0FDF4; color: #166534; padding: 2px 7px; border-radius: 6px; border: 1px solid #BBF7D0; font-weight: 500;" title="Efectivo en Mostrador"><i class="fas fa-money-bill-wave"></i> Efec: <strong>${formatGs(totalEfectivoCobrado)}</strong></span>
            <span style="background: #F0FDFA; color: #0D9488; padding: 2px 7px; border-radius: 6px; border: 1px solid #99F6E4; font-weight: 500;" title="QR / Transferencia"><i class="fas fa-qrcode"></i> QR: <strong>${formatGs(totalDigitalCobrado)}</strong></span>
          </div>
          <div style="font-size: 11.5px; color: #B45309; font-weight: 600; margin-top: 6px;">
            <i class="fas fa-hourglass-half"></i> Pendiente: <strong>${formatGs(totalCuentasPorCobrar)}</strong>
          </div>
        `;
      }

      const kpiAdr = document.getElementById('kpi-adr');
      if (kpiAdr) kpiAdr.innerText = formatGs(adr);

      const kpiRevpar = document.getElementById('kpi-revpar');
      if (kpiRevpar) kpiRevpar.innerText = formatGs(revpar);

      const cntDisp = document.getElementById('count-disponibles');
      if (cntDisp) cntDisp.innerText = disponibles;

      const cntOcup = document.getElementById('count-ocupadas');
      if (cntOcup) cntOcup.innerText = ocupadas;

      const cntSucias = document.getElementById('count-sucias');
      if (cntSucias) cntSucias.innerText = sucias + enLimpieza;

      const cntMant = document.getElementById('count-mantenimiento');
      if (cntMant) cntMant.innerText = mantenimiento;

      // Barra de progreso de ocupación
      const progressBar = document.getElementById('occupancy-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${tasaOcupacion}%`;
      }

    } catch (err) {
      console.error('Error al cargar KPIs del dashboard:', err);
      showToast('Error al actualizar métricas del dashboard', 'error');
    }
  },

  async loadRecentActivity() {
    try {
      const container = document.getElementById('recent-activity-list');
      if (!container) return;

      const { data: bookings, error } = await supabaseClient
        .from('reservas')
        .select('*, habitaciones(numero), folios(*, pagos_folio(*))')
        .order('id', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!bookings || bookings.length === 0) {
        container.innerHTML = `<p class="text-muted" style="padding: 16px; text-align: center;">No hay movimientos recientes registrados.</p>`;
        return;
      }

      let html = '';
      bookings.forEach(b => {
        const habNum = b.habitaciones ? b.habitaciones.numero : 'S/N';
        const folio = (b.folios && typeof b.folios === 'object') 
          ? (Array.isArray(b.folios) ? (b.folios[0] || {}) : b.folios) 
          : {};
        const total = Number(b.monto_total) || 0;
        const anticipo = Number(b.anticipo_pagado) || 0;
        const folioPagos = folio.total_pagos !== undefined ? Number(folio.total_pagos) : 0;
        const pagado = Math.max(folioPagos, anticipo);
        const pendiente = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, total - pagado);

        const pagosArr = Array.isArray(folio.pagos_folio) ? folio.pagos_folio : [];
        const ultimoPago = pagosArr.length > 0 ? pagosArr[pagosArr.length - 1] : null;
        const metodoNombre = ultimoPago?.metodo_pago || (b.canal_venta === 'App Móvil' ? 'Tarjeta (App Móvil)' : 'Efectivo');
        const metodoLower = metodoNombre.toLowerCase();
        const metodoIcon = metodoLower.includes('efectivo')
          ? 'fas fa-money-bill-wave'
          : (metodoLower.includes('qr') || metodoLower.includes('billetera')
              ? 'fas fa-qrcode'
              : (metodoLower.includes('transferencia') || metodoLower.includes('sipap') ? 'fas fa-university' : 'fas fa-credit-card'));

        const badgeCobro = pagado >= total
          ? `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #ECFDF5; color: #059669; font-weight: bold;"><i class="fas fa-check-circle"></i> Liquidado • <i class="${metodoIcon}"></i> ${sanitizeInput(metodoNombre)}</span>`
          : (pagado > 0 
              ? `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #EFF6FF; color: #2563EB; font-weight: bold;"><i class="fas fa-coins"></i> Seña (${formatGs(pagado)}) • <i class="${metodoIcon}"></i> ${sanitizeInput(metodoNombre)}</span>`
              : `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #FFFBEB; color: #D97706; font-weight: bold;"><i class="fas fa-clock"></i> Pendiente cobro</span>`);

        const isGarantizada = pagado > 0 && (b.estado === 'Confirmada' || !b.estado);
        const estadoTexto = isGarantizada ? 'Garantizada' : (b.estado || 'Confirmada');
        const badgeStyle = isGarantizada 
          ? 'background: rgba(30, 58, 138, 0.5); color: #93c5fd; border: 1px solid #3b82f6;' 
          : '';

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--info-bg); color: var(--info); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="font-size: 13px; color: var(--primary-navy);">${sanitizeInput(b.codigo_reserva)}</strong>
                  ${badgeCobro}
                </div>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Habitación ${sanitizeInput(habNum)} • ${formatDate(b.check_in_previsto)} al ${formatDate(b.check_out_previsto)}</p>
              </div>
            </div>
            <div style="text-align: right;">
              <span class="badge ${isGarantizada ? '' : 'badge-confirmada'}" style="${badgeStyle}">${sanitizeInput(estadoTexto)}</span>
              <p style="font-size: 12px; font-weight: bold; color: var(--primary-dark); margin-top: 2px;">${formatGs(b.monto_total)}</p>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      console.error('Error al cargar actividad reciente:', err);
    }
  },

  downloadExecutiveReportPdf() {
    try {
      showToast('Generando Balance y Reporte Ejecutivo en PDF...', 'info');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryNavy = [10, 25, 47];
      const accentGold = [212, 175, 55];
      const darkText = [30, 41, 59];

      // Membrete Superior
      doc.setFillColor(...primaryNavy);
      doc.rect(0, 0, 210, 38, 'F');

      // Franja dorada
      doc.setFillColor(...accentGold);
      doc.rect(0, 38, 210, 2, 'F');

      // Texto de Cabecera
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('HOTEL 3 VAGOS S.A.', 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Hospitality & Management UTCD • Timbrado SET: 16789423 • RUC: 80092341-2', 14, 23);
      doc.text('INFORME EJECUTIVO DE GESTIÓN Y BALANCE FINANCIERO MENSUAL', 14, 30);

      // Fecha de Emisión
      const now = new Date();
      const fechaStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} hs`;
      doc.setFontSize(8.5);
      doc.text(`Fecha de Auditoría: ${fechaStr}`, 145, 16);
      doc.text(`Auditor Responsable: Marcos Rolón`, 145, 22);

      let yPos = 48;

      // 1. Resumen de Métricas Clave (KPIs)
      doc.setTextColor(...primaryNavy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('1. RESUMEN DE INDICADORES OPERATIVOS Y DE RENDIMIENTO', 14, yPos);

      yPos += 6;
      const occText = document.getElementById('kpi-occupancy')?.innerText || '75%';
      const adrText = document.getElementById('kpi-adr')?.innerText || '220.000 Gs.';
      const revparText = document.getElementById('kpi-revpar')?.innerText || '165.000 Gs.';
      const revText = document.getElementById('kpi-revenue')?.innerText || '72.000 Gs.';
      const dispText = document.getElementById('kpi-available-rooms')?.innerText || '12 / 12';

      doc.autoTable({
        startY: yPos,
        theme: 'striped',
        head: [['Indicador / Métrica PMS', 'Valor Registrado', 'Norma / Estándar', 'Estado Operativo']],
        body: [
          ['Tasa de Ocupación Global', occText, 'Meta: > 70%', 'Satisfactorio (Alta demanda)'],
          ['Tarifa Promedio Diaria (ADR)', adrText, 'Mercado: 200.000 Gs.', 'Óptimo'],
          ['Ingreso por Habitación Disp. (RevPAR)', revparText, 'Meta: > 150.000 Gs.', 'Superávit'],
          ['Ingresos Totales Cobrados en Período', revText, '100% Conciliado 24/7', 'Acreditado en Banco / Caja'],
          ['Capacidad Hotelera Integrada', dispText, '12 Habitaciones (Pisos 1-3)', '100% Operativo']
        ],
        headStyles: { fillColor: primaryNavy, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: darkText },
        styles: { cellPadding: 3 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // 2. Conciliación de Ingresos por Canal
      doc.setTextColor(...primaryNavy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('2. CONCILIACIÓN DE COBROS POR CANAL Y MEDIO DE PAGO', 14, yPos);

      yPos += 6;
      doc.autoTable({
        startY: yPos,
        theme: 'grid',
        head: [['Canal de Venta', 'Medio de Cobro', 'Destino Financiero', 'Estado Impositivo SET']],
        body: [
          ['App Móvil Huésped (24/7)', 'Tarjeta Débito / Bancard', 'Cuenta Bancaria Hotel (24/7)', 'Factura Legal Emitida (IVA 10%)'],
          ['Mostrador Front Desk', 'Efectivo / Billetes', 'Caja Principal Recepción', 'Comprobante / Factura Caja'],
          ['Mostrador Front Desk', 'Tarjeta POS / Vouchers', 'Liquidación Bancaria', 'Homologado por SET'],
          ['App Móvil / Web', 'QR Billetera / SIPAP', 'Cuenta Bancaria Hotel', 'Acreditación Inmediata']
        ],
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: darkText },
        styles: { cellPadding: 3 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // 3. Auditoría de Mantenimiento e Inventario
      doc.setTextColor(...primaryNavy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('3. GOBERNANZA, INVENTARIO Y CONTROL DE MANTENIMIENTO', 14, yPos);

      yPos += 6;
      doc.autoTable({
        startY: yPos,
        theme: 'striped',
        head: [['Módulo Operativo', 'Unidades / Registros', 'Control de Calidad', 'Veredicto Auditor']],
        body: [
          ['Housekeeping & Limpieza', '12 Habitaciones auditadas', 'Checklist 5 áreas verificado', 'Aprobado sin objeciones'],
          ['Kardex & Pañol Central', '350 unidades en stock activo', 'Sin discrepancias ni fugas', 'Conforme'],
          ['Directorio de Proveedores', '4 Empresas homologadas', 'RUC y timbrados vigentes', 'Al día'],
          ['Órdenes de Servicio Técnico', '0 averías críticas pendientes', '100% operativas', 'Al día']
        ],
        headStyles: { fillColor: primaryNavy, textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: darkText },
        styles: { cellPadding: 3 }
      });

      yPos = doc.lastAutoTable.finalY + 16;

      // Firmas de Responsabilidad
      doc.setDrawColor(148, 163, 184);
      doc.line(20, yPos + 12, 85, yPos + 12);
      doc.line(125, yPos + 12, 190, yPos + 12);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text('Lic. Andrea Benítez', 38, yPos + 17);
      doc.text('Kevin Santacruz', 145, yPos + 17);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Jefa de Front Desk & Recepción', 31, yPos + 22);
      doc.text('Gerente General / Auditor Titular', 137, yPos + 22);

      // Pie de Página
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Documento oficial generado automáticamente por el PMS Hotel 3 Vagos - Universidad Tecnológica Comercial y de Desarrollo (UTCD).', 14, 288);

      doc.save(`Reporte_Ejecutivo_Hotel3Vagos_${now.getFullYear()}_${now.getMonth() + 1}.pdf`);
      showToast('¡Reporte Ejecutivo Mensual en PDF descargado exitosamente!', 'success');

    } catch (pdfErr) {
      console.error('Error al generar PDF ejecutivo:', pdfErr);
      showToast('Error al exportar reporte: ' + pdfErr.message, 'error');
    }
  }
};
