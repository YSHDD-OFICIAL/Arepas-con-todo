// notifications.js
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Este navegador no soporta notificaciones');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notificaciones permitidas');
    return true;
  }
  return false;
}

export function sendLocalNotification(title, body, icon = '/assets/icons/icon-192.png') {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, { body, icon, badge: icon });
    });
  }
}

let reminderTimeout;
export function scheduleCartReminder(cartItems, userId) {
  if (reminderTimeout) clearTimeout(reminderTimeout);
  if (!cartItems || cartItems.length === 0) return;
  
  reminderTimeout = setTimeout(() => {
    sendLocalNotification(
      '🛒 ¡Tu carrito te espera!',
      `Tienes ${cartItems.length} productos pendientes. ¡Completa tu pedido!`
    );
  }, 30 * 60 * 1000);
}

export function scheduleOrderReminder(orderTime) {
  const orderDate = new Date(orderTime);
  const now = new Date();
  const timeDiff = orderDate - now;
  
  if (timeDiff > 0 && timeDiff < 3600000) {
    setTimeout(() => {
      sendLocalNotification('⏰ Tu pedido está listo', 'Tu pedido ya debería estar en camino');
    }, timeDiff);
  }
}

let promoInterval;
export function scheduleWeeklyPromo(callback) {
  if (promoInterval) clearInterval(promoInterval);
  // Revisar cada 6 horas
  promoInterval = setInterval(() => {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    // Promociones: viernes 7 PM
    if (day === 5 && hour === 19) {
      sendLocalNotification('🍔 Promoción especial', '¡Viernes de Arepas! 2x1 en Reina Pepiada');
      if (callback) callback();
    }
  }, 3600000);
}