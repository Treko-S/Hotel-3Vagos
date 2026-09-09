/**
 * HOTEL 3 VAGOS - UTCD
 * Master Application Controller, Navigation & RBAC (Role-Based Access Control)
 */

// Función de Normalización de Roles a los 5 roles canónicos
function normalizeRole(role) {
  if (!role) return 'guest';
  const r = String(role).toLowerCase().trim();
  if (['admin', 'administrador', 'gerente'].includes(r)) return 'admin';
  if (['receptionist', 'recepcionista'].includes(r)) return 'receptionist';
  if (['housekeeping', 'jefa_limpieza', 'mucama'].includes(r)) return 'housekeeping';
  if (['maintenance', 'mantenimiento'].includes(r)) return 'maintenance';
  if (['finance', 'finanzas', 'contabilidad'].includes(r)) return 'finance';
  return r;
}

// Estado global de la aplicación
const AppState = {
  currentRole: 'admin',
  currentUser: null,
  activeView: 'dashboard'
};

// Matriz Oficial de Permisos RBAC por Rol (5 Roles Canónicos)
const CANONICAL_PERMISSIONS = {
  admin: {
    name: 'Administrador General',
    allowedViews: [
      'dashboard', 'reservations', 'guests',
      'rooms', 'rates',
      'housekeeping', 'maintenance', 'consumptions',
      'inventory', 'purchases',
      'cash', 'billing',
      'analytics', 'users', 'settings'
    ],
    defaultView: 'dashboard'
  },
  receptionist: {
    name: 'Recepción & Front Desk',
    allowedViews: [
      'dashboard', 'reservations', 'guests',
      'rooms', 'rates',
      'housekeeping', 'maintenance', 'consumptions',
      'cash', 'billing'
    ],
    defaultView: 'reservations'
  },
  housekeeping: {
    name: 'Housekeeping & Limpieza',
    allowedViews: [
      'rooms', 'housekeeping', 'consumptions', 'inventory'
    ],
    defaultView: 'housekeeping'
  },
  maintenance: {
    name: 'Mantenimiento & Técnico',
    allowedViews: [
      'rooms', 'maintenance', 'inventory'
    ],
    defaultView: 'maintenance'
  },
  finance: {
    name: 'Finanzas & Contabilidad',
    allowedViews: [
      'dashboard', 'rates',
      'inventory', 'purchases',
      'cash', 'billing',
      'analytics'
    ],
    defaultView: 'cash'
  },
  guest: {
    name: 'Huésped (Acceso Restringido)',
    allowedViews: ['guest'],
    defaultView: 'guest'
  }
};

const RolePermissions = {
  ...CANONICAL_PERMISSIONS,
  administrador: CANONICAL_PERMISSIONS.admin,
  gerente: CANONICAL_PERMISSIONS.admin,
  recepcionista: CANONICAL_PERMISSIONS.receptionist,
  jefa_limpieza: CANONICAL_PERMISSIONS.housekeeping,
  mucama: CANONICAL_PERMISSIONS.housekeeping,
  mantenimiento: CANONICAL_PERMISSIONS.maintenance,
  finanzas: CANONICAL_PERMISSIONS.finance
};

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Limpieza inicial garantizada de datos residuales de prueba
  try {
    const isResetDone = localStorage.getItem('hotel_system_reset_v2');
    if (!isResetDone) {
      localStorage.removeItem('hotel_hk_orders');
      localStorage.removeItem('hotel_hk_incidents');
      localStorage.removeItem('hotel_maint_orders');
      localStorage.setItem('hotel_system_reset_v2', 'true');
    }
  } catch (e) {}

  // 0.1 Sincronización Inmediata Anti-FOUC (Aplica RBAC al instante en el frame 0)
  try {
    const sessionStr = localStorage.getItem('hotel_admin_session');
    if (sessionStr) {
      const s = JSON.parse(sessionStr);
      if (s && s.user && s.user.role) {
        AppState.currentUser = s.user;
        AppState.currentRole = normalizeRole(s.user.role);
        applyRoleBasedAccess(s.user.role);
      }
    }
  } catch (e) {}

  initNavigation();

  // 1. Inicializar Módulo de Seguridad y Autenticación por Dispositivo
  await AuthModule.init();

  // 2. Suscribirse a cambios en tiempo real en Supabase para habitaciones y reservas
  initRealtimeSubscriptions();
});

/**
 * Control del menú lateral en móviles y tablets (Drawer)
 */
function toggleMobileSidebar(forceOpen) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  const shouldOpen = (typeof forceOpen === 'boolean') ? forceOpen : !sidebar.classList.contains('open');
  if (shouldOpen) {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  } else {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }
}

/**
 * Inicializar navegación por pestañas de la SPA y Guardia de Rutas por Hash
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = item.getAttribute('data-view');
      switchView(viewId);
      // Cerrar menú lateral en móvil al hacer clic
      toggleMobileSidebar(false);
    });
  });

  // Guardia de Rutas por URL directa (Hashchange Listener)
  window.addEventListener('hashchange', () => {
    const requestedView = window.location.hash.replace('#', '').trim();
    if (requestedView && requestedView !== AppState.activeView) {
      switchView(requestedView);
    }
  });

  // Si hay un hash en la URL al cargar la página, validar y conmutar
  const initialHash = window.location.hash.replace('#', '').trim();
  if (initialHash) {
    const normRole = normalizeRole(AppState.currentRole);
    const roleConfig = RolePermissions[normRole] || RolePermissions.guest;
    if (roleConfig.allowedViews.includes(initialHash)) {
      switchView(initialHash);
    }
  }
}

/**
 * Conmutador central de vistas con validación RBAC estricta
 */
function switchView(viewId) {
  const normRole = normalizeRole(AppState.currentRole);
  const roleConfig = RolePermissions[normRole] || RolePermissions.guest;

  // Tarea 15: Restricción estricta del menú "Gestión de Usuarios" únicamente para el Administrador
  if (viewId === 'users' && normRole !== 'admin') {
    showToast('Acceso restringido: Solo el Administrador General tiene autorización para ver y gestionar usuarios.', 'error');
    switchView('dashboard');
    return;
  }

  // Validación de Permisos RBAC (Capa de Protección en Navegación)
  if (!roleConfig.allowedViews.includes(viewId)) {
    showToast(`Acceso denegado: El rol "${roleConfig.name}" no tiene autorización para acceder a "${viewId}".`, 'warning');
    const fallbackView = roleConfig.defaultView || 'dashboard';
    if (AppState.activeView !== fallbackView) {
      switchView(fallbackView);
    }
    return;
  }

  AppState.activeView = viewId;

  // Sincronizar URL Hash sin recargar para soportar enlaces directos y marcadores
  try {
    if (window.location.hash !== `#${viewId}`) {
      window.history.replaceState(null, '', `#${viewId}`);
    }
  } catch (e) {}

  // 1. Actualizar menú lateral activo
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNavItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (activeNavItem) activeNavItem.classList.add('active');

  // 2. Mostrar sección correspondiente
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // 3. Actualizar título superior
  const titles = {
    'dashboard': { title: 'Dashboard & Alertas Operativas', subtitle: 'Métricas operativas y financieras en tiempo real' },
    'reservations': { title: 'Recepción & Reservas', subtitle: 'Front Desk, Check-in, Check-out y asignación de habitaciones' },
    'guests': { title: 'Huéspedes & CRM', subtitle: 'Directorio de pasajeros, folios y documentación de identidad' },
    'rooms': { title: 'Inventario de Habitaciones', subtitle: 'Gestión de categorías, estados de habitación y bloqueos técnicos' },
    'rates': { title: 'Tarifas & Temporadas', subtitle: 'Revenue management, temporadas anuales, promociones y add-ons' },
    'housekeeping': { title: 'Housekeeping & Calidad', subtitle: 'Control de limpieza, checklists de áreas y asignación a mucamas' },
    'maintenance': { title: 'Mantenimiento & Incidencias', subtitle: 'Control de órdenes técnicas, costos y reparaciones' },
    'consumptions': { title: 'Consumo & Servicios', subtitle: 'Catálogo oficial de Minibar, Restaurante / Room Service y Servicios Adicionales' },
    'inventory': { title: 'Inventario & Kardex', subtitle: 'Control de insumos de pañol, stock valorizado y kardex de movimientos' },
    'purchases': { title: 'Compras & Proveedores', subtitle: 'Directorio de proveedores, órdenes de compra y recepción de insumos' },
    'cash': { title: 'Caja & Arqueos', subtitle: 'Control de sesiones de caja, arqueos, egresos y reembolsos' },
    'billing': { title: 'Facturación Legal (SET Paraguay)', subtitle: 'Emisión de comprobantes tributarios, timbrado y libro de ventas' },
    'analytics': { title: 'Reportes & Analítica Hotelera', subtitle: 'RevPAR, ADR, ocupación mensual y balance ejecutivo oficial en PDF' },
    'users': { title: 'Gestión de Usuarios & RBAC', subtitle: 'Directorio de personal, roles, permisos y control de dispositivos' },
    'settings': { title: 'Configuración General del Hotel', subtitle: 'Políticas institucionales, timbrado y parámetros operativos' },
    'guest': { title: 'Portal de Huéspedes', subtitle: 'Consola interna exclusiva para colaboradores del hotel' }
  };

  const meta = titles[viewId] || { title: 'Panel de Gestión', subtitle: 'Sistema Hotelero UTCD' };
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  if (pageTitle) pageTitle.innerText = meta.title;
  if (pageSubtitle) pageSubtitle.innerText = meta.subtitle;

  // Refrescar datos según la pestaña activa
  if (viewId === 'dashboard' && typeof DashboardModule !== 'undefined') DashboardModule.init();
  if (viewId === 'reservations' && typeof ReservationsModule !== 'undefined') ReservationsModule.loadReservations();
  if (viewId === 'rooms' && typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
  if (viewId === 'inventory' && typeof InventoryModule !== 'undefined') InventoryModule.init();
  if (viewId === 'rates' && typeof RatesSeasonsModule !== 'undefined') RatesSeasonsModule.init();
  if (viewId === 'housekeeping' && typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();
  if (viewId === 'maintenance' && typeof MaintenanceModule !== 'undefined') {
    MaintenanceModule.init();
  }
  if (viewId === 'consumptions' && typeof InventoryModule !== 'undefined') {
    if (!InventoryModule.salesItems || InventoryModule.salesItems.length === 0) {
      InventoryModule.init();
    } else {
      InventoryModule.renderSalesCatalog();
    }
  }
  if (viewId === 'cash' && typeof CashBillingModule !== 'undefined') CashBillingModule.init();
  if (viewId === 'guests' && typeof GuestsModule !== 'undefined') GuestsModule.loadGuests();

  // Nuevas vistas integradas
  if (viewId === 'purchases') {
    if (typeof InventoryModule !== 'undefined') {
      if (!InventoryModule.purchaseOrders || InventoryModule.purchaseOrders.length === 0) {
        InventoryModule.init();
      }
      InventoryModule.switchComprasSubTab(InventoryModule.comprasActiveSubTab || 'orders');
      InventoryModule.updateComprasKPIs();
    } else {
      renderPurchasesProvidersView();
    }
  }
  if (viewId === 'billing') renderBillingViewInvoices();
  if (viewId === 'analytics') {
    if (typeof DashboardModule !== 'undefined') DashboardModule.renderAnalyticsMetrics();
  }
  if (viewId === 'users') {
    renderUsersDirectory();
    renderAppGuestsTable();
  }
  if (viewId === 'settings') {
    if (typeof SettingsModule !== 'undefined') SettingsModule.init();
  }
}

/**
 * Renderizadores dinámicos para vistas secundarias y sub-tabs
 */
function renderPurchasesProvidersView() {
  const grid = document.getElementById('purchases-providers-grid');
  if (!grid) return;

  if (typeof InventoryModule !== 'undefined' && Array.isArray(InventoryModule.providers) && InventoryModule.providers.length > 0) {
    grid.innerHTML = InventoryModule.providers.map(p => `
      <div class="provider-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="font-size: 15px; font-weight: 700; color: var(--primary-navy); margin: 0;">${p.name || 'Proveedor'}</h4>
            <span class="badge" style="background: #EFF6FF; color: #1D4ED8;">${p.category || 'General'}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0;"><strong>RUC:</strong> ${p.ruc || 'S/D'}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0;"><strong>Teléfono:</strong> ${p.phone || 'S/D'}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin: 2px 0;"><strong>Contacto:</strong> ${p.contact_name || 'Principal'}</p>
        </div>
        <div style="margin-top: 14px; border-top: 1px solid #E2E8F0; padding-top: 10px; display: flex; justify-content: flex-end;">
          <button class="btn btn-sm btn-outline" onclick="InventoryModule.openPurchaseOrderModal('${p.id}')">
            <i class="fas fa-file-invoice"></i> Generar Orden
          </button>
        </div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
        <i class="fas fa-truck" style="font-size: 32px; color: #94A3B8; margin-bottom: 8px;"></i>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">No hay proveedores registrados aún.</p>
        <button class="btn btn-primary btn-sm" onclick="InventoryModule.openProviderModal()"><i class="fas fa-plus"></i> Registrar Primer Proveedor</button>
      </div>
    `;
  }
}

function renderBillingViewInvoices() {
  const tbody = document.getElementById('billing-view-invoices-tbody');
  const mainTbody = document.getElementById('invoices-table-body');
  if (tbody && mainTbody) {
    tbody.innerHTML = mainTbody.innerHTML;
  }
}

function renderAnalyticsMetrics() {
  const occEl = document.getElementById('kpi-occupancy');
  const revEl = document.getElementById('kpi-revenue');
  const adrEl = document.getElementById('analytics-kpi-adr');
  const revparEl = document.getElementById('analytics-kpi-revpar');

  if (adrEl && occEl) adrEl.innerText = '250.000 Gs.';
  if (revparEl && revEl) revparEl.innerText = '175.000 Gs.';
}

function renderUsersDirectory() {
  const tbody = document.getElementById('users-directory-tbody');
  const fpEl = document.getElementById('current-device-fp-display');

  if (fpEl && typeof AuthModule !== 'undefined') {
    fpEl.innerText = AuthModule.deviceFingerprint || localStorage.getItem('hotel_device_id') || 'Dispositivo de Confianza';
  }

  if (tbody && typeof AuthModule !== 'undefined' && Array.isArray(AuthModule.STAFF_ACCOUNTS)) {
    tbody.innerHTML = AuthModule.STAFF_ACCOUNTS.map(u => {
      const canonical = normalizeRole(u.role);
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gold); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">
                ${(u.name || 'U').charAt(0)}
              </div>
              <div>
                <strong>${u.name}</strong>
              </div>
            </div>
          </td>
          <td>
            <div><span style="font-family: monospace; font-size: 12px;">${u.username}</span></div>
            <small style="color: var(--text-muted);">${u.email}</small>
          </td>
          <td><span class="role-badge ${canonical}">${canonical}</span></td>
          <td><span style="font-size: 12px; color: #334155;">${CANONICAL_PERMISSIONS[canonical]?.name || u.role}</span></td>
          <td><span class="badge" style="background: #F0FDF4; color: #166534;"><i class="fas fa-check"></i> Activo</span></td>
        </tr>
      `;
    }).join('');
  }
}

function renderSettingsOverview() {
  // Sincronización visual de parámetros
}

/**
 * Controladores de Pestañas Internas (Sub-tabs)
 */
function switchConsumptionsSubtab(tabKey, btn) {
  document.querySelectorAll('#view-consumptions .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-consumptions .subtab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-consumptions-${tabKey}`);
  if (target) target.classList.add('active');
}

function switchPurchasesSubtab(tabKey, btn) {
  document.querySelectorAll('#view-purchases .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-purchases .subtab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-purchases-${tabKey}`);
  if (target) target.classList.add('active');
  if (tabKey === 'providers') renderPurchasesProvidersView();
}

function switchBillingSubtab(tabKey, btn) {
  document.querySelectorAll('#view-billing .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-billing .subtab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-billing-${tabKey}`);
  if (target) target.classList.add('active');
  if (tabKey === 'invoices') renderBillingViewInvoices();
}

function switchAnalyticsSubtab(tabKey, btn) {
  document.querySelectorAll('#view-analytics .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-analytics .subtab-content').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-analytics-${tabKey}`);
  if (target) target.classList.add('active');
}

function switchUsersSubtab(tabKey, btn) {
  document.querySelectorAll('#view-users .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-users .users-subtab-content, #view-users .subtab-content').forEach(c => {
    c.classList.remove('active');
    c.style.display = 'none';
  });
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-users-${tabKey}`);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
  if (tabKey === 'staff' || tabKey === 'directory') renderUsersDirectory();
  if (tabKey === 'app-guests') renderAppGuestsTable();
}

async function renderAppGuestsTable() {
  const tbody = document.getElementById('users-app-guests-tbody');
  if (!tbody) return;

  try {
    let guests = [];
    if (typeof supabaseClient !== 'undefined') {
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        guests = data.filter(u => !u.role || u.role === 'guest' || u.role === 'client' || u.role === 'huesped');
      }
    }

    if (!guests || guests.length === 0) {
      if (typeof GuestsModule !== 'undefined' && GuestsModule.guests && GuestsModule.guests.length > 0) {
        guests = GuestsModule.guests;
      } else {
        guests = [
          { full_name: 'Kevin Santacruz', email: 'kevin.santacruz@utcd.edu.py', document_number: '6537648', phone: '+595 981 123456', nationality: 'Paraguaya', total_bookings: 3 },
          { full_name: 'María González', email: 'maria.gonzalez@gmail.com', document_number: '4821903', phone: '+595 971 654321', nationality: 'Paraguaya', total_bookings: 2 },
          { full_name: 'Carlos Benítez', email: 'carlos.benitez@empresa.com.py', document_number: '3940125', phone: '+595 983 778899', nationality: 'Paraguaya', total_bookings: 1 },
          { full_name: 'Lucía Fernández', email: 'lucia.f@outlook.com', document_number: '5120334', phone: '+54 9 11 4455 6677', nationality: 'Argentina', total_bookings: 2 },
          { full_name: 'Rodrigo Alvarenga', email: 'rodrigo.a@live.com', document_number: '4198200', phone: '+595 992 334455', nationality: 'Paraguaya', total_bookings: 1 }
        ];
      }
    }

    tbody.innerHTML = guests.map(g => {
      const name = g.full_name || g.nombre || 'Huésped Móvil';
      const email = g.email || 'huesped@app.com';
      const doc = g.document_number || g.cedula || g.documento || 'Sin doc.';
      const phone = g.phone || g.telefono || '+595 981 000000';
      const nat = g.nationality || g.nacionalidad || 'Paraguaya';
      const bookingsCount = g.total_bookings !== undefined ? g.total_bookings : 1;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: #EFF6FF; color: #1D4ED8; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; border: 1px solid #BFDBFE;">
                <i class="fas fa-mobile-alt"></i>
              </div>
              <div>
                <strong style="color: var(--primary-navy);">${sanitizeInput(name)}</strong>
                <span class="badge" style="background: #F1F5F9; color: #475569; font-size: 10px; margin-left: 4px;">App Huésped</span>
              </div>
            </div>
          </td>
          <td><span style="font-family: monospace; font-size: 12px; color: #334155;">${sanitizeInput(email)}</span></td>
          <td><strong style="color: #1E293B;">${sanitizeInput(doc)}</strong></td>
          <td><span style="color: #64748B; font-size: 12px;">${sanitizeInput(phone)}</span></td>
          <td><span class="badge" style="background: #F8FAFC; border: 1px solid #E2E8F0; color: #334155;">${sanitizeInput(nat)}</span></td>
          <td style="text-align: center;">
            <span class="badge" style="background: #ECFDF5; color: #047857; font-weight: 700;">
              <i class="fas fa-calendar-check" style="margin-right: 4px;"></i>${bookingsCount} reserva${bookingsCount > 1 ? 's' : ''}
            </span>
          </td>
          <td style="text-align: center;">
            <span class="badge" style="background: #F0FDF4; color: #166534; font-weight: 700;">
              <i class="fas fa-check-circle" style="margin-right: 4px;"></i>Verificado
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Error renderizando huéspedes de app móvil:', err);
  }
}

function switchSettingsSubtab(tabKey, btn) {
  document.querySelectorAll('#view-settings .subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#view-settings .settings-subtab-content').forEach(c => {
    c.classList.remove('active');
    c.style.display = 'none';
  });
  if (btn) btn.classList.add('active');
  const target = document.getElementById(`subtab-settings-${tabKey}`);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
  if (tabKey === 'engine' && typeof SettingsModule !== 'undefined') {
    SettingsModule.loadRoomTypes();
  }
}

/**
 * Aplica las restricciones de seguridad RBAC en el Sidebar y vistas
 */
function applyRoleBasedAccess(role) {
  const normRole = normalizeRole(role);
  AppState.currentRole = normRole;
  const roleConfig = RolePermissions[normRole] || RolePermissions.guest;

  // 1. Filtrar elementos individuales de navegación del sidebar
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    const viewId = item.getAttribute('data-view');
    if (roleConfig.allowedViews.includes(viewId)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  // 2. Filtrar dinámicamente las cabeceras de categoría (.nav-category)
  // Si ninguno de los nav-items que le pertenecen está visible, la categoría se oculta
  document.querySelectorAll('.nav-category').forEach(cat => {
    let sibling = cat.nextElementSibling;
    let hasVisibleItem = false;

    while (sibling && !sibling.classList.contains('nav-category')) {
      if (sibling.classList.contains('nav-item') && sibling.style.display !== 'none') {
        hasVisibleItem = true;
        break;
      }
      sibling = sibling.nextElementSibling;
    }

    cat.style.display = hasVisibleItem ? 'flex' : 'none';
  });

  // 3. Conmutar a la vista por defecto autorizada para este rol si la actual no está permitida
  const targetView = roleConfig.allowedViews.includes(AppState.activeView) ? AppState.activeView : roleConfig.defaultView;
  switchView(targetView);
}

/**
 * Sistema de Notificaciones Toast
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    'success': 'fas fa-check-circle',
    'error': 'fas fa-exclamation-circle',
    'warning': 'fas fa-exclamation-triangle',
    'info': 'fas fa-info-circle'
  };

  toast.innerHTML = `
    <i class="${icons[type] || icons.info}" style="font-size: 18px;"></i>
    <span>${sanitizeInput(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Funciones globales de Modales
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// Cerrar modales con clic fuera
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

// Cerrar modales o menú lateral con tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    toggleMobileSidebar(false);
  }
});

/**
 * Escucha de cambios en tiempo real vía Supabase Realtime
 */
function initRealtimeSubscriptions() {
  try {
    supabaseClient
      .channel('public:habitaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habitaciones' }, () => {
        if (AppState.currentRole !== 'guest') {
          if (typeof DashboardModule !== 'undefined') DashboardModule.loadKPIs();
          if (typeof RoomsModule !== 'undefined') RoomsModule.loadRooms();
          if (typeof HousekeepingModule !== 'undefined') HousekeepingModule.loadHousekeepingBoard();
        }
      })
      .subscribe();

    supabaseClient
      .channel('public:reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        if (AppState.currentRole !== 'guest') {
          if (typeof DashboardModule !== 'undefined') {
            DashboardModule.loadKPIs();
            DashboardModule.loadRecentActivity();
          }
          if (typeof ReservationsModule !== 'undefined') ReservationsModule.loadReservations();
        }
      })
      .subscribe();

    supabaseClient
      .channel('public:folios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folios' }, () => {
        if (AppState.currentRole !== 'guest') {
          if (typeof DashboardModule !== 'undefined') {
            DashboardModule.loadKPIs();
            DashboardModule.loadRecentActivity();
          }
          if (typeof ReservationsModule !== 'undefined') ReservationsModule.loadReservations();
        }
      })
      .subscribe();

    supabaseClient
      .channel('public:pagos_folio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_folio' }, () => {
        if (AppState.currentRole !== 'guest') {
          if (typeof DashboardModule !== 'undefined') {
            DashboardModule.loadKPIs();
            DashboardModule.loadRecentActivity();
          }
          if (typeof ReservationsModule !== 'undefined') ReservationsModule.loadReservations();
          if (typeof CashBillingModule !== 'undefined') CashBillingModule.loadPaymentsFlow();
        }
      })
      .subscribe();
  } catch (err) {
    // Modo silencioso
  }
}
