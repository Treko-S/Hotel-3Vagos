/**
 * Cash Register & Invoicing Module (Paraguay Legal Tax Compliant)
 * Caja Sesiones, Arqueo con Conteo Físico, Egresos/Vales, Tarjetas POS vs App, IVA & Facturación
 */

const CashBillingModule = {
  currentSession: null,
  invoices: [],
  payments: [],
  egresos: [],

  async init() {
    await this.loadInvoices();
    await this.loadActiveSession();
    await this.loadPaymentsFlow();
  },

  loadEgresos() {
    if (!this.currentSession) {
      this.egresos = [];
      return;
    }
    try {
      const key = `hotel_caja_egresos_${this.currentSession.id}`;
      const saved = localStorage.getItem(key);
      this.egresos = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.egresos = [];
    }
  },

  saveEgresos() {
    if (!this.currentSession) return;
    try {
      const key = `hotel_caja_egresos_${this.currentSession.id}`;
      localStorage.setItem(key, JSON.stringify(this.egresos));
    } catch (e) {}
  },

  getTotalEgresos() {
    return this.egresos.reduce((sum, eg) => sum + (Number(eg.monto) || 0), 0);
  },

  getTotalEfectivoCobrado() {
    let efec = 0;
    this.payments.forEach(p => {
      const m = (p.metodo_pago || '').toLowerCase();
      if (m.includes('efectivo')) {
        efec += (Number(p.monto) || 0);
      }
    });
    return efec;
  },

  getEsperadoEfectivo() {
    const apertura = Number(this.currentSession?.monto_apertura) || 0;
    const ingresos = this.getTotalEfectivoCobrado();
    const egresos = this.getTotalEgresos();
    return apertura + ingresos - egresos;
  },

  async loadActiveSession() {
    try {
      const { data, error } = await supabaseClient
        .from('sesiones_caja')
        .select('*, users(full_name)')
        .eq('estado', 'Abierta')
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        this.currentSession = data[0];
        this.loadEgresos();
        this.renderActiveSessionUI(this.currentSession);
      } else {
        this.currentSession = null;
        this.egresos = [];
        this.renderNoSessionUI();
      }
    } catch (err) {
      console.warn('loadActiveSession error or table empty:', err);
      this.currentSession = null;
      this.renderNoSessionUI();
    }
  },

  renderActiveSessionUI(session) {
    this.loadEgresos();
    const box = document.getElementById('cash-status-box');
    if (!box) return;

    const apertura = Number(session.monto_apertura) || 0;
    const totalEfec = this.getTotalEfectivoCobrado();
    const totalEg = this.getTotalEgresos();
    const efectivoEnCajon = apertura + totalEfec - totalEg;

    box.innerHTML = `
      <div style="background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 22px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-dot"></span>
            <strong style="color: var(--success); font-size: 16px;">Caja Principal de Recepción Abierta (#${session.id})</strong>
            <span class="badge badge-confirmada" style="font-size: 11px;">Turno Activo</span>
          </div>
          <p style="font-size: 12.5px; color: var(--text-muted); margin: 6px 0 4px;">
            Responsable: <strong style="color: var(--primary-navy);">${sanitizeInput(session.responsable || session.users?.full_name || localStorage.getItem('caja_responsable') || 'Marcos Rolón (Recepcionista)')}</strong> • Turno: <strong style="color: var(--primary-navy);">${sanitizeInput(localStorage.getItem('caja_turno') || 'Turno Mañana')}</strong> • Fondo Fijo Apertura: <strong>${formatGs(apertura)}</strong>
          </p>
          <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-top: 6px; font-size: 12px;">
            <span style="color: #166534;"><i class="fas fa-arrow-down"></i> Cobros Efectivo: <strong>+${formatGs(totalEfec)}</strong></span>
            <span style="color: #991B1B;"><i class="fas fa-arrow-up"></i> Egresos / Vales: <strong>-${formatGs(totalEg)}</strong></span>
            <span style="color: var(--primary-navy); font-weight: 700; background: #F8FAFC; padding: 2px 8px; border-radius: 6px; border: 1px solid #E2E8F0;">
              <i class="fas fa-cash-register"></i> Efectivo Teórico en Cajón: <strong>${formatGs(efectivoEnCajon)}</strong>
            </span>
          </div>
          <div style="margin-top: 6px;">
            <span class="badge" style="background: #EFF6FF; color: #1D4ED8; font-size: 11px; padding: 2px 8px;">
              <i class="fas fa-bolt"></i> Cobros de la App Móvil se concilian automáticamente en Cuenta Bancaria 24/7
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-weight: 600;" onclick="CashBillingModule.openEgresoModal()" title="Registrar un retiro de dinero para pago a proveedores, hielo o urgencias">
            <i class="fas fa-receipt"></i> Registrar Egreso / Vale de Caja
          </button>
          <button class="btn btn-outline" onclick="CashBillingModule.openArqueoModal()" title="Ver auditoría preliminar del turno">
            <i class="fas fa-calculator"></i> Arqueo Rápido
          </button>
          <button class="btn btn-danger" onclick="CashBillingModule.openCierreModal()" title="Realizar el recuento de efectivo y cerrar el turno">
            <i class="fas fa-lock"></i> Cierre de Turno / Arqueo
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
      let totalTarjetasPOS = 0;
      let totalAppPasarela = 0;
      let totalDigital = 0;
      let totalConsolidado = 0;

      this.payments.forEach(p => {
        const monto = Number(p.monto) || 0;
        totalConsolidado += monto;
        const metodo = (p.metodo_pago || '').toLowerCase();
        const folio = p.folios || {};
        const reserva = folio.reservas || {};
        const canal = reserva.canal_venta || 'App Móvil';
        const isApp = canal === 'App Móvil';

        if (metodo.includes('efectivo')) {
          totalEfectivo += monto;
        } else if (metodo.includes('tarjeta') || metodo.includes('credito') || metodo.includes('debito')) {
          if (isApp) {
            totalAppPasarela += monto; // Pago de tarjeta online desde la App Móvil
          } else {
            totalTarjetasPOS += monto; // POS físico en mostrador de recepción
          }
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
                <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;">Tarjetas (POS Mostrador)</p>
                <h3 style="font-size: 20px; font-weight: 800; color: #1D4ED8; margin: 6px 0 2px;">${formatGs(totalTarjetasPOS)}</h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Comprobantes físicos / vouchers POS</p>
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
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Ingresos reales (Incluye ${formatGs(totalAppPasarela)} App Móvil)</p>
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
          tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 28px; color: var(--text-muted);">Aún no se registran pagos en el sistema.</td></tr>`;
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

          // Estado de Facturación Legal (SET Paraguay)
          const matchedInv = this.invoices.find(inv => inv.folio_id === p.folio_id || (inv.ruc_ci && inv.monto_total == p.monto));
          const isFacturado = Boolean(matchedInv || p.facturado || p.factura_id);
          const estadoFacturaBadge = isFacturado
            ? `<span class="badge badge-confirmada" style="background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; font-size: 11px;"><i class="fas fa-file-invoice"></i> Facturado ${matchedInv ? '(' + (matchedInv.numero_factura || 'SET') + ')' : ''}</span>`
            : `<span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 11px;"><i class="fas fa-clock"></i> Pendiente Factura</span>`;

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
              <td>
                ${estadoFacturaBadge}
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
      const resp = document.getElementById('caja-responsable').value.trim() || 'Marcos Rolón (Recepcionista)';
      const turno = document.getElementById('caja-turno-select')?.value || 'Turno Mañana (06:00 - 14:00)';

      // Almacenar metadatos para UI y auditoría legal
      localStorage.setItem('caja_responsable', resp);
      localStorage.setItem('caja_turno', turno);

      // Obtener usuario_id válido (FK obligatoria a users)
      const validUserId = (typeof AppState !== 'undefined' && AppState.currentUser?.id && AppState.currentUser.id.length > 20)
        ? AppState.currentUser.id
        : '44635480-0093-4c8f-930c-6d4a12c1d5fe'; // Laura Benítez (Recepción)

      const { error } = await supabaseClient.from('sesiones_caja').insert({
        usuario_id: validUserId,
        monto_apertura: monto,
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

  /* =========================================================
     REGISTRO DE EGRESOS / RETIROS (VALES DE CAJA)
     ========================================================= */
  openEgresoModal() {
    if (!this.currentSession) {
      showToast('Debe haber una caja abierta para registrar egresos', 'warning');
      return;
    }
    const montoEl = document.getElementById('egreso-monto');
    const detalleEl = document.getElementById('egreso-detalle');
    const compEl = document.getElementById('egreso-comprobante');
    const motivoSelect = document.getElementById('egreso-motivo-select');
    const containerDetalle = document.getElementById('egreso-detalle-container');

    if (montoEl) montoEl.value = '';
    if (detalleEl) detalleEl.value = '';
    if (compEl) compEl.value = '';
    if (motivoSelect) motivoSelect.value = 'Proveedor de Agua / Bebidas';
    if (containerDetalle) containerDetalle.style.display = 'none';

    openModal('modal-cash-egreso');
  },

  onEgresoMotivoChange() {
    const sel = document.getElementById('egreso-motivo-select');
    const container = document.getElementById('egreso-detalle-container');
    if (sel && container) {
      container.style.display = sel.value === 'Otro' ? 'block' : 'none';
    }
  },

  confirmEgreso() {
    const monto = Number(document.getElementById('egreso-monto').value) || 0;
    const select = document.getElementById('egreso-motivo-select').value;
    const detalleInput = document.getElementById('egreso-detalle').value.trim();
    const motivo = (select === 'Otro' && detalleInput) ? detalleInput : (detalleInput ? `${select} - ${detalleInput}` : select);
    const resp = document.getElementById('egreso-responsable').value.trim() || 'Recepcionista Turno';
    const comp = document.getElementById('egreso-comprobante').value.trim() || `VAL-${Date.now().toString().slice(-4)}`;

    if (monto <= 0) {
      showToast('Debe ingresar un monto válido a retirar mayor a 0 Gs.', 'warning');
      return;
    }

    const egreso = {
      id: Date.now(),
      monto,
      motivo,
      responsable: resp,
      comprobante: comp,
      fecha: new Date().toLocaleString()
    };

    this.egresos.push(egreso);
    this.saveEgresos();

    closeModal('modal-cash-egreso');
    showToast(`Egreso de ${formatGs(monto)} registrado con éxito (Vale #${comp}).`, 'success');

    // Re-render UI
    this.renderActiveSessionUI(this.currentSession);
    this.loadPaymentsFlow();
  },

  /* =========================================================
     ARQUEO PRELIMINAR Y CIERRE DE TURNO
     ========================================================= */
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
    const egresos = this.getTotalEgresos();
    const efectivoEnCajon = apertura + efec - egresos;

    CustomDialog.alert({
      title: 'Arqueo & Conciliación Preliminar de Turno',
      message: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">1. Caja Física de Recepción (Mostrador)</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Fondo Inicial de Turno:</span> <strong>${formatGs(apertura)}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Cobros en Efectivo de Turno:</span> <strong style="color: #166534;">+${formatGs(efec)}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Egresos / Vales de Turno:</span> <strong style="color: #991B1B;">-${formatGs(egresos)}</strong></div>
            <div style="border-top: 1px dashed #CBD5E1; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-weight: bold; color: #166534; font-size: 14px;">
              <span>Total Efectivo Teórico en Mano:</span> <span>${formatGs(efectivoEnCajon)}</span>
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
  },

  openCierreModal() {
    if (!this.currentSession) return;

    this.loadEgresos();
    const apertura = Number(this.currentSession.monto_apertura) || 0;
    const ingresosEfec = this.getTotalEfectivoCobrado();
    const egresosEfec = this.getTotalEgresos();
    const esperado = apertura + ingresosEfec - egresosEfec;

    const elFondo = document.getElementById('cierre-fondo-inicial');
    const elIngresos = document.getElementById('cierre-ingresos-efectivo');
    const elEgresos = document.getElementById('cierre-egresos-total');
    const elEsperado = document.getElementById('cierre-efectivo-esperado');
    const elReal = document.getElementById('cierre-efectivo-real');
    const elResult = document.getElementById('cierre-resultado-arqueo');
    const elObs = document.getElementById('cierre-observaciones');

    if (elFondo) elFondo.innerText = formatGs(apertura);
    if (elIngresos) elIngresos.innerText = `+${formatGs(ingresosEfec)}`;
    if (elEgresos) elEgresos.innerText = `-${formatGs(egresosEfec)}`;
    if (elEsperado) elEsperado.innerText = formatGs(esperado);
    if (elReal) elReal.value = '';
    if (elResult) {
      elResult.style.display = 'none';
      elResult.innerHTML = '';
    }
    if (elObs) elObs.value = '';

    openModal('modal-cash-cierre');
  },

  calculateArqueoDiff() {
    const esperado = this.getEsperadoEfectivo();
    const realInput = document.getElementById('cierre-efectivo-real');
    const resultBox = document.getElementById('cierre-resultado-arqueo');
    if (!realInput || !resultBox) return;

    const valStr = realInput.value.trim();
    if (valStr === '') {
      resultBox.style.display = 'none';
      return;
    }

    const real = Number(valStr);
    const diff = real - esperado;
    resultBox.style.display = 'block';

    if (diff === 0) {
      resultBox.style.background = '#DCFCE7';
      resultBox.style.border = '1px solid #86EFAC';
      resultBox.style.color = '#166534';
      resultBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-check-circle" style="font-size: 22px; color: #16A34A;"></i>
          <div>
            <strong style="font-size: 14px; display: block;">¡Caja Cuadrada Perfecta! (Diferencia: 0 Gs.)</strong>
            <span style="font-size: 12px;">El dinero físico en el cajón coincide exactamente con lo registrado en sistema.</span>
          </div>
        </div>
      `;
    } else if (diff > 0) {
      resultBox.style.background = '#EFF6FF';
      resultBox.style.border = '1px solid #93C5FD';
      resultBox.style.color = '#1E40AF';
      resultBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-info-circle" style="font-size: 22px; color: #2563EB;"></i>
          <div>
            <strong style="font-size: 14px; display: block;">Sobrante de Caja: +${formatGs(diff)}</strong>
            <span style="font-size: 12px;">Hay más dinero físico en el cajón de lo registrado. Se registrará como sobrante de turno.</span>
          </div>
        </div>
      `;
    } else {
      resultBox.style.background = '#FEF2F2';
      resultBox.style.border = '1px solid #FCA5A5';
      resultBox.style.color = '#991B1B';
      resultBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 22px; color: #DC2626;"></i>
          <div>
            <strong style="font-size: 14px; display: block;">FALTANTE DE CAJA / POSIBLE FUGA DE CAPITAL: -${formatGs(Math.abs(diff))}</strong>
            <span style="font-size: 12px;">Falta dinero físico en el cajón según los comprobantes. Quedará registrado en la auditoría legal.</span>
          </div>
        </div>
      `;
    }
  },

  async confirmCloseSession() {
    if (!this.currentSession) return;
    const realInput = document.getElementById('cierre-efectivo-real');
    if (!realInput || realInput.value.trim() === '') {
      showToast('Debe ingresar el monto físico real contado en el cajón', 'warning');
      return;
    }

    const real = Number(realInput.value);
    const esperado = this.getEsperadoEfectivo();
    const diff = real - esperado;
    const obs = (document.getElementById('cierre-observaciones')?.value || '').trim();

    try {
      const updateData = {
        estado: 'Cerrada',
        monto_cierre: real,
        monto_diferencia: diff,
        fecha_cierre: new Date().toISOString()
      };

      await supabaseClient.from('sesiones_caja').update(updateData).eq('id', this.currentSession.id);

      localStorage.removeItem('caja_responsable');
      localStorage.removeItem('caja_turno');

      closeModal('modal-cash-cierre');
      showToast(`Turno de caja cerrado. Arqueo completado (${diff === 0 ? 'Caja Cuadrada' : (diff > 0 ? 'Sobrante ' + formatGs(diff) : 'Faltante ' + formatGs(Math.abs(diff)))}).`, 'success');

      await this.loadActiveSession();
      await this.loadPaymentsFlow();
    } catch (err) {
      console.error('Error al cerrar caja:', err);
      showToast('Error al cerrar caja: ' + err.message, 'error');
    }
  }
};
