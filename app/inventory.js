// inventory.js
import { CONFIG } from './config.js';
import { db } from './database.js';
import { showToast } from './utils.js';

export const inventory = {
  /**
   * Obtiene el stock actual de un producto
   * @param {string} productId - ID del producto
   * @returns {number} - Cantidad en stock
   */
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
  
  /**
   * Establece el stock de un producto
   * @param {string} productId - ID del producto
   * @param {number} quantity - Nueva cantidad
   */
  setStock(productId, quantity) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.INVENTORY);
    const stock = data ? JSON.parse(data) : {};
    const oldQuantity = stock[productId] || this.getStock(productId);
    const newQuantity = Math.max(0, quantity);
    
    stock[productId] = newQuantity;
    localStorage.setItem(CONFIG.STORAGE_KEYS.INVENTORY, JSON.stringify(stock));
    
    // Registrar cambio en historial
    this.logStockChange(productId, oldQuantity, newQuantity);
    
    // Notificar según estado
    if (newQuantity <= 5 && newQuantity > 0) {
      this.notifyLowStock(productId, newQuantity);
    } else if (newQuantity === 0) {
      this.notifyOutOfStock(productId);
    } else if (oldQuantity <= 5 && newQuantity > 5) {
      this.notifyRestocked(productId);
    }
  },
  
  /**
   * Disminuye el stock de un producto
   * @param {string} productId - ID del producto
   * @param {number} quantity - Cantidad a disminuir
   * @returns {boolean} - Éxito de la operación
   */
  decreaseStock(productId, quantity = 1) {
    const current = this.getStock(productId);
    if (current < quantity) {
      showToast(`Stock insuficiente de ${this.getProductName(productId)}`, 'error');
      return false;
    }
    this.setStock(productId, current - quantity);
    return true;
  },
  
  /**
   * Aumenta el stock de un producto
   * @param {string} productId - ID del producto
   * @param {number} quantity - Cantidad a aumentar
   * @returns {boolean} - Éxito de la operación
   */
  increaseStock(productId, quantity = 1) {
    const current = this.getStock(productId);
    this.setStock(productId, current + quantity);
    return true;
  },
  
  /**
   * Verifica si un producto está disponible
   * @param {string} productId - ID del producto
   * @param {number} quantity - Cantidad requerida
   * @returns {boolean} - Está disponible
   */
  isAvailable(productId, quantity = 1) {
    return this.getStock(productId) >= quantity;
  },
  
  /**
   * Obtiene todos los stocks
   * @returns {Object} - Mapa de productos a stock
   */
  getAllStock() {
    const products = db.getProducts();
    const stockMap = {};
    products.forEach(p => {
      stockMap[p.id] = {
        stock: this.getStock(p.id),
        name: p.name,
        price: p.price,
        category: p.category
      };
    });
    return stockMap;
  },
  
  /**
   * Obtiene productos con stock bajo
   * @param {number} threshold - Umbral de stock bajo
   * @returns {Array} - Productos con stock bajo
   */
  getLowStockProducts(threshold = 10) {
    const products = db.getProducts();
    return products
      .filter(p => this.getStock(p.id) <= threshold)
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: this.getStock(p.id),
        threshold
      }));
  },
  
  /**
   * Obtiene productos agotados
   * @returns {Array} - Productos sin stock
   */
  getOutOfStockProducts() {
    const products = db.getProducts();
    return products
      .filter(p => this.getStock(p.id) === 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: 0
      }));
  },
  
  /**
   * Obtiene productos con stock alto (para promociones)
   * @param {number} threshold - Umbral de stock alto
   * @returns {Array} - Productos con stock alto
   */
  getHighStockProducts(threshold = 50) {
    const products = db.getProducts();
    return products
      .filter(p => this.getStock(p.id) >= threshold)
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: this.getStock(p.id),
        suggestedDiscount: this.suggestDiscount(p.id)
      }));
  },
  
  /**
   * Sugiere un descuento para productos con exceso de stock
   * @param {string} productId - ID del producto
   * @returns {number} - Descuento sugerido (%)
   */
  suggestDiscount(productId) {
    const stock = this.getStock(productId);
    const product = db.getProducts().find(p => p.id === productId);
    
    if (!product) return 0;
    
    const normalStock = product.stock || 50;
    const excessRatio = stock / normalStock;
    
    if (excessRatio > 2) return 20;
    if (excessRatio > 1.5) return 15;
    if (excessRatio > 1.2) return 10;
    return 0;
  },
  
  /**
   * Obtiene el nombre de un producto
   * @param {string} productId - ID del producto
   * @returns {string} - Nombre del producto
   */
  getProductName(productId) {
    const products = db.getProducts();
    const product = products.find(p => p.id === productId);
    return product?.name || 'Producto';
  },
  
  /**
   * Registra un cambio de stock en el historial
   * @param {string} productId - ID del producto
   * @param {number} oldStock - Stock anterior
   * @param {number} newStock - Stock nuevo
   */
  logStockChange(productId, oldStock, newStock) {
    const log = this.getStockLog();
    log.unshift({
      productId,
      productName: this.getProductName(productId),
      oldStock,
      newStock,
      change: newStock - oldStock,
      timestamp: Date.now()
    });
    
    // Mantener solo últimos 100 registros
    localStorage.setItem('arepas_stock_log', JSON.stringify(log.slice(0, 100)));
  },
  
  /**
   * Obtiene el historial de cambios de stock
   * @returns {Array} - Historial de cambios
   */
  getStockLog() {
    const raw = localStorage.getItem('arepas_stock_log');
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Notifica stock bajo
   * @param {string} productId - ID del producto
   * @param {number} quantity - Cantidad actual
   */
  notifyLowStock(productId, quantity) {
    const productName = this.getProductName(productId);
    
    if (Notification.permission === 'granted') {
      new Notification('⚠️ Stock bajo', {
        body: `${productName} tiene solo ${quantity} unidades restantes`,
        icon: '/assets/icons/icon-192.png'
      });
    }
    
    // Guardar alerta para admin
    const alerts = this.getLowStockAlerts();
    alerts.unshift({ 
      productId, 
      productName,
      quantity, 
      timestamp: Date.now(),
      resolved: false
    });
    localStorage.setItem('low_stock_alerts', JSON.stringify(alerts.slice(0, 50)));
    
    // Mostrar toast si el admin está logueado
    const session = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION) || '{}');
    if (session.email === CONFIG.ADMIN_EMAIL) {
      showToast(`⚠️ Stock bajo: ${productName} (${quantity} uds.)`, 'warning');
    }
  },
  
  /**
   * Notifica producto agotado
   * @param {string} productId - ID del producto
   */
  notifyOutOfStock(productId) {
    const productName = this.getProductName(productId);
    
    if (Notification.permission === 'granted') {
      new Notification('❌ Producto agotado', {
        body: `${productName} se ha agotado. ¡Reabastece pronto!`,
        icon: '/assets/icons/icon-192.png'
      });
    }
    
    const alerts = this.getLowStockAlerts();
    alerts.unshift({ 
      productId, 
      productName,
      quantity: 0,
      timestamp: Date.now(),
      resolved: false,
      type: 'out_of_stock'
    });
    localStorage.setItem('low_stock_alerts', JSON.stringify(alerts.slice(0, 50)));
  },
  
  /**
   * Notifica producto reabastecido
   * @param {string} productId - ID del producto
   */
  notifyRestocked(productId) {
    const productName = this.getProductName(productId);
    
    if (Notification.permission === 'granted') {
      new Notification('✅ Producto reabastecido', {
        body: `${productName} ya está disponible nuevamente`,
        icon: '/assets/icons/icon-192.png'
      });
    }
  },
  
  /**
   * Obtiene alertas de stock bajo
   * @param {boolean} onlyUnresolved - Solo no resueltas
   * @returns {Array} - Alertas de stock
   */
  getLowStockAlerts(onlyUnresolved = true) {
    const raw = localStorage.getItem('low_stock_alerts');
    const alerts = raw ? JSON.parse(raw) : [];
    return onlyUnresolved ? alerts.filter(a => !a.resolved) : alerts;
  },
  
  /**
   * Marca una alerta como resuelta
   * @param {number} index - Índice de la alerta
   */
  resolveAlert(index) {
    const alerts = this.getLowStockAlerts(false);
    if (alerts[index]) {
      alerts[index].resolved = true;
      alerts[index].resolvedAt = Date.now();
      localStorage.setItem('low_stock_alerts', JSON.stringify(alerts));
    }
  },
  
  /**
   * Obtiene estadísticas de inventario
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const products = db.getProducts();
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;
    
    products.forEach(p => {
      const stock = this.getStock(p.id);
      totalStock += stock;
      totalValue += stock * p.price;
      if (stock <= 5 && stock > 0) lowStockCount++;
      if (stock === 0) outOfStockCount++;
    });
    
    return {
      totalProducts: products.length,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalValue,
      averageStock: totalStock / products.length,
      healthyStockCount: products.length - lowStockCount - outOfStockCount
    };
  },
  
  /**
   * Reinicia el inventario a valores por defecto
   */
  resetInventory() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.INVENTORY);
    localStorage.removeItem('low_stock_alerts');
    localStorage.removeItem('arepas_stock_log');
    showToast('📦 Inventario reiniciado', 'success');
  },
  
  /**
   * Obtiene recomendaciones de reabastecimiento
   * @returns {Array} - Productos recomendados para reabastecer
   */
  getRestockRecommendations() {
    const products = db.getProducts();
    const salesHistory = this.getSalesHistory();
    
    return products
      .map(p => {
        const stock = this.getStock(p.id);
        const weeklySales = this.getWeeklySales(p.id, salesHistory);
        const daysUntilOut = weeklySales > 0 ? Math.floor(stock / weeklySales) : 999;
        
        return {
          id: p.id,
          name: p.name,
          currentStock: stock,
          weeklySales,
          daysUntilOut,
          recommended: daysUntilOut <= 3,
          urgency: daysUntilOut <= 1 ? 'high' : daysUntilOut <= 3 ? 'medium' : 'low',
          suggestedQuantity: Math.max(20, weeklySales * 2)
        };
      })
      .filter(r => r.recommended)
      .sort((a, b) => a.daysUntilOut - b.daysUntilOut);
  },
  
  /**
   * Obtiene historial de ventas para análisis
   * @returns {Array} - Historial de ventas
   */
  getSalesHistory() {
    const orders = db.getAllOrders();
    const salesMap = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!salesMap[item.id]) salesMap[item.id] = [];
        salesMap[item.id].push({
          quantity: item.quantity,
          timestamp: order.timestamp
        });
      });
    });
    
    return salesMap;
  },
  
  /**
   * Obtiene ventas semanales de un producto
   * @param {string} productId - ID del producto
   * @param {Object} salesHistory - Historial de ventas
   * @returns {number} - Ventas en los últimos 7 días
   */
  getWeeklySales(productId, salesHistory) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600000;
    const sales = salesHistory[productId] || [];
    
    const recentSales = sales.filter(s => new Date(s.timestamp).getTime() > sevenDaysAgo);
    return recentSales.reduce((sum, s) => sum + s.quantity, 0);
  }
};
