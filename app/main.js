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
    
    // Favoritos
    const session = auth.getSession();
    if (session) {
      let favs = db.getFavorites(session.userId);
      document.querySelectorAll('.favorite-btn').forEach(btn => {
        const id = btn.dataset.id;
        if (favs.includes(id)) btn.style.color = 'red';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isFav = favs.includes(id);
          if (isFav) {
            favs = favs.filter(f => f !== id);
            db.saveFavorite(session.userId, id, false);
            btn.style.color = 'white';
          } else {
            favs.push(id);
            db.saveFavorite(session.userId, id, true);
            btn.style.color = 'red';
          }
        });
      });
    }
  }

  searchInput.addEventListener('input', render);
  categoryFilter.addEventListener('change', render);
  render();
  cart.updateCartBadge();
  
  if (auth.isAdmin()) document.getElementById('admin-link')?.classList.remove('hidden');
}

function initCart() {
  const container = document.getElementById('cart-items');
  const subtotalSpan = document.getElementById('cart-subtotal');
  const totalSpan = document.getElementById('cart-total');
  const discountLine = document.getElementById('discount-line');
  const discountAmountSpan = document.getElementById('discount-amount');
  const confirmBtn = document.getElementById('confirm-payment-btn');
  const repeatBtn = document.getElementById('repeat-order-btn');
  const applyCouponBtn = document.getElementById('apply-coupon');
  const couponInput = document.getElementById('coupon-code');
  const couponFeedback = document.getElementById('coupon-feedback');
  const redeemPointsBtn = document.getElementById('redeem-points');
  const userPointsSpan = document.getElementById('user-points');
  
  let appliedCoupon = null;
  let pointsDiscount = 0;
  const session = auth.getSession();
  let userId = session?.userId;
  
  // Mostrar puntos del usuario
  if (userId && FEATURES.loyalty) {
    const points = loyalty.getPoints(userId);
    userPointsSpan.innerText = points;
  }
  
  function getTotalWithDiscounts() {
    let subtotal = cart.total();
    let discount = 0;
    
    if (appliedCoupon) {
      const newTotal = coupons.applyDiscount(appliedCoupon, subtotal);
      discount = subtotal - newTotal;
      subtotal = newTotal;
    }
    
    if (pointsDiscount > 0) {
      discount += pointsDiscount;
      subtotal = Math.max(0, subtotal - pointsDiscount);
    }
    
    return { total: subtotal, discount };
  }
  
  function renderCart() {
    const items = cart.getCart();
    if (items.length === 0) {
      container.innerHTML = '<p>Carrito vacío</p>';
      subtotalSpan.innerText = formatCurrency(0);
      totalSpan.innerText = formatCurrency(0);
      discountLine?.classList.add('hidden');
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div class="cart-item">
        <span>${item.name} x${item.quantity}</span>
        <span>${formatCurrency(item.price * item.quantity)}</span>
        <button class="remove-item" data-id="${item.id}">🗑️</button>
      </div>
    `).join('');
    
    const subtotal = cart.total();
    const { total, discount } = getTotalWithDiscounts();
    subtotalSpan.innerText = formatCurrency(subtotal);
    
    if (discount > 0) {
      discountLine?.classList.remove('hidden');
      discountAmountSpan.innerText = formatCurrency(discount);
    } else {
      discountLine?.classList.add('hidden');
    }
    totalSpan.innerText = formatCurrency(total);
    
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        cart.removeItem(btn.dataset.id);
        renderCart();
      });
    });
    
    // Schedule reminder
    scheduleCartReminder(items, userId);
  }
  
  // Aplicar cupón
  applyCouponBtn?.addEventListener('click', () => {
    const code = couponInput.value.trim();
    if (!code) return;
    
    const validation = coupons.validateCoupon(code, userId);
    if (validation.valid) {
      appliedCoupon = validation.coupon;
      couponFeedback.innerText = `✅ Cupón aplicado: ${code}`;
      couponFeedback.style.color = '#4caf50';
      renderCart();
      
      if (FEATURES.fraudDetection) {
        fraudDetector.track('coupon_apply', userId, { code });
      }
    } else {
      couponFeedback.innerText = `❌ ${validation.reason}`;
      couponFeedback.style.color = '#f44336';
      if (FEATURES.fraudDetection) {
        fraudDetector.track('coupon_fail', userId, { code });
      }
    }
  });
  
  // Canjear puntos
  redeemPointsBtn?.addEventListener('click', () => {
    if (!FEATURES.loyalty) return;
    const points = loyalty.getPoints(userId);
    if (points >= 100) {
      if (loyalty.redeemPoints(userId, 100)) {
        pointsDiscount = 1000; // $1000 descuento
        renderCart();
        userPointsSpan.innerText = loyalty.getPoints(userId);
        alert('¡Canjeaste 100 puntos por $1000 de descuento!');
      }
    } else {
      alert(`No tienes suficientes puntos. Tienes ${points} puntos.`);
    }
  });
  
  // Confirmar pago
  confirmBtn.addEventListener('click', () => {
    if (cart.getCart().length === 0) return alert('Carrito vacío');
    
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const { total } = getTotalWithDiscounts();
    const itemsText = cart.getCart().map(i => `${i.name} x${i.quantity}`).join(', ');
    const message = `✅ *NUEVO PEDIDO* %0A📦 ${itemsText}%0A💰 Total: ${formatCurrency(total)}%0A💳 Pagaré por: ${paymentMethod === 'nequi' ? 'Nequi' : 'Transferencia'}%0A👤 Cliente: ${session?.email}%0A📍 Confirmo mi pago.`;
    const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`;
    
    // Marcar cupón como usado
    if (appliedCoupon) {
      coupons.markAsUsed(appliedCoupon.code, userId);
    }
    
    // Guardar orden y sumar puntos por lealtad
    cart.saveLastOrder();
    if (FEATURES.loyalty) {
      loyalty.addPoints(userId, total);
    }
    
    // Actualizar misiones
    const orders = db.getOrdersHistory(userId);
    const referralsCount = referrals.getReferralCount(userId);
    missions.checkAndReward(userId, orders, referralsCount);
    
    // Track para A/B testing
    if (FEATURES.abTesting) {
      abTesting.trackConversion('checkout_test', 'completed', userId);
    }
    
    cart.clearCart();
    renderCart();
    window.open(whatsappUrl, '_blank');
    alert('Pedido registrado. Envía el comprobante por WhatsApp.');
    navigate('menu.html');
  });
  
  repeatBtn?.addEventListener('click', () => cart.repeatLastOrder());
  renderCart();
  cart.updateCartBadge();
}

function initAccount() {
  const session = auth.getSession();
  if (!session) return;
  
  document.getElementById('user-email').innerText = session.email;
  document.getElementById('logout-btn').addEventListener('click', () => auth.logout());
  
  // Puntos totales
  if (FEATURES.loyalty) {
    const points = loyalty.getPoints(session.userId);
    const missionsPoints = missions.getTotalPoints(session.userId);
    document.getElementById('total-points').innerText = points + missionsPoints;
  }
  
  // Código de referido
  if (FEATURES.referrals) {
    const code = referrals.getCode(session.userId);
    document.getElementById('ref-code').innerText = code;
    document.getElementById('ref-count').innerText = referrals.getReferralCount(session.userId);
    document.getElementById('share-ref-btn')?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({ title: 'Prueba Arepas con Todo', text: `Usa mi código ${code} y gana descuentos`, url: window.location.origin });
      } else {
        prompt('Comparte este código:', code);
      }
    });
  }
  
  // Logros
  const progress = missions.getUserProgress(session.userId);
  const achievementsDiv = document.getElementById('achievements-list');
  if (achievementsDiv) {
    achievementsDiv.innerHTML = missions.list.map(m => `
      <div class="achievement-card ${progress.completed.includes(m.id) ? 'completed' : ''}">
        <div>${m.name}</div>
        <small>${m.description}</small>
        <div>🏆 +${m.reward} pts</div>
      </div>
    `).join('');
  }
  
  // Favoritos
  const favs = db.getFavorites(session.userId);
  const products = db.getProducts();
  const favProducts = products.filter(p => favs.includes(p.id));
  const favContainer = document.getElementById('favorites-list');
  if (favContainer) {
    favContainer.innerHTML = favProducts.map(p => `<div class="product-card">${p.name} - ${formatCurrency(p.price)}</div>`).join('');
  }
  
  // Recomendaciones IA
  const recos = FEATURES.ai ? ai.recommend(4, session.userId) : products.slice(0, 4);
  const recContainer = document.getElementById('recommendations-list');
  if (recContainer) {
    recContainer.innerHTML = recos.map(p => `<div class="product-card">${p.name} - ${formatCurrency(p.price)}</div>`).join('');
  }
  
  // Historial
  const orders = db.getOrdersHistory(session.userId);
  const historyDiv = document.getElementById('order-history-list');
  if (historyDiv) {
    historyDiv.innerHTML = orders.map(o => `<div>📅 ${new Date(o.timestamp).toLocaleString()} - Total ${formatCurrency(o.total)}</div>`).join('') || '<p>Sin pedidos</p>';
  }
  
  // Exportar/importar
  document.getElementById('export-account-btn')?.addEventListener('click', () => {
    const code = auth.exportAccount();
    prompt('Copia este código:', code);
  });
  document.getElementById('import-account-btn')?.addEventListener('click', () => {
    const code = prompt('Pega código:');
    if (code) auth.importAccount(code);
  });
  
  // Descargar datos GDPR
  document.getElementById('download-data-btn')?.addEventListener('click', () => {
    const data = auth.exportAllUserData();
    downloadJSON(data, `arepas_my_data_${Date.now()}.json`);
  });
  
  // Tema oscuro/claro
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') document.body.classList.add('light-mode');
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });
  
  // Notificaciones
  if (FEATURES.notifications && Notification.permission !== 'granted') {
    const notifBtn = document.createElement('button');
    notifBtn.innerText = '🔔 Activar notificaciones';
    notifBtn.classList.add('btn-secondary');
    notifBtn.onclick = () => requestNotificationPermission();
    document.querySelector('.profile-card')?.appendChild(notifBtn);
  }
}

function initAdmin() {
  if (!auth.isAdmin()) {
    alert('Acceso denegado');
    navigate('menu.html');
    return;
  }
  
  // Tabs
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-tab-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contents.forEach(c => c.classList.add('hidden'));
      document.getElementById(`${tab.dataset.tab}-tab`).classList.remove('hidden');
    });
  });
  
  // Estadísticas
  const top = ai.getTopProducts();
  const products = db.getProducts();
  const topList = document.getElementById('top-products-list');
  if (topList) {
    topList.innerHTML = top.map(t => {
      const prod = products.find(p => p.id === t.id);
      return `<li>${prod?.name || t.id} - ${t.score} veces</li>`;
    }).join('');
  }
  
  // Forecast
  const bestTime = forecast.getBestTimeToPromote();
  document.getElementById('best-promo-time').innerText = `${bestTime.hour}:00 (${bestTime.confidence}% confianza)`;
  const tomorrow = forecast.predictTomorrowTotal();
  document.getElementById('forecast-tomorrow').innerHTML = `💰 ${formatCurrency(tomorrow.avg)} (rango: ${formatCurrency(tomorrow.min)} - ${formatCurrency(tomorrow.max)})`;
  
  // Gráfico de ventas
  const orders = db.getAllOrders();
  const last7Days = Array(7).fill(0);
  orders.forEach(o => {
    const dayDiff = Math.floor((Date.now() - new Date(o.timestamp)) / (1000 * 3600 * 24));
    if (dayDiff < 7) last7Days[6 - dayDiff] += o.total;
  });
  const ctx = document.getElementById('sales-chart')?.getContext('2d');
  if (ctx && window.Chart) {
    new Chart(ctx, {
      type: 'line',
      data: { labels: ['Hace 6d', 'Hace 5d', 'Hace 4d', 'Hace 3d', 'Hace 2d', 'Ayer', 'Hoy'], datasets: [{ label: 'Ventas', data: last7Days, borderColor: '#ff6b35', tension: 0.3 }] }
    });
  }
  
  // Órdenes pendientes
  const pending = db.getPendingOrders();
  const pendingDiv = document.getElementById('pending-orders-list');
  if (pendingDiv) {
    pendingDiv.innerHTML = pending.map(o => `<div><strong>${o.userEmail}</strong> - ${new Date(o.timestamp).toLocaleString()} - Total ${formatCurrency(o.total)}</div>`).join('');
  }
  document.getElementById('clear-orders-btn')?.addEventListener('click', () => {
    db.clearPendingOrders();
    location.reload();
  });
  
  // Inventario
  if (FEATURES.inventory) {
    const invDiv = document.getElementById('inventory-list');
    if (invDiv) {
      products.forEach(p => {
        invDiv.innerHTML += `
          <div style="display:flex; gap:8px; margin:8px 0; align-items:center;">
            <span style="flex:2">${p.name}</span>
            <input type="number" id="stock-${p.id}" value="${inventory.getStock(p.id)}" min="0" style="flex:1">
            <button onclick="window.updateStock('${p.id}')" class="btn-secondary">Actualizar</button>
          </div>
        `;
      });
      window.updateStock = (productId) => {
        const input = document.getElementById(`stock-${productId}`);
        inventory.setStock(productId, parseInt(input.value));
        alert('Stock actualizado');
      };
    }
  }
  
  // Cupones
  const couponList = document.getElementById('coupons-list');
  function refreshCoupons() {
    if (!couponList) return;
    const allCoupons = coupons.getAvailableCoupons();
    couponList.innerHTML = allCoupons.map(c => `
      <div style="border:1px solid #333; padding:8px; margin:8px 0; border-radius:8px;">
        <strong>${c.code}</strong> - ${c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`}
        <br>Usos: ${c.usedCount}${c.maxUses ? `/${c.maxUses}` : ''}
        <br>Expira: ${new Date(c.expires).toLocaleDateString()}
        <button onclick="window.deleteCoupon('${c.code}')" class="btn-secondary">Eliminar</button>
      </div>
    `).join('');
  }
  window.deleteCoupon = (code) => {
    coupons.deleteCoupon(code);
    refreshCoupons();
  };
  document.getElementById('create-coupon-btn')?.addEventListener('click', () => {
    const code = document.getElementById('coupon-code-new').value;
    const type = document.getElementById('coupon-type').value;
    const value = parseFloat(document.getElementById('coupon-value').value);
    const expires = document.getElementById('coupon-expires').value;
    if (code && value && expires) {
      coupons.addCoupon(code, type, value, expires);
      refreshCoupons();
      alert('Cupón creado');
    }
  });
  refreshCoupons();
  
  // A/B Tests
  const abList = document.getElementById('abtests-list');
  function refreshABTests() {
    if (!abList) return;
    const tests = abTesting.getAllTests();
    abList.innerHTML = Object.entries(tests).map(([id, test]) => `
      <div style="border:1px solid #333; padding:8px; margin:8px 0; border-radius:8px;">
        <strong>${test.name}</strong> (${test.ended ? 'Finalizada' : 'Activa'})
        <br>Variantes: ${test.variants.join(' vs ')}
        <br>Resultados: ${Object.entries(test.results).map(([v, d]) => `${v}: ${d.views} vistas, ${d.conversions} conversiones (${d.views ? ((d.conversions/d.views)*100).toFixed(1) : 0}%)`).join(' | ')}
        ${!test.ended ? `<button onclick="window.endTest('${id}')" class="btn-secondary">Finalizar</button>` : ''}
      </div>
    `).join('');
  }
  window.endTest = (testId) => {
    abTesting.endTest(testId);
    refreshABTests();
  };
  document.getElementById('create-abtest-btn')?.addEventListener('click', () => {
    const name = prompt('Nombre de la prueba:');
    const variantA = prompt('Variante A:');
    const variantB = prompt('Variante B:');
    if (name && variantA && variantB) {
      abTesting.createTest(`test_${Date.now()}`, name, [variantA, variantB]);
      refreshABTests();
    }
  });
  refreshABTests();
  
  // Alertas de fraude
  const fraudList = document.getElementById('fraud-alerts-list');
  if (fraudList) {
    const alerts = fraudDetector.getAlerts();
    fraudList.innerHTML = alerts.map(a => `<div>🔴 ${new Date(a.timestamp).toLocaleString()} - ${a.alert}</div>`).join('') || '<p>Sin alertas</p>';
  }
}