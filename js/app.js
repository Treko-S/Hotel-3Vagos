/**
 * HOTEL 3 VAGOS - UTCD
 * Master Application Controller & Navigation
 */

// Estado global de la aplicación
const AppState = {
  currentRole: 'admin', // admin, recepcionista, housekeeping, gerente
  currentUser: {
    name: 'Kevin Santacruz',
    role: 'Administrador General'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initRoleSwitcher();

  // Iniciar módulos
  await DashboardModule.init();
  await ReservationsModule.init();
  await RoomsModule.init();
  await HousekeepingModule.init();
  await MaintenanceModule.init();
  await CashBillingModule.init();
  await GuestsModule.init();

  // Suscribirse a cambios en tiempo real en Supabase para habitaciones y reservas
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
    'reports': { title: 'Reportes & Estadísticas', subtitle: 'Informes de ocupación, ADR, RevPAR y rentabilidad' }
  };

  const meta = titles[viewId] || { title: 'Panel de Gestión', subtitle: 'Sistema Hotelero UTCD' };
  document.getElementById('page-title').innerText = meta.title;
  document.getElementById('page-subtitle').innerText = meta.subtitle;

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
 * Simulador de Roles de Usuario
 */
function initRoleSwitcher() {
  const select = document.getElementById('role-selector');
  if (!select) return;

  select.addEventListener('change', (e) => {
    const role = e.target.value;
    AppState.currentRole = role;

    const roleNames = {
      'admin': 'Administrador General',
      'recepcionista': 'Recepcionista Front Desk',
      'housekeeping': 'Supervisora Housekeeping',
      'gerente': 'Gerente General'
    };

    document.getElementById('user-role-display').innerText = roleNames[role] || 'Usuario';
    showToast(`Modo cambiado a: ${roleNames[role]}`, 'info');
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

// Cerrar modales con clic fuera
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
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
        DashboardModule.loadKPIs();
        RoomsModule.loadRooms();
        HousekeepingModule.loadHousekeepingBoard();
      })
      .subscribe();

    supabaseClient
      .channel('public:reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        DashboardModule.loadKPIs();
        ReservationsModule.loadReservations();
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription not supported in current mode:', err);
  }
}
