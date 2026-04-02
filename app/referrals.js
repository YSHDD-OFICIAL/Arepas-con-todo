// referrals.js
import { CONFIG, FEATURES } from './config.js';
import { showToast, copyToClipboard } from './utils.js';

export const referrals = {
  /**
   * Genera un código único de referido para un usuario
   * @param {string} userId - ID del usuario
   * @returns {string} - Código de referido
   */
  generateCode(userId) {
    const timestamp = Date.now().toString(36).slice(-4);
    const hash = userId.slice(-6).toUpperCase();
    const code = `AREPA-${hash}-${timestamp}`;
    
    const codes = this.getAllCodes();
    codes[userId] = code;
    localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODES, JSON.stringify(codes));
    return code;
  },
  
  /**
   * Obtiene todos los códigos de referido
   * @returns {Object} - Mapa de usuarios a códigos
   */
  getAllCodes() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.REF_CODES);
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Obtiene el código de referido de un usuario
   * @param {string} userId - ID del usuario
   * @returns {string} - Código de referido
   */
  getCode(userId) {
    const codes = this.getAllCodes();
    return codes[userId] || this.generateCode(userId);
  },
  
  /**
   * Obtiene el ID del usuario a partir de un código de referido
   * @param {string} code - Código de referido
   * @returns {string|null} - ID del usuario o null
   */
  getUserIdByCode(code) {
    const codes = this.getAllCodes();
    const entry = Object.entries(codes).find(([_, c]) => c === code);
    return entry ? entry[0] : null;
  },
  
  /**
   * Aplica un código de referido a un nuevo usuario
   * @param {string} newUserId - ID del nuevo usuario
   * @param {string} referrerCode - Código del referidor
   * @returns {boolean} - Éxito de la operación
   */
  applyReferral(newUserId, referrerCode) {
    if (!referrerCode) return false;
    
    const codes = this.getAllCodes();
    const referrerId = Object.keys(codes).find(key => codes[key] === referrerCode);
    
    // Validaciones
    if (!referrerId) {
      console.warn('Código de referido inválido:', referrerCode);
      return false;
    }
    
    if (referrerId === newUserId) {
      console.warn('No puedes referirte a ti mismo');
      return false;
    }
    
    const referrals = this.getAllReferrals();
    if (referrals[referrerId] && referrals[referrerId].includes(newUserId)) {
      console.warn('Este usuario ya fue referido anteriormente');
      return false;
    }
    
    // Registrar la referencia
    if (!referrals[referrerId]) referrals[referrerId] = [];
    referrals[referrerId].push({
      userId: newUserId,
      timestamp: Date.now(),
      status: 'active'
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.REFERRALS, JSON.stringify(referrals));
    
    // Registrar el referido del nuevo usuario
    const userReferrer = this.getUserReferrer();
    if (!userReferrer[newUserId]) {
      const userReferrerMap = this.getUserReferrer();
      userReferrerMap[newUserId] = referrerId;
      localStorage.setItem('arepas_user_referrer', JSON.stringify(userReferrerMap));
    }
    
    // Recompensas usando loyalty
    const referrerReward = 5000;
    const newUserReward = 2000;
    
    import('./loyalty.js').then(({ loyalty }) => {
      loyalty.addPoints(referrerId, referrerReward);
      loyalty.addPoints(newUserId, newUserReward);
      showToast(`🎉 ¡${referrerReward} puntos por referir!`, 'success');
    }).catch(err => console.warn('Error al añadir puntos:', err));
    
    // Actualizar misiones
    import('./achievements.js').then(({ missions }) => {
      const referrerOrders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}')[referrerId] || [];
      missions.checkAndReward(referrerId, referrerOrders, this.getReferralCount(referrerId));
    }).catch(err => console.warn('Error al actualizar misiones:', err));
    
    return true;
  },
  
  /**
   * Obtiene el mapa de referidos
   * @returns {Object} - Mapa de referidos por usuario
   */
  getAllReferrals() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.REFERRALS);
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Obtiene el mapa de quién refirió a cada usuario
   * @returns {Object} - Mapa de usuario a referidor
   */
  getUserReferrer() {
    const raw = localStorage.getItem('arepas_user_referrer');
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Obtiene quién refirió a un usuario
   * @param {string} userId - ID del usuario
   * @returns {string|null} - ID del referidor o null
   */
  getReferrerByUser(userId) {
    const userReferrer = this.getUserReferrer();
    return userReferrer[userId] || null;
  },
  
  /**
   * Obtiene la cantidad de referidos de un usuario
   * @param {string} userId - ID del usuario
   * @returns {number} - Cantidad de referidos
   */
  getReferralCount(userId) {
    const referrals = this.getAllReferrals();
    return referrals[userId]?.length || 0;
  },
  
  /**
   * Obtiene la cantidad de referidos activos (que han comprado)
   * @param {string} userId - ID del usuario
   * @returns {number} - Cantidad de referidos activos
   */
  getActiveReferralCount(userId) {
    const referrals = this.getAllReferrals();
    const userReferrals = referrals[userId] || [];
    const ordersHistory = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
    
    return userReferrals.filter(ref => {
      const userOrders = ordersHistory[ref.userId];
      return userOrders && userOrders.length > 0;
    }).length;
  },
  
  /**
   * Obtiene estadísticas detalladas de referidos
   * @param {string} userId - ID del usuario
   * @returns {Object} - Estadísticas completas
   */
  getReferralStats(userId) {
    const referrals = this.getAllReferrals();
    const referredUsers = referrals[userId] || [];
    const ordersHistory = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
    
    let totalSpentByReferrals = 0;
    let totalOrdersByReferrals = 0;
    
    referredUsers.forEach(ref => {
      const userOrders = ordersHistory[ref.userId] || [];
      totalOrdersByReferrals += userOrders.length;
      totalSpentByReferrals += userOrders.reduce((sum, o) => sum + o.total, 0);
    });
    
    const activeCount = referredUsers.filter(ref => {
      const userOrders = ordersHistory[ref.userId];
      return userOrders && userOrders.length > 0;
    }).length;
    
    return {
      count: referredUsers.length,
      activeCount,
      inactiveCount: referredUsers.length - activeCount,
      users: referredUsers,
      totalPointsEarned: referredUsers.length * 5000,
      totalOrdersByReferrals,
      totalSpentByReferrals,
      averageOrderValue: totalOrdersByReferrals > 0 ? totalSpentByReferrals / totalOrdersByReferrals : 0
    };
  },
  
  /**
   * Comparte el código de referido
   * @param {string} userId - ID del usuario
   * @param {string} method - Método de compartición ('whatsapp', 'copy', 'native')
   */
  shareReferralCode(userId, method = 'native') {
    const code = this.getCode(userId);
    const message = `🔥 ¡Prueba las mejores arepas! Usa mi código ${code} y obtén ${2000} puntos de regalo. ${window.location.origin}`;
    
    switch (method) {
      case 'whatsapp':
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        break;
      case 'copy':
        copyToClipboard(message);
        showToast('📋 Código copiado al portapapeles', 'success');
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({
            title: 'Invitación a Arepas con Todo',
            text: message,
            url: window.location.origin
          }).catch(() => copyToClipboard(message));
        } else {
          copyToClipboard(message);
        }
        break;
      default:
        copyToClipboard(message);
    }
  },
  
  /**
   * Obtiene el ranking de referidos (top referidores)
   * @param {number} limit - Cantidad de resultados
   * @returns {Array} - Ranking de referidores
   */
  getReferralLeaderboard(limit = 10) {
    const referrals = this.getAllReferrals();
    const users = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USERS) || '[]');
    
    const leaderboard = Object.entries(referrals).map(([userId, refs]) => {
      const user = users.find(u => u.id === userId);
      return {
        userId,
        email: user?.email || userId,
        count: refs.length,
        activeCount: refs.filter(r => r.status === 'active').length,
        totalPoints: refs.length * 5000
      };
    });
    
    return leaderboard.sort((a, b) => b.count - a.count).slice(0, limit);
  },
  
  /**
   * Marca un referido como inactivo (si nunca compró después de X tiempo)
   * @param {string} referrerId - ID del referidor
   * @param {string} referredUserId - ID del referido
   */
  markReferralInactive(referrerId, referredUserId) {
    const referrals = this.getAllReferrals();
    const userReferrals = referrals[referrerId];
    
    if (userReferrals) {
      const referral = userReferrals.find(r => r.userId === referredUserId);
      if (referral && referral.status !== 'inactive') {
        referral.status = 'inactive';
        referral.inactiveDate = Date.now();
        localStorage.setItem(CONFIG.STORAGE_KEYS.REFERRALS, JSON.stringify(referrals));
        
        // Remover puntos si es necesario
        import('./loyalty.js').then(({ loyalty }) => {
          const currentPoints = loyalty.getPoints(referrerId);
          if (currentPoints >= 5000) {
            // Opcional: penalizar puntos por referido inactivo
            // loyalty.addPoints(referrerId, -5000);
          }
        });
      }
    }
  },
  
  /**
   * Obtiene el resumen de referidos para el panel de admin
   * @returns {Object} - Estadísticas globales
   */
  getGlobalStats() {
    const referrals = this.getAllReferrals();
    const users = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USERS) || '[]');
    
    let totalReferrals = 0;
    let totalActive = 0;
    let totalPointsDistributed = 0;
    
    Object.values(referrals).forEach(refs => {
      totalReferrals += refs.length;
      totalActive += refs.filter(r => r.status === 'active').length;
      totalPointsDistributed += refs.length * 5000;
    });
    
    const usersWithReferrals = Object.keys(referrals).length;
    const conversionRate = totalReferrals > 0 ? (totalActive / totalReferrals) * 100 : 0;
    
    return {
      totalReferrals,
      totalActive,
      totalInactive: totalReferrals - totalActive,
      usersWithReferrals,
      totalPointsDistributed,
      conversionRate: Math.round(conversionRate),
      averagePerUser: usersWithReferrals > 0 ? totalReferrals / usersWithReferrals : 0
    };
  },
  
  /**
   * Genera un enlace de invitación personalizado
   * @param {string} userId - ID del usuario
   * @returns {string} - URL de invitación
   */
  getInvitationLink(userId) {
    const code = this.getCode(userId);
    return `${window.location.origin}/index.html?ref=${code}`;
  },
  
  /**
   * Procesa un código de referido desde URL
   * @returns {string|null} - Código de referido o null
   */
  getReferralCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
  },
  
  /**
   * Valida si un código de referido es válido
   * @param {string} code - Código a validar
   * @returns {boolean} - Es válido
   */
  isValidCode(code) {
    const codes = this.getAllCodes();
    return Object.values(codes).includes(code);
  }
};
