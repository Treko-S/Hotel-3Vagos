/**
 * Reservations & Front Desk Reception Module
 * Check-in, Check-out, Folio settlements & Booking Management
 */

const ReservationsModule = {
  currentBookings: [],

  async init() {
    await this.loadReservations();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const searchInput = document.getElementById('search-reservations');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filterTable(e.target.value);
        }, 300);
      });
    }

    const filterStatus = document.getElementById('filter-res-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.filterTable(document.getElementById('search-reservations')?.value || '', e.target.value);
      });
    }
  },

  currentActiveFolioBooking: null,

  async loadReservations() {
    try {
      const tbody = document.getElementById('reservations-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando reservas y folios...</td></tr>`;

      const { data, error } = await supabaseClient
        .from('reservas')
        .select('*, habitaciones(*, tipos_habitacion(*)), folios(*, pagos_folio(*)), acompanantes(*), users(*)')
        .order('id', { ascending: false });

      if (error) throw error;

      this.currentBookings = data || [];
      this.updateFrontDeskKPIs(this.currentBookings);
      this.renderTable(this.currentBookings);

    } catch (err) {
      console.error('Error al cargar reservas:', err);
      showToast('Error al cargar reservas: ' + err.message, 'error');
    }
  },

  updateFrontDeskKPIs(list) {
    const today = new Date().toISOString().split('T')[0];
    let checkinsToday = 0;
    let inHouse = 0;
    let totalPagosRecaudados = 0;
    let totalSaldoPendiente = 0;

    list.forEach(b => {
      const folio = (b.folios && typeof b.folios === 'object') ? (Array.isArray(b.folios) ? (b.folios[0] || {}) : b.folios) : {};
      const montoTotal = Number(b.monto_total || 0);
      const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(b.anticipo_pagado || 0);
      const saldo = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, montoTotal - anticipo);

      if (b.check_in_previsto === today && (b.estado === 'Confirmada' || b.estado === 'Garantizada')) {
        checkinsToday++;
      }
      if (b.estado === 'Check-in' || b.estado === 'En estadía') {
        inHouse++;
      }
      totalPagosRecaudados += anticipo;
      if (b.estado === 'Confirmada' || b.estado === 'Check-in' || b.estado === 'En estadía') {
        totalSaldoPendiente += saldo;
      }
    });

    const elCheckin = document.getElementById('frontdesk-kpi-checkin-today');
    if (elCheckin) elCheckin.innerText = checkinsToday;
    const elInHouse = document.getElementById('frontdesk-kpi-in-house');
    if (elInHouse) elInHouse.innerText = inHouse;
    const elPagos = document.getElementById('frontdesk-kpi-total-pagos');
    if (elPagos) elPagos.innerText = formatGs(totalPagosRecaudados);
    const elSaldo = document.getElementById('frontdesk-kpi-total-saldo');
    if (elSaldo) elSaldo.innerText = formatGs(totalSaldoPendiente);
  },

  renderTable(list) {
    const tbody = document.getElementById('reservations-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">No se encontraron reservas con los criterios seleccionados.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(b => {
      const hab = b.habitaciones || {};
      const tipo = hab.tipos_habitacion || {};
      const user = b.users || {};
      const folio = (b.folios && typeof b.folios === 'object') ? (Array.isArray(b.folios) ? (b.folios[0] || {}) : b.folios) : {};
      
      const montoTotal = Number(b.monto_total || 0);
      const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(b.anticipo_pagado || 0);
      const saldoPendiente = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, montoTotal - anticipo);

      let estadoBadge = this.getStatusBadge(b.estado);
      if (b.estado === 'Confirmada' && anticipo > 0) {
        estadoBadge = `<span class="badge" style="background: #E0E7FF; color: #3730A3; border: 1px solid #C7D2FE;"><i class="fas fa-shield-alt"></i> Garantizada</span>`;
      }

      html += `
        <tr>
          <td>
            <strong style="color: var(--primary-navy); font-size: 13.5px;">${sanitizeInput(b.codigo_reserva)}</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              <i class="fas fa-mobile-alt" style="color: var(--info);"></i> ${sanitizeInput(b.canal_venta || 'App Móvil')}
            </div>
          </td>
          <td>
            <div style="font-weight: 600;">Habitación ${sanitizeInput(hab.numero || 'N/A')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(tipo.nombre || 'Estándar')}</div>
          </td>
          <td>
            <div style="font-size: 12px;"><i class="far fa-calendar-alt" style="color: var(--info);"></i> ${formatDate(b.check_in_previsto)}</div>
            <div style="font-size: 12px;"><i class="far fa-calendar-check" style="color: var(--danger);"></i> ${formatDate(b.check_out_previsto)}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--primary-dark);">${sanitizeInput(user.full_name || 'Huésped Registrado')}</div>
            <div style="font-size: 11px; color: var(--text-muted);">
              <i class="fas fa-id-card"></i> Doc: ${sanitizeInput(user.document_number || 'S/D')}
            </div>
            ${b.acompanantes && b.acompanantes.length > 0 ? `
              <span class="badge badge-confirmada" style="font-size: 9.5px; padding: 2px 6px; cursor: help; margin-top: 3px; display: inline-block;" title="${b.acompanantes.map(a => a.full_name).join(', ')}">
                <i class="fas fa-users"></i> +${b.acompanantes.length} legal
              </span>
            ` : ''}
          </td>
          <td>
            <div style="font-weight: bold; color: var(--primary-dark); font-size: 13.5px;">${formatGs(montoTotal)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${b.cantidad_huespedes || 1} Huésped(es)</div>
          </td>
          <td>
            ${anticipo > 0 ? `
              <span class="badge" style="background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; font-weight: bold; padding: 3px 8px;">
                <i class="fas fa-check-circle"></i> ${formatGs(anticipo)}
              </span>
              <div style="font-size: 10px; color: #166534; font-weight: 600; margin-top: 2px;">
                Seña Pagada (${Math.round((anticipo / montoTotal) * 100)}%)
              </div>
            ` : `
              <span style="color: var(--text-muted); font-size: 11px;">0 Gs. (Sin seña)</span>
            `}
          </td>
          <td>
            ${saldoPendiente <= 0 ? `
              <span class="badge" style="background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; font-weight: 700;">
                <i class="fas fa-check-double"></i> 0 Gs. Saldado
              </span>
            ` : `
              <span class="badge" style="background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; font-weight: 700;">
                <i class="fas fa-clock"></i> ${formatGs(saldoPendiente)}
              </span>
            `}
          </td>
          <td>${estadoBadge}</td>
          <td>
            <div style="display: flex; gap: 5px; align-items: center;">
              ${b.estado !== 'Check-in' && b.estado !== 'Finalizada' && b.estado !== 'Cancelada' ? `
                <button class="btn btn-sm btn-primary" onclick="ReservationsModule.openCheckInModal('${b.id}')" title="Realizar Check-in">
                  <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
              ` : ''}

              ${b.estado === 'Check-in' || b.estado === 'En estadía' ? `
                <button class="btn btn-sm btn-gold" onclick="ReservationsModule.openCheckOutModal('${b.id}')" title="Realizar Check-out y Cobro">
                  <i class="fas fa-sign-out-alt"></i> Check-out
                </button>
              ` : ''}

              <button class="btn btn-sm btn-outline" onclick="ReservationsModule.viewFolioDetail('${b.id}')" title="Ver Folio & Comprobante SET">
                <i class="fas fa-file-invoice-dollar"></i>
              </button>

              <button class="btn btn-sm btn-outline" style="color: #4F46E5; border-color: #C7D2FE;" onclick="ReservationsModule.quickSendEmail('${b.id}')" title="Enviar Comprobante por Correo (Brevo)">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  filterTable(query = '', statusFilter = 'ALL') {
    const q = (query || '').toLowerCase().trim();
    const filtered = this.currentBookings.filter(b => {
      const code = (b.codigo_reserva || '').toLowerCase();
      const hab = b.habitaciones ? (b.habitaciones.numero || '').toLowerCase() : '';
      const guestName = (b.users?.full_name || '').toLowerCase();
      const guestDoc = (b.users?.document_number || '').toLowerCase();
      const state = (b.estado || '').toUpperCase();

      const folio = (b.folios && typeof b.folios === 'object') ? (Array.isArray(b.folios) ? (b.folios[0] || {}) : b.folios) : {};
      const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(b.anticipo_pagado || 0);

      const matchesQuery = q === '' || code.includes(q) || hab.includes(q) || guestName.includes(q) || guestDoc.includes(q);
      
      let matchesStatus = true;
      if (statusFilter === 'GARANTIZADA') {
        matchesStatus = anticipo > 0 && (state === 'CONFIRMADA' || state === 'CHECK-IN' || state === 'EN ESTADÍA');
      } else if (statusFilter !== 'ALL') {
        matchesStatus = state === statusFilter.toUpperCase();
      }

      return matchesQuery && matchesStatus;
    });

    this.renderTable(filtered);
  },

  getStatusBadge(estado) {
    const est = (estado || '').toLowerCase();
    if (est === 'confirmada') return `<span class="badge badge-confirmada"><i class="fas fa-check-circle"></i> Confirmada</span>`;
    if (est === 'check-in' || est === 'en estadía') return `<span class="badge badge-ocupada"><i class="fas fa-key"></i> En Estadía</span>`;
    if (est === 'finalizada') return `<span class="badge badge-disponible"><i class="fas fa-flag-checkered"></i> Finalizada</span>`;
    if (est === 'cancelada') return `<span class="badge badge-mantenimiento"><i class="fas fa-times-circle"></i> Cancelada</span>`;
    return `<span class="badge badge-abierto">${sanitizeInput(estado || 'Pendiente')}</span>`;
  },

  openCheckInModal(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    document.getElementById('checkin-booking-id').value = booking.id;
    document.getElementById('checkin-room-id').value = booking.habitacion_id;
    document.getElementById('checkin-res-code').innerText = booking.codigo_reserva;
    document.getElementById('checkin-room-number').innerText = booking.habitaciones?.numero || 'N/A';
    document.getElementById('checkin-dates').innerText = `${formatDate(booking.check_in_previsto)} al ${formatDate(booking.check_out_previsto)}`;
    document.getElementById('checkin-total').innerText = formatGs(booking.monto_total);

    // Mostrar acompañantes registrados legalmente si existen
    const compContainer = document.getElementById('checkin-companions-container');
    const compList = document.getElementById('checkin-companions-list');
    if (compContainer && compList) {
      const companions = booking.acompanantes || [];
      if (companions.length > 0) {
        compContainer.style.display = 'block';
        compList.innerHTML = companions.map((c, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 11.5px;">
            <div>
              <strong>${sanitizeInput(c.full_name || 'Acompañante ' + (idx + 1))}</strong>
              <span style="color: var(--text-muted); font-size: 10.5px;">(${c.is_adult === false ? 'Menor' : 'Adulto'}${c.relationship ? ' - ' + sanitizeInput(c.relationship) : ''})</span>
            </div>
            <span class="badge badge-confirmada" style="font-size: 10px;">${sanitizeInput(c.document_type || 'Doc')}: ${sanitizeInput(c.document_number || 'N/D')}</span>
          </div>
        `).join('');
      } else {
        compContainer.style.display = 'none';
        compList.innerHTML = '';
      }
    }

    openModal('modal-checkin');
  },

  async confirmCheckIn() {
    try {
      const bookingId = document.getElementById('checkin-booking-id').value;
      const roomId = document.getElementById('checkin-room-id').value;
      const docType = document.getElementById('checkin-doc-type').value;
      const docNumber = document.getElementById('checkin-doc-number').value;
      const keyDelivered = document.getElementById('checkin-key-checkbox').checked;

      if (!keyDelivered) {
        showToast('Debe confirmar la entrega de la llave/tarjeta', 'warning');
        return;
      }

      // 1. Actualizar reserva a 'Check-in'
      const { error: bookErr } = await supabaseClient
        .from('reservas')
        .update({ estado: 'Check-in' })
        .eq('id', bookingId);

      if (bookErr) throw bookErr;

      // 2. Actualizar habitación a 'Ocupada'
      const { error: roomErr } = await supabaseClient
        .from('habitaciones')
        .update({ estado: 'Ocupada' })
        .eq('id', roomId);

      if (roomErr) throw roomErr;

      // 3. Registrar registro de check-in en tabla checkins si existe
      try {
        await supabaseClient.from('checkins').insert({
          reserva_id: bookingId,
          habitacion_id: roomId,
          observaciones: `Documento: ${docType} ${docNumber} - Llave entregada`
        });
      } catch (e) {
        console.warn('Checkin log table skip:', e);
      }

      closeModal('modal-checkin');
      showToast('¡Check-in realizado con éxito! Habitación marcada como Ocupada', 'success');
      if (typeof notifyDataChanged === 'function') notifyDataChanged('reservas', { action: 'checkin', bookingId, roomId });

      await this.loadReservations();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();

    } catch (err) {
      console.error('Error al realizar Check-in:', err);
      showToast('Error al procesar check-in: ' + err.message, 'error');
    }
  },

  openCheckOutModal(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const folio = (booking.folios && typeof booking.folios === 'object') ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios) : {};
    const saldo = folio.saldo_pendiente !== undefined ? folio.saldo_pendiente : booking.monto_total;

    document.getElementById('checkout-booking-id').value = booking.id;
    document.getElementById('checkout-room-id').value = booking.habitacion_id;
    document.getElementById('checkout-folio-id').value = folio.id || '';
    document.getElementById('checkout-res-code').innerText = booking.codigo_reserva;
    document.getElementById('checkout-room-number').innerText = booking.habitaciones?.numero || 'N/A';
    document.getElementById('checkout-balance-amount').innerText = formatGs(saldo);
    document.getElementById('checkout-payment-amount').value = saldo;

    openModal('modal-checkout');
  },

  async confirmCheckOut() {
    try {
      const bookingId = document.getElementById('checkout-booking-id').value;
      const roomId = document.getElementById('checkout-room-id').value;
      const folioId = document.getElementById('checkout-folio-id').value;
      const paymentMethod = document.getElementById('checkout-payment-method').value;
      const paymentAmount = Number(document.getElementById('checkout-payment-amount').value) || 0;
      const rucCi = document.getElementById('checkout-invoice-ruc').value || '44444401-7';
      const clientName = document.getElementById('checkout-invoice-name').value || 'Huésped Final';

      // 1. Actualizar folio (si existe)
      if (folioId) {
        await supabaseClient.from('folios').update({
          saldo_pendiente: 0,
          total_pagos: paymentAmount,
          estado: 'Cerrado'
        }).eq('id', folioId);

        // Registrar pago de folio si la tabla existe
        try {
          await supabaseClient.from('pagos_folio').insert({
            folio_id: folioId,
            monto: paymentAmount,
            metodo_pago: paymentMethod,
            referencia: `Cobro Check-out Reserva #${bookingId}`
          });
        } catch (e) {
          console.warn('pagos_folio insert skip:', e);
        }
      }

      // 2. Emitir Factura
      try {
        const iva10 = Math.round(paymentAmount / 11);
        await supabaseClient.from('facturas').insert({
          reserva_id: bookingId,
          ruc_ci: rucCi,
          razon_social: clientName,
          monto_total: paymentAmount,
          monto_iva10: iva10,
          metodo_pago: paymentMethod,
          numero_factura: `001-001-${Math.floor(1000000 + Math.random() * 9000000)}`
        });
      } catch (e) {
        console.warn('facturas insert skip:', e);
      }

      // 3. Actualizar reserva a 'Finalizada'
      await supabaseClient
        .from('reservas')
        .update({ estado: 'Finalizada' })
        .eq('id', bookingId);

      // 4. Cambiar habitación a 'Sucia' para que Housekeeping la limpie
      await supabaseClient
        .from('habitaciones')
        .update({
          estado: 'Sucia',
          observaciones: 'Check-out realizado. Limpieza e inspección requerida.'
        })
        .eq('id', roomId);

      closeModal('modal-checkout');
      showToast('¡Check-out completado! Habitación enviada a Housekeeping (Sucia)', 'success');
      if (typeof notifyDataChanged === 'function') notifyDataChanged('reservas', { action: 'checkout', bookingId, roomId });

      await this.loadReservations();
      await DashboardModule.loadKPIs();
      await HousekeepingModule.loadHousekeepingBoard();
      await RoomsModule.loadRooms();

    } catch (err) {
      console.error('Error al realizar check-out:', err);
      showToast('Error en check-out: ' + err.message, 'error');
    }
  },

  viewFolioDetail(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    this.currentActiveFolioBooking = booking;

    const folio = (booking.folios && typeof booking.folios === 'object') ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios) : {};
    const hab = booking.habitaciones || {};
    const tipo = hab.tipos_habitacion || {};
    const user = booking.users || {};
    const pagos = Array.isArray(folio.pagos_folio) ? folio.pagos_folio : [];

    const montoTotal = Number(booking.monto_total || 0);
    const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(booking.anticipo_pagado || 0);
    const saldoPendiente = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, montoTotal - anticipo);

    // Cálculos Impositivos según normativa SET / DNIT Paraguay
    const gravada10 = Math.round(montoTotal / 1.10);
    const iva10 = Math.round(montoTotal / 11);

    const dIn = new Date(booking.check_in_previsto);
    const dOut = new Date(booking.check_out_previsto);
    const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)) || 1);

    const content = `
      <div style="font-family: var(--font-sans); color: var(--text-main);">
        <!-- Membrete Legal SET Paraguay -->
        <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-family: var(--font-heading); color: var(--primary-navy); margin: 0 0 4px; font-size: 18px; font-weight: 700;">HOTEL 3 VAGOS S.A.</h3>
              <p style="margin: 0; font-size: 11.5px; color: var(--text-muted);">Servicios de Alojamiento y Hospedaje Turístico</p>
              <p style="margin: 2px 0 0; font-size: 11.5px; color: var(--text-muted);"><i class="fas fa-map-marker-alt"></i> Asunción, Paraguay - Convenio UTCD</p>
            </div>
            <div style="text-align: right; background: #FFF; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: bold; color: var(--primary-navy);">RUC: 80092341-2</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">Timbrado N°: <strong>16789423</strong></div>
              <div style="font-size: 9.5px; color: var(--text-light);">Válido hasta: 31/12/2026</div>
              <div style="font-size: 11px; font-weight: bold; color: var(--accent-gold); margin-top: 3px;">
                COMPROBANTE LEGAL / FOLIO
              </div>
            </div>
          </div>
        </div>

        <!-- Datos del Huésped y Reserva -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="background: #FFF; border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">
              <i class="fas fa-user"></i> Titular de la Reserva
            </div>
            <div style="font-weight: 700; color: var(--primary-dark); font-size: 13.5px;">${sanitizeInput(user.full_name || 'Huésped')}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Doc / RUC: <strong>${sanitizeInput(user.document_number || 'S/D')}</strong></div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Email: <span style="color: var(--primary-blue);">${sanitizeInput(user.email || 'rc652107@gmail.com')}</span></div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Tel: ${sanitizeInput(user.phone || '+595 S/N')}</div>
          </div>

          <div style="background: #FFF; border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">
              <i class="fas fa-door-open"></i> Detalles de Hospedaje
            </div>
            <div style="font-weight: 700; color: var(--primary-dark); font-size: 13.5px;">Habitación ${sanitizeInput(hab.numero || 'N/A')} - ${sanitizeInput(tipo.nombre || 'Estándar')}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Estadía: <strong>${formatDate(booking.check_in_previsto)}</strong> al <strong>${formatDate(booking.check_out_previsto)}</strong>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Duración: <strong>${nights} noche${nights > 1 ? 's' : ''}</strong> | ${booking.cantidad_huespedes || 1} Huésped(es)</div>
            <div style="font-size: 11.5px; margin-top: 2px;">
              Estado: <span class="badge ${folio.estado === 'Cerrado' ? 'badge-cerrado' : 'badge-abierto'}">${folio.estado || 'Abierto'}</span>
            </div>
          </div>
        </div>

        <!-- Desglose de Cargos -->
        <h5 style="font-size: 13px; font-weight: 700; color: var(--primary-navy); margin: 0 0 8px; display: flex; align-items: center; gap: 6px;">
          <i class="fas fa-list-ol"></i> Conceptos & Cargos del Folio
        </h5>
        <table style="width: 100%; font-size: 12.5px; border-collapse: collapse; margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 9px 12px; font-weight: 600;">Descripción</th>
              <th style="padding: 9px 12px; text-align: center; font-weight: 600;">Cant.</th>
              <th style="padding: 9px 12px; text-align: right; font-weight: 600;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 9px 12px;">
                <strong>Alojamiento: Habitación ${sanitizeInput(hab.numero || '')}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${formatDate(booking.check_in_previsto)} a ${formatDate(booking.check_out_previsto)} (${nights} noches)</div>
              </td>
              <td style="padding: 9px 12px; text-align: center;">${nights}</td>
              <td style="padding: 9px 12px; text-align: right; font-weight: bold;">${formatGs(montoTotal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Historial de Pagos & Señas Registradas -->
        <h5 style="font-size: 13px; font-weight: 700; color: var(--primary-navy); margin: 0 0 8px; display: flex; align-items: center; gap: 6px;">
          <i class="fas fa-receipt" style="color: var(--success);"></i> Pagos & Señas Registradas
        </h5>
        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
          ${pagos.length > 0 ? `
            <table style="width: 100%; font-size: 12.5px; border-collapse: collapse;">
              <thead>
                <tr style="background: #F0FDF4; text-align: left; color: #166534;">
                  <th style="padding: 8px 12px;">Fecha</th>
                  <th style="padding: 8px 12px;">Método</th>
                  <th style="padding: 8px 12px;">Referencia / TRX</th>
                  <th style="padding: 8px 12px; text-align: right;">Abono</th>
                </tr>
              </thead>
              <tbody>
                ${pagos.map(p => `
                  <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 8px 12px;">${formatDate(p.fecha_pago || booking.created_at)}</td>
                    <td style="padding: 8px 12px;">
                      <span class="badge" style="background: #DCFCE7; color: #166534; font-size: 10.5px;">${sanitizeInput(p.metodo_pago)}</span>
                    </td>
                    <td style="padding: 8px 12px; font-family: monospace; font-size: 11.5px; color: var(--text-muted);">${sanitizeInput(p.referencia_transaccion || 'N/A')}</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #15803D;">-${formatGs(p.monto)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : anticipo > 0 ? `
            <div style="padding: 10px 14px; background: #F0FDF4; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge" style="background: #DCFCE7; color: #166534; font-weight: bold;">
                  <i class="fas fa-check-circle"></i> Seña Abonada
                </span>
                <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">Abono de reserva garantizada</span>
              </div>
              <strong style="color: #15803D; font-size: 13.5px;">-${formatGs(anticipo)}</strong>
            </div>
          ` : `
            <div style="padding: 12px 16px; color: var(--text-muted); font-size: 12px; text-align: center;">
              Aún no se registran pagos ni señas para este folio. El huésped liquidará al check-out o mediante la app.
            </div>
          `}
        </div>

        <!-- Liquidación Impositiva SET Paraguay & Saldos -->
        <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;">
                Liquidación Impositiva SET (IVA 10%)
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Gravadas 10%: <strong>${formatGs(gravada10)}</strong></div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Liquidación IVA 10%: <strong>${formatGs(iva10)}</strong></div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Subtotal Exentas: <strong>0 Gs.</strong></div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted);">Total de Estadía: <strong style="color: var(--primary-dark);">${formatGs(montoTotal)}</strong></div>
              <div style="font-size: 12px; color: #15803D; margin: 3px 0;">Total Abonado / Seña: <strong>-${formatGs(anticipo)}</strong></div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
                <span style="font-size: 12px; font-weight: 600; color: var(--primary-navy);">Saldo Pendiente:</span>
                <span style="font-size: 17px; font-weight: 800; color: ${saldoPendiente > 0 ? 'var(--danger)' : 'var(--success)'}; margin-left: 6px;">
                  ${formatGs(saldoPendiente)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('folio-modal-content').innerHTML = content;
    openModal('modal-folio');
  },

  /**
   * Obtiene el historial de envíos de correo para un código de reserva
   */
  getFolioEmailHistory(codigoReserva) {
    try {
      const raw = localStorage.getItem('folio_email_history_' + codigoReserva);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('getFolioEmailHistory error:', e);
    }
    return { sentCount: 0, dispatches: [] };
  },

  /**
   * Guarda un despacho de correo en el historial local para auditoría
   */
  saveFolioEmailDispatch(codigoReserva, dispatchInfo) {
    const history = this.getFolioEmailHistory(codigoReserva);
    history.sentCount = (history.sentCount || 0) + 1;
    if (!history.dispatches) history.dispatches = [];
    history.dispatches.push(dispatchInfo);
    try {
      localStorage.setItem('folio_email_history_' + codigoReserva, JSON.stringify(history));
    } catch (e) {
      console.warn('saveFolioEmailDispatch error:', e);
    }
    return history;
  },

  configureBrevoKey() {
    const currentKey = localStorage.getItem('BREVO_API_KEY') || window.BREVO_API_KEY || '';
    const currentEmail = localStorage.getItem('BREVO_SENDER_EMAIL') || window.BREVO_SENDER_EMAIL || 'rc652107@gmail.com';
    const key = prompt('Ingrese su Brevo API Key (obtenida en Brevo -> SMTP & API -> API Keys, comienza con xkeysib-...):', currentKey);
    if (key !== null && key.trim()) {
      localStorage.setItem('BREVO_API_KEY', key.trim());
      window.BREVO_API_KEY = key.trim();
      const email = prompt('Ingrese el correo remitente verificado en Brevo (su cuenta):', currentEmail);
      if (email !== null && email.trim()) {
        localStorage.setItem('BREVO_SENDER_EMAIL', email.trim());
        window.BREVO_SENDER_EMAIL = email.trim();
      }
      showToast('Configuración de Brevo guardada en Web Admin', 'success');
      if (this.currentActiveFolioBooking) {
        this.viewFolioDetail(this.currentActiveFolioBooking.id);
      }
    }
  },

  setReenvioMotivo(text) {
    const input = document.getElementById('reenvio-motivo-texto');
    if (input) {
      input.value = text;
      input.focus();
    }
  },

  /**
   * Permite a recepción registrar un consumo extra rápido en el folio
   */
  async promptAddConsumption(bookingId) {
    const desc = prompt('Ingrese el concepto del consumo (ej. Frigobar: 2x Agua + Snickers, Room Service):', 'Consumo Frigobar / Minibar');
    if (!desc) return;
    const montoStr = prompt('Ingrese el monto del consumo en Guaraníes (Gs.):', '35000');
    if (!montoStr) return;
    const monto = Number(montoStr.replace(/\D/g, '')) || 0;
    if (monto <= 0) {
      showToast('Monto inválido', 'warning');
      return;
    }

    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const folio = (booking.folios && typeof booking.folios === 'object') ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios) : {};
    const nuevoConsumo = (Number(folio.total_consumos) || 0) + monto;
    const nuevoSaldo = (Number(folio.saldo_pendiente) || 0) + monto;

    try {
      if (folio.id) {
        await supabaseClient.from('folios').update({
          total_consumos: nuevoConsumo,
          saldo_pendiente: nuevoSaldo
        }).eq('id', folio.id);
      }
      showToast(`¡Consumo de ${formatGs(monto)} registrado en folio!`, 'success');
      await this.loadReservations();
      this.viewFolioDetail(bookingId);
    } catch (e) {
      console.error('Error al agregar consumo:', e);
      showToast('Error al registrar consumo: ' + e.message, 'error');
    }
  },

  viewFolioDetail(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    this.currentActiveFolioBooking = booking;

    const folio = (booking.folios && typeof booking.folios === 'object') ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios) : {};
    const hab = booking.habitaciones || {};
    const tipo = hab.tipos_habitacion || {};
    const user = booking.users || {};
    const pagos = Array.isArray(folio.pagos_folio) ? folio.pagos_folio : [];

    const montoTotal = Number(booking.monto_total || 0);
    const totalConsumos = Number(folio.total_consumos || 0);
    const granTotal = montoTotal + totalConsumos;
    const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(booking.anticipo_pagado || 0);
    const saldoPendiente = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, granTotal - anticipo);

    // Cálculos Impositivos según normativa SET / DNIT Paraguay
    const gravada10 = Math.round(granTotal / 1.10);
    const iva10 = Math.round(granTotal / 11);

    const dIn = new Date(booking.check_in_previsto);
    const dOut = new Date(booking.check_out_previsto);
    const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)) || 1);
    const tarifaDiaria = nights > 0 ? Math.round(montoTotal / nights) : montoTotal;

    const history = this.getFolioEmailHistory(booking.codigo_reserva);

    const content = `
      <div style="font-family: var(--font-sans); color: var(--text-main);">
        <!-- Membrete Legal SET Paraguay -->
        <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-family: var(--font-heading); color: var(--primary-navy); margin: 0 0 4px; font-size: 18px; font-weight: 700;">HOTEL 3 VAGOS S.A.</h3>
              <p style="margin: 0; font-size: 11.5px; color: var(--text-muted);">Servicios de Alojamiento y Hospedaje Turístico</p>
              <p style="margin: 2px 0 0; font-size: 11.5px; color: var(--text-muted);"><i class="fas fa-map-marker-alt"></i> Asunción, Paraguay - Convenio UTCD</p>
            </div>
            <div style="text-align: right; background: #FFF; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 6px;">
              <div style="font-size: 11px; font-weight: bold; color: var(--primary-navy);">RUC: 80092341-2</div>
              <div style="font-size: 10.5px; color: var(--text-muted);">Timbrado N°: <strong>16789423</strong></div>
              <div style="font-size: 9.5px; color: var(--text-light);">Válido hasta: 31/12/2026</div>
              <div style="font-size: 11px; font-weight: bold; color: var(--accent-gold); margin-top: 3px;">
                COMPROBANTE LEGAL / FOLIO
              </div>
            </div>
          </div>
        </div>

        <!-- Estado de Auditoría de Envíos -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: ${history.sentCount > 0 ? '#F0FDF4' : '#F8FAFC'}; border: 1px solid ${history.sentCount > 0 ? '#BBF7D0' : '#E2E8F0'}; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="${history.sentCount > 0 ? 'fas fa-envelope-circle-check' : 'fas fa-envelope'}" style="color: ${history.sentCount > 0 ? '#15803D' : '#64748B'}; font-size: 16px;"></i>
            <div>
              <strong style="font-size: 12.5px; color: ${history.sentCount > 0 ? '#166534' : 'var(--primary-navy)'};">
                ${history.sentCount === 0 ? 'Comprobante no enviado aún al huésped' : `Comprobante despachado ${history.sentCount} vez${history.sentCount > 1 ? 'ces' : ''}`}
              </strong>
              <div style="font-size: 11px; color: var(--text-muted);">
                ${history.sentCount === 0 ? 'El primer envío se remite directamente; los reenvíos solicitarán motivo obligatorio.' : `Último envío: ${formatDate(history.dispatches[history.dispatches.length - 1].timestamp)}`}
              </div>
            </div>
          </div>
          <span class="badge" style="background: ${history.sentCount > 0 ? '#DCFCE7' : '#E2E8F0'}; color: ${history.sentCount > 0 ? '#166534' : '#475569'}; font-size: 11px;">
            ${history.sentCount === 0 ? 'Pendiente' : `Despacho #${history.sentCount}`}
          </span>
        </div>

        <!-- Datos del Huésped y Reserva -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="background: #FFF; border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">
              <i class="fas fa-user"></i> Titular de la Reserva
            </div>
            <div style="font-weight: 700; color: var(--primary-dark); font-size: 13.5px;">${sanitizeInput(user.full_name || 'Huésped')}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Doc / RUC: <strong>${sanitizeInput(user.document_number || 'S/D')}</strong></div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Email: <span style="color: var(--primary-blue); font-weight: 600;">${sanitizeInput(user.email || 'rc652107@gmail.com')}</span></div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Tel: ${sanitizeInput(user.phone || '+595 S/N')}</div>
          </div>

          <div style="background: #FFF; border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">
              <i class="fas fa-door-open"></i> Detalles de Hospedaje
            </div>
            <div style="font-weight: 700; color: var(--primary-dark); font-size: 13.5px;">Habitación ${sanitizeInput(hab.numero || 'N/A')} - ${sanitizeInput(tipo.nombre || 'Estándar')}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Estadía: <strong>${formatDate(booking.check_in_previsto)}</strong> al <strong>${formatDate(booking.check_out_previsto)}</strong>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Duración: <strong>${nights} noche${nights > 1 ? 's' : ''}</strong> | ${booking.cantidad_huespedes || 1} Huésped(es)</div>
            <div style="font-size: 11.5px; margin-top: 2px;">
              Estado Folio: <span class="badge ${folio.estado === 'Cerrado' ? 'badge-cerrado' : 'badge-abierto'}">${folio.estado || 'Abierto'}</span>
            </div>
          </div>
        </div>

        <!-- Desglose de Cargos y Consumos -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 8px;">
          <h5 style="font-size: 13px; font-weight: 700; color: var(--primary-navy); margin: 0; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-list-ol"></i> Conceptos & Cargos del Folio
          </h5>
          <button type="button" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 3px 8px;" onclick="ReservationsModule.promptAddConsumption('${booking.id}')">
            <i class="fas fa-plus-circle"></i> Agregar Consumo
          </button>
        </div>

        <table style="width: 100%; font-size: 12.5px; border-collapse: collapse; margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 9px 12px; font-weight: 600;">Descripción del Servicio</th>
              <th style="padding: 9px 12px; text-align: center; font-weight: 600;">Cant. / Noches</th>
              <th style="padding: 9px 12px; text-align: right; font-weight: 600;">Tarifa Unit.</th>
              <th style="padding: 9px 12px; text-align: right; font-weight: 600;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 9px 12px;">
                <strong>Alojamiento: Habitación ${sanitizeInput(hab.numero || '')} (${sanitizeInput(tipo.nombre || 'Estándar')})</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${formatDate(booking.check_in_previsto)} a ${formatDate(booking.check_out_previsto)}</div>
              </td>
              <td style="padding: 9px 12px; text-align: center;">${nights}</td>
              <td style="padding: 9px 12px; text-align: right;">${formatGs(tarifaDiaria)}</td>
              <td style="padding: 9px 12px; text-align: right; font-weight: bold;">${formatGs(montoTotal)}</td>
            </tr>
            ${totalConsumos > 0 ? `
              <tr style="border-bottom: 1px solid var(--border-color); background: #FFFBEB;">
                <td style="padding: 9px 12px;">
                  <strong style="color: #B45309;"><i class="fas fa-cocktail"></i> Consumos Extras (Frigobar, Lavandería, Room Service)</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">Cargos cargados a la cuenta de la habitación</div>
                </td>
                <td style="padding: 9px 12px; text-align: center;">1</td>
                <td style="padding: 9px 12px; text-align: right;">${formatGs(totalConsumos)}</td>
                <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #B45309;">${formatGs(totalConsumos)}</td>
              </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td colspan="3" style="padding: 9px 12px; text-align: right; color: var(--primary-navy);">Total Facturable de Cuenta:</td>
              <td style="padding: 9px 12px; text-align: right; font-size: 14px; color: var(--primary-dark);">${formatGs(granTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Historial de Pagos & Señas Registradas -->
        <h5 style="font-size: 13px; font-weight: 700; color: var(--primary-navy); margin: 0 0 8px; display: flex; align-items: center; gap: 6px;">
          <i class="fas fa-receipt" style="color: var(--success);"></i> Pagos & Señas Registradas
        </h5>
        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
          ${pagos.length > 0 ? `
            <table style="width: 100%; font-size: 12.5px; border-collapse: collapse;">
              <thead>
                <tr style="background: #F0FDF4; text-align: left; color: #166534;">
                  <th style="padding: 8px 12px;">Fecha</th>
                  <th style="padding: 8px 12px;">Método de Pago</th>
                  <th style="padding: 8px 12px;">Referencia / TRX</th>
                  <th style="padding: 8px 12px; text-align: right;">Abono Recibido</th>
                </tr>
              </thead>
              <tbody>
                ${pagos.map(p => `
                  <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 8px 12px;">${formatDate(p.fecha_pago || booking.created_at)}</td>
                    <td style="padding: 8px 12px;">
                      <span class="badge" style="background: #DCFCE7; color: #166534; font-size: 10.5px;">${sanitizeInput(p.metodo_pago)}</span>
                    </td>
                    <td style="padding: 8px 12px; font-family: monospace; font-size: 11.5px; color: var(--text-muted);">${sanitizeInput(p.referencia_transaccion || 'N/A')}</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #15803D;">-${formatGs(p.monto)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : anticipo > 0 ? `
            <div style="padding: 10px 14px; background: #F0FDF4; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge" style="background: #DCFCE7; color: #166534; font-weight: bold;">
                  <i class="fas fa-check-circle"></i> Seña Abonada
                </span>
                <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">Abono de reserva garantizada</span>
              </div>
              <strong style="color: #15803D; font-size: 13.5px;">-${formatGs(anticipo)}</strong>
            </div>
          ` : `
            <div style="padding: 12px 16px; color: var(--text-muted); font-size: 12px; text-align: center;">
              Aún no se registran pagos ni señas para este folio. El huésped liquidará al check-out o mediante la app.
            </div>
          `}
        </div>

        <!-- Liquidación Impositiva SET Paraguay & Saldos -->
        <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;">
                Liquidación Impositiva SET (IVA 10%)
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Gravadas 10%: <strong>${formatGs(gravada10)}</strong></div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Liquidación IVA 10%: <strong>${formatGs(iva10)}</strong></div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Subtotal Exentas: <strong>0 Gs.</strong></div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted);">Total Facturable: <strong style="color: var(--primary-dark);">${formatGs(granTotal)}</strong></div>
              <div style="font-size: 12px; color: #15803D; margin: 3px 0;">Total Abonado / Seña: <strong>-${formatGs(anticipo)}</strong></div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
                <span style="font-size: 12px; font-weight: 600; color: var(--primary-navy);">Saldo Pendiente:</span>
                <span style="font-size: 17px; font-weight: 800; color: ${saldoPendiente > 0 ? 'var(--danger)' : 'var(--success)'}; margin-left: 6px;">
                  ${formatGs(saldoPendiente)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Auditoría de Reenvíos Anteriores con Motivos -->
        ${history.dispatches && history.dispatches.length > 0 ? `
          <div style="background: #FFF; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--primary-navy); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fas fa-history" style="color: var(--primary-blue);"></i> Auditoría de Despachos & Reenvíos (${history.dispatches.length})</span>
              <span style="font-size: 10.5px; color: var(--text-muted); font-weight: normal;">Control de recepción & caja</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${history.dispatches.map((d, idx) => `
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 6px; font-size: 11.5px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Envío #${idx + 1} • ${formatDate(d.timestamp)}</strong>
                    <span style="font-size: 10.5px; color: var(--text-muted);"><i class="fas fa-user-tag"></i> ${d.sender || 'Recepción'}</span>
                  </div>
                  ${d.reason ? `
                    <div style="margin-top: 4px; background: #EFF6FF; border-left: 3px solid #3B82F6; padding: 4px 8px; border-radius: 4px; color: #1E3A8A;">
                      <strong>Motivo de reenvío:</strong> ${sanitizeInput(d.reason)}
                    </div>
                  ` : `
                    <div style="margin-top: 3px; color: var(--text-muted); font-size: 10.5px;">
                      Primer despacho oficial de comprobante
                    </div>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('folio-modal-content').innerHTML = content;

    // Configurar estado del botón de envío de comprobante en folio
    const btnSend = document.getElementById('btn-folio-send-email');
    if (btnSend) {
      if (history.sentCount === 0) {
        btnSend.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Comprobante Digital (Brevo)';
        btnSend.className = 'btn btn-gold btn-sm';
        btnSend.title = 'Enviar comprobante oficial por primera vez al correo del huésped vía Brevo';
      } else {
        btnSend.innerHTML = `<i class="fas fa-history"></i> Reenviar Cuenta Actualizada (${history.sentCount})`;
        btnSend.className = 'btn btn-primary btn-sm';
        btnSend.title = 'Reenviar comprobante actualizado vía Brevo (solicitará motivo de auditoría)';
      }
    }

    openModal('modal-folio');
  },

  /**
   * Envía el comprobante digital legal mediante la API oficial de Brevo
   * Si ya fue enviado previamente, solicita obligatoriamente el motivo de reenvío
   */
  async sendFolioEmailCurrent() {
    if (!this.currentActiveFolioBooking) {
      showToast('Selecciona una reserva primero', 'warning');
      return;
    }

    const booking = this.currentActiveFolioBooking;
    const history = this.getFolioEmailHistory(booking.codigo_reserva);

    if (history.sentCount === 0) {
      // Primer envío: se remite directamente
      await this.dispatchBrevoEmail(booking, null);
    } else {
      // Siguientes envíos: solicitar motivo obligatorio
      const reasonInput = document.getElementById('reenvio-motivo-texto');
      if (reasonInput) reasonInput.value = '';
      openModal('modal-reenvio-motivo');
    }
  },

  /**
   * Confirma y ejecuta el reenvío tras ingresar el motivo
   */
  async confirmReenvioFolioEmail() {
    if (!this.currentActiveFolioBooking) return;
    const reasonInput = document.getElementById('reenvio-motivo-texto');
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!reason || reason.length < 4) {
      showToast('Por favor ingrese el motivo del reenvío según la normativa del despacho', 'warning');
      if (reasonInput) reasonInput.focus();
      return;
    }

    closeModal('modal-reenvio-motivo');
    await this.dispatchBrevoEmail(this.currentActiveFolioBooking, reason);
  },

  async quickSendEmail(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;

    this.currentActiveFolioBooking = booking;
    const history = this.getFolioEmailHistory(booking.codigo_reserva);

    if (history.sentCount === 0) {
      await this.dispatchBrevoEmail(booking, null);
    } else {
      const reasonInput = document.getElementById('reenvio-motivo-texto');
      if (reasonInput) reasonInput.value = '';
      openModal('modal-reenvio-motivo');
    }
  },

  async dispatchBrevoEmail(booking, reason = null) {
    const user = booking.users || {};
    const hab = booking.habitaciones || {};
    const tipo = hab.tipos_habitacion || {};
    const folio = (booking.folios && typeof booking.folios === 'object') ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios) : {};
    
    const montoTotal = Number(booking.monto_total || 0);
    const totalConsumos = Number(folio.total_consumos || 0);
    const granTotal = montoTotal + totalConsumos;
    const anticipo = folio.total_pagos !== undefined ? Number(folio.total_pagos) : Number(booking.anticipo_pagado || 0);
    const saldo = folio.saldo_pendiente !== undefined ? Number(folio.saldo_pendiente) : Math.max(0, granTotal - anticipo);
    const iva10 = Math.round(granTotal / 11);

    const clientEmail = user.email || 'rc652107@gmail.com';
    const clientName = user.full_name || 'Huésped Distinguido';

    const history = this.getFolioEmailHistory(booking.codigo_reserva);
    const currentDispatchNum = (history.sentCount || 0) + 1;

    showToast(reason 
      ? `Reenviando cuenta actualizada #${currentDispatchNum} a ${clientEmail} vía Brevo...` 
      : `Enviando comprobante oficial a ${clientEmail} vía Brevo...`, 'info');

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #D4AF37; letter-spacing: 1px;">HOTEL 3 VAGOS</h1>
          <p style="margin: 6px 0 0; font-size: 12px; color: #94A3B8;">Hospitalidad & Excelencia - UTCD Asunción</p>
        </div>

        <div style="padding: 24px;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <div style="font-size: 11px; color: #64748B;">RUC: <strong>80092341-2</strong> | Timbrado SET: <strong>16789423</strong> (Válido hasta 31/12/2026)</div>
            <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 4px;">
              ${reason ? `COMPROBANTE ACTUALIZADO (VERSIÓN #${currentDispatchNum})` : 'COMPROBANTE OFICIAL DE RESERVA & FOLIO'}
            </div>
          </div>

          ${reason ? `
            <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
              <strong style="font-size: 12px; color: #1E40AF; display: block; margin-bottom: 2px;">
                <i class="fas fa-info-circle"></i> Motivo de la actualización:
              </strong>
              <span style="font-size: 12.5px; color: #1E3A8A;">${sanitizeInput(reason)}</span>
            </div>
          ` : ''}

          <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
            Estimado/a <strong>${clientName}</strong>,<br>
            Adjuntamos el desglose oficial de tu folio y cuenta de hospedaje en Hotel 3 Vagos:
          </p>

          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px 0; color: #64748B;">Código de Reserva:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0F172A;">${booking.codigo_reserva}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px 0; color: #64748B;">Habitación:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">Hab. ${hab.numero || 'N/A'} (${tipo.nombre || 'Estándar'})</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px 0; color: #64748B;">Estadía:</td>
              <td style="padding: 8px 0; text-align: right;">${formatDate(booking.check_in_previsto)} al ${formatDate(booking.check_out_previsto)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px 0; color: #64748B;">Monto Estadía:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700;">${formatGs(montoTotal)}</td>
            </tr>
            ${totalConsumos > 0 ? `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px 0; color: #64748B;">Consumos Extras / Minibar:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #D97706;">+${formatGs(totalConsumos)}</td>
              </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #E2E8F0; background: #F0FDF4;">
              <td style="padding: 8px 6px; color: #166534; font-weight: 600;">Total Abonado / Seña:</td>
              <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #15803D;">-${formatGs(anticipo)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 8px 0; color: #64748B; font-weight: 700;">Saldo a Liquidar:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 800; color: ${saldo > 0 ? '#DC2626' : '#15803D'}; font-size: 15px;">${formatGs(saldo)}</td>
            </tr>
          </table>

    try {
      const subjectTitle = reason 
        ? `[Cuenta Actualizada #${currentDispatchNum}] Folio & Reserva ${booking.codigo_reserva} | Hotel 3 Vagos` 
        : `Comprobante de Reserva & Folio - ${booking.codigo_reserva} | Hotel 3 Vagos`;

      // Clave oficial de Brevo API
      let brevoApiKey = window.BREVO_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_API_KEY') : null);
      if (!brevoApiKey) {
        brevoApiKey = prompt('Por favor ingrese su Brevo API Key para remitir el comprobante (xkeysib-...):');
        if (brevoApiKey && brevoApiKey.trim()) {
          brevoApiKey = brevoApiKey.trim();
          localStorage.setItem('BREVO_API_KEY', brevoApiKey);
          window.BREVO_API_KEY = brevoApiKey;
        } else {
          showToast('Envío cancelado: Se requiere la API Key de Brevo', 'warning');
          return;
        }
      }
      const brevoSenderEmail = window.BREVO_SENDER_EMAIL || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_SENDER_EMAIL') : null) || 'rc652107@gmail.com';
      const brevoSenderName = 'Hotel 3 Vagos';

      console.log('Despachando correo transaccional vía Brevo API a:', clientEmail);
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: brevoSenderName, email: brevoSenderEmail.trim() },
          to: [{ email: clientEmail, name: clientName }],
          subject: subjectTitle,
          htmlContent: emailHtml
        })
      });

      const brevoData = await brevoRes.json();

      if (brevoRes.ok) {
        console.log('Brevo API response exitosa:', brevoData);

        this.saveFolioEmailDispatch(booking.codigo_reserva, {
          timestamp: new Date().toISOString(),
          recipient: clientEmail,
          reason: reason,
          sender: (typeof AppState !== 'undefined' && AppState.currentUser?.name) ? AppState.currentUser.name : 'Recepción & Caja',
          provider: 'Brevo'
        });
        this.viewFolioDetail(booking.id);
        showToast(`¡Comprobante ${reason ? 'actualizado' : ''} entregado a ${clientEmail} vía Brevo API!`, 'success');
        return;
      }

      // Si Brevo requiere autorizar la IP de origen
      if (brevoData && brevoData.message && brevoData.message.includes('authorised_ips')) {
        showToast('Brevo requiere autorizar la IP del emisor en app.brevo.com/security/authorised_ips', 'warning');
        console.warn('Brevo IP Auth necesaria:', brevoData.message);
        return;
      }

      throw new Error(brevoData.message || `Error ${brevoRes.status} en Brevo API`);

    } catch (e) {
      console.error('Error al enviar correo por Brevo:', e);
      showToast('Error al enviar por Brevo: ' + e.message, 'warning');
    }
  },

  /**
   * Apertura del Modal de Nueva Reserva con disponibilidad en tiempo real por fechas
   */
  openNewReservationModal(presetRoomId = null) {
    const roomSelect = document.getElementById('new-res-room');
    if (!roomSelect) return;

    const rooms = RoomsModule.rooms || [];
    if (rooms.length === 0) {
      showToast('Cargando habitaciones...', 'info');
      RoomsModule.loadRooms().then(() => this.openNewReservationModal(presetRoomId));
      return;
    }

    roomSelect.innerHTML = rooms.map(r => {
      const tipo = r.tipos_habitacion || {};
      const carac = (r.caracteristicas && typeof r.caracteristicas === 'object') ? r.caracteristicas : {};
      const price = carac.precio_personalizado || tipo.precio_base_noche || 150000;
      const isSelected = presetRoomId && r.id == presetRoomId ? 'selected' : '';
      return `<option value="${r.id}" data-price="${price}" data-capacidad="${tipo.capacidad_personas || 2}" ${isSelected}>
        Habitación ${sanitizeInput(r.numero)} - ${sanitizeInput(tipo.nombre || 'Estándar')} (${formatGs(price)}/noche) - [${sanitizeInput(r.estado)}]
      </option>`;
    }).join('');

    // Fechas por defecto: mañana a 3 días
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const toInputDate = (d) => d.toISOString().split('T')[0];

    const checkInInput = document.getElementById('new-res-checkin');
    const checkOutInput = document.getElementById('new-res-checkout');
    if (checkInInput) checkInInput.value = toInputDate(tomorrow);
    if (checkOutInput) checkOutInput.value = toInputDate(dayAfter);

    this.checkNewReservationAvailability();
    openModal('modal-new-reservation');
  },

  openNewReservationModalForRoom(roomId) {
    closeModal('modal-room-details');
    this.openNewReservationModal(roomId);
  },

  checkNewReservationAvailability() {
    const roomSelect = document.getElementById('new-res-room');
    const checkInInput = document.getElementById('new-res-checkin');
    const checkOutInput = document.getElementById('new-res-checkout');
    const feedbackEl = document.getElementById('new-res-availability-feedback');
    const confirmBtn = document.getElementById('new-res-confirm-btn');

    if (!roomSelect || !checkInInput || !checkOutInput || !feedbackEl) return;

    const roomId = parseInt(roomSelect.value);
    const checkInVal = checkInInput.value;
    const checkOutVal = checkOutInput.value;

    if (!roomId || !checkInVal || !checkOutVal) {
      feedbackEl.innerHTML = '';
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    const dIn = new Date(checkInVal + 'T14:00:00');
    const dOut = new Date(checkOutVal + 'T11:00:00');

    if (dOut <= dIn) {
      feedbackEl.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 10px; border-radius: 8px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-exclamation-triangle"></i>
          <span>La fecha de Check-out debe ser posterior a la fecha de Check-in.</span>
        </div>
      `;
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    // Buscar reservas existentes no canceladas para esta habitación
    const existingBookings = this.currentBookings.filter(b => {
      const bSt = (b.estado || '').toLowerCase();
      return b.habitacion_id == roomId && bSt !== 'cancelada' && bSt !== 'finalizada';
    });

    // Validar solapamiento: (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn)
    const collision = existingBookings.find(b => {
      const bIn = b.check_in_previsto ? new Date(b.check_in_previsto + 'T14:00:00') : null;
      const bOut = b.check_out_previsto ? new Date(b.check_out_previsto + 'T11:00:00') : null;
      if (!bIn || !bOut) return false;
      return dIn < bOut && dOut > bIn;
    });

    const selectedOption = roomSelect.options[roomSelect.selectedIndex];
    const pricePerNight = selectedOption ? Number(selectedOption.getAttribute('data-price') || 150000) : 150000;
    const nights = Math.max(1, Math.round((new Date(checkOutVal) - new Date(checkInVal)) / (1000 * 60 * 60 * 24)));
    const totalPrice = pricePerNight * nights;

    if (collision) {
      feedbackEl.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 10px 14px; border-radius: 8px; font-size: 12px;">
          <div style="font-weight: bold; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <i class="fas fa-calendar-times"></i> Conflicto de Fechas: Habitación Ocupada / Reservada
          </div>
          <div>Ya existe la reserva <strong>${sanitizeInput(collision.codigo_reserva)}</strong> del <strong>${formatDate(collision.check_in_previsto)}</strong> al <strong>${formatDate(collision.check_out_previsto)}</strong>. Por favor selecciona otro rango disponible.</div>
        </div>
      `;
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      feedbackEl.innerHTML = `
        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; padding: 10px 14px; border-radius: 8px; font-size: 12px;">
          <div style="font-weight: bold; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <i class="fas fa-check-circle"></i> ¡Habitación Totalmente Disponible para estas Fechas!
          </div>
          <div style="color: #15803D;">
            <strong>${nights} noche${nights > 1 ? 's' : ''}</strong> (${formatGs(pricePerNight)} x ${nights}) = <strong>Total: ${formatGs(totalPrice)}</strong>
          </div>
        </div>
      `;
      if (confirmBtn) confirmBtn.disabled = false;
    }
  },

  async confirmNewReservation() {
    try {
      const roomSelect = document.getElementById('new-res-room');
      const roomId = parseInt(roomSelect?.value);
      const checkInVal = document.getElementById('new-res-checkin')?.value;
      const checkOutVal = document.getElementById('new-res-checkout')?.value;
      const guestsCount = parseInt(document.getElementById('new-res-guests-count')?.value || 1);
      const channel = document.getElementById('new-res-channel')?.value || 'Recepción / Walk-in';
      const guestName = (document.getElementById('new-res-guest-name')?.value || '').trim();
      const guestDoc = (document.getElementById('new-res-guest-doc')?.value || '').trim();
      const guestPhone = (document.getElementById('new-res-guest-phone')?.value || '').trim();
      const guestEmail = (document.getElementById('new-res-guest-email')?.value || '').trim();

      if (!roomId || !checkInVal || !checkOutVal) {
        showToast('Completa la habitación y las fechas de estadía', 'warning');
        return;
      }

      if (!guestName) {
        showToast('Ingresa el nombre del huésped titular', 'warning');
        return;
      }

      const dIn = new Date(checkInVal + 'T14:00:00');
      const dOut = new Date(checkOutVal + 'T11:00:00');
      if (dOut <= dIn) {
        showToast('El check-out debe ser posterior al check-in', 'warning');
        return;
      }

      const selectedOption = roomSelect.options[roomSelect.selectedIndex];
      const pricePerNight = selectedOption ? Number(selectedOption.getAttribute('data-price') || 150000) : 150000;
      const nights = Math.max(1, Math.round((new Date(checkOutVal) - new Date(checkInVal)) / (1000 * 60 * 60 * 24)));
      const totalPrice = pricePerNight * nights;

      // Obtener o asignar guestId si existe
      let guestId = null;
      try {
        const { data: userFound } = await supabaseClient
          .from('users')
          .select('id')
          .or(`email.eq.${guestEmail || 'none'},document_number.eq.${guestDoc || 'none'}`)
          .limit(1)
          .maybeSingle();
        if (userFound) {
          guestId = userFound.id;
        } else {
          const { data: firstUser } = await supabaseClient.from('users').select('id').limit(1).maybeSingle();
          if (firstUser) guestId = firstUser.id;
        }
      } catch (_) {}

      const codigoReserva = 'RES-' + Math.floor(100000 + Math.random() * 900000);

      const { data: newBooking, error: bookErr } = await supabaseClient
        .from('reservas')
        .insert({
          codigo_reserva: codigoReserva,
          guest_id: guestId,
          habitacion_id: roomId,
          check_in_previsto: checkInVal,
          check_out_previsto: checkOutVal,
          cantidad_huespedes: guestsCount,
          monto_total: totalPrice,
          canal_venta: channel,
          estado: 'Confirmada'
        })
        .select()
        .single();

      if (bookErr) throw bookErr;

      // Crear Folio de cuenta
      try {
        await supabaseClient.from('folios').insert({
          reserva_id: newBooking.id,
          guest_id: guestId,
          total_alojamiento: totalPrice,
          saldo_pendiente: totalPrice,
          total_pagos: 0,
          estado: 'Abierto'
        });
      } catch (e) {
        console.warn('Folio auto-create warning:', e);
      }

      closeModal('modal-new-reservation');
      showToast(`¡Reserva ${codigoReserva} confirmada con éxito!`, 'success');

      if (typeof notifyDataChanged === 'function') {
        notifyDataChanged('reservas', { action: 'create', bookingId: newBooking.id });
      }

      await this.loadReservations();
      await DashboardModule.loadKPIs();
      await RoomsModule.loadRooms();

    } catch (err) {
      console.error('Error al confirmar nueva reserva:', err);
      showToast('Error al registrar reserva: ' + err.message, 'error');
    }
  }
};
