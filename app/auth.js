// auth.js
import { CONFIG } from './config.js';
import { db } from './database.js';
import { uuid } from './utils.js';

export const auth = {
  register(email, password, referrerCode = null) {
    const users = db.getUsers();
    if (users.find(u => u.email === email)) throw new Error('El email ya está registrado');
    const newUser = { id: uuid(), email, password, createdAt: Date.now() };
    users.push(newUser);
    db.saveUsers(users);
    
    // Procesar referido
    if (referrerCode) {
      import('./referrals.js').then(({ referrals }) => {
        referrals.applyReferral(newUser.id, referrerCode);
      });
    }
    
    this.login(email, password);
    return true;
  },
  
  login(email, password) {
    const users = db.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Credenciales incorrectas');
    const session = { userId: user.id, email: user.email, timestamp: Date.now() };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(session));
    return session;
  },
  
  getSession() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() - session.timestamp > 30 * 24 * 3600000) {
      this.logout();
      return null;
    }
    return session;
  },
  
  logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
    window.location.href = 'index.html';
  },
  
  isAdmin() {
    const session = this.getSession();
    return session && session.email === CONFIG.ADMIN_EMAIL;
  },
  
  exportAccount() {
    const session = this.getSession();
    if (!session) throw new Error('No hay sesión');
    const users = db.getUsers();
    const user = users.find(u => u.id === session.userId);
    
    // Exportar todos los datos del usuario
    const allData = {
      user: { email: user.email, password: user.password },
      favorites: db.getFavorites(session.userId),
      orders: db.getOrdersHistory(session.userId),
      loyalty: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}')[session.userId] || 0,
      missions: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MISSIONS) || '{}')[session.userId] || {}
    };
    return btoa(JSON.stringify(allData));
  },
  
  importAccount(code) {
    try {
      const data = JSON.parse(atob(code));
      if (!data.user.email || !data.user.password) throw new Error();
      
      const users = db.getUsers();
      let user = users.find(u => u.email === data.user.email);
      
      if (!user) {
        user = { id: uuid(), email: data.user.email, password: data.user.password, createdAt: Date.now() };
        users.push(user);
        db.saveUsers(users);
      }
      
      // Restaurar datos
      if (data.favorites) {
        const favs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES) || '{}');
        favs[user.id] = data.favorites;
        localStorage.setItem(CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
      }
      
      if (data.orders) {
        const orders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
        orders[user.id] = data.orders;
        localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY, JSON.stringify(orders));
      }
      
      if (data.loyalty) {
        const loyalty = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}');
        loyalty[user.id] = data.loyalty;
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(loyalty));
      }
      
      this.login(data.user.email, data.user.password);
      return true;
    } catch (e) {
      throw new Error('Código inválido');
    }
  },
  
  exportAllUserData() {
    const session = this.getSession();
    if (!session) return null;
    const allUserData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arepas_')) {
        allUserData[key] = localStorage.getItem(key);
      }
    }
    return allUserData;
  }
};