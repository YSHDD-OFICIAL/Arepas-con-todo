// ai.js
import { CONFIG } from './config.js';
import { db } from './database.js';

export const ai = {
  getBrain() {
    const brain = localStorage.getItem(CONFIG.STORAGE_KEYS.BRAIN);
    if (!brain) {
      const initial = { productScores: {}, userPreferences: {}, seasonalData: {} };
      localStorage.setItem(CONFIG.STORAGE_KEYS.BRAIN, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(brain);
  },
  
  track(product, userId = null) {
    const brain = this.getBrain();
    if (!brain.productScores[product.id]) brain.productScores[product.id] = 0;
    brain.productScores[product.id] += 1;
    
    // Track por hora para estacionalidad
    const hour = new Date().getHours();
    if (!brain.seasonalData[hour]) brain.seasonalData[hour] = {};
    if (!brain.seasonalData[hour][product.id]) brain.seasonalData[hour][product.id] = 0;
    brain.seasonalData[hour][product.id] += 1;
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.BRAIN, JSON.stringify(brain));
  },
  
  recommend(limit = 4, userId = null) {
    const brain = this.getBrain();
    const products = db.getProducts();
    const hour = new Date().getHours();
    
    // Combinar popularidad general con preferencia horaria
    const scores = {};
    products.forEach(p => {
      const general = brain.productScores[p.id] || 0;
      const seasonal = brain.seasonalData[hour]?.[p.id] || 0;
      scores[p.id] = general * 0.6 + seasonal * 0.4;
    });
    
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => products.find(p => p.id === id))
      .filter(p => p);
    
    return sorted.slice(0, limit);
  },
  
  getTopProducts(limit = 5) {
    const brain = this.getBrain();
    return Object.entries(brain.productScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score }));
  },
  
  getPersonalizedRecommendation(userId) {
    const userOrders = db.getOrdersHistory(userId);
    const userProductIds = new Set();
    userOrders.forEach(order => {
      order.items.forEach(item => userProductIds.add(item.id));
    });
    
    const brain = this.getBrain();
    const products = db.getProducts();
    
    // Encontrar productos similares basados en co-ocurrencia
    const recommendations = products.filter(p => !userProductIds.has(p.id));
    recommendations.sort((a, b) => {
      const scoreA = brain.productScores[a.id] || 0;
      const scoreB = brain.productScores[b.id] || 0;
      return scoreB - scoreA;
    });
    
    return recommendations.slice(0, 4);
  }
};