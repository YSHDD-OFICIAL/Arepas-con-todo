// auth.js
import { CONFIG, FEATURES } from './config.js';
import { db } from './database.js';
import { uuid, isValidEmail, showToast } from './utils.js';

export const auth = {
  /**
   * Registra un nuevo usuario
   * @param {string} email - Correo electrónico
   * @param {string} password - Contraseña
   * @param {string|null} referrerCode - Código de referido (opcional)
   * @returns {boolean} - Éxito del registro
   */
  register(email, password, referrerCode = null) {
    // Validaciones
    if (!email || !password) {
      throw new Error('Todos los campos son obligatorios');
    }
    if (!isValidEmail(email)) {
      throw new Error('Correo electrónico inválido');
    }
    if (password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres');
    }
    
    const users = db.getUsers();
    if (users.find(u => u.email === email)) {
      throw new Error('El email ya está registrado');
    }
    
    const newUser = { 
      id: uuid(), 
      email: email.toLowerCase().trim(), 
      password, 
      createdAt: Date.now(),
      lastLogin: null,
      isActive: true
    };
    users.push(newUser);
    db.saveUsers(users);
    
    // Procesar referido (si está activo)
    if (referrerCode && FEATURES.referrals) {
      import('./referrals.js').then(({ referrals }) => {
        referrals.applyReferral(newUser.id, referrerCode);
      }).catch(err => console.warn('Error al procesar referido:', err));
    }
    
    // Auto-login después del registro
    this.login(email, password);
    return true;
  },
  
  /**
   * Inicia sesión de usuario
   * @param {string} email - Correo electrónico
   * @param {string} password - Contraseña
   * @returns {Object} - Sesión del usuario
   */
  login(email, password) {
    if (!email || !password) {
      throw new Error('Todos los campos son obligatorios');
    }
    
    const users = db.getUsers();
    const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
    
    if (!user) {
      throw new Error('Credenciales incorrectas');
    }
    
    if (!user.isActive) {
      throw new Error('Cuenta desactivada. Contacta al administrador');
    }
    
    // Actualizar último login
    user.lastLogin = Date.now();
    db.saveUsers(users);
    
    const session = { 
      userId: user.id, 
      email: user.email, 
      timestamp: Date.now(),
      expiresAt: Date.now() + (CONFIG.SESSION_DURATION_DAYS * 24 * 3600000)
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(session));
    
    return session;
  },
  
  /**
   * Obtiene la sesión actual del usuario
   * @returns {Object|null} - Sesión o null
   */
  getSession() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
    if (!raw) return null;
    
    try {
      const session = JSON.parse(raw);
      const sessionDuration = CONFIG.SESSION_DURATION_DAYS * 24 * 3600000;
      
      if (Date.now() - session.timestamp > sessionDuration) {
        this.logout();
        return null;
      }
      
      return session;
    } catch (e) {
      return null;
    }
  },
  
  /**
   * Obtiene el usuario actual
   * @returns {Object|null} - Usuario o null
   */
  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    return db.getUserById(session.userId);
  },
  
  /**
   * Cierra la sesión del usuario
   * @param {boolean} redirect - Si debe redirigir al login
   */
  logout(redirect = true) {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
    if (redirect) {
      window.location.href = 'index.html';
    }
  },
  
  /**
   * Verifica si el usuario actual es administrador
   * @returns {boolean}
   */
  isAdmin() {
    const session = this.getSession();
    return session && session.email === CONFIG.ADMIN_EMAIL;
  },
  
  /**
   * Verifica si hay una sesión activa
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.getSession() !== null;
  },
  
  /**
   * Cambia la contraseña del usuario
   * @param {string} oldPassword - Contraseña actual
   * @param {string} newPassword - Nueva contraseña
   * @returns {boolean}
   */
  changePassword(oldPassword, newPassword) {
    const session = this.getSession();
    if (!session) throw new Error('No hay sesión activa');
    
    if (newPassword.length < 4) {
      throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
    }
    
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.id === session.userId);
    
    if (userIndex === -1) throw new Error('Usuario no encontrado');
    if (users[userIndex].password !== oldPassword) throw new Error('Contraseña actual incorrecta');
    
    users[userIndex].password = newPassword;
    db.saveUsers(users);
    
    return true;
  },
  
  /**
   * Actualiza el perfil del usuario
   * @param {Object} updates - Campos a actualizar
   * @returns {boolean}
   */
  updateProfile(updates) {
    const session = this.getSession();
    if (!session) throw new Error('No hay sesión activa');
    
    const allowedUpdates = ['name', 'phone', 'address', 'avatar'];
    const filteredUpdates = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }
    
    return db.updateUser(session.userId, filteredUpdates);
  },
  
  /**
   * Exporta la cuenta del usuario (backup)
   * @returns {string} - Código base64
   */
  exportAccount() {
    const session = this.getSession();
    if (!session) throw new Error('No hay sesión activa');
    
    const user = db.getUserById(session.userId);
    if (!user) throw new Error('Usuario no encontrado');
    
    // Exportar todos los datos del usuario
    const allData = {
      version: CONFIG.VERSION,
      exportDate: Date.now(),
      user: { 
        email: user.email, 
        password: user.password,
        name: user.name || '',
        phone: user.phone || ''
      },
      favorites: db.getFavorites(session.userId),
      orders: db.getOrdersHistory(session.userId),
      loyalty: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}')[session.userId] || 0,
      missions: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MISSIONS) || '{}')[session.userId] || {}
    };
    
    return btoa(JSON.stringify(allData));
  },
  
  /**
   * Importa una cuenta desde un código de backup
   * @param {string} code - Código base64
   * @returns {boolean}
   */
  importAccount(code) {
    try {
      const data = JSON.parse(atob(code));
      if (!data.user.email || !data.user.password) {
        throw new Error('Datos inválidos');
      }
      
      const users = db.getUsers();
      let user = users.find(u => u.email === data.user.email);
      
      if (!user) {
        // Crear nuevo usuario
        user = { 
          id: uuid(), 
          email: data.user.email, 
          password: data.user.password,
          name: data.user.name || '',
          phone: data.user.phone || '',
          createdAt: Date.now(),
          isActive: true
        };
        users.push(user);
        db.saveUsers(users);
      }
      
      // Restaurar favoritos
      if (data.favorites && Array.isArray(data.favorites)) {
        const favs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES) || '{}');
        favs[user.id] = data.favorites;
        localStorage.setItem(CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
      }
      
      // Restaurar historial de órdenes
      if (data.orders && Array.isArray(data.orders)) {
        const orders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
        orders[user.id] = data.orders;
        localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY, JSON.stringify(orders));
      }
      
      // Restaurar puntos de lealtad
      if (typeof data.loyalty === 'number') {
        const loyalty = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}');
        loyalty[user.id] = data.loyalty;
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(loyalty));
      }
      
      // Restaurar misiones
      if (data.missions && typeof data.missions === 'object') {
        const missions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MISSIONS) || '{}');
        missions[user.id] = data.missions;
        localStorage.setItem(CONFIG.STORAGE_KEYS.MISSIONS, JSON.stringify(missions));
      }
      
      this.login(data.user.email, data.user.password);
      return true;
    } catch (e) {
      throw new Error('Código inválido o corrupto');
    }
  },
  
  /**
   * Exporta todos los datos del usuario (GDPR)
   * @returns {Object|null}
   */
  exportAllUserData() {
    const session = this.getSession();
    if (!session) return null;
    
    const allUserData = {
      user: this.getCurrentUser(),
      session: session,
      favorites: db.getFavorites(session.userId),
      orders: db.getOrdersHistory(session.userId),
      loyalty: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}')[session.userId] || 0,
      missions: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MISSIONS) || '{}')[session.userId] || {},
      exportDate: Date.now()
    };
    
    return allUserData;
  },
  
  /**
   * Elimina permanentemente la cuenta del usuario
   * @param {string} password - Contraseña para confirmar
   * @returns {boolean}
   */
  deleteAccount(password) {
    const session = this.getSession();
    if (!session) throw new Error('No hay sesión activa');
    
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.id === session.userId);
    
    if (userIndex === -1) throw new Error('Usuario no encontrado');
    if (users[userIndex].password !== password) throw new Error('Contraseña incorrecta');
    
    // Eliminar datos del usuario
    users.splice(userIndex, 1);
    db.saveUsers(users);
    
    // Limpiar datos asociados
    const favs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES) || '{}');
    delete favs[session.userId];
    localStorage.setItem(CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
    
    const orders = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY) || '{}');
    delete orders[session.userId];
    localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS_HISTORY, JSON.stringify(orders));
    
    const loyalty = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY) || '{}');
    delete loyalty[session.userId];
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(loyalty));
    
    const missions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MISSIONS) || '{}');
    delete missions[session.userId];
    localStorage.setItem(CONFIG.STORAGE_KEYS.MISSIONS, JSON.stringify(missions));
    
    this.logout(true);
    return true;
  },
  
  /**
   * Verifica si el email ya está registrado
   * @param {string} email - Email a verificar
   * @returns {boolean}
   */
  emailExists(email) {
    const users = db.getUsers();
    return users.some(u => u.email === email.toLowerCase().trim());
  },
  
  /**
   * Obtiene estadísticas del usuario actual
   * @returns {Object}
   */
  getUserStats() {
    const session = this.getSession();
    if (!session) return null;
    return db.getUserStats(session.userId);
  }
};
