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
  }
};
