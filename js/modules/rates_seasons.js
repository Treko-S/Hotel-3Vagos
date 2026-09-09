/**
 * HOTEL 3 VAGOS - UTCD
 * Rates, Seasons, Promotions & Add-ons Revenue Management Module
 * Synchronized with Supabase (temporadas, promociones, reglas de precios)
 */

const RatesSeasonsModule = {
  seasons: [],
  currentTab: 'tab-seasons',

  // Reglas generales (con persistencia local sincronizada)
  rules: {
    baseGuests: 2,
    extraAdultFee: 60000,
    extraChildFee: 30000,
    weekendSurchargeEnabled: true,
    weekendSurchargePercent: 15
  },

  // Cupones y Promociones Climáticas / Corporativas (Tarea 3)
  promotions: [
    { code: 'INVIERNO2026', type: 'temporada', value: 15, desc: 'Promoción Temporada Invierno Climatizada', active: true, seasonKey: 'invierno' },
    { code: 'PRIMAVERA2026', type: 'temporada', value: 15, desc: 'Promoción Temporada Primavera Floral', active: false, seasonKey: 'primavera' },
    { code: 'VERANO2026', type: 'temporada', value: 20, desc: 'Promoción Temporada Alta Verano & Sol', active: false, seasonKey: 'verano' },
    { code: 'OTONO2026', type: 'temporada', value: 10, desc: 'Promoción Temporada Media Otoño', active: false, seasonKey: 'otono' },
    { code: 'UTCDPROMO', type: 'percent', value: 15, desc: 'Descuento Estudiantes y Docentes UTCD', active: true },
    { code: 'BIENVENIDA10', type: 'percent', value: 10, desc: 'Bienvenida Nuevos Clientes App/Web', active: true },
    { code: 'CORP_UTCD', type: 'corporate', value: 20, desc: 'Convenio Corporativo UTCD', active: true },
    { code: 'CORP_ITAU', type: 'corporate', value: 15, desc: 'Convenio Banco Itaú', active: true }
  ],

  // Planes de Tarifa & Políticas Comerciales Oficiales (Tarea 4)
  ratePlans: [
    {
      id: 'plan-flex',
      code: 'flexible',
      name: 'Tarifa Flexible Estándar',
      badge: 'Sin Riesgo',
      discount: 0,
      cancellation: 'Cancelación 100% gratuita hasta 24 hs previas al check-in. Máxima flexibilidad.',
      channels: 'todos',
      active: true
    },
    {
      id: 'plan-promo',
      code: 'promo',
      name: 'Tarifa Promo No Reembolsable',
      badge: 'Ahorra 10% 🌟',
      discount: 10,
      cancellation: 'Pago anticipado garantizado. No admite reembolso en caso de cancelación o no-show.',
      channels: 'todos',
      active: true
    },
    {
      id: 'plan-corp',
      code: 'corporativo',
      name: 'Tarifa Corporativa & Larga Estadía',
      badge: 'Ahorra 15% 💼',
      discount: 15,
      cancellation: 'Tarifa corporativa preferencial aplicable para convenios o estadías superiores a 3 noches.',
      channels: 'todos',
      active: true
    }
  ],

  // Catálogo Oficial de Add-ons y Servicios Adicionales
  addOnsCatalog: [
    { id: 'desayuno', name: 'Desayuno Buffet Premium', price: 35000, perPerson: true, perNight: true, icon: 'fas fa-utensils', desc: 'Buffet internacional completo con jugos, frutas, panificados y café de grano.' },
    { id: 'parking', name: 'Estacionamiento Techado & Seguro', price: 25000, perPerson: false, perNight: true, icon: 'fas fa-car', desc: 'Plaza de cochera bajo techo con vigilancia privada y cámaras 24 hs.' },
    { id: 'spa', name: 'Circuito Spa & Sauna Relax', price: 50000, perPerson: true, perNight: false, icon: 'fas fa-hot-tub', desc: 'Pase diario a piscina climatizada, sauna húmedo/seco y sala de relajación.' },
    { id: 'minibar_pack', name: 'Pack Minibar Bienvenida VIP', price: 80000, perPerson: false, perNight: false, icon: 'fas fa-cocktail', desc: 'Bebidas premium, snacks importados, chocolates finos y vino espumante.' },
    { id: 'late_checkout', name: 'Late Check-out Extendido (16:00 hs)', price: 70000, perPerson: false, perNight: false, icon: 'fas fa-clock', desc: 'Disfruta de la habitación hasta las 16:00 hs sin prisas.' }
  ],

  async init() {
    this.loadSavedRules();
    await this.loadSeasons();
    this.syncSeasonalPromotions();
    this.renderPromotionsTable();
    this.renderRatePlansTable();
    this.renderAddOnsCatalog();
    this.initSimulator();
    this.loadRatePlansFromRemote();
  },

  loadSavedRules() {
    try {
      const saved = localStorage.getItem('hotel_rate_rules');
      if (saved) {
        this.rules = Object.assign(this.rules, JSON.parse(saved));
      }
      const savedPromos = localStorage.getItem('hotel_rate_promos');
      if (savedPromos) {
        this.promotions = JSON.parse(savedPromos);
      }
      const savedPlans = localStorage.getItem('hotel_rate_plans');
      if (savedPlans) {
        this.ratePlans = JSON.parse(savedPlans);
      }
    } catch (e) {
      console.warn('Usando reglas por defecto:', e);
    }
  },

  saveRulesToStorage() {
    try {
      localStorage.setItem('hotel_rate_rules', JSON.stringify(this.rules));
      localStorage.setItem('hotel_rate_promos', JSON.stringify(this.promotions));
      localStorage.setItem('hotel_rate_plans', JSON.stringify(this.ratePlans));
      this.syncRatePlansToStorage();
    } catch (e) {
      console.error('Error guardando reglas:', e);
    }
  },

  /**
   * Sincroniza promociones climáticas por defecto según la temporada activa
   */
  syncSeasonalPromotions() {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeSeason = this.seasons.find(s => todayStr >= s.fecha_inicio && todayStr <= s.fecha_fin);
    if (!activeSeason) return;

    const seasonNameLower = (activeSeason.nombre || '').toLowerCase();
    this.promotions.forEach(p => {
      if (p.type === 'temporada' && p.seasonKey) {
        if (seasonNameLower.includes(p.seasonKey)) {
          p.active = true;
        }
      }
    });
    this.renderPromotionsTable();
  },

  /**
   * Cargar Temporadas desde Supabase
   */
  async loadSeasons() {
    const tbody = document.getElementById('seasons-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Cargando temporadas del calendario...</td></tr>`;
    }

    try {
      const { data, error } = await supabaseClient
        .from('temporadas')
        .select('*')
        .order('fecha_inicio', { ascending: true });

      if (error) throw error;

      this.seasons = data || [];
      this.renderSeasonsTable();
      this.populateSimulatorRooms();

    } catch (err) {
      console.error('Error al cargar temporadas:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 20px;">Error al conectar con Supabase: ${err.message}</td></tr>`;
      }
    }
  },

  renderSeasonsTable() {
    const tbody = document.getElementById('seasons-table-body');
    if (!tbody) return;

    if (this.seasons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay temporadas configuradas. Cree una nueva para comenzar.</td></tr>`;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    tbody.innerHTML = this.seasons.map(s => {
      let statusBadge = '';
      if (todayStr >= s.fecha_inicio && todayStr <= s.fecha_fin) {
        statusBadge = '<span class="badge badge-success"><span class="status-dot"></span> EN VIGOR AHORA</span>';
      } else if (todayStr < s.fecha_inicio) {
        statusBadge = '<span class="badge badge-info">Próxima</span>';
      } else {
        statusBadge = '<span class="badge" style="background: #E2E8F0; color: #64748B;">Finalizada</span>';
      }

      const mult = parseFloat(s.multiplicador_tarifa) || 1.0;
      let multText = `x${mult.toFixed(2)}`;
      let multBadgeColor = '#2563EB';
      if (mult > 1.0) {
        multText = `+${Math.round((mult - 1) * 100)}% (x${mult.toFixed(2)})`;
        multBadgeColor = '#B45309';
      } else if (mult < 1.0) {
        multText = `-${Math.round((1 - mult) * 100)}% (x${mult.toFixed(2)})`;
        multBadgeColor = '#16A34A';
      } else {
        multText = 'Tarifa Estándar (x1.00)';
        multBadgeColor = '#475569';
      }

      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-size: 14.5px;">${sanitizeInput(s.nombre)}</strong></td>
          <td><span style="font-family: monospace; font-size: 13px;">${s.fecha_inicio}</span></td>
          <td><span style="font-family: monospace; font-size: 13px;">${s.fecha_fin}</span></td>
          <td>
            <span style="font-weight: 700; color: ${multBadgeColor}; font-size: 13.5px; background: rgba(0,0,0,0.04); padding: 4px 8px; border-radius: 6px;">
              ${multText}
            </span>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-btn-group">
              <button class="btn-action btn-action-edit" onclick="RatesSeasonsModule.openSeasonModal(${s.id})" title="Editar Temporada">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn-action btn-action-checkout" onclick="RatesSeasonsModule.deleteSeason(${s.id})" title="Eliminar Temporada" style="background: rgba(220, 38, 38, 0.1); color: #DC2626; border-color: rgba(220, 38, 38, 0.3);">
                <i class="fas fa-trash-alt"></i> Borrar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.rates-tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.style.color = isActive ? 'var(--primary-navy)' : '#64748B';
      btn.style.borderBottom = isActive ? '3px solid var(--primary-blue)' : '3px solid transparent';
    });
    document.querySelectorAll('.rates-tab-content').forEach(content => {
      const isActive = content.id === tabId;
      content.style.display = isActive ? 'block' : 'none';
      content.classList.toggle('active', isActive);
    });

    if (tabId === 'tab-simulator') {
      this.populateSimulatorRooms();
    }
  },

  openSeasonModal(seasonId = null) {
    document.getElementById('season-id').value = seasonId || '';
    if (seasonId) {
      const s = this.seasons.find(x => x.id == seasonId);
      if (s) {
        document.getElementById('season-modal-title').innerText = 'Editar Temporada';
        document.getElementById('season-name').value = s.nombre;
        document.getElementById('season-start').value = s.fecha_inicio;
        document.getElementById('season-end').value = s.fecha_fin;
        document.getElementById('season-mult').value = s.multiplicador_tarifa || 1.0;
      }
    } else {
      document.getElementById('season-modal-title').innerText = 'Nueva Temporada';
      document.getElementById('season-name').value = '';
      document.getElementById('season-start').value = new Date().toISOString().split('T')[0];
      document.getElementById('season-end').value = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      document.getElementById('season-mult').value = '1.25';
    }
    openModal('modal-season-editor');
  },

  async saveSeason() {
    const saveBtn = document.getElementById('btn-save-season');
    try {
      const id = document.getElementById('season-id').value;
      const nombre = document.getElementById('season-name').value.trim();
      const fecha_inicio = document.getElementById('season-start').value;
      const fecha_fin = document.getElementById('season-end').value;
      const multiplicador_tarifa = parseFloat(document.getElementById('season-mult').value) || 1.0;

      if (!nombre || !fecha_inicio || !fecha_fin) {
        showToast('Complete todos los campos de la temporada', 'warning');
        return;
      }

      if (fecha_inicio > fecha_fin) {
        showToast('La fecha de inicio no puede ser posterior a la fecha de fin', 'warning');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      }

      const payload = {
        nombre,
        fecha_inicio,
        fecha_fin,
        multiplicador_tarifa
      };

      if (id) {
        const { error } = await supabaseClient
          .from('temporadas')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
        showToast('¡Temporada actualizada con éxito en Supabase!', 'success');
      } else {
        const { error } = await supabaseClient
          .from('temporadas')
          .insert(payload);
        if (error) throw error;
        showToast('¡Nueva temporada agregada exitosamente!', 'success');
      }

      closeModal('modal-season-editor');
      await this.loadSeasons();

    } catch (err) {
      console.error('Error al guardar temporada:', err);
      showToast('Error al guardar temporada: ' + err.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Temporada';
      }
    }
  },

  async deleteSeason(id) {
    const ok = await CustomDialog.confirm({
      title: 'Eliminar Temporada',
      message: '¿Está seguro de que desea eliminar esta temporada? Las tarifas volverán a sus valores estándar.',
      icon: 'fa-calendar-times',
      confirmText: 'Sí, Eliminar',
      isDanger: true
    });
    if (!ok) return;
    try {
      const { error } = await supabaseClient
        .from('temporadas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showToast('Temporada eliminada de Supabase', 'info');
      await this.loadSeasons();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  },

  saveGeneralRules() {
    this.rules.baseGuests = parseInt(document.getElementById('rule-base-guests').value) || 2;
    this.rules.extraAdultFee = parseInt(document.getElementById('rule-extra-adult').value) || 60000;
    this.rules.extraChildFee = parseInt(document.getElementById('rule-extra-child').value) || 30000;
    this.rules.weekendSurchargeEnabled = document.getElementById('rule-weekend-enabled').checked;
    this.rules.weekendSurchargePercent = parseInt(document.getElementById('rule-weekend-pct').value) || 15;

    this.saveRulesToStorage();
    showToast('¡Reglas de ocupación y fin de semana guardadas exitosamente!', 'success');
    this.calculateSimulation();
  },

  renderPromotionsTable() {
    const tbody = document.getElementById('promotions-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.promotions.map((p, idx) => `
      <tr>
        <td><strong style="font-family: monospace; font-size: 14px; background: #EEF2FF; color: #4338CA; padding: 3px 8px; border-radius: 4px;">${p.code}</strong></td>
        <td><span class="badge ${p.type === 'corporate' ? 'badge-warning' : 'badge-info'}">${p.type === 'corporate' ? 'Corporativo' : 'Promoción'}</span></td>
        <td><strong style="color: #10B981; font-size: 14px;">-${p.value}% OFF</strong></td>
        <td><span style="font-size: 12.5px; color: var(--text-muted);">${p.desc}</span></td>
        <td><span class="badge ${p.active ? 'badge-success' : 'badge-danger'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <div class="action-btn-group">
            <button class="btn-action ${p.active ? 'btn-action-status' : 'btn-action-reserve'}" onclick="RatesSeasonsModule.togglePromo(${idx})">
              ${p.active ? '<i class="fas fa-ban"></i> Desactivar' : '<i class="fas fa-check"></i> Activar'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  togglePromo(idx) {
    if (this.promotions[idx]) {
      this.promotions[idx].active = !this.promotions[idx].active;
      this.saveRulesToStorage();
      this.renderPromotionsTable();
      showToast(`Cupón ${this.promotions[idx].code} ${this.promotions[idx].active ? 'activado' : 'desactivado'}`, 'info');
    }
  },

  addNewPromo() {
    const code = document.getElementById('new-promo-code')?.value.trim().toUpperCase();
    const val = parseInt(document.getElementById('new-promo-val')?.value) || 10;
    const type = document.getElementById('new-promo-type')?.value || 'percent';
    const desc = document.getElementById('new-promo-desc')?.value.trim() || 'Descuento especial';

    if (!code) {
      showToast('Ingrese el código de la promoción', 'warning');
      return;
    }

    this.promotions.unshift({ code, type, value: val, desc, active: true });
    this.saveRulesToStorage();
    this.renderPromotionsTable();

    document.getElementById('new-promo-code').value = '';
    document.getElementById('new-promo-desc').value = '';
    showToast(`¡Promoción ${code} registrada exitosamente!`, 'success');
  },

  /**
   * ========================================================
   * GESTIÓN INTEGRAL DE PLANES DE TARIFA (TAREA 4)
   * ========================================================
   */
  renderRatePlansTable() {
    const tbody = document.getElementById('rate-plans-table-body');
    if (!tbody) return;

    if (!Array.isArray(this.ratePlans) || this.ratePlans.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay planes de tarifa registrados. Haga clic en "+ Nuevo Plan de Tarifa" para crear uno.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.ratePlans.map((p) => {
      const discountText = p.discount > 0 ? `<strong style="color: #10B981;">-${p.discount}% OFF</strong>` : '<span style="color: #64748B; font-weight: 500;">Tarifa Estándar (0%)</span>';
      const badgeHtml = p.badge ? `<span class="badge" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-weight: 600;">${sanitizeInput(p.badge)}</span>` : '<span style="color: #94A3B8;">-</span>';
      
      let channelsText = 'Todos (App y Web)';
      if (p.channels === 'app') channelsText = '<i class="fas fa-mobile-alt" style="color: #0284C7;"></i> Solo App Móvil';
      else if (p.channels === 'recepcion') channelsText = '<i class="fas fa-desktop" style="color: #B45309;"></i> Solo Recepción';

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--primary-navy); font-size: 14px;">${sanitizeInput(p.name)}</div>
            <div style="font-family: monospace; font-size: 11.5px; color: #6366F1; font-weight: bold;">código: ${sanitizeInput(p.code)}</div>
          </td>
          <td>${badgeHtml}</td>
          <td>${discountText}</td>
          <td style="max-width: 280px;"><span style="font-size: 12px; color: var(--text-muted); line-height: 1.35; display: block;">${sanitizeInput(p.cancellation)}</span></td>
          <td><span style="font-size: 12px; font-weight: 500;">${channelsText}</span></td>
          <td>
            <span class="badge ${p.active ? 'badge-success' : 'badge-danger'}">
              ${p.active ? '<span class="status-dot"></span> Activo' : 'Inactivo'}
            </span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn-action btn-action-edit" onclick="RatesSeasonsModule.openRatePlanModal('${p.id}')" title="Editar Plan">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn-action ${p.active ? 'btn-action-status' : 'btn-action-reserve'}" onclick="RatesSeasonsModule.toggleRatePlan('${p.id}')" title="${p.active ? 'Pausar' : 'Activar'}">
                ${p.active ? '<i class="fas fa-ban"></i>' : '<i class="fas fa-check"></i>'}
              </button>
              <button class="btn-action btn-action-checkout" onclick="RatesSeasonsModule.deleteRatePlan('${p.id}')" title="Eliminar Plan" style="background: rgba(220, 38, 38, 0.1); color: #DC2626; border-color: rgba(220, 38, 38, 0.3);">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openRatePlanModal(planId = null) {
    document.getElementById('rate-plan-id').value = planId || '';
    if (planId) {
      const p = this.ratePlans.find(x => x.id === planId);
      if (p) {
        document.getElementById('rate-plan-modal-title').innerHTML = '<i class="fas fa-layer-group" style="color: var(--accent-gold);"></i> Editar Plan de Tarifa';
        document.getElementById('rate-plan-name').value = p.name || '';
        document.getElementById('rate-plan-code').value = p.code || '';
        document.getElementById('rate-plan-badge').value = p.badge || '';
        document.getElementById('rate-plan-discount').value = p.discount || 0;
        document.getElementById('rate-plan-cancellation').value = p.cancellation || '';
        document.getElementById('rate-plan-channels').value = p.channels || 'todos';
        document.getElementById('rate-plan-active').value = p.active ? 'true' : 'false';
      }
    } else {
      document.getElementById('rate-plan-modal-title').innerHTML = '<i class="fas fa-layer-group" style="color: var(--accent-gold);"></i> Nuevo Plan de Tarifa';
      document.getElementById('rate-plan-name').value = '';
      document.getElementById('rate-plan-code').value = '';
      document.getElementById('rate-plan-badge').value = '';
      document.getElementById('rate-plan-discount').value = '0';
      document.getElementById('rate-plan-cancellation').value = 'Cancelación flexible según políticas generales del hotel.';
      document.getElementById('rate-plan-channels').value = 'todos';
      document.getElementById('rate-plan-active').value = 'true';
    }
    openModal('modal-rate-plan-editor');
  },

  saveRatePlan() {
    const id = document.getElementById('rate-plan-id').value.trim();
    const name = document.getElementById('rate-plan-name').value.trim();
    const code = document.getElementById('rate-plan-code').value.trim().toLowerCase().replace(/\s+/g, '_');
    const badge = document.getElementById('rate-plan-badge').value.trim();
    const discount = parseInt(document.getElementById('rate-plan-discount').value) || 0;
    const cancellation = document.getElementById('rate-plan-cancellation').value.trim();
    const channels = document.getElementById('rate-plan-channels').value;
    const active = document.getElementById('rate-plan-active').value === 'true';

    if (!name || !code || !cancellation) {
      showToast('Complete todos los campos obligatorios del plan', 'warning');
      return;
    }

    if (id) {
      const idx = this.ratePlans.findIndex(x => x.id === id);
      if (idx !== -1) {
        this.ratePlans[idx] = { ...this.ratePlans[idx], name, code, badge, discount, cancellation, channels, active };
        showToast('Plan de tarifa actualizado con éxito', 'success');
      }
    } else {
      const existingCode = this.ratePlans.find(x => x.code === code);
      if (existingCode) {
        showToast(`Ya existe un plan con el código "${code}"`, 'warning');
        return;
      }
      const newPlan = {
        id: 'plan_' + Date.now().toString(36),
        name,
        code,
        badge,
        discount,
        cancellation,
        channels,
        active
      };
      this.ratePlans.push(newPlan);
      showToast(`Nuevo plan "${name}" registrado exitosamente`, 'success');
    }

    this.saveRulesToStorage();
    this.renderRatePlansTable();
    closeModal('modal-rate-plan-editor');

    if (typeof RoomsModule !== 'undefined' && RoomsModule.rooms && RoomsModule.rooms.length > 0) {
      RoomsModule.renderRoomsTable();
    }
  },

  async deleteRatePlan(id) {
    const p = this.ratePlans.find(x => x.id === id);
    if (!p) return;

    const ok = await CustomDialog.confirm({
      title: 'Eliminar Plan de Tarifa',
      message: `¿Está seguro de eliminar el plan "${p.name}"? Las reservas previas mantendrán sus importes pactados.`,
      icon: 'fa-trash-alt',
      confirmText: 'Sí, Eliminar',
      isDanger: true
    });
    if (!ok) return;

    this.ratePlans = this.ratePlans.filter(x => x.id !== id);
    this.saveRulesToStorage();
    this.renderRatePlansTable();
    showToast(`Plan "${p.name}" eliminado`, 'info');

    if (typeof RoomsModule !== 'undefined' && RoomsModule.rooms && RoomsModule.rooms.length > 0) {
      RoomsModule.renderRoomsTable();
    }
  },

  toggleRatePlan(id) {
    const p = this.ratePlans.find(x => x.id === id);
    if (p) {
      p.active = !p.active;
      this.saveRulesToStorage();
      this.renderRatePlansTable();
      showToast(`Plan ${p.name} ${p.active ? 'activado' : 'pausado'}`, 'info');

      if (typeof RoomsModule !== 'undefined' && RoomsModule.rooms && RoomsModule.rooms.length > 0) {
        RoomsModule.renderRoomsTable();
      }
    }
  },

  async syncRatePlansToStorage() {
    try {
      if (typeof supabaseClient !== 'undefined') {
        const payload = JSON.stringify(this.ratePlans, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        await supabaseClient.storage.from('hotel-rooms').upload('config/rate_plans.json', blob, {
          upsert: true,
          contentType: 'application/json'
        });

        // Broadcast a la app móvil
        await supabaseClient.channel('hotel_universal_sync').send({
          type: 'broadcast',
          event: 'rate_plans_updated',
          payload: { timestamp: Date.now(), plans: this.ratePlans }
        });
      }
    } catch (e) {
      console.warn('Sync de planes a Supabase Storage diferido:', e);
    }
  },

  async loadRatePlansFromRemote() {
    try {
      const res = await fetch('https://nfbiqdhiowroosvfazid.supabase.co/storage/v1/object/public/hotel-rooms/config/rate_plans.json?t=' + Date.now());
      if (res.ok) {
        const remotePlans = await res.json();
        if (Array.isArray(remotePlans) && remotePlans.length > 0) {
          this.ratePlans = remotePlans;
          localStorage.setItem('hotel_rate_plans', JSON.stringify(this.ratePlans));
          this.renderRatePlansTable();
        }
      }
    } catch (e) {
      console.warn('Planes remotos no disponibles todavía, usando locales:', e);
    }
  },

  renderAddOnsCatalog() {
    const container = document.getElementById('addons-cards-container');
    if (!container) return;

    container.innerHTML = this.addOnsCatalog.map(a => `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 8px; background: #EEF2FF; color: var(--primary-blue); display: flex; align-items: center; justify-content: center; font-size: 18px;">
              <i class="${a.icon}"></i>
            </div>
            <strong style="font-size: 16px; color: var(--accent-gold);">${formatGs(a.price)}</strong>
          </div>
          <h4 style="font-size: 14px; font-weight: 600; color: var(--primary-navy); margin: 0 0 6px 0;">${a.name}</h4>
          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin: 0 0 10px 0;">${a.desc}</p>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 10px; font-size: 11.5px; color: #64748B;">
          <span>${a.perNight ? 'Por noche' : 'Cargo único'}</span>
          <span>${a.perPerson ? 'Por persona' : 'Por reserva'}</span>
        </div>
      </div>
    `).join('');
  },

  /**
   * Inicializar Cotizador / Simulador de Tarifas
   */
  initSimulator() {
    const today = new Date();
    const checkIn = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
    const checkOut = new Date(today.getTime() + 3 * 86400000).toISOString().split('T')[0];

    const inEl = document.getElementById('sim-checkin');
    const outEl = document.getElementById('sim-checkout');
    if (inEl) inEl.value = checkIn;
    if (outEl) outEl.value = checkOut;

    // Renderizar checkboxes de add-ons en el simulador
    const addOnList = document.getElementById('sim-addons-list');
    if (addOnList) {
      addOnList.innerHTML = this.addOnsCatalog.map(a => `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 6px; cursor: pointer; background: #fff;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px;">
            <input type="checkbox" name="sim_addon" value="${a.id}" onchange="RatesSeasonsModule.calculateSimulation()">
            <i class="${a.icon}" style="color: var(--primary-blue); font-size: 13px;"></i>
            <span>${a.name}</span>
          </div>
          <strong style="color: var(--accent-gold); font-size: 12px;">+${formatGs(a.price)}</strong>
        </label>
      `).join('');
    }

    this.calculateSimulation();
  },

  populateSimulatorRooms() {
    const select = document.getElementById('sim-room');
    if (!select) return;

    const list = (typeof RoomsModule !== 'undefined' && Array.isArray(RoomsModule.rooms) && RoomsModule.rooms.length > 0)
      ? RoomsModule.rooms
      : [];

    if (list.length === 0) {
      select.innerHTML = '<option value="1" data-price="180000">Habitación 101 - Standard Single (180.000 Gs./noche)</option>';
    } else {
      select.innerHTML = list.map(r => {
        const tipo = r.tipos_habitacion || {};
        const carac = (r.caracteristicas && typeof r.caracteristicas === 'object') ? r.caracteristicas : {};
        const price = carac.precio_personalizado || tipo.precio_base_noche || 180000;
        return `<option value="${r.id}" data-price="${price}">Habitación ${r.numero} - ${tipo.nombre || 'Estándar'} (${formatGs(price)}/noche)</option>`;
      }).join('');
    }

    this.calculateSimulation();
  },

  /**
   * Motor de Cálculo de Tarifas (Yield & Revenue Engine)
   */
  calculateSimulation() {
    const simRoomSelect = document.getElementById('sim-room');
    if (!simRoomSelect) return;

    const roomId = simRoomSelect.value;
    const checkInStr = document.getElementById('sim-checkin')?.value;
    const checkOutStr = document.getElementById('sim-checkout')?.value;
    const adults = parseInt(document.getElementById('sim-adults')?.value) || 1;
    const children = parseInt(document.getElementById('sim-children')?.value) || 0;
    const promoCode = document.getElementById('sim-promocode')?.value.trim().toUpperCase() || '';

    // Add-ons seleccionados
    const selectedAddOns = [];
    document.querySelectorAll('input[name="sim_addon"]:checked').forEach(ch => {
      selectedAddOns.push(ch.value);
    });

    // 1. Obtener precio base de la habitación
    const selectedOpt = simRoomSelect.options[simRoomSelect.selectedIndex];
    const baseDailyRate = parseInt(selectedOpt?.dataset?.price) || 180000;

    // 2. Calcular número de noches y fechas
    const dIn = new Date(checkInStr);
    const dOut = new Date(checkOutStr);
    let nights = Math.round((dOut - dIn) / (1000 * 60 * 60 * 24));
    if (nights <= 0 || isNaN(nights)) nights = 1;

    // 3. Evaluar Temporada en Supabase según fechas
    let detectedSeason = null;
    let seasonMultiplier = 1.0;
    for (const s of this.seasons) {
      if (checkInStr >= s.fecha_inicio && checkInStr <= s.fecha_fin) {
        detectedSeason = s;
        seasonMultiplier = parseFloat(s.multiplicador_tarifa) || 1.0;
        break;
      }
    }

    // 4. Evaluar noches de Fin de Semana (Viernes & Sábado)
    let weekendNightsCount = 0;
    let curDate = new Date(dIn);
    for (let i = 0; i < nights; i++) {
      const dayOfWeek = curDate.getDay(); // 0 = Domingo, 5 = Viernes, 6 = Sábado
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        weekendNightsCount++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    let weekendSurchargeTotal = 0;
    if (this.rules.weekendSurchargeEnabled && weekendNightsCount > 0) {
      const surchargePerWeekendNight = baseDailyRate * (this.rules.weekendSurchargePercent / 100);
      weekendSurchargeTotal = surchargePerWeekendNight * weekendNightsCount;
    }

    // 5. Huéspedes adicionales
    const baseGuests = this.rules.baseGuests || 2;
    const extraAdults = Math.max(0, adults - baseGuests);
    const extraAdultFeeTotal = extraAdults * (this.rules.extraAdultFee || 60000) * nights;
    const extraChildFeeTotal = children * (this.rules.extraChildFee || 30000) * nights;

    // 6. Subtotal Habitación con Temporada
    const roomSubtotalWithoutSeason = baseDailyRate * nights;
    const seasonAdjustmentAmount = (baseDailyRate * seasonMultiplier * nights) - roomSubtotalWithoutSeason;
    const roomTotalWithSeason = (baseDailyRate * seasonMultiplier * nights) + weekendSurchargeTotal + extraAdultFeeTotal + extraChildFeeTotal;

    // 7. Add-ons / Servicios adicionales
    let addOnsTotal = 0;
    const totalGuests = adults + children;
    selectedAddOns.forEach(addonId => {
      const item = this.addOnsCatalog.find(x => x.id === addonId);
      if (item) {
        let cost = item.price;
        if (item.perNight) cost *= nights;
        if (item.perPerson) cost *= totalGuests;
        addOnsTotal += cost;
      }
    });

    // 8. Descuento por Promoción / Convenio
    let discountAmount = 0;
    let appliedPromo = null;
    if (promoCode) {
      appliedPromo = this.promotions.find(p => p.code === promoCode && p.active);
      if (appliedPromo) {
        discountAmount = Math.round((roomTotalWithSeason + addOnsTotal) * (appliedPromo.value / 100));
      }
    }

    // 9. Total Final e Impuestos
    const grossTotal = Math.max(0, roomTotalWithSeason + addOnsTotal - discountAmount);
    const iva10 = Math.round(grossTotal / 11);

    // Renderizar Desglose en Pantalla
    this.renderSimulationBreakdown({
      baseDailyRate,
      nights,
      detectedSeason,
      seasonMultiplier,
      seasonAdjustmentAmount,
      weekendNightsCount,
      weekendSurchargeTotal,
      extraAdults,
      extraAdultFeeTotal,
      children,
      extraChildFeeTotal,
      addOnsTotal,
      appliedPromo,
      discountAmount,
      grossTotal,
      iva10
    });
  },

  renderSimulationBreakdown(data) {
    const el = document.getElementById('sim-breakdown-result');
    if (!el) return;

    el.innerHTML = `
      <div style="background: #0F172A; color: #F8FAFC; border-radius: 14px; padding: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
        <h4 style="color: var(--accent-gold); font-size: 15px; margin: 0 0 14px 0; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fas fa-receipt"></i> Cotización Oficial Hotelera</span>
          <span style="font-size: 11px; background: rgba(217,119,6,0.25); color: #FCD34D; padding: 3px 8px; border-radius: 6px;">IVA 10% Incluido</span>
        </h4>

        <div style="font-size: 13px; line-height: 1.8; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Tarifa Base (${data.nights} noche${data.nights > 1 ? 's' : ''} x ${formatGs(data.baseDailyRate)}):</span>
            <strong>${formatGs(data.baseDailyRate * data.nights)}</strong>
          </div>

          ${data.detectedSeason ? `
            <div style="display: flex; justify-content: space-between; color: ${data.seasonMultiplier >= 1.0 ? '#FBBF24' : '#34D399'};">
              <span><i class="fas fa-calendar-check"></i> ${data.detectedSeason.nombre} (x${data.seasonMultiplier.toFixed(2)}):</span>
              <strong>${data.seasonAdjustmentAmount >= 0 ? '+' : ''}${formatGs(data.seasonAdjustmentAmount)}</strong>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; color: #94A3B8;">
              <span>Temporada Estándar (x1.00):</span>
              <span>Sin variación</span>
            </div>
          `}

          ${data.weekendSurchargeTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #F87171;">
              <span>Recargo Fin de Semana (${data.weekendNightsCount} noche${data.weekendNightsCount > 1 ? 's' : ''}):</span>
              <strong>+${formatGs(data.weekendSurchargeTotal)}</strong>
            </div>
          ` : ''}

          ${data.extraAdultFeeTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #CBD5E1;">
              <span>Adultos adicionales (${data.extraAdults} pers.):</span>
              <strong>+${formatGs(data.extraAdultFeeTotal)}</strong>
            </div>
          ` : ''}

          ${data.extraChildFeeTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #CBD5E1;">
              <span>Niños acompañantes (${data.children} pers.):</span>
              <strong>+${formatGs(data.extraChildFeeTotal)}</strong>
            </div>
          ` : ''}

          ${data.addOnsTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #60A5FA;">
              <span>Servicios & Add-ons seleccionados:</span>
              <strong>+${formatGs(data.addOnsTotal)}</strong>
            </div>
          ` : ''}

          ${data.discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #34D399; font-weight: bold;">
              <span>Descuento (${data.appliedPromo.code} -${data.appliedPromo.value}%):</span>
              <strong>-${formatGs(data.discountAmount)}</strong>
            </div>
          ` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px;">
          <div>
            <div style="font-size: 11px; color: #94A3B8;">Liquidación Liquidada en Folio</div>
            <div style="font-size: 12px; color: #CBD5E1;">Liquidación IVA 10%: ${formatGs(data.iva10)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase;">Total a Pagar</div>
            <div style="font-size: 24px; font-weight: 800; color: #FCD34D;">${formatGs(data.grossTotal)}</div>
          </div>
        </div>
      </div>
    `;
  }
};
