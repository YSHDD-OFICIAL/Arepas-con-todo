// achievements.js
import { showToast } from './utils.js';

const MISSIONS_KEY = 'arepas_missions';
const BADGES_KEY = 'arepas_badges';
const LEVELS_KEY = 'arepas_levels';

export const missions = {
  // Lista de misiones disponibles
  list: [
    { id: 'first_purchase', name: '🎉 Primer pedido', description: 'Realiza tu primera compra', condition: (userOrders) => userOrders.length >= 1, reward: 50, icon: '🎉', category: 'inicio' },
    { id: 'arepa_lover', name: '❤️ Arepa Lover', description: 'Compra 10 arepas', condition: (userOrders) => userOrders.reduce((sum, o) => sum + o.items.length, 0) >= 10, reward: 200, icon: '❤️', category: 'cantidad' },
    { id: 'arepa_master', name: '👑 Arepa Master', description: 'Compra 50 arepas', condition: (userOrders) => userOrders.reduce((sum, o) => sum + o.items.length, 0) >= 50, reward: 500, icon: '👑', category: 'cantidad' },
    { id: 'weekend_warrior', name: '📅 Guerrero de finde', description: 'Compra un sábado o domingo', condition: (userOrders) => userOrders.some(o => [0, 6].includes(new Date(o.timestamp).getDay())), reward: 100, icon: '📅', category: 'tiempo' },
    { id: 'sharing_is_caring', name: '👥 Embajador', description: 'Refiere a un amigo', condition: (_, referrals) => referrals >= 1, reward: 150, icon: '👥', category: 'social' },
    { id: 'super_referrer', name: '🌟 Super Referente', description: 'Refiere a 5 amigos', condition: (_, referrals) => referrals >= 5, reward: 500, icon: '🌟', category: 'social' },
    { id: 'five_star', name: '⭐ Cinco estrellas', description: 'Gasta más de $50,000 en un pedido', condition: (userOrders) => userOrders.some(o => o.total >= 50000), reward: 300, icon: '⭐', category: 'gasto' },
    { id: 'big_spender', name: '💰 Gran Gastador', description: 'Gasta más de $200,000 en total', condition: (userOrders) => userOrders.reduce((sum, o) => sum + o.total, 0) >= 200000, reward: 500, icon: '💰', category: 'gasto' },
    { id: 'early_bird', name: '🌅 Madrugador', description: 'Compra antes de las 10 AM', condition: (userOrders) => userOrders.some(o => new Date(o.timestamp).getHours() < 10), reward: 80, icon: '🌅', category: 'tiempo' },
    { id: 'night_owl', name: '🦉 Nocturno', description: 'Compra después de las 10 PM', condition: (userOrders) => userOrders.some(o => new Date(o.timestamp).getHours() >= 22), reward: 100, icon: '🦉', category: 'tiempo' },
    { id: 'variety_lover', name: '🍽️ Amante de la variedad', description: 'Prueba 5 productos diferentes', condition: (userOrders) => {
      const uniqueProducts = new Set();
      userOrders.forEach(o => o.items.forEach(i => uniqueProducts.add(i.id)));
      return uniqueProducts.size >= 5;
    }, reward: 250, icon: '🍽️', category: 'variedad' },
    { id: 'loyal_customer', name: '🏆 Cliente Fiel', description: 'Realiza 10 pedidos', condition: (userOrders) => userOrders.length >= 10, reward: 400, icon: '🏆', category: 'cantidad' },
    { id: 'speedy_gonzalez', name: '⚡ Rápido', description: 'Completa un pedido en menos de 5 minutos', condition: () => false, reward: 150, icon: '⚡', category: 'especial' }, // Requiere tracking de tiempo
    { id: 'perfect_order', name: '✨ Pedido Perfecto', description: 'Pide exactamente $25,000', condition: (userOrders) => userOrders.some(o => o.total === 25000), reward: 200, icon: '✨', category: 'especial' }
  ],
  
  // Niveles del usuario
  levels: [
    { level: 1, name: '🌱 Aprendiz', minPoints: 0, icon: '🌱' },
    { level: 2, name: '🍽️ Comensal', minPoints: 200, icon: '🍽️' },
    { level: 3, name: '🔥 Arepero', minPoints: 500, icon: '🔥' },
    { level: 4, name: '⭐ Experto', minPoints: 1000, icon: '⭐' },
    { level: 5, name: '👑 Maestro Arepero', minPoints: 2000, icon: '👑' },
    { level: 6, name: '🏆 Leyenda', minPoints: 5000, icon: '🏆' }
  ],
  
  /**
   * Obtiene el progreso del usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Progreso del usuario
   */
  getUserProgress(userId) {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    return all[userId] || { 
      completed: [], 
      referrals: 0, 
      pointsEarned: 0,
      badges: [],
      lastCheck: Date.now()
    };
  },
  
  /**
   * Guarda el progreso del usuario
   * @param {string} userId - ID del usuario
   * @param {Object} progress - Progreso a guardar
   */
  saveProgress(userId, progress) {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    all[userId] = { ...progress, lastUpdated: Date.now() };
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(all));
  },
  
  /**
   * Verifica y otorga recompensas
   * @param {string} userId - ID del usuario
   * @param {Array} userOrders - Órdenes del usuario
   * @param {number} referrals - Cantidad de referidos
   * @returns {number} - Puntos ganados
   */
  checkAndReward(userId, userOrders, referrals = 0) {
    let progress = this.getUserProgress(userId);
    let newRewards = 0;
    const newlyCompleted = [];
    
    this.list.forEach(mission => {
      if (!progress.completed.includes(mission.id) && mission.condition(userOrders, referrals)) {
        progress.completed.push(mission.id);
        newRewards += mission.reward;
        newlyCompleted.push(mission);
      }
    });
    
    if (newRewards > 0) {
      progress.pointsEarned = (progress.pointsEarned || 0) + newRewards;
      progress.lastReward = Date.now();
      this.saveProgress(userId, progress);
      
      // Verificar nuevos niveles
      const newLevel = this.checkLevelUp(progress.pointsEarned);
      if (newLevel > this.getCurrentLevel(userId).level) {
        progress.currentLevel = newLevel;
        this.saveProgress(userId, progress);
        this.showLevelUpNotification(userId, newLevel);
      }
      
      // Sumar puntos al sistema de lealtad
      import('./loyalty.js').then(({ loyalty }) => {
        loyalty.addPoints(userId, newRewards);
      }).catch(err => console.warn('Error al añadir puntos:', err));
      
      this.showNotification(userId, newlyCompleted, newRewards);
    }
    return newRewards;
  },
  
  /**
   * Muestra notificación de logro
   * @param {string} userId - ID del usuario
   * @param {Array} missions - Misiones completadas
   * @param {number} points - Puntos ganados
   */
  showNotification(userId, missions, points) {
    const message = `🎁 ¡${missions.length} misión${missions.length !== 1 ? 'es' : ''} completada${missions.length !== 1 ? 's' : ''}! +${points} puntos`;
    
    // Notificación del sistema
    if (Notification.permission === 'granted') {
      new Notification('🏆 Logro desbloqueado', { body: message, icon: '/assets/icons/icon-192.png' });
    }
    
    // Toast en UI
    showToast(message, 'success', 4000);
    
    // Sonido opcional
    try {
      const audio = new Audio('/assets/sounds/achievement.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch(e) {}
  },
  
  /**
   * Muestra notificación de subida de nivel
   * @param {string} userId - ID del usuario
   * @param {number} level - Nivel alcanzado
   */
  showLevelUpNotification(userId, level) {
    const levelInfo = this.levels.find(l => l.level === level);
    const message = `🎉 ¡SUBISTE DE NIVEL! Ahora eres ${levelInfo?.name || `Nivel ${level}`}`;
    
    if (Notification.permission === 'granted') {
      new Notification('⬆️ Nuevo nivel alcanzado', { body: message, icon: '/assets/icons/icon-192.png' });
    }
    
    showToast(message, 'success', 5000);
  },
  
  /**
   * Obtiene la cantidad de misiones completadas
   * @param {string} userId - ID del usuario
   * @returns {number} - Cantidad completada
   */
  getCompletedCount(userId) {
    const progress = this.getUserProgress(userId);
    return progress.completed.length;
  },
  
  /**
   * Obtiene el total de puntos ganados por misiones
   * @param {string} userId - ID del usuario
   * @returns {number} - Puntos totales
   */
  getTotalPoints(userId) {
    const progress = this.getUserProgress(userId);
    return progress.pointsEarned || 0;
  },
  
  /**
   * Obtiene el nivel actual del usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Nivel actual
   */
  getCurrentLevel(userId) {
    const points = this.getTotalPoints(userId);
    return this.getLevelByPoints(points);
  },
  
  /**
   * Obtiene nivel según puntos
   * @param {number} points - Puntos del usuario
   * @returns {Object} - Nivel correspondiente
   */
  getLevelByPoints(points) {
    let currentLevel = this.levels[0];
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (points >= this.levels[i].minPoints) {
        currentLevel = this.levels[i];
        break;
      }
    }
    return currentLevel;
  },
  
  /**
   * Verifica si el usuario sube de nivel
   * @param {number} points - Puntos actuales
   * @returns {number} - Nuevo nivel o nivel actual
   */
  checkLevelUp(points) {
    let newLevel = 1;
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (points >= this.levels[i].minPoints) {
        newLevel = this.levels[i].level;
        break;
      }
    }
    return newLevel;
  },
  
  /**
   * Obtiene el progreso hacia el siguiente nivel
   * @param {string} userId - ID del usuario
   * @returns {Object} - Progreso al siguiente nivel
   */
  getNextLevelProgress(userId) {
    const currentPoints = this.getTotalPoints(userId);
    const currentLevel = this.getCurrentLevel(userId);
    const nextLevel = this.levels.find(l => l.level === currentLevel.level + 1);
    
    if (!nextLevel) {
      return { current: currentPoints, needed: currentPoints, progress: 100, levelUp: false };
    }
    
    const pointsNeeded = nextLevel.minPoints - currentPoints;
    const progress = Math.min(100, Math.round((currentPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints) * 100));
    
    return {
      current: currentPoints,
      needed: pointsNeeded,
      progress,
      levelUp: pointsNeeded <= 0,
      nextLevelName: nextLevel.name,
      nextLevelIcon: nextLevel.icon
    };
  },
  
  /**
   * Obtiene las misiones completadas
   * @param {string} userId - ID del usuario
   * @returns {Array} - Misiones completadas
   */
  getCompletedMissions(userId) {
    const progress = this.getUserProgress(userId);
    return this.list.filter(m => progress.completed.includes(m.id));
  },
  
  /**
   * Obtiene las misiones pendientes
   * @param {string} userId - ID del usuario
   * @returns {Array} - Misiones pendientes
   */
  getPendingMissions(userId) {
    const progress = this.getUserProgress(userId);
    return this.list.filter(m => !progress.completed.includes(m.id));
  },
  
  /**
   * Obtiene misiones por categoría
   * @param {string} category - Categoría de misión
   * @returns {Array} - Misiones de la categoría
   */
  getMissionsByCategory(category) {
    return this.list.filter(m => m.category === category);
  },
  
  /**
   * Obtiene todas las categorías de misiones
   * @returns {Array} - Categorías únicas
   */
  getCategories() {
    return [...new Set(this.list.map(m => m.category))];
  },
  
  /**
   * Obtiene estadísticas completas del usuario
   * @param {string} userId - ID del usuario
   * @returns {Object} - Estadísticas de logros
   */
  getStats(userId) {
    const completed = this.getCompletedMissions(userId);
    const pending = this.getPendingMissions(userId);
    const totalPoints = this.getTotalPoints(userId);
    const currentLevel = this.getCurrentLevel(userId);
    const nextLevelProgress = this.getNextLevelProgress(userId);
    
    return {
      totalMissions: this.list.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      completionRate: Math.round((completed.length / this.list.length) * 100),
      totalPoints,
      currentLevel,
      nextLevelProgress,
      categories: this.getCategories().map(cat => ({
        name: cat,
        completed: this.getMissionsByCategory(cat).filter(m => completed.some(c => c.id === m.id)).length,
        total: this.getMissionsByCategory(cat).length
      }))
    };
  },
  
  /**
   * Obtiene insignias desbloqueadas
   * @param {string} userId - ID del usuario
   * @returns {Array} - Insignias desbloqueadas
   */
  getBadges(userId) {
    const completed = this.getCompletedMissions(userId);
    const level = this.getCurrentLevel(userId);
    
    const badges = [
      { id: 'first_purchase_badge', name: 'Primer Pedido', icon: '🎉', unlocked: completed.some(m => m.id === 'first_purchase') },
      { id: 'level_1_badge', name: 'Nivel 1 - Aprendiz', icon: '🌱', unlocked: level.level >= 1 },
      { id: 'level_2_badge', name: 'Nivel 2 - Comensal', icon: '🍽️', unlocked: level.level >= 2 },
      { id: 'level_3_badge', name: 'Nivel 3 - Arepero', icon: '🔥', unlocked: level.level >= 3 },
      { id: 'level_4_badge', name: 'Nivel 4 - Experto', icon: '⭐', unlocked: level.level >= 4 },
      { id: 'level_5_badge', name: 'Nivel 5 - Maestro', icon: '👑', unlocked: level.level >= 5 },
      { id: 'referrer_badge', name: 'Embajador', icon: '👥', unlocked: completed.some(m => m.id === 'sharing_is_caring') }
    ];
    
    return badges;
  },
  
  /**
   * Reinicia el progreso de un usuario (admin)
   * @param {string} userId - ID del usuario
   * @returns {boolean} - Éxito de la operación
   */
  resetUserProgress(userId) {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    delete all[userId];
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(all));
    return true;
  },
  
  /**
   * Obtiene ranking de usuarios por puntos
   * @returns {Array} - Ranking de usuarios
   */
  getLeaderboard() {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    const users = db.getUsers();
    
    const leaderboard = users.map(user => ({
      userId: user.id,
      email: user.email,
      points: all[user.id]?.pointsEarned || 0,
      level: this.getLevelByPoints(all[user.id]?.pointsEarned || 0).level,
      completedMissions: all[user.id]?.completed?.length || 0
    }));
    
    return leaderboard.sort((a, b) => b.points - a.points);
  }
};

// Importar db para leaderboard
import { db } from './database.js';
