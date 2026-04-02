// dynamicPricing.js
import { ai } from './ai.js';
import { db } from './database.js';
import { CONFIG, FEATURES } from './config.js';

export const dynamicPricing = {
  /**
   * Calcula el score de demanda para un producto
   * @param {string} productId - ID del producto
   * @returns {number} - Score de demanda (0-1)
   */
  getDemandScore(productId) {
    const brain = ai.getBrain();
    const views = brain.productScores[productId] || 0;
    const sales = this.getSalesCount(productId);
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Demanda base
    let demand = 0.5;
    
    if (views > 0 && sales > 0) {
      // Fórmula de demanda: (vistas/ventas) * (ventas/vistas) = demanda
      const viewRate = Math.min(1, views / (sales + 1));
      const salesRate = Math.min(1, sales / (views + 1));
      demand = (viewRate + salesRate) / 2;
    } else if (views > 0) {
      demand = 0.3; // Producto visto pero no comprado
    } else if (sales > 0) {
      demand = 0.7; // Producto comprado pero poco visto
    }
    
    // Ajuste por hora del día (picos de demanda)
    const peakHours = [12, 13, 19, 20, 21]; // Almuerzo y cena
    if (peakHours.includes(hour)) {
      demand *= 1.2;
    }
    
    // Ajuste por día de semana (fines de semana)
    if (day === 5 || day === 6) { // Viernes o Sábado
      demand *= 1.15;
    }
    
    // Ajuste por estacionalidad
    const month = new Date().getMonth();
    const isDecember = month === 11; // Diciembre
    if (isDecember) {
      demand *= 1.3;
    }
    
    return Math.min(1, demand);
  },
  
  /**
   * Obtiene el número de ventas de un producto
   * @param {string} productId - ID del producto
   * @returns {number} - Cantidad de ventas
   */
  getSalesCount(productId) {
    const orders = db.getAllOrders();
    let totalQuantity = 0;
    
    orders.forEach(order => {
      const item = order.items.find(i => i.id === productId);
      if (item) {
        totalQuantity += item.quantity;
      }
    });
    
    return totalQuantity;
  },
  
  /**
   * Sugiere un precio basado en demanda
   * @param {Object} product - Producto
   * @returns {number} - Precio sugerido
   */
  suggestPrice(product) {
    const demand = this.getDemandScore(product.id);
    const stock = this.getStockLevel(product.id);
    const competitorPrice = this.getCompetitorPrice(product);
    
    // Variación base por demanda
    let variation = (demand - 0.5) * 0.4; // -20% a +20%
    
    // Ajuste por stock bajo
    if (stock < 10 && stock > 0) {
      variation += 0.05; // +5% por escasez
    } else if (stock > 50) {
      variation -= 0.05; // -5% por exceso
    }
    
    // Ajuste por competencia
    if (competitorPrice && competitorPrice < product.price) {
      variation -= 0.1; // -10% si competidor es más barato
    }
    
    // Límites de variación
    variation = Math.max(-0.25, Math.min(0.35, variation));
    
    let suggested = product.price * (1 + variation);
    
    // Redondear a múltiplos de 500
    suggested = Math.round(suggested / 500) * 500;
    
    // Respetar precio mínimo (no menor a 5000)
    return Math.max(5000, suggested);
  },
  
  /**
   * Obtiene el nivel de stock de un producto
   * @param {string} productId - ID del producto
   * @returns {number} - Stock actual
   */
  getStockLevel(productId) {
    if (FEATURES.inventory) {
      import('./inventory.js').then(({ inventory }) => {
        return inventory.getStock(productId);
      });
    }
    
    // Fallback: buscar en productos por defecto
    const products = db.getProducts();
    const product = products.find(p => p.id === productId);
    return product?.stock || 50;
  },
  
  /**
   * Obtiene precio de competidor (simulado)
   * @param {Object} product - Producto
   * @returns {number|null} - Precio competidor o null
   */
  getCompetitorPrice(product) {
    // Simulación de precios de competencia
    const competitorPrices = {
      'a1': 7500,  // Arepa Clásica
      'a2': 11500, // Reina Pepiada
      'a3': 12500, // La Pelúa
      'a4': 10500, // Veggie Power
      'a5': 13500, // Dominicana
      'a6': 6500   // Solo Queso
    };
    
    return competitorPrices[product.id] || null;
  },
  
  /**
   * Obtiene la etiqueta de precio con tendencia
   * @param {Object} product - Producto
   * @returns {Object} - Precio, tendencia y mensaje
   */
  getPriceTag(product) {
    const suggested = this.suggestPrice(product);
    const demand = this.getDemandScore(product.id);
    const stock = this.getStockLevel(product.id);
    
    if (suggested > product.price) {
      let message = '🔥 Alta demanda';
      if (stock < 10) message = '⚠️ ¡Últimas unidades!';
      if (demand > 0.8) message = '🔥 ¡Muy popular!';
      return { 
        price: suggested, 
        trend: 'up', 
        message,
        originalPrice: product.price,
        discount: null
      };
    } else if (suggested < product.price) {
      const discountPercent = Math.round(((product.price - suggested) / product.price) * 100);
      return { 
        price: suggested, 
        trend: 'down', 
        message: `💰 Oferta -${discountPercent}%`,
        originalPrice: product.price,
        discount: discountPercent
      };
    }
    
    return { 
      price: product.price, 
      trend: 'stable', 
      message: '',
      originalPrice: product.price,
      discount: null
    };
  },
  
  /**
   * Obtiene el precio óptimo para maximizar ingresos
   * @param {Object} product - Producto
   * @returns {Object} - Precio óptimo y proyección
   */
  getOptimalPrice(product) {
    const currentPrice = product.price;
    const demand = this.getDemandScore(product.id);
    const salesHistory = this.getSalesCount(product.id);
    
    // Elasticidad de precio estimada
    let elasticity = -1.5; // Por defecto, elástico
    
    if (salesHistory > 50) {
      // Calcular elasticidad real si hay datos
      elasticity = -1.2;
    }
    
    // Precio óptimo según elasticidad
    let optimalPrice = currentPrice;
    let expectedRevenue = 0;
    
    if (demand > 0.7) {
      // Alta demanda: subir precio
      optimalPrice = currentPrice * 1.1;
      expectedRevenue = optimalPrice * salesHistory * 0.9; // Pérdida de 10% de ventas
    } else if (demand < 0.3) {
      // Baja demanda: bajar precio
      optimalPrice = currentPrice * 0.85;
      expectedRevenue = optimalPrice * salesHistory * 1.3; // Ganancia de 30% de ventas
    } else {
      expectedRevenue = currentPrice * salesHistory;
    }
    
    return {
      currentPrice,
      optimalPrice: Math.round(optimalPrice / 500) * 500,
      demand,
      expectedRevenue: Math.round(expectedRevenue),
      recommendation: optimalPrice > currentPrice ? 'subir' : optimalPrice < currentPrice ? 'bajar' : 'mantener'
    };
  },
  
  /**
   * Obtiene estadísticas de precios dinámicos
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const products = db.getProducts();
    let increased = 0;
    let decreased = 0;
    let stable = 0;
    let totalRevenue = 0;
    
    products.forEach(product => {
      const { trend } = this.getPriceTag(product);
      if (trend === 'up') increased++;
      else if (trend === 'down') decreased++;
      else stable++;
      
      totalRevenue += this.suggestPrice(product) * this.getSalesCount(product.id);
    });
    
    return {
      productsAnalyzed: products.length,
      increased,
      decreased,
      stable,
      estimatedRevenue: totalRevenue,
      averageDemand: products.reduce((sum, p) => sum + this.getDemandScore(p.id), 0) / products.length
    };
  },
  
  /**
   * Actualiza todos los precios de productos (para admin)
   * @returns {Array} - Productos actualizados
   */
  updateAllPrices() {
    const products = db.getProducts();
    const updated = [];
    
    products.forEach(product => {
      const newPrice = this.suggestPrice(product);
      if (newPrice !== product.price) {
        updated.push({
          id: product.id,
          name: product.name,
          oldPrice: product.price,
          newPrice: newPrice
        });
      }
    });
    
    return updated;
  },
  
  /**
   * Obtiene la mejor estrategia de precio para un producto
   * @param {string} productId - ID del producto
   * @returns {Object} - Estrategia recomendada
   */
  getPricingStrategy(productId) {
    const products = db.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return null;
    
    const demand = this.getDemandScore(productId);
    const sales = this.getSalesCount(productId);
    const stock = this.getStockLevel(productId);
    const optimal = this.getOptimalPrice(product);
    
    let strategy = '';
    let action = '';
    
    if (stock < 5) {
      strategy = 'escasez';
      action = 'mantener precio o subir ligeramente';
    } else if (demand > 0.8 && sales > 20) {
      strategy = 'alta_demanda';
      action = 'subir precio +10%';
    } else if (demand < 0.2 && sales < 5) {
      strategy = 'baja_demanda';
      action = 'bajar precio -15% o promocionar';
    } else if (stock > 100) {
      strategy = 'exceso_stock';
      action = 'ofrecer descuento por volumen';
    } else {
      strategy = 'equilibrio';
      action = 'mantener precio actual';
    }
    
    return {
      productId,
      productName: product.name,
      currentPrice: product.price,
      optimalPrice: optimal.optimalPrice,
      demand,
      sales,
      stock,
      strategy,
      recommendedAction: action,
      confidence: demand > 0.5 ? 'alta' : 'media'
    };
  }
};
