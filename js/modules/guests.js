/**
 * Guests & CRM Management Module
 * Personal data, documents, stay history & contact details
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
        timer = setTimeout(() => this.filterGuests(e.target.value), 300);
      });
    }
  },

  async loadGuests() {
    try {
      const tbody = document.getElementById('guests-table-body');
      if (!tbody) return;

      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando huéspedes...</td></tr>`;

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
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay huéspedes registrados.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(g => {
      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--info-bg); color: var(--primary-navy); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${(g.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>${sanitizeInput(g.full_name || 'Sin nombre')}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${sanitizeInput(g.email || '')}</div>
              </div>
            </div>
          </td>
          <td><strong>${sanitizeInput(g.document_type || 'CI')}:</strong> ${sanitizeInput(g.document_number || 'N/D')}</td>
          <td>${sanitizeInput(g.nationality || 'Paraguaya')}</td>
          <td>${sanitizeInput(g.phone || '-')}</td>
          <td><span class="badge badge-confirmada">${g.role_id === 1 ? 'Administrador' : 'Huésped'}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="showToast('Historial cargado para ${sanitizeInput(g.full_name)}', 'info')">
              <i class="fas fa-history"></i> Historial
            </button>
            <button class="btn btn-sm btn-outline" style="color: #0284C7; border-color: #BAE6FD;" onclick="GuestsModule.syncGuestToBrevo('${g.id}')" title="Registrar / Sincronizar Huésped en Brevo CRM">
              <i class="fas fa-address-book"></i> Brevo
            </button>
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
      return query === '' || name.includes(query) || doc.includes(query) || email.includes(query);
    });
    this.renderTable(filtered);
  },

  async syncGuestToBrevo(guestId) {
    const guest = this.guests.find(g => g.id === guestId);
    if (!guest || !guest.email) {
      showToast('El huésped no posee correo electrónico registrado', 'warning');
      return;
    }

    let brevoApiKey = window.BREVO_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_API_KEY') : null);
    if (!brevoApiKey) {
      brevoApiKey = prompt('Ingrese su Brevo API Key (xkeysib-...):');
      if (brevoApiKey && brevoApiKey.trim()) {
        localStorage.setItem('BREVO_API_KEY', brevoApiKey.trim());
        window.BREVO_API_KEY = brevoApiKey.trim();
      } else {
        return;
      }
    }

    try {
      showToast(`Sincronizando ${guest.email} en contactos de Brevo...`, 'info');
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
        showToast(`✓ Contacto ${guest.email} registrado con éxito en Brevo`, 'success');
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
      showToast('No hay huéspedes cargados', 'info');
      return;
    }

    let brevoApiKey = window.BREVO_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('BREVO_API_KEY') : null);
    if (!brevoApiKey) {
      brevoApiKey = prompt('Ingrese su Brevo API Key (xkeysib-...):');
      if (brevoApiKey && brevoApiKey.trim()) {
        localStorage.setItem('BREVO_API_KEY', brevoApiKey.trim());
        window.BREVO_API_KEY = brevoApiKey.trim();
      } else {
        return;
      }
    }

    showToast(`Sincronizando ${this.guests.length} huéspedes con Brevo...`, 'info');
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
    showToast(`✓ ¡${count} huéspedes sincronizados en Brevo!`, 'success');
  }
};
