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

  // Gestión de Técnicos Registrados (Persistentes)
  getTechnicians() {
    try {
      const saved = localStorage.getItem('hotel_maint_technicians');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const defaults = [
      { id: 1, name: 'Mario Gómez', specialty: 'Mantenimiento General & Climatización', phone: '0981 123 456' },
      { id: 2, name: 'Carlos Benítez', specialty: 'Refrigeración & Split', phone: '0982 234 567' },
      { id: 3, name: 'Esteban Rojas', specialty: 'Electricidad & Redes', phone: '0983 345 678' },
      { id: 4, name: 'Darío Mendoza', specialty: 'Plomería & Hidromasaje', phone: '0984 456 789' }
    ];
    this.saveTechnicians(defaults);
    return defaults;
  },

  saveTechnicians(list) {
    try {
      localStorage.setItem('hotel_maint_technicians', JSON.stringify(list));
    } catch (e) {}
  },

  populateTechniciansSelect(selectId, selectedValue = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const list = this.getTechnicians();
    sel.innerHTML = list.map(t => {
      const val = `${t.name} (${t.specialty})`;
      const isSel = selectedValue ? (t.name === selectedValue || val.includes(selectedValue)) : false;
      return `<option value="${val}" ${isSel ? 'selected' : ''}>${t.name} • ${t.specialty} ${t.phone ? '(' + t.phone + ')' : ''}</option>`;
    }).join('');
  },

  newTechTargetContext: 'create',
  openNewTechnicianModal(target = 'create') {
    this.newTechTargetContext = target;
    const nameInput = document.getElementById('new-tech-name');
    const phoneInput = document.getElementById('new-tech-phone');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    openModal('modal-new-technician');
  },

  saveNewTechnician() {
    const name = document.getElementById('new-tech-name')?.value.trim();
    const specialty = document.getElementById('new-tech-specialty')?.value || 'Mantenimiento General Integral';
    const phone = document.getElementById('new-tech-phone')?.value.trim() || '';

    if (!name) {
      showToast('Por favor ingrese el nombre del técnico', 'warning');
      return;
    }

    const techs = this.getTechnicians();
    const newTech = { id: Date.now(), name, specialty, phone };
    techs.push(newTech);
    this.saveTechnicians(techs);

    const newVal = `${name} (${specialty})`;
    this.populateTechniciansSelect('maint-tech-select', newVal);
    this.populateTechniciansSelect('maint-resolve-tech-select', newVal);

    closeModal('modal-new-technician');
    showToast(`✓ Técnico ${name} registrado y seleccionado con éxito`, 'success');
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
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay órdenes de mantenimiento activas en el hotel.</td></tr>`;
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
          <td>
            <div style="font-weight: 600; color: #1E293B; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-user-cog" style="color: var(--primary-blue);"></i> ${sanitizeInput(tech)}
            </div>
          </td>
          <td><strong style="color: ${cost > 0 ? 'var(--primary-navy)' : 'var(--text-muted)'};">${formatGs(cost)}</strong></td>
          <td>
            <div class="action-btn-group">
              ${isPending ? `
                <button class="btn-action btn-action-reserve" onclick="MaintenanceModule.resolveOrder('${ord.id}', '${roomNum}')" title="Liquidar costo con Caja Mostrador y resolver mantenimiento">
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
    this.populateTechniciansSelect('maint-tech-select');
    const costInput = document.getElementById('maint-cost');
    if (costInput) costInput.value = '0';
    const descInput = document.getElementById('maint-desc');
    if (descInput) descInput.value = '';
    openModal('modal-new-maintenance');
  },

  async createOrder() {
    try {
      const roomId = document.getElementById('maint-room-select').value;
      const type = document.getElementById('maint-type').value;
      const priority = document.getElementById('maint-priority').value;
      const tech = document.getElementById('maint-tech-select')?.value || 'Mario Gómez (Mantenimiento Técnico)';
      const cost = Number(document.getElementById('maint-cost')?.value) || 0;
      const desc = document.getElementById('maint-desc')?.value.trim() || 'Revisión técnica solicitada';

      // 1. Insertar orden en ordenes_mantenimiento con columnas compatibles con Supabase
      const { error: ordErr } = await supabaseClient.from('ordenes_mantenimiento').insert({
        habitacion_id: roomId,
        titulo: type,
        prioridad: priority,
        costo_reparacion: cost,
        descripcion: desc,
        tecnico_asignado: tech,
        estado: 'En Proceso'
      });

      if (ordErr) throw ordErr;

      // 2. Bloquear habitación a 'Mantenimiento'
      await supabaseClient.from('habitaciones').update({
        estado: 'Mantenimiento',
        observaciones: `En mantenimiento técnico: ${type}. Técnico: ${tech}. Prioridad ${priority}.`
      }).eq('id', roomId);

      closeModal('modal-new-maintenance');
      showToast(`✓ Orden de mantenimiento asignada a ${tech} y habitación bloqueada`, 'warning');

      await this.loadOrders();
      if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
      if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
      if (typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();

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

    this.populateTechniciansSelect('maint-resolve-tech-select', ord.tecnico_asignado || '');

    const invInput = document.getElementById('maint-resolve-invoice');
    if (invInput) {
      invInput.value = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const methodSelect = document.getElementById('maint-resolve-method');
    if (methodSelect) {
      methodSelect.value = 'efectivo';
    }

    const deductCashCheck = document.getElementById('maint-resolve-pay-from-cash');
    if (deductCashCheck) {
      deductCashCheck.checked = true;
    }

    this.onPaymentMethodChange();
    openModal('modal-maint-resolve');
  },

  onPaymentMethodChange() {
    const method = document.getElementById('maint-resolve-method')?.value || 'efectivo';
    const costInput = document.getElementById('maint-resolve-cost');
    const indicator = document.getElementById('maint-cash-status-indicator');
    const deductWrapper = document.getElementById('maint-cash-deduct-wrapper');

    if (deductWrapper) {
      deductWrapper.style.display = (method === 'efectivo') ? 'flex' : 'none';
    }

    if (method === 'sin_costo') {
      if (costInput) {
        costInput.value = 0;
        costInput.disabled = true;
      }
    } else {
      if (costInput) costInput.disabled = false;
    }

    if (!indicator) return;

    const isCashOpen = typeof CashBillingModule !== 'undefined' && CashBillingModule.isCashOpen();
    const availableCash = typeof CashBillingModule !== 'undefined' ? CashBillingModule.getEsperadoEfectivo() : 0;

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
            <i class="fas fa-cash-register" style="font-size: 18px; margin-top: 2px; color: #16A34A;"></i>
            <div>
              <strong style="display: block; font-size: 13.5px; margin-bottom: 3px;">Caja Mostrador Abierta (Turno #${sesId})</strong>
              <div style="font-size: 12px; color: #15803D;">
                Fondos disponibles en cajón de efectivo: <strong style="font-size: 13.5px; color: #14532D;">${formatGs(availableCash)}</strong>
              </div>
              <span style="font-size: 11px; color: #166534; display: block; margin-top: 2px;">
                El costo se liquidará como un egreso contable deduciéndose inmediatamente del arqueo activo.
              </span>
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
      const concept = (document.getElementById('maint-resolve-concept')?.value || '').trim() || 'Servicio Técnico';
      const payee = (document.getElementById('maint-resolve-tech-select')?.value || 'Mario Gómez').trim();
      const invoice = (document.getElementById('maint-resolve-invoice')?.value || '').trim();
      const payFromCash = document.getElementById('maint-resolve-pay-from-cash')?.checked !== false;

      // Validación estricta de Caja Mostrador: si paga en efectivo y la caja está cerrada o sin fondos
      if (method === 'efectivo' && cost > 0 && payFromCash) {
        if (!CashBillingModule.isCashOpen()) {
          CustomDialog.alert({
            title: 'Caja Cerrada - No se puede pagar en efectivo',
            subtitle: 'Validación de Seguridad y Arqueo',
            message: 'No es posible liquidar el costo del mantenimiento en <strong>EFECTIVO</strong> porque no hay un turno de caja abierto en este momento.<br><br>Por favor, realice primero la <strong>Apertura de Caja</strong> en el módulo de <em>Caja & Facturación</em> o seleccione la modalidad <strong>"Transferencia Bancaria"</strong>.',
            icon: 'fa-lock',
            confirmText: 'Entendido'
          });
          return;
        }

        const cashAvailable = CashBillingModule.getEsperadoEfectivo();
        if (cost > cashAvailable) {
          CustomDialog.alert({
            title: 'Fondos Insuficientes en Caja Mostrador',
            subtitle: 'Límite de Efectivo en Cajón',
            message: `El costo a liquidar (<strong>${formatGs(cost)}</strong>) supera el efectivo físico disponible en la caja activa (<strong>${formatGs(cashAvailable)}</strong>).<br><br>Por favor ajuste el importe o registre el pago por <strong>Transferencia Bancaria</strong>.`,
            icon: 'fa-exclamation-triangle',
            confirmText: 'Entendido'
          });
          return;
        }

        // Registrar egreso inmediato en la sesión activa de caja
        const res = await CashBillingModule.registrarEgresoMantenimiento({
          monto: cost,
          motivo: `[MNT Hab. ${roomNum}]: ${concept}`,
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

      const msgExito = cost > 0 && method === 'efectivo' && payFromCash
        ? `✓ Mantenimiento resuelto. Egreso de ${formatGs(cost)} registrado en Caja Mostrador a nombre de ${payee}. Habitación ${roomNum} derivada a Housekeeping (Sucia).`
        : `✓ Mantenimiento resuelto exitosamente por ${payee}. Habitación ${roomNum} enviada a Housekeeping (Sucia).`;

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
