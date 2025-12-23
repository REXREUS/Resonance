/**
 * Initialization service for Resonance mobile app
 * Handles offline-first system initialization and service coordination
 */

import { databaseService } from './databaseService';
import { networkService } from './networkService';
import { offlineService } from './offlineService';
import { 
  globalErrorHandler, 
  ResonanceError, 
  ErrorCode, 
  ErrorCategory 
} from '../utils/errorHandler';

export class InitializationService {
  constructor() {
    this.isInitialized = false;
    this.initializationSteps = [];
    this.failedServices = [];
    this.initializationProgress = 0;
    this.progressCallback = null;
  }

  /**
   * Initialize all core components offline-first
   */
  async initialize(options = {}) {
    const {
      enableNetworking = true,
      enableOfflineCache = true,
      progressCallback = null
    } = options;

    this.progressCallback = progressCallback;
    this.initializationSteps = [];
    this.failedServices = [];
    this.initializationProgress = 0;

    try {
      console.log('Starting offline-first system initialization...');
      
      // Step 1: Initialize error handling
      await this._executeStep('Error Handler', () => this._initializeErrorHandler());
      
      // Step 2: Initialize database (critical for offline operation)
      await this._executeStep('Database', () => this._initializeDatabase());
      
      // Step 3: Initialize offline service (non-critical)
      if (enableOfflineCache) {
        await this._executeStep('Offline Cache', () => this._initializeOfflineService(), false);
      }
      
      // Step 4: Initialize network service (non-critical)
      if (enableNetworking) {
        await this._executeStep('Network Monitor', () => this._initializeNetworkService(), false);
      }
      
      // Step 5: Validate core functionality
      await this._executeStep('System Validation', () => this._validateCoreComponents());
      
      this.isInitialized = true;
      console.log('System initialization completed successfully');
      
      return {
        success: true,
        failedServices: this.failedServices,
        isOfflineMode: !networkService.isOnline(),
        initializationSteps: this.initializationSteps
      };
      
    } catch (error) {
      console.error('System initialization failed:', error);
      
      // Try to enable offline mode as fallback
      try {
        await this._enableOfflineFallback();
        
        return {
          success: true,
          isOfflineMode: true,
          failedServices: this.failedServices,
          initializationSteps: this.initializationSteps,
          warning: 'System initialized in offline mode due to initialization errors'
        };
      } catch (fallbackError) {
        throw new ResonanceError(
          ErrorCode.SERVICE_INIT_FAILED,
          'Critical system initialization failed',
          ErrorCategory.INITIALIZATION,
          false,
          'Unable to start the application. Please restart and try again.'
        );
      }
    }
  }

  /**
   * Get initialization status
   */
  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      progress: this.initializationProgress,
      steps: this.initializationSteps,
      failedServices: this.failedServices
    };
  }

  /**
   * Reinitialize failed services
   */
  async reinitializeFailedServices() {
    if (this.failedServices.length === 0) {
      return { success: true, message: 'No failed services to reinitialize' };
    }

    const results = [];
    const uniqueServices = [...new Set(this.failedServices)];
    
    for (const serviceName of uniqueServices) {
      try {
        switch (serviceName) {
          case 'Network Monitor':
            await this._initializeNetworkService();
            break;
          case 'Offline Cache':
            await this._initializeOfflineService();
            break;
          default:
            console.warn(`Unknown service for reinitialization: ${serviceName}`);
            continue;
        }
        
        // Remove from failed services if successful
        const index = this.failedServices.indexOf(serviceName);
        if (index > -1) {
          this.failedServices.splice(index, 1);
        }
        
        results.push({ service: serviceName, success: true });
        
      } catch (error) {
        console.error(`Failed to reinitialize ${serviceName}:`, error);
        results.push({ 
          service: serviceName, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return {
      success: this.failedServices.length === 0,
      results,
      remainingFailedServices: this.failedServices
    };
  }

  /**
   * Check if system can operate offline
   */
  canOperateOffline() {
    // Check if critical services are available
    const criticalServices = ['Database', 'Error Handler'];
    const availableServices = this.initializationSteps
      .filter(step => step.success)
      .map(step => step.name);
    
    return criticalServices.every(service => availableServices.includes(service));
  }

  // Private methods

  async _executeStep(stepName, stepFunction, isCritical = true) {
    const startTime = Date.now();
    
    try {
      console.log(`Initializing ${stepName}...`);
      
      await stepFunction();
      
      const duration = Date.now() - startTime;
      this.initializationSteps.push({
        name: stepName,
        success: true,
        duration,
        isCritical
      });
      
      this._updateProgress();
      console.log(`✓ ${stepName} initialized successfully (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.initializationSteps.push({
        name: stepName,
        success: false,
        duration,
        isCritical,
        error: error.message
      });
      
      this._updateProgress();
      
      if (isCritical) {
        console.error(`✗ Critical service ${stepName} failed:`, error);
        throw error;
      } else {
        console.warn(`⚠ Non-critical service ${stepName} failed:`, error);
        this.failedServices.push(stepName);
      }
    }
  }

  async _initializeErrorHandler() {
    // Error handler is already initialized when imported
    // Just add a listener for system-wide error handling
    globalErrorHandler.addErrorListener((error, context) => {
      console.log('System error handled:', {
        code: error.code,
        category: error.category,
        message: error.message,
        context
      });
    });
  }

  async _initializeDatabase() {
    if (!databaseService.isInitialized) {
      await databaseService.initialize();
    }
    
    // Verify database is working
    await databaseService.execute('SELECT 1');
  }

  async _initializeOfflineService() {
    if (!offlineService.isInitialized) {
      await offlineService.initialize();
    }
    
    // Verify offline service is working
    const status = offlineService.getOfflineStatus();
    if (!status.isInitialized) {
      throw new Error('Offline service initialization verification failed');
    }
  }

  async _initializeNetworkService() {
    if (!networkService.isInitialized) {
      await networkService.initialize();
    }
    
    // Test network connectivity (non-blocking)
    try {
      await networkService.testConnectivity(3000);
    } catch (error) {
      console.warn('Network connectivity test failed:', error.message);
      // Don't throw - network issues are handled by the network service
    }
  }

  async _validateCoreComponents() {
    // Validate database
    if (!databaseService.isInitialized) {
      throw new Error('Database validation failed');
    }
    
    // Validate offline capabilities
    if (offlineService.isInitialized) {
      const offlineStatus = offlineService.getOfflineStatus();
      if (!offlineStatus.isInitialized) {
        throw new Error('Offline service validation failed');
      }
    }
    
    // Check if we can operate in current mode
    if (!this.canOperateOffline() && (!networkService.isInitialized || networkService.isOffline())) {
      throw new Error('System cannot operate in current state');
    }
  }

  async _enableOfflineFallback() {
    console.log('Enabling offline fallback mode...');
    
    // Ensure database is available
    if (!databaseService.isInitialized) {
      await databaseService.initialize();
    }
    
    // Enable offline mode in error handler
    globalErrorHandler.enableOfflineMode();
    
    // Initialize minimal offline service if not already done
    if (!offlineService.isInitialized) {
      try {
        await offlineService.initialize();
      } catch (error) {
        console.warn('Could not initialize offline service in fallback mode:', error);
      }
    }
    
    console.log('Offline fallback mode enabled');
  }

  _updateProgress() {
    const totalSteps = 5; // Adjust based on number of initialization steps
    const completedSteps = this.initializationSteps.length;
    this.initializationProgress = Math.round((completedSteps / totalSteps) * 100);
    
    if (this.progressCallback) {
      this.progressCallback({
        progress: this.initializationProgress,
        currentStep: this.initializationSteps[this.initializationSteps.length - 1]?.name,
        completedSteps,
        totalSteps
      });
    }
  }
}

// Global initialization service instance
export const initializationService = new InitializationService();

// Utility function for initializing the app
export const initializeApp = async (options = {}) => {
  return await initializationService.initialize(options);
};

export default initializationService;