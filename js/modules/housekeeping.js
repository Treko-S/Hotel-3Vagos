/**
 * HOTEL 3 VAGOS - UTCD
 * Housekeeping & Gobernanza Operativa Avanzada
 * - Despacho por Prioridades 1, 2, 3 (Jefa de Limpieza / Gobernanta)
 * - Turno y Checklist de 5 Áreas (Mucamas / Asistentes)
 * - Bitácora de Incidencias con Respaldo Fotográfico (Cámara/Tablet)
 * - Matriz de Custodia de Llaves Físicas & Tarjetas RFID
 */

const HousekeepingModule = {
  currentRooms: [],
  selectedRoom: null,
  activeTab: 'jefa',
  currentIncidentPhoto: null,

  // Inicialización de órdenes de limpieza persistentes
  getOrders() {
    try {
      const data = localStorage.getItem('hotel_hk_orders');
      if (data) return JSON.parse(data);
    } catch (e) {}

    // Datos iniciales de demostración operativa
    return {
      "1": { priority: 1, maid: "Rosa Almada", notes: "Early Check-in: Huésped esperando en recepción. Cama extra armada.", status: "Pendiente", assignedAt: "08:15" },
      "2": { priority: 2, maid: "Elena Morales", notes: "Check-out realizado a las 10:00. Dejar impecable para venta.", status: "En limpieza", assignedAt: "09:30" },
      "3": { priority: 3, maid: "Carmen Duarte", notes: "Huésped salió de excursión. Repaso diario y cambio de toallas.", status: "Pendiente", assignedAt: "10:00" },
      "4": { priority: 2, maid: "Rosa Almada", notes: "Revisar especialmente desagüe de bañera.", status: "Pendiente", assignedAt: "10:45" }
    };
  },

  saveOrders(orders) {
    try {
      localStorage.setItem('hotel_hk_orders', JSON.stringify(orders));
    } catch (e) {}
  },

  // Matriz de custodia de llaves físicas y tarjetas RFID
  getKeys() {
    try {
      const data = localStorage.getItem('hotel_hk_keys');
      if (data) return JSON.parse(data);
    } catch (e) {}

    return {
      "101": { status: "En Recepción", rfid: "RFID-101-A", holder: "Recepción Mostrador", lastMoved: "Hoy 10:30" },
      "102": { status: "Entregada a Huésped", rfid: "RFID-102-A", holder: "Huésped Titular", lastMoved: "Ayer 14:15" },
      "103": { status: "En Servicio Mucama", rfid: "RFID-103-A", holder: "Rosa Almada (Mucama)", lastMoved: "Hoy 09:00" },
      "104": { status: "En Mantenimiento", rfid: "RFID-104-A", holder: "Técnico Mario Gómez", lastMoved: "Hoy 08:30" },
      "201": { status: "En Recepción", rfid: "RFID-201-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "202": { status: "En Recepción", rfid: "RFID-202-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "203": { status: "En Recepción", rfid: "RFID-203-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "204": { status: "En Recepción", rfid: "RFID-204-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "301": { status: "En Recepción", rfid: "RFID-301-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "302": { status: "En Recepción", rfid: "RFID-302-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" },
      "303": { status: "En Recepción", rfid: "RFID-303-A", holder: "Recepción Mostrador", lastMoved: "Hoy 07:00" }
    };
  },

  saveKeys(keys) {
    try {
      localStorage.setItem('hotel_hk_keys', JSON.stringify(keys));
    } catch (e) {}
  },

  // Bitácora de incidencias reportadas con foto
  getIncidents() {
    try {
      const data = localStorage.getItem('hotel_hk_incidents');
      if (data) return JSON.parse(data);
    } catch (e) {}

    return [
      {
        id: 1,
        roomNumber: "104",
        nature: "mantenimiento",
        description: "Control remoto de aire split no enciende tras reemplazo de pilas. Requiere revisión técnica.",
        photo: null,
        reportedBy: "Rosa Almada (Mucama)",
        reportedAt: "05/09/2026 11:20",
        status: "Derivado a Mantenimiento"
      },
      {
        id: 2,
        roomNumber: "102",
        nature: "inventario",
        description: "Faltan 2 toallas de mano y 1 juego de batas de baño en placard. Reponer desde bodega central.",
        photo: null,
        reportedBy: "Elena Morales (Mucama)",
        reportedAt: "05/09/2026 14:05",
        status: "Derivado a Inventario"
      }
    ];
  },

  saveIncidents(incidents) {
    try {
      localStorage.setItem('hotel_hk_incidents', JSON.stringify(incidents));
    } catch (e) {}
  },

  async init() {
    await this.loadHousekeepingBoard();
  },

  async loadHousekeepingBoard() {
    try {
      const { data, error } = await supabaseClient
        .from('habitaciones')
        .select('*, tipos_habitacion(*)')
        .order('numero', { ascending: true });

      if (error) throw error;
      this.currentRooms = data || [];

      // Poblar selector de habitaciones en los modales
      this.populateRoomSelects();

      // Configuración según el rol activo
      const role = (typeof AppState !== 'undefined' && AppState.currentRole) ? AppState.currentRole : 'administrador';
      const dispatchBtn = document.getElementById('btn-hk-dispatch-order');

      if (role === 'mucama') {
        if (dispatchBtn) dispatchBtn.style.display = 'none';
        this.switchTab('mucama');
      } else {
        if (dispatchBtn) dispatchBtn.style.display = 'inline-flex';
        this.switchTab(this.activeTab || 'jefa');
      }

    } catch (err) {
      console.error('Error al cargar Housekeeping:', err);
      showToast('Error al sincronizar datos de Housekeeping: ' + err.message, 'error');
    }
  },

  populateRoomSelects() {
    const dispatchSelect = document.getElementById('dispatch-room-select');
    const incidentSelect = document.getElementById('incident-room-select');

    if (dispatchSelect) {
      dispatchSelect.innerHTML = this.currentRooms.map(r => 
        `<option value="${r.id}">Habitación ${r.numero} (${r.tipos_habitacion?.nombre || 'Estándar'}) • Estado: ${r.estado}</option>`
      ).join('');
    }

    if (incidentSelect) {
      incidentSelect.innerHTML = this.currentRooms.map(r => 
        `<option value="${r.numero}">Habitación ${r.numero} (${r.tipos_habitacion?.nombre || 'Estándar'})</option>`
      ).join('');
    }
  },

  switchTab(tabName) {
    this.activeTab = tabName;

    // Actualizar botones de pestañas
    document.querySelectorAll('.hk-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`hk-tab-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');

    // Mostrar sección correspondiente
    const tabs = ['jefa', 'mucama', 'keys', 'incidents'];
    tabs.forEach(t => {
      const el = document.getElementById(`hk-content-${t}`);
      if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    });

    // Renderizar datos de la pestaña
    if (tabName === 'jefa') this.renderJefaView();
    if (tabName === 'mucama') this.renderMucamaView();
    if (tabName === 'keys') this.renderKeysMatrix();
    if (tabName === 'incidents') this.renderIncidentsTable();
  },

  /**
   * TAB 1: VISTA JEFA DE LIMPIEZA / GOBERNANTA
   * Orden estricto de prioridad:
   * Prioridad 1 (Urgente): Early Check-in con huésped esperando
   * Prioridad 2: Check-out normal para liberar
   * Prioridad 3: Ocupada (Repaso diario)
   */
  renderJefaView() {
    const tbody = document.getElementById('hk-jefa-table-body');
    if (!tbody) return;

    const orders = this.getOrders();

    // Ordenar habitaciones: primero las con órdenes asignadas por prioridad (1, 2, 3) y luego el resto
    const sortedRooms = [...this.currentRooms].sort((a, b) => {
      const orderA = orders[a.id];
      const orderB = orders[b.id];

      const prioA = orderA ? orderA.priority : (a.estado === 'Sucia' ? 2 : (a.estado === 'En limpieza' ? 2 : 99));
      const prioB = orderB ? orderB.priority : (b.estado === 'Sucia' ? 2 : (b.estado === 'En limpieza' ? 2 : 99));

      return prioA - prioB;
    });

    let html = '';
    sortedRooms.forEach(room => {
      const tipo = room.tipos_habitacion || {};
      const order = orders[room.id] || null;
      const statusClass = (room.estado || '').toLowerCase().replace(/\s+/g, '-');

      // Definición de Prioridad
      let priorityBadge = '';
      let priorityNum = order ? order.priority : (room.estado === 'Sucia' ? 2 : 0);

      if (priorityNum === 1) {
        priorityBadge = `<span class="badge-priority badge-priority-1"><i class="fas fa-bolt"></i> Prioridad 1: Early Check-in</span>`;
      } else if (priorityNum === 2) {
        priorityBadge = `<span class="badge-priority badge-priority-2"><i class="fas fa-sign-out-alt"></i> Prioridad 2: Check-out</span>`;
      } else if (priorityNum === 3) {
        priorityBadge = `<span class="badge-priority badge-priority-3"><i class="fas fa-bed"></i> Prioridad 3: Repaso</span>`;
      } else {
        priorityBadge = `<span style="font-size: 11px; color: var(--text-muted);"><i class="fas fa-minus-circle"></i> Estándar</span>`;
      }

      const assignedMaid = order ? order.maid : '<span style="color: var(--text-muted); font-style: italic;">Sin asignar</span>';
      const orderNotes = order ? order.notes : (room.observaciones || '-');

      html += `
        <tr>
          <td>${priorityBadge}</td>
          <td>
            <strong style="font-size: 15px; color: var(--primary-navy);">Habitación ${sanitizeInput(room.numero)}</strong>
          </td>
          <td>
            <div>${sanitizeInput(tipo.nombre || 'Habitación')}</div>
            <small style="color: var(--text-muted);">Piso ${room.piso || 1}</small>
          </td>
          <td>
            <span class="badge badge-${statusClass}">${sanitizeInput(room.estado)}</span>
          </td>
          <td>
            <div style="font-weight: 600; color: #1E293B; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-user-circle" style="color: var(--accent-gold);"></i> ${assignedMaid}
            </div>
          </td>
          <td>
            <span style="font-size: 12px; color: #475569; max-width: 250px; display: inline-block;">${sanitizeInput(orderNotes)}</span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn-action btn-action-reserve" onclick="HousekeepingModule.openDispatchModal(${room.id})" title="Asignar o Modificar Orden de Limpieza">
                <i class="fas fa-user-edit"></i> Asignar
              </button>
              <button class="btn-action btn-action-view" onclick="HousekeepingModule.openCleaningChecklist(${room.id})" title="Supervisar Checklist Calidad">
                <i class="fas fa-clipboard-check"></i> Checklist
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  /**
   * TAB 2: VISTA MUCAMA / ASISTENTE DE LIMPIEZA
   */
  renderMucamaView() {
    const container = document.getElementById('hk-mucama-grid');
    if (!container) return;

    const filterMaid = document.getElementById('filter-mucama-select')?.value || 'ALL';
    const orders = this.getOrders();

    // Filtrar habitaciones asignadas
    let assignedList = this.currentRooms.filter(room => {
      const ord = orders[room.id];
      if (!ord) return room.estado === 'Sucia' || room.estado === 'En limpieza';
      if (filterMaid === 'ALL') return true;
      return ord.maid.toLowerCase().includes(filterMaid.toLowerCase());
    });

    // Ordenar por prioridad 1, 2, 3
    assignedList.sort((a, b) => {
      const prioA = orders[a.id]?.priority || 2;
      const prioB = orders[b.id]?.priority || 2;
      return prioA - prioB;
    });

    if (assignedList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: #F8FAFC; border-radius: 14px; border: 1px dashed #CBD5E1;">
          <i class="fas fa-check-circle" style="font-size: 38px; color: #10B981; margin-bottom: 12px; display: block;"></i>
          <h4 style="color: var(--primary-navy); margin: 0 0 6px 0;">¡Excelente trabajo! No hay habitaciones pendientes</h4>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Todas las habitaciones asignadas están verificadas o no tienen órdenes pendientes.</p>
        </div>
      `;
      return;
    }

    let html = '';
    assignedList.forEach(room => {
      const tipo = room.tipos_habitacion || {};
      const ord = orders[room.id] || { priority: 2, maid: 'Rosa Almada', notes: 'Limpieza de rutina' };
      const statusClass = (room.estado || '').toLowerCase().replace(/\s+/g, '-');

      let priorityClass = 'badge-priority-2';
      let priorityText = 'Prioridad 2: Check-out';
      let priorityIcon = 'fa-sign-out-alt';

      if (ord.priority === 1) {
        priorityClass = 'badge-priority-1';
        priorityText = 'Prioridad 1: Early Check-in (URGENTE)';
        priorityIcon = 'fa-bolt';
      } else if (ord.priority === 3) {
        priorityClass = 'badge-priority-3';
        priorityText = 'Prioridad 3: Repaso Diario Ocupada';
        priorityIcon = 'fa-bed';
      }

      html += `
        <div class="room-panel-card status-${statusClass}" style="border-top: 4px solid ${ord.priority === 1 ? '#EF4444' : (ord.priority === 3 ? '#3B82F6' : '#F59E0B')};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span class="badge-priority ${priorityClass}" style="margin-bottom: 6px; display: inline-flex;">
                <i class="fas ${priorityIcon}"></i> ${priorityText}
              </span>
              <h4 style="font-size: 19px; color: var(--primary-navy); font-weight: bold; margin: 4px 0 2px 0;">
                Habitación ${sanitizeInput(room.numero)}
              </h4>
              <p style="font-size: 12px; color: var(--text-muted); margin: 0;">${sanitizeInput(tipo.nombre || 'Habitación')}</p>
            </div>
            <span class="badge badge-${statusClass}">${sanitizeInput(room.estado)}</span>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 12.5px;">
            <div style="font-weight: 600; color: #1E293B; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-user-check" style="color: var(--accent-gold);"></i> Asignada a: <span>${sanitizeInput(ord.maid)}</span>
            </div>
            <div style="color: #64748B; font-size: 12px; line-height: 1.4;">
              <i class="fas fa-clipboard"></i> <strong>Instrucciones:</strong> ${sanitizeInput(ord.notes || 'Limpieza y reposición estándar')}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn btn-sm btn-gold" style="flex: 2; padding: 8px 12px; font-weight: 600;" onclick="HousekeepingModule.openCleaningChecklist(${room.id})">
              <i class="fas fa-clipboard-check"></i> Abrir Checklist 5/5
            </button>
            <button class="btn btn-sm btn-outline" style="flex: 1; padding: 8px; color: #D97706; border-color: #FCD34D;" onclick="HousekeepingModule.openIncidentModal(${room.numero})" title="Reportar avería o faltante con foto">
              <i class="fas fa-camera"></i> Incidencia
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  /**
   * TAB 3: MATRIZ DE CONTROL DE LLAVES FÍSICAS & TARJETAS RFID
   */
  renderKeysMatrix() {
    const container = document.getElementById('hk-keys-grid');
    if (!container) return;

    const keys = this.getKeys();
    let html = '';

    this.currentRooms.forEach(room => {
      const num = String(room.numero);
      const keyInfo = keys[num] || {
        status: (room.estado === 'Ocupada' ? 'Entregada a Huésped' : (room.estado === 'En limpieza' ? 'En Servicio Mucama' : 'En Recepción')),
        rfid: `RFID-${num}-A`,
        holder: (room.estado === 'Ocupada' ? 'Huésped Titular' : 'Recepción Mostrador'),
        lastMoved: 'Hoy 08:00'
      };

      // Colores de estado de custodia
      let statusColor = '#10B981';
      let statusBg = 'rgba(16, 185, 129, 0.12)';
      let icon = 'fa-key';

      if (keyInfo.status === 'Entregada a Huésped') {
        statusColor = '#2563EB';
        statusBg = 'rgba(37, 99, 235, 0.12)';
        icon = 'fa-user-tag';
      } else if (keyInfo.status === 'En Servicio Mucama') {
        statusColor = '#D97706';
        statusBg = 'rgba(217, 119, 6, 0.12)';
        icon = 'fa-broom';
      } else if (keyInfo.status === 'En Mantenimiento') {
        statusColor = '#DC2626';
        statusBg = 'rgba(220, 38, 38, 0.12)';
        icon = 'fa-tools';
      } else if (keyInfo.status === 'Extraviada') {
        statusColor = '#64748B';
        statusBg = 'rgba(100, 116, 139, 0.15)';
        icon = 'fa-ban';
      }

      html += `
        <div class="key-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: ${statusBg}; color: ${statusColor}; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              <i class="fas ${icon}"></i>
            </div>
            <span class="badge" style="background: ${statusBg}; color: ${statusColor}; font-size: 10.5px; font-weight: 700; border: 1px solid ${statusColor}33;">
              ${keyInfo.status}
            </span>
          </div>

          <h4 style="font-size: 18px; color: var(--primary-navy); margin: 0 0 4px 0; font-weight: bold;">
            Hab. ${sanitizeInput(room.numero)}
          </h4>
          <div style="font-family: monospace; font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px;">
            <i class="fas fa-barcode"></i> ${keyInfo.rfid}
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px; font-size: 11.5px; margin-bottom: 12px; text-align: left;">
            <div style="color: #334155; font-weight: 600;">Custodia actual:</div>
            <div style="color: #64748B;">${sanitizeInput(keyInfo.holder)}</div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">Último cambio: ${keyInfo.lastMoved}</div>
          </div>

          <div style="display: flex; gap: 4px;">
            <select class="form-control" style="font-size: 11px; padding: 4px 6px; height: 32px;" onchange="HousekeepingModule.changeKeyStatus('${num}', this.value)">
              <option value="En Recepción" ${keyInfo.status === 'En Recepción' ? 'selected' : ''}>🟢 En Recepción</option>
              <option value="Entregada a Huésped" ${keyInfo.status === 'Entregada a Huésped' ? 'selected' : ''}>🔵 Huésped</option>
              <option value="En Servicio Mucama" ${keyInfo.status === 'En Servicio Mucama' ? 'selected' : ''}>🟡 Mucama</option>
              <option value="En Mantenimiento" ${keyInfo.status === 'En Mantenimiento' ? 'selected' : ''}>🔴 Mantenimiento</option>
              <option value="Extraviada" ${keyInfo.status === 'Extraviada' ? 'selected' : ''}>⚫ Extraviada</option>
            </select>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  changeKeyStatus(roomNum, newStatus) {
    const keys = this.getKeys();
    let holder = "Recepción Mostrador";

    if (newStatus === "Entregada a Huésped") holder = "Huésped Titular";
    else if (newStatus === "En Servicio Mucama") holder = "Mucama de Turno";
    else if (newStatus === "En Mantenimiento") holder = "Técnico Especialista";
    else if (newStatus === "Extraviada") holder = "Bloqueada por Seguridad";

    keys[roomNum] = {
      ...(keys[roomNum] || { rfid: `RFID-${roomNum}-A` }),
      status: newStatus,
      holder: holder,
      lastMoved: "Hoy " + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
    };

    this.saveKeys(keys);
    showToast(`Custodia de llave Habitación ${roomNum} actualizada a: ${newStatus}`, 'info');
    this.renderKeysMatrix();
  },

  /**
   * TAB 4: BITÁCORA DE INCIDENCIAS REPORTADAS CON FOTO
   */
  renderIncidentsTable() {
    const tbody = document.getElementById('hk-incidents-table-body');
    if (!tbody) return;

    const incidents = this.getIncidents();

    if (incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No se registran incidencias activas.</td></tr>`;
      return;
    }

    let html = '';
    incidents.forEach(inc => {
      const isMaint = inc.nature === 'mantenimiento';
      const natureBadge = isMaint
        ? `<span class="badge" style="background: rgba(220, 38, 38, 0.12); color: #DC2626; border: 1px solid rgba(220, 38, 38, 0.3);"><i class="fas fa-tools"></i> Mantenimiento</span>`
        : `<span class="badge" style="background: rgba(217, 119, 6, 0.12); color: #D97706; border: 1px solid rgba(217, 119, 6, 0.3);"><i class="fas fa-boxes"></i> Insumos / Inventario</span>`;

      const photoHtml = inc.photo
        ? `<img src="${inc.photo}" alt="Foto" style="width: 46px; height: 38px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid #CBD5E1;" onclick="HousekeepingModule.viewPhotoFull('${inc.photo}')" title="Click para ampliar foto">`
        : `<span style="font-size: 11px; color: var(--text-muted);"><i class="fas fa-camera-slash"></i> Sin foto</span>`;

      html += `
        <tr>
          <td style="font-size: 12px; color: var(--text-muted);">${inc.reportedAt}</td>
          <td><strong style="color: var(--primary-navy); font-size: 14px;">Habitación ${sanitizeInput(inc.roomNumber)}</strong></td>
          <td>${natureBadge}</td>
          <td><span style="font-size: 13px; color: #334155;">${sanitizeInput(inc.description)}</span></td>
          <td>${photoHtml}</td>
          <td><span style="font-size: 12.5px; font-weight: 500;">${sanitizeInput(inc.reportedBy)}</span></td>
          <td><span class="badge badge-confirmada">${sanitizeInput(inc.status)}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  viewPhotoFull(dataUrl) {
    const w = window.open("");
    w.document.write(`<title>Foto Incidencia Hotel 3 Vagos</title><body style="margin:0; background:#0F172A; display:flex; align-items:center; justify-content:center; height:100vh;"><img src="${dataUrl}" style="max-width:95%; max-height:95%; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);"></body>`);
  },

  /**
   * MODAL DESPACHO DE ORDEN DE LIMPIEZA
   */
  openDispatchModal(roomId) {
    this.populateRoomSelects();
    if (roomId) {
      const sel = document.getElementById('dispatch-room-select');
      if (sel) sel.value = String(roomId);
    }
    openModal('modal-dispatch-cleaning');
  },

  async confirmDispatchOrder() {
    const roomId = document.getElementById('dispatch-room-select').value;
    const priority = parseInt(document.getElementById('dispatch-priority-select').value || '2', 10);
    const maid = document.getElementById('dispatch-maid-select').value;
    const notes = document.getElementById('dispatch-notes').value || 'Limpieza y preparación asignada';

    const orders = this.getOrders();
    orders[roomId] = {
      priority: priority,
      maid: maid,
      notes: notes,
      status: 'Pendiente',
      assignedAt: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
    };

    this.saveOrders(orders);

    // Actualizar estado en Supabase a 'Sucia' o 'En limpieza' si estaba disponible
    try {
      await supabaseClient
        .from('habitaciones')
        .update({
          observaciones: `Orden P${priority} asignada a ${maid}: ${notes}`
        })
        .eq('id', roomId);
    } catch (e) {
      console.warn('Skip supabase sync on order dispatch:', e);
    }

    closeModal('modal-dispatch-cleaning');
    showToast(`¡Orden de limpieza emitida a ${maid} con Prioridad ${priority}!`, 'success');

    await this.loadHousekeepingBoard();
    if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
  },

  /**
   * MODAL REGISTRO DE INCIDENCIA CON FOTO
   */
  openIncidentModal(roomNumber) {
    this.populateRoomSelects();
    if (roomNumber) {
      const sel = document.getElementById('incident-room-select');
      if (sel) sel.value = String(roomNumber);
    }

    // Limpiar formulario y foto
    document.getElementById('incident-description').value = '';
    this.clearIncidentPhoto();

    openModal('modal-incident-report');
  },

  openIncidentFromChecklist() {
    const num = document.getElementById('hk-modal-room-number')?.innerText;
    closeModal('modal-housekeeping');
    this.openIncidentModal(num);
  },

  onIncidentPhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentIncidentPhoto = e.target.result;
      const preview = document.getElementById('incident-photo-preview');
      const placeholder = document.getElementById('incident-photo-placeholder');
      const actions = document.getElementById('incident-photo-actions');

      if (preview) {
        preview.src = this.currentIncidentPhoto;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (actions) actions.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  clearIncidentPhoto() {
    this.currentIncidentPhoto = null;
    const preview = document.getElementById('incident-photo-preview');
    const placeholder = document.getElementById('incident-photo-placeholder');
    const actions = document.getElementById('incident-photo-actions');
    const fileInput = document.getElementById('incident-photo-input');

    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
    if (actions) actions.style.display = 'none';
    if (fileInput) fileInput.value = '';
  },

  async confirmIncidentReport() {
    const roomNumber = document.getElementById('incident-room-select').value;
    const reporter = document.getElementById('incident-reporter').value || 'Mucama';
    const nature = document.getElementById('incident-nature').value;
    const description = document.getElementById('incident-description').value;

    if (!description.trim()) {
      showToast('Por favor detalle el motivo o avería de la incidencia', 'warning');
      return;
    }

    const incidents = this.getIncidents();
    const newInc = {
      id: Date.now(),
      roomNumber: roomNumber,
      nature: nature,
      description: description,
      photo: this.currentIncidentPhoto,
      reportedBy: reporter,
      reportedAt: new Date().toLocaleDateString('es-PY') + ' ' + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
      status: nature === 'mantenimiento' ? 'Derivado a Mantenimiento' : 'Derivado a Inventario'
    };

    incidents.unshift(newInc);
    this.saveIncidents(incidents);

    // Si es de mantenimiento, derivar automáticamente al Módulo de Mantenimiento
    if (nature === 'mantenimiento') {
      try {
        const roomObj = this.currentRooms.find(r => String(r.numero) === String(roomNumber));
        await supabaseClient.from('ordenes_mantenimiento').insert({
          habitacion_id: roomObj ? roomObj.id : null,
          tipo_incidencia: 'Incidencia reportada por Housekeeping',
          descripcion: `[Reporte Mucama ${reporter}]: ${description}`,
          prioridad: 'Alta',
          tecnico_asignado: 'Mario Gómez (Mantenimiento Técnico)',
          costo_estimado: 0,
          estado: 'Pendiente'
        });
      } catch (e) {
        console.warn('Mantenimiento auto-insert skip:', e);
      }
    }

    closeModal('modal-incident-report');
    this.clearIncidentPhoto();

    showToast(`¡Incidencia de Habitación ${roomNumber} registrada y derivada con éxito!`, 'success');

    // Cambiar a la pestaña de incidencias
    this.switchTab('incidents');
  },

  /**
   * CHECKLIST DE 5 ÁREAS
   */
  openCleaningChecklist(roomId) {
    const room = this.currentRooms.find(r => r.id === roomId);
    if (!room) return;

    this.selectedRoom = room;

    const orders = this.getOrders();
    const order = orders[room.id] || { priority: 2, maid: 'Rosa Almada (Mucama)' };

    document.getElementById('hk-modal-room-id').value = room.id;
    document.getElementById('hk-modal-room-number').innerText = room.numero;
    document.getElementById('hk-modal-room-type').innerText = room.tipos_habitacion?.nombre || '';

    // Badges de prioridad en el checklist
    const badgeEl = document.getElementById('hk-modal-priority-badge');
    const textEl = document.getElementById('hk-modal-priority-text');

    if (order.priority === 1) {
      if (badgeEl) { badgeEl.className = 'badge-priority badge-priority-1'; badgeEl.innerHTML = '<i class="fas fa-bolt"></i> Prioridad 1: URGENTE'; }
      if (textEl) textEl.innerText = 'Early Check-in: Huésped esperando en recepción. Máxima prioridad.';
    } else if (order.priority === 3) {
      if (badgeEl) { badgeEl.className = 'badge-priority badge-priority-3'; badgeEl.innerHTML = '<i class="fas fa-bed"></i> Prioridad 3'; }
      if (textEl) textEl.innerText = 'Habitación ocupada: Repaso diario de camas y toallas.';
    } else {
      if (badgeEl) { badgeEl.className = 'badge-priority badge-priority-2'; badgeEl.innerHTML = '<i class="fas fa-sign-out-alt"></i> Prioridad 2'; }
      if (textEl) textEl.innerText = 'Check-out normal: Liberar para disponibilidad general.';
    }

    // Nombre de la mucama
    const cleanerInput = document.getElementById('hk-cleaner-name');
    if (cleanerInput) cleanerInput.value = order.maid || 'Rosa Almada (Mucama)';

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
          observaciones: 'Personal de mucamas trabajando en la habitación.'
        })
        .eq('id', this.selectedRoom.id);

      // Actualizar custodia de llave a 'En Servicio Mucama'
      this.changeKeyStatus(String(this.selectedRoom.numero), 'En Servicio Mucama');

      showToast(`Habitación ${this.selectedRoom.numero} puesta en estado 'En limpieza'`, 'info');
      await this.loadHousekeepingBoard();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
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
    const cleaner = document.getElementById('hk-cleaner-name').value || 'Rosa Almada';

    if (!chkCama || !chkBano || !chkEquip || !chkMini || !chkInsp) {
      showToast('Debe verificar y marcar los 5 puntos de inspección antes de liberar la habitación', 'warning');
      return;
    }

    try {
      // 1. Liberar habitación a 'Disponible'
      const { error: roomErr } = await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'Disponible',
          observaciones: 'Habitación limpia, inspeccionada 5/5 y lista para venta.'
        })
        .eq('id', this.selectedRoom.id);

      if (roomErr) throw roomErr;

      // 2. Remover o marcar orden completada
      const orders = this.getOrders();
      delete orders[this.selectedRoom.id];
      this.saveOrders(orders);

      // 3. Regresar custodia de llave a Recepción
      this.changeKeyStatus(String(this.selectedRoom.numero), 'En Recepción');

      // 4. Registro de auditoría
      try {
        await supabaseClient.from('tareas_limpieza').insert({
          habitacion_id: this.selectedRoom.id,
          responsable: cleaner,
          estado: 'Completada',
          observaciones: obs ? `Checklist 5/5 aprobado. Obs: ${obs}` : 'Checklist 5/5 verificado e inspeccionado'
        });
      } catch (e) {
        console.warn('Skip tareas_limpieza log:', e);
      }

      closeModal('modal-housekeeping');
      showToast(`¡Habitación ${this.selectedRoom.numero} liberada con éxito a Disponible!`, 'success');

      await this.loadHousekeepingBoard();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();

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
          observaciones: 'Marcada como sucia para orden de limpieza.'
        })
        .eq('id', roomId);

      showToast('Habitación marcada como sucia', 'warning');
      await this.loadHousekeepingBoard();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
    } catch (err) {
      console.error('Error al marcar sucia:', err);
    }
  }
};
