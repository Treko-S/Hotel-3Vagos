/**
 * HOTEL 3 VAGOS - UTCD
 * Supabase Client & Data Layer
 */

const SUPABASE_URL = "https://nfbiqdhiowroosvfazid.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYmlxZGhpb3dyb29zdmZhemlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODExMTAsImV4cCI6MjEwMzY1NzExMH0.cq1gk6qvvbtY3j_kZVAGR4vSLXRhprxYalzWPAp7HzI";

// Inicializar Supabase usando la librería global cargada via CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
