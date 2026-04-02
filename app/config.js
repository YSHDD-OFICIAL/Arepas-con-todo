// config.js
export const CONFIG = {
  APP_NAME: 'Deliciosas Arepas con Todo',
  NEQUI_NUMBER: '3002647618',
  WHATSAPP_NUMBER: '573002647618',
  ADMIN_EMAIL: 'admin@arepas.com',
  DEFAULT_PRODUCTS: [
    { id: 'a1', name: 'Arepa Clásica', price: 8000, category: 'clasicas', emoji: '🧀', image: '🌽', stock: 50 },
    { id: 'a2', name: 'Reina Pepiada', price: 12000, category: 'especiales', emoji: '🥑', image: '🥑', stock: 40 },
    { id: 'a3', name: 'La Pelúa', price: 13000, category: 'especiales', emoji: '🥩', image: '🥩', stock: 35 },
    { id: 'a4', name: 'Veggie Power', price: 11000, category: 'veggie', emoji: '🥬', image: '🥬', stock: 30 },
    { id: 'a5', name: 'Dominicana', price: 14000, category: 'especiales', emoji: '🍌', image: '🍌', stock: 25 },
    { id: 'a6', name: 'Solo Queso', price: 7000, category: 'clasicas', emoji: '🧀', image: '🧀', stock: 60 }
  ],
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
    FRAUD_ALERTS: 'arepas_fraud_alerts'
  }
};

export const FEATURES = {
  dynamicPricing: true,
  achievements: true,
  referrals: true,
  forecast: true,
  fraudDetection: true,
  inventory: true,
  abTesting: true,
  loyalty: true,
  coupons: true,
  notifications: false
};