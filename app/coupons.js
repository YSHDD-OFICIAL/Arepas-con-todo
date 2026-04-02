// coupons.js
import { CONFIG } from './config.js';
import { fraudDetector } from './fraudDetector.js';

export const coupons = {
  getAvailableCoupons() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.COUPONS);
    return raw ? JSON.parse(raw) : [];
  },
  
  addCoupon(code, discountType, discountValue, expires, maxUses = null) {
    const coupons = this.getAvailableCoupons();
    coupons.push({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      expires,
      maxUses,
      usedCount: 0,
      usedBy: [],
      createdAt: Date.now()
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
  },
  
  validateCoupon(code, userId) {
    const coupons = this.getAvailableCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase());
    
    if (!coupon) return null;
    if (coupon.usedBy.includes(userId)) return { valid: false, reason: 'Ya usaste este cupón' };
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return { valid: false, reason: 'Cupón agotado' };
    if (new Date(coupon.expires) < new Date()) return { valid: false, reason: 'Cupón expirado' };
    
    return { valid: true, coupon };
  },
  
  applyDiscount(coupon, total) {
    if (coupon.discountType === 'percentage') {
      return total * (1 - coupon.discountValue / 100);
    } else if (coupon.discountType === 'fixed') {
      return Math.max(0, total - coupon.discountValue);
    }
    return total;
  },
  
  markAsUsed(code, userId) {
    const coupons = this.getAvailableCoupons();
    const idx = coupons.findIndex(c => c.code === code.toUpperCase());
    if (idx !== -1) {
      coupons[idx].usedCount++;
      coupons[idx].usedBy.push(userId);
      localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
    }
  },
  
  getCouponStats() {
    const coupons = this.getAvailableCoupons();
    return {
      total: coupons.length,
      active: coupons.filter(c => new Date(c.expires) > new Date()).length,
      mostUsed: coupons.sort((a, b) => b.usedCount - a.usedCount)[0]
    };
  },
  
  deleteCoupon(code) {
    const coupons = this.getAvailableCoupons();
    const filtered = coupons.filter(c => c.code !== code.toUpperCase());
    localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(filtered));
  }
};