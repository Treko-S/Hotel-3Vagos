/**
 * Inventory & Catalog Module - Hotel 3 Vagos
 * Gestión de:
 * 1. Catálogo Para la Venta (Minibar, Room Service, Spa, Servicios Extra) con switch para App Móvil
 * 2. Uso Interno (Insumos de limpieza, Lencería/Blancos, Amenidades, Repuestos) con control de fugas
 */
const InventoryModule = {
  activeTab: 'sales', // 'sales' | 'internal'
  salesItems: [],
  internalItems: [],
  stockMovements: [],
  selectedCategory: 'all',
  sortBy: 'category',

  async init() {
    this.loadData();
    this.renderSalesCatalog();
    this.renderInternalInventory();
  },

  loadData() {
    // 1. Catálogo para la venta (Servicios, Room Service, Minibar)
    try {
      const savedSales = localStorage.getItem('hotel_catalog_sales');
      if (savedSales) {
        this.salesItems = JSON.parse(savedSales);
        // Garantizar que todos los ítems posean imagen por defecto si aún no la tienen
        const defaultImages = {
          1: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800",
          2: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
          3: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800",
          4: "https://images.unsplash.com/photo-1608270199026-663f7389a056?w=800",
          5: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
          6: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800"
        };
        this.salesItems.forEach(item => {
          if (!item.imageUrl && defaultImages[item.id]) {
            item.imageUrl = defaultImages[item.id];
          }
        });
        this.saveSalesData();
      } else {
        this.salesItems = [
          {
            id: 1,
            name: "Desayuno Buffet Americano Extra",
            category: "Servicios Extra",
            price: 65000,
            availableInApp: true,
            stock: null, // Servicio intangible
            isPhysical: false,
            description: "Desayuno completo en el salón comedor con frutas, café, jugos y panificados.",
            imageUrl: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800"
          },
          {
            id: 2,
            name: "Masaje Relajante Descontracturante (50 min)",
            category: "Spa & Bienestar",
            price: 180000,
            availableInApp: true,
            stock: null,
            isPhysical: false,
            description: "Sesión terapéutica en cabina de spa con aromaterapia y aceites esenciales.",
            imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800"
          },
          {
            id: 3,
            name: "Agua Mineral sin Gas 500ml",
            category: "Minibar",
            price: 12000,
            availableInApp: true,
            stock: 48,
            isPhysical: true,
            description: "Agua purificada fría de manantial en botella PET.",
            imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800"
          },
          {
            id: 4,
            name: "Cerveza Corona Extra 355ml",
            category: "Minibar",
            price: 25000,
            availableInApp: true,
            stock: 24,
            isPhysical: true,
            description: "Cerveza rubia importada fría con gajo de lima.",
            imageUrl: "https://images.unsplash.com/photo-1608270199026-663f7389a056?w=800"
          },
          {
            id: 5,
            name: "Hamburguesa Gourmet 3 Vagos con Papas",
            category: "Room Service",
            price: 55000,
            availableInApp: true,
            stock: 15,
            isPhysical: true,
            description: "Carne angus 200g, queso cheddar, cebolla caramelizada y salsa especial.",
            imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"
          },
          {
            id: 6,
            name: "Lavandería & Planchado Express (x Prenda)",
            category: "Servicios Extra",
            price: 30000,
            availableInApp: false, // Apagado temporalmente para la App
            stock: null,
            isPhysical: false,
            description: "Lavado y planchado en el día con entrega en percha a la habitación.",
            imageUrl: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800"
          }
        ];
        this.saveSalesData();
      }
    } catch (e) {
      console.warn('Error loading sales catalog:', e);
    }

    // 2. Insumos de Pañol y Uso Interno
    try {
      const savedInternal = localStorage.getItem('hotel_inventory_internal');
      if (savedInternal) {
        this.internalItems = JSON.parse(savedInternal);
      } else {
        this.internalItems = [
          {
            id: 101,
            name: "Detergente Desinfectante Industrial Multiuso",
            category: "Limpieza & Sanitización",
            unit: "Litros",
            currentStock: 25,
            minStock: 10,
            location: "Depósito Central Housekeeping",
            lastUpdated: "Hoy 08:30"
          },
          {
            id: 102,
            name: "Jaboncitos de Tocador Hipoalergénicos 20g",
            category: "Amenidades Huésped",
            unit: "Unidades",
            currentStock: 150,
            minStock: 50,
            location: "Pañol de Amenidades",
            lastUpdated: "Hoy 09:00"
          },
          {
            id: 103,
            name: "Toallas de Baño Grandes 100% Algodón (Cuerpo)",
            category: "Lencería & Blancos",
            unit: "Unidades",
            currentStock: 8, // Stock Crítico
            minStock: 15,
            location: "Lavandería & Guardarropa",
            lastUpdated: "Hoy 07:15"
          },
          {
            id: 104,
            name: "Juegos de Sábanas Matrimoniales 300 Hilos",
            category: "Lencería & Blancos",
            unit: "Juegos",
            currentStock: 18,
            minStock: 10,
            location: "Lavandería & Guardarropa",
            lastUpdated: "Ayer 18:00"
          },
          {
            id: 105,
            name: "Pilas AAA para Controles de Aire Split / TV",
            category: "Repuestos Mantenimiento",
            unit: "Pares",
            currentStock: 4, // Stock Crítico
            minStock: 10,
            location: "Taller Técnico Planta Baja",
            lastUpdated: "Hoy 10:15"
          },
          {
            id: 106,
            name: "Papel Higiénico Institucional Doble Hoja",
            category: "Amenidades Huésped",
            unit: "Rollos",
            currentStock: 75,
            minStock: 30,
            location: "Depósito Central Housekeeping",
            lastUpdated: "Hoy 08:00"
          }
        ];
        this.saveInternalData();
      }
    } catch (e) {
      console.warn('Error loading internal inventory:', e);
    }
  },

  saveSalesData() {
    try {
      localStorage.setItem('hotel_catalog_sales', JSON.stringify(this.salesItems));
    } catch (e) {}
  },

  saveInternalData() {
    try {
      localStorage.setItem('hotel_inventory_internal', JSON.stringify(this.internalItems));
    } catch (e) {}
  },

  switchTab(tabName) {
    this.activeTab = tabName;

    // Botones de pestañas
    document.querySelectorAll('.inv-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`inv-tab-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');

    // Paneles de contenido
    const salesContent = document.getElementById('inv-content-sales');
    const internalContent = document.getElementById('inv-content-internal');

    if (salesContent) salesContent.style.display = (tabName === 'sales') ? 'block' : 'none';
    if (internalContent) internalContent.style.display = (tabName === 'internal') ? 'block' : 'none';

    if (tabName === 'sales') this.renderSalesCatalog();
    if (tabName === 'internal') this.renderInternalInventory();
  },

  /* =========================================================
     1. PESTAÑA PARA LA VENTA (SERVICIOS, ROOM SERVICE & APP)
     ========================================================= */
  filterSalesCategory(cat) {
    this.selectedCategory = cat;
    document.querySelectorAll('.sales-cat-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(
      cat === 'all' ? 'sales-filter-all' :
      cat === 'Minibar' ? 'sales-filter-minibar' :
      cat === 'Room Service' ? 'sales-filter-roomservice' :
      cat === 'Spa & Bienestar' ? 'sales-filter-spa' : 'sales-filter-extra'
    );
    if (target) target.classList.add('active');
    this.renderSalesCatalog();
  },

  sortSalesCatalog(criteria) {
    this.sortBy = criteria;
    this.renderSalesCatalog();
  },

  renderSalesCatalog() {
    const tbody = document.getElementById('inv-sales-table-body');
    const kpiTotal = document.getElementById('inv-sales-kpi-total');
    const kpiApp = document.getElementById('inv-sales-kpi-app');
    const kpiMinibar = document.getElementById('inv-sales-kpi-minibar');

    if (kpiTotal) kpiTotal.innerText = this.salesItems.length;
    if (kpiApp) kpiApp.innerText = this.salesItems.filter(i => i.availableInApp).length;
    if (kpiMinibar) kpiMinibar.innerText = this.salesItems.filter(i => i.category === 'Minibar').length;

    if (!tbody) return;

    // Filtrar por categoría
    let list = [...this.salesItems];
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      list = list.filter(i => i.category === this.selectedCategory);
    }

    // Ordenar según criterio seleccionado
    if (this.sortBy === 'category') {
      list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else if (this.sortBy === 'price-asc') {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (this.sortBy === 'price-desc') {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (this.sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay ítems en esta categoría.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(item => {
      const isApp = item.availableInApp;
      const categoryBadge = this.getSalesCategoryBadge(item.category);
      const stockDisplay = item.isPhysical 
        ? `<strong style="color: ${item.stock > 5 ? '#059669' : '#DC2626'};">${item.stock} un.</strong>`
        : `<span style="color: var(--text-muted); font-size: 11px;">Ilimitado (Servicio)</span>`;

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 8px; overflow: hidden; background: #F1F5F9; border: 1px solid #E2E8F0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.06);" onclick="InventoryModule.previewImageModal('${item.imageUrl || ''}', '${sanitizeInput(item.name)}')" title="Ver foto ampliada">
                ${item.imageUrl 
                  ? `<img src="${item.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">`
                  : `<i class="fas fa-image" style="color: #94A3B8; font-size: 18px;"></i>`
                }
              </div>
              <div>
                <strong style="color: var(--primary-navy); font-size: 14px;">${sanitizeInput(item.name)}</strong>
                <small style="display: block; color: var(--text-muted); font-size: 11.5px;">${sanitizeInput(item.description || '-')}</small>
              </div>
            </div>
          </td>
          <td>${categoryBadge}</td>
          <td>
            <strong style="color: #0A192F; font-size: 14px;">${formatGs(item.price)}</strong>
          </td>
          <td>${stockDisplay}</td>
          <td>
            <!-- Toggle Switch de Disponibilidad en la App Móvil -->
            <label class="toggle-switch" title="Activar o pausar disponibilidad en la App Móvil">
              <input type="checkbox" ${isApp ? 'checked' : ''} onchange="InventoryModule.toggleAppAvailability(${item.id})">
              <span class="slider"></span>
            </label>
            <span style="font-size: 11px; font-weight: 600; margin-left: 6px; color: ${isApp ? '#059669' : '#DC2626'};">
              ${isApp ? '<i class="fas fa-check-circle"></i> Disponible App' : '<i class="fas fa-ban"></i> Pausado / Agotado'}
            </span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn-action btn-action-edit" onclick="InventoryModule.openSalesItemModal(${item.id})" title="Editar producto, precio o foto">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn-action" style="background: #FEE2E2; color: #991B1B;" onclick="InventoryModule.deleteSalesItem(${item.id})" title="Eliminar del catálogo">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  getSalesCategoryBadge(category) {
    const badges = {
      'Minibar': '<span class="badge" style="background: rgba(37, 99, 235, 0.12); color: #2563EB; border: 1px solid rgba(37, 99, 235, 0.25);"><i class="fas fa-cocktail"></i> Minibar</span>',
      'Room Service': '<span class="badge" style="background: rgba(217, 119, 6, 0.12); color: #D97706; border: 1px solid rgba(217, 119, 6, 0.25);"><i class="fas fa-utensils"></i> Room Service</span>',
      'Spa & Bienestar': '<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25);"><i class="fas fa-spa"></i> Spa & Relax</span>',
      'Servicios Extra': '<span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #7C3AED; border: 1px solid rgba(147, 51, 234, 0.25);"><i class="fas fa-concierge-bell"></i> Servicio Extra</span>'
    };
    return badges[category] || `<span class="badge badge-confirmada">${category}</span>`;
  },

  toggleAppAvailability(itemId) {
    const item = this.salesItems.find(i => i.id === itemId);
    if (!item) return;

    item.availableInApp = !item.availableInApp;
    this.saveSalesData();
    this.renderSalesCatalog();

    if (item.availableInApp) {
      showToast(`"${item.name}" ahora está ACTIVO y visible en la App Móvil.`, 'success');
    } else {
      showToast(`"${item.name}" fue PAUSADO. No aparecerá en la App Móvil hasta nuevo aviso.`, 'warning');
    }
  },

  openSalesItemModal(itemId) {
    const item = itemId ? this.salesItems.find(i => i.id === itemId) : null;

    document.getElementById('sales-item-id').value = item ? item.id : '';
    document.getElementById('sales-item-title').innerText = item ? 'Editar Producto / Servicio de Venta' : 'Nuevo Producto / Servicio para Venta';
    document.getElementById('sales-item-name').value = item ? item.name : '';
    document.getElementById('sales-item-category').value = item ? item.category : 'Minibar';
    document.getElementById('sales-item-price').value = item ? item.price : '';
    document.getElementById('sales-item-physical').checked = item ? !!item.isPhysical : true;
    document.getElementById('sales-item-stock').value = (item && item.stock !== null) ? item.stock : '20';
    document.getElementById('sales-item-app').checked = item ? !!item.availableInApp : true;
    document.getElementById('sales-item-desc').value = item ? (item.description || '') : '';

    const imgInput = document.getElementById('sales-item-image');
    if (imgInput) {
      imgInput.value = item ? (item.imageUrl || '') : '';
      this.onSalesImageUrlInput();
    }

    this.onPhysicalItemChange();
    openModal('modal-item-sales');
  },

  onPhysicalItemChange() {
    const isPhysical = document.getElementById('sales-item-physical').checked;
    const stockContainer = document.getElementById('sales-item-stock-container');
    if (stockContainer) {
      stockContainer.style.display = isPhysical ? 'block' : 'none';
    }
  },

  onSalesImageUrlInput() {
    const input = document.getElementById('sales-item-image');
    const preview = document.getElementById('sales-item-image-preview');
    const placeholder = document.getElementById('sales-item-image-placeholder');
    const url = input ? input.value.trim() : '';

    if (url && preview && placeholder) {
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      preview.onerror = () => {
        preview.style.display = 'none';
        placeholder.style.display = 'block';
      };
    } else if (preview && placeholder) {
      preview.src = '';
      preview.style.display = 'none';
      placeholder.style.display = 'block';
    }
  },

  onSalesImageFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const input = document.getElementById('sales-item-image');
      if (input) {
        input.value = dataUrl;
        this.onSalesImageUrlInput();
      }
    };
    reader.readAsDataURL(file);
  },

  setSalesImagePreset(type) {
    const presets = {
      'desayuno': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
      'spa': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
      'agua': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800',
      'cerveza': 'https://images.unsplash.com/photo-1608270199026-663f7389a056?w=800',
      'hamburguesa': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      'lavanderia': 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800'
    };
    const input = document.getElementById('sales-item-image');
    if (input && presets[type]) {
      input.value = presets[type];
      this.onSalesImageUrlInput();
    }
  },

  previewImageModal(url, title) {
    if (!url) {
      showToast('Este ítem no tiene foto cargada', 'info');
      return;
    }
    // Crear o reutilizar lightbox emergente
    let lightbox = document.getElementById('modal-image-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'modal-image-lightbox';
      lightbox.className = 'modal-backdrop';
      lightbox.style.zIndex = '9999';
      lightbox.innerHTML = `
        <div class="modal-box" style="max-width: 520px; padding: 16px; border-radius: 16px; text-align: center; background: #0F172A;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 id="lightbox-title" style="color: #FFF; font-size: 16px; margin: 0;">Foto</h4>
            <button class="modal-close" style="color: #FFF;" onclick="closeModal('modal-image-lightbox')">&times;</button>
          </div>
          <div style="border-radius: 12px; overflow: hidden; max-height: 420px; display: flex; align-items: center; justify-content: center; background: #000;">
            <img id="lightbox-img" src="" style="width: 100%; max-height: 420px; object-fit: contain;">
          </div>
        </div>
      `;
      document.body.appendChild(lightbox);
    }
    document.getElementById('lightbox-title').innerText = title || 'Producto / Servicio';
    document.getElementById('lightbox-img').src = url;
    openModal('modal-image-lightbox');
  },

  saveSalesItem() {
    const idInput = document.getElementById('sales-item-id').value;
    const name = document.getElementById('sales-item-name').value.trim();
    const category = document.getElementById('sales-item-category').value;
    const price = parseFloat(document.getElementById('sales-item-price').value) || 0;
    const isPhysical = document.getElementById('sales-item-physical').checked;
    const stock = isPhysical ? (parseInt(document.getElementById('sales-item-stock').value, 10) || 0) : null;
    const availableInApp = document.getElementById('sales-item-app').checked;
    const description = document.getElementById('sales-item-desc').value.trim();
    const imageUrl = document.getElementById('sales-item-image')?.value.trim() || '';

    if (!name) {
      showToast('Debe ingresar el nombre del producto o servicio', 'warning');
      return;
    }

    if (price <= 0) {
      showToast('Debe asignar un precio de venta mayor a 0 Gs.', 'warning');
      return;
    }

    if (idInput) {
      // Edición
      const item = this.salesItems.find(i => i.id == idInput);
      if (item) {
        item.name = name;
        item.category = category;
        item.price = price;
        item.isPhysical = isPhysical;
        item.stock = stock;
        item.availableInApp = availableInApp;
        item.description = description;
        item.imageUrl = imageUrl;
      }
      showToast(`Producto "${name}" actualizado con éxito`, 'success');
    } else {
      // Creación
      const newId = Date.now();
      this.salesItems.push({
        id: newId,
        name,
        category,
        price,
        isPhysical,
        stock,
        availableInApp,
        description,
        imageUrl
      });
      showToast(`Producto "${name}" agregado al catálogo oficial`, 'success');
    }

    this.saveSalesData();
    closeModal('modal-item-sales');
    this.renderSalesCatalog();
  },

  deleteSalesItem(itemId) {
    const item = this.salesItems.find(i => i.id === itemId);
    if (!item) return;

    if (confirm(`¿Está seguro de eliminar "${item.name}" del catálogo?`)) {
      this.salesItems = this.salesItems.filter(i => i.id !== itemId);
      this.saveSalesData();
      this.renderSalesCatalog();
      showToast(`Producto "${item.name}" eliminado del catálogo`, 'info');
    }
  },


  /* =========================================================
     2. PESTAÑA USO INTERNO (INSUMOS, PAÑOL & CONTROL DE FUGAS)
     ========================================================= */
  renderInternalInventory() {
    const tbody = document.getElementById('inv-internal-table-body');
    const kpiTotal = document.getElementById('inv-internal-kpi-total');
    const kpiCritical = document.getElementById('inv-internal-kpi-critical');

    const criticalCount = this.internalItems.filter(i => i.currentStock <= i.minStock).length;
    if (kpiTotal) kpiTotal.innerText = this.internalItems.length;
    if (kpiCritical) kpiCritical.innerText = criticalCount;

    if (!tbody) return;

    if (this.internalItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No hay insumos registrados en el pañol.</td></tr>`;
      return;
    }

    let html = '';
    this.internalItems.forEach(item => {
      const isCritical = item.currentStock <= item.minStock;
      const percent = Math.min(100, Math.round((item.currentStock / (item.minStock * 2.5)) * 100));

      const statusBadge = isCritical
        ? `<span class="badge badge-cancelada" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA;"><i class="fas fa-exclamation-triangle"></i> Stock Crítico</span>`
        : `<span class="badge badge-confirmada" style="background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0;"><i class="fas fa-check-circle"></i> Nivel Óptimo</span>`;

      html += `
        <tr>
          <td>
            <strong style="color: var(--primary-navy); font-size: 13.5px;">${sanitizeInput(item.name)}</strong>
            <small style="display: block; color: var(--text-muted); font-size: 11.5px;">
              <i class="fas fa-warehouse" style="color: var(--primary-blue);"></i> ${sanitizeInput(item.location || 'Depósito Central')}
            </small>
          </td>
          <td>
            <span class="badge" style="background: #F1F5F9; color: #334155; border: 1px solid #CBD5E1; font-size: 11px;">
              ${sanitizeInput(item.category)}
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 15px; color: ${isCritical ? '#DC2626' : '#0F172A'};">
                ${item.currentStock} ${item.unit}
              </strong>
            </div>
            <!-- Barra visual de nivel -->
            <div style="background: #E2E8F0; border-radius: 4px; height: 5px; width: 100px; margin-top: 4px; overflow: hidden;">
              <div style="background: ${isCritical ? '#EF4444' : '#10B981'}; width: ${percent}%; height: 100%;"></div>
            </div>
          </td>
          <td>
            <span style="font-size: 12px; color: #64748B;">Mín: <strong>${item.minStock} ${item.unit}</strong></span>
          </td>
          <td>${statusBadge}</td>
          <td>
            <small style="color: var(--text-muted); font-size: 11px;">${item.lastUpdated || '-'}</small>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-sm btn-outline" onclick="InventoryModule.openStockMovementModal(${item.id}, 'OUT')" style="color: #DC2626; border-color: #FECACA; padding: 4px 8px; font-size: 11.5px;" title="Registrar retiro / consumo de mucama o mantenimiento">
                <i class="fas fa-minus-circle"></i> Retiro / Salida
              </button>
              <button class="btn btn-sm btn-outline" onclick="InventoryModule.openStockMovementModal(${item.id}, 'IN')" style="color: #059669; border-color: #A7F3D0; padding: 4px 8px; font-size: 11.5px;" title="Registrar reposición o compra">
                <i class="fas fa-plus-circle"></i> Reponer
              </button>
              <button class="btn-action btn-action-edit" onclick="InventoryModule.openInternalItemModal(${item.id})" title="Editar datos del insumo">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openInternalItemModal(itemId) {
    const item = itemId ? this.internalItems.find(i => i.id === itemId) : null;

    document.getElementById('internal-item-id').value = item ? item.id : '';
    document.getElementById('internal-item-title').innerText = item ? 'Editar Insumo de Pañol' : 'Registrar Nuevo Insumo de Uso Interno';
    document.getElementById('internal-item-name').value = item ? item.name : '';
    document.getElementById('internal-item-category').value = item ? item.category : 'Limpieza & Sanitización';
    document.getElementById('internal-item-unit').value = item ? item.unit : 'Unidades';
    document.getElementById('internal-item-stock').value = item ? item.currentStock : '20';
    document.getElementById('internal-item-min').value = item ? item.minStock : '10';
    document.getElementById('internal-item-location').value = item ? (item.location || '') : 'Depósito Central Housekeeping';

    openModal('modal-item-internal');
  },

  saveInternalItem() {
    const idInput = document.getElementById('internal-item-id').value;
    const name = document.getElementById('internal-item-name').value.trim();
    const category = document.getElementById('internal-item-category').value;
    const unit = document.getElementById('internal-item-unit').value.trim() || 'Unidades';
    const currentStock = parseInt(document.getElementById('internal-item-stock').value, 10) || 0;
    const minStock = parseInt(document.getElementById('internal-item-min').value, 10) || 5;
    const location = document.getElementById('internal-item-location').value.trim() || 'Depósito Central';

    if (!name) {
      showToast('Debe ingresar el nombre del insumo', 'warning');
      return;
    }

    if (idInput) {
      const item = this.internalItems.find(i => i.id == idInput);
      if (item) {
        item.name = name;
        item.category = category;
        item.unit = unit;
        item.currentStock = currentStock;
        item.minStock = minStock;
        item.location = location;
        item.lastUpdated = "Hoy " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      showToast(`Insumo "${name}" actualizado con éxito`, 'success');
    } else {
      this.internalItems.push({
        id: Date.now(),
        name,
        category,
        unit,
        currentStock,
        minStock,
        location,
        lastUpdated: "Hoy " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      showToast(`Insumo "${name}" agregado al pañol`, 'success');
    }

    this.saveInternalData();
    closeModal('modal-item-internal');
    this.renderInternalInventory();
  },

  openStockMovementModal(itemId, type) {
    const item = this.internalItems.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('stock-move-item-id').value = item.id;
    document.getElementById('stock-move-type').value = type; // 'IN' o 'OUT'

    const titleEl = document.getElementById('stock-move-title');
    const badgeEl = document.getElementById('stock-move-badge');
    const submitBtn = document.getElementById('btn-confirm-stock-move');

    if (type === 'IN') {
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-plus-circle" style="color: #10B981;"></i> Reponer Stock / Entrada a Pañol`;
      if (badgeEl) badgeEl.innerHTML = `<span class="badge" style="background: #DCFCE7; color: #166534;"><i class="fas fa-arrow-down"></i> Entrada / Compra de Bodega</span>`;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Registrar Entrada de Stock';
    } else {
      if (titleEl) titleEl.innerHTML = `<i class="fas fa-minus-circle" style="color: #EF4444;"></i> Registrar Salida / Consumo Operativo`;
      if (badgeEl) badgeEl.innerHTML = `<span class="badge" style="background: #FEE2E2; color: #991B1B;"><i class="fas fa-arrow-up"></i> Retiro / Consumo de Insumo</span>`;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Registrar Descuento de Stock';
    }

    document.getElementById('stock-move-item-name').innerText = `${item.name} (${item.unit})`;
    document.getElementById('stock-move-current-stock').innerText = `${item.currentStock} ${item.unit}`;
    document.getElementById('stock-move-quantity').value = '1';
    document.getElementById('stock-move-reason').value = type === 'OUT' ? 'Uso en limpieza de habitaciones (Mucamas)' : 'Compra y reposición desde proveedor';

    openModal('modal-stock-movement');
  },

  saveStockMovement() {
    const itemId = document.getElementById('stock-move-item-id').value;
    const type = document.getElementById('stock-move-type').value;
    const qty = parseInt(document.getElementById('stock-move-quantity').value, 10) || 0;
    const reason = document.getElementById('stock-move-reason').value.trim() || 'Ajuste operativo';

    if (qty <= 0) {
      showToast('La cantidad debe ser mayor a 0', 'warning');
      return;
    }

    const item = this.internalItems.find(i => i.id == itemId);
    if (!item) return;

    if (type === 'OUT') {
      if (qty > item.currentStock) {
        showToast(`Stock insuficiente. Solo hay ${item.currentStock} ${item.unit} disponibles en pañol.`, 'warning');
        return;
      }
      item.currentStock -= qty;
      showToast(`Se registraron -${qty} ${item.unit} de "${item.name}" (Consumo registrado).`, 'info');
    } else {
      item.currentStock += qty;
      showToast(`Se registraron +${qty} ${item.unit} de "${item.name}" (Ingreso a pañol).`, 'success');
    }

    item.lastUpdated = "Hoy " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.saveInternalData();

    closeModal('modal-stock-movement');
    this.renderInternalInventory();
  }
};
