/**
 * Comprehensive error handling system for Resonance mobile app
 * Provides categorized error types, retry logic, and offline fallback mechanisms
 */

/**
 * Custom error class for Resonance application
 */
export class ResonanceError extends Error {
  constructor(code, message, category, recoverable = true, userMessage = null, originalError = null) {
    super(message);
    this.name = 'ResonanceError';
    this.code = code;
    this.category = category;
    this.recoverable = recoverable;
    this.userMessage = userMessage || message;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error categories for classification
 */
export const ErrorCategory = {
  NETWORK: 'network',
  AUDIO: 'audio',
  STORAGE: 'storage',
  AI_SERVICE: 'ai_service',
  VALIDATION: 'validation',
  PERMISSION: 'permission',
  INITIALIZATION: 'initialization',
  SESSION: 'session'
};

/**
 * Error codes for specific error types
 */
export const ErrorCode = {
  // Network errors
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  API_TIMEOUT: 'API_TIMEOUT',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',

  // Audio errors
  AUDIO_PERMISSION_DENIED: 'AUDIO_PERMISSION_DENIED',
  AUDIO_DEVICE_UNAVAILABLE: 'AUDIO_DEVICE_UNAVAILABLE',
  AUDIO_RECORDING_FAILED: 'AUDIO_RECORDING_FAILED',
  AUDIO_PLAYBACK_FAILED: 'AUDIO_PLAYBACK_FAILED',
  VAD_CALIBRATION_FAILED: 'VAD_CALIBRATION_FAILED',

  // Storage errors
  DATABASE_INIT_FAILED: 'DATABASE_INIT_FAILED',
  DATABASE_WRITE_FAILED: 'DATABASE_WRITE_FAILED',
  DATABASE_READ_FAILED: 'DATABASE_READ_FAILED',
  SECURE_STORE_FAILED: 'SECURE_STORE_FAILED',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',

  // AI Service errors
  ELEVENLABS_API_ERROR: 'ELEVENLABS_API_ERROR',
  GEMINI_API_ERROR: 'GEMINI_API_ERROR',
  VOICE_CLONING_FAILED: 'VOICE_CLONING_FAILED',
  TTS_GENERATION_FAILED: 'TTS_GENERATION_FAILED',

  // Validation errors
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Permission errors
  MICROPHONE_PERMISSION_DENIED: 'MICROPHONE_PERMISSION_DENIED',
  STORAGE_PERMISSION_DENIED: 'STORAGE_PERMISSION_DENIED',

  // Initialization errors
  SERVICE_INIT_FAILED: 'SERVICE_INIT_FAILED',
  COMPONENT_INIT_FAILED: 'COMPONENT_INIT_FAILED',

  // Session errors
  SESSION_START_FAILED: 'SESSION_START_FAILED',
  SESSION_END_FAILED: 'SESSION_END_FAILED',
  SESSION_INVALID_STATE: 'SESSION_INVALID_STATE'
};

/**
 * Severity levels for errors
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Main error handler class
 */
export class ErrorHandler {
  constructor() {
    this.retryAttempts = new Map();
    this.errorListeners = [];
    this.isOfflineMode = false;
    this.maxRetryAttempts = 3;
    this.retryDelayBase = 1000; // 1 second base delay
  }

  /**
   * Handle any error and determine appropriate response
   */
  async handle(error, context = {}) {
    const resonanceError = this._normalizeError(error, context);
    
    // Log the error
    this._logError(resonanceError, context);
    
    // Notify listeners
    this._notifyListeners(resonanceError, context);
    
    // Determine recovery strategy
    const recoveryStrategy = this._determineRecoveryStrategy(resonanceError);
    
    try {
      return await this._executeRecoveryStrategy(recoveryStrategy, resonanceError, context);
    } catch (recoveryError) {
      // If recovery fails, fall back to offline mode or show user error
      return this._handleRecoveryFailure(resonanceError, recoveryError, context);
    }
  }

  /**
   * Retry an operation with exponential backoff
   */
  async retry(operation, operationId, maxAttempts = null, context = {}) {
    const attempts = maxAttempts || this.maxRetryAttempts;
    const currentAttempt = (this.retryAttempts.get(operationId) || 0) + 1;
    
    if (currentAttempt > attempts) {
      this.retryAttempts.delete(operationId);
      throw new ResonanceError(
        ErrorCode.API_TIMEOUT,
        `Operation failed after ${attempts} attempts`,
        ErrorCategory.NETWORK,
        false,
        'Operation failed. Please check your connection and try again.'
      );
    }
    
    this.retryAttempts.set(operationId, currentAttempt);
    
    try {
      const result = await operation();
      this.retryAttempts.delete(operationId);
      return result;
    } catch (error) {
      const delay = this._calculateRetryDelay(currentAttempt);
      
      console.warn(`Retry attempt ${currentAttempt}/${attempts} failed for ${operationId}. Retrying in ${delay}ms...`);
      
      await this._delay(delay);
      return this.retry(operation, operationId, maxAttempts, context);
    }
  }

  /**
   * Switch to offline mode
   */
  enableOfflineMode() {
    this.isOfflineMode = true;
    console.log('Switched to offline mode');
    this._notifyListeners(
      new ResonanceError(
        ErrorCode.NETWORK_UNAVAILABLE,
        'Network unavailable, switching to offline mode',
        ErrorCategory.NETWORK,
        true,
        'You are now in offline mode. Some features may be limited.'
      ),
      { mode: 'offline' }
    );
  }

  /**
   * Switch back to online mode
   */
  disableOfflineMode() {
    this.isOfflineMode = false;
    console.log('Switched to online mode');
    this._notifyListeners(
      new ResonanceError(
        'NETWORK_RESTORED',
        'Network connection restored',
        ErrorCategory.NETWORK,
        true,
        'Connection restored. All features are now available.'
      ),
      { mode: 'online' }
    );
  }

  /**
   * Add error listener
   */
  addErrorListener(listener) {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeErrorListener(listener) {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error) {
    if (error instanceof ResonanceError) {
      return error.userMessage;
    }
    
    // Default messages for common error types
    const defaultMessages = {
      [ErrorCode.NETWORK_UNAVAILABLE]: 'No internet connection. The app will work in offline mode.',
      [ErrorCode.AUDIO_PERMISSION_DENIED]: 'Microphone permission is required for voice training.',
      [ErrorCode.DATABASE_INIT_FAILED]: 'Failed to initialize local storage. Please restart the app.',
      [ErrorCode.API_RATE_LIMIT]: 'API rate limit exceeded. Please wait a moment and try again.',
      [ErrorCode.VOICE_CLONING_FAILED]: 'Voice cloning failed. Please try with a different audio sample.'
    };
    
    return defaultMessages[error.code] || 'An unexpected error occurred. Please try again.';
  }

  // Private methods

  _normalizeError(error, context) {
    if (error instanceof ResonanceError) {
      return error;
    }
    
    // Convert standard errors to ResonanceError
    let category = ErrorCategory.VALIDATION;
    let code = 'UNKNOWN_ERROR';
    let recoverable = true;
    
    // Categorize based on error message or type
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      category = ErrorCategory.NETWORK;
      code = ErrorCode.NETWORK_UNAVAILABLE;
    } else if (error.message?.includes('permission')) {
      category = ErrorCategory.PERMISSION;
      code = ErrorCode.AUDIO_PERMISSION_DENIED;
      recoverable = false;
    } else if (error.message?.includes('database') || error.message?.includes('SQLite')) {
      category = ErrorCategory.STORAGE;
      code = ErrorCode.DATABASE_INIT_FAILED;
    } else if (error.message?.includes('audio') || error.message?.includes('recording')) {
      category = ErrorCategory.AUDIO;
      code = ErrorCode.AUDIO_RECORDING_FAILED;
    }
    
    return new ResonanceError(
      code,
      error.message,
      category,
      recoverable,
      null,
      error
    );
  }

  _logError(error, context) {
    const logData = {
      timestamp: new Date().toISOString(),
      error: error.toJSON ? error.toJSON() : error,
      context,
      isOfflineMode: this.isOfflineMode
    };
    
    console.error('ResonanceError:', logData);
    
    // In production, you might want to send this to a logging service
    // when online connectivity is restored
  }

  _notifyListeners(error, context) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  _determineRecoveryStrategy(error) {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'fallback_offline';
      case ErrorCategory.AUDIO:
        return error.recoverable ? 'retry_with_delay' : 'show_user_error';
      case ErrorCategory.STORAGE:
        return 'retry_with_delay';
      case ErrorCategory.AI_SERVICE:
        return this.isOfflineMode ? 'use_mock_response' : 'retry_with_delay';
      case ErrorCategory.PERMISSION:
        return 'show_user_error';
      default:
        return 'show_user_error';
    }
  }

  async _executeRecoveryStrategy(strategy, error, context) {
    switch (strategy) {
      case 'fallback_offline':
        this.enableOfflineMode();
        return { success: true, mode: 'offline' };
        
      case 'retry_with_delay':
        if (context.operation && context.operationId) {
          return await this.retry(context.operation, context.operationId);
        }
        throw error;
        
      case 'use_mock_response':
        return this._generateMockResponse(context);
        
      case 'show_user_error':
      default:
        throw error;
    }
  }

  _handleRecoveryFailure(originalError, recoveryError, context) {
    console.error('Recovery strategy failed:', recoveryError);
    
    // Last resort: enable offline mode and show user message
    if (!this.isOfflineMode) {
      this.enableOfflineMode();
    }
    
    return {
      success: false,
      error: originalError,
      userMessage: this.getUserMessage(originalError)
    };
  }

  _calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelayBase * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _generateMockResponse(context) {
    // Generate appropriate mock responses based on context
    switch (context.service) {
      case 'gemini':
        return {
          text: 'This is a mock AI response for offline mode.',
          emotion: 'neutral'
        };
      case 'elevenlabs':
        return {
          audioUrl: null,
          message: 'Voice synthesis unavailable in offline mode'
        };
      default:
        return { success: true, mock: true };
    }
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

// Utility functions for common error scenarios
export const createNetworkError = (message, userMessage) => {
  return new ResonanceError(
    ErrorCode.NETWORK_UNAVAILABLE,
    message,
    ErrorCategory.NETWORK,
    true,
    userMessage
  );
};

export const createAudioError = (message, userMessage) => {
  return new ResonanceError(
    ErrorCode.AUDIO_RECORDING_FAILED,
    message,
    ErrorCategory.AUDIO,
    true,
    userMessage
  );
};

export const createStorageError = (message, userMessage) => {
  return new ResonanceError(
    ErrorCode.DATABASE_WRITE_FAILED,
    message,
    ErrorCategory.STORAGE,
    true,
    userMessage
  );
};

export const createValidationError = (message, userMessage) => {
  return new ResonanceError(
    ErrorCode.INVALID_INPUT,
    message,
    ErrorCategory.VALIDATION,
    false,
    userMessage
  );
};