// abTesting.js
import { CONFIG } from './config.js';

export const abTesting = {
  activeTests: {},
  
  createTest(testId, name, variants, distribution = [0.5, 0.5]) {
    this.activeTests[testId] = {
      name,
      variants,
      distribution,
      results: {},
      startDate: Date.now(),
      ended: false
    };
    variants.forEach(v => {
      this.activeTests[testId].results[v] = { views: 0, conversions: 0 };
    });
    this.save();
  },
  
  getVariant(testId, userId) {
    const test = this.activeTests[testId];
    if (!test || test.ended) return null;
    
    const hash = this.hashCode(userId + testId);
    const rand = (hash % 100) / 100;
    let accum = 0;
    for (let i = 0; i < test.distribution.length; i++) {
      accum += test.distribution[i];
      if (rand < accum) {
        const variant = test.variants[i];
        test.results[variant].views++;
        this.save();
        return variant;
      }
    }
    return test.variants[0];
  },
  
  trackConversion(testId, variant, userId) {
    const test = this.activeTests[testId];
    if (test && test.results[variant] && !test.ended) {
      test.results[variant].conversions++;
      this.save();
    }
  },
  
  getWinner(testId) {
    const test = this.activeTests[testId];
    if (!test) return null;
    
    let bestVariant = null;
    let bestRate = 0;
    
    for (const [variant, data] of Object.entries(test.results)) {
      const rate = data.views > 0 ? data.conversions / data.views : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestVariant = variant;
      }
    }
    
    return { winner: bestVariant, rate: bestRate };
  },
  
  endTest(testId) {
    if (this.activeTests[testId]) {
      this.activeTests[testId].ended = true;
      this.save();
    }
  },
  
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },
  
  save() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AB_TESTS, JSON.stringify(this.activeTests));
  },
  
  load() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEYS.AB_TESTS);
    if (data) this.activeTests = JSON.parse(data);
  },
  
  getAllTests() {
    return this.activeTests;
  }
};

abTesting.load();