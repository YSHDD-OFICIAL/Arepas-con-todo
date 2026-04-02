// achievements.js
const MISSIONS_KEY = 'arepas_missions';

export const missions = {
  list: [
    { id: 'first_purchase', name: '🎉 Primer pedido', description: 'Realiza tu primera compra', condition: (userOrders) => userOrders.length >= 1, reward: 50 },
    { id: 'arepa_lover', name: '❤️ Arepa Lover', description: 'Compra 10 arepas', condition: (userOrders) => userOrders.reduce((sum, o) => sum + o.items.length, 0) >= 10, reward: 200 },
    { id: 'weekend_warrior', name: '📅 Guerrero de finde', description: 'Compra un sábado o domingo', condition: (userOrders) => userOrders.some(o => [0, 6].includes(new Date(o.timestamp).getDay())), reward: 100 },
    { id: 'sharing_is_caring', name: '👥 Embajador', description: 'Refiere a un amigo', condition: (_, referrals) => referrals >= 1, reward: 150 },
    { id: 'five_star', name: '⭐ Cinco estrellas', description: 'Gasta más de $50,000 en un pedido', condition: (userOrders) => userOrders.some(o => o.total >= 50000), reward: 300 },
    { id: 'early_bird', name: '🌅 Madrugador', description: 'Compra antes de las 10 AM', condition: (userOrders) => userOrders.some(o => new Date(o.timestamp).getHours() < 10), reward: 80 }
  ],
  
  getUserProgress(userId) {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    return all[userId] || { completed: [], referrals: 0, pointsEarned: 0 };
  },
  
  saveProgress(userId, progress) {
    const data = localStorage.getItem(MISSIONS_KEY);
    const all = data ? JSON.parse(data) : {};
    all[userId] = progress;
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(all));
  },
  
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
      this.saveProgress(userId, progress);
      
      // Sumar puntos al sistema de lealtad
      import('./loyalty.js').then(({ loyalty }) => {
        loyalty.addPoints(userId, newRewards);
      });
      
      this.showNotification(userId, newlyCompleted, newRewards);
    }
    return newRewards;
  },
  
  showNotification(userId, missions, points) {
    const message = `🎁 ¡Misiones completadas! +${points} puntos`;
    if (Notification.permission === 'granted') {
      new Notification('🏆 Logro desbloqueado', { body: message });
    }
    // También mostrar en UI si existe
    const container = document.getElementById('achievements-toast');
    if (container) {
      container.innerHTML = `<div class="toast">${message}</div>`;
      setTimeout(() => container.innerHTML = '', 3000);
    }
  },
  
  getCompletedCount(userId) {
    const progress = this.getUserProgress(userId);
    return progress.completed.length;
  },
  
  getTotalPoints(userId) {
    const progress = this.getUserProgress(userId);
    return progress.pointsEarned || 0;
  }
};