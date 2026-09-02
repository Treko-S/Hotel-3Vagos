/**
 * Housekeeping & Cleaning Checklist Module
 * 5-Area Quality Inspection & Room Liberation
 */

const HousekeepingModule = {
  currentRooms: [],
  selectedRoom: null,

  async init() {
    await this.loadHousekeepingBoard();
  },

  async loadHousekeepingBoard() {
    try {
      const container = document.getElementById('housekeeping-grid');
      if (!container) return;

      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 32px;"><i class="fas fa-spinner fa-spin"></i> Cargando estado de habitaciones...</div>`;

      const { data, error } = await supabaseClient
        .from('habitaciones')
        .select('*, tipos_habitacion(*)')
        .order('numero', { ascending: true });

      if (error) throw error;

      this.currentRooms = data || [];
      this.renderBoard(this.currentRooms);

    } catch (err) {
      console.error('Error al cargar Housekeeping:', err);
      showToast('Error al cargar panel de limpieza: ' + err.message, 'error');
    }
  },

  renderBoard(rooms) {
    const container = document.getElementById('housekeeping-grid');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No hay habitaciones registradas.</p>`;
      return;
    }

    let html = '';
    rooms.forEach(room => {
      const tipo = room.tipos_habitacion || {};
      const statusClass = (room.estado || '').toLowerCase().replace(/\s+/g, '-');
      const isDirty = room.estado === 'Sucia' || room.estado === 'En limpieza';

      html += `
        <div class="room-panel-card status-${statusClass}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div>
              <h4 style="font-size: 18px; color: var(--primary-navy); font-weight: bold;">Habitación ${sanitizeInput(room.numero)}</h4>
              <p style="font-size: 12px; color: var(--text-muted);">${sanitizeInput(tipo.nombre || 'Habitación')}</p>
            </div>
            <span class="badge badge-${statusClass}">${sanitizeInput(room.estado)}</span>
          </div>

          <p style="font-size: 12px; color: #475569; margin-bottom: 12px; background: #f8fafc; padding: 8px; border-radius: var(--radius-sm);">
            <i class="fas fa-info-circle"></i> ${sanitizeInput(room.observaciones || 'Sin observaciones')}
          </p>

          <div style="display: flex; gap: 8px; margin-top: 14px;">
            ${isDirty ? `
              <button class="btn btn-sm btn-gold" style="flex: 1;" onclick="HousekeepingModule.openCleaningChecklist(${room.id})">
                <i class="fas fa-broom"></i> Checklist Limpieza
              </button>
            ` : ''}

            ${room.estado === 'Disponible' ? `
              <button class="btn btn-sm btn-outline" style="flex: 1;" onclick="HousekeepingModule.setRoomDirty(${room.id})">
                <i class="fas fa-undo"></i> Marcar Sucia
              </button>
            ` : ''}

            ${room.estado === 'Ocupada' ? `
              <button class="btn btn-sm btn-outline" style="flex: 1;" disabled>
                <i class="fas fa-user-check"></i> Huésped en estadía
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  openCleaningChecklist(roomId) {
    const room = this.currentRooms.find(r => r.id === roomId);
    if (!room) return;

    this.selectedRoom = room;

    document.getElementById('hk-modal-room-id').value = room.id;
    document.getElementById('hk-modal-room-number').innerText = room.numero;
    document.getElementById('hk-modal-room-type').innerText = room.tipos_habitacion?.nombre || '';

    // Reset checkboxes
    document.getElementById('chk-cama').checked = false;
    document.getElementById('chk-bano').checked = false;
    document.getElementById('chk-equipamiento').checked = false;
    document.getElementById('chk-minibar').checked = false;
    document.getElementById('chk-inspeccion').checked = false;
    document.getElementById('hk-observations').value = '';

    openModal('modal-housekeeping');
  },

  async startCleaning() {
    if (!this.selectedRoom) return;

    try {
      await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'En limpieza',
          observaciones: 'Personal de limpieza trabajando en la habitación.'
        })
        .eq('id', this.selectedRoom.id);

      showToast(`Habitación ${this.selectedRoom.numero} puesta en estado 'En limpieza'`, 'info');
      await this.loadHousekeepingBoard();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();
    } catch (err) {
      console.error('Error al iniciar limpieza:', err);
    }
  },

  async completeCleaningAndLiberate() {
    if (!this.selectedRoom) return;

    const chkCama = document.getElementById('chk-cama').checked;
    const chkBano = document.getElementById('chk-bano').checked;
    const chkEquip = document.getElementById('chk-equipamiento').checked;
    const chkMini = document.getElementById('chk-minibar').checked;
    const chkInsp = document.getElementById('chk-inspeccion').checked;
    const obs = document.getElementById('hk-observations').value;
    const cleaner = document.getElementById('hk-cleaner-name').value || 'Camarera UTCD';

    if (!chkCama || !chkBano || !chkEquip || !chkMini || !chkInsp) {
      showToast('Debe completar y verificar los 5 puntos del checklist antes de liberar la habitación', 'warning');
      return;
    }

    try {
      // 1. Liberar habitación a 'Disponible'
      const { error: roomErr } = await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'Disponible',
          observaciones: 'Habitación limpia, inspeccionada y lista para recibir huésped.'
        })
        .eq('id', this.selectedRoom.id);

      if (roomErr) throw roomErr;

      // 2. Registrar en tabla tareas_limpieza
      try {
        await supabaseClient.from('tareas_limpieza').insert({
          habitacion_id: this.selectedRoom.id,
          responsable: cleaner,
          estado: 'Completada',
          observaciones: obs ? `Checklist aprobado. Nota: ${obs}` : 'Checklist 5/5 verificado e inspeccionado'
        });
      } catch (e) {
        console.warn('tareas_limpieza insert skip:', e);
      }

      closeModal('modal-housekeeping');
      showToast(`¡Habitación ${this.selectedRoom.numero} liberada con éxito a Disponible!`, 'success');

      await this.loadHousekeepingBoard();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();

    } catch (err) {
      console.error('Error al completar checklist:', err);
      showToast('Error al liberar habitación: ' + err.message, 'error');
    }
  },

  async setRoomDirty(roomId) {
    try {
      await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'Sucia',
          observaciones: 'Marcada como sucia para limpieza de rutina.'
        })
        .eq('id', roomId);

      showToast('Habitación marcada como sucia', 'warning');
      await this.loadHousekeepingBoard();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();
    } catch (err) {
      console.error('Error:', err);
    }
  }
};
