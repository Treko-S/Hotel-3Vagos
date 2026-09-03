/**
 * HOTEL 3 VAGOS - UTCD
 * Master Application Controller, Navigation & RBAC (Role-Based Access Control)
 */

// Estado global de la aplicación
const AppState = {
  currentRole: 'administrador', // administrador, gerente, recepcionista, housekeeping, guest
  currentUser: null,
  activeView: 'dashboard'
};

// Matriz Oficial de Permisos RBAC por Rol
const RolePermissions = {
  administrador: {
    name: 'Administrador General',
    allowedViews: ['dashboard', 'reservations', 'rooms', 'housekeeping', 'maintenance', 'cash', 'guests'],
    defaultView: 'dashboard',
    canSwitchRoles: true
  },
  gerente: {
    name: 'Gerente General',
    allowedViews: ['dashboard', 'reservations', 'cash', 'guests'],
    defaultView: 'dashboard',
    canSwitchRoles: false
  },
  recepcionista: {
    name: 'Recepcionista Front Desk',
    allowedViews: ['reservations', 'rooms', 'cash', 'guests'],
    defaultView: 'reservations',
    canSwitchRoles: false
  },
  housekeeping: {
    name: 'Supervisora Housekeeping',
    allowedViews: ['housekeeping', 'rooms', 'maintenance'],
    defaultView: 'housekeeping',
    canSwitchRoles: false
  },
  guest: {
    name: 'Huésped (Acceso Restringido)',
    allowedViews: ['guest'],
    defaultView: 'guest',
    canSwitchRoles: false
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initRoleSwitcher();

  // 1. Inicializar Módulo de Seguridad y Autenticación por Dispositivo
  await AuthModule.init();

  // 2. Suscribirse a cambios en tiempo real en Supabase para habitaciones y reservas
  initRealtimeSubscriptions();
});

/**
 * Inicializar navegación por pestañas de la SPA
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = item.getAttribute('data-view');
      switchView(viewId);
    });
  });
}

function switchView(viewId) {
  // Validación de Permisos RBAC
  const roleConfig = RolePermissions[AppState.currentRole] || RolePermissions.guest;
  if (!roleConfig.allowedViews.includes(viewId)) {
    showToast(`Acceso denegado: El rol "${roleConfig.name}" no tiene autorización para esta vista.`, 'warning');
    return;
  }

  AppState.activeView = viewId;

  // 1. Actualizar menú lateral
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
    'dashboard': { title: 'Dashboard Ejecutivo & KPIs', subtitle: 'Métricas operativas y financieras en tiempo real' },
    'reservations': { title: 'Recepción & Reservas', subtitle: 'Front Desk, Check-in, Check-out y asignación de habitaciones' },
    'rooms': { title: 'Inventario de Habitaciones & Tarifas', subtitle: 'Gestión de categorías, estados y precios base' },
    'housekeeping': { title: 'Housekeeping & Calidad', subtitle: 'Control de limpieza, checklist de 5 áreas e inspección' },
    'maintenance': { title: 'Mantenimiento & Incidencias', subtitle: 'Control de órdenes técnicas, costos y reparaciones' },
    'cash': { title: 'Caja & Facturación Legal', subtitle: 'Control de sesiones de caja, arqueo e IVA Paraguay' },
    'guests': { title: 'Huéspedes & CRM', subtitle: 'Directorio de clientes, documentos y fidelización' },
    'guest': { title: 'Portal de Huéspedes', subtitle: 'Consola interna exclusiva para colaboradores del hotel' }
  };

  const meta = titles[viewId] || { title: 'Panel de Gestión', subtitle: 'Sistema Hotelero UTCD' };
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  if (pageTitle) pageTitle.innerText = meta.title;
  if (pageSubtitle) pageSubtitle.innerText = meta.subtitle;

  // Refrescar datos según la pestaña activa
  if (viewId === 'dashboard') DashboardModule.init();
  if (viewId === 'reservations') ReservationsModule.loadReservations();
  if (viewId === 'rooms') RoomsModule.loadRooms();
  if (viewId === 'housekeeping') HousekeepingModule.loadHousekeepingBoard();
  if (viewId === 'maintenance') MaintenanceModule.loadOrders();
  if (viewId === 'cash') CashBillingModule.init();
  if (viewId === 'guests') GuestsModule.loadGuests();
}

/**
 * Aplica las restricciones de seguridad RBAC en el Sidebar y vistas
 */
function applyRoleBasedAccess(role) {
  AppState.currentRole = role;
  const roleConfig = RolePermissions[role] || RolePermissions.guest;

  // 1. Filtrar elementos de navegación del sidebar
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    const viewId = item.getAttribute('data-view');
    if (roleConfig.allowedViews.includes(viewId)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  // 2. Control del selector de roles en la cabecera
  const selectorWrapper = document.querySelector('.role-badge');
  const select = document.getElementById('role-selector');
  if (select) {
    select.value = role;
    if (roleConfig.canSwitchRoles || (AppState.currentUser && AppState.currentUser.role === 'administrador')) {
      select.disabled = false;
      if (selectorWrapper) selectorWrapper.style.opacity = '1';
    } else {
      select.disabled = true;
      if (selectorWrapper) selectorWrapper.style.opacity = '0.75';
    }
  }

  // 3. Ajustar vista activa si no está permitida para este rol
  if (!roleConfig.allowedViews.includes(AppState.activeView)) {
    switchView(roleConfig.defaultView);
  } else {
    switchView(AppState.activeView);
  }
}

/**
 * Simulador y Selector de Roles de Usuario (Auditoría para Administradores)
 */
function initRoleSwitcher() {
  const select = document.getElementById('role-selector');
  if (!select) return;

  select.addEventListener('change', (e) => {
    const newRole = e.target.value;
    applyRoleBasedAccess(newRole);
    showToast(`Modo cambiado para auditoría a: ${RolePermissions[newRole]?.name || newRole}`, 'info');
  });
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

// Cerrar modales con clic fuera (excepto modal de login obligatorio)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop') && e.target.id !== 'login-modal-overlay') {
    e.target.classList.remove('open');
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
          DashboardModule.loadKPIs();
          RoomsModule.loadRooms();
          HousekeepingModule.loadHousekeepingBoard();
        }
      })
      .subscribe();

    supabaseClient
      .channel('public:reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        if (AppState.currentRole !== 'guest') {
          DashboardModule.loadKPIs();
          ReservationsModule.loadReservations();
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription not supported in current mode:', err);
  }
}
