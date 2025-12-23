import { databaseService } from './databaseService';
import useSettingsStore from '../stores/settingsStore';

/**
 * Quota Service for managing API usage and cost tracking
 * Handles cost limits, usage monitoring, and safety thresholds
 */
class QuotaService {
  constructor() {
    this.isInitialized = false;
    this.dailyLimit = 50.0; // Default daily limit in USD
    this.warningThreshold = 0.8; // 80% of daily limit
    this.criticalThreshold = 0.95; // 95% of daily limit
  }

  /**
   * Initialize quota service
   */
  async initialize() {
    try {
      // Ensure database is initialized first
      if (!databaseService.isInitialized) {
        await databaseService.initialize();
      }
      
      // Load settings to get daily limit
      const settings = await databaseService.getAppSettings();
      if (settings) {
        this.dailyLimit = settings.daily_limit || 50.0;
      }
      
      this.isInitialized = true;
      console.log('Quota service initialized successfully');
      return true;
    } catch (error) {
      console.error('Quota service initialization failed:', error);
      // Don't throw - use defaults
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Record API usage
   */
  async recordUsage(service, cost, sessionId = null, operationType = null) {
    this.ensureInitialized();
    
    try {
      await databaseService.recordQuotaUsage({
        service,
        cost,
        session_id: sessionId,
        operation_type: operationType
      });
      
      // Update settings store
      const settingsStore = useSettingsStore.getState();
      settingsStore.trackApiUsage(service, cost);
      
      // Check if we've exceeded thresholds
      const dailyUsage = await this.getDailyUsage();
      this.checkThresholds(dailyUsage);
      
      console.log(`Recorded ${service} usage: $${cost.toFixed(4)}`);
      return true;
    } catch (error) {
      console.error('Error recording quota usage:', error);
      throw error;
    }
  }

  /**
   * Get daily usage
   */
  async getDailyUsage() {
    if (!this.ensureInitialized()) return 0;
    try {
      return await databaseService.getDailyQuotaUsage();
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get monthly usage
   */
  async getMonthlyUsage() {
    if (!this.ensureInitialized()) return 0;
    try {
      return await databaseService.getMonthlyQuotaUsage();
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get usage by service for today
   */
  async getDailyUsageByService(service) {
    if (!this.ensureInitialized()) return 0;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();
      
      return await databaseService.getQuotaUsageByService(service, startOfDay);
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get remaining quota for today
   */
  async getRemainingQuota() {
    if (!this.ensureInitialized()) return this.dailyLimit;
    
    const dailyUsage = await this.getDailyUsage();
    return Math.max(0, this.dailyLimit - dailyUsage);
  }

  /**
   * Check if operation is within quota
   */
  async canAfford(estimatedCost) {
    if (!this.ensureInitialized()) return true;
    
    const remainingQuota = await this.getRemainingQuota();
    return remainingQuota >= estimatedCost;
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage() {
    if (!this.ensureInitialized()) return 0;
    
    const dailyUsage = await this.getDailyUsage();
    return Math.min(100, (dailyUsage / this.dailyLimit) * 100);
  }

  /**
   * Get usage statistics
   */
  async getUsageStatistics() {
    if (!this.ensureInitialized()) {
      return {
        daily: { total: 0, elevenlabs: 0, gemini: 0, percentage: 0, remaining: this.dailyLimit, limit: this.dailyLimit },
        monthly: { total: 0 },
        thresholds: { warning: this.dailyLimit * 0.8, critical: this.dailyLimit * 0.95, isWarning: false, isCritical: false, isExceeded: false }
      };
    }
    
    const dailyUsage = await this.getDailyUsage();
    const monthlyUsage = await this.getMonthlyUsage();
    const remainingQuota = await this.getRemainingQuota();
    const usagePercentage = await this.getUsagePercentage();
    
    const elevenLabsUsage = await this.getDailyUsageByService('elevenlabs');
    const geminiUsage = await this.getDailyUsageByService('gemini');
    
    return {
      daily: {
        total: dailyUsage,
        elevenlabs: elevenLabsUsage,
        gemini: geminiUsage,
        percentage: usagePercentage,
        remaining: remainingQuota,
        limit: this.dailyLimit
      },
      monthly: {
        total: monthlyUsage
      },
      thresholds: {
        warning: this.dailyLimit * this.warningThreshold,
        critical: this.dailyLimit * this.criticalThreshold,
        isWarning: dailyUsage >= (this.dailyLimit * this.warningThreshold),
        isCritical: dailyUsage >= (this.dailyLimit * this.criticalThreshold),
        isExceeded: dailyUsage >= this.dailyLimit
      }
    };
  }

  /**
   * Get usage history for chart
   */
  async getUsageHistory(days = 7) {
    if (!this.ensureInitialized()) return [];
    
    const history = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const startOfDay = date.getTime();
      const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
      
      const dayUsage = await databaseService.getTotalQuotaUsage(startOfDay, endOfDay);
      
      history.push({
        date: date.toISOString().split('T')[0],
        usage: dayUsage,
        percentage: (dayUsage / this.dailyLimit) * 100
      });
    }
    
    return history;
  }

  /**
   * Estimate cost for operations
   */
  estimateCost(service, operation, parameters = {}) {
    // Cost estimates based on typical API pricing
    const costEstimates = {
      elevenlabs: {
        tts: 0.0003, // Per character
        voice_clone: 0.10, // Per voice clone
        streaming: 0.0005 // Per character for streaming
      },
      gemini: {
        generate: 0.000125, // Per 1K characters input
        analyze: 0.000375 // Per 1K characters output
      }
    };
    
    const serviceCosts = costEstimates[service];
    if (!serviceCosts || !serviceCosts[operation]) {
      return 0.01; // Default small cost
    }
    
    switch (service) {
      case 'elevenlabs':
        if (operation === 'tts' || operation === 'streaming') {
          const characters = parameters.textLength || 100;
          return characters * serviceCosts[operation];
        }
        return serviceCosts[operation];
        
      case 'gemini':
        const inputLength = parameters.inputLength || 1000;
        const outputLength = parameters.outputLength || 500;
        
        if (operation === 'generate') {
          return (inputLength / 1000) * serviceCosts.generate + 
                 (outputLength / 1000) * serviceCosts.analyze;
        }
        return (inputLength / 1000) * serviceCosts[operation];
        
      default:
        return 0.01;
    }
  }

  /**
   * Update daily limit
   */
  async updateDailyLimit(newLimit) {
    this.ensureInitialized();
    
    this.dailyLimit = newLimit;
    
    // Update in database
    await databaseService.updateAppSettings({ daily_limit: newLimit });
    
    console.log(`Daily limit updated to $${newLimit}`);
  }

  /**
   * Check thresholds and emit warnings
   */
  checkThresholds(dailyUsage) {
    const warningAmount = this.dailyLimit * this.warningThreshold;
    const criticalAmount = this.dailyLimit * this.criticalThreshold;
    
    if (dailyUsage >= this.dailyLimit) {
      console.warn('🚨 Daily quota exceeded!');
      this.emitQuotaEvent('exceeded', { usage: dailyUsage, limit: this.dailyLimit });
    } else if (dailyUsage >= criticalAmount) {
      console.warn('⚠️ Critical quota threshold reached!');
      this.emitQuotaEvent('critical', { usage: dailyUsage, threshold: criticalAmount });
    } else if (dailyUsage >= warningAmount) {
      console.warn('⚠️ Quota warning threshold reached!');
      this.emitQuotaEvent('warning', { usage: dailyUsage, threshold: warningAmount });
    }
  }

  /**
   * Emit quota events (for UI notifications)
   */
  emitQuotaEvent(type, data) {
    // This could be connected to a notification system
    console.log(`Quota event: ${type}`, data);
  }

  /**
   * Reset daily usage (for testing)
   */
  async resetDailyUsage() {
    this.ensureInitialized();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();
    
    // Delete today's usage records
    await databaseService.executeQuery(
      'DELETE FROM quota_usage WHERE timestamp >= ?',
      [startOfDay]
    );
    
    console.log('Daily usage reset');
  }

  /**
   * Clean up old usage records
   */
  async cleanup() {
    this.ensureInitialized();
    await databaseService.clearOldQuotaUsage();
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      console.warn('Quota service not initialized yet');
      return false;
    }
    return true;
  }
}

// Export singleton instance
export const quotaService = new QuotaService();
export default quotaService;