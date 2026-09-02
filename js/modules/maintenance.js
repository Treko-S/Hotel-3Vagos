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
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;

      this.orders = data || [];
      this.renderTable(this.orders);

    } catch (err) {
      console.error('Error al cargar órdenes de mantenimiento:', err);
      // Si la tabla no tiene datos o está vacía
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
      html += `
        <tr>
          <td><strong>#MNT-${ord.id}</strong></td>
          <td><strong style="color: var(--primary-navy);">Habitación ${ord.habitacion_id || 'General'}</strong></td>
          <td>
            <div style="font-weight: 600;">${sanitizeInput(ord.tipo_incidencia || 'General')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(ord.descripcion || '')}</div>
          </td>
          <td>
            <span class="badge ${ord.prioridad === 'Alta' ? 'badge-mantenimiento' : 'badge-limpieza'}">
              ${sanitizeInput(ord.prioridad || 'Media')}
            </span>
          </td>
          <td>${sanitizeInput(ord.tecnico_asignado || 'Técnico de Turno')}</td>
          <td>${formatGs(ord.costo_estimado || 0)}</td>
          <td>
            ${isPending ? `
              <button class="btn btn-sm btn-success" onclick="MaintenanceModule.resolveOrder(${ord.id}, ${ord.habitacion_id})">
                <i class="fas fa-check"></i> Resolver
              </button>
            ` : `<span class="badge badge-disponible"><i class="fas fa-check-double"></i> Resuelto</span>`}
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
      const tech = document.getElementById('maint-tech').value || 'Técnico Especialista';
      const cost = Number(document.getElementById('maint-cost').value) || 0;
      const desc = document.getElementById('maint-desc').value.trim();

      // 1. Insertar orden en ordenes_mantenimiento
      const { error: ordErr } = await supabaseClient.from('ordenes_mantenimiento').insert({
        habitacion_id: roomId,
        tipo_incidencia: type,
        prioridad: priority,
        tecnico_asignado: tech,
        costo_estimado: cost,
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
      // 1. Marcar orden como resuelta
      await supabaseClient.from('ordenes_mantenimiento').update({
        estado: 'Resuelto'
      }).eq('id', orderId);

      // 2. Pasar habitación a 'Sucia' para inspección/limpieza final
      if (roomId) {
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
