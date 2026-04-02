// dynamicPricing.js
import { ai } from './ai.js';
import { db } from './database.js';

export const dynamicPricing = {
  getDemandScore(productId) {
    const brain = ai.getBrain();
    const views = brain.productScores[productId] || 0;
    const sales = this.getSalesCount(productId);
    const demand = (views / (sales + 1)) * (sales / (views + 1));
    return Math.min(1, demand);
  },
  
  getSalesCount(productId) {
    const orders = db.getAllOrders();
    return orders.filter(o => o.items.some(i => i.id === productId)).length;
  },
  
  suggestPrice(product) {
    const demand = this.getDemandScore(product.id);
    const variation = (demand - 0.5) * 0.4;
    const suggested = product.price * (1 + variation);
    return Math.round(suggested / 500) * 500;
  },
  
  getPriceTag(product) {
    const suggested = this.suggestPrice(product);
    if (suggested > product.price) {
      return { price: suggested, trend: 'up', message: '🔥 Alta demanda' };
    } else if (suggested < product.price) {
      return { price: suggested, trend: 'down', message: '💰 Oferta especial' };
    }
    return { price: product.price, trend: 'stable', message: '' };
  }
};