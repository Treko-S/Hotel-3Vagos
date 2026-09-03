/**
 * HOTEL 3 VAGOS - UTCD
 * Rooms & Tariffs Management Module
 * Comprehensive Specifications, Amenities, Multimedia Gallery & Realtime Supabase Sync
 */

const RoomsModule = {
  rooms: [],
  roomTypes: [],
  currentEditingRoomId: null,
  currentGalleryImages: [],

  // Presets de imágenes de hotelería prémium listas para usar
  PRESET_IMAGES: [
    { label: 'Standard / Individual', url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800' },
    { label: 'Doble / Twin Room', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800' },
    { label: 'Matrimonial Confort', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800' },
    { label: 'Familiar con Sala', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800' },
    { label: 'Suite Presidencial', url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800' },
    { label: 'Baño de Lujo / Mármol', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800' }
  ],

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

      // Poblar selector de tipos en filtros
      const filterSelect = document.getElementById('filter-room-type');
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">Todas las Categorías (${this.roomTypes.length})</option>` +
          this.roomTypes.map(t => `<option value="${t.id}">${sanitizeInput(t.nombre)}</option>`).join('');
      }

      // Poblar selector de tipos en modal de edición
      const editTypeSelect = document.getElementById('edit-room-type');
      if (editTypeSelect) {
        editTypeSelect.innerHTML = this.roomTypes.map(t =>
          `<option value="${t.id}">${sanitizeInput(t.nombre)} • ${formatGs(t.precio_base_noche)}/noche (hasta ${t.capacidad_personas} pers.)</option>`
        ).join('');
      }

    } catch (err) {
      console.error('Error al cargar tipos de habitación:', err);
    }
  },

  async loadRooms() {
    try {
      const tbody = document.getElementById('rooms-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 28px;"><i class="fas fa-spinner fa-spin"></i> Cargando inventario de habitaciones desde Supabase...</td></tr>`;

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
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No se encontraron habitaciones registradas.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(r => {
      const tipo = r.tipos_habitacion || {};
      const carac = (r.caracteristicas && typeof r.caracteristicas === 'object') ? r.caracteristicas : {};
      const statusClass = (r.estado || '').toLowerCase().replace(/\s+/g, '-');

      // Obtener imagen de miniatura
      let thumbImg = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300';
      if (Array.isArray(carac.imagenes) && carac.imagenes.length > 0) {
        thumbImg = carac.imagenes[0];
      } else if (tipo.imagen_cover) {
        thumbImg = tipo.imagen_cover;
      }

      // Badges dinámicos de equipamiento
      const amenitiesBadges = [];
      if (carac.wifi) amenitiesBadges.push('<span class="badge badge-info" title="Wi-Fi de Alta Velocidad"><i class="fas fa-wifi"></i> WiFi</span>');
      if (carac.ac) amenitiesBadges.push('<span class="badge badge-info" title="Aire Acondicionado Split"><i class="fas fa-snowflake"></i> A/C</span>');
      if (carac.tv) amenitiesBadges.push('<span class="badge badge-info" title="Smart TV"><i class="fas fa-tv"></i> Smart TV</span>');
      if (carac.minibar) amenitiesBadges.push('<span class="badge badge-info" title="Minibar / Frigobar"><i class="fas fa-cocktail"></i> Minibar</span>');
      if (carac.caja_fuerte) amenitiesBadges.push('<span class="badge badge-info" title="Caja Fuerte"><i class="fas fa-vault"></i> Caja</span>');
      if (carac.balcon) amenitiesBadges.push('<span class="badge badge-info" title="Balcón Privado"><i class="fas fa-door-open"></i> Balcón</span>');
      if (carac.jacuzzi) amenitiesBadges.push('<span class="badge badge-warning" title="Jacuzzi / Hidromasaje"><i class="fas fa-hot-tub"></i> Jacuzzi</span>');

      const photoCount = Array.isArray(carac.imagenes) ? carac.imagenes.length : 0;

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="position: relative; width: 62px; height: 50px; border-radius: 8px; overflow: hidden; background: #e2e8f0; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <img src="${thumbImg}" alt="Hab ${sanitizeInput(r.numero)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300'">
                ${photoCount > 0 ? `<span style="position: absolute; bottom: 2px; right: 2px; background: rgba(15,23,42,0.85); color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: bold;"><i class="fas fa-camera"></i> ${photoCount}</span>` : ''}
              </div>
              <div>
                <strong style="color: var(--primary-navy); font-size: 16px;">Habitación ${sanitizeInput(r.numero)}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${carac.camas || 'Camas estándar'} ${carac.tamano_m2 ? '• ' + carac.tamano_m2 + ' m²' : ''}</div>
              </div>
            </div>
          </td>
          <td><span style="font-weight: 500; font-size: 13px;">Piso ${r.piso || 1}</span></td>
          <td>
            <div style="font-weight: 600; color: var(--primary-navy);">${sanitizeInput(tipo.nombre || 'Estándar')}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);"><i class="fas fa-users" style="font-size: 10px;"></i> Capacidad: ${tipo.capacidad_personas || 1} huéspedes</div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--accent-gold); font-size: 14.5px;">${formatGs(tipo.precio_base_noche || 150000)}</div>
            <small style="font-size: 10.5px; color: var(--text-muted);">por noche (IVA inc.)</small>
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 220px;">
              ${amenitiesBadges.length > 0 ? amenitiesBadges.slice(0, 4).join('') : '<span style="font-size: 11px; color: var(--text-muted);">Básicas</span>'}
              ${amenitiesBadges.length > 4 ? `<span class="badge" style="background: #e2e8f0; color: #475569; font-size: 10px;">+${amenitiesBadges.length - 4} más</span>` : ''}
            </div>
          </td>
          <td>
            <span class="badge badge-${statusClass}">
              <span class="status-dot"></span>
              ${sanitizeInput(r.estado)}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-outline" onclick="RoomsModule.viewRoomDetails(${r.id})" title="Ver Ficha y Especificaciones Completas" style="padding: 6px 10px;">
                <i class="fas fa-eye"></i> Ficha
              </button>
              <button class="btn btn-sm btn-primary" onclick="RoomsModule.openEditRoomModal(${r.id})" title="Editar Especificaciones y Fotos" style="padding: 6px 10px;">
                <i class="fas fa-sliders-h"></i> Editar
              </button>
              <button class="btn btn-sm" onclick="RoomsModule.changeStatusPrompt(${r.id}, '${r.estado}')" title="Cambio Rápido de Estado" style="padding: 6px 8px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #334155;">
                <i class="fas fa-exchange-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  filterRooms() {
    const typeFilter = document.getElementById('filter-room-type')?.value;
    if (typeFilter === 'ALL' || !typeFilter) {
      this.renderRooms(this.rooms);
    } else {
      const filtered = this.rooms.filter(r => r.tipo_id == typeFilter);
      this.renderRooms(filtered);
    }
  },

  /**
   * Visualización Completa / Ficha Técnica de la Habitación
   */
  viewRoomDetails(roomId) {
    const r = this.rooms.find(x => x.id == roomId);
    if (!r) return;

    const tipo = r.tipos_habitacion || {};
    const carac = (r.caracteristicas && typeof r.caracteristicas === 'object') ? r.caracteristicas : {};

    // 1. Título y Estado
    const titleEl = document.getElementById('detail-room-title');
    const badgeEl = document.getElementById('detail-room-status-badge');
    if (titleEl) titleEl.innerText = `Habitación ${r.numero} • ${tipo.nombre || 'Hotel 3 Vagos'}`;
    if (badgeEl) {
      const sc = (r.estado || '').toLowerCase().replace(/\s+/g, '-');
      badgeEl.className = `badge badge-${sc}`;
      badgeEl.innerText = r.estado;
    }

    // 2. Galería de Fotos
    let gallery = [];
    if (Array.isArray(carac.imagenes) && carac.imagenes.length > 0) {
      gallery = carac.imagenes;
    } else if (tipo.imagen_cover) {
      gallery = [tipo.imagen_cover];
    } else {
      gallery = ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'];
    }

    const mainPhoto = document.getElementById('detail-main-photo');
    if (mainPhoto) mainPhoto.src = gallery[0];

    const thumbsContainer = document.getElementById('detail-thumbs-container');
    if (thumbsContainer) {
      thumbsContainer.innerHTML = gallery.map((imgUrl, idx) => `
        <div onclick="document.getElementById('detail-main-photo').src='${imgUrl}'" style="width: 70px; height: 52px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--primary-blue)' : '#CBD5E1'}; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `).join('');
    }

    // 3. Datos Generales
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setVal('detail-room-piso', `Piso ${r.piso || 1}`);
    setVal('detail-room-capacidad', `${tipo.capacidad_personas || 1} Huéspedes`);
    setVal('detail-room-precio', formatGs(tipo.precio_base_noche || 150000));
    setVal('detail-room-camas', carac.camas || '1 Cama King o 2 Twin');
    setVal('detail-room-tamano', `${carac.tamano_m2 || (20 + (tipo.capacidad_personas || 1) * 4)} m²`);
    setVal('detail-room-obs', r.observaciones || 'Habitación en excelentes condiciones higiénicas y operativas.');

    // 4. Grid de Comodidades
    const amenitiesMap = [
      { key: 'wifi', label: 'Wi-Fi 5G de Alta Velocidad', icon: 'fas fa-wifi' },
      { key: 'ac', label: 'Aire Acondicionado Split Inverter', icon: 'fas fa-snowflake' },
      { key: 'tv', label: 'Smart TV 4K con Streaming', icon: 'fas fa-tv' },
      { key: 'minibar', label: 'Frigobar / Minibar Abastecido', icon: 'fas fa-cocktail' },
      { key: 'caja_fuerte', label: 'Caja Fuerte Electrónica', icon: 'fas fa-vault' },
      { key: 'balcon', label: 'Balcón Privado con Vista', icon: 'fas fa-door-open' },
      { key: 'jacuzzi', label: 'Jacuzzi / Tina de Hidromasaje', icon: 'fas fa-hot-tub' },
      { key: 'escritorio', label: 'Escritorio Ergonómico de Trabajo', icon: 'fas fa-laptop' },
      { key: 'desayuno', label: 'Desayuno Buffet Incluido', icon: 'fas fa-utensils' },
      { key: 'bano_privado', label: 'Baño Privado con Amenities', icon: 'fas fa-shower' }
    ];

    const amenContainer = document.getElementById('detail-amenities-container');
    if (amenContainer) {
      amenContainer.innerHTML = amenitiesMap.map(a => {
        const hasIt = !!carac[a.key];
        return `
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: ${hasIt ? '#F0FDF4' : '#F8FAFC'}; border: 1px solid ${hasIt ? '#BBF7D0' : '#E2E8F0'}; color: ${hasIt ? '#166534' : '#94A3B8'}; font-size: 12.5px;">
            <i class="${a.icon}" style="color: ${hasIt ? '#16A34A' : '#CBD5E1'}; font-size: 14px;"></i>
            <span style="font-weight: ${hasIt ? '600' : '400'}; ${hasIt ? '' : 'text-decoration: line-through;'}">${a.label}</span>
          </div>
        `;
      }).join('');
    }

    // 5. Botón directo de edición
    const editBtn = document.getElementById('detail-btn-go-edit');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModal('modal-room-details');
        this.openEditRoomModal(r.id);
      };
    }

    openModal('modal-room-details');
  },

  /**
   * Abrir modal en modo "Nueva Habitación"
   */
  openNewRoomModal() {
    this.currentEditingRoomId = null;
    this.currentGalleryImages = [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'
    ];

    document.getElementById('edit-room-modal-title').innerText = 'Nueva Habitación';
    document.getElementById('edit-room-id').value = '';
    document.getElementById('edit-room-number').value = '';
    document.getElementById('edit-room-floor').value = '1';
    document.getElementById('edit-room-status').value = 'Disponible';
    document.getElementById('edit-room-bed').value = '1 Cama King Size';
    document.getElementById('edit-room-size').value = '24';
    document.getElementById('edit-room-obs').value = 'Habitación lista para operar.';

    // Checkboxes por defecto
    const checks = ['wifi', 'ac', 'tv', 'minibar', 'bano_privado'];
    document.querySelectorAll('#modal-room-editor input[type="checkbox"]').forEach(ch => {
      ch.checked = checks.includes(ch.name);
    });

    this.renderGalleryEditor();
    this.renderPresetButtons();
    openModal('modal-room-editor');
  },

  /**
   * Abrir modal en modo "Editar Habitación"
   */
  openEditRoomModal(roomId) {
    const r = this.rooms.find(x => x.id == roomId);
    if (!r) return;

    this.currentEditingRoomId = roomId;
    const carac = (r.caracteristicas && typeof r.caracteristicas === 'object') ? r.caracteristicas : {};

    // Cargar galería existente
    if (Array.isArray(carac.imagenes) && carac.imagenes.length > 0) {
      this.currentGalleryImages = [...carac.imagenes];
    } else {
      this.currentGalleryImages = ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'];
    }

    document.getElementById('edit-room-modal-title').innerText = `Editar Habitación ${r.numero}`;
    document.getElementById('edit-room-id').value = r.id;
    document.getElementById('edit-room-number').value = r.numero || '';
    document.getElementById('edit-room-floor').value = r.piso || 1;
    document.getElementById('edit-room-type').value = r.tipo_id || 1;
    document.getElementById('edit-room-status').value = r.estado || 'Disponible';
    document.getElementById('edit-room-bed').value = carac.camas || '1 Cama King Size';
    document.getElementById('edit-room-size').value = carac.tamano_m2 || 24;
    document.getElementById('edit-room-obs').value = r.observaciones || '';

    // Llenar checkboxes de comodidades
    const amenities = ['wifi', 'ac', 'tv', 'minibar', 'caja_fuerte', 'balcon', 'jacuzzi', 'escritorio', 'desayuno', 'bano_privado'];
    amenities.forEach(k => {
      const ch = document.querySelector(`#modal-room-editor input[name="${k}"]`);
      if (ch) ch.checked = !!carac[k];
    });

    this.renderGalleryEditor();
    this.renderPresetButtons();
    openModal('modal-room-editor');
  },

  renderPresetButtons() {
    const container = document.getElementById('room-presets-container');
    if (!container) return;

    container.innerHTML = this.PRESET_IMAGES.map(p => `
      <button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 8px;" onclick="RoomsModule.addPresetPhoto('${p.url}')">
        <i class="fas fa-plus-circle"></i> ${p.label}
      </button>
    `).join('');
  },

  renderGalleryEditor() {
    const container = document.getElementById('room-gallery-container');
    if (!container) return;

    if (this.currentGalleryImages.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 12px; padding: 14px;">No hay imágenes cargadas. Ingrese una URL o seleccione un preset abajo.</p>`;
      return;
    }

    container.innerHTML = this.currentGalleryImages.map((url, idx) => `
      <div style="position: relative; width: 100%; height: 90px; border-radius: 8px; overflow: hidden; border: 2px solid ${idx === 0 ? 'var(--primary-blue)' : '#E2E8F0'}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300'">
        ${idx === 0 ? `<span style="position: absolute; top: 4px; left: 4px; background: var(--primary-blue); color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold;"><i class="fas fa-star"></i> Portada</span>` : ''}
        <button type="button" onclick="RoomsModule.removeGalleryImage(${idx})" title="Eliminar Foto" style="position: absolute; top: 4px; right: 4px; background: #DC2626; color: #fff; border: none; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer;">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  },

  addPhotoUrl() {
    const input = document.getElementById('new-photo-url');
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
      showToast('Ingrese una URL de imagen válida', 'warning');
      return;
    }
    this.currentGalleryImages.push(url);
    input.value = '';
    this.renderGalleryEditor();
    showToast('Imagen añadida a la galería', 'info');
  },

  addPresetPhoto(url) {
    if (this.currentGalleryImages.includes(url)) {
      showToast('Esta imagen ya está en la galería', 'info');
      return;
    }
    this.currentGalleryImages.push(url);
    this.renderGalleryEditor();
    showToast('Preset fotográfico añadido', 'success');
  },

  removeGalleryImage(index) {
    if (index >= 0 && index < this.currentGalleryImages.length) {
      this.currentGalleryImages.splice(index, 1);
      this.renderGalleryEditor();
    }
  },

  /**
   * Guardar Especificaciones y Fotos en Supabase (INSERT o UPDATE)
   */
  async saveRoom() {
    const saveBtn = document.getElementById('btn-save-room');
    try {
      const numero = document.getElementById('edit-room-number').value.trim();
      const piso = parseInt(document.getElementById('edit-room-floor').value) || 1;
      const tipoId = parseInt(document.getElementById('edit-room-type').value) || 1;
      const estado = document.getElementById('edit-room-status').value || 'Disponible';
      const camas = document.getElementById('edit-room-bed').value.trim() || '1 Cama King';
      const tamano = parseInt(document.getElementById('edit-room-size').value) || 24;
      const obs = document.getElementById('edit-room-obs').value.trim();

      if (!numero) {
        showToast('Ingrese el número de la habitación', 'warning');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando en Supabase...';
      }

      // Construir mapa de especificaciones técnicas
      const caracteristicasObj = {
        wifi: !!document.querySelector('#modal-room-editor input[name="wifi"]')?.checked,
        ac: !!document.querySelector('#modal-room-editor input[name="ac"]')?.checked,
        tv: !!document.querySelector('#modal-room-editor input[name="tv"]')?.checked,
        minibar: !!document.querySelector('#modal-room-editor input[name="minibar"]')?.checked,
        caja_fuerte: !!document.querySelector('#modal-room-editor input[name="caja_fuerte"]')?.checked,
        balcon: !!document.querySelector('#modal-room-editor input[name="balcon"]')?.checked,
        jacuzzi: !!document.querySelector('#modal-room-editor input[name="jacuzzi"]')?.checked,
        escritorio: !!document.querySelector('#modal-room-editor input[name="escritorio"]')?.checked,
        desayuno: !!document.querySelector('#modal-room-editor input[name="desayuno"]')?.checked,
        bano_privado: !!document.querySelector('#modal-room-editor input[name="bano_privado"]')?.checked,
        camas: camas,
        tamano_m2: tamano,
        imagenes: this.currentGalleryImages
      };

      const payload = {
        numero: numero,
        piso: piso,
        tipo_id: tipoId,
        estado: estado,
        caracteristicas: caracteristicasObj,
        observaciones: obs || 'Habitación lista e inspeccionada.'
      };

      if (this.currentEditingRoomId) {
        // Modo Edición
        const { error } = await supabaseClient
          .from('habitaciones')
          .update(payload)
          .eq('id', this.currentEditingRoomId);

        if (error) throw error;
        showToast(`¡Especificaciones de Habitación ${numero} actualizadas con éxito!`, 'success');
      } else {
        // Modo Creación
        const { error } = await supabaseClient
          .from('habitaciones')
          .insert(payload);

        if (error) throw error;
        showToast(`¡Habitación ${numero} registrada exitosamente!`, 'success');
      }

      closeModal('modal-room-editor');

      // Refrescar inventario y módulos asociados
      await this.loadRooms();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();

    } catch (err) {
      console.error('Error al guardar habitación en Supabase:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Especificaciones';
      }
    }
  },

  /**
   * Cambio Rápido de Estado Operativo
   */
  async changeStatusPrompt(roomId, currentStatus) {
    const newStatus = prompt(`Cambiar estado para la habitación.\nEstado actual: ${currentStatus}\nOpciones: Disponible, Ocupada, Sucia, En limpieza, Mantenimiento`, currentStatus);
    if (!newStatus || newStatus === currentStatus) return;

    try {
      const { error } = await supabaseClient
        .from('habitaciones')
        .update({ estado: newStatus })
        .eq('id', roomId);

      if (error) throw error;

      showToast(`Estado cambiado a '${newStatus}'`, 'success');
      await this.loadRooms();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();
    } catch (err) {
      showToast('Error al cambiar estado: ' + err.message, 'error');
    }
  }
};
