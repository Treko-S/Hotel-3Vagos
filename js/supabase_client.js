/**
 * HOTEL 3 VAGOS - UTCD
 * Supabase Client & Data Layer
 */

const SUPABASE_URL = "https://nfbiqdhiowroosvfazid.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYmlxZGhpb3dyb29zdmZhemlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODExMTAsImV4cCI6MjEwMzY1NzExMH0.cq1gk6qvvbtY3j_kZVAGR4vSLXRhprxYalzWPAp7HzI";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYmlxZGhpb3dyb29zdmZhemlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA4MTExMCwiZXhwIjoyMTAzNjU3MTEwfQ.cvmJ_LOTvTX4VSyNlRVqtPB-K_EhMBQunB3oQh4c1bg";

// Cliente con privilegios administrativos para gestión total de inventario y datos
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Canal de sincronización en tiempo real vía Broadcast hacia la app móvil Flutter
const hotelBroadcastChannel = supabaseClient.channel('hotel_universal_sync');
hotelBroadcastChannel.subscribe((status) => {
  console.log('📡 [Broadcast Realtime] Canal hotel_universal_sync status:', status);
});

/**
 * Notifica a todas las instancias de la app móvil y dashboards que hubo un cambio en la BD
 */
function notifyDataChanged(tableName, details = {}) {
  try {
    hotelBroadcastChannel.send({
      type: 'broadcast',
      event: 'hotel_data_updated',
      payload: {
        table: tableName,
        timestamp: Date.now(),
        ...details
      }
    });
    console.log(`🚀 [Broadcast] Notificado cambio en tabla "${tableName}" a la app móvil.`);
  } catch (err) {
    console.warn('No se pudo enviar broadcast:', err);
  }
}

/**
 * Sanitizador de entradas para evitar ataques XSS o inyecciones
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'/]/g, function (match) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      "/": '&#x2F;'
    };
    return map[match];
  }).trim();
}

/**
 * Formateador de moneda en Guaraníes (Gs.)
 */
function formatGs(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-PY', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(num) + ' Gs.';
}

/**
 * Formateador de fechas estándar (DD/MM/YYYY)
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
