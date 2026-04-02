// database.js
import { CONFIG } from './config.js';

export const db = {
  // ==================== USUARIOS ====================
  
  getUsers() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  
  saveUsers(users) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  
  getUserById(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  },
  
  getUserByEmail(email) {
    const users = this.getUsers();
    return users.find(u => u.email === email) || null;
  },
  
  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.saveUsers(users);
      return true;
    }
    return false;
  },
  
  deleteUser(userId) {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    this.saveUsers(filtered);
    return filtered.length !== users.length;
  },
  
  // ==================== PRODUCTOS ====================
  
  getProducts() {
    let products = localStorage.getItem('arepas_products');
    if (!products) {
      localStorage.setItem('arepas_products', JSON.stringify(CONFIG.DEFAULT_PRODUCTS));
      return CONFIG.DEFAULT_PRODUCTS;
    }
    return JSON.parse(products);
  },
  
  saveProducts(products) {
    localStorage.setItem('arepas_products', JSON.stringify(products));
  },
  
  getProductById(productId) {
    const products = this.getProducts();
    return products.find(p => p.id === productId) || null;
  },
  
  getProductsByCategory(category) {
    const products = this.getProducts();
    return products.filter(p => p.category === category);
  },
  
  searchProducts(query) {
    const products = this.getProducts();
    const searchTerm = query.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm)
    );
  },
  
  addProduct(product) {
    const products = this.getProducts();
    products.push(product);
    this.saveProducts(products);
    return product;
  },
  
  updateProduct(productId, updates) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      this.saveProducts(products);
      return true;
    }
    return false;
  },
  
  deleteProduct(productId) {
    const products = this.getProducts();
    const filtered = products.filter(p => p.id !== productId);
    this.saveProducts(filtered);
    return filtered.length !== products.length;
  },
  
  // ==================== FAVORITOS ====================
  
  getFavorites(userId) {
    const favs = localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES);
    const all = favs ? JSON.parse(favs) : {};
    return all[userId] || [];
  },
  
  saveFavorite(userId, productId, isFavorite) {
    const favs = localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES);
    let all = favs ? JSON.parse(favs) : {};
    if (!all[userId]) all[userId] = [];
    if (isFavorite && !all[userId].includes(productId)) {
      all[userId].push(productId);
    } else if (!isFavorite) {
      all[userId] = all[userId].filter(id => id !== productId);
    }
    localStorage.setItem(CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(all));
  },
  
  toggleFavorite(userId, productId) {
    const favorites = this.getFavorites(userId);
    const isFavorite = favorites.includes(productId);
    this.saveFavorite(userId, productId, !isFavorite);
    return !isFavorite;
  },
  
  getFavoriteProducts(userId) {
    const favorites = this.getFavorites(userId);
    const products = this.getProducts();
    return products.filter(p => favorites.includes(p.id));
  },
  
  // ==================== ÓRDENES ====================
  
  getOrdersHistory(userId) {
    const orders = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY);
    const all = orders ? JSON.parse(orders) : {};
    return all[userId] || [];
  },
  
  saveOrder(userId, order) {
    const orders = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY);
    let all = orders ? JSON.parse(orders) : {};
    if (!all[userId]) all[userId] = [];
    all[userId].unshift(order); // Más reciente primero
    localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY, JSON.stringify(all));
  },
  
  getOrderById(userId, orderId) {
    const orders = this.getOrdersHistory(userId);
    return orders.find(o => o.id === orderId) || null;
  },
  
  getLastOrder(userId) {
    const orders = this.getOrdersHistory(userId);
    return orders[0] || null;
  },
  
  getOrdersByDateRange(userId, startDate, endDate) {
    const orders = this.getOrdersHistory(userId);
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return orders.filter(o => {
      const orderDate = new Date(o.timestamp).getTime();
      return orderDate >= start && orderDate <= end;
    });
  },
  
  getTotalSpent(userId) {
    const orders = this.getOrdersHistory(userId);
    return orders.reduce((total, order) => total + order.total, 0);
  },
  
  getOrderCount(userId) {
    return this.getOrdersHistory(userId).length;
  },
  
  // ==================== ÓRDENES PENDIENTES ====================
  
  getPendingOrders() {
    const pending = localStorage.getItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS);
    return pending ? JSON.parse(pending) : [];
  },
  
  addPendingOrder(order) {
    const pending = this.getPendingOrders();
    pending.push({ ...order, status: 'pending', addedAt: Date.now() });
    localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
  },
  
  updatePendingOrder(orderId, updates) {
    const pending = this.getPendingOrders();
    const index = pending.findIndex(o => o.id === orderId);
    if (index !== -1) {
      pending[index] = { ...pending[index], ...updates };
      localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
      return true;
    }
    return false;
  },
  
  removePendingOrder(orderId) {
    const pending = this.getPendingOrders();
    const filtered = pending.filter(o => o.id !== orderId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify(filtered));
    return filtered.length !== pending.length;
  },
  
  clearPendingOrders() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify([]));
  },
  
  // ==================== TODAS LAS ÓRDENES (Global) ====================
  
  getAllOrders() {
    const allOrders = [];
    const ordersData = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY);
    if (ordersData) {
      const orders = JSON.parse(ordersData);
      Object.values(orders).forEach(userOrders => {
        allOrders.push(...userOrders);
      });
    }
    return allOrders;
  },
  
  getGlobalOrderStats() {
    const orders = this.getAllOrders();
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      totalOrders,
      totalRevenue,
      averageOrder
    };
  },
  
  getOrdersByDate(date) {
    const orders = this.getAllOrders();
    const targetDate = new Date(date).toDateString();
    return orders.filter(o => new Date(o.timestamp).toDateString() === targetDate);
  },
  
  getTodayOrders() {
    return this.getOrdersByDate(new Date());
  },
  
  getThisWeekOrders() {
    const orders = this.getAllOrders();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    return orders.filter(o => new Date(o.timestamp) >= startOfWeek);
  },
  
  getThisMonthOrders() {
    const orders = this.getAllOrders();
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    return orders.filter(o => new Date(o.timestamp) >= startOfMonth);
  },
  
  // ==================== LIMPIEZA Y MANTENIMIENTO ====================
  
  clearAllData() {
    const keysToKeep = ['arepas_users']; // Mantener usuarios por seguridad
    const dataToKeep = {};
    
    keysToKeep.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) dataToKeep[key] = value;
    });
    
    // Limpiar solo las claves de la app
    Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('arepas_products');
    localStorage.removeItem('arepas_points_rate');
    localStorage.removeItem('low_stock_alerts');
    
    // Restaurar datos importantes
    Object.entries(dataToKeep).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    return true;
  },
  
  getStorageSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      total += (key?.length || 0) + (value?.length || 0);
    }
    return (total / 1024).toFixed(2); // KB
  },
  
  exportDatabase() {
    const exportData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arepas_')) {
        exportData[key] = localStorage.getItem(key);
      }
    }
    return exportData;
  },
  
  importDatabase(data) {
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('arepas_')) {
        localStorage.setItem(key, value);
      }
    }
    return true;
  },
  
  // ==================== ESTADÍSTICAS ====================
  
  getUserStats(userId) {
    const orders = this.getOrdersHistory(userId);
    const favorites = this.getFavorites(userId);
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? totalSpent / orderCount : 0;
    const lastOrder = orders[0] || null;
    
    return {
      userId,
      orderCount,
      totalSpent,
      averageOrder,
      favoriteCount: favorites.length,
      lastOrder,
      memberSince: orders[orders.length - 1]?.timestamp || null
    };
  },
  
  getMostPopularProducts(limit = 5) {
    const orders = this.getAllOrders();
    const productCount = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productCount[item.id]) {
          productCount[item.id] = { name: item.name, count: 0, revenue: 0 };
        }
        productCount[item.id].count += item.quantity;
        productCount[item.id].revenue += item.price * item.quantity;
      });
    });
    
    return Object.values(productCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
  
  getProductSales(productId) {
    const orders = this.getAllOrders();
    let totalSold = 0;
    let totalRevenue = 0;
    
    orders.forEach(order => {
      const item = order.items.find(i => i.id === productId);
      if (item) {
        totalSold += item.quantity;
        totalRevenue += item.price * item.quantity;
      }
    });
    
    return { totalSold, totalRevenue };
  }
};
