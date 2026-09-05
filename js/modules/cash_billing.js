/**
 * Cash Register & Invoicing Module (Paraguay Legal Tax Compliant)
 * Caja Sesiones, Arqueo, Conciliación Bancaria 24/7, IVA & Facturación
 */

const CashBillingModule = {
  currentSession: null,
  invoices: [],
  payments: [],

  async init() {
    await this.loadActiveSession();
    await this.loadPaymentsFlow();
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
      <div style="background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 24px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-dot"></span>
            <strong style="color: var(--success); font-size: 16px;">Caja Principal de Recepción Abierta (#${session.id})</strong>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Responsable: <strong>${sanitizeInput(session.responsable || 'Recepcionista Turno')}</strong> • Fondo Fijo de Apertura: <strong>${formatGs(session.monto_apertura || 0)}</strong>
          </p>
          <div style="margin-top: 6px;">
            <span class="badge" style="background: #EFF6FF; color: #1D4ED8; font-size: 11px; padding: 2px 8px;">
              <i class="fas fa-bolt"></i> Cobros de la App Móvil se concilian automáticamente en Cuenta Bancaria 24/7
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-outline" onclick="CashBillingModule.openArqueoModal()">
            <i class="fas fa-calculator"></i> Realizar Arqueo de Turno
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
            <strong style="color: var(--danger); font-size: 16px;">Caja Principal de Recepción Cerrada</strong>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            El turno físico de mostrador está cerrado. Los pagos realizados por huéspedes en la <strong>App Móvil</strong> ingresan y se acreditan automáticamente 24/7 en la cuenta bancaria.
          </p>
        </div>
        <button class="btn btn-primary" onclick="CashBillingModule.openAperturaModal()">
          <i class="fas fa-key"></i> Apertura de Turno de Caja
        </button>
      </div>
    `;
  },

  async loadPaymentsFlow() {
    try {
      const containerKpis = document.getElementById('cash-methods-kpis');
      const tbody = document.getElementById('cash-payments-table-body');

      const { data: rawPayments, error } = await supabaseClient
        .from('pagos_folio')
        .select('*, folios(id, reserva_id, total_pagos, saldo_pendiente, reservas(codigo_reserva, canal_venta, users(full_name)))')
        .order('id', { ascending: false });

      if (error) throw error;
      this.payments = rawPayments || [];

      let totalEfectivo = 0;
      let totalTarjetas = 0;
      let totalDigital = 0;
      let totalConsolidado = 0;

      this.payments.forEach(p => {
        const monto = Number(p.monto) || 0;
        totalConsolidado += monto;
        const metodo = (p.metodo_pago || '').toLowerCase();

        if (metodo.includes('efectivo')) {
          totalEfectivo += monto;
        } else if (metodo.includes('tarjeta') || metodo.includes('credito') || metodo.includes('debito')) {
          totalTarjetas += monto;
        } else {
          totalDigital += monto;
        }
      });

      // Render KPIs de Ingresos por Método de Pago
      if (containerKpis) {
        containerKpis.innerHTML = `
          <div class="kpi-card" style="border-left: 4px solid #16A34A;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;">Efectivo (Caja Mostrador)</p>
                <h3 style="font-size: 20px; font-weight: 800; color: #166534; margin: 6px 0 2px;">${formatGs(totalEfectivo)}</h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Billetes en cajón de recepción</p>
              </div>
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #DCFCE7; color: #16A34A; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fas fa-money-bill-wave"></i>
              </div>
            </div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #2563EB;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;">Tarjetas Débito / Crédito</p>
                <h3 style="font-size: 20px; font-weight: 800; color: #1D4ED8; margin: 6px 0 2px;">${formatGs(totalTarjetas)}</h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">POS y pasarela online App Móvil</p>
              </div>
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fas fa-credit-card"></i>
              </div>
            </div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #0D9488;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;">QR & SIPAP Bancario</p>
                <h3 style="font-size: 20px; font-weight: 800; color: #0F766E; margin: 6px 0 2px;">${formatGs(totalDigital)}</h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Billeteras y transferencias 24/7</p>
              </div>
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #F0FDFA; color: #0D9488; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fas fa-qrcode"></i>
              </div>
            </div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid var(--primary-gold);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;">Ganancia Total Consolidada</p>
                <h3 style="font-size: 20px; font-weight: 800; color: var(--primary-dark); margin: 6px 0 2px;">${formatGs(totalConsolidado)}</h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Ingresos reales totales del Hotel</p>
              </div>
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #FEF3C7; color: #B45309; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fas fa-vault"></i>
              </div>
            </div>
          </div>
        `;
      }

      // Render Tabla Detallada de Ingresos
      if (tbody) {
        if (this.payments.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 28px; color: var(--text-muted);">Aún no se registran pagos en el sistema.</td></tr>`;
          return;
        }

        let html = '';
        this.payments.forEach(p => {
          const folio = p.folios || {};
          const reserva = folio.reservas || {};
          const user = reserva.users || {};
          const canal = reserva.canal_venta || 'App Móvil';
          const isApp = canal === 'App Móvil';

          const badgeMetodo = this.getMethodBadge(p.metodo_pago);
          const destinoFinanciero = (p.metodo_pago || '').toLowerCase().includes('efectivo')
            ? `<span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 10.5px;"><i class="fas fa-cash-register"></i> Caja Mostrador</span>`
            : `<span class="badge" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 10.5px;"><i class="fas fa-landmark"></i> Cuenta Bancaria (24/7)</span>`;

          html += `
            <tr>
              <td>
                <div style="font-weight: 600; font-size: 12.5px;">${formatDate(p.created_at || p.fecha_pago)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${new Date(p.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</div>
              </td>
              <td>
                <strong style="color: var(--primary-navy); font-size: 13px;">${sanitizeInput(reserva.codigo_reserva || 'FOLIO-#' + p.folio_id)}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Folio #${p.folio_id}</div>
              </td>
              <td>
                <div style="font-weight: 600; color: var(--primary-dark); font-size: 13px;">${sanitizeInput(user.full_name || 'Huésped Registrado')}</div>
              </td>
              <td>
                <span class="badge" style="background: ${isApp ? '#EFF6FF' : '#F0FDF4'}; color: ${isApp ? '#2563EB' : '#166534'}; border: 1px solid ${isApp ? '#BFDBFE' : '#BBF7D0'}; font-size: 11px;">
                  <i class="${isApp ? 'fas fa-mobile-alt' : 'fas fa-concierge-bell'}"></i> ${sanitizeInput(canal)}
                </span>
              </td>
              <td>
                ${badgeMetodo}
              </td>
              <td>
                <span style="font-family: monospace; font-size: 11.5px; color: var(--text-muted);">${sanitizeInput(p.referencia_transaccion || 'Abono Registrado')}</span>
              </td>
              <td style="text-align: right;">
                <strong style="color: #15803D; font-size: 13.5px;">+${formatGs(p.monto)}</strong>
              </td>
              <td>
                ${destinoFinanciero}
              </td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      }
    } catch (err) {
      console.warn('loadPaymentsFlow error:', err);
    }
  },

  getMethodBadge(metodoRaw) {
    const m = (metodoRaw || 'Tarjeta Debito').toLowerCase();
    if (m.includes('efectivo')) {
      return `<span class="badge" style="background: #FEFCE8; color: #854D0E; border: 1px solid #FEF08A; font-weight: 600;"><i class="fas fa-money-bill-wave"></i> Efectivo</span>`;
    } else if (m.includes('credito') || m.includes('crédito')) {
      return `<span class="badge" style="background: #FAF5FF; color: #7E22CE; border: 1px solid #E9D5FF; font-weight: 600;"><i class="fas fa-credit-card"></i> Tarjeta Crédito</span>`;
    } else if (m.includes('debito') || m.includes('débito') || m.includes('tarjeta')) {
      return `<span class="badge" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-weight: 600;"><i class="fas fa-credit-card"></i> Tarjeta Débito</span>`;
    } else if (m.includes('qr') || m.includes('billetera')) {
      return `<span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-weight: 600;"><i class="fas fa-qrcode"></i> QR Billetera</span>`;
    } else if (m.includes('transferencia') || m.includes('sipap') || m.includes('banco')) {
      return `<span class="badge" style="background: #F0FDFA; color: #0D9488; border: 1px solid #99F6E4; font-weight: 600;"><i class="fas fa-university"></i> Transferencia SIPAP</span>`;
    }
    return `<span class="badge badge-confirmada">${sanitizeInput(metodoRaw || 'Digital')}</span>`;
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
      await this.loadPaymentsFlow();

    } catch (err) {
      console.error('Error al abrir caja:', err);
      showToast('Error al abrir caja: ' + err.message, 'error');
    }
  },

  async closeSession() {
    if (!this.currentSession) return;
    const ok = await CustomDialog.confirm({
      title: 'Cierre de Caja de Turno',
      message: '¿Está seguro de realizar el Cierre de Caja del turno actual? Esta acción consolidará las operaciones físicas del turno. Los pagos de la app continuarán ingresando a banco de forma automática.',
      icon: 'fa-cash-register',
      confirmText: 'Sí, Cerrar Turno de Caja'
    });
    if (!ok) return;

    try {
      await supabaseClient.from('sesiones_caja').update({
        estado: 'Cerrada'
      }).eq('id', this.currentSession.id);

      showToast('Caja cerrada con éxito. Turno de mostrador finalizado.', 'info');
      await this.loadActiveSession();
    } catch (err) {
      showToast('Error al cerrar caja: ' + err.message, 'error');
    }
  },

  openArqueoModal() {
    let efec = 0;
    let dig = 0;
    this.payments.forEach(p => {
      const m = (p.metodo_pago || '').toLowerCase();
      const val = Number(p.monto) || 0;
      if (m.includes('efectivo')) efec += val;
      else dig += val;
    });

    const apertura = Number(this.currentSession?.monto_apertura) || 0;
    const efectivoEnCajon = apertura + efec;

    CustomDialog.alert({
      title: 'Arqueo & Conciliación de Turno',
      message: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">1. Caja Física de Recepción (Mostrador)</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Fondo Inicial de Turno:</span> <strong>${formatGs(apertura)}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Cobros en Efectivo de Turno:</span> <strong style="color: #166534;">+${formatGs(efec)}</strong></div>
            <div style="border-top: 1px dashed #CBD5E1; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-weight: bold; color: #166534; font-size: 14px;">
              <span>Total Billetes en Mano a Entregar:</span> <span>${formatGs(efectivoEnCajon)}</span>
            </div>
          </div>
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px;">
            <div style="color: #1D4ED8; font-size: 11px; text-transform: uppercase; font-weight: 700;">2. Cobros Electrónicos / App Móvil (Banco 24/7)</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Acreditado en Banco (Tarjetas, QR, SIPAP):</span> <strong style="color: #1D4ED8;">${formatGs(dig)}</strong></div>
            <p style="font-size: 11px; color: #1E40AF; margin: 4px 0 0;"><i class="fas fa-check-circle"></i> No genera faltante en efectivo porque se acredita directamente en cuenta bancaria.</p>
          </div>
        </div>
      `,
      icon: 'fa-calculator'
    });
  }
};
