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
  STORAGE_BUCKET: 'hotel-rooms',

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
    this.ensureStorageBucket();
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

      // Poblar selector de tipos en modal de edición (solo categoría y capacidad, precio aparte)
      const editTypeSelect = document.getElementById('edit-room-type');
      if (editTypeSelect) {
        editTypeSelect.innerHTML = this.roomTypes.map(t =>
          `<option value="${t.id}">${sanitizeInput(t.nombre)} (hasta ${t.capacidad_personas} pers.)</option>`
        ).join('');
      }

    } catch (err) {
      console.error('Error al cargar tipos de habitación:', err);
    }
  },

  onRoomTypeChange(typeId) {
    const t = this.roomTypes.find(x => x.id == typeId);
    const priceInput = document.getElementById('edit-room-price');
    if (t && priceInput) {
      priceInput.value = t.precio_base_noche || 180000;
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
            <div style="font-weight: 700; color: var(--accent-gold); font-size: 14.5px;">${formatGs(carac.precio_personalizado || tipo.precio_base_noche || 150000)}</div>
            <small style="font-size: 10.5px; color: var(--text-muted);">${carac.precio_personalizado ? '<span style="color: #10B981; font-weight: 600;"><i class="fas fa-tag"></i> Tarifa propia</span>' : 'Base categoría'}</small>
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
            ${(() => {
              const allB = (typeof ReservationsModule !== 'undefined' && ReservationsModule.currentBookings) ? ReservationsModule.currentBookings : [];
              const roomB = allB.filter(x => x.habitacion_id == r.id && x.estado !== 'Cancelada' && x.estado !== 'Finalizada');
              if (r.estado.toLowerCase() === 'ocupada') {
                const active = roomB.find(x => x.estado === 'Check-in' || x.estado === 'En estadía' || x.estado === 'Ocupada') || roomB[0];
                if (active && active.check_out_previsto) {
                  return `<div style="font-size: 10px; color: #b45309; margin-top: 3px; font-weight: 500;"><i class="far fa-calendar-alt"></i> Libre: ${formatDate(active.check_out_previsto)}</div>`;
                }
              } else if (r.estado.toLowerCase() === 'disponible') {
                const upcoming = [...roomB].sort((a,b) => (a.check_in_previsto||'').localeCompare(b.check_in_previsto||''))[0];
                if (upcoming && upcoming.check_in_previsto) {
                  return `<div style="font-size: 10px; color: #2563eb; margin-top: 3px; font-weight: 500;" title="Reserva programada"><i class="far fa-calendar-check"></i> Próx: ${formatDate(upcoming.check_in_previsto)}</div>`;
                }
              }
              return '';
            })()}
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-outline" onclick="RoomsModule.viewRoomDetails(${r.id})" title="Ver Ficha y Especificaciones Completas" style="padding: 6px 10px;">
                <i class="fas fa-eye"></i> Ficha
              </button>
              <button class="btn btn-sm btn-gold" onclick="ReservationsModule.openNewReservationModal(${r.id})" title="Reservar Fechas Libres de esta Habitación" style="padding: 6px 8px;">
                <i class="fas fa-calendar-plus"></i>
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
    setVal('detail-room-precio', formatGs(carac.precio_personalizado || tipo.precio_base_noche || 150000));
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
      { key: 'bano_privado', label: 'Baño Privado con Amenities', icon: 'fas fa-shower' },
      { key: 'pava_electrica', label: 'Cafetera / Pava Eléctrica', icon: 'fas fa-mug-hot' },
      { key: 'secador', label: 'Secador de Cabello de Alta Potencia', icon: 'fas fa-wind' },
      { key: 'room_service', label: 'Servicio a la Habitación 24/7', icon: 'fas fa-concierge-bell' },
      { key: 'accesibilidad', label: 'Accesible para Movilidad Reducida', icon: 'fas fa-wheelchair' }
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

    // 5. Calendario y Disponibilidad de Fechas de esta Habitación
    const schedContainer = document.getElementById('detail-room-schedule-container');
    if (schedContainer) {
      const allB = (typeof ReservationsModule !== 'undefined' && ReservationsModule.currentBookings) ? ReservationsModule.currentBookings : [];
      const roomBookings = allB.filter(x => x.habitacion_id == r.id && x.estado !== 'Cancelada' && x.estado !== 'Finalizada')
        .sort((a,b) => (a.check_in_previsto||'').localeCompare(b.check_in_previsto||''));

      if (roomBookings.length === 0) {
        schedContainer.innerHTML = `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 12px; border-radius: 8px; color: #166534; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-calendar-check" style="font-size: 16px;"></i>
            <div>
              <strong>Habitación 100% Libre:</strong> No posee reservas programadas. Lista para reservar cualquier rango de fechas.
            </div>
          </div>
        `;
      } else {
        schedContainer.innerHTML = `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--primary-navy); margin-bottom: 8px;">
              <i class="fas fa-calendar-times" style="color: var(--danger);"></i> Periodos Ocupados / Reservados:
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${roomBookings.map(b => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #CBD5E1; padding: 6px 10px; border-radius: 6px; font-size: 11.5px;">
                  <div>
                    <strong>${formatDate(b.check_in_previsto)} al ${formatDate(b.check_out_previsto)}</strong>
                    <span style="color: var(--text-muted); font-size: 10.5px;">(${sanitizeInput(b.codigo_reserva)})</span>
                  </div>
                  <span class="badge ${b.estado === 'Check-in' || b.estado === 'En estadía' ? 'badge-ocupada' : 'badge-confirmada'}" style="font-size: 10px;">
                    ${sanitizeInput(b.estado)}
                  </span>
                </div>
              `).join('')}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
              <i class="fas fa-info-circle"></i> Los rangos fuera de estos periodos están completamente disponibles para reserva.
            </div>
          </div>
        `;
      }
    }

    // 6. Botones de acción
    const reserveBtn = document.getElementById('detail-btn-go-reserve');
    if (reserveBtn) {
      reserveBtn.onclick = () => {
        closeModal('modal-room-details');
        if (typeof ReservationsModule !== 'undefined' && ReservationsModule.openNewReservationModal) {
          ReservationsModule.openNewReservationModal(r.id);
        }
      };
    }

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
    this.currentGalleryImages = [];

    document.getElementById('edit-room-modal-title').innerText = 'Nueva Habitación';
    document.getElementById('edit-room-id').value = '';
    document.getElementById('edit-room-number').value = '';
    document.getElementById('edit-room-floor').value = '1';
    document.getElementById('edit-room-status').value = 'Disponible';
    document.getElementById('edit-room-bed').value = '1 Cama King Size';
    document.getElementById('edit-room-size').value = '24';
    document.getElementById('edit-room-price').value = '180000';
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
    } else if (r.tipos_habitacion?.imagen_cover) {
      this.currentGalleryImages = [r.tipos_habitacion.imagen_cover];
    } else {
      this.currentGalleryImages = [];
    }

    document.getElementById('edit-room-modal-title').innerText = `Editar Habitación ${r.numero}`;
    document.getElementById('edit-room-id').value = r.id;
    document.getElementById('edit-room-number').value = r.numero || '';
    document.getElementById('edit-room-floor').value = r.piso || 1;
    
    // Asignar tipo de habitación garantizando que el select refleje el valor sin precio incrustado
    const typeSelect = document.getElementById('edit-room-type');
    if (typeSelect) {
      if (this.roomTypes && this.roomTypes.length > 0) {
        typeSelect.innerHTML = this.roomTypes.map(t =>
          `<option value="${t.id}">${sanitizeInput(t.nombre)} (hasta ${t.capacidad_personas} pers.)</option>`
        ).join('');
      }
      typeSelect.value = String(r.tipo_id || 1);
    }

    const effectivePrice = carac.precio_personalizado || (r.tipos_habitacion?.precio_base_noche) || 180000;
    const priceInput = document.getElementById('edit-room-price');
    if (priceInput) priceInput.value = effectivePrice;

    document.getElementById('edit-room-status').value = r.estado || 'Disponible';
    document.getElementById('edit-room-bed').value = carac.camas || '1 Cama King Size';
    document.getElementById('edit-room-size').value = carac.tamano_m2 || 24;
    document.getElementById('edit-room-obs').value = r.observaciones || '';

    // Llenar checkboxes de comodidades extendidas
    const amenities = [
      'wifi', 'ac', 'tv', 'minibar', 'caja_fuerte', 'balcon', 'jacuzzi', 
      'escritorio', 'desayuno', 'bano_privado', 'pava_electrica', 'secador', 
      'room_service', 'accesibilidad'
    ];
    amenities.forEach(k => {
      const ch = document.querySelector(`#modal-room-editor input[name="${k}"]`);
      if (ch) ch.checked = !!carac[k];
    });

    this.renderGalleryEditor();
    this.renderPresetButtons();
    openModal('modal-room-editor');
  },

  /**
   * Asegura que el Bucket de Supabase Storage para fotos exista y sea público
   */
  async ensureStorageBucket() {
    try {
      const { data: buckets, error } = await supabaseClient.storage.listBuckets();
      if (!error && Array.isArray(buckets)) {
        const found = buckets.some(b => b.name === this.STORAGE_BUCKET);
        if (!found) {
          await supabaseClient.storage.createBucket(this.STORAGE_BUCKET, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
          console.log(`Bucket '${this.STORAGE_BUCKET}' creado con éxito en Supabase.`);
        }
      }
    } catch (e) {
      console.warn('Verificación o inicialización de Supabase Storage:', e);
    }
  },

  /**
   * Manejadores de Drag & Drop para subir fotos
   */
  onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('room-dropzone');
    if (el) el.classList.add('drag-over');
  },

  onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('room-dropzone');
    if (el) el.classList.remove('drag-over');
  },

  onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('room-dropzone');
    if (el) el.classList.remove('drag-over');
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      this.processAndUploadFiles(files);
    }
  },

  handleLocalFileInput(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      this.processAndUploadFiles(files);
    }
    e.target.value = ''; // Permite volver a seleccionar el mismo archivo si se desea
  },

  /**
   * Procesa y sube una o más imágenes a Supabase Storage
   */
  async processAndUploadFiles(filesList) {
    const validImages = Array.from(filesList).filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      showToast('Por favor selecciona archivos de imagen válidos (JPG, PNG, WEBP)', 'warning');
      return;
    }

    const progressContainer = document.getElementById('room-upload-progress');
    const progressBar = document.getElementById('room-upload-progress-bar');
    const statusText = document.getElementById('room-upload-status-text');
    const statusCount = document.getElementById('room-upload-status-count');

    if (progressContainer) progressContainer.style.display = 'block';

    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validImages.length; i++) {
      const file = validImages[i];
      const currentNum = i + 1;
      const pct = Math.round(((currentNum - 1) / validImages.length) * 100);

      if (statusText) statusText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo imagen ${currentNum} de ${validImages.length} (${file.name})...`;
      if (statusCount) statusCount.innerText = `${pct}%`;
      if (progressBar) progressBar.style.width = `${pct}%`;

      // Límite de tamaño sugerido (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast(`"${file.name}" supera el tamaño máximo de 10MB`, 'warning');
        failedCount++;
        continue;
      }

      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const filePath = `room_${uniqueId}.${safeExt}`;

        // Subir archivo al bucket de Supabase
        const { data: uploadData, error: uploadErr } = await supabaseClient.storage
          .from(this.STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || `image/${safeExt}`
          });

        if (uploadErr) {
          // Si el bucket no existía, intentar crearlo sobre la marcha
          if (uploadErr.message?.includes('not found') || uploadErr.statusCode == 404 || uploadErr.error === 'Bucket not found') {
            await supabaseClient.storage.createBucket(this.STORAGE_BUCKET, { public: true });
            const retry = await supabaseClient.storage.from(this.STORAGE_BUCKET).upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type || `image/${safeExt}`
            });
            if (retry.error) throw retry.error;
          } else {
            throw uploadErr;
          }
        }

        // Obtener la URL pública permanente
        const { data: publicData } = supabaseClient.storage
          .from(this.STORAGE_BUCKET)
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          this.currentGalleryImages.push(publicData.publicUrl);
          uploadedCount++;
          this.renderGalleryEditor();
        }
      } catch (err) {
        console.error(`Error al subir imagen ${file.name}:`, err);
        showToast(`Error al subir ${file.name}: ${err.message || 'Fallo de red'}`, 'error');
        failedCount++;
      }
    }

    if (progressBar) progressBar.style.width = '100%';
    if (statusCount) statusCount.innerText = '100%';
    if (statusText) statusText.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Carga completada (${uploadedCount} subidas)`;

    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
    }, 2000);

    if (uploadedCount > 0) {
      showToast(`¡${uploadedCount} foto(s) subida(s) con éxito a Supabase!`, 'success');
    }
  },

  /**
   * Permite establecer cualquier foto como Portada (la mueve a la posición 0)
   */
  setAsCover(index) {
    if (index > 0 && index < this.currentGalleryImages.length) {
      const [item] = this.currentGalleryImages.splice(index, 1);
      this.currentGalleryImages.unshift(item);
      this.renderGalleryEditor();
      showToast('Foto asignada como portada de la habitación ⭐', 'info');
    }
  },

  renderPresetButtons() {
    const container = document.getElementById('room-presets-container');
    if (!container) return;

    container.innerHTML = this.PRESET_IMAGES.map(p => `
      <button type="button" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 3px 8px;" onclick="RoomsModule.addPresetPhoto('${p.url}')">
        <i class="fas fa-plus-circle"></i> ${p.label}
      </button>
    `).join('');
  },

  /**
   * Eliminar todas las imágenes de la galería
   */
  async removeAllGalleryImages() {
    if (!this.currentGalleryImages || this.currentGalleryImages.length === 0) return;
    const count = this.currentGalleryImages.length;
    const ok = await CustomDialog.confirm({
      title: 'Eliminar Fotos de Galería',
      message: `¿Deseas eliminar todas las fotos (${count}) de la galería? La habitación requerirá al menos una imagen antes de poder guardarse.`,
      icon: 'fa-trash-alt',
      confirmText: 'Sí, Eliminar Todas',
      isDanger: true
    });
    if (ok) {
      this.currentGalleryImages = [];
      this.renderGalleryEditor();
      showToast('Se eliminaron todas las fotos de la galería.', 'warning');
    }
  },

  renderGalleryEditor() {
    const container = document.getElementById('room-gallery-container');
    const badgeCount = document.getElementById('room-photo-count-badge');
    const clearAllBtn = document.getElementById('btn-clear-all-photos');
    
    if (badgeCount) {
      const count = this.currentGalleryImages.length;
      badgeCount.innerText = `${count} ${count === 1 ? 'foto' : 'fotos'}`;
    }

    if (clearAllBtn) {
      clearAllBtn.style.display = this.currentGalleryImages.length > 0 ? 'inline-flex' : 'none';
    }

    if (!container) return;

    if (this.currentGalleryImages.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; background: #FFFBEB; border: 1.5px dashed #F59E0B; border-radius: 8px; padding: 20px 14px; color: #92400E;">
          <i class="fas fa-exclamation-triangle" style="font-size: 26px; color: #D97706; margin-bottom: 8px; display: block;"></i>
          <strong style="font-size: 13.5px; display: block; margin-bottom: 4px; color: #B45309;">
            Galería vacía: Se requiere al menos 1 imagen obligatoria
          </strong>
          <p style="font-size: 12px; color: #78350F; margin: 0 0 12px 0; line-height: 1.4;">
            Para evitar errores de visualización en el panel y en la app móvil, debes tener al menos una foto antes de guardar.
          </p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm btn-primary" onclick="document.getElementById('room-local-file-input').click()">
              <i class="fas fa-folder-open"></i> Subir Foto Local
            </button>
            <button type="button" class="btn btn-sm btn-outline" onclick="RoomsModule.addPresetPhoto(RoomsModule.PRESET_IMAGES[0].url)" style="background: #ffffff;">
              <i class="fas fa-magic"></i> Cargar Foto Recomendada
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentGalleryImages.map((url, idx) => `
      <div class="room-gallery-card ${idx === 0 ? 'is-cover' : ''}">
        <img src="${url}" onerror="this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300'" alt="Habitación">
        ${idx === 0 ? `
          <div class="card-badge-cover">
            <i class="fas fa-star"></i> Portada
          </div>
        ` : ''}
        <div class="card-actions">
          ${idx !== 0 ? `
            <button type="button" class="card-btn btn-cover" onclick="RoomsModule.setAsCover(${idx})" title="Hacer Portada Principal">
              <i class="fas fa-star"></i>
            </button>
          ` : ''}
          <button type="button" class="card-btn btn-delete" onclick="RoomsModule.removeGalleryImage(${idx})" title="Eliminar Foto de la Galería">
            <i class="fas fa-times"></i>
          </button>
        </div>
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
      if (this.currentGalleryImages.length === 0) {
        showToast('Has eliminado todas las fotos. Recuerda que es obligatorio tener al menos una imagen para guardar.', 'warning');
      } else {
        showToast('Foto eliminada de la galería', 'info');
      }
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

      // VALIDACIÓN ESTRICTA: La habitación debe tener obligatoriamente al menos 1 imagen
      if (!this.currentGalleryImages || this.currentGalleryImages.length === 0) {
        showToast('⚠️ Obligatorio: La habitación debe tener al menos una imagen para guardar y evitar errores.', 'warning');
        const dropzone = document.getElementById('room-dropzone');
        if (dropzone) {
          dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dropzone.style.borderColor = '#EF4444';
          dropzone.style.backgroundColor = '#FEF2F2';
          setTimeout(() => {
            dropzone.style.borderColor = '';
            dropzone.style.backgroundColor = '';
          }, 2500);
        }
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
        pava_electrica: !!document.querySelector('#modal-room-editor input[name="pava_electrica"]')?.checked,
        secador: !!document.querySelector('#modal-room-editor input[name="secador"]')?.checked,
        room_service: !!document.querySelector('#modal-room-editor input[name="room_service"]')?.checked,
        accesibilidad: !!document.querySelector('#modal-room-editor input[name="accesibilidad"]')?.checked,
        camas: camas,
        tamano_m2: tamano,
        precio_personalizado: parseInt(document.getElementById('edit-room-price')?.value) || 180000,
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
        if (typeof notifyDataChanged === 'function') notifyDataChanged('habitaciones', { action: 'update', numero });
      } else {
        // Modo Creación
        const { error } = await supabaseClient
          .from('habitaciones')
          .insert(payload);

        if (error) throw error;
        showToast(`¡Habitación ${numero} registrada exitosamente!`, 'success');
        if (typeof notifyDataChanged === 'function') notifyDataChanged('habitaciones', { action: 'insert', numero });
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
    const newStatus = await CustomDialog.prompt({
      title: 'Cambiar Estado Operativo',
      message: `Estado actual: ${currentStatus}. Ingrese el nuevo estado:`,
      label: 'Nuevo Estado (Disponible, Ocupada, Sucia, En limpieza, Mantenimiento)',
      defaultValue: currentStatus,
      placeholder: 'Ej. Disponible',
      confirmText: 'Actualizar Estado'
    });
    if (!newStatus || newStatus === currentStatus) return;

    try {
      const { error } = await supabaseClient
        .from('habitaciones')
        .update({ estado: newStatus })
        .eq('id', roomId);

      if (error) throw error;

      showToast(`Estado cambiado a '${newStatus}'`, 'success');
      if (typeof notifyDataChanged === 'function') notifyDataChanged('habitaciones', { action: 'status_change', roomId, status: newStatus });
      await this.loadRooms();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();
    } catch (err) {
      showToast('Error al cambiar estado: ' + err.message, 'error');
    }
  }
};
