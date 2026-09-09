/**
 * HOTEL 3 VAGOS - UTCD
 * Housekeeping & Gobernanza Operativa Avanzada
 * - Despacho por Prioridades 1, 2, 3 (Jefa de Limpieza / Gobernanta)
 * - Turno y Checklist de 5 Áreas (Mucamas / Asistentes)
 * - Tareas estrictamente separadas por usuario (Mucama 1 no ve las de Mucama 2)
 * - Nombre de mucama bloqueado (readonly) para evitar falsas acusaciones
 * - Botón "Editar Tarea" para habitaciones ya asignadas
 * - Matriz de Custodia de Llaves Físicas & Tarjetas RFID
 * - Bitácora de Incidencias con Respaldo Fotográfico
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
      if (data !== null) return JSON.parse(data);
    } catch (e) {}
    return {};
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
      "101": {
        status: "En Recepción",
        rfid: "RFID-101-A",
        location: "Casillero 101 - Despacho Front Desk",
        holder: "Recepción Mostrador",
        checkoutTime: "-",
        returnTime: "Hoy 10:30",
        notes: "Llavero tallado Hotel 3 Vagos + 2 tarjetas RFID",
        history: [
          { time: "Hoy 10:30", status: "En Recepción", holder: "Recepción Mostrador", action: "Devolución tras Check-out" }
        ]
      },
      "102": {
        status: "Entregada a Huésped",
        rfid: "RFID-102-A",
        location: "En Posesión del Huésped",
        holder: "Huésped Titular",
        checkoutTime: "Ayer 14:15",
        returnTime: "Mañana 11:00",
        notes: "Llavero UTCD + 1 tarjeta RFID",
        history: [
          { time: "Ayer 14:15", status: "Entregada a Huésped", holder: "Huésped Titular", action: "Entrega física en Check-in" }
        ]
      },
      "103": {
        status: "En Servicio Mucama",
        rfid: "RFID-103-A",
        location: "En Carrito de Mucama",
        holder: "Rosa Almada (Mucama)",
        checkoutTime: "Hoy 09:00",
        returnTime: "Hoy 12:00",
        notes: "Llave física de servicio para limpieza de turno",
        history: [
          { time: "Hoy 09:00", status: "En Servicio Mucama", holder: "Rosa Almada (Mucama)", action: "Retiro del despacho para limpieza" }
        ]
      },
      "104": {
        status: "En Mantenimiento",
        rfid: "RFID-104-A",
        location: "Taller Técnico Planta Baja",
        holder: "Técnico Mario Gómez",
        checkoutTime: "Hoy 08:30",
        returnTime: "Hoy 13:00",
        notes: "Retirada para revisión de cerradura electrónica y split",
        history: [
          { time: "Hoy 08:30", status: "En Mantenimiento", holder: "Técnico Mario Gómez", action: "Retiro por orden técnica" }
        ]
      },
      "201": { status: "En Recepción", rfid: "RFID-201-A", location: "Casillero 201 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero de cortesía", history: [] },
      "202": { status: "En Recepción", rfid: "RFID-202-A", location: "Casillero 202 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero estándar", history: [] },
      "203": { status: "En Recepción", rfid: "RFID-203-A", location: "Casillero 203 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero estándar", history: [] },
      "204": { status: "En Recepción", rfid: "RFID-204-A", location: "Casillero 204 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero estándar", history: [] },
      "301": { status: "En Recepción", rfid: "RFID-301-A", location: "Casillero 301 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero suite", history: [] },
      "302": { status: "En Recepción", rfid: "RFID-302-A", location: "Casillero 302 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero suite", history: [] },
      "303": { status: "En Recepción", rfid: "RFID-303-A", location: "Casillero 303 Front Desk", holder: "Recepción Mostrador", checkoutTime: "-", returnTime: "Hoy 07:00", notes: "Llavero suite", history: [] }
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
    return [];
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

      // 0. Sincronizar órdenes activas desde Supabase tareas_limpieza si existen
      try {
        const { data: dbTasks } = await supabaseClient
          .from('tareas_limpieza')
          .select('*')
          .neq('estado', 'Finalizada');

        if (dbTasks && dbTasks.length > 0) {
          const orders = this.getOrders();
          dbTasks.forEach(t => {
            const chk = t.checklist || {};
            if (t.habitacion_id) {
              orders[String(t.habitacion_id)] = {
                id: t.id,
                priority: chk.priority || (t.tipo_tarea === 'Limpieza Diaria' ? 3 : 2),
                maid: chk.maid || 'Rosa Almada',
                notes: chk.notes || t.notas || 'Limpieza y preparación asignada',
                status: t.estado === 'En proceso' ? 'En limpieza' : 'Pendiente',
                assignedAt: chk.assignedAt || 'Hoy'
              };
            }
          });
          this.saveOrders(orders);
        }
      } catch (e) {
        console.warn('Sync dbTasks skip:', e);
      }

      // Poblar selector de incidencias
      const incidentSelect = document.getElementById('incident-room-select');
      if (incidentSelect) {
        incidentSelect.innerHTML = this.currentRooms.map(r => 
          `<option value="${r.numero}">Habitación ${r.numero} (${r.tipos_habitacion?.nombre || 'Estándar'})</option>`
        ).join('');
      }

      // Configuración estricta según el rol activo
      const currentRole = (typeof AppState !== 'undefined' && AppState.currentRole) ? AppState.currentRole : 'administrador';
      const currentUser = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : null;
      const isMucama = (currentRole === 'mucama');

      const tabsNav = document.getElementById('hk-tabs-nav');
      const dispatchBtn = document.getElementById('btn-hk-dispatch-order');
      const filterCont = document.getElementById('hk-mucama-filter-container');
      const tabIncidents = document.getElementById('hk-tab-incidents');

      // Restricción Estricta de la Bitácora de Incidencias: SOLO para Administrador
      if (tabIncidents) {
        tabIncidents.style.display = (currentRole === 'administrador') ? 'inline-flex' : 'none';
      }

      if (isMucama) {
        // La mucama SOLO debe ver el Panel de mucamas
        if (tabsNav) tabsNav.style.display = 'none';
        if (dispatchBtn) dispatchBtn.style.display = 'none';
        if (filterCont) filterCont.style.display = 'none';

        const activeName = (currentUser && currentUser.name) ? currentUser.name : 'Rosa Almada (Mucama)';
        const titleEl = document.getElementById('hk-mucama-view-title');
        const subtitleEl = document.getElementById('hk-mucama-view-subtitle');
        if (titleEl) titleEl.innerText = `Mis Habitaciones Asignadas (${activeName})`;
        if (subtitleEl) subtitleEl.innerText = 'Lista exclusiva de tareas asignadas para su turno de trabajo.';

        this.switchTab('mucama');
      } else {
        // Jefa o Administrador
        if (tabsNav) tabsNav.style.display = 'flex';
        if (dispatchBtn) dispatchBtn.style.display = 'inline-flex';
        if (filterCont) filterCont.style.display = 'flex';

        this.switchTab(this.activeTab || 'jefa');
      }

    } catch (err) {
      console.error('Error al cargar Housekeeping:', err);
      showToast('Error al sincronizar datos de Housekeeping: ' + err.message, 'error');
    }
  },

  // Historial de Limpiezas Completadas (Tarea 7)
  getCleaningHistory() {
    try {
      const saved = localStorage.getItem('hotel_hk_completed_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'clh-1',
        roomNumber: '101',
        roomType: 'Habitación Standard Single (Piso 1)',
        maid: 'Rosa Almada',
        finishedAt: 'Hoy 11:20 hs',
        notes: 'Checklist 10/10 verificado. Habitación desinfectada y aromatizada.',
        status: 'Disponible'
      },
      {
        id: 'clh-2',
        roomNumber: '202',
        roomType: 'Habitación Doble Twin (Piso 2)',
        maid: 'Elena Morales',
        finishedAt: 'Hoy 10:45 hs',
        notes: 'Checklist 10/10 verificado. Reposición de minibar y blancos al 100%.',
        status: 'Disponible'
      },
      {
        id: 'clh-3',
        roomNumber: '301',
        roomType: 'Suite Presidencial Imperial (Piso 3)',
        maid: 'Carmen Duarte',
        finishedAt: 'Ayer 16:30 hs',
        notes: 'Checklist 10/10 verificado. Jacuzzi sanitizado con precinto higiénico.',
        status: 'Disponible'
      }
    ];
  },

  saveCleaningHistory(hist) {
    try {
      localStorage.setItem('hotel_hk_completed_history', JSON.stringify(hist));
    } catch (e) {}
  },

  renderCleaningHistory() {
    const tbody = document.getElementById('hk-history-table-body');
    if (!tbody) return;
    const list = this.getCleaningHistory();
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay registros previos en el historial de limpieza.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td>
          <div style="font-weight: 600; color: #1E293B; font-size: 13px;">${sanitizeInput(item.finishedAt)}</div>
        </td>
        <td>
          <strong style="color: var(--primary-navy); font-size: 14px;">Habitación ${sanitizeInput(item.roomNumber)}</strong>
        </td>
        <td>
          <span style="font-size: 12.5px; color: #334155;">${sanitizeInput(item.roomType || '-')}</span>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--primary-navy); display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-user-check" style="color: #10B981;"></i> ${sanitizeInput(item.maid)}
          </div>
        </td>
        <td>
          <span class="badge" style="background: #ECFDF5; color: #047857; font-size: 11px; margin-bottom: 3px; display: inline-block;">
            <i class="fas fa-clipboard-check"></i> Protocolo Conforme
          </span>
          <div style="font-size: 11.5px; color: var(--text-muted); max-width: 280px;">${sanitizeInput(item.notes || '-')}</div>
        </td>
        <td>
          <span class="badge badge-disponible"><i class="fas fa-check-double"></i> ${sanitizeInput(item.status || 'Disponible')}</span>
        </td>
      </tr>
    `).join('');
  },

  switchTab(tabName) {
    const currentRole = (typeof AppState !== 'undefined' && AppState.currentRole) ? AppState.currentRole : 'administrador';
    
    // Tarea 7: Solo existen 'jefa' y 'mucama'
    if (tabName !== 'jefa' && tabName !== 'mucama') {
      tabName = 'jefa';
    }

    // Si el usuario es mucama, queda bloqueada en 'mucama'
    if (currentRole === 'mucama') {
      tabName = 'mucama';
    }

    this.activeTab = tabName;

    // Actualizar botones de pestañas
    document.querySelectorAll('.hk-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`hk-tab-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');

    // Mostrar sección correspondiente
    const jefaEl = document.getElementById('hk-content-jefa');
    const mucamaEl = document.getElementById('hk-content-mucama');
    if (jefaEl) jefaEl.style.display = (tabName === 'jefa') ? 'block' : 'none';
    if (mucamaEl) mucamaEl.style.display = (tabName === 'mucama') ? 'block' : 'none';

    // Renderizar datos de la pestaña
    if (tabName === 'jefa') this.renderJefaView();
    if (tabName === 'mucama') this.renderMucamaView();
  },

  /**
   * TAB 1: VISTA JEFA DE LIMPIEZA / GOBERNANTA
   * - Orden estricto de prioridades (1, 2, 3)
   * - Si la habitación ya tiene tarea asignada: Botón "Editar Tarea"
   * - Si NO tiene tarea asignada: Botón "Asignar Tarea"
   * - Muestra estado y el Historial de Limpiezas Realizadas (Tarea 7)
   */
  renderJefaView() {
    const tbody = document.getElementById('hk-jefa-table-body');
    if (!tbody) return;

    if (!this.currentRooms || this.currentRooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Sincronizando inventario de habitaciones...</td></tr>';
      return;
    }

    const orders = this.getOrders();

    // Ordenar habitaciones: primero las con órdenes asignadas por prioridad (1, 2, 3) y luego el resto
    const sortedRooms = [...this.currentRooms].sort((a, b) => {
      const orderA = orders[String(a.id)];
      const orderB = orders[String(b.id)];

      const prioA = orderA ? orderA.priority : (a.estado === 'Sucia' ? 2 : (a.estado === 'En limpieza' ? 2 : 99));
      const prioB = orderB ? orderB.priority : (b.estado === 'Sucia' ? 2 : (b.estado === 'En limpieza' ? 2 : 99));

      return prioA - prioB;
    });

    let html = '';
    sortedRooms.forEach(room => {
      const tipo = room.tipos_habitacion || {};
      const order = orders[String(room.id)] || null;

      // Cálculo de Estado Efectivo para garantizar consistencia visual absoluta
      let effectiveStatus = room.estado;
      if (order && (order.priority === 1 || order.priority === 2) && room.estado === 'Disponible') {
        effectiveStatus = (order.status === 'En limpieza') ? 'En limpieza' : 'Sucia';
      } else if (order && order.priority === 3 && room.estado === 'Disponible') {
        effectiveStatus = 'Ocupada';
      }
      const statusClass = (effectiveStatus || '').toLowerCase().replace(/\s+/g, '-');

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
            <span class="badge badge-${statusClass}">${sanitizeInput(effectiveStatus)}</span>
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
              ${order ? `
                <button class="btn-action btn-action-edit" onclick="HousekeepingModule.openDispatchModal(${room.id}, true)" title="Editar o Reasignar Tarea de Limpieza">
                  <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-action" style="color: #DC2626; border-color: #FCA5A5; background: #FEF2F2;" onclick="HousekeepingModule.cancelDispatchOrder(${room.id})" title="Cancelar o Desasignar Orden">
                  <i class="fas fa-trash-alt"></i>
                </button>
              ` : `
                <button class="btn-action btn-action-reserve" onclick="HousekeepingModule.openDispatchModal(${room.id}, false)" title="Asignar Nueva Tarea a Mucama">
                  <i class="fas fa-plus"></i> Asignar Tarea
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    this.renderCleaningHistory();
  },

  /**
   * TAB 2: VISTA MUCAMA / ASISTENTE DE LIMPIEZA (Tarea 7)
   * - Tareas estrictamente separadas por usuario (Usuario 1 NO ve las de Usuario 2)
   * - La Jefa de limpieza solo visualiza en modo supervisión (no puede realizar acciones en el panel)
   */
  renderMucamaView() {
    const container = document.getElementById('hk-mucama-grid');
    if (!container) return;

    const currentRole = (typeof AppState !== 'undefined' && AppState.currentRole) ? AppState.currentRole : 'administrador';
    const currentUser = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : null;
    const isMucama = (currentRole === 'mucama');
    const isJefa = (currentRole === 'gobernanta');
    const orders = this.getOrders();

    let assignedList = [];

    if (isMucama) {
      // La mucama SOLO puede ver las habitaciones asignadas a su propio usuario (Aislamiento RBAC estricto)
      const myName = (currentUser && currentUser.name) ? currentUser.name : (currentUser?.username || 'Rosa Almada');
      const myFirstName = myName.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');

      assignedList = this.currentRooms.filter(room => {
        const ord = orders[String(room.id)];
        if (!ord) return false;
        const ordMaidFirst = (ord.maid || '').toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
        return ordMaidFirst === myFirstName;
      });
    } else {
      // Jefa o Administrador pueden filtrar o ver todas las habitaciones en supervisión
      const filterMaid = document.getElementById('filter-mucama-select')?.value || 'ALL';
      assignedList = this.currentRooms.filter(room => {
        const ord = orders[String(room.id)];
        if (filterMaid === 'ALL') return true;
        if (!ord) return false;
        return (ord.maid || '').toLowerCase().includes(filterMaid.toLowerCase());
      });
    }

    // Ordenar por prioridad
    assignedList.sort((a, b) => {
      const prioA = orders[String(a.id)]?.priority || (a.estado === 'Sucia' ? 2 : (a.estado === 'Ocupada' ? 3 : 2));
      const prioB = orders[String(b.id)]?.priority || (b.estado === 'Sucia' ? 2 : (b.estado === 'Ocupada' ? 3 : 2));
      return prioA - prioB;
    });

    if (assignedList.length === 0) {
      const emptyMsg = isMucama
        ? 'No tienes habitaciones asignadas para tu turno en este momento.'
        : 'No hay habitaciones bajo el filtro seleccionado.';

      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: #F8FAFC; border-radius: 14px; border: 1px dashed #CBD5E1;">
          <i class="fas fa-clipboard-check" style="font-size: 40px; color: #10B981; margin-bottom: 12px; display: block;"></i>
          <h4 style="color: var(--primary-navy); margin: 0 0 6px 0; font-size: 17px;">¡Turno al día!</h4>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">${emptyMsg}</p>
        </div>
      `;
      return;
    }

    let html = '';
    assignedList.forEach(room => {
      const tipo = room.tipos_habitacion || {};
      let ord = orders[String(room.id)];
      if (!ord) {
        ord = {
          priority: room.estado === 'Sucia' ? 2 : (room.estado === 'Ocupada' ? 3 : 2),
          maid: 'Supervisión Administrador',
          notes: 'Preparación y verificación de protocolo',
          status: room.estado === 'En limpieza' ? 'En limpieza' : (room.estado === 'Sucia' ? 'Pendiente' : 'Listo'),
          assignedAt: 'Hoy'
        };
      }
      
      let effectiveStatus = room.estado;
      if (ord && (ord.priority === 1 || ord.priority === 2) && room.estado === 'Disponible') {
        effectiveStatus = (ord.status === 'En limpieza') ? 'En limpieza' : 'Sucia';
      } else if (ord && ord.priority === 3 && room.estado === 'Disponible') {
        effectiveStatus = 'Ocupada';
      }
      const statusClass = (effectiveStatus || '').toLowerCase().replace(/\s+/g, '-');

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
            <span class="badge badge-${statusClass}">${sanitizeInput(effectiveStatus)}</span>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 12.5px;">
            <div style="font-weight: 600; color: #1E293B; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-user-check" style="color: var(--accent-gold);"></i> Asignada a: <span>${sanitizeInput(ord.maid)}</span>
            </div>
            <div style="color: #64748B; font-size: 12px; line-height: 1.4;">
              <i class="fas fa-clipboard"></i> <strong>Instrucciones:</strong> ${sanitizeInput(ord.notes || 'Limpieza y reposición estándar')}
            </div>
          </div>

          ${isJefa ? `
            <!-- Modo Supervisión Jefa de Limpieza: solo visualización de estado, sin ejecutar checklist -->
            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: #1E40AF; display: flex; align-items: center; gap: 6px; margin-top: auto;">
              <i class="fas fa-eye" style="color: #2563EB;"></i>
              <span><strong>Supervisión Jefa:</strong> Acción exclusiva de la mucama asignada (${sanitizeInput(ord.maid)}).</span>
            </div>
          ` : `
            <div style="display: flex; gap: 8px; margin-top: auto;">
              <button class="btn btn-sm btn-gold" style="flex: 2; padding: 8px 12px; font-weight: 600;" onclick="HousekeepingModule.openCleaningChecklist(${room.id})">
                <i class="fas fa-clipboard-check"></i> Abrir Checklist
              </button>
              <button class="btn btn-sm btn-outline" style="flex: 1; padding: 8px; color: #D97706; border-color: #FCD34D;" onclick="HousekeepingModule.openIncidentModal(${room.numero})" title="Reportar avería o faltante con foto">
                <i class="fas fa-camera"></i> Incidencia
              </button>
            </div>
          `}
        </div>
      `;
    });

    container.innerHTML = html;
  },

  /**
   * TAB 3: MATRIZ DE CONTROL DE LLAVES FÍSICAS & TARJETAS RFID
   * - Control detallado de despacho, horarios de salida, poseedor actual y bitácora de custodia
   */
  async renderKeysMatrix() {
    const container = document.getElementById('hk-keys-grid');
    if (!container) return;

    if (!this.currentRooms || this.currentRooms.length === 0) {
      try {
        const { data } = await supabaseClient
          .from('habitaciones')
          .select('*, tipos_habitacion(*)')
          .order('numero', { ascending: true });
        this.currentRooms = data || [];
      } catch (_) {}
    }

    const keys = this.getKeys();
    let html = '';

    this.currentRooms.forEach(room => {
      const num = String(room.numero);
      const keyInfo = keys[num] || {
        status: (room.estado === 'Ocupada' ? 'Entregada a Huésped' : (room.estado === 'En limpieza' ? 'En Servicio Mucama' : 'En Recepción')),
        rfid: `RFID-${num}-A`,
        location: `Casillero ${num} Front Desk`,
        holder: (room.estado === 'Ocupada' ? 'Huésped Titular' : 'Recepción Mostrador'),
        checkoutTime: '-',
        returnTime: 'Hoy 10:30',
        notes: 'Llavero oficial UTCD',
        history: []
      };

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
        <div class="key-card" style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
              <div style="width: 44px; height: 44px; border-radius: 10px; background: ${statusBg}; color: ${statusColor}; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                <i class="fas ${icon}"></i>
              </div>
              <span class="badge" style="background: ${statusBg}; color: ${statusColor}; font-size: 11px; font-weight: 700; border: 1px solid ${statusColor}33; padding: 4px 10px; text-align: right; white-space: nowrap;">
                ${keyInfo.status}
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; flex-wrap: wrap; gap: 4px;">
              <h4 style="font-size: 20px; color: var(--primary-navy); margin: 0; font-weight: 800; font-family: var(--font-heading);">
                Habitación ${sanitizeInput(room.numero)}
              </h4>
              <span style="font-family: monospace; font-size: 11px; color: var(--text-muted); font-weight: 600; background: #F1F5F9; padding: 2px 6px; border-radius: 4px; border: 1px solid #E2E8F0;">
                <i class="fas fa-barcode"></i> ${keyInfo.rfid}
              </span>
            </div>

            <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 14px 0;">
              ${sanitizeInput(room.tipos_habitacion?.nombre || 'Habitación')} • Piso ${room.piso || 1}
            </p>

            <!-- Bloque de Custodia y Ubicación Limpio y Espacioso -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; margin-bottom: 4px; text-align: left; display: flex; flex-direction: column; gap: 10px;">
              <div style="border-bottom: 1px solid #EEF2F6; padding-bottom: 8px;">
                <div style="color: #64748B; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">
                  <i class="fas fa-box" style="color: var(--primary-blue); margin-right: 4px;"></i> Ubicación / Despacho
                </div>
                <div style="color: #1E293B; font-weight: 700; font-size: 13px; line-height: 1.3;">
                  ${sanitizeInput(keyInfo.location || `Casillero ${num} Front Desk`)}
                </div>
              </div>

              <div style="border-bottom: 1px solid #EEF2F6; padding-bottom: 8px;">
                <div style="color: #64748B; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">
                  <i class="fas fa-user-check" style="color: var(--accent-gold); margin-right: 4px;"></i> Custodio Actual
                </div>
                <div style="color: #1E293B; font-weight: 700; font-size: 13px; line-height: 1.3;">
                  ${sanitizeInput(keyInfo.holder || 'Recepción Mostrador')}
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 2px;">
                <div>
                  <div style="color: #64748B; font-size: 10.5px; font-weight: 600; text-transform: uppercase; margin-bottom: 1px;">
                    <i class="fas fa-sign-out-alt" style="color: #3B82F6; margin-right: 3px;"></i> Salida
                  </div>
                  <div style="color: #334155; font-weight: 600; font-size: 12px;">
                    ${sanitizeInput(keyInfo.checkoutTime || '-')}
                  </div>
                </div>
                <div>
                  <div style="color: #64748B; font-size: 10.5px; font-weight: 600; text-transform: uppercase; margin-bottom: 1px;">
                    <i class="fas fa-undo-alt" style="color: #10B981; margin-right: 3px;"></i> Retorno Est.
                  </div>
                  <div style="color: #334155; font-weight: 600; font-size: 12px;">
                    ${sanitizeInput(keyInfo.returnTime || '-')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button class="btn btn-outline btn-sm" onclick="HousekeepingModule.openKeyDetailsModal('${num}')" style="width: 100%; border-color: #CBD5E1; font-weight: 600; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
            <i class="fas fa-key" style="color: var(--primary-blue);"></i> Gestionar Despacho & Custodia
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  openKeyDetailsModal(roomNum) {
    const keys = this.getKeys();
    const room = this.currentRooms.find(r => String(r.numero) === String(roomNum));
    const keyInfo = keys[String(roomNum)] || {
      status: 'En Recepción',
      rfid: `RFID-${roomNum}-A`,
      location: `Casillero ${roomNum} Front Desk`,
      holder: 'Recepción Mostrador',
      checkoutTime: '-',
      returnTime: 'Hoy 10:30',
      notes: 'Llavero oficial UTCD',
      history: []
    };

    document.getElementById('key-modal-room-number').value = roomNum;
    document.getElementById('key-modal-room-id').value = room ? room.id : '';
    document.getElementById('key-modal-room-display').innerText = roomNum;
    document.getElementById('key-modal-rfid-display').innerHTML = `<i class="fas fa-barcode"></i> ${keyInfo.rfid}`;
    document.getElementById('key-modal-locker-display').innerText = keyInfo.location || `Casillero ${roomNum}`;

    document.getElementById('key-modal-status').value = keyInfo.status;
    document.getElementById('key-modal-holder').value = keyInfo.holder;
    document.getElementById('key-modal-location').value = keyInfo.location || `Casillero ${roomNum} Front Desk`;
    document.getElementById('key-modal-checkout-time').value = keyInfo.checkoutTime || '-';
    document.getElementById('key-modal-return-time').value = keyInfo.returnTime || '-';
    document.getElementById('key-modal-notes').value = keyInfo.notes || '';

    // Historial
    const historyList = document.getElementById('key-modal-history-list');
    if (historyList) {
      const hist = keyInfo.history || [];
      if (hist.length > 0) {
        historyList.innerHTML = hist.map(h => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #E2E8F0;">
            <div>
              <strong>${sanitizeInput(h.status)}</strong> (${sanitizeInput(h.holder || 'Recepción')})
              <small style="color: var(--text-muted); display: block;">${sanitizeInput(h.action || 'Cambio de custodia')}</small>
            </div>
            <span style="font-size: 10.5px; color: #64748B;">${sanitizeInput(h.time)}</span>
          </div>
        `).join('');
      } else {
        historyList.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Sin movimientos previos registrados en bitácora.</span>';
      }
    }

    openModal('modal-key-dispatch');
  },

  onKeyStatusChange(newStatus) {
    const holderInput = document.getElementById('key-modal-holder');
    const timeInput = document.getElementById('key-modal-checkout-time');
    const nowStr = 'Hoy ' + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    if (newStatus === 'En Recepción') {
      if (holderInput) holderInput.value = 'Recepción Mostrador';
    } else if (newStatus === 'Entregada a Huésped') {
      if (holderInput && holderInput.value === 'Recepción Mostrador') holderInput.value = 'Huésped Titular';
      if (timeInput) timeInput.value = nowStr;
    } else if (newStatus === 'En Servicio Mucama') {
      if (holderInput) holderInput.value = 'Rosa Almada (Mucama)';
      if (timeInput) timeInput.value = nowStr;
    } else if (newStatus === 'En Mantenimiento') {
      if (holderInput) holderInput.value = 'Técnico Mario Gómez';
      if (timeInput) timeInput.value = nowStr;
    } else if (newStatus === 'Extraviada') {
      if (holderInput) holderInput.value = 'Bloqueada por Seguridad';
    }
  },

  setKeyTimeNow(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
      el.value = 'Hoy ' + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
    }
  },

  saveKeyDispatchDetails() {
    const roomNum = document.getElementById('key-modal-room-number').value;
    if (!roomNum) return;

    const status = document.getElementById('key-modal-status').value;
    const holder = document.getElementById('key-modal-holder').value || 'Recepción Mostrador';
    const location = document.getElementById('key-modal-location').value || `Casillero ${roomNum} Front Desk`;
    const checkoutTime = document.getElementById('key-modal-checkout-time').value || '-';
    const returnTime = document.getElementById('key-modal-return-time').value || '-';
    const notes = document.getElementById('key-modal-notes').value || '';

    const keys = this.getKeys();
    const prevKey = keys[roomNum] || {};
    const prevHistory = prevKey.history || [];

    const currentUser = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : null;
    const recordedBy = currentUser ? currentUser.name : 'Personal Front Desk';
    const nowTimestamp = 'Hoy ' + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    const newHistory = [
      {
        time: nowTimestamp,
        status: status,
        holder: holder,
        action: `Actualización despacho: ${location} por ${recordedBy}`
      },
      ...prevHistory
    ].slice(0, 10);

    keys[roomNum] = {
      ...prevKey,
      rfid: prevKey.rfid || `RFID-${roomNum}-A`,
      status: status,
      holder: holder,
      location: location,
      checkoutTime: checkoutTime,
      returnTime: returnTime,
      notes: notes,
      history: newHistory,
      lastMoved: nowTimestamp
    };

    this.saveKeys(keys);
    closeModal('modal-key-dispatch');
    showToast(`Custodia de llave Habitación ${roomNum} actualizada con éxito (${status})`, 'success');
    this.renderKeysMatrix();
  },

  changeKeyStatus(roomNum, newStatus, customHolder, actionNote) {
    const keys = this.getKeys();
    const prevKey = keys[roomNum] || {};
    const prevHistory = prevKey.history || [];
    let holder = customHolder || "Recepción Mostrador";

    if (!customHolder) {
      if (newStatus === "Entregada a Huésped") holder = "Huésped Titular";
      else if (newStatus === "En Servicio Mucama") holder = "Mucama de Turno";
      else if (newStatus === "En Mantenimiento") holder = "Técnico Especialista";
      else if (newStatus === "Extraviada") holder = "Bloqueada por Seguridad";
    }

    const nowTimestamp = "Hoy " + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    const newHistory = [
      {
        time: nowTimestamp,
        status: newStatus,
        holder: holder,
        action: actionNote || `Cambio automático de custodia a ${newStatus}`
      },
      ...prevHistory
    ].slice(0, 10);

    keys[roomNum] = {
      ...prevKey,
      rfid: prevKey.rfid || `RFID-${roomNum}-A`,
      status: newStatus,
      holder: holder,
      location: newStatus === 'En Recepción' ? `Casillero ${roomNum} Front Desk` : (newStatus === 'Entregada a Huésped' ? 'En Posesión del Huésped' : (prevKey.location || 'Despacho')),
      checkoutTime: newStatus === 'Entregada a Huésped' ? nowTimestamp : (prevKey.checkoutTime || '-'),
      returnTime: newStatus === 'En Recepción' ? nowTimestamp : (prevKey.returnTime || '-'),
      history: newHistory,
      lastMoved: nowTimestamp
    };

    this.saveKeys(keys);
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
   * MODAL DESPACHO / EDICIÓN DE ORDEN DE LIMPIEZA
   */
  openDispatchModal(roomId, isEditing = false) {
    const orders = this.getOrders();
    const editingIdInput = document.getElementById('dispatch-editing-room-id');
    const titleEl = document.getElementById('dispatch-modal-title');
    const subtitleEl = document.getElementById('dispatch-modal-subtitle');
    const btnSubmit = document.getElementById('btn-confirm-dispatch-order');
    const btnDelete = document.getElementById('btn-delete-dispatch-order');
    const roomSelect = document.getElementById('dispatch-room-select');
    const prioSelect = document.getElementById('dispatch-priority-select');
    const maidSelect = document.getElementById('dispatch-maid-select');
    const notesInput = document.getElementById('dispatch-notes');

    if (btnDelete) {
      btnDelete.style.display = (isEditing && roomId && orders[String(roomId)]) ? 'inline-flex' : 'none';
    }

    if (isEditing && roomId && orders[String(roomId)]) {
      // MODO EDICIÓN DE TAREA EXISTENTE
      const order = orders[String(roomId)];
      const room = this.currentRooms.find(r => String(r.id) === String(roomId));
      const roomNum = room ? room.numero : roomId;

      if (editingIdInput) editingIdInput.value = String(roomId);
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-edit" style="color: var(--primary-blue);"></i> Editar Tarea de Limpieza - Hab. ${roomNum}`;
      if (subtitleEl) subtitleEl.innerText = `Modifique prioridad, mucama o instrucciones para Habitación ${roomNum}`;
      if (btnSubmit) btnSubmit.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios de Tarea';

      if (roomSelect) {
        roomSelect.innerHTML = `<option value="${roomId}" selected>Habitación ${roomNum} (${room?.tipos_habitacion?.nombre || 'Habitación'})</option>`;
        roomSelect.disabled = true;
      }

      if (prioSelect) prioSelect.value = String(order.priority || 2);
      if (maidSelect) maidSelect.value = order.maid || 'Rosa Almada';
      if (notesInput) notesInput.value = order.notes || '';

    } else {
      // MODO ASIGNACIÓN NUEVA
      if (editingIdInput) editingIdInput.value = '';
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-clipboard-list" style="color: var(--primary-navy);"></i> Asignar Tarea de Limpieza`;
      if (subtitleEl) subtitleEl.innerText = 'Seleccione una habitación y asigne mucama y prioridad de atención';
      if (btnSubmit) btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Emitir Orden a Mucama';

      if (roomSelect) {
        roomSelect.disabled = false;
        let optionsHtml = '';
        let firstAvailableId = null;

        this.currentRooms.forEach(r => {
          const ord = orders[String(r.id)];
          const isSelected = roomId ? (String(r.id) === String(roomId)) : false;
          if (!firstAvailableId) firstAvailableId = r.id;

          if (ord) {
            optionsHtml += `<option value="${r.id}" ${isSelected ? 'selected' : ''}>Habitación ${r.numero} (Asignada a ${ord.maid} - P${ord.priority}) • ${r.estado}</option>`;
          } else {
            optionsHtml += `<option value="${r.id}" ${isSelected ? 'selected' : ''}>Habitación ${r.numero} (${r.tipos_habitacion?.nombre || 'Habitación'}) • ${r.estado}</option>`;
          }
        });

        roomSelect.innerHTML = optionsHtml;
        if (roomId) roomSelect.value = String(roomId);
        else if (firstAvailableId) roomSelect.value = String(firstAvailableId);
      }

      if (prioSelect) prioSelect.value = '2';
      if (maidSelect) maidSelect.value = 'Rosa Almada';
      if (notesInput) notesInput.value = '';
    }

    openModal('modal-dispatch-cleaning');
  },

  async confirmDispatchOrder() {
    const editingIdInput = document.getElementById('dispatch-editing-room-id');
    const isEditing = editingIdInput && editingIdInput.value !== '';
    const roomId = isEditing ? editingIdInput.value : document.getElementById('dispatch-room-select').value;
    const priority = parseInt(document.getElementById('dispatch-priority-select').value || '2', 10);
    const maid = document.getElementById('dispatch-maid-select').value;
    const notes = document.getElementById('dispatch-notes').value || 'Limpieza y preparación asignada';

    if (!roomId) {
      showToast('Por favor seleccione una habitación para despachar la orden.', 'warning');
      return;
    }

    const orders = this.getOrders();
    const prevOrder = orders[String(roomId)] || {};

    orders[String(roomId)] = {
      priority: priority,
      maid: maid,
      notes: notes,
      status: prevOrder.status || 'Pendiente',
      assignedAt: prevOrder.assignedAt || new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
    };

    this.saveOrders(orders);

    const roomObj = this.currentRooms.find(r => String(r.id) === String(roomId));
    const roomNum = roomObj ? roomObj.numero : roomId;

    // 1. Actualizar estado y observaciones en habitaciones
    try {
      const newStatus = (priority === 1 || priority === 2) ? (roomObj?.estado === 'Disponible' ? 'Sucia' : roomObj?.estado || 'Sucia') : roomObj?.estado;
      await supabaseClient
        .from('habitaciones')
        .update({
          estado: newStatus,
          observaciones: `Orden P${priority} asignada a ${maid}: ${notes}`
        })
        .eq('id', roomId);
    } catch (e) {
      console.warn('Skip supabase sync on order dispatch:', e);
    }

    // 2. Sincronizar en tareas_limpieza (garantizar máxima 1 orden activa por habitación)
    try {
      await supabaseClient
        .from('tareas_limpieza')
        .delete()
        .eq('habitacion_id', Number(roomId))
        .neq('estado', 'Finalizada');

      await supabaseClient
        .from('tareas_limpieza')
        .insert({
          habitacion_id: Number(roomId),
          tipo_tarea: priority === 3 ? 'Limpieza Diaria' : 'Limpieza Check-out',
          estado: 'Pendiente',
          notas: `[P${priority}] Asignada a ${maid}: ${notes}`,
          checklist: {
            priority: priority,
            maid: maid,
            notes: notes,
            assignedAt: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
          }
        });
    } catch (dbErr) {
      console.warn('tareas_limpieza sync error:', dbErr);
    }

    if (editingIdInput) editingIdInput.value = '';
    closeModal('modal-dispatch-cleaning');

    if (isEditing) {
      showToast(`¡Tarea de Habitación ${roomNum} actualizada con éxito!`, 'success');
    } else {
      showToast(`¡Orden de limpieza de Habitación ${roomNum} emitida a ${maid} (P${priority})!`, 'success');
    }

    await this.loadHousekeepingBoard();
    if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
  },

  async cancelDispatchOrder(roomId) {
    if (!roomId) {
      const editingIdInput = document.getElementById('dispatch-editing-room-id');
      roomId = editingIdInput ? editingIdInput.value : null;
    }
    if (!roomId) return;

    const roomObj = this.currentRooms.find(r => String(r.id) === String(roomId));
    const roomNum = roomObj ? roomObj.numero : roomId;

    const confirmed = await CustomDialog.confirm({
      title: 'Cancelar Orden de Limpieza',
      message: `¿Desea desasignar y eliminar la orden de limpieza de la Habitación ${roomNum}? La habitación volverá a quedar sin asignar.`,
      icon: 'trash-alt',
      confirmText: 'Sí, desasignar',
      cancelText: 'Volver'
    });

    if (!confirmed) return;

    const orders = this.getOrders();
    delete orders[String(roomId)];
    this.saveOrders(orders);

    // Cancelar en Supabase tareas_limpieza y limpiar observaciones
    try {
      await supabaseClient
        .from('tareas_limpieza')
        .delete()
        .eq('habitacion_id', Number(roomId))
        .neq('estado', 'Finalizada');

      await supabaseClient
        .from('habitaciones')
        .update({
          observaciones: 'Orden de limpieza cancelada. Sin asignar.'
        })
        .eq('id', roomId);
    } catch (e) {
      console.warn('cancelDispatchOrder db skip:', e);
    }

    const editingIdInput = document.getElementById('dispatch-editing-room-id');
    if (editingIdInput) editingIdInput.value = '';
    closeModal('modal-dispatch-cleaning');

    showToast(`Orden de Habitación ${roomNum} desasignada y removida con éxito.`, 'info');
    await this.loadHousekeepingBoard();
    if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
  },

  /**
   * MODAL REGISTRO DE INCIDENCIA CON FOTO
   */
  openIncidentModal(roomNumber) {
    if (roomNumber) {
      const sel = document.getElementById('incident-room-select');
      if (sel) sel.value = String(roomNumber);
    }

    const currentUser = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : null;
    const reporterInput = document.getElementById('incident-reporter');
    if (reporterInput) {
      reporterInput.value = (currentUser && currentUser.name) ? currentUser.name : (currentUser?.username || 'Rosa Almada (Mucama)');
      reporterInput.readOnly = true;
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
          titulo: `Incidencia técnica Habitación ${roomNumber}`,
          descripcion: `[Reporte ${reporter}]: ${description}`,
          prioridad: 'Alta',
          costo_reparacion: 0,
          estado: 'Pendiente'
        });
        if (typeof MaintenanceModule !== 'undefined' && MaintenanceModule.loadOrders) {
          MaintenanceModule.loadOrders();
        }
      } catch (e) {
        console.warn('Mantenimiento auto-insert skip:', e);
      }
    }

    closeModal('modal-incident-report');
    this.clearIncidentPhoto();

    showToast(`¡Incidencia de Habitación ${roomNumber} registrada y derivada con éxito!`, 'success');
  },

  /**
   * CHECKLIST DE 5 ÁREAS (MUCAMAS)
   * - Nombre de la mucama fijado en readonly por seguridad y autoría
   */
  openCleaningChecklist(roomId) {
    const currentRole = (typeof AppState !== 'undefined' && AppState.currentRole) ? AppState.currentRole : 'admin';
    if (currentRole === 'gobernanta' && currentRole !== 'admin' && currentRole !== 'administrador') {
      showToast('Acceso restringido: La Jefa de Limpieza supervisa el progreso pero no realiza acciones dentro del panel de mucamas.', 'warning');
      return;
    }

    const room = this.currentRooms.find(r => String(r.id) === String(roomId));
    if (!room) return;

    this.selectedRoom = room;

    const orders = this.getOrders();
    const order = orders[String(room.id)] || { priority: 2, maid: 'Rosa Almada (Mucama)' };
    const currentUser = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : null;

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

    // Nombre de la mucama FIJADO / READONLY para evitar acusaciones falsas
    const cleanerInput = document.getElementById('hk-cleaner-name');
    if (cleanerInput) {
      const assignedName = order.maid || ((currentUser && currentUser.name) ? currentUser.name : 'Rosa Almada (Mucama)');
      cleanerInput.value = assignedName;
      cleanerInput.readOnly = true;
      cleanerInput.style.background = '#F1F5F9';
      cleanerInput.style.color = '#475569';
      cleanerInput.style.cursor = 'not-allowed';
    }

    // Generación dinámica del Checklist según las especificaciones de la habitación
    const container = document.getElementById('hk-dynamic-checklist-container');
    if (container) {
      const items = this.buildDynamicChecklist(room);
      container.innerHTML = items.map((item, idx) => `
        <div class="checklist-item" style="display: flex; align-items: flex-start; gap: 10px; background: #FFFFFF; padding: 10px 12px; border-radius: 8px; border: 1px solid #E2E8F0; transition: background 0.2s;">
          <input type="checkbox" id="${item.id}" class="hk-dynamic-chk" onchange="HousekeepingModule.updateChecklistProgress()" style="width: 18px; height: 18px; margin-top: 2px; accent-color: #10B981; cursor: pointer;">
          <label for="${item.id}" style="cursor: pointer; margin: 0; flex: 1;">
            <strong style="font-size: 13px; color: var(--primary-navy); display: flex; align-items: center; gap: 6px;">
              <i class="fas ${item.icon}" style="color: ${item.color}; width: 16px; text-align: center;"></i> ${item.title}
            </strong>
            <span style="font-size: 11.5px; color: #64748B; display: block; margin-top: 2px; line-height: 1.3;">
              ${item.desc}
            </span>
          </label>
        </div>
      `).join('');
      this.updateChecklistProgress();
    }

    document.getElementById('hk-observations').value = '';
    openModal('modal-housekeeping');
  },

  buildDynamicChecklist(room) {
    const c = room.caracteristicas || {};
    const camas = c.camas || 'Camas preparadas';

    const items = [
      {
        id: 'chk-cama',
        icon: 'fa-bed',
        color: '#2563EB',
        title: `1. Dormitorio & Lencería (${camas})`,
        desc: 'Sábanas blancas higienizadas sin arrugas, almohadas perfumadas y protectores limpios.'
      },
      {
        id: 'chk-bano',
        icon: 'fa-bath',
        color: '#0D9488',
        title: '2. Baño Completo & Sanitarios',
        desc: 'Inodoro y grifería desinfectados con precinto higiénico, mampara seca y juego de toallas blancas (cuerpo, mano y pie).'
      }
    ];

    if (c.jacuzzi) {
      items.push({
        id: 'chk-jacuzzi',
        icon: 'fa-hot-tub',
        color: '#7C3AED',
        title: '3. Jacuzzi / Hidromasaje Privado',
        desc: 'Desinfección profunda de tina y boquillas de hidromasaje con precinto de sanitización higiénica.'
      });
    }

    if (c.ac !== false) {
      items.push({
        id: 'chk-ac',
        icon: 'fa-snowflake',
        color: '#0284C7',
        title: '4. Climatización Split A/C',
        desc: 'Filtros limpios de polvo, prueba de enfriamiento a 24°C, control remoto desinfectado con baterías operativas.'
      });
    }

    if (c.minibar) {
      items.push({
        id: 'chk-minibar',
        icon: 'fa-cocktail',
        color: '#D97706',
        title: '5. Frigobar & Minibar',
        desc: 'Control de frío, inventario de bebidas/snacks consumidos anotados para el folio y precinto de frescura.'
      });
    }

    if (c.balcon) {
      items.push({
        id: 'chk-balcon',
        icon: 'fa-sun',
        color: '#EA580C',
        title: '6. Balcón Exterior & Ventanal Corredizo',
        desc: 'Suelo barrido, barandas higienizadas y cristales del ventanal corredizo transparentes y sin marcas.'
      });
    }

    if (c.tv !== false) {
      items.push({
        id: 'chk-tv',
        icon: 'fa-tv',
        color: '#4F46E5',
        title: '7. Smart TV & Multimedia',
        desc: 'Pantalla libre de huellas y polvo, control remoto desinfectado en funda y sintonización activa.'
      });
    }

    if (c.caja_fuerte) {
      items.push({
        id: 'chk-caja',
        icon: 'fa-lock',
        color: '#059669',
        title: '8. Caja Fuerte Electrónica',
        desc: 'Puerta abierta y reseteada lista con código en blanco para el nuevo huésped.'
      });
    }

    if (c.pava_electrica || c.room_service) {
      items.push({
        id: 'chk-pava',
        icon: 'fa-mug-hot',
        color: '#B45309',
        title: '9. Set de Cafetería & Pava Eléctrica',
        desc: 'Pava eléctrica limpia y sin sarro, tazas y cucharas higienizadas, reposición de café y té.'
      });
    }

    items.push({
      id: 'chk-inspeccion',
      icon: 'fa-spray-can',
      color: '#16A34A',
      title: '10. Inspección Final & Aromatización',
      desc: 'Piso aspirado/fregado, cortinas alineadas y aromatizante ambiental institucional de cortesía aplicado.'
    });

    return items;
  },

  updateChecklistProgress() {
    const chks = Array.from(document.querySelectorAll('.hk-dynamic-chk'));
    const checked = chks.filter(c => c.checked).length;
    const total = chks.length;
    const counter = document.getElementById('hk-checklist-counter');
    if (counter) {
      counter.innerText = `${checked} / ${total} verificados`;
      counter.style.background = (checked === total && total > 0) ? '#DCFCE7' : '#E0F2FE';
      counter.style.color = (checked === total && total > 0) ? '#166534' : '#0369A1';
    }
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

      // Actualizar estado en orden local si existe
      const orders = this.getOrders();
      if (orders[String(this.selectedRoom.id)]) {
        orders[String(this.selectedRoom.id)].status = 'En limpieza';
        this.saveOrders(orders);
      }

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

    const chks = Array.from(document.querySelectorAll('.hk-dynamic-chk'));
    const checkedCount = chks.filter(c => c.checked).length;
    const totalCount = chks.length;
    const obs = document.getElementById('hk-observations')?.value || '';
    const cleaner = document.getElementById('hk-cleaner-name')?.value || 'Rosa Almada';

    if (checkedCount < totalCount) {
      showToast(`Debe verificar y marcar todos los ${totalCount} puntos del protocolo antes de liberar la habitación (${checkedCount}/${totalCount} completados)`, 'warning');
      return;
    }

    try {
      // 1. Liberar habitación a 'Disponible'
      const { error: roomErr } = await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'Disponible',
          observaciones: `Habitación limpia, inspeccionada al 100% (${totalCount}/${totalCount}) y lista para venta.`
        })
        .eq('id', this.selectedRoom.id);

      if (roomErr) throw roomErr;

      // 2. Remover orden de tareas activas
      const orders = this.getOrders();
      delete orders[String(this.selectedRoom.id)];
      this.saveOrders(orders);

      // 3. Regresar custodia de llave a Recepción
      this.changeKeyStatus(String(this.selectedRoom.numero), 'En Recepción');

      // 4. Registro de auditoría y finalización en tareas_limpieza
      try {
        await supabaseClient
          .from('tareas_limpieza')
          .update({
            estado: 'Finalizada',
            fecha_finalizacion: new Date().toISOString(),
            notas: `[Checklist ${totalCount}/${totalCount} por ${cleaner}]: ${obs || 'Inspección de calidad aprobada'}`
          })
          .eq('habitacion_id', Number(this.selectedRoom.id))
          .neq('estado', 'Finalizada');
      } catch (e) {
        console.warn('Skip tareas_limpieza update:', e);
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
