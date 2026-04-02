// security.js
export function detectDevTools() {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  if (widthThreshold || heightThreshold) {
    console.warn('🔒 Consola detectada - Modo seguro');
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#f44336; color:white; padding:8px; text-align:center; font-size:12px; z-index:9999;';
    warningDiv.innerHTML = '⚠️ Herramientas de desarrollo detectadas. Por seguridad, algunas funciones pueden estar limitadas.';
    document.body.appendChild(warningDiv);
    setTimeout(() => warningDiv.remove(), 5000);
  }
}

export function checkTampering() {
  const originalKeys = [
    'arepas_users',
    'arepas_session',
    'arepas_cart'
  ];
  
  const warnings = [];
  originalKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && value.includes('__proto__')) {
      warnings.push(`Posible manipulación detectada en ${key}`);
    }
  });
  
  if (warnings.length > 0) {
    console.warn('⚠️ Advertencias de seguridad:', warnings);
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#ff9800; color:black; padding:8px; text-align:center; font-size:12px; z-index:9999;';
    warningDiv.innerHTML = '🔒 Se detectaron cambios inesperados. Reinicia la app si ves problemas.';
    document.body.appendChild(warningDiv);
  }
}

// Detectar modo debug
if (window.location.search.includes('debug=true')) {
  localStorage.setItem('debug_mode', 'true');
  console.log('🐞 Modo debug activado - Logs habilitados');
  
  // Registrar eventos globales en modo debug
  window.addEventListener('error', (e) => {
    console.error('[Debug] Error capturado:', e.error);
  });
}

if (window.location.search.includes('reset=true')) {
  console.warn('⚠️ Reiniciando almacenamiento local...');
  const keysToKeep = ['arepas_users'];
  const dataToKeep = {};
  keysToKeep.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) dataToKeep[key] = value;
  });
  localStorage.clear();
  Object.entries(dataToKeep).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
  console.log('✅ Reinicio completado');
}