// ai.js
import { CONFIG, FEATURES } from './config.js';
import { db } from './database.js';

export const ai = {
  /**
   * Obtiene el cerebro de IA del sistema
   * @returns {Object} - Datos de aprendizaje
   */
  getBrain() {
    const brain = localStorage.getItem(CONFIG.STORAGE_KEYS.BRAIN);
    if (!brain) {
      const initial = { 
        productScores: {}, 
        userPreferences: {}, 
        seasonalData: {},
        userHistory: {},
        coOccurrence: {},
        priceElasticity: {},
        lastUpdated: Date.now()
      };
      localStorage.setItem(CONFIG.STORAGE_KEYS.BRAIN, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(brain);
  },
  
  /**
   * Guarda el cerebro de IA
   * @param {Object} brain - Datos a guardar
   */
  saveBrain(brain) {
    brain.lastUpdated = Date.now();
    localStorage.setItem(CONFIG.STORAGE_KEYS.BRAIN, JSON.stringify(brain));
  },
  
  /**
   * Registra una interacción con un producto
   * @param {Object} product - Producto interactuado
   * @param {string} userId - ID del usuario (opcional)
   * @param {string} action - Tipo de acción: 'view', 'add', 'purchase'
   */
  track(product, userId = null, action = 'view') {
    const brain = this.getBrain();
    const weights = { view: 1, add: 3, purchase: 10 };
    const weight = weights[action] || 1;
    
    // Score del producto
    if (!brain.productScores[product.id]) brain.productScores[product.id] = 0;
    brain.productScores[product.id] += weight;
    
    // Track por hora para estacionalidad
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    if (!brain.seasonalData[hour]) brain.seasonalData[hour] = {};
    if (!brain.seasonalData[hour][product.id]) brain.seasonalData[hour][product.id] = 0;
    brain.seasonalData[hour][product.id] += weight;
    
    // Track por día de semana
    if (!brain.seasonalData[`day_${day}`]) brain.seasonalData[`day_${day}`] = {};
    if (!brain.seasonalData[`day_${day}`][product.id]) brain.seasonalData[`day_${day}`][product.id] = 0;
    brain.seasonalData[`day_${day}`][product.id] += weight;
    
    // Track por usuario
    if (userId) {
      if (!brain.userHistory[userId]) brain.userHistory[userId] = [];
      brain.userHistory[userId].push({
        productId: product.id,
        action,
        timestamp: Date.now(),
        price: product.price
      });
      // Mantener solo últimos 100 eventos por usuario
      if (brain.userHistory[userId].length > 100) {
        brain.userHistory[userId] = brain.userHistory[userId].slice(-100);
      }
    }
    
    // Matriz de co-ocurrencia para recomendaciones
    if (action === 'purchase' && userId) {
      const lastPurchases = brain.userHistory[userId]
        .filter(h => h.action === 'purchase')
        .slice(-5)
        .map(h => h.productId);
      
      for (const purchasedId of lastPurchases) {
        if (purchasedId !== product.id) {
          if (!brain.coOccurrence[product.id]) brain.coOccurrence[product.id] = {};
          if (!brain.coOccurrence[product.id][purchasedId]) brain.coOccurrence[product.id][purchasedId] = 0;
          brain.coOccurrence[product.id][purchasedId] += weight;
        }
      }
    }
    
    // Elasticidad de precio (seguimiento de compras vs precio)
    if (action === 'purchase') {
      const priceKey = Math.floor(product.price / 1000) * 1000;
      if (!brain.priceElasticity[product.id]) brain.priceElasticity[product.id] = {};
      if (!brain.priceElasticity[product.id][priceKey]) brain.priceElasticity[product.id][priceKey] = 0;
      brain.priceElasticity[product.id][priceKey] += weight;
    }
    
    this.saveBrain(brain);
  },
  
  /**
   * Recomienda productos basados en popularidad y hora
   * @param {number} limit - Cantidad de recomendaciones
   * @param {string} userId - ID del usuario (opcional)
   * @returns {Array} - Productos recomendados
   */
  recommend(limit = 4, userId = null) {
    const brain = this.getBrain();
    const products = db.getProducts();
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    const scores = {};
    products.forEach(p => {
      let general = brain.productScores[p.id] || 0;
      let seasonalHour = brain.seasonalData[hour]?.[p.id] || 0;
      let seasonalDay = brain.seasonalData[`day_${day}`]?.[p.id] || 0;
      
      // Ponderación: 40% general, 30% hora, 30% día
      let score = (general * 0.4) + (seasonalHour * 0.3) + (seasonalDay * 0.3);
      
      // Personalización si hay userId
      if (userId && brain.userHistory[userId]) {
        const userPurchases = brain.userHistory[userId].filter(h => h.action === 'purchase');
        const userViews = brain.userHistory[userId].filter(h => h.action === 'view');
        
        // Productos similares por co-ocurrencia
        let coOccurrenceScore = 0;
        for (const purchase of userPurchases.slice(-5)) {
          const coOccur = brain.coOccurrence[purchase.productId]?.[p.id] || 0;
          coOccurrenceScore += coOccur * 2;
        }
        score += coOccurrenceScore * 0.2;
        
        // Penalizar productos ya comprados
        const alreadyPurchased = userPurchases.some(h => h.productId === p.id);
        if (alreadyPurchased) score *= 0.3;
      }
      
      scores[p.id] = score;
    });
    
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => products.find(p => p.id === id))
      .filter(p => p);
    
    return sorted.slice(0, limit);
  },
  
  /**
   * Obtiene los productos más populares
   * @param {number} limit - Cantidad de productos
   * @returns {Array} - Top productos
   */
  getTopProducts(limit = 5) {
    const brain = this.getBrain();
    const products = db.getProducts();
    
    return Object.entries(brain.productScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => {
        const product = products.find(p => p.id === id);
        return { id, score, name: product?.name || id };
      });
  },
  
  /**
   * Recomendaciones personalizadas para un usuario
   * @param {string} userId - ID del usuario
   * @param {number} limit - Cantidad de recomendaciones
   * @returns {Array} - Productos personalizados
   */
  getPersonalizedRecommendation(userId, limit = 4) {
    if (!userId) return this.recommend(limit);
    
    const brain = this.getBrain();
    const products = db.getProducts();
    const userHistory = brain.userHistory[userId] || [];
    
    const purchasedProducts = new Set(
      userHistory.filter(h => h.action === 'purchase').map(h => h.productId)
    );
    
    const viewedProducts = new Set(
      userHistory.filter(h => h.action === 'view').map(h => h.productId)
    );
    
    // Calcular scores personalizados
    const scores = {};
    products.forEach(p => {
      let score = 0;
      
      // Productos vistos pero no comprados (alto interés)
      if (viewedProducts.has(p.id) && !purchasedProducts.has(p.id)) {
        score += 50;
      }
      
      // Popularidad general
      score += (brain.productScores[p.id] || 0) * 0.3;
      
      // Co-ocurrencia con productos comprados
      for (const purchasedId of purchasedProducts) {
        const coOccur = brain.coOccurrence[purchasedId]?.[p.id] || 0;
        score += coOccur * 2;
      }
      
      // Penalizar ya comprados
      if (purchasedProducts.has(p.id)) {
        score = 0;
      }
      
      scores[p.id] = score;
    });
    
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => products.find(p => p.id === id))
      .filter(p => p);
    
    return sorted.slice(0, limit);
  },
  
  /**
   * Obtiene recomendaciones basadas en estacionalidad
   * @param {number} limit - Cantidad de recomendaciones
   * @returns {Array} - Productos estacionales
   */
  getSeasonalRecommendations(limit = 4) {
    const brain = this.getBrain();
    const products = db.getProducts();
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const month = new Date().getMonth();
    
    const scores = {};
    products.forEach(p => {
      let score = 0;
      
      // Hora del día
      score += (brain.seasonalData[hour]?.[p.id] || 0) * 0.4;
      
      // Día de la semana
      score += (brain.seasonalData[`day_${day}`]?.[p.id] || 0) * 0.3;
      
      // Mes (estación)
      score += (brain.seasonalData[`month_${month}`]?.[p.id] || 0) * 0.3;
      
      scores[p.id] = score;
    });
    
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => products.find(p => p.id === id))
      .filter(p => p);
    
    return sorted.slice(0, limit);
  },
  
  /**
   * Obtiene el mejor horario para cada producto
   * @param {string} productId - ID del producto
   * @returns {number} - Mejor hora
   */
  getBestHourForProduct(productId) {
    const brain = this.getBrain();
    let bestHour = 12;
    let maxScore = 0;
    
    for (let hour = 0; hour < 24; hour++) {
      const score = brain.seasonalData[hour]?.[productId] || 0;
      if (score > maxScore) {
        maxScore = score;
        bestHour = hour;
      }
    }
    
    return bestHour;
  },
  
  /**
   * Obtiene estadísticas de aprendizaje de IA
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const brain = this.getBrain();
    const totalInteractions = Object.values(brain.productScores).reduce((a, b) => a + b, 0);
    const uniqueProducts = Object.keys(brain.productScores).length;
    const usersTracked = Object.keys(brain.userHistory).length;
    
    return {
      totalInteractions,
      uniqueProducts,
      usersTracked,
      seasonalDataPoints: Object.keys(brain.seasonalData).length,
      coOccurrencePairs: Object.keys(brain.coOccurrence).length,
      lastUpdated: brain.lastUpdated
    };
  },
  
  /**
   * Reinicia el cerebro de IA (reset de aprendizaje)
   */
  resetBrain() {
    const initial = { 
      productScores: {}, 
      userPreferences: {}, 
      seasonalData: {},
      userHistory: {},
      coOccurrence: {},
      priceElasticity: {},
      lastUpdated: Date.now()
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.BRAIN, JSON.stringify(initial));
    return initial;
  },
  
  /**
   * Predice la popularidad futura de un producto
   * @param {string} productId - ID del producto
   * @param {number} daysAhead - Días a futuro
   * @returns {number} - Score predicho
   */
  predictPopularity(productId, daysAhead = 7) {
    const brain = this.getBrain();
    const currentScore = brain.productScores[productId] || 0;
    
    // Obtener tendencia de los últimos 7 días
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600000;
    const recentInteractions = brain.userHistory[productId]?.filter(h => h.timestamp > weekAgo) || [];
    const recentScore = recentInteractions.length;
    
    // Calcular tendencia
    const trend = recentScore / Math.max(1, currentScore / 7);
    const predicted = recentScore * Math.pow(trend, daysAhead / 7);
    
    return Math.round(predicted);
  },
  
  /**
   * Encuentra productos similares a uno dado
   * @param {string} productId - ID del producto base
   * @param {number} limit - Cantidad de similares
   * @returns {Array} - Productos similares
   */
  findSimilarProducts(productId, limit = 4) {
    const brain = this.getBrain();
    const products = db.getProducts();
    const coOccurrences = brain.coOccurrence[productId] || {};
    
    const similar = Object.entries(coOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => products.find(p => p.id === id))
      .filter(p => p);
    
    return similar;
  }
};

// Inicialización: registrar eventos globales si está en modo debug
if (FEATURES?.debugMode) {
  console.log('🤖 IA inicializada', ai.getStats());
}
