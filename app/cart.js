// cart.js
import { CONFIG, FEATURES } from './config.js';
import { db } from './database.js';
import { auth } from './auth.js';
import { showVibration, showToast } from './utils.js';

// Importaciones dinámicas para evitar errores circulares
let fraudDetector, inventory;

async function loadModules() {
  if (FEATURES.fraudDetection) {
    try {
      fraudDetector = (await import('./fraudDetector.js')).fraudDetector;
    } catch (e) {
      console.warn('Error loading fraudDetector:', e);
    }
  }
  if (FEATURES.inventory) {
    try {
      inventory = (await import('./inventory.js')).inventory;
    } catch (e) {
      console.warn('Error loading inventory:', e);
    }
  }
}
loadModules();

export const cart = {
  /**
   * Obtiene el contenido actual del carrito
   * @returns {Array} - Lista de productos en el carrito
   */
  getCart() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CART);
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Obtiene la cantidad total de items en el carrito
   * @returns {number} - Cantidad total de items
   */
  getItemCount() {
    return this.getCart().reduce((acc, item) => acc + item.quantity, 0);
  },
  
  /**
   * Agrega un producto al carrito
   * @param {Object} product - Producto a agregar
   * @param {number} quantity - Cantidad
   * @returns {boolean} - Éxito de la operación
   */
  addToCart(product, quantity = 1) {
    // Validaciones
    if (!product || !product.id) {
      console.warn('Producto inválido');
      return false;
    }
    
    if (quantity <= 0) {
      return false;
    }
    
    // Verificar límite máximo
    const currentCount = this.getItemCount();
    if (currentCount + quantity > CONFIG.MAX_CART_ITEMS) {
      showToast(`Máximo ${CONFIG.MAX_CART_ITEMS} items por pedido`, 'warning');
      return false;
    }
    
    // Verificar inventario
    if (FEATURES.inventory && inventory) {
      const available = inventory.getStock(product.id);
      const currentInCart = this.getQuantityInCart(product.id);
      const totalNeeded = currentInCart + quantity;
      
      if (available < totalNeeded) {
        const availableToAdd = Math.max(0, available - currentInCart);
        if (availableToAdd === 0) {
          showToast(`❌ ${product.name} no disponible`, 'error');
          return false;
        } else {
          showToast(`⚠️ Solo ${availableToAdd} unidades disponibles de ${product.name}`, 'warning');
          quantity = availableToAdd;
        }
      }
    }
    
    const current = this.getCart();
    const existing = current.find(item => item.id === product.id);
    
    if (existing) {
      existing.quantity += quantity;
    } else {
      current.push({ ...product, quantity });
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
    
    if (FEATURES.vibrations) {
      showVibration(50);
    }
    
    this.updateCartBadge();
    showToast(`➕ ${quantity}x ${product.name} agregado`, 'success');
    
    // Track para detección de fraude
    if (FEATURES.fraudDetection && fraudDetector) {
      const session = auth.getSession();
      fraudDetector.track('cart_change', session?.userId);
    }
    
    return true;
  },
  
  /**
   * Obtiene la cantidad de un producto específico en el carrito
   * @param {string} productId - ID del producto
   * @returns {number} - Cantidad en el carrito
   */
  getQuantityInCart(productId) {
    const current = this.getCart();
    const item = current.find(i => i.id === productId);
    return item ? item.quantity : 0;
  },
  
  /**
   * Elimina un producto del carrito
   * @param {string} productId - ID del producto a eliminar
   */
  removeItem(productId) {
    const product = this.getCart().find(item => item.id === productId);
    if (!product) return;
    
    let current = this.getCart();
    current = current.filter(item => item.id !== productId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
    this.updateCartBadge();
    showToast(`🗑️ ${product.name} eliminado`, 'info');
  },
  
  /**
   * Actualiza la cantidad de un producto
   * @param {string} productId - ID del producto
   * @param {number} delta - Cambio en la cantidad (+1 o -1)
   */
  updateQuantity(productId, delta) {
    const current = this.getCart();
    const item = current.find(i => i.id === productId);
    
    if (item) {
      const newQuantity = item.quantity + delta;
      
      if (newQuantity <= 0) {
        this.removeItem(productId);
      } else if (newQuantity > 99) {
        showToast('Cantidad máxima 99 unidades', 'warning');
      } else {
        // Verificar inventario si es aumento
        if (delta > 0 && FEATURES.inventory && inventory) {
          const available = inventory.getStock(productId);
          if (available < newQuantity) {
            showToast(`⚠️ Solo ${available} unidades disponibles`, 'warning');
            return;
          }
        }
        
        item.quantity = newQuantity;
        localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
        this.updateCartBadge();
        
        if (FEATURES.vibrations) {
          showVibration(30);
        }
      }
    }
  },
  
  /**
   * Calcula el subtotal del carrito (sin descuentos)
   * @returns {number} - Subtotal
   */
  subtotal() {
    return this.getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },
  
  /**
   * Calcula el total del carrito (alias de subtotal)
   * @returns {number} - Total
   */
  total() {
    return this.subtotal();
  },
  
  /**
   * Vacía completamente el carrito
   */
  clearCart() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CART);
    this.updateCartBadge();
    showToast('🛒 Carrito vaciado', 'info');
  },
  
  /**
   * Actualiza el badge del carrito en la UI
   */
  updateCartBadge() {
    const count = this.getItemCount();
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.innerText = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  },
  
  /**
   * Guarda el pedido actual en el historial
   * @returns {Object|null} - Orden guardada o null
   */
  saveLastOrder() {
    const session = auth.getSession();
    if (!session) return null;
    
    const cartItems = this.getCart();
    if (cartItems.length === 0) return null;
    
    const order = {
      id: Date.now(),
      items: JSON.parse(JSON.stringify(cartItems)), // Clonar para evitar referencias
      subtotal: this.subtotal(),
      total: this.total(),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    db.saveOrder(session.userId, order);
    db.addPendingOrder({ ...order, userId: session.userId, userEmail: session.email });
    
    // Descontar inventario
    if (FEATURES.inventory && inventory) {
      cartItems.forEach(item => {
        inventory.decreaseStock(item.id, item.quantity);
      });
    }
    
    return order;
  },
  
  /**
   * Obtiene el último pedido del usuario
   * @returns {Object|null} - Último pedido o null
   */
  getLastOrder() {
    const session = auth.getSession();
    if (!session) return null;
    const orders = db.getOrdersHistory(session.userId);
    return orders[0] || null;
  },
  
  /**
   * Repite el último pedido realizado
   */
  repeatLastOrder() {
    const last = this.getLastOrder();
    if (last && last.items && last.items.length > 0) {
      // Verificar disponibilidad de inventario
      let allAvailable = true;
      const unavailableItems = [];
      
      if (FEATURES.inventory && inventory) {
        for (const item of last.items) {
          if (!inventory.isAvailable(item.id, item.quantity)) {
            allAvailable = false;
            unavailableItems.push(item.name);
          }
        }
      }
      
      if (!allAvailable) {
        showToast(`❌ Productos no disponibles: ${unavailableItems.join(', ')}`, 'error');
        return;
      }
      
      localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(last.items));
      this.updateCartBadge();
      showToast('🔄 Pedido anterior repetido', 'success');
      window.location.href = 'carrito.html';
    } else {
      showToast('No hay pedido previo', 'warning');
    }
  },
  
  /**
   * Obtiene un resumen del carrito
   * @returns {Object} - Resumen con items, total y cantidad
   */
  getSummary() {
    const items = this.getCart();
    return {
      items,
      itemCount: this.getItemCount(),
      subtotal: this.subtotal(),
      total: this.total()
    };
  },
  
  /**
   * Verifica si el carrito está vacío
   * @returns {boolean}
   */
  isEmpty() {
    return this.getItemCount() === 0;
  },
  
  /**
   * Obtiene el valor de envío (si aplica)
   * @returns {number}
   */
  getShippingCost() {
    const subtotal = this.subtotal();
    if (subtotal >= CONFIG.FREE_DELIVERY_AMOUNT) return 0;
    return 5000; // Costo base de envío
  },
  
  /**
   * Calcula el total incluyendo envío
   * @returns {number}
   */
  getTotalWithShipping() {
    return this.total() + this.getShippingCost();
  },
  
  /**
   * Aplica un cupón de descuento al carrito
   * @param {Object} coupon - Cupón a aplicar
   * @returns {number} - Total con descuento
   */
  applyCoupon(coupon) {
    if (!coupon) return this.total();
    
    let discount = 0;
    const subtotal = this.subtotal();
    
    if (coupon.discountType === 'percentage') {
      discount = subtotal * (coupon.discountValue / 100);
    } else if (coupon.discountType === 'fixed') {
      discount = Math.min(coupon.discountValue, subtotal);
    }
    
    return subtotal - discount;
  },
  
  /**
   * Aplica puntos de descuento
   * @param {number} pointsValue - Valor en pesos del descuento por puntos
   * @returns {number} - Total con descuento
   */
  applyPointsDiscount(pointsValue) {
    const subtotal = this.subtotal();
    return Math.max(0, subtotal - pointsValue);
  }
};
