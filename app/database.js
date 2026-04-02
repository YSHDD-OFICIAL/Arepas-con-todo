// database.js
import { CONFIG } from './config.js';

export const db = {
  getUsers() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  
  saveUsers(users) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  
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
  
  getOrdersHistory(userId) {
    const orders = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY);
    const all = orders ? JSON.parse(orders) : {};
    return all[userId] || [];
  },
  
  saveOrder(userId, order) {
    const orders = localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY);
    let all = orders ? JSON.parse(orders) : {};
    if (!all[userId]) all[userId] = [];
    all[userId].unshift(order);
    localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY, JSON.stringify(all));
  },
  
  getPendingOrders() {
    const pending = localStorage.getItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS);
    return pending ? JSON.parse(pending) : [];
  },
  
  addPendingOrder(order) {
    const pending = this.getPendingOrders();
    pending.push(order);
    localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
  },
  
  clearPendingOrders() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_ORDERS, JSON.stringify([]));
  },
  
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
  }
};