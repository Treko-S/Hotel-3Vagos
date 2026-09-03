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
      // 1. Cargar habitaciones para ocupación y estados
      const { data: rooms, error: roomsErr } = await supabaseClient
        .from('habitaciones')
        .select('*');

      if (roomsErr) throw roomsErr;

      const totalRooms = rooms ? rooms.length : 0;
      let disponibles = 0;
      let ocupadas = 0;
      let sucias = 0;
      let enLimpieza = 0;
      let mantenimiento = 0;

      rooms.forEach(r => {
        const est = (r.estado || '').toLowerCase();
        if (est === 'disponible') disponibles++;
        else if (est === 'ocupada' || est === 'reservada') ocupadas++;
        else if (est === 'sucia') sucias++;
        else if (est === 'en limpieza') enLimpieza++;
        else if (est === 'mantenimiento') mantenimiento++;
      });

      const tasaOcupacion = totalRooms > 0 ? Math.round((ocupadas / totalRooms) * 100) : 0;

      // 2. Cargar reservas con sus folios para ingresos COBRADOS REALES vs pendientes
      const { data: bookings, error: bookErr } = await supabaseClient
        .from('reservas')
        .select('*, folios(*)');

      if (bookErr) throw bookErr;

      let totalIngresosCobrados = 0;
      let totalCuentasPorCobrar = 0;

      if (bookings && bookings.length > 0) {
        bookings.forEach(b => {
          const folio = (b.folios && b.folios.length > 0) ? b.folios[0] : null;
          const montoTotal = Number(b.monto_total) || 0;
          
          let pagado = 0;
          let saldo = montoTotal;

          if (folio) {
            pagado = Number(folio.total_pagos) || 0;
            saldo = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, montoTotal - pagado);
          } else if (b.estado === 'Finalizada') {
            // Reserva completada y liquidada
            pagado = montoTotal;
            saldo = 0;
          }

          totalIngresosCobrados += pagado;
          if (saldo > 0 && b.estado !== 'Cancelada') {
            totalCuentasPorCobrar += saldo;
          }
        });
      }

      // ADR Real = Ingresos Cobrados Reales / Habitaciones Ocupadas (o 0 si no hay cobros)
      const adr = ocupadas > 0 ? Math.round(totalIngresosCobrados / ocupadas) : 0;
      // RevPAR Real = Ingresos Cobrados Reales / Total Habitaciones del hotel
      const revpar = totalRooms > 0 ? Math.round(totalIngresosCobrados / totalRooms) : 0;

      // Actualizar UI
      document.getElementById('kpi-occupancy').innerText = `${tasaOcupacion}%`;
      document.getElementById('kpi-available-rooms').innerText = `${disponibles} / ${totalRooms}`;
      document.getElementById('kpi-revenue').innerText = formatGs(totalIngresosCobrados);
      
      const subRevenue = document.getElementById('kpi-revenue-sub');
      if (subRevenue) {
        subRevenue.innerHTML = `Cobrado Real • <span style="color: #b45309; font-weight: bold;">Pendiente: ${formatGs(totalCuentasPorCobrar)}</span>`;
      }

      document.getElementById('kpi-adr').innerText = formatGs(adr);
      document.getElementById('kpi-revpar').innerText = formatGs(revpar);

      document.getElementById('count-disponibles').innerText = disponibles;
      document.getElementById('count-ocupadas').innerText = ocupadas;
      document.getElementById('count-sucias').innerText = sucias + enLimpieza;
      document.getElementById('count-mantenimiento').innerText = mantenimiento;

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
        .select('*, habitaciones(numero), folios(*)')
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
        const folio = (b.folios && b.folios.length > 0) ? b.folios[0] : null;
        const total = Number(b.monto_total) || 0;
        const pagado = folio ? (Number(folio.total_pagos) || 0) : (b.estado === 'Finalizada' ? total : 0);
        const pendiente = Math.max(0, total - pagado);

        const badgeCobro = pagado >= total
          ? `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #ECFDF5; color: #059669; font-weight: bold;"><i class="fas fa-check-circle"></i> Cobrado</span>`
          : (pagado > 0 
              ? `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #EFF6FF; color: #2563EB; font-weight: bold;"><i class="fas fa-coins"></i> Parcial (${formatGs(pagado)})</span>`
              : `<span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: #FFFBEB; color: #D97706; font-weight: bold;"><i class="fas fa-clock"></i> Pendiente cobro</span>`);

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
              <span class="badge badge-confirmada">${sanitizeInput(b.estado || 'Confirmada')}</span>
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
