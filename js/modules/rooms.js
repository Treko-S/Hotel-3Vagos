/**
 * Rooms & Tariffs Management Module
 * Inventory, Pricing, Characteristics & Floor Matrix
 */

const RoomsModule = {
  rooms: [],
  roomTypes: [],

  async init() {
    await this.loadRoomTypes();
    await this.loadRooms();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const filterSelect = document.getElementById('filter-room-type');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => this.filterRooms());
    }
  },

  async loadRoomTypes() {
    try {
      const { data, error } = await supabaseClient
        .from('tipos_habitacion')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      this.roomTypes = data || [];

      const select = document.getElementById('new-room-type');
      if (select) {
        select.innerHTML = this.roomTypes.map(t => `<option value="${t.id}">${t.nombre} - ${formatGs(t.precio_base_noche)}/noche</option>`).join('');
      }

      const filterSelect = document.getElementById('filter-room-type');
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">Todos los Tipos</option>` + this.roomTypes.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
      }

    } catch (err) {
      console.error('Error al cargar tipos de habitación:', err);
    }
  },

  async loadRooms() {
    try {
      const tbody = document.getElementById('rooms-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando habitaciones...</td></tr>`;

      const { data, error } = await supabaseClient
        .from('habitaciones')
        .select('*, tipos_habitacion(*)')
        .order('numero', { ascending: true });

      if (error) throw error;

      this.rooms = data || [];
      this.renderRooms(this.rooms);

    } catch (err) {
      console.error('Error al cargar habitaciones:', err);
      showToast('Error al cargar inventario de habitaciones', 'error');
    }
  },

  renderRooms(list) {
    const tbody = document.getElementById('rooms-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;">No se encontraron habitaciones.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(r => {
      const tipo = r.tipos_habitacion || {};
      const statusClass = (r.estado || '').toLowerCase().replace(/\s+/g, '-');

      html += `
        <tr>
          <td><strong style="color: var(--primary-navy); font-size: 15px;">${sanitizeInput(r.numero)}</strong></td>
          <td>Piso ${r.piso || 1}</td>
          <td>
            <div style="font-weight: 600;">${sanitizeInput(tipo.nombre || 'Estándar')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${tipo.capacidad_personas || 1} personas máx.</div>
          </td>
          <td><strong style="color: var(--accent-gold);">${formatGs(tipo.precio_base_noche || 150000)}</strong></td>
          <td>
            <div style="display: flex; gap: 8px; font-size: 14px; color: var(--primary-blue);">
              <i class="fas fa-wifi" title="WiFi"></i>
              <i class="fas fa-snowflake" title="Aire Acondicionado"></i>
              <i class="fas fa-tv" title="TV Smart"></i>
              <i class="fas fa-cocktail" title="Frigobar"></i>
            </div>
          </td>
          <td><span class="badge badge-${statusClass}">${sanitizeInput(r.estado)}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="RoomsModule.changeStatusPrompt(${r.id}, '${r.estado}')" title="Cambiar Estado">
              <i class="fas fa-edit"></i> Estado
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  filterRooms() {
    const typeFilter = document.getElementById('filter-room-type')?.value;
    if (typeFilter === 'ALL') {
      this.renderRooms(this.rooms);
    } else {
      const filtered = this.rooms.filter(r => r.tipo_id == typeFilter);
      this.renderRooms(filtered);
    }
  },

  openNewRoomModal() {
    openModal('modal-new-room');
  },

  async createNewRoom() {
    try {
      const numero = document.getElementById('new-room-number').value.trim();
      const piso = parseInt(document.getElementById('new-room-floor').value) || 1;
      const tipoId = parseInt(document.getElementById('new-room-type').value) || 1;
      const obs = document.getElementById('new-room-obs').value.trim();

      if (!numero) {
        showToast('Ingrese el número de la habitación', 'warning');
        return;
      }

      const { error } = await supabaseClient.from('habitaciones').insert({
        numero: numero,
        piso: piso,
        tipo_id: tipoId,
        estado: 'Disponible',
        observaciones: obs || 'Habitación recién creada lista para operar',
        caracteristicas: { wifi: true, ac: true, tv: true, minibar: true }
      });

      if (error) throw error;

      closeModal('modal-new-room');
      showToast('¡Habitación creada exitosamente!', 'success');

      await this.loadRooms();
      await DashboardModule.loadKPIs();
      await HousekeepingModule.loadHousekeepingBoard();

    } catch (err) {
      console.error('Error al crear habitación:', err);
      showToast('Error al crear habitación: ' + err.message, 'error');
    }
  },

  async changeStatusPrompt(roomId, currentStatus) {
    const newStatus = prompt(`Cambiar estado para la habitación.\nEstado actual: ${currentStatus}\nOpciones: Disponible, Ocupada, Sucia, En limpieza, Mantenimiento`, currentStatus);
    if (!newStatus || newStatus === currentStatus) return;

    try {
      await supabaseClient
        .from('habitaciones')
        .update({ estado: newStatus })
        .eq('id', roomId);

      showToast(`Estado actualizado a '${newStatus}'`, 'success');
      await this.loadRooms();
      await DashboardModule.loadKPIs();
      await HousekeepingModule.loadHousekeepingBoard();
    } catch (err) {
      showToast('Error al cambiar estado: ' + err.message, 'error');
    }
  }
};
