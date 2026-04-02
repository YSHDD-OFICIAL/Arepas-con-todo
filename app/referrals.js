// referrals.js
import { CONFIG } from './config.js';

export const referrals = {
  generateCode(userId) {
    const code = `AREPA-${userId.slice(-6).toUpperCase()}`;
    const codes = this.getAllCodes();
    codes[userId] = code;
    localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODES, JSON.stringify(codes));
    return code;
  },
  
  getAllCodes() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.REF_CODES);
    return raw ? JSON.parse(raw) : {};
  },
  
  getCode(userId) {
    const codes = this.getAllCodes();
    return codes[userId] || this.generateCode(userId);
  },
  
  applyReferral(newUserId, referrerCode) {
    const codes = this.getAllCodes();
    const referrerId = Object.keys(codes).find(key => codes[key] === referrerCode);
    if (!referrerId || referrerId === newUserId) return false;
    
    const referrals = this.getAllReferrals();
    if (!referrals[referrerId]) referrals[referrerId] = [];
    if (referrals[referrerId].includes(newUserId)) return false;
    
    referrals[referrerId].push(newUserId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.REFERRALS, JSON.stringify(referrals));
    
    // Recompensas usando loyalty
    import('./loyalty.js').then(({ loyalty }) => {
      loyalty.addPoints(referrerId, 5000);
      loyalty.addPoints(newUserId, 2000);
    });
    
    // Actualizar misiones
    import('./achievements.js').then(({ missions }) => {
      const referrerOrders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}')[referrerId] || [];
      missions.checkAndReward(referrerId, referrerOrders, referrals[referrerId].length);
    });
    
    return true;
  },
  
  getAllReferrals() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.REFERRALS);
    return raw ? JSON.parse(raw) : {};
  },
  
  getReferralCount(userId) {
    const referrals = this.getAllReferrals();
    return referrals[userId]?.length || 0;
  },
  
  getReferralStats(userId) {
    const referrals = this.getAllReferrals();
    const referredUsers = referrals[userId] || [];
    return {
      count: referredUsers.length,
      users: referredUsers,
      totalPointsEarned: referredUsers.length * 5000
    };
  }
};