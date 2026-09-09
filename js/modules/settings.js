/**
 * HOTEL 3 VAGOS - UTCD PMS
 * Master Settings Module (Tarea 16)
 * Singleton configuration synchronized with Supabase DB, Storage & Flutter App
 */

const SettingsModule = {
  currentSettings: {
    id: 1,
    hotel_name: 'Hotel 3 Vagos',
    commercial_name: 'Hospitality UTCD',
    ruc: '80092341-2',
    address: 'Avda. Santa Teresa c/ Aviadores del Chaco, Asunción, Paraguay',
    phone: '+595 21 600 000',
    whatsapp: '+595 981 123 456',
    email: 'reservas@hotel3vagos.com.py',
    currency: 'Gs.',
    timezone: 'America/Asuncion',
    check_in_time: '14:00',
    check_out_time: '11:00',
    cancellation_policy_text: 'Cancelación 100% gratuita hasta 24 hs previas al check-in en Tarifa Flexible. Tarifa Promo no reembolsable.',
    terms_and_conditions_text: 'Prohibido fumar en todas las habitaciones y áreas cerradas del hotel. Horario de descanso y silencio de 22:00 a 08:00 hs. Presentar documento de identidad o pasaporte original al ingresar.',
    logo_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    tax_vat_rate: 10.0
  },
  roomTypes: [],

  async init() {
    await this.loadSettings();
    await this.loadRoomTypes();
  },

  async loadSettings() {
    try {
      // 1. Intentar cargar desde Supabase si la tabla hotel_settings existe
      if (typeof supabaseClient !== 'undefined') {
        const { data, error } = await supabaseClient
          .from('hotel_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data) {
          this.currentSettings = {
            ...this.currentSettings,
            ...data,
            check_in_time: data.check_in_time ? data.check_in_time.substring(0, 5) : '14:00',
            check_out_time: data.check_out_time ? data.check_out_time.substring(0, 5) : '11:00'
          };
          this.populateForm();
          this.applyGlobalBranding();
          return;
        }
      }

      // 2. Intentar cargar desde Supabase Storage hotel-rooms/config/hotel_settings.json
      if (typeof supabaseClient !== 'undefined') {
        const { data: fileData, error: fileErr } = await supabaseClient.storage
          .from('hotel-rooms')
          .download('config/hotel_settings.json');

        if (!fileErr && fileData) {
          const text = await fileData.text();
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            this.currentSettings = { ...this.currentSettings, ...parsed };
            this.populateForm();
            this.applyGlobalBranding();
            return;
          }
        }
      }

      // 3. Fallback localStorage
      const saved = localStorage.getItem('hotel_master_settings');
      if (saved) {
        this.currentSettings = { ...this.currentSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('SettingsModule.loadSettings: usando fallback local:', e);
      const saved = localStorage.getItem('hotel_master_settings');
      if (saved) {
        this.currentSettings = { ...this.currentSettings, ...JSON.parse(saved) };
      }
    }

    this.populateForm();
    this.applyGlobalBranding();
  },

  populateForm() {
    const s = this.currentSettings;

    // Tab 1: Perfil
    const nameEl = document.getElementById('setting-hotel-name');
    if (nameEl) nameEl.value = s.hotel_name || '';

    const commEl = document.getElementById('setting-commercial-name');
    if (commEl) commEl.value = s.commercial_name || '';

    const rucEl = document.getElementById('setting-ruc');
    if (rucEl) rucEl.value = s.ruc || '80092341-2';

    const currEl = document.getElementById('setting-currency');
    if (currEl) currEl.value = s.currency || 'Gs.';

    const tzEl = document.getElementById('setting-timezone');
    if (tzEl) tzEl.value = s.timezone || 'America/Asuncion';

    const phoneEl = document.getElementById('setting-phone');
    if (phoneEl) phoneEl.value = s.phone || '';

    const waEl = document.getElementById('setting-whatsapp');
    if (waEl) waEl.value = s.whatsapp || '';

    const emailEl = document.getElementById('setting-email');
    if (emailEl) emailEl.value = s.email || '';

    const addrEl = document.getElementById('setting-address');
    if (addrEl) addrEl.value = s.address || '';

    const logoEl = document.getElementById('setting-logo-url');
    if (logoEl) logoEl.value = s.logo_url || '';
    this.previewLogo(s.logo_url);

    // Tab 2: Políticas
    const inTimeEl = document.getElementById('setting-checkin-time');
    if (inTimeEl) inTimeEl.value = s.check_in_time ? s.check_in_time.substring(0, 5) : '14:00';

    const outTimeEl = document.getElementById('setting-checkout-time');
    if (outTimeEl) outTimeEl.value = s.check_out_time ? s.check_out_time.substring(0, 5) : '11:00';

    const cancelEl = document.getElementById('setting-cancellation-text');
    if (cancelEl) cancelEl.value = s.cancellation_policy_text || '';

    const termsEl = document.getElementById('setting-terms-text');
    if (termsEl) termsEl.value = s.terms_and_conditions_text || '';

    // Tab 3: Impuesto IVA
    const vatEl = document.getElementById('setting-tax-vat-rate');
    if (vatEl) vatEl.value = s.tax_vat_rate || 10.0;
  },

  previewLogo(url) {
    const preview = document.getElementById('setting-logo-preview');
    if (preview && url) {
      preview.src = url;
    }
  },

  applyGlobalBranding() {
    const s = this.currentSettings;
    // Sincronizar nombre en la barra superior o cabecera si existen
    const hotelTitles = document.querySelectorAll('.hotel-brand-name');
    hotelTitles.forEach(el => {
      el.innerText = s.hotel_name;
    });

    // Guardar en variable global accesible por el módulo de facturación
    window.HOTEL_GLOBAL_SETTINGS = s;
  },

  async saveSettings() {
    const btn = document.getElementById('btn-save-master-settings');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const updated = {
        id: 1,
        hotel_name: document.getElementById('setting-hotel-name')?.value.trim() || 'Hotel 3 Vagos',
        commercial_name: document.getElementById('setting-commercial-name')?.value.trim() || 'Hospitality UTCD',
        ruc: document.getElementById('setting-ruc')?.value.trim() || '80092341-2',
        currency: document.getElementById('setting-currency')?.value.trim() || 'Gs.',
        timezone: document.getElementById('setting-timezone')?.value || 'America/Asuncion',
        phone: document.getElementById('setting-phone')?.value.trim() || '',
        whatsapp: document.getElementById('setting-whatsapp')?.value.trim() || '',
        email: document.getElementById('setting-email')?.value.trim() || '',
        address: document.getElementById('setting-address')?.value.trim() || '',
        logo_url: document.getElementById('setting-logo-url')?.value.trim() || '',
        check_in_time: document.getElementById('setting-checkin-time')?.value || '14:00',
        check_out_time: document.getElementById('setting-checkout-time')?.value || '11:00',
        cancellation_policy_text: document.getElementById('setting-cancellation-text')?.value.trim() || '',
        terms_and_conditions_text: document.getElementById('setting-terms-text')?.value.trim() || '',
        tax_vat_rate: parseFloat(document.getElementById('setting-tax-vat-rate')?.value) || 10.0,
        updated_at: new Date().toISOString()
      };

      this.currentSettings = updated;

      // 1. Guardar en Supabase tabla hotel_settings (singleton id = 1)
      if (typeof supabaseClient !== 'undefined') {
        try {
          const dbPayload = {
            id: 1,
            hotel_name: updated.hotel_name,
            commercial_name: updated.commercial_name,
            ruc: updated.ruc,
            address: updated.address,
            phone: updated.phone,
            whatsapp: updated.whatsapp,
            email: updated.email,
            currency: updated.currency,
            timezone: updated.timezone,
            check_in_time: updated.check_in_time + ':00',
            check_out_time: updated.check_out_time + ':00',
            cancellation_policy_text: updated.cancellation_policy_text,
            terms_and_conditions_text: updated.terms_and_conditions_text,
            logo_url: updated.logo_url,
            updated_at: new Date().toISOString()
          };

          await supabaseClient
            .from('hotel_settings')
            .upsert(dbPayload, { onConflict: 'id' });

          // Actualizar tax_rules si existe
          await supabaseClient
            .from('tax_rules')
            .upsert({ id: 1, rate: updated.tax_vat_rate }, { onConflict: 'id' });
        } catch (dbErr) {
          console.warn('Error guardando en Supabase DB hotel_settings:', dbErr);
        }
      }

      // 2. Sincronizar en Supabase Storage (hotel-rooms/config/hotel_settings.json)
      if (typeof supabaseClient !== 'undefined') {
        try {
          const jsonBlob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' });
          await supabaseClient.storage
            .from('hotel-rooms')
            .upload('config/hotel_settings.json', jsonBlob, { upsert: true });
        } catch (stErr) {
          console.warn('Error subiendo hotel_settings.json a Storage:', stErr);
        }
      }

      // 3. Guardar en localStorage
      localStorage.setItem('hotel_master_settings', JSON.stringify(updated));

      this.applyGlobalBranding();
      showToast('Configuración general y parámetros maestros guardados con éxito', 'success');
    } catch (err) {
      console.error('Error en saveSettings:', err);
      showToast('Error al guardar configuración: ' + (err.message || err), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async loadRoomTypes() {
    const tbody = document.getElementById('settings-room-types-tbody');
    if (!tbody) return;

    try {
      if (typeof supabaseClient !== 'undefined') {
        const { data, error } = await supabaseClient
          .from('tipos_habitacion')
          .select('*')
          .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
          this.roomTypes = data;
          this.renderRoomTypesTable();
          return;
        }
      }

      if (typeof RoomsModule !== 'undefined' && RoomsModule.roomTypes && RoomsModule.roomTypes.length > 0) {
        this.roomTypes = RoomsModule.roomTypes;
      } else {
        this.roomTypes = [
          { id: 1, nombre: 'Individual Estándar', capacidad_personas: 1, precio_base: 220000 },
          { id: 2, nombre: 'Doble Twin / Matrimonial', capacidad_personas: 2, precio_base: 320000 },
          { id: 3, nombre: 'Suite Presidencial Ejecutiva', capacidad_personas: 4, precio_base: 650000 },
          { id: 4, nombre: 'Familiar Superior Confort', capacidad_personas: 5, precio_base: 550000 }
        ];
      }
    } catch (e) {
      console.warn('Error cargando roomTypes en SettingsModule:', e);
      this.roomTypes = [
        { id: 1, nombre: 'Individual Estándar', capacidad_personas: 1, precio_base: 220000 },
        { id: 2, nombre: 'Doble Twin / Matrimonial', capacidad_personas: 2, precio_base: 320000 },
        { id: 3, nombre: 'Suite Presidencial Ejecutiva', capacidad_personas: 4, precio_base: 650000 }
      ];
    }

    this.renderRoomTypesTable();
  },

  renderRoomTypesTable() {
    const tbody = document.getElementById('settings-room-types-tbody');
    if (!tbody) return;

    if (!this.roomTypes || this.roomTypes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay categorías registradas</td></tr>';
      return;
    }

    tbody.innerHTML = this.roomTypes.map(rt => {
      const priceText = rt.precio_base ? formatGs(rt.precio_base) : 'Tarifa dinámica';
      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--text-muted);">#${rt.id}</td>
          <td>
            <strong style="color: var(--primary-navy);">${sanitizeInput(rt.nombre)}</strong>
          </td>
          <td style="text-align: center;">
            <span class="badge" style="background: #EFF6FF; color: #1D4ED8; font-weight: 700;">
              <i class="fas fa-users" style="margin-right: 4px;"></i>Hasta ${rt.capacidad_personas || 2} personas
            </span>
          </td>
          <td style="text-align: right; font-weight: 700; color: #059669;">
            ${priceText}
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button type="button" class="btn btn-sm btn-outline" onclick="SettingsModule.editRoomType(${rt.id})" title="Editar categoría" style="padding: 4px 8px;">
                <i class="fas fa-edit" style="color: var(--primary-blue);"></i>
              </button>
              <button type="button" class="btn btn-sm btn-outline" onclick="SettingsModule.deleteRoomType(${rt.id})" title="Eliminar categoría" style="padding: 4px 8px; color: #DC2626;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openNewRoomTypeDialog() {
    const nombre = prompt('Ingrese el nombre de la nueva categoría base (Ej. Cabaña Deluxe):');
    if (!nombre || !nombre.trim()) return;

    const capacidadStr = prompt('Capacidad máxima de personas para esta categoría:', '2');
    const capacidad = parseInt(capacidadStr, 10) || 2;

    const precioStr = prompt('Tarifa base de referencia en Guaraníes (Gs.):', '300000');
    const precio = parseFloat(precioStr) || 300000;

    try {
      if (typeof supabaseClient !== 'undefined') {
        const { data, error } = await supabaseClient
          .from('tipos_habitacion')
          .insert({
            nombre: nombre.trim(),
            capacidad_personas: capacidad,
            precio_base: precio
          })
          .select();

        if (!error && data && data[0]) {
          this.roomTypes.push(data[0]);
          this.renderRoomTypesTable();
          if (typeof RoomsModule !== 'undefined') RoomsModule.loadRoomTypes();
          showToast(`Categoría "${nombre}" creada exitosamente`, 'success');
          return;
        }
      }
    } catch (e) {
      console.warn('Error insertando en Supabase tipos_habitacion:', e);
    }

    const newId = (this.roomTypes.reduce((max, r) => Math.max(max, r.id || 0), 0) || 0) + 1;
    this.roomTypes.push({ id: newId, nombre: nombre.trim(), capacidad_personas: capacidad, precio_base: precio });
    this.renderRoomTypesTable();
    showToast(`Categoría "${nombre}" registrada localmente`, 'success');
  },

  async editRoomType(id) {
    const rt = this.roomTypes.find(r => r.id === id);
    if (!rt) return;

    const nuevoNombre = prompt('Editar nombre de categoría:', rt.nombre);
    if (!nuevoNombre || !nuevoNombre.trim()) return;

    const nuevaCapacidadStr = prompt('Editar capacidad máxima de personas:', rt.capacidad_personas || 2);
    const nuevaCapacidad = parseInt(nuevaCapacidadStr, 10) || rt.capacidad_personas || 2;

    rt.nombre = nuevoNombre.trim();
    rt.capacidad_personas = nuevaCapacidad;

    try {
      if (typeof supabaseClient !== 'undefined') {
        await supabaseClient
          .from('tipos_habitacion')
          .update({ nombre: rt.nombre, capacidad_personas: rt.capacidad_personas })
          .eq('id', id);
      }
    } catch (e) {
      console.warn('Error actualizando tipos_habitacion:', e);
    }

    this.renderRoomTypesTable();
    if (typeof RoomsModule !== 'undefined') RoomsModule.loadRoomTypes();
    showToast(`Categoría "${rt.nombre}" actualizada`, 'info');
  },

  async deleteRoomType(id) {
    if (!confirm('¿Está seguro de eliminar esta categoría base?')) return;

    try {
      if (typeof supabaseClient !== 'undefined') {
        await supabaseClient
          .from('tipos_habitacion')
          .delete()
          .eq('id', id);
      }
    } catch (e) {
      console.warn('Error eliminando tipos_habitacion:', e);
    }

    this.roomTypes = this.roomTypes.filter(r => r.id !== id);
    this.renderRoomTypesTable();
    if (typeof RoomsModule !== 'undefined') RoomsModule.loadRoomTypes();
    showToast('Categoría eliminada', 'info');
  }
};
