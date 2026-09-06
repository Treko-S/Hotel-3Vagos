/**
 * Maintenance & Technical Incident Management Module
 * AC, Plumbing, Electrical & Infrastructure work orders
 */

const MaintenanceModule = {
  orders: [],

  async init() {
    await this.loadOrders();
    await this.loadRoomsSelect();
  },

  async loadRoomsSelect() {
    try {
      const { data } = await supabaseClient.from('habitaciones').select('id, numero');
      const select = document.getElementById('maint-room-select');
      if (select && data) {
        select.innerHTML = data.map(r => `<option value="${r.id}">Habitación ${r.numero}</option>`).join('');
      }
    } catch (e) {
      console.warn('loadRoomsSelect error:', e);
    }
  },

  async loadOrders() {
    try {
      const tbody = document.getElementById('maintenance-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando órdenes de mantenimiento...</td></tr>`;

      const { data, error } = await supabaseClient
        .from('ordenes_mantenimiento')
        .select('*, habitaciones(numero)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.orders = data || [];

      // Sincronizar bidireccionalmente con la bitácora de Housekeeping (hotel_hk_incidents)
      let hkIncidents = [];
      try {
        const rawHk = localStorage.getItem('hotel_hk_incidents');
        if (rawHk) hkIncidents = JSON.parse(rawHk);
      } catch (e) {}

      // Si hay incidencias en la bitácora de HK marcadas para mantenimiento, asegurar su presencia
      hkIncidents.forEach(inc => {
        if ((inc.nature || '').toLowerCase() === 'mantenimiento') {
          const alreadyInOrders = this.orders.some(o => 
            (o.descripcion && o.descripcion.includes(inc.description)) ||
            (o.habitaciones && String(o.habitaciones.numero) === String(inc.roomNumber)) ||
            String(o.habitacion_id) === String(inc.roomNumber)
          );
          if (!alreadyInOrders) {
            this.orders.push({
              id: inc.id || 'HK-104',
              habitacion_id: inc.roomNumber,
              roomNumberDisplay: inc.roomNumber,
              titulo: 'Incidencia técnica reportada por Housekeeping',
              descripcion: `[Reporte ${inc.reportedBy || 'Mucama'}]: ${inc.description}`,
              prioridad: 'Alta',
              estado: inc.status === 'Resuelto por Mantenimiento' ? 'Resuelto' : 'Pendiente',
              costo_reparacion: 0,
              tecnico_asignado: 'Mario Gómez (Mantenimiento Técnico)',
              isLocalHk: true,
              localHkId: inc.id
            });
          }
        }
      });

      this.renderTable(this.orders);

    } catch (err) {
      console.error('Error al cargar órdenes de mantenimiento:', err);
      this.renderTable([]);
    }
  },

  renderTable(list) {
    const tbody = document.getElementById('maintenance-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay órdenes de mantenimiento activas.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(ord => {
      const isPending = (ord.estado || '').toLowerCase() !== 'resuelto';
      const roomNum = ord.habitaciones?.numero || ord.roomNumberDisplay || ord.habitacion_id || 'General';
      const shortId = typeof ord.id === 'string' && ord.id.length > 8 ? ord.id.substring(0, 8).toUpperCase() : ord.id;
      const title = ord.titulo || ord.tipo_incidencia || 'Incidencia Técnica';
      const tech = ord.tecnico_asignado || (ord.tecnico_id ? 'Técnico Especialista' : 'Mario Gómez (Mantenimiento)');
      const cost = ord.costo_reparacion !== undefined ? ord.costo_reparacion : (ord.costo_estimado || 0);

      html += `
        <tr>
          <td><strong>#MNT-${shortId}</strong></td>
          <td><strong style="color: var(--primary-navy);">Habitación ${roomNum}</strong></td>
          <td>
            <div style="font-weight: 600;">${sanitizeInput(title)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(ord.descripcion || '')}</div>
          </td>
          <td>
            <span class="badge ${ord.prioridad === 'Alta' ? 'badge-mantenimiento' : 'badge-limpieza'}">
              ${sanitizeInput(ord.prioridad || 'Media')}
            </span>
          </td>
          <td>${sanitizeInput(tech)}</td>
          <td>${formatGs(cost)}</td>
          <td>
            <div class="action-btn-group">
              ${isPending ? `
                <button class="btn-action btn-action-reserve" onclick="MaintenanceModule.resolveOrder('${ord.id}', '${roomNum}')" title="Marcar orden como resuelta">
                  <i class="fas fa-check"></i> Resolver
                </button>
              ` : `<span class="badge badge-disponible"><i class="fas fa-check-double"></i> Resuelto</span>`}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openNewOrderModal() {
    openModal('modal-new-maintenance');
  },

  async createOrder() {
    try {
      const roomId = document.getElementById('maint-room-select').value;
      const type = document.getElementById('maint-type').value;
      const priority = document.getElementById('maint-priority').value;
      const tech = document.getElementById('maint-tech').value || 'Mario Gómez (Mantenimiento Técnico)';
      const cost = Number(document.getElementById('maint-cost').value) || 0;
      const desc = document.getElementById('maint-desc').value.trim();

      // 1. Insertar orden en ordenes_mantenimiento con columnas compatibles con Supabase
      const { error: ordErr } = await supabaseClient.from('ordenes_mantenimiento').insert({
        habitacion_id: roomId,
        titulo: type,
        prioridad: priority,
        costo_reparacion: cost,
        descripcion: desc,
        estado: 'En Proceso'
      });

      if (ordErr) throw ordErr;

      // 2. Bloquear habitación a 'Mantenimiento'
      await supabaseClient.from('habitaciones').update({
        estado: 'Mantenimiento',
        observaciones: `En mantenimiento técnico: ${type}. Prioridad ${priority}.`
      }).eq('id', roomId);

      closeModal('modal-new-maintenance');
      showToast('Orden de mantenimiento registrada y habitación bloqueada', 'warning');

      await this.loadOrders();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();
      await HousekeepingModule.loadHousekeepingBoard();

    } catch (err) {
      console.error('Error al registrar mantenimiento:', err);
      showToast('Error al registrar mantenimiento: ' + err.message, 'error');
    }
  },

  async resolveOrder(orderId, roomId) {
    try {
      // 1. Marcar orden como resuelta en Supabase si no es puramente local
      if (!String(orderId).startsWith('HK-')) {
        await supabaseClient.from('ordenes_mantenimiento').update({
          estado: 'Resuelto'
        }).eq('id', orderId);
      }

      // 2. Sincronizar bidireccionalmente con la bitácora de Housekeeping
      try {
        const rawHk = localStorage.getItem('hotel_hk_incidents');
        if (rawHk) {
          let hkIncidents = JSON.parse(rawHk);
          hkIncidents = hkIncidents.map(inc => {
            if (String(inc.id) === String(orderId) || String(inc.roomNumber) === String(roomId)) {
              return { ...inc, status: 'Resuelto por Mantenimiento' };
            }
            return inc;
          });
          localStorage.setItem('hotel_hk_incidents', JSON.stringify(hkIncidents));
        }
      } catch (e) {}

      // 3. Pasar habitación a 'Sucia' para inspección/limpieza final
      if (roomId && !isNaN(Number(roomId))) {
        await supabaseClient.from('habitaciones').update({
          estado: 'Sucia',
          observaciones: 'Mantenimiento finalizado. Requiere limpieza previa a liberación.'
        }).eq('id', roomId);
      }

      showToast('¡Mantenimiento resuelto! Habitación enviada a Housekeeping para limpieza', 'success');

      await this.loadOrders();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();
      await HousekeepingModule.loadHousekeepingBoard();

    } catch (err) {
      console.error('Error al resolver orden:', err);
      showToast('Error: ' + err.message, 'error');
    }
  }
};
