// loyalty.js
import { CONFIG } from './config.js';

export const loyalty = {
  getPoints(userId) {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    const pointsMap = data ? JSON.parse(data) : {};
    return pointsMap[userId] || 0;
  },
  
  addPoints(userId, amountSpentOrPoints) {
    // amountSpentOrPoints puede ser monto gastado o puntos directos
    let pointsToAdd;
    if (amountSpentOrPoints > 1000) {
      // Es monto gastado (más de 1000)
      const rate = this.getPointsRate();
      pointsToAdd = Math.floor(amountSpentOrPoints / 1000) * rate;
    } else {
      // Son puntos directos
      pointsToAdd = amountSpentOrPoints;
    }
    
    const current = this.getPoints(userId);
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
    let pointsMap = data ? JSON.parse(data) : {};
    pointsMap[userId] = current + pointsToAdd;
    localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(pointsMap));
    return pointsToAdd;
  },
  
  redeemPoints(userId, pointsToRedeem) {
    const current = this.getPoints(userId);
    if (current >= pointsToRedeem) {
      const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LOYALTY);
      let pointsMap = JSON.parse(data);
      pointsMap[userId] = current - pointsToRedeem;
      localStorage.setItem(CONFIG.STORAGE_KEYS.LOYALTY, JSON.stringify(pointsMap));
      return true;
    }
    return false;
  },
  
  getPointsRate() {
    const rate = localStorage.getItem('arepas_points_rate');
    return rate ? parseInt(rate) : 1; // 1 punto por cada 1000 COP
  },
  
  setPointsRate(rate) {
    localStorage.setItem('arepas_points_rate', rate);
  },
  
  getPointsValue(points) {
    // 100 puntos = $1000 COP
    return points * 10;
  },
  
  getPointsForDiscount(discountAmount) {
    // Retorna cuántos puntos se necesitan para un descuento
    return Math.ceil(discountAmount / 10);
  }
};