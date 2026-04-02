// abTesting.js
import { CONFIG } from './config.js';
import { showToast } from './utils.js';

export const abTesting = {
  activeTests: {},
  
  /**
   * Crea una nueva prueba A/B
   * @param {string} testId - ID único de la prueba
   * @param {string} name - Nombre descriptivo
   * @param {Array} variants - Lista de variantes (ej: ['A', 'B'])
   * @param {Array} distribution - Distribución de tráfico (ej: [0.5, 0.5])
   * @param {Object} options - Opciones adicionales
   */
  createTest(testId, name, variants, distribution = [0.5, 0.5], options = {}) {
    if (this.activeTests[testId]) {
      console.warn(`La prueba ${testId} ya existe`);
      return false;
    }
    
    this.activeTests[testId] = {
      id: testId,
      name,
      variants,
      distribution,
      results: {},
      startDate: Date.now(),
      endDate: options.endDate || null,
      ended: false,
      description: options.description || '',
      targetMetric: options.targetMetric || 'conversion',
      minSampleSize: options.minSampleSize || 100,
      confidenceThreshold: options.confidenceThreshold || 0.95
    };
    
    variants.forEach(v => {
      this.activeTests[testId].results[v] = { 
        views: 0, 
        conversions: 0,
        revenue: 0,
        avgOrderValue: 0
      };
    });
    
    this.save();
    showToast(`🧪 Prueba A/B "${name}" creada`, 'success');
    return true;
  },
  
  /**
   * Obtiene la variante asignada a un usuario
   * @param {string} testId - ID de la prueba
   * @param {string} userId - ID del usuario
   * @returns {string|null} - Variante asignada
   */
  getVariant(testId, userId) {
    const test = this.activeTests[testId];
    if (!test || test.ended || !userId) return null;
    
    // Verificar si el usuario ya tiene una variante asignada
    const userAssignment = this.getUserAssignment(testId, userId);
    if (userAssignment) return userAssignment;
    
    const hash = this.hashCode(userId + testId);
    const rand = (hash % 100) / 100;
    let accum = 0;
    
    for (let i = 0; i < test.distribution.length; i++) {
      accum += test.distribution[i];
      if (rand < accum) {
        const variant = test.variants[i];
        test.results[variant].views++;
        this.save();
        this.saveUserAssignment(testId, userId, variant);
        return variant;
      }
    }
    
    const defaultVariant = test.variants[0];
    this.saveUserAssignment(testId, userId, defaultVariant);
    return defaultVariant;
  },
  
  /**
   * Guarda la asignación de un usuario a una variante
   * @param {string} testId - ID de la prueba
   * @param {string} userId - ID del usuario
   * @param {string} variant - Variante asignada
   */
  saveUserAssignment(testId, userId, variant) {
    const assignments = this.getUserAssignments();
    if (!assignments[testId]) assignments[testId] = {};
    assignments[testId][userId] = { variant, assignedAt: Date.now() };
    localStorage.setItem('arepas_ab_assignments', JSON.stringify(assignments));
  },
  
  /**
   * Obtiene la asignación de un usuario
   * @param {string} testId - ID de la prueba
   * @param {string} userId - ID del usuario
   * @returns {string|null} - Variante asignada
   */
  getUserAssignment(testId, userId) {
    const assignments = this.getUserAssignments();
    return assignments[testId]?.[userId]?.variant || null;
  },
  
  /**
   * Obtiene todas las asignaciones de usuarios
   * @returns {Object} - Mapa de asignaciones
   */
  getUserAssignments() {
    const raw = localStorage.getItem('arepas_ab_assignments');
    return raw ? JSON.parse(raw) : {};
  },
  
  /**
   * Registra una conversión para una variante
   * @param {string} testId - ID de la prueba
   * @param {string} variant - Variante que convirtió
   * @param {string} userId - ID del usuario
   * @param {number} revenue - Ingreso generado (opcional)
   */
  trackConversion(testId, variant, userId, revenue = 0) {
    const test = this.activeTests[testId];
    if (test && test.results[variant] && !test.ended) {
      test.results[variant].conversions++;
      if (revenue > 0) {
        test.results[variant].revenue += revenue;
        test.results[variant].avgOrderValue = test.results[variant].revenue / test.results[variant].conversions;
      }
      this.save();
      
      // Registrar evento de conversión
      this.logEvent(testId, variant, userId, 'conversion', revenue);
    }
  },
  
  /**
   * Registra un evento personalizado
   * @param {string} testId - ID de la prueba
   * @param {string} variant - Variante
   * @param {string} userId - ID del usuario
   * @param {string} eventType - Tipo de evento
   * @param {number} value - Valor asociado
   */
  logEvent(testId, variant, userId, eventType, value = 0) {
    const events = this.getTestEvents(testId);
    events.push({
      testId,
      variant,
      userId,
      eventType,
      value,
      timestamp: Date.now()
    });
    localStorage.setItem(`arepas_ab_events_${testId}`, JSON.stringify(events.slice(-1000)));
  },
  
  /**
   * Obtiene eventos de una prueba
   * @param {string} testId - ID de la prueba
   * @returns {Array} - Lista de eventos
   */
  getTestEvents(testId) {
    const raw = localStorage.getItem(`arepas_ab_events_${testId}`);
    return raw ? JSON.parse(raw) : [];
  },
  
  /**
   * Calcula significancia estadística entre variantes
   * @param {number} conversionsA - Conversiones variante A
   * @param {number} viewsA - Vistas variante A
   * @param {number} conversionsB - Conversiones variante B
   * @param {number} viewsB - Vistas variante B
   * @returns {Object} - Resultado del test estadístico
   */
  calculateSignificance(conversionsA, viewsA, conversionsB, viewsB) {
    const rateA = viewsA > 0 ? conversionsA / viewsA : 0;
    const rateB = viewsB > 0 ? conversionsB / viewsB : 0;
    const uplift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;
    
    // Prueba Z para proporciones (simplificada)
    const pPool = (conversionsA + conversionsB) / (viewsA + viewsB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1/viewsA + 1/viewsB));
    const zScore = Math.abs(rateB - rateA) / se;
    
    // Convertir z-score a p-value (aproximación)
    let pValue = 0.5;
    if (zScore > 1.96) pValue = 0.05;
    if (zScore > 2.58) pValue = 0.01;
    if (zScore > 3.29) pValue = 0.001;
    
    const isSignificant = pValue <= 0.05;
    
    return {
      rateA: (rateA * 100).toFixed(2),
      rateB: (rateB * 100).toFixed(2),
      uplift: uplift.toFixed(2),
      zScore: zScore.toFixed(2),
      pValue,
      isSignificant,
      winner: rateB > rateA ? 'B' : rateB < rateA ? 'A' : 'tie'
    };
  },
  
  /**
   * Obtiene el ganador de una prueba
   * @param {string} testId - ID de la prueba
   * @returns {Object|null} - Resultado con ganador
   */
  getWinner(testId) {
    const test = this.activeTests[testId];
    if (!test) return null;
    
    let bestVariant = null;
    let bestRate = 0;
    let bestRevenue = 0;
    
    for (const [variant, data] of Object.entries(test.results)) {
      const rate = data.views > 0 ? (data.conversions / data.views) * 100 : 0;
      const revenuePerView = data.views > 0 ? data.revenue / data.views : 0;
      
      if (rate > bestRate) {
        bestRate = rate;
        bestVariant = variant;
      }
    }
    
    // Calcular significancia si hay 2 variantes
    let significance = null;
    if (test.variants.length === 2) {
      const v1 = test.variants[0];
      const v2 = test.variants[1];
      significance = this.calculateSignificance(
        test.results[v1].conversions,
        test.results[v1].views,
        test.results[v2].conversions,
        test.results[v2].views
      );
    }
    
    return { 
      winner: bestVariant, 
      rate: bestRate.toFixed(2),
      confidence: significance?.isSignificant ? 'Alta' : 'Baja',
      significance,
      totalViews: Object.values(test.results).reduce((sum, d) => sum + d.views, 0),
      totalConversions: Object.values(test.results).reduce((sum, d) => sum + d.conversions, 0)
    };
  },
  
  /**
   * Finaliza una prueba A/B
   * @param {string} testId - ID de la prueba
   * @param {boolean} applyWinner - Aplicar variante ganadora
   */
  endTest(testId, applyWinner = false) {
    if (this.activeTests[testId]) {
      this.activeTests[testId].ended = true;
      this.activeTests[testId].endDate = Date.now();
      
      if (applyWinner) {
        const winner = this.getWinner(testId);
        if (winner && winner.winner) {
          this.activeTests[testId].appliedVariant = winner.winner;
          showToast(`✅ Prueba finalizada. Se aplicó variante ${winner.winner}`, 'success');
        }
      }
      
      this.save();
      showToast(`🧪 Prueba "${this.activeTests[testId].name}" finalizada`, 'info');
      return true;
    }
    return false;
  },
  
  /**
   * Reinicia una prueba (limpia resultados)
   * @param {string} testId - ID de la prueba
   */
  resetTest(testId) {
    if (this.activeTests[testId]) {
      const variants = this.activeTests[testId].variants;
      this.activeTests[testId].results = {};
      variants.forEach(v => {
        this.activeTests[testId].results[v] = { views: 0, conversions: 0, revenue: 0, avgOrderValue: 0 };
      });
      this.activeTests[testId].startDate = Date.now();
      this.activeTests[testId].ended = false;
      this.save();
      
      // Limpiar asignaciones
      const assignments = this.getUserAssignments();
      delete assignments[testId];
      localStorage.setItem('arepas_ab_assignments', JSON.stringify(assignments));
      
      showToast(`🧪 Prueba "${this.activeTests[testId].name}" reiniciada`, 'info');
      return true;
    }
    return false;
  },
  
  /**
   * Elimina una prueba
   * @param {string} testId - ID de la prueba
   */
  deleteTest(testId) {
    if (this.activeTests[testId]) {
      delete this.activeTests[testId];
      this.save();
      
      // Limpiar datos asociados
      const assignments = this.getUserAssignments();
      delete assignments[testId];
      localStorage.setItem('arepas_ab_assignments', JSON.stringify(assignments));
      localStorage.removeItem(`arepas_ab_events_${testId}`);
      
      showToast(`🧪 Prueba eliminada`, 'success');
      return true;
    }
    return false;
  },
  
  /**
   * Genera un hash para asignación consistente
   * @param {string} str - String a hashear
   * @returns {number} - Hash numérico
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },
  
  /**
   * Guarda las pruebas activas en localStorage
   */
  save() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AB_TESTS, JSON.stringify(this.activeTests));
  },
  
  /**
   * Carga las pruebas activas desde localStorage
   */
  load() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.AB_TESTS);
    if (data) this.activeTests = JSON.parse(data);
  },
  
  /**
   * Obtiene todas las pruebas
   * @returns {Object} - Mapa de pruebas
   */
  getAllTests() {
    return this.activeTests;
  },
  
  /**
   * Obtiene pruebas activas
   * @returns {Object} - Pruebas no finalizadas
   */
  getActiveTests() {
    const active = {};
    for (const [id, test] of Object.entries(this.activeTests)) {
      if (!test.ended) active[id] = test;
    }
    return active;
  },
  
  /**
   * Obtiene pruebas finalizadas
   * @returns {Object} - Pruebas finalizadas
   */
  getCompletedTests() {
    const completed = {};
    for (const [id, test] of Object.entries(this.activeTests)) {
      if (test.ended) completed[id] = test;
    }
    return completed;
  },
  
  /**
   * Obtiene reporte detallado de una prueba
   * @param {string} testId - ID de la prueba
   * @returns {Object} - Reporte completo
   */
  getTestReport(testId) {
    const test = this.activeTests[testId];
    if (!test) return null;
    
    const winner = this.getWinner(testId);
    const events = this.getTestEvents(testId);
    const duration = test.endDate ? (test.endDate - test.startDate) / (1000 * 3600 * 24) : (Date.now() - test.startDate) / (1000 * 3600 * 24);
    
    const variantReports = {};
    for (const [variant, data] of Object.entries(test.results)) {
      const conversionRate = data.views > 0 ? (data.conversions / data.views) * 100 : 0;
      variantReports[variant] = {
        views: data.views,
        conversions: data.conversions,
        conversionRate: conversionRate.toFixed(2),
        revenue: data.revenue,
        avgOrderValue: data.avgOrderValue.toFixed(2)
      };
    }
    
    return {
      id: test.id,
      name: test.name,
      description: test.description,
      variants: test.variants,
      startDate: new Date(test.startDate).toISOString(),
      endDate: test.endDate ? new Date(test.endDate).toISOString() : null,
      durationDays: duration.toFixed(1),
      ended: test.ended,
      winner: winner?.winner || null,
      winnerRate: winner?.rate || null,
      confidence: winner?.confidence || null,
      variants: variantReports,
      totalEvents: events.length,
      recentEvents: events.slice(-20)
    };
  },
  
  /**
   * Obtiene estadísticas globales de A/B testing
   * @returns {Object} - Estadísticas
   */
  getGlobalStats() {
    const tests = this.getAllTests();
    const activeCount = Object.values(tests).filter(t => !t.ended).length;
    const completedCount = Object.values(tests).filter(t => t.ended).length;
    
    let totalViews = 0;
    let totalConversions = 0;
    
    for (const test of Object.values(tests)) {
      for (const data of Object.values(test.results)) {
        totalViews += data.views;
        totalConversions += data.conversions;
      }
    }
    
    return {
      totalTests: Object.keys(tests).length,
      activeTests: activeCount,
      completedTests: completedCount,
      totalViews,
      totalConversions,
      avgConversionRate: totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(2) : 0
    };
  }
};

// Inicializar cargando pruebas guardadas
abTesting.load();
