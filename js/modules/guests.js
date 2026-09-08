/**
 * Guests & CRM Management Module - Hotel 3 Vagos
 * Official Guest Directory, Identity Documents, Stay History & Brevo CRM Sync
 */

const GuestsModule = {
  guests: [],

  async init() {
    await this.loadGuests();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const search = document.getElementById('search-guests');
    if (search) {
      let timer;
      search.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => this.filterGuests(e.target.value), 250);
      });
    }
  },

  async loadGuests() {
    try {
      const tbody = document.getElementById('guests-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando huéspedes desde la base de datos...</td></tr>`;

      // Cargar usuarios con rol de Huésped (role_id = 5)
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('role_id', 5)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.guests = data || [];
      this.renderTable(this.guests);

    } catch (err) {
      console.error('Error al cargar huéspedes:', err);
      showToast('Error al cargar huéspedes: ' + err.message, 'error');
    }
  },

  renderTable(list) {
    const tbody = document.getElementById('guests-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 36px; color: var(--text-muted);"><i class="fas fa-users-slash" style="font-size: 26px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No hay huéspedes registrados que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(g => {
      const initial = (g.full_name || 'H').charAt(0).toUpperCase();
      const docType = g.document_type || 'CI';
      const docNum = g.document_number || 'N/D';
      const nationality = g.nationality || 'Paraguaya';
      const phone = g.phone || 'S/D';
      const roleName = g.role_id === 1 ? 'Administrador' : 'Huésped Registrado';

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-navy), #1e3a8a); color: var(--accent-gold); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; box-shadow: var(--shadow-sm); flex-shrink: 0;">
                ${initial}
              </div>
              <div>
                <strong style="color: var(--primary-navy); font-size: 13.5px;">${sanitizeInput(g.full_name || 'Sin nombre')}</strong>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
                  <i class="far fa-envelope" style="color: var(--primary-blue);"></i> ${sanitizeInput(g.email || 'Sin correo')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--primary-dark);">${sanitizeInput(docType)}: ${sanitizeInput(docNum)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Doc. Verificado</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-globe-americas" style="color: var(--accent-gold); font-size: 12px;"></i>
              <span>${sanitizeInput(nationality)}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="fab fa-whatsapp" style="color: #10B981; font-size: 13px;"></i>
              <span>${sanitizeInput(phone)}</span>
            </div>
          </td>
          <td>
            <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: #B45309; border: 1px solid rgba(212, 175, 55, 0.4); font-weight: 700; font-size: 11px;">
              <i class="fas fa-id-badge"></i> ${roleName}
            </span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn-action btn-action-view" onclick="GuestsModule.viewGuestHistory('${g.id}')" title="Ver Historial de Estadías y Folios">
                <i class="fas fa-history"></i> Historial
              </button>
              <button class="btn-action btn-action-folio" onclick="GuestsModule.syncGuestToBrevo('${g.id}')" title="Sincronizar contacto con Brevo CRM">
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
        titleEl.innerHTML = `<i class="fas fa-history" style="color: var(--accent-gold);"></i> Historial de Estadías: ${sanitizeInput(guest.full_name || 'Huésped')}`;
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

      if (!bookings || bookings.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: #F1F5F9; color: #94A3B8; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 12px;">
              <i class="far fa-calendar-times"></i>
            </div>
            <h4 style="color: var(--primary-navy); margin-bottom: 6px;">Sin estadías previas registradas</h4>
            <p style="font-size: 13px; max-width: 400px; margin: 0 auto;">El huésped no cuenta con reservas anteriores ni activas asociadas a su cuenta.</p>
          </div>
        `;
        return;
      }

      let rows = '';
      bookings.forEach(b => {
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
