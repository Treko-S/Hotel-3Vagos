/**
 * Hotel 3 Vagos - Sistema de Diálogos y Modales Personalizados (CustomDialog)
 * Reemplaza por completo window.prompt() y window.confirm() con interfaces
 * elegantes, asíncronas (Promises) y acordes al diseño premium del hotel.
 */

const CustomDialog = {
  _currentResolve: null,

  /**
   * Muestra un diálogo de confirmación personalizado
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  confirm({
    title = 'Confirmación Requerida',
    message = '¿Está seguro de realizar esta acción?',
    icon = 'fa-question-circle',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = false
  } = {}) {
    return new Promise((resolve) => {
      this._currentResolve = resolve;

      const modal = document.getElementById('modal-custom-confirm');
      if (!modal) {
        resolve(false);
        return;
      }

      document.getElementById('dialog-confirm-title').textContent = title;
      document.getElementById('dialog-confirm-message').textContent = message;

      const iconEl = document.getElementById('dialog-confirm-icon');
      if (iconEl) {
        iconEl.className = `fas ${icon}`;
        iconEl.parentElement.style.background = isDanger 
          ? 'rgba(220, 38, 38, 0.12)' 
          : 'rgba(18, 59, 99, 0.12)';
        iconEl.parentElement.style.color = isDanger ? '#DC2626' : 'var(--primary-navy)';
      }

      const btnConfirm = document.getElementById('dialog-confirm-ok-btn');
      btnConfirm.textContent = confirmText;
      btnConfirm.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

      const btnCancel = document.getElementById('dialog-confirm-cancel-btn');
      btnCancel.textContent = cancelText;

      openModal('modal-custom-confirm');
    });
  },

  handleConfirmOk() {
    closeModal('modal-custom-confirm');
    if (this._currentResolve) {
      const r = this._currentResolve;
      this._currentResolve = null;
      r(true);
    }
  },

  handleConfirmCancel() {
    closeModal('modal-custom-confirm');
    if (this._currentResolve) {
      const r = this._currentResolve;
      this._currentResolve = null;
      r(false);
    }
  },

  /**
   * Muestra un diálogo de entrada de texto personalizado
   * @param {Object} options
   * @returns {Promise<string|null>}
   */
  prompt({
    title = 'Ingrese Información',
    message = 'Por favor ingrese el valor solicitado:',
    label = 'Valor',
    defaultValue = '',
    placeholder = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    inputType = 'text'
  } = {}) {
    return new Promise((resolve) => {
      this._currentResolve = resolve;

      const modal = document.getElementById('modal-custom-prompt');
      if (!modal) {
        resolve(null);
        return;
      }

      document.getElementById('dialog-prompt-title').textContent = title;
      document.getElementById('dialog-prompt-message').textContent = message;
      document.getElementById('dialog-prompt-label').textContent = label;

      const input = document.getElementById('dialog-prompt-input');
      input.type = inputType;
      input.value = defaultValue;
      input.placeholder = placeholder;

      document.getElementById('dialog-prompt-ok-btn').textContent = confirmText;
      document.getElementById('dialog-prompt-cancel-btn').textContent = cancelText;

      openModal('modal-custom-prompt');

      setTimeout(() => {
        input.focus();
        input.select();
      }, 150);
    });
  },

  handlePromptOk() {
    const input = document.getElementById('dialog-prompt-input');
    const val = input ? input.value : '';
    closeModal('modal-custom-prompt');
    if (this._currentResolve) {
      const r = this._currentResolve;
      this._currentResolve = null;
      r(val);
    }
  },

  handlePromptCancel() {
    closeModal('modal-custom-prompt');
    if (this._currentResolve) {
      const r = this._currentResolve;
      this._currentResolve = null;
      r(null);
    }
  },

  /**
   * Abre el modal dedicado para Registrar Consumos de Folio
   */
  openAddConsumption(bookingId) {
    const booking = (typeof ReservationsModule !== 'undefined' && ReservationsModule.currentBookings)
      ? ReservationsModule.currentBookings.find(b => b.id === bookingId)
      : null;

    if (!booking) return;

    this.currentConsumptionBooking = booking;

    const modal = document.getElementById('modal-add-consumption');
    if (!modal) return;

    // Reset fields
    document.getElementById('consumption-desc').value = 'Minibar: Agua Mineral + Snack';
    document.getElementById('consumption-amount').value = '35.000';
    document.getElementById('consumption-booking-code').textContent = booking.codigo_reserva;
    const habNum = booking.habitaciones ? (booking.habitaciones.numero || '') : '';
    document.getElementById('consumption-room-badge').textContent = habNum ? `Hab. ${habNum}` : 'Habitación';

    openModal('modal-add-consumption');
  },

  setQuickConsumption(concept, defaultPrice) {
    const descInput = document.getElementById('consumption-desc');
    const amountInput = document.getElementById('consumption-amount');
    if (descInput) descInput.value = concept;
    if (amountInput && defaultPrice) {
      amountInput.value = new Intl.NumberFormat('es-PY').format(defaultPrice);
    }
  },

  addQuickAmount(amountToAdd) {
    const amountInput = document.getElementById('consumption-amount');
    if (!amountInput) return;
    const curVal = Number(amountInput.value.replace(/\D/g, '')) || 0;
    const nextVal = curVal + amountToAdd;
    amountInput.value = new Intl.NumberFormat('es-PY').format(nextVal);
  },

  async confirmAddConsumption() {
    if (!this.currentConsumptionBooking) return;

    const descInput = document.getElementById('consumption-desc');
    const amountInput = document.getElementById('consumption-amount');

    const desc = descInput ? descInput.value.trim() : '';
    const rawAmount = amountInput ? amountInput.value.replace(/\D/g, '') : '0';
    const monto = Number(rawAmount) || 0;

    if (!desc || desc.length < 3) {
      showToast('Ingrese una descripción clara del consumo', 'warning');
      if (descInput) descInput.focus();
      return;
    }

    if (monto <= 0) {
      showToast('Ingrese un monto válido mayor a 0 Gs.', 'warning');
      if (amountInput) amountInput.focus();
      return;
    }

    const booking = this.currentConsumptionBooking;
    const folio = (booking.folios && typeof booking.folios === 'object')
      ? (Array.isArray(booking.folios) ? (booking.folios[0] || {}) : booking.folios)
      : {};

    const nuevoConsumo = (Number(folio.total_consumos) || 0) + monto;
    const nuevoSaldo = (Number(folio.saldo_pendiente) || 0) + monto;

    try {
      if (folio.id) {
        await supabaseClient.from('folios').update({
          total_consumos: nuevoConsumo,
          saldo_pendiente: nuevoSaldo
        }).eq('id', folio.id);
      }

      closeModal('modal-add-consumption');
      showToast(`✓ Consumo de ${formatGs(monto)} registrado en el folio!`, 'success');

      if (typeof ReservationsModule !== 'undefined') {
        await ReservationsModule.loadReservations();
        ReservationsModule.viewFolioDetail(booking.id);
      }
    } catch (e) {
      console.error('Error al guardar consumo:', e);
      showToast('Error al registrar consumo: ' + e.message, 'danger');
    }
  }
};

window.CustomDialog = CustomDialog;
