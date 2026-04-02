// loyalty.js
import { CONFIG } from './config.js';
import { showToast } from './utils.js';

export const loyalty = {
  /**
   * Obtiene los puntos actuales de un usuario
   * @param {string} userId - ID del usuario
   * @returns {number} - Puntos disponibles
   */
  getPoints(userId) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    const pointsMap = data ? JSON.parse(data) : {};
    return pointsMap[userId] || 0;
  },
  
  /**
   * Añade puntos a un usuario
   * @param {string} userId - ID del usuario
   * @param {number} amountSpentOrPoints - Monto gastado o puntos directos
   * @param {string} reason - Razón de la adición (opcional)
   * @returns {number} - Puntos añadidos
   */
  addPoints(userId, amountSpentOrPoints, reason = 'compra') {
    let pointsToAdd;
    
    if (amountSpentOrPoints > 1000) {
      // Es monto gastado (más de 1000)
      const rate = this.getPointsRate();
      pointsToAdd = Math.floor(amountSpentOrPoints / 1000) * rate;
      reason = `compra de ${this.formatCurrency(amountSpentOrPoints)}`;
    } else {
      // Son puntos directos
      pointsToAdd = amountSpentOrPoints;
    }
    
    if (pointsToAdd === 0) return 0;
    
    const current = this.getPoints(userId);
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    let pointsMap = data ? JSON.parse(data) : {};
    const newTotal = current + pointsToAdd;
    pointsMap[userId] = newTotal;
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(pointsMap));
    
    // Registrar transacción
    this.logTransaction(userId, pointsToAdd, 'add', reason, current, newTotal);
    
    // Notificar al usuario
    showToast(`✨ +${pointsToAdd} puntos por ${reason}`, 'success');
    
    return pointsToAdd;
  },
  
  /**
   * Redime puntos de un usuario
   * @param {string} userId - ID del usuario
   * @param {number} pointsToRedeem - Puntos a redimir
   * @param {string} reason - Razón del canje (opcional)
   * @returns {boolean} - Éxito de la operación
   */
  redeemPoints(userId, pointsToRedeem, reason = 'descuento') {
    const current = this.getPoints(userId);
    
    if (current < pointsToRedeem) {
      showToast(`Puntos insuficientes. Tienes ${current} puntos`, 'error');
      return false;
    }
    
    const discountValue = this.getPointsValue(pointsToRedeem);
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    let pointsMap = JSON.parse(data);
    const newTotal = current - pointsToRedeem;
    pointsMap[userId] = newTotal;
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(pointsMap));
    
    // Registrar transacción
    this.logTransaction(userId, pointsToRedeem, 'redeem', reason, current, newTotal, discountValue);
    
    showToast(`🎁 Canjeaste ${pointsToRedeem} puntos por ${this.formatCurrency(discountValue)}`, 'success');
    return true;
  },
  
  /**
   * Registra una transacción de puntos
   * @param {string} userId - ID del usuario
   * @param {number} points - Puntos involucrados
   * @param {string} type - Tipo: 'add' o 'redeem'
   * @param {string} reason - Razón
   * @param {number} before - Saldo anterior
   * @param {number} after - Saldo posterior
   * @param {number} discountValue - Valor del descuento (si aplica)
   */
  logTransaction(userId, points, type, reason, before, after, discountValue = 0) {
    const transactions = this.getTransactionHistory(userId);
    transactions.unshift({
      id: Date.now(),
      userId,
      points,
      type,
      reason,
      before,
      after,
      discountValue,
      timestamp: Date.now()
    });
    
    // Mantener solo últimas 100 transacciones
    localStorage.setItem(`arepas_loyalty_log_${userId}`, JSON.stringify(transactions.slice(0, 100)));
  },
  
  /**
   * Obtiene el historial de transacciones de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Array} - Historial de transacciones
   */
  getTransactionHistory(userId) {
    const raw = localStorage.getItem(`arepas_loyalty_log_${userId}`);
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Obtiene la tasa de conversión de puntos
   * @returns {number} - Puntos por cada 1000 COP
   */
  getPointsRate() {
    const rate = localStorage.getItem('arepas_points_rate');
    return rate ? parseInt(rate) : CONFIG.LOYALTY_RATE || 1;
  },
  
  /**
   * Establece la tasa de conversión de puntos
   * @param {number} rate - Puntos por cada 1000 COP
   */
  setPointsRate(rate) {
    localStorage.setItem('arepas_points_rate', Math.max(1, Math.min(10, rate)));
    showToast(`Tasa de puntos actualizada: ${rate} punto por $1000`, 'success');
  },
  
  /**
   * Calcula el valor en dinero de los puntos
   * @param {number} points - Cantidad de puntos
   * @returns {number} - Valor en COP
   */
  getPointsValue(points) {
    const rate = CONFIG.POINTS_TO_CASH_RATIO || 10;
    return points * rate; // 10 puntos = 100 COP
  },
  
  /**
   * Calcula cuántos puntos se necesitan para un descuento
   * @param {number} discountAmount - Monto de descuento deseado
   * @returns {number} - Puntos necesarios
   */
  getPointsForDiscount(discountAmount) {
    const rate = CONFIG.POINTS_TO_CASH_RATIO || 10;
    return Math.ceil(discountAmount / rate);
  },
  
  /**
   * Obtiene el nivel de lealtad del usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Nivel y beneficios
   */
  getUserTier(userId) {
    const points = this.getPoints(userId);
    const totalSpent = this.getTotalSpent(userId);
    
    const tiers = [
      { name: 'Bronce', minPoints: 0, minSpent: 0, multiplier: 1, color: '#cd7f32', icon: '🥉', discount: 0 },
      { name: 'Plata', minPoints: 500, minSpent: 100000, multiplier: 1.2, color: '#c0c0c0', icon: '🥈', discount: 5 },
      { name: 'Oro', minPoints: 1500, minSpent: 300000, multiplier: 1.5, color: '#ffd700', icon: '🥇', discount: 10 },
      { name: 'Platino', minPoints: 3500, minSpent: 700000, multiplier: 2, color: '#e5e4e2', icon: '💎', discount: 15 },
      { name: 'Black', minPoints: 7000, minSpent: 1500000, multiplier: 3, color: '#000000', icon: '👑', discount: 20 }
    ];
    
    let currentTier = tiers[0];
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (points >= tiers[i].minPoints || totalSpent >= tiers[i].minSpent) {
        currentTier = tiers[i];
        break;
      }
    }
    
    const nextTier = tiers[tiers.indexOf(currentTier) + 1];
    const pointsToNext = nextTier ? nextTier.minPoints - points : 0;
    const spentToNext = nextTier ? nextTier.minSpent - totalSpent : 0;
    
    return {
      ...currentTier,
      nextTier: nextTier?.name || null,
      pointsToNext: Math.max(0, pointsToNext),
      spentToNext: Math.max(0, spentToNext),
      progress: nextTier ? Math.min(100, Math.round((points / nextTier.minPoints) * 100)) : 100
    };
  },
  
  /**
   * Calcula puntos con multiplicador según nivel
   * @param {string} userId - ID del usuario
   * @param {number} amount - Monto gastado
   * @returns {number} - Puntos a añadir
   */
  calculatePointsWithMultiplier(userId, amount) {
    const tier = this.getUserTier(userId);
    const basePoints = Math.floor(amount / 1000) * this.getPointsRate();
    return Math.floor(basePoints * tier.multiplier);
  },
  
  /**
   * Obtiene el total gastado por un usuario
   * @param {string} userId - ID del usuario
   * @returns {number} - Total gastado
   */
  getTotalSpent(userId) {
    const orders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
    const userOrders = orders[userId] || [];
    return userOrders.reduce((sum, order) => sum + order.total, 0);
  },
  
  /**
   * Obtiene estadísticas de lealtad de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Estadísticas completas
   */
  getUserStats(userId) {
    const points = this.getPoints(userId);
    const tier = this.getUserTier(userId);
    const totalSpent = this.getTotalSpent(userId);
    const transactions = this.getTransactionHistory(userId);
    
    const pointsEarned = transactions
      .filter(t => t.type === 'add')
      .reduce((sum, t) => sum + t.points, 0);
    
    const pointsRedeemed = transactions
      .filter(t => t.type === 'redeem')
      .reduce((sum, t) => sum + t.points, 0);
    
    const discountEarned = this.getPointsValue(pointsRedeemed);
    
    return {
      userId,
      currentPoints: points,
      totalPointsEarned: pointsEarned,
      totalPointsRedeemed: pointsRedeemed,
      totalSpent,
      discountEarned,
      tier: tier.name,
      tierIcon: tier.icon,
      nextTier: tier.nextTier,
      pointsToNextTier: tier.pointsToNext,
      spentToNextTier: tier.spentToNext,
      tierProgress: tier.progress,
      multiplier: tier.multiplier,
      transactionCount: transactions.length
    };
  },
  
  /**
   * Obtiene el ranking de usuarios por puntos
   * @param {number} limit - Cantidad de resultados
   * @returns {Array} - Ranking de usuarios
   */
  getLeaderboard(limit = 10) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    const pointsMap = data ? JSON.parse(data) : {};
    const users = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USERS) || '[]');
    
    const leaderboard = Object.entries(pointsMap)
      .map(([userId, points]) => {
        const user = users.find(u => u.id === userId);
        return {
          userId,
          email: user?.email || userId,
          points,
          tier: this.getUserTier(userId).name
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
    
    return leaderboard;
  },
  
  /**
   * Obtiene estadísticas globales del programa de lealtad
   * @returns {Object} - Estadísticas
   */
  getGlobalStats() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    const pointsMap = data ? JSON.parse(data) : {};
    const pointsArray = Object.values(pointsMap);
    
    const totalPoints = pointsArray.reduce((sum, p) => sum + p, 0);
    const usersWithPoints = Object.keys(pointsMap).length;
    const avgPoints = usersWithPoints > 0 ? totalPoints / usersWithPoints : 0;
    
    // Contar usuarios por nivel
    const tierCounts = { Bronce: 0, Plata: 0, Oro: 0, Platino: 0, Black: 0 };
    for (const [userId] of Object.entries(pointsMap)) {
      const tier = this.getUserTier(userId);
      tierCounts[tier.name]++;
    }
    
    return {
      totalPoints,
      usersWithPoints,
      avgPoints,
      tierDistribution: tierCounts,
      pointsRate: this.getPointsRate(),
      pointsValue: this.getPointsValue(1)
    };
  },
  
  /**
   * Formatea moneda
   * @param {number} amount - Cantidad
   * @returns {string} - Moneda formateada
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  },
  
  /**
   * Reinicia los puntos de un usuario (admin)
   * @param {string} userId - ID del usuario
   * @returns {boolean} - Éxito
   */
  resetUserPoints(userId) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    let pointsMap = data ? JSON.parse(data) : {};
    delete pointsMap[userId];
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(pointsMap));
    localStorage.removeItem(`arepas_loyalty_log_${userId}`);
    showToast(`Puntos de usuario reiniciados`, 'info');
    return true;
  },
  
  /**
   * Obtiene sugerencias de recompensas basadas en puntos
   * @param {string} userId - ID del usuario
   * @returns {Array} - Recompensas sugeridas
   */
  getRewardSuggestions(userId) {
    const points = this.getPoints(userId);
    const tier = this.getUserTier(userId);
    
    const rewards = [
      { name: 'Descuento de $1,000', points: 100, value: 1000, popular: true },
      { name: 'Descuento de $2,000', points: 200, value: 2000 },
      { name: 'Descuento de $5,000', points: 500, value: 5000 },
      { name: 'Descuento de $10,000', points: 1000, value: 10000, popular: true },
      { name: 'Arepa Clásica gratis', points: 800, value: 8000, type: 'product', productId: 'a1' },
      { name: 'Reina Pepiada gratis', points: 1200, value: 12000, type: 'product', productId: 'a2' },
      { name: `+${tier.multiplier * 100} puntos extra`, points: 500, value: tier.multiplier * 100, type: 'bonus' }
    ];
    
    return rewards
      .filter(r => r.points <= points)
      .map(r => ({
        ...r,
        affordable: true,
        recommended: points >= r.points * 1.5
      }))
      .sort((a, b) => b.value - a.value);
  }
};

// Inicializar
const initialRate = CONFIG.LOYALTY_RATE || 1;
if (!localStorage.getItem('arepas_points_rate')) {
  loyalty.setPointsRate(initialRate);
}
