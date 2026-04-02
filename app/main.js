// main.js - Entry point principal con todas las integraciones
import { auth } from './auth.js';
import { cart } from './cart.js';
import { ai } from './ai.js';
import { db } from './database.js';
import { formatCurrency, showVibration, downloadJSON } from './utils.js';
import { navigate } from './transition.js';
import { CONFIG, FEATURES } from './config.js';
import { detectDevTools, checkTampering } from './security.js';
import { dynamicPricing } from './dynamicPricing.js';
import { missions } from './achievements.js';
import { referrals } from './referrals.js';
import { forecast } from './forecast.js';
import { fraudDetector } from './fraudDetector.js';
import { inventory } from './inventory.js';
import { abTesting } from './abTesting.js';
import { loyalty } from './loyalty.js';
import { coupons } from './coupons.js';
import { requestNotificationPermission, scheduleCartReminder } from './notifications.js';
import { sync } from './sync.js';

// Inicialización de seguridad
detectDevTools();
checkTampering();

// Protección de rutas
const publicPages = ['index.html'];
const currentPage = window.location.pathname.split('/').pop();
if (!publicPages.includes(currentPage) && !auth.getSession()) {
  window.location.href = 'index.html';
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW error:', err));
}

// Offline detection
window.addEventListener('online', () => {
  document.getElementById('offline-banner')?.classList.add('hidden');
});
window.addEventListener('offline', () => {
  document.getElementById('offline-banner')?.classList.remove('hidden');
});
if (!navigator.onLine) document.getElementById('offline-banner')?.classList.remove('hidden');

// Cargar lógica según página
if (currentPage === 'index.html') {
  initAuth();
} else if (currentPage === 'menu.html') {
  initMenu();
} else if (currentPage === 'carrito.html') {
  initCart();
} else if (currentPage === 'cuenta.html') {
  initAccount();
} else if (currentPage === 'admin.html') {
  initAdmin();
}

// ==================== FUNCIONES DE PÁGINA ====================

function initAuth() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabs = document.querySelectorAll('.tab-btn');
  const exportBtn = document.getElementById('export-account-btn');
  const importBtn = document.getElementById('import-account-btn');
  const messageDiv = document.getElementById('auth-message');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
    });
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      auth.login(loginForm['login-email'].value, loginForm['login-password'].value);
      window.location.href = 'menu.html';
    } catch (err) {
      messageDiv.innerText = err.message;
    }
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const refCode = document.getElementById('reg-ref-code')?.value || null;
      auth.register(registerForm['reg-email'].value, registerForm['reg-password'].value, refCode);
      window.location.href = 'menu.html';
    } catch (err) {
      messageDiv.innerText = err.message;
    }
  });

  exportBtn?.addEventListener('click', () => {
    try {
      const code = auth.exportAccount();
      prompt('Copia este código para respaldo:', code);
    } catch (err) { messageDiv.innerText = err.message; }
  });
  
  importBtn?.addEventListener('click', () => {
    const code = prompt('Pega el código de tu cuenta:');
    if (code) {
      try {
        auth.importAccount(code);
        window.location.reload();
      } catch (err) { messageDiv.innerText = err.message; }
    }
  });
}

function initMenu() {
  const container = document.getElementById('products-container');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  let products = db.getProducts();

  function render() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const filtered = products.filter(p => 
      (category === 'all' || p.category === category) &&
      p.name.toLowerCase().includes(search)
    );
    
    container.innerHTML = filtered.map(p => {
      let priceDisplay, priceInfo = null;
      if (FEATURES.dynamicPricing) {
        priceInfo = dynamicPricing.getPriceTag(p);
        priceDisplay = formatCurrency(priceInfo.price);
      } else {
        priceDisplay = formatCurrency(p.price);
      }
      
      const stockInfo = FEATURES.inventory ? `(${inventory.getStock(p.id)} disponibles)` : '';
      const isOutOfStock = FEATURES.inventory && !inventory.isAvailable(p.id, 1);
      
      return `
        <div class="product-card" data-id="${p.id}">
          <div class="product-img">${p.emoji || '🌽'}</div>
          <div class="product-title">${p.name}</div>
          <div class="product-price">
            ${priceDisplay}
            ${priceInfo?.message ? `<small class="price-tag ${priceInfo.trend}">${priceInfo.message}</small>` : ''}
            <small>${stockInfo}</small>
          </div>
          <button class="btn-add" data-id="${p.id}" ${isOutOfStock ? 'disabled style="opacity:0.5"' : ''}>
            ${isOutOfStock ? '❌ Agotado' : '+ Agregar'}
          </button>
          <button class="favorite-btn" data-id="${p.id}">❤️</button>
        </div>
      `;
    }).join('');
    attachEvents();
  }

  function attachEvents() {
    document.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const id = btn.dataset.id;
        const product = products.find(p => p.id === id);
        const priceToUse = FEATURES.dynamicPricing ? dynamicPricing.getPriceTag(product).price : product.price;
        const productWithPrice = { ...product, price: priceToUse };
        cart.addToCart(productWithPrice);
        ai.track(productWithPrice, auth.getSession()?.userId);
        showVibration();
        cart.updateCartBadge();
        
        if (FEATURES.fraudDetection) {
          fraudDetector.track('add_to_cart', auth.getSession()?.userId);
        }
      });
    });