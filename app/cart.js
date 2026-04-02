// cart.js
import { CONFIG, FEATURES } from './config.js';
import { db } from './database.js';
import { auth } from './auth.js';
import { showVibration } from './utils.js';
import { fraudDetector } from './fraudDetector.js';
import { inventory } from './inventory.js';

export const cart = {
  getCart() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CART);
    return raw ? JSON.parse(raw) : [];
  },
  
  addToCart(product, quantity = 1) {
    // Verificar inventario
    if (FEATURES.inventory && !inventory.isAvailable(product.id, quantity)) {
      alert('Producto agotado');
      return false;
    }
    
    const current = this.getCart();
    const existing = current.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      current.push({ ...product, quantity });
    }
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
    showVibration();
    this.updateCartBadge();
    
    // Track para detección de fraude
    if (FEATURES.fraudDetection) {
      const session = auth.getSession();
      fraudDetector.track('cart_change', session?.userId);
    }
    
    return true;
  },
  
  removeItem(productId) {
    let current = this.getCart();
    current = current.filter(item => item.id !== productId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
    this.updateCartBadge();
  },
  
  updateQuantity(productId, delta) {
    const current = this.getCart();
    const item = current.find(i => i.id === productId);
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) this.removeItem(productId);
      else localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(current));
    }
    this.updateCartBadge();
  },
  
  total() {
    return this.getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },
  
  clearCart() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CART);
    this.updateCartBadge();
  },
  
  updateCartBadge() {
    const count = this.getCart().reduce((acc, i) => acc + i.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = count;
  },
  
  saveLastOrder() {
    const session = auth.getSession();
    if (!session) return;
    const order = {
      id: Date.now(),
      items: this.getCart(),
      total: this.total(),
      timestamp: new Date().toISOString()
    };
    db.saveOrder(session.userId, order);
    db.addPendingOrder({ ...order, userId: session.userId, userEmail: session.email });
    
    // Descontar inventario
    if (FEATURES.inventory) {
      this.getCart().forEach(item => {
        inventory.decreaseStock(item.id, item.quantity);
      });
    }
  },
  
  getLastOrder() {
    const session = auth.getSession();
    if (!session) return null;
    const orders = db.getOrdersHistory(session.userId);
    return orders[0] || null;
  },
  
  repeatLastOrder() {
    const last = this.getLastOrder();
    if (last && last.items) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(last.items));
      this.updateCartBadge();
      window.location.href = 'carrito.html';
    } else {
      alert('No hay pedido previo');
    }
  }
};