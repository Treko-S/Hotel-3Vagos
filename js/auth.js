/**
 * HOTEL 3 VAGOS - UTCD
 * Advanced Security, Anti-BruteForce Rate Limiter & Device Fingerprint Authentication
 */

const AuthModule = {
  SALT: "HOTEL_3VAGOS_SECURE_SALT_2026_UTCD",
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 5 * 60 * 1000, // 5 minutos de bloqueo
  deviceFingerprint: null,
  lockoutTimerInterval: null,

  // Directorio de Cuentas del Personal con contraseñas seguras pre-hasheadas (SHA-256 + Salt)
  // Hashes calculados para: admin123, gerente123, recepcion123, housekeeping123, guest123
  STAFF_ACCOUNTS: [
    {
      email: "admin@hotel3vagos.com",
      username: "admin",
      name: "Kevin Santacruz",
      role: "administrador",
      passwordHash: "470764cd464e81f20ed76fc2e4bd7f690489ce0bc2da5dd69f9772c66caa23f8" // admin123 + salt
    },
    {
      email: "gerente@hotel3vagos.com",
      username: "gerente",
      name: "Lic. Andrea Benítez",
      role: "gerente",
      passwordHash: "0a93516fc345e5417e2bc53617c3eee0b2fbe1a3e9800d58169ac3e5dfbe7e40" // gerente123 + salt
    },
    {
      email: "recepcion@hotel3vagos.com",
      username: "recepcion",
      name: "Marcos Rolón",
      role: "recepcionista",
      passwordHash: "79bc62f88ec490bd0b06c764858949f3c0186f4283d05d833f3359636387edb9" // recepcion123 + salt
    },
    {
      email: "housekeeping@hotel3vagos.com",
      username: "housekeeping",
      name: "Elena Morales",
      role: "housekeeping",
      passwordHash: "43b520eee83e83ee1aeac02520d15d731cb6ff4ed196be818b5be9278f2ded36" // housekeeping123 + salt
    },
    {
      email: "guest@hotel3vagos.com",
      username: "guest",
      name: "Huésped Consulta",
      role: "guest",
      passwordHash: "abd18a6a0fbbe00cec62b03908c72304f2c62e4af6a2a0a7d4dbc7acb7f5c63d" // guest123 + salt
    }
  ],

  async init() {
    this.deviceFingerprint = await this.generateDeviceFingerprint();
    this.checkRateLimitStatus();
    await this.validateSession();
  },

  /**
   * Genera una huella digital única (Device Fingerprint) usando Web Crypto API (SHA-256)
   */
  async generateDeviceFingerprint() {
    try {
      const components = [
        navigator.userAgent,
        navigator.language || 'es',
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        navigator.hardwareConcurrency || 4
      ].join('###');

      return await this.sha256(components);
    } catch (e) {
      console.warn('Fallback device id generation:', e);
      return 'dev_' + Math.random().toString(36).substring(2, 15);
    }
  },

  /**
   * Función criptográfica SHA-256 usando crypto.subtle nativo
   */
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message + this.SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Valida si el dispositivo actual cuenta con una sesión autorizada y no expirada
   */
  async validateSession() {
    const sessionStr = localStorage.getItem('hotel_admin_session');
    if (!sessionStr) {
      this.requireLogin('Nuevo dispositivo detectado. Inicie sesión para continuar.');
      return;
    }

    try {
      const session = JSON.parse(sessionStr);

      // Validar si la sesión corresponde a este mismo dispositivo físico
      if (session.deviceFingerprint !== this.deviceFingerprint) {
        this.requireLogin('Dispositivo no reconocido o cambio de entorno. Por favor verifique sus credenciales.');
        return;
      }

      // Validar caducidad (8 horas de sesión activa)
      const now = Date.now();
      if (now - session.timestamp > 8 * 60 * 60 * 1000) {
        this.requireLogin('Su sesión ha caducado por inactividad. Ingrese nuevamente.');
        return;
      }

      // Sesión válida: actualizar usuario y aplicar RBAC
      this.onSessionAuthenticated(session.user);

    } catch (e) {
      this.requireLogin('Error de verificación de sesión.');
    }
  },

  requireLogin(reasonMessage = '') {
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!isLoginPage) {
      // Redirigir de inmediato a la página independiente de login
      window.location.replace('login.html');
      return;
    }

    const deviceEl = document.getElementById('login-device-id');
    if (deviceEl && this.deviceFingerprint) {
      deviceEl.innerText = this.deviceFingerprint.substring(0, 16) + '...';
    }

    const alertEl = document.getElementById('login-security-alert');
    const alertText = document.getElementById('login-alert-text');
    if (alertEl && reasonMessage) {
      if (alertText) alertText.innerText = reasonMessage;
      else alertEl.innerText = reasonMessage;
      alertEl.style.display = 'flex';
    }

    this.checkRateLimitStatus();
  },

  /**
   * Rate Limiting: Verifica si el cliente está bloqueado por exceso de intentos fallidos
   */
  checkRateLimitStatus() {
    const lockedUntil = Number(localStorage.getItem('auth_locked_until')) || 0;
    const now = Date.now();

    const submitBtn = document.getElementById('btn-login-submit');
    const lockoutBox = document.getElementById('login-lockout-box');
    const timerText = document.getElementById('lockout-countdown');

    if (lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);

      if (submitBtn) submitBtn.disabled = true;
      if (lockoutBox) lockoutBox.style.display = 'block';

      if (this.lockoutTimerInterval) clearInterval(this.lockoutTimerInterval);

      this.lockoutTimerInterval = setInterval(() => {
        const left = Math.ceil((lockedUntil - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(this.lockoutTimerInterval);
          localStorage.removeItem('auth_locked_until');
          localStorage.removeItem('auth_failed_attempts');
          if (submitBtn) submitBtn.disabled = false;
          if (lockoutBox) lockoutBox.style.display = 'none';
        } else {
          const mins = Math.floor(left / 60);
          const secs = left % 60;
          if (timerText) {
            timerText.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          }
        }
      }, 1000);

      return true;
    } else {
      if (submitBtn) submitBtn.disabled = false;
      if (lockoutBox) lockoutBox.style.display = 'none';
      return false;
    }
  },

  recordFailedAttempt() {
    let attempts = Number(localStorage.getItem('auth_failed_attempts')) || 0;
    attempts++;
    localStorage.setItem('auth_failed_attempts', attempts);

    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = Date.now() + this.LOCKOUT_DURATION_MS;
      localStorage.setItem('auth_locked_until', lockUntil);
      this.checkRateLimitStatus();
      showToast('Demasiados intentos fallidos. Acceso bloqueado por 5 minutos.', 'error');
    } else {
      const remaining = this.MAX_FAILED_ATTEMPTS - attempts;
      showToast(`Credenciales inválidas. Quedan ${remaining} intento(s) antes del bloqueo.`, 'warning');
    }
  },

  resetFailedAttempts() {
    localStorage.removeItem('auth_failed_attempts');
    localStorage.removeItem('auth_locked_until');
  },

  /**
   * Proceso de Login con defensa anti-fuerza bruta y Hash Encryption
   */
  async login(identifier, password) {
    if (this.checkRateLimitStatus()) {
      showToast('Dispositivo bloqueado temporalmente por seguridad.', 'error');
      return false;
    }

    // Jitter delay artificial para evitar ataques de timing / bots
    await new Promise(r => setTimeout(r, 400 + Math.random() * 200));

    const cleanId = (identifier || '').trim().toLowerCase();
    const hash = await this.sha256(password);

    // 1. Verificar primero en cuentas de Staff local con Hash SHA-256
    const staffUser = this.STAFF_ACCOUNTS.find(u => 
      (u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId)
    );

    if (staffUser) {
      if (staffUser.passwordHash === hash) {
        this.resetFailedAttempts();
        this.createDeviceSession(staffUser);
        return true;
      }
    }

    // 2. Si no es Staff local y tiene formato de email, intentar autenticación con Supabase Auth
    if (cleanId.includes('@')) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: cleanId,
          password: password
        });

        if (!error && data.user) {
          this.resetFailedAttempts();
          const role = data.user.user_metadata?.role || 'guest';
          const userObj = {
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
            role: role
          };
          this.createDeviceSession(userObj);
          return true;
        }
      } catch (e) {
        console.warn('Supabase Auth error:', e);
      }
    }

    // Fallo de autenticación
    this.recordFailedAttempt();
    return false;
  },

  createDeviceSession(user) {
    const sessionData = {
      deviceFingerprint: this.deviceFingerprint,
      timestamp: Date.now(),
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    };

    localStorage.setItem('hotel_admin_session', JSON.stringify(sessionData));

    const overlay = document.getElementById('login-modal-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('open');
    }

    showToast(`¡Bienvenido ${user.name}! Sesión autorizada.`, 'success');
    this.onSessionAuthenticated(user);
  },

  onSessionAuthenticated(user) {
    AppState.currentUser = user;
    AppState.currentRole = user.role;

    // Actualizar nombre y rol en UI del sidebar
    const nameEl = document.querySelector('.user-details h4');
    if (nameEl) nameEl.innerText = user.name;

    const roleNames = {
      'administrador': 'Administrador General',
      'gerente': 'Gerente General',
      'recepcionista': 'Recepcionista Front Desk',
      'housekeeping': 'Supervisora Housekeeping',
      'guest': 'Huésped (Acceso Restringido)'
    };

    const roleDisplay = document.getElementById('user-role-display');
    if (roleDisplay) roleDisplay.innerText = roleNames[user.role] || user.role;

    // Aplicar RBAC dinámico en navegación
    applyRoleBasedAccess(user.role);
  },

  logout() {
    if (!confirm('¿Desea cerrar la sesión de este dispositivo?')) return;
    localStorage.removeItem('hotel_admin_session');
    try {
      supabaseClient.auth.signOut();
    } catch (e) {}
    window.location.replace('login.html');
  }
};
