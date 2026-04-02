// config.js
export const CONFIG = {
  APP_NAME: 'Deliciosas Arepas con Todo',
  VERSION: '2.0.0',
  NEQUI_NUMBER: '3002647618',
  WHATSAPP_NUMBER: '573002647618',
  ADMIN_EMAIL: 'admin@arepas.com',
  
  // Productos por defecto
  DEFAULT_PRODUCTS: [
    { id: 'a1', name: 'Arepa Clásica', price: 8000, category: 'clasicas', emoji: '🧀', image: '🌽', stock: 50 },
    { id: 'a2', name: 'Reina Pepiada', price: 12000, category: 'especiales', emoji: '🥑', image: '🥑', stock: 40 },
    { id: 'a3', name: 'La Pelúa', price: 13000, category: 'especiales', emoji: '🥩', image: '🥩', stock: 35 },
    { id: 'a4', name: 'Veggie Power', price: 11000, category: 'veggie', emoji: '🥬', image: '🥬', stock: 30 },
    { id: 'a5', name: 'Dominicana', price: 14000, category: 'especiales', emoji: '🍌', image: '🍌', stock: 25 },
    { id: 'a6', name: 'Solo Queso', price: 7000, category: 'clasicas', emoji: '🧀', image: '🧀', stock: 60 }
  ],
  
  // Claves de almacenamiento local
  STORAGE_KEYS: {
    USERS: 'arepas_users',
    SESSION: 'arepas_session',
    CART: 'arepas_cart',
    BRAIN: 'arepas_brain',
    FAVORITES: 'arepas_favorites',
    ORDERS_HISTORY: 'arepas_orders',
    PENDING_ORDERS: 'arepas_pending_orders',
    COUPONS: 'arepas_coupons',
    LOYALTY: 'arepas_loyalty',
    REFERRALS: 'arepas_referrals',
    REF_CODES: 'arepas_ref_codes',
    MISSIONS: 'arepas_missions',
    INVENTORY: 'arepas_inventory',
    AB_TESTS: 'arepas_ab_tests',
    FRAUD_ALERTS: 'arepas_fraud_alerts',
    THEME: 'arepas_theme',
    DEBUG: 'arepas_debug'
  },
  
  // Configuración de sesión
  SESSION_DURATION_DAYS: 30,
  
  // Configuración de puntos de lealtad
  LOYALTY_RATE: 1, // 1 punto por cada 1000 COP
  POINTS_TO_CASH_RATIO: 10, // 10 puntos = 100 COP
  
  // Límites y umbrales
  MAX_CART_ITEMS: 50,
  MIN_ORDER_AMOUNT: 0,
  FREE_DELIVERY_AMOUNT: 30000,
  
  // Categorías disponibles
  CATEGORIES: [
    { id: 'clasicas', name: 'Clásicas', icon: '🌽' },
    { id: 'especiales', name: 'Especiales', icon: '🔥' },
    { id: 'veggie', name: 'Veggie', icon: '🥬' }
  ],
  
  // Métodos de pago
  PAYMENT_METHODS: [
    { id: 'nequi', name: 'Nequi', number: '3002647618', icon: '🟣' },
    { id: 'transfer', name: 'Transferencia Bancolombia', icon: '🏦' }
  ],
  
  // Horario de atención
  BUSINESS_HOURS: {
    open: 8, // 8 AM
    close: 22, // 10 PM
    daysOpen: [1, 2, 3, 4, 5, 6] // Lunes a Sábado
  },
  
  // URLs y enlaces
  LINKS: {
    WHATSAPP: 'https://wa.me/573002647618',
    INSTAGRAM: 'https://instagram.com/arepascontodo',
    FACEBOOK: 'https://facebook.com/arepascontodo'
  }
};

// Características activas/desactivadas
export const FEATURES = {
  // Funcionalidades principales
  dynamicPricing: true,    // Precios dinámicos con IA
  achievements: true,       // Misiones y logros
  referrals: true,          // Sistema de referidos
  forecast: true,           // Predicción de ventas
  fraudDetection: true,     // Detección de fraudes
  inventory: true,          // Gestión de inventario
  abTesting: true,          // Pruebas A/B
  loyalty: true,            // Puntos de fidelidad
  coupons: true,            // Cupones de descuento
  notifications: false,     // Notificaciones push (experimental)
  
  // Funcionalidades UI/UX
  offlineMode: true,        // Modo offline
  vibrations: true,         // Vibración en interacciones
  sounds: false,            // Sonidos (requiere assets)
  animations: true,         // Animaciones y transiciones
  
  // Modos de depuración
  debugMode: false,         // Modo debug (logs detallados)
  resetOnError: false       // Reiniciar datos en caso de error crítico
};

// Helper para verificar si una característica está activa
export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] === true;
}

// Helper para obtener configuración
export function getConfig(key) {
  return CONFIG[key];
}

// Helper para obtener URL de WhatsApp con mensaje personalizado
export function getWhatsAppUrl(message = '') {
  const baseUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
}

// Helper para verificar si el negocio está abierto
export function isBusinessOpen() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ...
  
  if (day === 0) return false; // Domingo cerrado
  if (hour < CONFIG.BUSINESS_HOURS.open) return false;
  if (hour >= CONFIG.BUSINESS_HOURS.close) return false;
  
  return true;
}

// Helper para obtener mensaje de estado del negocio
export function getBusinessStatusMessage() {
  if (isBusinessOpen()) {
    const now = new Date();
    const closeHour = CONFIG.BUSINESS_HOURS.close;
    const hoursUntilClose = closeHour - now.getHours();
    if (hoursUntilClose <= 1) {
      return `🕒 Cerramos en ${hoursUntilClose} hora${hoursUntilClose !== 1 ? 's' : ''}`;
    }
    return '✅ Abierto - Recibiendo pedidos';
  } else {
    const day = new Date().getDay();
    if (day === 0) {
      return '❌ Cerrado los domingos';
    }
    return `❌ Cerrado - Abrimos a las ${CONFIG.BUSINESS_HOURS.open}:00`;
  }
}
