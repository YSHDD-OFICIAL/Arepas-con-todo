// inventory.js
import { CONFIG } from './config.js';
import { db } from './database.js';

export const inventory = {
  getStock(productId) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.INVENTORY);
    const stock = data ? JSON.parse(data) : {};
    // Si no existe, usar stock por defecto del producto
    if (stock[productId] === undefined) {
      const products = db.getProducts();
      const product = products.find(p => p.id === productId);
      return product?.stock || 999;
    }
    return stock[productId];
  },
  
  setStock(productId, quantity) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.INVENTORY);
    const stock = data ? JSON.parse(data) : {};
    stock[productId] = Math.max(0, quantity);
    localStorage.setItem(CONFIG.STORAGE_KEYS.INVENTORY, JSON.stringify(stock));
    
    // Notificar si está bajo stock
    if (quantity <= 5) {
      this.notifyLowStock(productId, quantity);
    }
  },
  
  decreaseStock(productId, quantity = 1) {
    const current = this.getStock(productId);
    if (current < quantity) return false;
    this.setStock(productId, current - quantity);
    return true;
  },
  
  increaseStock(productId, quantity = 1) {
    const current = this.getStock(productId);
    this.setStock(productId, current + quantity);
    return true;
  },
  
  isAvailable(productId, quantity = 1) {
    return this.getStock(productId) >= quantity;
  },
  
  getAllStock() {
    const products = db.getProducts();
    const stockMap = {};
    products.forEach(p => {
      stockMap[p.id] = this.getStock(p.id);
    });
    return stockMap;
  },
  
  notifyLowStock(productId, quantity) {
    if (Notification.permission === 'granted') {
      const products = db.getProducts();
      const product = products.find(p => p.id === productId);
      new Notification('⚠️ Stock bajo', {
        body: `${product?.name} tiene solo ${quantity} unidades restantes`
      });
    }
    // Guardar alerta para admin
    const alerts = JSON.parse(localStorage.getItem('low_stock_alerts') || '[]');
    alerts.push({ productId, quantity, timestamp: Date.now() });
    localStorage.setItem('low_stock_alerts', JSON.stringify(alerts.slice(-10)));
  },
  
  getLowStockAlerts() {
    return JSON.parse(localStorage.getItem('low_stock_alerts') || '[]');
  }
};