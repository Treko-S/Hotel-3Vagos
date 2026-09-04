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

  async loadReservations() {
    try {
      const tbody = document.getElementById('reservations-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando reservas...</td></tr>`;

      const { data, error } = await supabaseClient
        .from('reservas')
        .select('*, habitaciones(*, tipos_habitacion(*)), folios(*), acompanantes(*)')
        .order('id', { ascending: false });

      if (error) throw error;

      this.currentBookings = data || [];
      this.renderTable(this.currentBookings);

    } catch (err) {
      console.error('Error al cargar reservas:', err);
      showToast('Error al cargar reservas: ' + err.message, 'error');
    }
  },

  renderTable(list) {
    const tbody = document.getElementById('reservations-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No se encontraron reservas registradas.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(b => {
      const hab = b.habitaciones || {};
      const tipo = hab.tipos_habitacion || {};
      const folio = (b.folios && b.folios.length > 0) ? b.folios[0] : {};
      const saldoPendiente = folio.saldo_pendiente !== undefined ? folio.saldo_pendiente : b.monto_total;

      const estadoBadge = this.getStatusBadge(b.estado);

      html += `
        <tr>
          <td>
            <strong style="color: var(--primary-navy);">${sanitizeInput(b.codigo_reserva)}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(b.canal_venta || 'Web')}</div>
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
            <div>${b.cantidad_huespedes || 1} pers.</div>
            ${b.acompanantes && b.acompanantes.length > 0 ? `
              <span class="badge badge-confirmada" style="font-size: 9.5px; padding: 2px 6px; cursor: help; margin-top: 3px; display: inline-block;" title="${b.acompanantes.map(a => a.full_name).join(', ')}">
                <i class="fas fa-users"></i> +${b.acompanantes.length} legal
              </span>
            ` : ''}
          </td>
          <td>
            <div style="font-weight: bold; color: var(--primary-dark);">${formatGs(b.monto_total)}</div>
            <div style="font-size: 11px; color: ${saldoPendiente > 0 ? 'var(--danger)' : 'var(--success)'};">
              Saldo: ${formatGs(saldoPendiente)}
            </div>
          </td>
          <td>${estadoBadge}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${b.estado !== 'Check-in' && b.estado !== 'Finalizada' && b.estado !== 'Cancelada' ? `
                <button class="btn btn-sm btn-primary" onclick="ReservationsModule.openCheckInModal(${b.id})" title="Realizar Check-in">
                  <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
              ` : ''}

              ${b.estado === 'Check-in' || b.estado === 'En estadía' ? `
                <button class="btn btn-sm btn-gold" onclick="ReservationsModule.openCheckOutModal(${b.id})" title="Realizar Check-out y Cobro">
                  <i class="fas fa-sign-out-alt"></i> Check-out
                </button>
              ` : ''}

              <button class="btn btn-sm btn-outline" onclick="ReservationsModule.viewFolioDetail(${b.id})" title="Ver Folio / Cuenta">
                <i class="fas fa-file-invoice-dollar"></i>
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
      const state = (b.estado || '').toUpperCase();

      const matchesQuery = q === '' || code.includes(q) || hab.includes(q);
      const matchesStatus = statusFilter === 'ALL' || state === statusFilter.toUpperCase();

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

    const folio = (booking.folios && booking.folios.length > 0) ? booking.folios[0] : {};
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

    const folio = (booking.folios && booking.folios.length > 0) ? booking.folios[0] : {};
    const hab = booking.habitaciones || {};

    const content = `
      <div style="padding: 10px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--primary-navy); padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h4 style="color: var(--primary-navy); font-size: 18px;">Folio de Cuenta #${folio.id || booking.id}</h4>
            <p style="font-size: 12px; color: var(--text-muted);">Reserva: ${booking.codigo_reserva}</p>
          </div>
          <div style="text-align: right;">
            <span class="badge ${folio.estado === 'Cerrado' ? 'badge-cerrado' : 'badge-abierto'}">${folio.estado || 'Abierto'}</span>
            <p style="font-size: 11px; margin-top: 4px;">Hab. ${hab.numero || 'N/A'}</p>
          </div>
        </div>

        <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 8px;">Concepto</th>
              <th style="padding: 8px; text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 8px;">Hospedaje (${formatDate(booking.check_in_previsto)} al ${formatDate(booking.check_out_previsto)})</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${formatGs(booking.monto_total)}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 8px; color: var(--success);"><i class="fas fa-arrow-down"></i> Pagos Registrados</td>
              <td style="padding: 8px; text-align: right; color: var(--success); font-weight: bold;">-${formatGs(folio.total_pagos || 0)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background: var(--bg-main); padding: 14px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--primary-navy);">Saldo Pendiente:</strong>
          <span style="font-size: 18px; font-weight: bold; color: var(--accent-gold);">${formatGs(folio.saldo_pendiente !== undefined ? folio.saldo_pendiente : booking.monto_total)}</span>
        </div>
      </div>
    `;

    document.getElementById('folio-modal-content').innerHTML = content;
    openModal('modal-folio');
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
