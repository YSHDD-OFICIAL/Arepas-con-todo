// forecast.js
import { db } from './database.js';

export const forecast = {
  /**
   * Obtiene todas las órdenes históricas
   * @returns {Array} - Lista de órdenes
   */
  getHistoricalSales() {
    return db.getAllOrders();
  },
  
  /**
   * Obtiene el factor de demanda por día de semana
   * @param {number} day - Día de la semana (0-6, 0=domingo)
   * @returns {number} - Factor de demanda
   */
  getDayOfWeekFactor(day) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return 1;
    
    const dayOrders = orders.filter(o => new Date(o.timestamp).getDay() === day);
    const avgPerDay = orders.length / 7;
    const factor = dayOrders.length / avgPerDay;
    
    return Math.min(2.5, Math.max(0.3, factor)); // Limitar entre 0.3 y 2.5
  },
  
  /**
   * Obtiene el factor de demanda por hora
   * @param {number} hour - Hora del día (0-23)
   * @returns {number} - Factor de demanda
   */
  getHourFactor(hour) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return 1;
    
    const hourOrders = orders.filter(o => new Date(o.timestamp).getHours() === hour);
    const avgPerHour = orders.length / 24;
    const factor = hourOrders.length / avgPerHour;
    
    return Math.min(3, Math.max(0.1, factor));
  },
  
  /**
   * Obtiene el factor de demanda por mes
   * @param {number} month - Mes (0-11)
   * @returns {number} - Factor de demanda
   */
  getMonthFactor(month) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return 1;
    
    const monthOrders = orders.filter(o => new Date(o.timestamp).getMonth() === month);
    const avgPerMonth = orders.length / 12;
    const factor = monthOrders.length / avgPerMonth;
    
    return Math.min(2, Math.max(0.5, factor));
  },
  
  /**
   * Predice ventas de un producto específico
   * @param {string} productId - ID del producto
   * @param {number} daysAhead - Días a futuro
   * @returns {number} - Ventas predichas
   */
  predictSales(productId, daysAhead = 1) {
    const orders = this.getHistoricalSales();
    const productOrders = orders.filter(o => o.items.some(i => i.id === productId));
    
    if (productOrders.length === 0) return 0;
    
    // Calcular promedio diario
    const firstOrderDate = productOrders[0]?.timestamp ? new Date(productOrders[0].timestamp) : new Date();
    const daysSinceStart = Math.max(1, (Date.now() - firstOrderDate) / (1000 * 3600 * 24));
    const avgDaily = productOrders.length / daysSinceStart;
    
    // Factores estacionales
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDay = futureDate.getDay();
    const futureHour = futureDate.getHours();
    const futureMonth = futureDate.getMonth();
    
    const dayFactor = this.getDayOfWeekFactor(futureDay);
    const hourFactor = this.getHourFactor(futureHour);
    const monthFactor = this.getMonthFactor(futureMonth);
    
    // Tendencia (últimos 30 días)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000;
    const recentOrders = productOrders.filter(o => new Date(o.timestamp).getTime() > thirtyDaysAgo);
    const recentAvg = recentOrders.length / 30;
    const trend = recentAvg / Math.max(0.1, avgDaily);
    
    // Predicción combinada
    let prediction = avgDaily * dayFactor * hourFactor * monthFactor * trend;
    
    // Redondear y asegurar mínimo
    return Math.max(0, Math.round(prediction));
  },
  
  /**
   * Predice ventas totales para un día específico
   * @param {number} daysAhead - Días a futuro
   * @returns {Object} - Predicción de ventas totales
   */
  predictTotalSales(daysAhead = 1) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) {
      return { min: 0, max: 0, avg: 0, confidence: 0 };
    }
    
    // Calcular promedio diario histórico
    const dailyTotals = {};
    orders.forEach(o => {
      const day = new Date(o.timestamp).toDateString();
      if (!dailyTotals[day]) dailyTotals[day] = 0;
      dailyTotals[day] += o.total;
    });
    
    const totals = Object.values(dailyTotals);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDev = this.calculateStdDev(totals, avg);
    
    // Factores estacionales
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const dayFactor = this.getDayOfWeekFactor(futureDate.getDay());
    const monthFactor = this.getMonthFactor(futureDate.getMonth());
    
    // Tendencia (últimos 30 días vs histórico)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000;
    const recentTotals = Object.entries(dailyTotals)
      .filter(([day]) => new Date(day).getTime() > thirtyDaysAgo)
      .map(([_, total]) => total);
    const recentAvg = recentTotals.length > 0 ? recentTotals.reduce((a, b) => a + b, 0) / recentTotals.length : avg;
    const trend = recentAvg / avg;
    
    const predictedAvg = avg * dayFactor * monthFactor * trend;
    const predictedStdDev = stdDev * dayFactor;
    
    return {
      min: Math.max(0, Math.round(predictedAvg - predictedStdDev)),
      max: Math.round(predictedAvg + predictedStdDev),
      avg: Math.round(predictedAvg),
      confidence: Math.min(100, Math.round((1 - (predictedStdDev / predictedAvg)) * 100)),
      trend: trend > 1.05 ? 'up' : trend < 0.95 ? 'down' : 'stable'
    };
  },
  
  /**
   * Predice el total de mañana (alias)
   * @returns {Object} - Predicción para mañana
   */
  predictTomorrowTotal() {
    return this.predictTotalSales(1);
  },
  
  /**
   * Obtiene el mejor horario para promocionar
   * @returns {Object} - Mejor horario y confianza
   */
  getBestTimeToPromote() {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return { hour: 12, confidence: 0, peakHours: [] };
    
    const hourCount = Array(24).fill(0);
    const hourRevenue = Array(24).fill(0);
    
    orders.forEach(o => {
      const hour = new Date(o.timestamp).getHours();
      hourCount[hour]++;
      hourRevenue[hour] += o.total;
    });
    
    const maxCount = Math.max(...hourCount);
    const bestHour = hourCount.indexOf(maxCount);
    
    // Identificar horas pico (arriba del 70% del máximo)
    const peakHours = hourCount
      .map((count, hour) => ({ hour, count, percentage: (count / maxCount) * 100 }))
      .filter(h => h.percentage >= 70)
      .map(h => h.hour);
    
    const totalOrders = orders.length;
    const confidence = totalOrders > 0 ? (maxCount / totalOrders) * 100 : 0;
    
    return { 
      hour: bestHour, 
      confidence: Math.round(confidence),
      peakHours,
      revenueByHour: hourRevenue
    };
  },
  
  /**
   * Obtiene el mejor día para promocionar
   * @returns {Object} - Mejor día y confianza
   */
  getBestDayToPromote() {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return { day: 5, dayName: 'viernes', confidence: 0 };
    
    const dayCount = Array(7).fill(0);
    const dayRevenue = Array(7).fill(0);
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    
    orders.forEach(o => {
      const day = new Date(o.timestamp).getDay();
      dayCount[day]++;
      dayRevenue[day] += o.total;
    });
    
    const maxCount = Math.max(...dayCount);
    const bestDay = dayCount.indexOf(maxCount);
    const totalOrders = orders.length;
    const confidence = totalOrders > 0 ? (maxCount / totalOrders) * 100 : 0;
    
    return {
      day: bestDay,
      dayName: dayNames[bestDay],
      confidence: Math.round(confidence),
      dayRevenue
    };
  },
  
  /**
   * Predice el producto más vendido para una fecha
   * @param {number} daysAhead - Días a futuro
   * @returns {Object} - Producto más vendido predicho
   */
  predictTopProduct(daysAhead = 1) {
    const products = db.getProducts();
    let bestProduct = null;
    let maxSales = 0;
    
    products.forEach(product => {
      const predictedSales = this.predictSales(product.id, daysAhead);
      if (predictedSales > maxSales) {
        maxSales = predictedSales;
        bestProduct = product;
      }
    });
    
    return {
      product: bestProduct,
      predictedSales: maxSales,
      date: new Date(Date.now() + daysAhead * 24 * 3600000).toDateString()
    };
  },
  
  /**
   * Calcula la desviación estándar de un conjunto de datos
   * @param {Array} values - Valores numéricos
   * @param {number} mean - Media (opcional)
   * @returns {number} - Desviación estándar
   */
  calculateStdDev(values, mean = null) {
    if (values.length === 0) return 0;
    const avg = mean !== null ? mean : values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  },
  
  /**
   * Obtiene la tendencia de ventas (últimos 7 días vs anteriores)
   * @returns {Object} - Tendencia actual
   */
  getSalesTrend() {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return { trend: 'stable', percentage: 0 };
    
    const now = Date.now();
    const last7Days = now - 7 * 24 * 3600000;
    const previous7Days = last7Days - 7 * 24 * 3600000;
    
    const recentOrders = orders.filter(o => new Date(o.timestamp).getTime() > last7Days);
    const previousOrders = orders.filter(o => {
      const time = new Date(o.timestamp).getTime();
      return time > previous7Days && time <= last7Days;
    });
    
    const recentTotal = recentOrders.reduce((sum, o) => sum + o.total, 0);
    const previousTotal = previousOrders.reduce((sum, o) => sum + o.total, 0);
    
    if (previousTotal === 0) return { trend: 'up', percentage: 100 };
    
    const change = ((recentTotal - previousTotal) / previousTotal) * 100;
    
    let trend = 'stable';
    if (change > 10) trend = 'up';
    else if (change < -10) trend = 'down';
    
    return {
      trend,
      percentage: Math.round(Math.abs(change)),
      recentTotal,
      previousTotal
    };
  },
  
  /**
   * Predice el mejor horario para cada producto
   * @returns {Object} - Mapa de productos a mejor horario
   */
  getProductBestHours() {
    const products = db.getProducts();
    const bestHours = {};
    
    products.forEach(product => {
      let bestHour = 12;
      let maxSales = 0;
      
      for (let hour = 0; hour < 24; hour++) {
        const predicted = this.predictSales(product.id, 0); // Mismo día, diferente hora
        // Simulación de demanda por hora (basada en factor horario)
        const hourFactor = this.getHourFactor(hour);
        const simulatedSales = predicted * hourFactor;
        
        if (simulatedSales > maxSales) {
          maxSales = simulatedSales;
          bestHour = hour;
        }
      }
      
      bestHours[product.id] = {
        productName: product.name,
        bestHour,
        bestHourFormatted: `${bestHour}:00 - ${bestHour + 1}:00`,
        expectedSales: Math.round(maxSales)
      };
    });
    
    return bestHours;
  },
  
  /**
   * Genera un reporte completo de predicciones
   * @returns {Object} - Reporte de forecast
   */
  generateReport() {
    const tomorrow = this.predictTomorrowTotal();
    const bestTime = this.getBestTimeToPromote();
    const bestDay = this.getBestDayToPromote();
    const trend = this.getSalesTrend();
    const topProductTomorrow = this.predictTopProduct(1);
    
    return {
      generatedAt: new Date().toISOString(),
      tomorrow: {
        ...tomorrow,
        formattedMin: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(tomorrow.min),
        formattedMax: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(tomorrow.max),
        formattedAvg: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(tomorrow.avg)
      },
      bestPromotionTime: {
        hour: bestTime.hour,
        hourFormatted: `${bestTime.hour}:00 - ${bestTime.hour + 1}:00`,
        confidence: `${bestTime.confidence}%`,
        peakHours: bestTime.peakHours.map(h => `${h}:00`)
      },
      bestPromotionDay: {
        ...bestDay,
        confidence: `${bestDay.confidence}%`
      },
      trend: {
        direction: trend.trend === 'up' ? '📈 Al alza' : trend.trend === 'down' ? '📉 A la baja' : '➡️ Estable',
        percentage: `${trend.percentage}%`,
        recentTotal: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(trend.recentTotal),
        previousTotal: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(trend.previousTotal)
      },
      topProductTomorrow: topProductTomorrow.product ? {
        name: topProductTomorrow.product.name,
        predictedSales: topProductTomorrow.predictedSales,
        price: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(topProductTomorrow.product.price)
      } : null
    };
  }
};
