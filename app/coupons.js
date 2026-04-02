// coupons.js
import { CONFIG } from './config.js';
import { showToast } from './utils.js';

// Importación dinámica para evitar dependencia circular
let fraudDetector;
async function loadFraudDetector() {
  try {
    fraudDetector = (await import('./fraudDetector.js')).fraudDetector;
  } catch (e) {
    console.warn('FraudDetector no disponible');
  }
}
loadFraudDetector();

export const coupons = {
  /**
   * Obtiene todos los cupones disponibles
   * @returns {Array} - Lista de cupones
   */
  getAvailableCoupons() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.COUPONS);
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Obtiene cupones activos (no expirados)
   * @returns {Array} - Cupones activos
   */
  getActiveCoupons() {
    const now = new Date();
    return this.getAvailableCoupons().filter(c => new Date(c.expires) > now);
  },
  
  /**
   * Obtiene cupones expirados
   * @returns {Array} - Cupones expirados
   */
  getExpiredCoupons() {
    const now = new Date();
    return this.getAvailableCoupons().filter(c => new Date(c.expires) <= now);
  },
  
  /**
   * Crea un nuevo cupón
   * @param {string} code - Código del cupón
   * @param {string} discountType - Tipo: 'percentage' o 'fixed'
   * @param {number} discountValue - Valor del descuento
   * @param {string|Date} expires - Fecha de expiración
   * @param {Object} options - Opciones adicionales
   */
  addCoupon(code, discountType, discountValue, expires, options = {}) {
    const coupons = this.getAvailableCoupons();
    const existing = coupons.find(c => c.code === code.toUpperCase());
    if (existing) {
      showToast(`El cupón ${code} ya existe`, 'error');
      return false;
    }
    
    const newCoupon = {
      id: Date.now(),
      code: code.toUpperCase(),
      discountType,
      discountValue,
      expires: expires instanceof Date ? expires.toISOString() : expires,
      maxUses: options.maxUses || null,
      minPurchase: options.minPurchase || 0,
      maxDiscount: options.maxDiscount || null,
      usedCount: 0,
      usedBy: [],
      createdAt: Date.now(),
      createdBy: options.createdBy || 'admin',
      description: options.description || '',
      applicableProducts: options.applicableProducts || null, // null = todos los productos
      applicableCategories: options.applicableCategories || null,
      singleUse: options.singleUse || false
    };
    
    coupons.push(newCoupon);
    localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
    showToast(`✅ Cupón ${code} creado exitosamente`, 'success');
    return true;
  },
  
  /**
   * Valida un cupón para un usuario
   * @param {string} code - Código del cupón
   * @param {string} userId - ID del usuario
   * @param {number} cartTotal - Total del carrito (opcional)
   * @param {Array} cartItems - Items del carrito (opcional)
   * @returns {Object} - Resultado de validación
   */
  validateCoupon(code, userId, cartTotal = 0, cartItems = []) {
    const coupons = this.getAvailableCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase());
    
    if (!coupon) {
      this.trackInvalidAttempt(code, userId);
      return { valid: false, reason: 'Cupón no existe' };
    }
    
    // Verificar si el usuario ya usó este cupón
    if (coupon.usedBy.includes(userId)) {
      return { valid: false, reason: 'Ya usaste este cupón' };
    }
    
    // Verificar límite de usos
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, reason: 'Cupón agotado' };
    }
    
    // Verificar expiración
    if (new Date(coupon.expires) < new Date()) {
      return { valid: false, reason: 'Cupón expirado' };
    }
    
    // Verificar monto mínimo de compra
    if (coupon.minPurchase && cartTotal < coupon.minPurchase) {
      const diff = coupon.minPurchase - cartTotal;
      return { 
        valid: false, 
        reason: `Mínimo de compra ${this.formatCurrency(coupon.minPurchase)}. Te faltan ${this.formatCurrency(diff)}` 
      };
    }
    
    // Verificar productos aplicables
    if (coupon.applicableProducts && cartItems.length > 0) {
      const hasApplicableProduct = cartItems.some(item => 
        coupon.applicableProducts.includes(item.id)
      );
      if (!hasApplicableProduct) {
        return { valid: false, reason: 'Este cupón no aplica para los productos seleccionados' };
      }
    }
    
    // Verificar categorías aplicables
    if (coupon.applicableCategories && cartItems.length > 0) {
      const hasApplicableCategory = cartItems.some(item => 
        coupon.applicableCategories.includes(item.category)
      );
      if (!hasApplicableCategory) {
        return { valid: false, reason: 'Este cupón no aplica para la categoría de tus productos' };
      }
    }
    
    return { valid: true, coupon };
  },
  
  /**
   * Aplica el descuento del cupón
   * @param {Object} coupon - Cupón a aplicar
   * @param {number} total - Total del carrito
   * @returns {number} - Total con descuento
   */
  applyDiscount(coupon, total) {
    let discountedTotal = total;
    
    if (coupon.discountType === 'percentage') {
      let discount = total * (coupon.discountValue / 100);
      // Aplicar límite máximo de descuento si existe
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      discountedTotal = total - discount;
    } else if (coupon.discountType === 'fixed') {
      let discount = coupon.discountValue;
      // Aplicar límite máximo de descuento si existe
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      discountedTotal = Math.max(0, total - discount);
    } else if (coupon.discountType === 'bogo') {
      // Buy One Get One - implementación simplificada
      discountedTotal = total * 0.5;
    } else if (coupon.discountType === 'shipping') {
      // Envío gratis - solo marcador
      discountedTotal = total;
    }
    
    return Math.max(0, discountedTotal);
  },
  
  /**
   * Marca un cupón como usado
   * @param {string} code - Código del cupón
   * @param {string} userId - ID del usuario
   * @param {number} orderId - ID de la orden (opcional)
   */
  markAsUsed(code, userId, orderId = null) {
    const coupons = this.getAvailableCoupons();
    const idx = coupons.findIndex(c => c.code === code.toUpperCase());
    
    if (idx !== -1) {
      coupons[idx].usedCount++;
      coupons[idx].usedBy.push({
        userId,
        orderId,
        usedAt: Date.now()
      });
      localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
      showToast(`🎫 Cupón ${code} aplicado`, 'success');
      return true;
    }
    return false;
  },
  
  /**
   * Registra intento inválido de cupón (para anti-fraude)
   * @param {string} code - Código intentado
   * @param {string} userId - ID del usuario
   */
  trackInvalidAttempt(code, userId) {
    if (fraudDetector) {
      fraudDetector.track('coupon_fail', userId, { code });
    }
  },
  
  /**
   * Obtiene el valor de descuento formateado
   * @param {Object} coupon - Cupón
   * @returns {string} - Descuento formateado
   */
  getDiscountFormatted(coupon) {
    if (coupon.discountType === 'percentage') {
      return `${coupon.discountValue}%`;
    } else if (coupon.discountType === 'fixed') {
      return this.formatCurrency(coupon.discountValue);
    } else if (coupon.discountType === 'bogo') {
      return '2x1';
    } else if (coupon.discountType === 'shipping') {
      return 'Envío gratis';
    }
    return '';
  },
  
  /**
   * Obtiene estadísticas de cupones
   * @returns {Object} - Estadísticas
   */
  getCouponStats() {
    const coupons = this.getAvailableCoupons();
    const now = new Date();
    
    const active = coupons.filter(c => new Date(c.expires) > now);
    const expired = coupons.filter(c => new Date(c.expires) <= now);
    const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);
    const totalDiscountGiven = this.calculateTotalDiscountGiven(coupons);
    
    const mostUsed = [...coupons].sort((a, b) => b.usedCount - a.usedCount)[0];
    const mostEffective = [...coupons]
      .filter(c => c.usedCount > 0)
      .sort((a, b) => (b.usedCount * this.getDiscountValue(b)) - (a.usedCount * this.getDiscountValue(a)))[0];
    
    return {
      total: coupons.length,
      active: active.length,
      expired: expired.length,
      totalUses,
      totalDiscountGiven,
      mostUsed: mostUsed ? { code: mostUsed.code, uses: mostUsed.usedCount } : null,
      mostEffective: mostEffective ? { code: mostEffective.code, codeId: mostEffective.id } : null,
      usageRate: coupons.length > 0 ? (totalUses / coupons.length).toFixed(2) : 0
    };
  },
  
  /**
   * Calcula el valor del descuento
   * @param {Object} coupon - Cupón
   * @returns {number} - Valor del descuento base
   */
  getDiscountValue(coupon) {
    if (coupon.discountType === 'percentage') {
      return coupon.discountValue;
    } else if (coupon.discountType === 'fixed') {
      return coupon.discountValue;
    }
    return 0;
  },
  
  /**
   * Calcula el total de descuento dado por todos los cupones
   * @param {Array} coupons - Lista de cupones
   * @returns {number} - Total de descuento
   */
  calculateTotalDiscountGiven(coupons) {
    // Estimación basada en usos
    return coupons.reduce((sum, c) => {
      if (c.discountType === 'percentage') {
        // Estimación: asumiendo pedido promedio de $30,000
        const estimatedDiscount = 30000 * (c.discountValue / 100);
        return sum + (estimatedDiscount * c.usedCount);
      } else if (c.discountType === 'fixed') {
        return sum + (c.discountValue * c.usedCount);
      }
      return sum;
    }, 0);
  },
  
  /**
   * Elimina un cupón
   * @param {string} code - Código del cupón
   * @returns {boolean} - Éxito
   */
  deleteCoupon(code) {
    const coupons = this.getAvailableCoupons();
    const filtered = coupons.filter(c => c.code !== code.toUpperCase());
    
    if (filtered.length === coupons.length) {
      showToast(`Cupón ${code} no encontrado`, 'error');
      return false;
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(filtered));
    showToast(`🗑️ Cupón ${code} eliminado`, 'info');
    return true;
  },
  
  /**
   * Edita un cupón existente
   * @param {string} code - Código actual
   * @param {Object} updates - Cambios a aplicar
   * @returns {boolean} - Éxito
   */
  editCoupon(code, updates) {
    const coupons = this.getAvailableCoupons();
    const idx = coupons.findIndex(c => c.code === code.toUpperCase());
    
    if (idx === -1) return false;
    
    coupons[idx] = { ...coupons[idx], ...updates, updatedAt: Date.now() };
    localStorage.setItem(CONFIG.STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
    showToast(`✏️ Cupón ${code} actualizado`, 'success');
    return true;
  },
  
  /**
   * Obtiene cupones aplicables a un carrito
   * @param {number} cartTotal - Total del carrito
   * @param {Array} cartItems - Items del carrito
   * @param {string} userId - ID del usuario
   * @returns {Array} - Cupones aplicables
   */
  getApplicableCoupons(cartTotal, cartItems, userId) {
    const coupons = this.getActiveCoupons();
    const applicable = [];
    
    for (const coupon of coupons) {
      const validation = this.validateCoupon(coupon.code, userId, cartTotal, cartItems);
      if (validation.valid) {
        applicable.push({
          ...coupon,
          discountFormatted: this.getDiscountFormatted(coupon),
          savings: this.calculateSavings(coupon, cartTotal)
        });
      }
    }
    
    return applicable.sort((a, b) => b.savings - a.savings);
  },
  
  /**
   * Calcula el ahorro que genera un cupón
   * @param {Object} coupon - Cupón
   * @param {number} cartTotal - Total del carrito
   * @returns {number} - Ahorro estimado
   */
  calculateSavings(coupon, cartTotal) {
    const discounted = this.applyDiscount(coupon, cartTotal);
    return cartTotal - discounted;
  },
  
  /**
   * Obtiene cupones por tipo
   * @param {string} discountType - Tipo de descuento
   * @returns {Array} - Cupones filtrados
   */
  getCouponsByType(discountType) {
    return this.getAvailableCoupons().filter(c => c.discountType === discountType);
  },
  
  /**
   * Obtiene cupones creados por un usuario
   * @param {string} createdBy - ID del creador
   * @returns {Array} - Cupones del creador
   */
  getCouponsByCreator(createdBy) {
    return this.getAvailableCoupons().filter(c => c.createdBy === createdBy);
  },
  
  /**
   * Obtiene el historial de uso de un cupón
   * @param {string} code - Código del cupón
   * @returns {Array} - Historial de usos
   */
  getCouponUsageHistory(code) {
    const coupons = this.getAvailableCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase());
    return coupon?.usedBy || [];
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
   * Genera un código de cupón aleatorio
   * @param {number} length - Longitud del código
   * @returns {string} - Código generado
   */
  generateRandomCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  },
  
  /**
   * Crea cupones masivos (batch)
   * @param {Object} template - Plantilla del cupón
   * @param {number} count - Cantidad a crear
   * @returns {Array} - Códigos generados
   */
  createBatchCoupons(template, count) {
    const generated = [];
    for (let i = 0; i < count; i++) {
      const code = `${template.prefix || ''}${this.generateRandomCode(6)}${template.suffix || ''}`;
      this.addCoupon(
        code,
        template.discountType,
        template.discountValue,
        template.expires,
        {
          maxUses: template.maxUses || 1,
          minPurchase: template.minPurchase || 0,
          description: template.description || `Cupón batch ${i + 1}`,
          singleUse: true
        }
      );
      generated.push(code);
    }
    showToast(`✅ ${count} cupones creados exitosamente`, 'success');
    return generated;
  }
};
