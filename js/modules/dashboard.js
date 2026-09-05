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
          <div style="font-size: 11px; margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap;">
            <span style="color: #1D4ED8;" title="Tarjetas App/POS"><i class="fas fa-credit-card"></i> Tarj: <strong>${formatGs(totalTarjetasCobrado)}</strong></span>
            <span style="color: #166534;" title="Efectivo en Mostrador"><i class="fas fa-money-bill-wave"></i> Efec: <strong>${formatGs(totalEfectivoCobrado)}</strong></span>
            <span style="color: #0D9488;" title="QR / Transferencia"><i class="fas fa-qrcode"></i> QR: <strong>${formatGs(totalDigitalCobrado)}</strong></span>
          </div>
          <div style="font-size: 11px; color: #b45309; font-weight: 600; margin-top: 3px;">
            Pendiente: <strong>${formatGs(totalCuentasPorCobrar)}</strong>
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
  }
};
