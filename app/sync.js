// sync.js - Sincronización vía QR y exportación
import { auth } from './auth.js';
import { downloadJSON } from './utils.js';

export const sync = {
  exportFullData() {
    const session = auth.getSession();
    if (!session) return null;
    
    const fullData = {
      user: session,
      localStorage: {},
      timestamp: Date.now(),
      version: '1.0'
    };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arepas_')) {
        fullData.localStorage[key] = localStorage.getItem(key);
      }
    }
    
    return fullData;
  },
  
  exportAsJSON() {
    const data = this.exportFullData();
    if (data) {
      downloadJSON(data, `arepas_backup_${Date.now()}.json`);
      return true;
    }
    return false;
  },
  
  importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.localStorage) {
            Object.entries(data.localStorage).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
            resolve(true);
          } else {
            reject(new Error('Formato inválido'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },
  
  generateSyncQR() {
    const data = this.exportFullData();
    if (!data) return null;
    const jsonStr = JSON.stringify(data);
    // Usar API de QR code (requiere librería externa)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(jsonStr)}`;
  },
  
  createSyncCode() {
    const data = this.exportFullData();
    return data ? btoa(JSON.stringify(data)) : null;
  },
  
  syncFromCode(code) {
    try {
      const data = JSON.parse(atob(code));
      if (data.localStorage) {
        Object.entries(data.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error al sincronizar:', e);
      return false;
    }
  }
};