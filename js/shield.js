/**
 * HOTEL 3 VAGOS - UTCD
 * Security Shield: Anti-Tampering, Console Silencer & DevTools Blocker
 * Protege contra ingeniería inversa y oculta peticiones y trazas en consola.
 */

(function () {
  'use strict';

  // 1. Silenciar y neutralizar métodos de la consola en todos los navegadores
  const noop = function () {};
  const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'timeLog'];

  try {
    if (window.console) {
      methods.forEach(method => {
        try {
          window.console[method] = noop;
        } catch (e) {}
      });

      // Congelar el objeto console para evitar que scripts externos restauren los logs
      try {
        Object.freeze(window.console);
      } catch (e) {}
    }
  } catch (e) {}

  // 2. Suprimir errores no capturados y promesas rechazadas para no exponer trazas ni URLs
  window.addEventListener('error', function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    return true;
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    return true;
  }, true);

  // 3. Bloquear atajos comunes de inspección de DevTools y código fuente
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.keyCode === 123 || e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + Shift + I, Ctrl + Shift + J, Ctrl + Shift + C
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + U (Ver código fuente)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Cmd + Option + I / Cmd + Option + J / Cmd + Option + U en macOS
    if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 4. Bloquear clic derecho (Menú contextual de inspección)
  document.addEventListener('contextmenu', function (e) {
    // Permitir clic derecho solo en campos de texto editables para pegar o copiar
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return true;
    }
    e.preventDefault();
    return false;
  }, true);

})();
