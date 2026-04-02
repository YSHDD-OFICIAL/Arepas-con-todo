// fraudDetector.js
import { CONFIG } from './config.js';
import { showToast } from './utils.js';

export const fraudDetector = {
  suspiciousActions: [],
  blockedUsers: new Set(),
  
  /**
   * Registra una acción para análisis
   * @param {string} action - Tipo de acción
   * @param {string} userId - ID del usuario
   * @param {Object} metadata - Datos adicionales
   * @returns {Array} - Alertas generadas
   */
  track(action, userId, metadata = {}) {
    if (!userId) return [];
    
    this.suspiciousActions.push({ 
      action, 
      userId, 
      metadata, 
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    });
    this.cleanOld();
    const alerts = this.detect();
    if (alerts.length > 0) {
      this.saveAlerts(alerts, userId);
      this.notifyAdmin(alerts, userId);
    }
    return alerts;
  },
  
  /**
   * Obtiene ID de sesión actual
   * @returns {string} - ID de sesión
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('fraud_session_id');
    if (!sessionId) {
      sessionId = Date.now() + '-' + Math.random().toString(36);
      sessionStorage.setItem('fraud_session_id', sessionId);
    }
    return sessionId;
  },
  
  /**
   * Limpia acciones antiguas (más de 24 horas)
   */
  cleanOld() {
    const oneDayAgo = Date.now() - 86400000;
    this.suspiciousActions = this.suspiciousActions.filter(a => a.timestamp > oneDayAgo);
  },
  
  /**
   * Detecta comportamientos sospechosos
   * @returns {Array} - Alertas detectadas
   */
  detect() {
    const alerts = [];
    const userActions = {};
    
    this.suspiciousActions.forEach(a => {
      if (!userActions[a.userId]) userActions[a.userId] = [];
      userActions[a.userId].push(a);
    });
    
    for (const [userId, actions] of Object.entries(userActions)) {
      // Verificar si usuario está bloqueado
      if (this.isUserBlocked(userId)) {
        alerts.push(`Usuario ${userId}: BLOQUEADO - Acciones ignoradas`);
        continue;
      }
      
      // 1. Múltiples intentos de cupón inválido
      const couponFailAttempts = actions.filter(a => a.action === 'coupon_fail').length;
      if (couponFailAttempts > 10) {
        alerts.push(`🚨 Usuario ${userId}: ${couponFailAttempts} intentos de cupón inválido`);
        if (couponFailAttempts > 20) this.blockUser(userId, 'Demasiados intentos de cupón');
      }
      
      // 2. Cambios rápidos de carrito
      const recentChanges = actions.filter(a => 
        a.action === 'cart_change' && a.timestamp > Date.now() - 60000
      ).length;
      if (recentChanges > 30) {
        alerts.push(`⚠️ Usuario ${userId}: ${recentChanges} cambios/min en carrito`);
      }
      
      // 3. Múltiples registros
      const registrations = actions.filter(a => a.action === 'register').length;
      if (registrations > 5) {
        alerts.push(`🚨 Usuario ${userId}: ${registrations} registros en 24h`);
        if (registrations > 10) this.blockUser(userId, 'Múltiples registros sospechosos');
      }
      
      // 4. Ataque de fuerza bruta a cupones
      const couponApply = actions.filter(a => a.action === 'coupon_apply').length;
      if (couponApply > 3 && couponFailAttempts > 2) {
        alerts.push(`⚠️ Usuario ${userId}: Posible ataque de fuerza bruta a cupones`);
      }
      
      // 5. Checkouts fallidos repetidos
      const failedCheckouts = actions.filter(a => a.action === 'checkout_fail').length;
      if (failedCheckouts > 5) {
        alerts.push(`⚠️ Usuario ${userId}: ${failedCheckouts} checkouts fallidos`);
      }
      
      // 6. Velocidad de clics anormal
      const rapidClicks = actions.filter(a => 
        (a.action === 'add_to_cart' || a.action === 'click') && 
        a.timestamp > Date.now() - 5000
      ).length;
      if (rapidClicks > 20) {
        alerts.push(`⚠️ Usuario ${userId}: ${rapidClicks} clics en 5 segundos (posible bot)`);
        if (rapidClicks > 50) this.blockUser(userId, 'Actividad automatizada detectada');
      }
      
      // 7. Múltiples dispositivos/IPs
      const uniqueSessions = new Set(actions.map(a => a.sessionId)).size;
      if (uniqueSessions > 3 && actions.length > 20) {
        alerts.push(`⚠️ Usuario ${userId}: ${uniqueSessions} sesiones diferentes detectadas`);
      }
      
      // 8. Patrón de horario inusual
      const nightActions = actions.filter(a => {
        const hour = new Date(a.timestamp).getHours();
        return hour >= 0 && hour < 5;
      }).length;
      if (nightActions > 50 && actions.length > 100) {
        alerts.push(`⚠️ Usuario ${userId}: Actividad inusual en horario nocturno (${nightActions} acciones)`);
      }
    }
    
    return alerts;
  },
  
  /**
   * Bloquea a un usuario
   * @param {string} userId - ID del usuario
   * @param {string} reason - Motivo del bloqueo
   */
  blockUser(userId, reason) {
    if (this.blockedUsers.has(userId)) return;
    
    this.blockedUsers.add(userId);
    const blocked = this.getBlockedUsers();
    blocked[userId] = { reason, timestamp: Date.now() };
    localStorage.setItem('arepas_blocked_users', JSON.stringify(blocked));
    
    console.warn(`🔒 Usuario ${userId} bloqueado: ${reason}`);
    showToast(`⚠️ Actividad sospechosa detectada. Contacta al administrador.`, 'error');
  },
  
  /**
   * Desbloquea a un usuario
   * @param {string} userId - ID del usuario
   */
  unblockUser(userId) {
    this.blockedUsers.delete(userId);
    const blocked = this.getBlockedUsers();
    delete blocked[userId];
    localStorage.setItem('arepas_blocked_users', JSON.stringify(blocked));
  },
  
  /**
   * Verifica si un usuario está bloqueado
   * @param {string} userId - ID del usuario
   * @returns {boolean} - Está bloqueado
   */
  isUserBlocked(userId) {
    const blocked = this.getBlockedUsers();
    return !!blocked[userId];
  },
  
  /**
   * Obtiene usuarios bloqueados
   * @returns {Object} - Usuarios bloqueados
   */
  getBlockedUsers() {
    const raw = localStorage.getItem('arepas_blocked_users');
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Guarda alertas en localStorage
   * @param {Array} alerts - Alertas generadas
   * @param {string} userId - ID del usuario
   */
  saveAlerts(alerts, userId) {
    const existing = this.getAlerts();
    alerts.forEach(alert => {
      existing.unshift({ 
        alert, 
        userId, 
        timestamp: Date.now(),
        resolved: false
      });
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify(existing.slice(0, 200)));
  },
  
  /**
   * Notifica al administrador (simulado)
   * @param {Array} alerts - Alertas
   * @param {string} userId - ID del usuario
   */
  notifyAdmin(alerts, userId) {
    // En producción, aquí se enviaría email o notificación
    console.warn(`[FRAUDE] Usuario ${userId}: ${alerts.join(', ')}`);
    
    // Notificación visual si el admin está logueado
    const session = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION) || '{}');
    if (session.email === CONFIG.ADMIN_EMAIL) {
      showToast(`🚨 Alerta de fraude: ${alerts[0]}`, 'warning');
    }
  },
  
  /**
   * Obtiene todas las alertas
   * @returns {Array} - Alertas guardadas
   */
  getAlerts() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS);
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Marca una alerta como resuelta
   * @param {number} index - Índice de la alerta
   */
  resolveAlert(index) {
    const alerts = this.getAlerts();
    if (alerts[index]) {
      alerts[index].resolved = true;
      alerts[index].resolvedAt = Date.now();
      localStorage.setItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify(alerts));
    }
  },
  
  /**
   * Limpia todas las alertas
   */
  clearAlerts() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify([]));
  },
  
  /**
   * Verifica si un usuario está marcado como fraudulento
   * @param {string} userId - ID del usuario
   * @returns {boolean} - Está marcado
   */
  isUserFlagged(userId) {
    const alerts = this.getAlerts();
    const userAlerts = alerts.filter(a => a.userId === userId && !a.resolved);
    return userAlerts.length >= 5;
  },
  
  /**
   * Obtiene estadísticas de fraude
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const alerts = this.getAlerts();
    const blocked = this.getBlockedUsers();
    const unresolved = alerts.filter(a => !a.resolved);
    
    const alertsByType = {};
    alerts.forEach(a => {
      const type = a.alert.split(':')[0];
      alertsByType[type] = (alertsByType[type] || 0) + 1;
    });
    
    return {
      totalAlerts: alerts.length,
      unresolvedAlerts: unresolved.length,
      blockedUsers: Object.keys(blocked).length,
      alertsByType,
      topOffenders: this.getTopOffenders(5)
    };
  },
  
  /**
   * Obtiene los usuarios con más alertas
   * @param {number} limit - Cantidad de resultados
   * @returns {Array} - Top infractores
   */
  getTopOffenders(limit = 5) {
    const alerts = this.getAlerts();
    const userAlertCount = {};
    
    alerts.forEach(a => {
      if (!userAlertCount[a.userId]) userAlertCount[a.userId] = 0;
      userAlertCount[a.userId]++;
    });
    
    return Object.entries(userAlertCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, count]) => ({ userId, alertCount: count }));
  },
  
  /**
   * Valida una acción antes de ejecutarla
   * @param {string} userId - ID del usuario
   * @param {string} action - Acción a validar
   * @returns {boolean} - Acción permitida
   */
  validateAction(userId, action) {
    if (this.isUserBlocked(userId)) {
      showToast('⛔ Acción bloqueada por seguridad', 'error');
      return false;
    }
    
    if (this.isUserFlagged(userId) && action === 'coupon_apply') {
      showToast('⚠️ No puedes aplicar cupones temporalmente', 'warning');
      return false;
    }
    
    return true;
  },
  
  /**
   * Registra un login exitoso (para análisis de patrones)
   * @param {string} userId - ID del usuario
   * @param {string} ip - IP del usuario (simulada)
   */
  trackLogin(userId, ip = 'unknown') {
    const logins = this.getLoginHistory();
    if (!logins[userId]) logins[userId] = [];
    logins[userId].push({ timestamp: Date.now(), ip });
    localStorage.setItem('arepas_login_history', JSON.stringify(logins.slice(-50)));
    
    // Detectar múltiples logins desde diferentes IPs
    const uniqueIPs = new Set(logins[userId].map(l => l.ip)).size;
    if (uniqueIPs > 3 && logins[userId].length > 5) {
      this.track('suspicious_login', userId, { uniqueIPs });
    }
  },
  
  /**
   * Obtiene historial de logins
   * @returns {Object} - Historial de logins
   */
  getLoginHistory() {
    const raw = localStorage.getItem('arepas_login_history');
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Reinicia todos los datos de detección de fraude
   */
  reset() {
    this.suspiciousActions = [];
    this.blockedUsers.clear();
    localStorage.removeItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS);
    localStorage.removeItem('arepas_blocked_users');
    localStorage.removeItem('arepas_login_history');
    showToast('🔄 Sistema anti-fraude reiniciado', 'info');
  }
};

// Cargar usuarios bloqueados al inicio
const blocked = fraudDetector.getBlockedUsers();
Object.keys(blocked).forEach(userId => fraudDetector.blockedUsers.add(userId));
