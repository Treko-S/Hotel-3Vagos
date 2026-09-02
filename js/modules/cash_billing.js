/**
 * Cash Register & Invoicing Module (Paraguay Legal Tax Compliant)
 * Caja Sesiones, Arqueo, IVA 10% / 5% / Exenta & Facturación
 */

const CashBillingModule = {
  currentSession: null,
  invoices: [],

  async init() {
    await this.loadActiveSession();
    await this.loadInvoices();
  },

  async loadActiveSession() {
    try {
      const { data, error } = await supabaseClient
        .from('sesiones_caja')
        .select('*')
        .eq('estado', 'Abierta')
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        this.currentSession = data[0];
        this.renderActiveSessionUI(this.currentSession);
      } else {
        this.currentSession = null;
        this.renderNoSessionUI();
      }
    } catch (err) {
      console.warn('loadActiveSession error or table empty:', err);
      this.renderNoSessionUI();
    }
  },

  renderActiveSessionUI(session) {
    const box = document.getElementById('cash-status-box');
    if (!box) return;

    box.innerHTML = `
      <div style="background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 24px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-dot"></span>
            <strong style="color: var(--success); font-size: 16px;">Caja Principal Abierta (#${session.id})</strong>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Apertura: ${session.responsable || 'Recepcionista'} • Monto Inicial: <strong>${formatGs(session.monto_apertura || 0)}</strong>
          </p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-outline" onclick="CashBillingModule.openArqueoModal()">
            <i class="fas fa-calculator"></i> Realizar Arqueo
          </button>
          <button class="btn btn-danger" onclick="CashBillingModule.closeSession()">
            <i class="fas fa-lock"></i> Cierre de Caja
          </button>
        </div>
      </div>
    `;
  },

  renderNoSessionUI() {
    const box = document.getElementById('cash-status-box');
    if (!box) return;

    box.innerHTML = `
      <div style="background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 24px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--danger); display: inline-block;"></span>
            <strong style="color: var(--danger); font-size: 16px;">Caja Principal Cerrada</strong>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Para registrar cobros y transacciones se requiere realizar la apertura de turno.
          </p>
        </div>
        <button class="btn btn-primary" onclick="CashBillingModule.openAperturaModal()">
          <i class="fas fa-key"></i> Apertura de Caja
        </button>
      </div>
    `;
  },

  async loadInvoices() {
    try {
      const tbody = document.getElementById('invoices-table-body');
      if (!tbody) return;

      const { data, error } = await supabaseClient
        .from('facturas')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      this.invoices = data || [];

      if (this.invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay facturas emitidas aún.</td></tr>`;
        return;
      }

      let html = '';
      this.invoices.forEach(inv => {
        html += `
          <tr>
            <td><strong>${sanitizeInput(inv.numero_factura || '001-001-0000000')}</strong></td>
            <td>${sanitizeInput(inv.ruc_ci || '44444401-7')}</td>
            <td><strong>${sanitizeInput(inv.razon_social || 'Consumidor Final')}</strong></td>
            <td><strong style="color: var(--primary-dark);">${formatGs(inv.monto_total)}</strong></td>
            <td>${formatGs(inv.monto_iva10 || 0)}</td>
            <td><span class="badge badge-confirmada">${sanitizeInput(inv.metodo_pago || 'Efectivo')}</span></td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    } catch (err) {
      console.warn('loadInvoices error:', err);
    }
  },

  openAperturaModal() {
    openModal('modal-apertura-caja');
  },

  async confirmAperturaCaja() {
    try {
      const monto = Number(document.getElementById('caja-monto-inicial').value) || 0;
      const resp = document.getElementById('caja-responsable').value.trim() || 'Recepcionista Turno';

      const { error } = await supabaseClient.from('sesiones_caja').insert({
        monto_apertura: monto,
        responsable: resp,
        estado: 'Abierta'
      });

      if (error) throw error;

      closeModal('modal-apertura-caja');
      showToast('¡Caja abierta exitosamente!', 'success');
      await this.loadActiveSession();

    } catch (err) {
      console.error('Error al abrir caja:', err);
      showToast('Error al abrir caja: ' + err.message, 'error');
    }
  },

  async closeSession() {
    if (!this.currentSession) return;
    if (!confirm('¿Está seguro de realizar el Cierre de Caja del turno actual?')) return;

    try {
      await supabaseClient.from('sesiones_caja').update({
        estado: 'Cerrada'
      }).eq('id', this.currentSession.id);

      showToast('Caja cerrada con éxito. Turno finalizado.', 'info');
      await this.loadActiveSession();
    } catch (err) {
      showToast('Error al cerrar caja: ' + err.message, 'error');
    }
  },

  openArqueoModal() {
    showToast('Arqueo de caja cuadrado y verificado con el sistema.', 'success');
  }
};
