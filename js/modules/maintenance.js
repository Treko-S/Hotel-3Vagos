/**
 * Maintenance & Technical Incident Management Module - Hotel 3 Vagos
 * AC, Plumbing, Electrical & Infrastructure work orders with Cash Drawer Linkage
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
          <td><strong style="color: ${cost > 0 ? 'var(--primary-navy)' : 'var(--text-muted)'};">${formatGs(cost)}</strong></td>
          <td>
            <div class="action-btn-group">
              ${isPending ? `
                <button class="btn-action btn-action-reserve" onclick="MaintenanceModule.resolveOrder('${ord.id}', '${roomNum}')" title="Liquidar costo y resolver mantenimiento">
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

  resolveOrder(orderId, roomNum) {
    this.openResolveModal(orderId, roomNum);
  },

  openResolveModal(orderId, roomNum) {
    const ord = this.orders.find(o => String(o.id) === String(orderId)) || {};
    const roomId = ord.habitacion_id || ord.habitaciones?.id || (isNaN(Number(roomNum)) ? 1 : Number(roomNum));

    const orderIdInput = document.getElementById('maint-resolve-order-id');
    const roomIdInput = document.getElementById('maint-resolve-room-id');
    const roomNumInput = document.getElementById('maint-resolve-room-num');

    if (orderIdInput) orderIdInput.value = orderId;
    if (roomIdInput) roomIdInput.value = roomId;
    if (roomNumInput) roomNumInput.value = roomNum;

    const shortId = typeof orderId === 'string' && orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId;
    const subEl = document.getElementById('maint-resolve-subtitle');
    const roomEl = document.getElementById('maint-resolve-info-room');
    const descEl = document.getElementById('maint-resolve-info-desc');
    const prioEl = document.getElementById('maint-resolve-info-priority');

    if (subEl) subEl.innerText = `Liquidación técnica & costeo de Orden #MNT-${shortId}`;
    if (roomEl) roomEl.innerText = `Habitación ${roomNum}`;
    if (descEl) descEl.innerText = ord.titulo || ord.descripcion || 'Incidencia técnica de infraestructura';

    if (prioEl) {
      prioEl.innerText = ord.prioridad || 'Media';
      prioEl.className = `badge ${ord.prioridad === 'Alta' ? 'badge-mantenimiento' : 'badge-limpieza'}`;
    }

    const costInput = document.getElementById('maint-resolve-cost');
    if (costInput) {
      costInput.value = ord.costo_reparacion || ord.costo_estimado || 0;
      costInput.disabled = false;
    }

    const conceptInput = document.getElementById('maint-resolve-concept');
    if (conceptInput) {
      conceptInput.value = `Reparación: ${ord.titulo || 'Servicio Técnico'}`;
    }

    const payeeInput = document.getElementById('maint-resolve-payee');
    if (payeeInput) {
      payeeInput.value = ord.tecnico_asignado || 'Mario Gómez (Mantenimiento)';
    }

    const invInput = document.getElementById('maint-resolve-invoice');
    if (invInput) {
      invInput.value = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const methodSelect = document.getElementById('maint-resolve-method');
    if (methodSelect) {
      methodSelect.value = 'efectivo';
    }

    this.onPaymentMethodChange();
    openModal('modal-maint-resolve');
  },

  onPaymentMethodChange() {
    const method = document.getElementById('maint-resolve-method')?.value || 'efectivo';
    const costInput = document.getElementById('maint-resolve-cost');
    const indicator = document.getElementById('maint-cash-status-indicator');
    if (!indicator) return;

    if (method === 'sin_costo') {
      if (costInput) {
        costInput.value = 0;
        costInput.disabled = true;
      }
    } else {
      if (costInput) costInput.disabled = false;
    }

    const isCashOpen = typeof CashBillingModule !== 'undefined' && CashBillingModule.isCashOpen();

    if (method === 'efectivo') {
      if (!isCashOpen) {
        indicator.innerHTML = `
          <div style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px 14px; color: #991B1B; font-size: 12.5px; display: flex; align-items: flex-start; gap: 10px;">
            <i class="fas fa-lock" style="font-size: 16px; margin-top: 2px; color: #DC2626;"></i>
            <div>
              <strong style="display: block; font-size: 13px; margin-bottom: 2px;">Caja Cerrada - Pago en Efectivo Bloqueado</strong>
              No hay una sesión de caja activa en recepción. No podrá liquidar el pago en efectivo a menos que abra la caja primero en <em>Caja & Facturación</em> o seleccione <em>"Transferencia Bancaria"</em>.
            </div>
          </div>
        `;
      } else {
        const sesId = CashBillingModule.currentSession?.id || 1;
        indicator.innerHTML = `
          <div style="background: #DCFCE7; border: 1px solid #86EFAC; border-radius: 8px; padding: 12px 14px; color: #166534; font-size: 12.5px; display: flex; align-items: flex-start; gap: 10px;">
            <i class="fas fa-cash-register" style="font-size: 16px; margin-top: 2px; color: #16A34A;"></i>
            <div>
              <strong style="display: block; font-size: 13px; margin-bottom: 2px;">Caja Abierta (Turno #${sesId})</strong>
              El costo en efectivo se deducirá automáticamente como un egreso de la sesión activa de caja en recepción.
            </div>
          </div>
        `;
      }
    } else if (method === 'transferencia') {
      indicator.innerHTML = `
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px 14px; color: #1E40AF; font-size: 12.5px; display: flex; align-items: flex-start; gap: 10px;">
          <i class="fas fa-university" style="font-size: 16px; margin-top: 2px; color: #3B82F6;"></i>
          <div>
            <strong style="display: block; font-size: 13px; margin-bottom: 2px;">Pago por Transferencia Bancaria</strong>
            El gasto se registrará en el costo de la orden de mantenimiento pero no afectará el arqueo de efectivo físico de caja.
          </div>
        </div>
      `;
    } else {
      indicator.innerHTML = `
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; color: #475569; font-size: 12.5px; display: flex; align-items: flex-start; gap: 10px;">
          <i class="fas fa-shield-alt" style="font-size: 16px; margin-top: 2px; color: var(--accent-gold);"></i>
          <div>
            <strong style="display: block; font-size: 13px; margin-bottom: 2px;">Garantía / Mantenimiento Sin Costo</strong>
            No se generarán asientos de egreso contable en la caja.
          </div>
        </div>
      `;
    }
  },

  async confirmResolveWithCost() {
    try {
      const orderId = document.getElementById('maint-resolve-order-id')?.value;
      const roomId = document.getElementById('maint-resolve-room-id')?.value;
      const roomNum = document.getElementById('maint-resolve-room-num')?.value;
      const method = document.getElementById('maint-resolve-method')?.value || 'efectivo';
      const cost = Number(document.getElementById('maint-resolve-cost')?.value) || 0;
      const concept = (document.getElementById('maint-resolve-concept')?.value || '').trim();
      const payee = (document.getElementById('maint-resolve-payee')?.value || 'Mario Gómez').trim();
      const invoice = (document.getElementById('maint-resolve-invoice')?.value || '').trim();

      // Validación estricta de Caja: si paga en efectivo y la caja está cerrada
      if (method === 'efectivo' && cost > 0) {
        if (!CashBillingModule.isCashOpen()) {
          CustomDialog.alert({
            title: 'Caja Cerrada - No se puede pagar en efectivo',
            subtitle: 'Validación de Seguridad y Arqueo',
            message: 'No es posible liquidar el costo del mantenimiento en <strong>EFECTIVO</strong> porque no hay un turno de caja abierto en este momento.<br><br>Por favor, realice primero la <strong>Apertura de Caja</strong> en el módulo de <em>Recepción / Arqueo de Caja</em> o seleccione la modalidad <strong>"Transferencia Bancaria"</strong>.',
            icon: 'fa-lock',
            confirmText: 'Entendido'
          });
          return;
        }

        // Si la caja está abierta, registrar egreso en el arqueo
        const res = await CashBillingModule.registrarEgresoMantenimiento({
          monto: cost,
          motivo: `[MNT Hab. ${roomNum}]: ${concept || 'Servicio Técnico'}`,
          responsable: payee,
          comprobante: invoice || `REC-${Date.now().toString().slice(-4)}`,
          ordenId: orderId
        });

        if (!res.success) {
          showToast('Error al registrar egreso en caja: ' + (res.error || 'Caja cerrada'), 'error');
          return;
        }
      }

      // Actualizar orden en Supabase si no es puramente local
      if (!String(orderId).startsWith('HK-')) {
        await supabaseClient.from('ordenes_mantenimiento').update({
          estado: 'Resuelto',
          costo_reparacion: cost
        }).eq('id', orderId);
      }

      // Sincronizar bidireccionalmente con la bitácora de Housekeeping
      try {
        const rawHk = localStorage.getItem('hotel_hk_incidents');
        if (rawHk) {
          let hkIncidents = JSON.parse(rawHk);
          hkIncidents = hkIncidents.map(inc => {
            if (String(inc.id) === String(orderId) || String(inc.roomNumber) === String(roomNum)) {
              return { ...inc, status: 'Resuelto por Mantenimiento' };
            }
            return inc;
          });
          localStorage.setItem('hotel_hk_incidents', JSON.stringify(hkIncidents));
        }
      } catch (e) {}

      // Pasar habitación a 'Sucia' para inspección/limpieza final
      if (roomId && !isNaN(Number(roomId))) {
        await supabaseClient.from('habitaciones').update({
          estado: 'Sucia',
          observaciones: `Mantenimiento resuelto (${concept || 'Reparación'} - Costo: ${formatGs(cost)}). Requiere limpieza final previa a liberación.`
        }).eq('id', roomId);
      }

      closeModal('modal-maint-resolve');

      const msgExito = cost > 0 && method === 'efectivo'
        ? `✓ Mantenimiento resuelto. Egreso de ${formatGs(cost)} registrado en Caja. Habitación ${roomNum} enviada a Housekeeping (Sucia).`
        : `✓ Mantenimiento resuelto exitosamente. Habitación ${roomNum} enviada a Housekeeping (Sucia).`;

      showToast(msgExito, 'success');

      await this.loadOrders();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();
      await HousekeepingModule.loadHousekeepingBoard();

    } catch (err) {
      console.error('Error al resolver orden con costeo:', err);
      showToast('Error al resolver orden: ' + err.message, 'error');
    }
  }
};
