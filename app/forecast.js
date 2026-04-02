// forecast.js
import { db } from './database.js';

export const forecast = {
  getHistoricalSales() {
    return db.getAllOrders();
  },
  
  getDayOfWeekFactor(day) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return 1;
    const dayOrders = orders.filter(o => new Date(o.timestamp).getDay() === day);
    const avgPerDay = orders.length / 7;
    return dayOrders.length / avgPerDay;
  },
  
  getHourFactor(hour) {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return 1;
    const hourOrders = orders.filter(o => new Date(o.timestamp).getHours() === hour);
    const avgPerHour = orders.length / 24;
    return hourOrders.length / avgPerHour;
  },
  
  predictSales(productId, daysAhead = 1) {
    const orders = this.getHistoricalSales();
    const productOrders = orders.filter(o => o.items.some(i => i.id === productId));
    const firstOrderDate = orders[0]?.timestamp ? new Date(orders[0].timestamp) : new Date();
    const daysSinceStart = Math.max(1, (Date.now() - firstOrderDate) / (1000 * 3600 * 24));
    const avgDaily = productOrders.length / daysSinceStart;
    
    const futureDay = (new Date().getDay() + daysAhead) % 7;
    const factor = this.getDayOfWeekFactor(futureDay);
    return Math.round(avgDaily * factor);
  },
  
  getBestTimeToPromote() {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return { hour: 12, confidence: 0 };
    
    const hourCount = Array(24).fill(0);
    orders.forEach(o => {
      const hour = new Date(o.timestamp).getHours();
      hourCount[hour]++;
    });
    const bestHour = hourCount.indexOf(Math.max(...hourCount));
    const totalOrders = orders.length;
    const confidence = totalOrders > 0 ? Math.max(...hourCount) / totalOrders : 0;
    
    return { hour: bestHour, confidence: Math.round(confidence * 100) };
  },
  
  predictTomorrowTotal() {
    const orders = this.getHistoricalSales();
    if (orders.length === 0) return { min: 0, max: 0, avg: 0 };
    
    const dailyTotals = {};
    orders.forEach(o => {
      const day = new Date(o.timestamp).toDateString();
      if (!dailyTotals[day]) dailyTotals[day] = 0;
      dailyTotals[day] += o.total;
    });
    
    const totals = Object.values(dailyTotals);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const factor = this.getDayOfWeekFactor((new Date().getDay() + 1) % 7);
    
    return {
      min: Math.round(avg * factor * 0.7),
      max: Math.round(avg * factor * 1.3),
      avg: Math.round(avg * factor)
    };
  }
};