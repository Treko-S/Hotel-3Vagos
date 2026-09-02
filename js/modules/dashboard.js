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

      // 2. Cargar reservas para ingresos y ADR/RevPAR
      const { data: bookings, error: bookErr } = await supabaseClient
        .from('reservas')
        .select('*');

      let totalIngresos = 0;
      let totalNochesOcupadas = 0;

      if (bookings && bookings.length > 0) {
        bookings.forEach(b => {
          totalIngresos += Number(b.monto_total) || 0;
          totalNochesOcupadas += 1;
        });
      }

      // ADR = Ingresos Totales / Habitaciones Ocupadas
      const adr = ocupadas > 0 ? totalIngresos / ocupadas : (totalRooms > 0 ? 300000 : 0);
      // RevPAR = ADR * (Tasa Ocupación / 100)
      const revpar = (adr * (tasaOcupacion / 100));

      // Actualizar UI
      document.getElementById('kpi-occupancy').innerText = `${tasaOcupacion}%`;
      document.getElementById('kpi-available-rooms').innerText = `${disponibles} / ${totalRooms}`;
      document.getElementById('kpi-revenue').innerText = formatGs(totalIngresos);
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
        .select('*, habitaciones(numero)')
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
        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--info-bg); color: var(--info); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <strong style="font-size: 13px; color: var(--primary-navy);">${sanitizeInput(b.codigo_reserva)}</strong>
                <p style="font-size: 11px; color: var(--text-muted);">Habitación ${sanitizeInput(habNum)} • ${formatDate(b.check_in_previsto)} al ${formatDate(b.check_out_previsto)}</p>
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
