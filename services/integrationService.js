/**
 * Integration service for coordinating all Resonance mobile app services
 * Handles end-to-end workflows and service orchestration
 */

import { initializationService } from './initializationService';
import { audioEngine } from './audioEngine';
import { vadService } from './vadService';
import { elevenLabsService } from './elevenLabsService';
import { geminiService } from './geminiService';
import { chaosEngine } from './chaosEngine';
import { sessionManager } from './sessionManager';
import { databaseService } from './databaseService';
import { networkService } from './networkService';
import { offlineService } from './offlineService';
import { debugService } from './debugService';
import { achievementService } from './achievementService';
import { quotaService } from './quotaService';
import { 
  globalErrorHandler, 
  ResonanceError, 
  ErrorCode, 
  ErrorCategory 
} from '../utils/errorHandler';

export class IntegrationService {
  constructor() {
    this.isInitialized = false;
    this.services = new Map();
    this.serviceStatus = new Map();
    this.integrationCallbacks = new Map();
  }

  /**
   * Initialize all services in proper order
   */
  async initialize(options = {}) {
    try {
      console.log('Starting comprehensive service integration...');
      
      // Step 1: Initialize core system
      const initResult = await initializationService.initialize({
        enableNetworking: true,
        enableOfflineCache: true,
        progressCallback: options.progressCallback
      });

      if (!initResult.success) {
        throw new Error('Core system initialization failed');
      }

      // Step 2: Initialize debug service
      await this._initializeService('debug', () => 
        debugService.initialize({ 
          enabled: options.debugEnabled || false,
          logLevel: options.debugLevel || 'info'
        })
      );

      // Step 3: Initialize audio services
      await this._initializeService('audioEngine', () => 
        audioEngine.initialize({
          sampleRate: 16000,
          channels: 1,
          vadSensitivity: 'medium'
        })
      );

      await this._initializeService('vadService', () => {
        vadService.initialize({
          sensitivity: 'medium',
          noiseFloor: 0.1,
          minimumDuration: 150
        });
        return Promise.resolve();
      });

      // Step 4: Initialize AI services
      await this._initializeService('geminiService', () => 
        geminiService.initialize()
      );

      await this._initializeService('elevenLabsService', () => 
        elevenLabsService.initialize()
      );

      // Step 5: Initialize supporting services
      await this._initializeService('chaosEngine', () => {
        chaosEngine.initialize({
          enabled: false,
          randomVoiceGen: false,
          backgroundNoise: false,
          hardwareFailure: false
        });
        return Promise.resolve();
      });

      await this._initializeService('achievementService', () => 
        achievementService.initialize()
      );

      await this._initializeService('quotaService', () => 
        quotaService.initialize()
      );

      // Step 6: Initialize session manager (coordinates other services)
      await this._initializeService('sessionManager', () => 
        sessionManager.initialize()
      );

      // Step 7: Set up service integrations
      await this._setupServiceIntegrations();

      this.isInitialized = true;
      console.log('Service integration completed successfully');

      return {
        success: true,
        services: Array.from(this.serviceStatus.keys()),
        failedServices: Array.from(this.serviceStatus.entries())
          .filter(([, status]) => !status.initialized)
          .map(([name]) => name),
        isOfflineMode: !networkService.isOnline()
      };

    } catch (error) {
      console.error('Service integration failed:', error);
      throw new ResonanceError(
        ErrorCode.SERVICE_INIT_FAILED,
        `Service integration failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        true,
        'Failed to initialize the application. Please restart and try again.'
      );
    }
  }

  /**
   * Start a complete training session workflow
   */
  async startTrainingSession(config) {
    try {
      this._ensureInitialized();
      
      debugService.logOperation('startTrainingSession', 'integration', { config });

      // Validate configuration
      if (!config.scenario || !config.userRole || !config.aiRole) {
        throw new ResonanceError(
          ErrorCode.INVALID_CONFIGURATION,
          'Missing required session configuration',
          ErrorCategory.VALIDATION,
          false,
          'Please configure the training scenario before starting'
        );
      }

      // Check quota limits
      const quotaStatus = await quotaService.checkQuota();
      if (!quotaStatus.canProceed) {
        throw new ResonanceError(
          ErrorCode.API_RATE_LIMIT,
          'Daily quota exceeded',
          ErrorCategory.VALIDATION,
          false,
          'Daily usage limit reached. Please try again tomorrow.'
        );
      }

      // Initialize audio calibration if needed
      if (!vadService.getNoiseFloor() || vadService.getNoiseFloor() === 0) {
        debugService.log('integration', 'info', 'Starting VAD calibration');
        const noiseFloor = await audioEngine.calibrateNoiseFloor(2000);
        vadService.calibrate([noiseFloor]);
      }

      // Start audio recording
      await audioEngine.startRecording();

      // Connect to ElevenLabs if online
      if (networkService.isOnline()) {
        await elevenLabsService.connect({
          voiceId: config.voiceId || 'default'
        });
      }

      // Load context documents into Gemini
      if (config.contextDocuments && config.contextDocuments.length > 0) {
        geminiService.addContextDocuments(config.contextDocuments);
      }

      // Configure chaos engine
      if (config.chaosEngine) {
        chaosEngine.updateConfiguration(config.chaosEngine);
        if (config.chaosEngine.enabled) {
          chaosEngine.startAutomaticDisruptions();
        }
      }

      // Start session
      const session = await sessionManager.startSession({
        ...config,
        audioEngine,
        vadService,
        elevenLabsService,
        geminiService,
        chaosEngine
      });

      debugService.log('integration', 'info', 'Training session started', { sessionId: session.id });

      return session;

    } catch (error) {
      debugService.logError(error, 'integration', { operation: 'startTrainingSession' });
      throw error;
    }
  }

  /**
   * End training session and generate report
   */
  async endTrainingSession(sessionId) {
    try {
      this._ensureInitialized();
      
      debugService.logOperation('endTrainingSession', 'integration', { sessionId });

      // Stop audio recording
      await audioEngine.stopRecording();

      // Disconnect from ElevenLabs
      if (elevenLabsService.isServiceConnected()) {
        elevenLabsService.disconnect();
      }

      // Stop chaos engine
      chaosEngine.stopAutomaticDisruptions();

      // End session and get results
      const sessionResult = await sessionManager.endSession(sessionId);

      // Generate AI feedback
      const feedback = await geminiService.generateCoachFeedback(sessionResult);

      // Update achievements
      await achievementService.updateAchievements(sessionResult);

      // Update quota usage
      await quotaService.recordUsage({
        geminiTokens: sessionResult.metrics.geminiTokensUsed || 0,
        elevenLabsCharacters: sessionResult.metrics.elevenLabsCharsUsed || 0
      });

      debugService.log('integration', 'info', 'Training session ended', { 
        sessionId, 
        score: sessionResult.score 
      });

      return {
        ...sessionResult,
        feedback,
        achievements: await achievementService.getRecentAchievements()
      };

    } catch (error) {
      debugService.logError(error, 'integration', { operation: 'endTrainingSession' });
      throw error;
    }
  }

  /**
   * Handle voice activity detection events
   */
  async handleVoiceActivity(isActive, amplitude) {
    try {
      if (isActive) {
        // User started speaking - interrupt AI if needed
        if (elevenLabsService.isCurrentlyStreaming()) {
          await elevenLabsService.stopSpeaking();
          await audioEngine.triggerBargeIn();
        }
        
        // Notify session manager
        if (sessionManager.isSessionActive()) {
          sessionManager.handleUserSpeechStart();
        }
      } else {
        // User stopped speaking - process input
        if (sessionManager.isSessionActive()) {
          await sessionManager.handleUserSpeechEnd();
        }
      }
    } catch (error) {
      debugService.logError(error, 'integration', { operation: 'handleVoiceActivity' });
    }
  }

  /**
   * Process AI response and play audio
   */
  async processAIResponse(text, sessionId) {
    try {
      debugService.log('integration', 'info', 'Processing AI response', { sessionId, textLength: text.length });

      // Generate TTS audio
      if (networkService.isOnline() && elevenLabsService.isServiceConnected()) {
        // Stream TTS via WebSocket
        elevenLabsService.sendText(text, true);
      } else {
        // Use offline fallback
        const fallbackResponse = offlineService.getFallbackResponse('default', { text });
        debugService.log('integration', 'warn', 'Using offline fallback for TTS');
      }

      // Apply chaos engine effects if enabled
      if (chaosEngine.getConfiguration().enabled) {
        // Voice variation will be applied automatically to audio chunks
        debugService.log('integration', 'info', 'Chaos engine effects active');
      }

      // Update session with AI response
      if (sessionManager.isSessionActive()) {
        sessionManager.recordAIResponse(text);
      }

    } catch (error) {
      debugService.logError(error, 'integration', { operation: 'processAIResponse' });
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      services: Object.fromEntries(this.serviceStatus),
      network: networkService.getConnectionStatus(),
      audio: {
        isRecording: audioEngine.isRecordingActive(),
        isPlaying: audioEngine.isPlaybackActive(),
        amplitude: audioEngine.getAmplitude(),
        vadActive: vadService.isUserSpeaking(),
        noiseFloor: vadService.getNoiseFloor()
      },
      ai: {
        geminiInitialized: geminiService.isInitialized,
        elevenLabsConnected: elevenLabsService.isServiceConnected(),
        elevenLabsStreaming: elevenLabsService.isCurrentlyStreaming()
      },
      session: sessionManager.getSessionStatus(),
      chaos: chaosEngine.getStatistics(),
      quota: quotaService.getQuotaStatus(),
      debug: debugService.getDebugStats()
    };
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    const healthStatus = {
      overall: 'healthy',
      services: {},
      issues: [],
      recommendations: []
    };

    try {
      // Check each service
      for (const [serviceName, status] of this.serviceStatus) {
        if (!status.initialized) {
          healthStatus.services[serviceName] = 'failed';
          healthStatus.issues.push(`${serviceName} failed to initialize`);
        } else if (status.lastError) {
          healthStatus.services[serviceName] = 'degraded';
          healthStatus.issues.push(`${serviceName} has recent errors`);
        } else {
          healthStatus.services[serviceName] = 'healthy';
        }
      }

      // Check network connectivity
      if (networkService.isOffline()) {
        healthStatus.issues.push('Network connectivity unavailable');
        healthStatus.recommendations.push('Some features may be limited in offline mode');
      }

      // Check quota status
      const quotaStatus = quotaService.getQuotaStatus();
      if (quotaStatus.usage > quotaStatus.limit * 0.9) {
        healthStatus.issues.push('Approaching daily quota limit');
        healthStatus.recommendations.push('Consider reducing usage or upgrading plan');
      }

      // Check audio system
      if (!audioEngine.isInitialized) {
        healthStatus.issues.push('Audio system not available');
        healthStatus.recommendations.push('Check microphone permissions');
      }

      // Determine overall health
      if (healthStatus.issues.length > 0) {
        healthStatus.overall = healthStatus.issues.some(issue => 
          issue.includes('failed') || issue.includes('not available')
        ) ? 'critical' : 'degraded';
      }

      debugService.log('integration', 'info', 'Health check completed', { 
        overall: healthStatus.overall,
        issueCount: healthStatus.issues.length 
      });

      return healthStatus;

    } catch (error) {
      debugService.logError(error, 'integration', { operation: 'performHealthCheck' });
      return {
        overall: 'critical',
        services: {},
        issues: ['Health check failed'],
        recommendations: ['Restart the application']
      };
    }
  }

  /**
   * Clean up all services
   */
  async cleanup() {
    try {
      debugService.log('integration', 'info', 'Starting service cleanup');

      // Stop any active sessions
      if (sessionManager.isSessionActive()) {
        await sessionManager.endCurrentSession();
      }

      // Cleanup services in reverse order
      const services = [
        'sessionManager', 'quotaService', 'achievementService', 
        'chaosEngine', 'elevenLabsService', 'geminiService',
        'vadService', 'audioEngine', 'debugService'
      ];

      for (const serviceName of services) {
        try {
          const service = this._getService(serviceName);
          if (service && typeof service.cleanup === 'function') {
            await service.cleanup();
          }
        } catch (error) {
          console.warn(`Failed to cleanup ${serviceName}:`, error);
        }
      }

      this.services.clear();
      this.serviceStatus.clear();
      this.integrationCallbacks.clear();
      this.isInitialized = false;

      console.log('Service integration cleanup completed');

    } catch (error) {
      console.error('Error during service cleanup:', error);
    }
  }

  // Private methods

  async _initializeService(name, initFunction) {
    try {
      debugService.log('integration', 'info', `Initializing ${name}`);
      
      await initFunction();
      
      this.serviceStatus.set(name, {
        initialized: true,
        lastError: null,
        initTime: Date.now()
      });
      
      debugService.log('integration', 'info', `${name} initialized successfully`);
      
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      
      this.serviceStatus.set(name, {
        initialized: false,
        lastError: error.message,
        initTime: Date.now()
      });
      
      // Don't throw for non-critical services
      const criticalServices = ['audioEngine', 'vadService', 'sessionManager'];
      if (criticalServices.includes(name)) {
        throw error;
      }
    }
  }

  async _setupServiceIntegrations() {
    // Set up VAD callback
    vadService.setVoiceActivityCallback((isActive, amplitude) => {
      this.handleVoiceActivity(isActive, amplitude);
    });

    // Set up audio chunk callback for VAD
    audioEngine.setAudioChunkCallback((audioData, amplitude) => {
      vadService.processAudioChunk(audioData, amplitude);
    });

    // Set up ElevenLabs audio callback
    elevenLabsService.onAudioChunk((audioData) => {
      // Apply chaos engine effects if enabled
      const processedAudio = chaosEngine.applyVoiceVariation(audioData);
      audioEngine.playAudio(processedAudio);
    });

    // Set up chaos engine callbacks
    chaosEngine.setCallbacks({
      onVoiceVariation: (params) => {
        debugService.log('chaos', 'info', 'Voice variation applied', params);
      },
      onNoiseInjection: (params) => {
        debugService.log('chaos', 'info', 'Background noise injected', params);
      },
      onHardwareFailure: (params) => {
        debugService.log('chaos', 'warn', 'Hardware failure simulated', params);
      }
    });

    // Set up error handler integration
    globalErrorHandler.addErrorListener((error, context) => {
      debugService.logError(error, 'system', context);
    });

    debugService.log('integration', 'info', 'Service integrations configured');
  }

  _getService(name) {
    const serviceMap = {
      audioEngine,
      vadService,
      elevenLabsService,
      geminiService,
      chaosEngine,
      sessionManager,
      debugService,
      achievementService,
      quotaService
    };
    
    return serviceMap[name];
  }

  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new ResonanceError(
        ErrorCode.SERVICE_INIT_FAILED,
        'Integration service not initialized',
        ErrorCategory.INITIALIZATION,
        false,
        'Application not ready. Please restart the app.'
      );
    }
  }
}

// Global integration service instance
export const integrationService = new IntegrationService();

export default integrationService;