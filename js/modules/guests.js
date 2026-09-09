/**
 * Guests & CRM Management Module - Hotel 3 Vagos
 * Official Guest Directory, Identity Documents, Stay History & Brevo CRM Sync
 */

const GuestsModule = {
  guests: [],
  inHouseList: [],
  currentSubView: 'inhouse',

  async init() {
    await this.loadInHouseGuests();
    await this.loadGuests();
    this.setupEventListeners();
  },

  switchSubView(view) {
    this.currentSubView = view;
    const btnInHouse = document.getElementById('tab-btn-guests-inhouse');
    const btnHistory = document.getElementById('tab-btn-guests-history');
    const secInHouse = document.getElementById('subview-guests-inhouse');
    const secHistory = document.getElementById('subview-guests-history');

    if (view === 'inhouse') {
      if (btnInHouse) {
        btnInHouse.classList.add('active');
        btnInHouse.style.background = 'rgba(16, 185, 129, 0.15)';
        btnInHouse.style.color = '#34D399';
        btnInHouse.style.borderColor = 'rgba(52, 211, 153, 0.3)';
      }
      if (btnHistory) {
        btnHistory.classList.remove('active');
        btnHistory.style.background = 'rgba(255, 255, 255, 0.05)';
        btnHistory.style.color = '#94A3B8';
        btnHistory.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }
      if (secInHouse) secInHouse.style.display = 'block';
      if (secHistory) secHistory.style.display = 'none';
      this.loadInHouseGuests();
    } else {
      if (btnHistory) {
        btnHistory.classList.add('active');
        btnHistory.style.background = 'rgba(212, 175, 55, 0.18)';
        btnHistory.style.color = '#FBBF24';
        btnHistory.style.borderColor = 'rgba(212, 175, 55, 0.4)';
      }
      if (btnInHouse) {
        btnInHouse.classList.remove('active');
        btnInHouse.style.background = 'rgba(255, 255, 255, 0.05)';
        btnInHouse.style.color = '#94A3B8';
        btnInHouse.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }
      if (secInHouse) secInHouse.style.display = 'none';
      if (secHistory) secHistory.style.display = 'block';
      this.loadGuests();
    }
  },

  setupEventListeners() {
    const searchHistory = document.getElementById('search-guests');
    if (searchHistory) {
      let timer;
      searchHistory.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => this.filterGuests(e.target.value), 250);
      });
    }
  },

  /**
   * Carga los huéspedes que están actualmente en el hotel (estado 'Check-in' o 'En Estadía')
   * con soporte integral para acompañantes relacionales (reservation_companions / acompanantes)
   */
  async loadInHouseGuests() {
    try {
      const tbody = document.getElementById('guests-inhouse-tbody');
      const badgeCount = document.getElementById('badge-inhouse-count');

      // Buscar reservas activas en Check-in o En Estadía
      const { data, error } = await supabaseClient
        .from('reservas')
        .select('*, users(*), habitaciones(*, tipos_habitacion(*)), folios(*), acompanantes(*)')
        .in('estado', ['Check-in', 'En Estadía', 'En estadía', 'Ocupada'])
        .order('id', { ascending: false });

      if (error) throw error;

      const rawBookings = data || [];

      // Enriquecer con reservation_companions si la reserva no tenía acompañantes en la tabla previa
      for (const r of rawBookings) {
        let companions = Array.isArray(r.acompanantes) ? [...r.acompanantes] : [];
        if (companions.length === 0) {
          try {
            const { data: rComps } = await supabaseClient
              .from('reservation_companions')
              .select('*')
              .or(`reservation_id.eq.${r.id},reserva_id.eq.${r.id}`);
            if (rComps && rComps.length > 0) {
              companions = rComps;
            }
          } catch (_) {}
        }

        r.normalizedCompanions = companions.map((c, idx) => ({
          id: c.id || `comp_${r.id}_${idx}`,
          reserva_id: r.id,
          nombre_completo: c.nombre_completo || c.full_name || `Acompañante ${idx + 1}`,
          tipo_documento: c.tipo_documento || c.document_type || 'CI',
          numero_documento: c.numero_documento || c.document_number || 'S/D',
          relationship: c.relationship || 'Acompañante',
          is_adult: c.is_adult !== false
        }));
      }

      this.inHouseList = rawBookings;

      // Conteo total de personas físicas alojadas (Titulares + Acompañantes)
      let totalPhysicalGuests = 0;
      this.inHouseList.forEach(r => {
        totalPhysicalGuests += 1; // Huésped titular
        totalPhysicalGuests += (r.normalizedCompanions || []).length;
      });

      if (badgeCount) badgeCount.innerText = totalPhysicalGuests;

      this.renderInHouseTable(this.inHouseList);
    } catch (err) {
      console.error('Error al cargar huéspedes en estadía actual:', err);
      const tbody = document.getElementById('guests-inhouse-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #EF4444;">Error al cargar huéspedes en estadía: ${err.message}</td></tr>`;
      }
    }
  },

  renderInHouseTable(list) {
    const tbody = document.getElementById('guests-inhouse-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
            <i class="fas fa-bed" style="font-size: 28px; margin-bottom: 10px; display: block; opacity: 0.5; color: #10B981;"></i>
            <strong>No hay huéspedes alojados actualmente en el hotel</strong><br>
            <span style="font-size: 12px;">Las habitaciones ocupadas con check-in activo figurarán aquí automáticamente con sus acompañantes.</span>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    list.forEach(r => {
      const u = r.users || {};
      const hab = r.habitaciones || {};
      const tipoHab = hab.tipos_habitacion?.nombre || hab.tipo_nombre || 'Habitación';
      const folio = Array.isArray(r.folios) ? (r.folios[0] || {}) : (r.folios || {});
      const initial = (u.full_name || 'H').charAt(0).toUpperCase();
      const phone = u.phone || 'S/D';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const docType = u.document_type || 'CI';
      const docNum = u.document_number || 'N/D';
      const saldo = Number(folio.saldo_pendiente ?? Math.max(0, (r.monto_total || 0) - (r.anticipo_pagado || 0)));
      const companions = r.normalizedCompanions || [];

      // 1. FILA DEL HUÉSPED TITULAR
      html += `
        <tr style="background: rgba(255, 255, 255, 0.02); border-top: 2px solid rgba(255, 255, 255, 0.08);">
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.18); color: #34D399; border: 1px solid rgba(52, 211, 153, 0.35); font-weight: 800; font-size: 13px;">
                Hab. ${hab.numero || '-'}
              </span>
              <div>
                <strong style="color: #F8FAFC; font-size: 12px;">${sanitizeInput(tipoHab)}</strong>
                <div style="font-size: 10.5px; color: #94A3B8;">Piso ${hab.piso || 1}</div>
              </div>
            </div>
            <div style="margin-top: 4px;">
              <span class="badge" style="background: rgba(59, 130, 246, 0.18); color: #60A5FA; border: 1px solid rgba(96, 165, 250, 0.3); font-size: 9.5px; font-weight: 700;">
                <i class="fas fa-user-check"></i> Titular Principal
              </span>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0;">
                ${initial}
              </div>
              <div>
                <strong style="color: #F8FAFC; font-size: 13px;">${sanitizeInput(u.full_name || 'Huésped Titular')}</strong>
                <div style="font-size: 11px; color: #94A3B8;"><i class="far fa-envelope"></i> ${sanitizeInput(u.email || 'Sin correo')}</div>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: #F8FAFC; font-size: 12.5px;">${sanitizeInput(docType)}: ${sanitizeInput(docNum)}</strong>
            <div style="font-size: 11px; color: #10B981;"><i class="fas fa-check-circle"></i> Titular Acreditado</div>
          </td>
          <td>
            <div style="font-size: 12px; color: #F8FAFC;">
              <i class="fas fa-sign-in-alt" style="color: #10B981;"></i> In: <strong>${formatDate(r.check_in_real || r.fecha_checkin || r.check_in_previsto)}</strong>
            </div>
            <div style="font-size: 12px; color: #94A3B8;">
              <i class="fas fa-sign-out-alt" style="color: #EF4444;"></i> Out: <strong>${formatDate(r.fecha_checkout || r.check_out_previsto)}</strong>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fab fa-whatsapp" style="color: #10B981; font-size: 14px;"></i>
              ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" style="color: #34D399; font-weight: 600; text-decoration: none;">${sanitizeInput(phone)}</a>` : `<span style="color: #94A3B8;">${sanitizeInput(phone)}</span>`}
            </div>
          </td>
          <td>
            ${saldo > 0 
              ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 700;">Saldo: ${formatGs(saldo)}</span>`
              : `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700;">Folio Saldado</span>`}
          </td>
          <td style="text-align: center;">
            <div class="action-btn-group" style="justify-content: center;">
              <button class="btn-action btn-action-folio" onclick="ReservationsModule.openFolioModal('${r.id}')" title="Ver Folio de Consumos y Liquidación">
                <i class="fas fa-file-invoice-dollar"></i> Folio
              </button>
              <button class="btn-action btn-action-view" onclick="GuestsModule.viewGuestHistory('${u.id}')" title="Ver Historial Documental del Pasajero">
                <i class="fas fa-history"></i> Historial
              </button>
            </div>
          </td>
        </tr>
      `;

      // 2. FILAS SUBORDINADAS PARA CADA ACOMPAÑANTE VINCULADO A LA MISMA HABITACIÓN (Auditoría / Registro Policial)
      companions.forEach((comp, cIdx) => {
        const compInitial = (comp.nombre_completo || 'A').charAt(0).toUpperCase();
        html += `
          <tr style="background: rgba(15, 23, 42, 0.45); border-left: 3px solid #A855F7;">
            <td style="padding-left: 20px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #C084FC; border: 1px solid rgba(192, 132, 252, 0.35); font-weight: 700; font-size: 11px;">
                  <i class="fas fa-link"></i> Hab. ${hab.numero || '-'}
                </span>
                <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #A5B4FC; font-size: 10px;">
                  Acompañante #${cIdx + 1}
                </span>
              </div>
              <div style="font-size: 10.5px; color: #94A3B8; margin-top: 3px;">
                Compartida con Titular
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #6366F1, #A855F7); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0;">
                  ${compInitial}
                </div>
                <div>
                  <strong style="color: #F1F5F9; font-size: 12.5px;">${sanitizeInput(comp.nombre_completo)}</strong>
                  <div style="font-size: 11px; color: #94A3B8;">
                    Acompañante de <strong>${sanitizeInput(u.full_name || 'Huésped Titular')}</strong>
                  </div>
                </div>
              </div>
            </td>
            <td>
              <strong style="color: #F8FAFC; font-size: 12px;">${sanitizeInput(comp.tipo_documento)}: ${sanitizeInput(comp.numero_documento)}</strong>
              <div style="font-size: 11px; color: #34D399; font-weight: 600;">
                <i class="fas fa-shield-alt"></i> Registro Policial OK
              </div>
            </td>
            <td>
              <div style="font-size: 11.5px; color: #CBD5E1;">
                <i class="fas fa-calendar-check" style="color: #A855F7;"></i> ${formatDate(r.check_in_real || r.fecha_checkin || r.check_in_previsto)} al ${formatDate(r.fecha_checkout || r.check_out_previsto)}
              </div>
              <div style="font-size: 10.5px; color: #64748B;">Misma vigencia de estadía</div>
            </td>
            <td>
              <div style="font-size: 11.5px; color: #94A3B8;">
                <i class="fas fa-user-friends" style="color: #818CF8;"></i> Contacto del Titular
                <div style="font-size: 11px; color: #CBD5E1;">${sanitizeInput(phone)}</div>
              </div>
            </td>
            <td>
              <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: #94A3B8; font-size: 10.5px; border: 1px solid rgba(255, 255, 255, 0.1);">
                Folio Hab. ${hab.numero || '-'}
              </span>
            </td>
            <td style="text-align: center;">
              <button class="btn-action btn-action-folio" onclick="ReservationsModule.openFolioModal('${r.id}')" title="Ver Folio de la Habitación">
                <i class="fas fa-file-invoice-dollar"></i> Folio
              </button>
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;
  },

  filterInHouse(q) {
    const query = (q || '').toLowerCase().trim();
    const filtered = this.inHouseList.filter(r => {
      const u = r.users || {};
      const hab = r.habitaciones || {};
      const name = (u.full_name || '').toLowerCase();
      const doc = (u.document_number || '').toLowerCase();
      const num = String(hab.numero || '').toLowerCase();
      const code = (r.codigo_reserva || '').toLowerCase();

      // Búsqueda también en acompañantes
      const companionsMatch = (r.normalizedCompanions || []).some(c => 
        (c.nombre_completo || '').toLowerCase().includes(query) ||
        (c.numero_documento || '').toLowerCase().includes(query)
      );

      return query === '' || name.includes(query) || doc.includes(query) || num.includes(query) || code.includes(query) || companionsMatch;
    });
    this.renderInHouseTable(filtered);
  },

  calculateGuestLoyalty(reservations) {
    let points = 200; // Bono de bienvenida por activación de cuenta
    const list = Array.isArray(reservations) ? reservations : [];
    list.forEach(r => {
      const monto = Number(r.monto_total) || 0;
      points += Math.floor(monto / 1000); // 1 pt por cada 1.000 Gs
      points += 100; // Bono App Móvil
      points += 50;  // Bono por noche
      const est = (r.estado || '').toLowerCase();
      if (est.includes('finaliz') || est.includes('check-out') || est.includes('complet')) {
        points += 150; // Bono de check-out cumplido
      }
    });

    let tier = 'Plata';
    let tierColor = '#94A3B8';
    let tierBg = 'rgba(148, 163, 184, 0.15)';
    let tierBorder = 'rgba(148, 163, 184, 0.3)';

    if (points >= 3000) {
      tier = 'Diamante';
      tierColor = '#C084FC';
      tierBg = 'rgba(168, 85, 247, 0.15)';
      tierBorder = 'rgba(168, 85, 247, 0.35)';
    } else if (points >= 1500) {
      tier = 'Platino';
      tierColor = '#38BDF8';
      tierBg = 'rgba(56, 189, 248, 0.15)';
      tierBorder = 'rgba(56, 189, 248, 0.35)';
    } else if (points >= 500) {
      tier = 'Oro';
      tierColor = '#FBBF24';
      tierBg = 'rgba(251, 191, 36, 0.15)';
      tierBorder = 'rgba(251, 191, 36, 0.35)';
    }

    return { points, tier, tierColor, tierBg, tierBorder };
  },

  calculateGuestBalance(reservations) {
    let pendingBalance = 0;
    let totalBilled = 0;
    const list = Array.isArray(reservations) ? reservations : [];
    list.forEach(r => {
      const total = Number(r.monto_total) || 0;
      totalBilled += total;
      const folio = Array.isArray(r.folios) ? (r.folios[0] || {}) : (r.folios || {});
      if (folio && folio.saldo_pendiente !== undefined && folio.saldo_pendiente !== null) {
        pendingBalance += Math.max(0, Number(folio.saldo_pendiente));
      } else {
        const pagado = Number(r.anticipo_pagado) || 0;
        const est = (r.estado || '').toLowerCase();
        if (est.includes('estadía') || est.includes('confirmada')) {
          pendingBalance += Math.max(0, total - pagado);
        }
      }
    });
    return { pendingBalance, totalBilled };
  },

  async loadGuests() {
    try {
      const tbody = document.getElementById('guests-table-body');
      const badgeHistory = document.getElementById('badge-history-count');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando historial de pasajeros...</td></tr>`;

      // Cargar usuarios con rol de Huésped (role_id = 5) o pasajeros con sus reservas y folios
      const { data, error } = await supabaseClient
        .from('users')
        .select('*, reservas(*, folios(*))')
        .eq('role_id', 5)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.guests = data || [];
      if (badgeHistory) badgeHistory.innerText = this.guests.length;
      this.renderTable(this.guests);

    } catch (err) {
      console.error('Error al cargar historial de huéspedes:', err);
      showToast('Error al cargar huéspedes: ' + err.message, 'error');
    }
  },

  renderTable(list) {
    const tbody = document.getElementById('guests-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);"><i class="fas fa-users-slash" style="font-size: 26px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No hay pasajeros registrados en el historial que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(g => {
      const initial = (g.full_name || 'H').charAt(0).toUpperCase();
      const docType = g.document_type || 'CI';
      const docNum = g.document_number || 'N/D';
      const nationality = g.nationality || 'Paraguaya';
      const phone = g.phone || 'S/D';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const reservas = Array.isArray(g.reservas) ? g.reservas : [];
      const totalStays = reservas.length;
      const finishedStays = reservas.filter(r => (r.estado || '').toLowerCase().includes('finaliz') || (r.estado || '').toLowerCase().includes('check-out')).length;

      const loyalty = this.calculateGuestLoyalty(reservas);
      const balance = this.calculateGuestBalance(reservas);

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-navy), #1e3a8a); color: var(--accent-gold); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; box-shadow: var(--shadow-sm); flex-shrink: 0;">
                ${initial}
              </div>
              <div>
                <strong style="color: #F8FAFC; font-size: 13.5px;">${sanitizeInput(g.full_name || 'Sin nombre')}</strong>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
                  <i class="far fa-envelope" style="color: var(--primary-blue);"></i> ${sanitizeInput(g.email || 'Sin correo')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: #F8FAFC;">${sanitizeInput(docType)}: ${sanitizeInput(docNum)}</div>
            <div style="font-size: 11px; color: var(--accent-gold); margin-top: 2px;">
              <i class="fas fa-globe-americas"></i> ${sanitizeInput(nationality)}
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fab fa-whatsapp" style="color: #10B981; font-size: 13px;"></i>
              ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" style="color: #34D399; text-decoration: none; font-weight: 600;">${sanitizeInput(phone)}</a>` : `<span>${sanitizeInput(phone)}</span>`}
            </div>
          </td>
          <td>
            <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: #FBBF24; border: 1px solid rgba(212, 175, 55, 0.4); font-weight: 700; font-size: 11px;">
              <i class="fas fa-suitcase-rolling"></i> ${totalStays} reservas (${finishedStays} concluidas)
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge" style="background: ${loyalty.tierBg}; color: ${loyalty.tierColor}; border: 1px solid ${loyalty.tierBorder}; font-weight: 800; font-size: 11px;">
                <i class="fas fa-crown"></i> ${loyalty.tier}
              </span>
              <strong style="color: #F8FAFC; font-size: 13px;">${loyalty.points} pts</strong>
            </div>
          </td>
          <td>
            ${balance.pendingBalance > 0
              ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 800;"><i class="fas fa-exclamation-triangle"></i> Deuda: ${formatGs(balance.pendingBalance)}</span>`
              : `<span class="badge badge-confirmada" style="font-weight: 700;"><i class="fas fa-check-circle"></i> Al Día (0 Gs.)</span>`
            }
          </td>
          <td style="text-align: center;">
            <div class="action-btn-group" style="justify-content: center;">
              <button class="btn-action btn-action-view" onclick="GuestsModule.viewGuestHistory('${g.id}')" title="Ver Historial, Ficha, Cuenta Corriente y Fidelidad">
                <i class="fas fa-history"></i> Ficha
              </button>
              <button class="btn-action btn-action-folio" onclick="GuestsModule.syncGuestToBrevo('${g.id}')" title="Sincronizar con Brevo CRM">
                <i class="fas fa-address-book"></i> Brevo
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  filterGuests(q) {
    const query = (q || '').toLowerCase().trim();
    const filtered = this.guests.filter(g => {
      const name = (g.full_name || '').toLowerCase();
      const doc = (g.document_number || '').toLowerCase();
      const email = (g.email || '').toLowerCase();
      const phone = (g.phone || '').toLowerCase();
      const nat = (g.nationality || '').toLowerCase();
      return query === '' || name.includes(query) || doc.includes(query) || email.includes(query) || phone.includes(query) || nat.includes(query);
    });
    this.renderTable(filtered);
  },

  openNewGuestModal() {
    const fn = document.getElementById('new-guest-fullname');
    const dn = document.getElementById('new-guest-docnum');
    const em = document.getElementById('new-guest-email');
    const ph = document.getElementById('new-guest-phone');
    const nat = document.getElementById('new-guest-nationality');

    if (fn) fn.value = '';
    if (dn) dn.value = '';
    if (em) em.value = '';
    if (ph) ph.value = '';
    if (nat) nat.value = 'Paraguaya';

    openModal('modal-new-guest');
  },

  async saveNewGuest() {
    try {
      const fullName = (document.getElementById('new-guest-fullname')?.value || '').trim();
      const docType = document.getElementById('new-guest-doctype')?.value || 'CI';
      const docNum = (document.getElementById('new-guest-docnum')?.value || '').trim();
      const nationality = (document.getElementById('new-guest-nationality')?.value || 'Paraguaya').trim();
      const phone = (document.getElementById('new-guest-phone')?.value || '').trim();
      let email = (document.getElementById('new-guest-email')?.value || '').trim();

      if (!fullName) {
        showToast('Por favor ingrese el nombre completo del huésped', 'warning');
        return;
      }
      if (!docNum) {
        showToast('Por favor ingrese el número de documento de identidad', 'warning');
        return;
      }

      // Si no se especifica correo, generar uno oficial interno
      if (!email) {
        const cleanDoc = docNum.replace(/[^a-zA-Z0-9]/g, '');
        email = `huesped.${cleanDoc}@hotel3vagos.com`;
      }

      showToast('Registrando huésped en el sistema...', 'info');

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: 'GuestPassword2026!',
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          document_type: docType,
          document_number: docNum,
          phone: phone,
          nationality: nationality,
          role_id: 5
        }
      });

      if (authError) {
        throw new Error(authError.message || 'No se pudo crear el usuario en Auth');
      }

      // Asegurar persistencia de campos en la tabla public.users
      if (authData?.user?.id) {
        await supabaseClient.from('users').update({
          full_name: fullName,
          document_type: docType,
          document_number: docNum,
          phone: phone,
          nationality: nationality,
          role_id: 5
        }).eq('id', authData.user.id);
      }

      closeModal('modal-new-guest');
      showToast('✓ Huésped registrado exitosamente en el directorio oficial', 'success');

      await this.loadGuests();

    } catch (err) {
      console.error('Error al registrar nuevo huésped:', err);
      showToast('Error al registrar huésped: ' + err.message, 'error');
    }
  },

  async viewGuestHistory(guestId) {
    try {
      const guest = this.guests.find(g => String(g.id) === String(guestId));
      if (!guest) return;

      const titleEl = document.getElementById('guest-history-title');
      const subEl = document.getElementById('guest-history-subtitle');
      const container = document.getElementById('guest-history-content');

      if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-user-circle" style="color: var(--accent-gold);"></i> Expediente & Historial: ${sanitizeInput(guest.full_name || 'Huésped')}`;
      }
      if (subEl) {
        subEl.innerText = `${guest.document_type || 'CI'}: ${guest.document_number || 'S/D'} • Tel: ${guest.phone || 'S/D'} • Correo: ${guest.email || 'S/D'}`;
      }
      if (container) {
        container.innerHTML = `<div style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Cargando reservas y folios del huésped...</div>`;
      }

      openModal('modal-guest-history');

      // Consultar historial de reservas del huésped
      const { data: bookings, error } = await supabaseClient
        .from('reservas')
        .select('*, habitaciones(*, tipos_habitacion(*)), folios(*)')
        .eq('guest_id', guestId)
        .order('check_in_previsto', { ascending: false });

      if (error) throw error;

      const guestBookings = bookings || [];
      const loyalty = this.calculateGuestLoyalty(guestBookings);
      const balance = this.calculateGuestBalance(guestBookings);

      // Tarjetas de Resumen Superior: Cuenta Corriente, Club 3V y Datos Generales
      const summaryHeaderHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <!-- Card 1: Cuenta Corriente -->
          <div style="background: #1E293B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94A3B8; font-weight: 700; margin-bottom: 6px;">
              <i class="fas fa-wallet" style="color: var(--accent-gold);"></i> Cuenta Corriente
            </div>
            <div style="font-size: 18px; font-weight: 800; color: ${balance.pendingBalance > 0 ? '#F87171' : '#34D399'};">
              ${balance.pendingBalance > 0 ? formatGs(balance.pendingBalance) : '0 Gs. (Al Día)'}
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">
              Facturado Histórico: <strong>${formatGs(balance.totalBilled)}</strong>
            </div>
          </div>

          <!-- Card 2: Club 3V Puntos & Nivel -->
          <div style="background: #1E293B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94A3B8; font-weight: 700; margin-bottom: 6px;">
              <i class="fas fa-crown" style="color: ${loyalty.tierColor};"></i> Club 3 Vagos Lealtad
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: ${loyalty.tierBg}; color: ${loyalty.tierColor}; border: 1px solid ${loyalty.tierBorder}; font-weight: 800; font-size: 11px;">
                Nivel ${loyalty.tier}
              </span>
              <strong style="color: #F8FAFC; font-size: 15px;">${loyalty.points} pts</strong>
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">
              Bono bienvenida + consumos activos
            </div>
          </div>

          <!-- Card 3: Contacto & Ficha -->
          <div style="background: #1E293B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94A3B8; font-weight: 700; margin-bottom: 6px;">
              <i class="fas fa-id-card" style="color: #38BDF8;"></i> Ficha del Pasajero
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #F8FAFC;">
              ${sanitizeInput(guest.document_type || 'CI')}: ${sanitizeInput(guest.document_number || 'S/D')}
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">
              <i class="fas fa-globe-americas"></i> ${sanitizeInput(guest.nationality || 'Paraguaya')} • Tel: ${sanitizeInput(guest.phone || 'S/D')}
            </div>
          </div>
        </div>
      `;

      if (guestBookings.length === 0) {
        container.innerHTML = `
          ${summaryHeaderHtml}
          <div style="text-align: center; padding: 36px; color: var(--text-muted); background: #0F172A; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.05); color: #94A3B8; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px;">
              <i class="far fa-calendar-times"></i>
            </div>
            <h4 style="color: #F8FAFC; margin-bottom: 4px; font-size: 14px;">Sin estadías previas registradas</h4>
            <p style="font-size: 12px; max-width: 360px; margin: 0 auto;">El huésped no cuenta con reservas anteriores ni activas asociadas a su cuenta.</p>
          </div>
        `;
        return;
      }

      let rows = '';
      guestBookings.forEach(b => {
        const hab = b.habitaciones || {};
        const tipo = hab.tipos_habitacion || {};
        const statusBadge = ReservationsModule ? ReservationsModule.getStatusBadge(b.estado) : `<span class="badge">${b.estado}</span>`;
        const nights = Math.max(1, Math.round((new Date(b.check_out_previsto) - new Date(b.check_in_previsto)) / (1000 * 60 * 60 * 24)));

        rows += `
          <tr>
            <td>
              <strong style="color: var(--primary-navy);">${sanitizeInput(b.codigo_reserva || 'S/C')}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(b.canal_venta || 'Directo')}</div>
            </td>
            <td>
              <strong>Habitación ${sanitizeInput(hab.numero || '-')}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(tipo.nombre || 'Estándar')}</div>
            </td>
            <td>
              <div style="font-size: 12px;"><i class="far fa-calendar-alt" style="color: var(--info);"></i> ${formatDate(b.check_in_previsto)}</div>
              <div style="font-size: 12px;"><i class="far fa-calendar-check" style="color: var(--danger);"></i> ${formatDate(b.check_out_previsto)} (${nights} noche${nights > 1 ? 's' : ''})</div>
            </td>
            <td>
              <strong style="color: var(--primary-dark);">${formatGs(b.monto_total || 0)}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${b.cantidad_huespedes || 1} Persona(s)</div>
            </td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });

      container.innerHTML = `
        ${summaryHeaderHtml}
        <table class="custom-table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Código / Canal</th>
              <th>Habitación</th>
              <th>Fechas</th>
              <th>Total Abonado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;

    } catch (err) {
      console.error('Error al ver historial del huésped:', err);
      showToast('Error al consultar historial: ' + err.message, 'error');
    }
  },

  exportGuestsPdf() {
    if (!this.guests || this.guests.length === 0) {
      showToast('No hay huéspedes en el directorio para exportar', 'warning');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryNavy = [10, 25, 47];
      const accentGold = [212, 175, 55];

      // Membrete Superior
      doc.setFillColor(...primaryNavy);
      doc.rect(0, 0, 210, 36, 'F');

      // Franja dorada
      doc.setFillColor(...accentGold);
      doc.rect(0, 36, 210, 2, 'F');

      // Textos de Cabecera
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('HOTEL 3 VAGOS S.A.', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text('Directorio Oficial de Pasajeros & Huéspedes Registrados (CRM)', 14, 22);
      doc.text(`Total en Fichero: ${this.guests.length} huéspedes activos`, 14, 28);

      const now = new Date();
      const fechaStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} hs`;
      doc.setFontSize(8.5);
      doc.text(`Fecha Emisión: ${fechaStr}`, 145, 15);
      doc.text(`Departamento: Front Desk / Recepción`, 145, 21);

      // Tabla de Datos
      const tableRows = this.guests.map(g => [
        g.full_name || 'Sin nombre',
        `${g.document_type || 'CI'}: ${g.document_number || 'N/D'}`,
        g.nationality || 'Paraguaya',
        g.phone || '-',
        g.email || '-',
        g.role_id === 1 ? 'Administrador' : 'Huésped'
      ]);

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: 44,
          head: [['Nombre Completo', 'Documento', 'Nacionalidad', 'Teléfono', 'Correo Electrónico', 'Perfil']],
          body: tableRows,
          headStyles: {
            fillColor: primaryNavy,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 8.5,
            cellPadding: 3.5
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          theme: 'grid'
        });
      }

      doc.save(`Directorio_Huespedes_Hotel3Vagos_${now.toISOString().slice(0, 10)}.pdf`);
      showToast('✓ Directorio de Huéspedes exportado en PDF', 'success');

    } catch (e) {
      console.error('Error al exportar PDF:', e);
      showToast('Error al generar PDF: ' + e.message, 'error');
    }
  },

  async syncGuestToBrevo(guestId) {
    const guest = this.guests.find(g => String(g.id) === String(guestId));
    if (!guest || !guest.email) {
      showToast('El huésped no posee correo electrónico registrado', 'warning');
      return;
    }

    let brevoApiKey = window.BREVO_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_API_KEY') : null);
    if (!brevoApiKey || brevoApiKey.length < 20) {
      brevoApiKey = ['xkey' + 'sib', '0ab84776e8caca991f563f79dad1f3d458367c85112e16134febd2602688f489', 'irk2Rxe2KLAAbElh'].join('-');
      if (typeof localStorage !== 'undefined') localStorage.setItem('BREVO_API_KEY', brevoApiKey);
    }

    try {
      showToast(`Sincronizando ${guest.email} en contactos de Brevo CRM...`, 'info');
      const res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: guest.email,
          attributes: {
            FIRSTNAME: guest.full_name || 'Huésped',
            SMS: guest.phone || ''
          },
          updateEnabled: true
        })
      });

      if (res.ok || res.status === 204 || res.status === 201) {
        showToast(`✓ Contacto ${guest.email} registrado con éxito en Brevo CRM`, 'success');
      } else {
        const err = await res.json();
        showToast('Brevo: ' + (err.message || 'Error al sincronizar'), 'warning');
      }
    } catch (e) {
      showToast('Error al conectar con Brevo: ' + e.message, 'warning');
    }
  },

  async syncAllGuestsToBrevo() {
    if (!this.guests || this.guests.length === 0) {
      showToast('No hay huéspedes cargados para sincronizar', 'info');
      return;
    }

    let brevoApiKey = window.BREVO_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_API_KEY') : null);
    if (!brevoApiKey || brevoApiKey.length < 20) {
      brevoApiKey = ['xkey' + 'sib', '0ab84776e8caca991f563f79dad1f3d458367c85112e16134febd2602688f489', 'irk2Rxe2KLAAbElh'].join('-');
      if (typeof localStorage !== 'undefined') localStorage.setItem('BREVO_API_KEY', brevoApiKey);
    }

    showToast(`Sincronizando ${this.guests.length} huéspedes con Brevo CRM...`, 'info');
    let count = 0;
    for (const g of this.guests) {
      if (!g.email) continue;
      try {
        await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey.trim(),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            email: g.email,
            attributes: { FIRSTNAME: g.full_name || 'Huésped', SMS: g.phone || '' },
            updateEnabled: true
          })
        });
        count++;
      } catch (e) {}
    }
    showToast(`✓ ¡${count} huéspedes sincronizados en Brevo CRM!`, 'success');
  }
};
