/**
 * Network connectivity service for Resonance mobile app
 * Handles network detection, offline indicators, and connectivity state management
 */

import NetInfo from '@react-native-community/netinfo';
import { globalErrorHandler, createNetworkError } from '../utils/errorHandler';

export class NetworkService {
  constructor() {
    this.isConnected = true;
    this.connectionType = 'unknown';
    this.listeners = [];
    this.unsubscribe = null;
    this.isInitialized = false;
  }

  /**
   * Initialize network monitoring
   */
  async initialize() {
    try {
      // Get initial network state
      const state = await NetInfo.fetch();
      this._updateConnectionState(state);

      // Subscribe to network state changes
      this.unsubscribe = NetInfo.addEventListener(state => {
        this._updateConnectionState(state);
      });

      this.isInitialized = true;
      console.log('NetworkService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NetworkService:', error);
      throw createNetworkError(
        'Failed to initialize network monitoring',
        'Unable to monitor network connectivity'
      );
    }
  }

  /**
   * Clean up network monitoring
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
    this.isInitialized = false;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Check if device is online
   */
  isOnline() {
    return this.isConnected;
  }

  /**
   * Check if device is offline
   */
  isOffline() {
    return !this.isConnected;
  }

  /**
   * Add connection state listener
   */
  addConnectionListener(listener) {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener({
      isConnected: this.isConnected,
      connectionType: this.connectionType
    });
  }

  /**
   * Remove connection state listener
   */
  removeConnectionListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Test network connectivity by making a simple request
   */
  async testConnectivity(timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Connectivity test failed:', error.message);
      return false;
    }
  }

  /**
   * Wait for network connection to be restored
   */
  async waitForConnection(timeout = 30000) {
    if (this.isConnected) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeConnectionListener(connectionListener);
        reject(createNetworkError(
          'Network connection timeout',
          'Unable to establish network connection'
        ));
      }, timeout);

      const connectionListener = ({ isConnected }) => {
        if (isConnected) {
          clearTimeout(timeoutId);
          this.removeConnectionListener(connectionListener);
          resolve(true);
        }
      };

      this.addConnectionListener(connectionListener);
    });
  }

  /**
   * Execute operation with network retry logic
   */
  async executeWithRetry(operation, operationId, options = {}) {
    const {
      maxAttempts = 3,
      requiresNetwork = true,
      fallbackToOffline = true
    } = options;

    // If operation doesn't require network, execute immediately
    if (!requiresNetwork) {
      return await operation();
    }

    // If offline and no fallback, throw error
    if (this.isOffline() && !fallbackToOffline) {
      throw createNetworkError(
        'Network required for operation',
        'This feature requires an internet connection'
      );
    }

    // If offline but fallback allowed, enable offline mode
    if (this.isOffline() && fallbackToOffline) {
      globalErrorHandler.enableOfflineMode();
      throw createNetworkError(
        'Operation requires network connectivity',
        'Feature unavailable in offline mode'
      );
    }

    // Execute with retry logic
    return await globalErrorHandler.retry(
      operation,
      operationId,
      maxAttempts,
      { networkService: this }
    );
  }

  /**
   * Get network quality indicator
   */
  getNetworkQuality() {
    if (!this.isConnected) {
      return 'offline';
    }

    switch (this.connectionType) {
      case 'wifi':
        return 'excellent';
      case 'cellular':
        return 'good';
      case 'ethernet':
        return 'excellent';
      default:
        return 'unknown';
    }
  }

  /**
   * Get user-friendly connection status message
   */
  getConnectionMessage() {
    if (!this.isConnected) {
      return 'No internet connection. App is running in offline mode.';
    }

    switch (this.connectionType) {
      case 'wifi':
        return 'Connected via Wi-Fi';
      case 'cellular':
        return 'Connected via mobile data';
      case 'ethernet':
        return 'Connected via ethernet';
      default:
        return 'Connected to internet';
    }
  }

  // Private methods

  _updateConnectionState(state) {
    const wasConnected = this.isConnected;
    const previousType = this.connectionType;

    this.isConnected = state.isConnected && state.isInternetReachable;
    this.connectionType = state.type;

    // Log connection changes
    if (wasConnected !== this.isConnected) {
      console.log(`Network status changed: ${this.isConnected ? 'online' : 'offline'}`);
      
      // Update global error handler
      if (this.isConnected) {
        globalErrorHandler.disableOfflineMode();
      } else {
        globalErrorHandler.enableOfflineMode();
      }
    }

    if (previousType !== this.connectionType) {
      console.log(`Connection type changed: ${this.connectionType}`);
    }

    // Notify listeners
    this._notifyListeners({
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      wasConnected,
      previousType
    });
  }

  _notifyListeners(connectionState) {
    this.listeners.forEach(listener => {
      try {
        listener(connectionState);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }
}

// Global network service instance
export const networkService = new NetworkService();

// Utility functions
export const withNetworkRetry = async (operation, operationId, options = {}) => {
  return await networkService.executeWithRetry(operation, operationId, options);
};

export const requiresNetwork = (target, propertyKey, descriptor) => {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args) {
    if (networkService.isOffline()) {
      throw createNetworkError(
        `${propertyKey} requires network connectivity`,
        'This feature is not available in offline mode'
      );
    }
    
    return await originalMethod.apply(this, args);
  };
  
  return descriptor;
};

export default networkService;