// fraudDetector.js
import { CONFIG } from './config.js';

export const fraudDetector = {
  suspiciousActions: [],
  
  track(action, userId, metadata = {}) {
    this.suspiciousActions.push({ action, userId, metadata, timestamp: Date.now() });
    this.cleanOld();
    const alerts = this.detect();
    if (alerts.length > 0) {
      this.saveAlerts(alerts, userId);
    }
    return alerts;
  },
  
  cleanOld() {
    const oneDayAgo = Date.now() - 86400000;
    this.suspiciousActions = this.suspiciousActions.filter(a => a.timestamp > oneDayAgo);
  },
  
  detect() {
    const alerts = [];
    const userActions = {};
    
    this.suspiciousActions.forEach(a => {
      if (!userActions[a.userId]) userActions[a.userId] = [];
      userActions[a.userId].push(a);
    });
    
    for (const [userId, actions] of Object.entries(userActions)) {
      // Detectar múltiples intentos de cupón
      const couponAttempts = actions.filter(a => a.action === 'coupon_fail').length;
      if (couponAttempts > 10) alerts.push(`Usuario ${userId}: Demasiados intentos de cupón inválido (${couponAttempts})`);
      
      // Detectar cambios rápidos de carrito
      const recentChanges = actions.filter(a => a.action === 'cart_change' && a.timestamp > Date.now() - 60000).length;
      if (recentChanges > 30) alerts.push(`Usuario ${userId}: Actividad inusual en el carrito (${recentChanges} cambios/min)`);
      
      // Detectar múltiples registros desde mismo dispositivo
      const registrations = actions.filter(a => a.action === 'register').length;
      if (registrations > 5) alerts.push(`Usuario ${userId}: Múltiples registros (${registrations})`);
      
      // Detectar intentos de aplicar múltiples cupones
      const multiCoupon = actions.filter(a => a.action === 'coupon_apply').length;
      if (multiCoupon > 3 && couponAttempts > 2) {
        alerts.push(`Usuario ${userId}: Posible ataque de fuerza bruta a cupones`);
      }
    }
    
    return alerts;
  },
  
  saveAlerts(alerts, userId) {
    const existing = this.getAlerts();
    alerts.forEach(alert => {
      existing.unshift({ alert, userId, timestamp: Date.now() });
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify(existing.slice(0, 100)));
  },
  
  getAlerts() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS);
    return raw ? JSON.parse(raw) : [];
  },
  
  clearAlerts() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify([]));
  },
  
  isUserFlagged(userId) {
    const alerts = this.getAlerts();
    const userAlerts = alerts.filter(a => a.userId === userId);
    return userAlerts.length >= 5;
  }
};