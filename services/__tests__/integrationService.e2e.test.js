/**
 * End-to-end integration tests for the complete Resonance system
 * Tests complete user workflows and service coordination
 */

import { IntegrationService } from '../integrationService';
import { initializationService } from '../initializationService';
import { audioEngine } from '../audioEngine';
import { vadService } from '../vadService';
import { elevenLabsService } from '../elevenLabsService';
import { geminiService } from '../geminiService';
import { sessionManager } from '../sessionManager';

// Mock all dependencies
jest.mock('../initializationService');
jest.mock('../audioEngine');
jest.mock('../vadService');
jest.mock('../elevenLabsService');
jest.mock('../geminiService');
jest.mock('../sessionManager');
jest.mock('../chaosEngine');
jest.mock('../debugService');
jest.mock('../achievementService');
jest.mock('../quotaService');
jest.mock('../networkService');
jest.mock('../offlineService');

describe('IntegrationService - End-to-End Tests', () => {
  let integrationService;

  beforeEach(() => {
    integrationService = new IntegrationService();
    jest.clearAllMocks();

    // Mock successful initialization for all services
    initializationService.initialize.mockResolvedValue({ success: true });
    audioEngine.initialize.mockResolvedValue();
    vadService.initialize.mockReturnValue();
    elevenLabsService.initialize.mockResolvedValue();
    geminiService.initialize.mockResolvedValue();
    sessionManager.initialize.mockResolvedValue();

    // Mock service states
    audioEngine.isRecordingActive.mockReturnValue(false);
    audioEngine.isPlaybackActive.mockReturnValue(false);
    audioEngine.getAmplitude.mockReturnValue(0);
    vadService.isUserSpeaking.mockReturnValue(false);
    vadService.getNoiseFloor.mockReturnValue(0.1);
    elevenLabsService.isServiceConnected.mockReturnValue(false);
    elevenLabsService.isCurrentlyStreaming.mockReturnValue(false);
    sessionManager.isSessionActive.mockReturnValue(false);
  });

  afterEach(async () => {
    if (integrationService.isInitialized) {
      await integrationService.cleanup();
    }
  });

  describe('System Initialization', () => {
    test('should initialize all services in correct order', async () => {
      const result = await integrationService.initialize();

      expect(result.success).toBe(true);
      expect(initializationService.initialize).toHaveBeenCalledWith({
        enableNetworking: true,
        enableOfflineCache: true,
        progressCallback: undefined
      });

      // Verify services were initialized in order
      expect(audioEngine.initialize).toHaveBeenCalled();
      expect(vadService.initialize).toHaveBeenCalled();
      expect(elevenLabsService.initialize).toHaveBeenCalled();
      expect(geminiService.initialize).toHaveBeenCalled();
      expect(sessionManager.initialize).toHaveBeenCalled();
    });

    test('should handle service initialization failures gracefully', async () => {
      // Make a non-critical service fail
      elevenLabsService.initialize.mockRejectedValue(new Error('API key invalid'));

      const result = await integrationService.initialize();

      expect(result.success).toBe(true);
      expect(result.failedServices).toContain('elevenLabsService');
    });

    test('should fail if critical services fail to initialize', async () => {
      audioEngine.initialize.mockRejectedValue(new Error('Audio permission denied'));

      await expect(integrationService.initialize()).rejects.toThrow();
    });
  });

  describe('Training Session Workflow', () => {
    beforeEach(async () => {
      await integrationService.initialize();
      
      // Mock quota service
      const quotaService = require('../quotaService');
      quotaService.checkQuota.mockResolvedValue({ canProceed: true });
      quotaService.recordUsage.mockResolvedValue();

      // Mock network service
      const networkService = require('../networkService');
      networkService.isOnline.mockReturnValue(true);

      // Mock session manager
      sessionManager.startSession.mockResolvedValue({
        id: 'test-session-123',
        startTime: Date.now()
      });
      sessionManager.endSession.mockResolvedValue({
        id: 'test-session-123',
        score: 85,
        metrics: {
          pace: 150,
          confidence: 80,
          clarity: 90,
          fillerWordCount: 3,
          duration: 120000
        }
      });
    });

    test('should start complete training session successfully', async () => {
      const config = {
        scenario: 'crisis_negotiation',
        userRole: 'Customer Service Rep',
        aiRole: 'Angry Customer',
        voiceId: 'test-voice',
        contextDocuments: [
          { name: 'policy.pdf', content: 'Company policy content' }
        ],
        chaosEngine: {
          enabled: true,
          randomVoiceGen: true,
          backgroundNoise: false
        }
      };

      const session = await integrationService.startTrainingSession(config);

      expect(session.id).toBe('test-session-123');
      
      // Verify audio system started
      expect(audioEngine.startRecording).toHaveBeenCalled();
      
      // Verify ElevenLabs connection
      expect(elevenLabsService.connect).toHaveBeenCalledWith({
        voiceId: 'test-voice'
      });
      
      // Verify context documents loaded
      expect(geminiService.addContextDocuments).toHaveBeenCalledWith(config.contextDocuments);
      
      // Verify session started with all services
      expect(sessionManager.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          scenario: 'crisis_negotiation',
          userRole: 'Customer Service Rep',
          aiRole: 'Angry Customer'
        })
      );
    });

    test('should handle quota exceeded gracefully', async () => {
      const quotaService = require('../quotaService');
      quotaService.checkQuota.mockResolvedValue({ canProceed: false });

      const config = {
        scenario: 'crisis_negotiation',
        userRole: 'Customer Service Rep',
        aiRole: 'Angry Customer'
      };

      await expect(integrationService.startTrainingSession(config)).rejects.toThrow('Daily quota exceeded');
    });

    test('should end training session and generate complete report', async () => {
      const sessionId = 'test-session-123';
      
      // Mock services for session end
      const achievementService = require('../achievementService');
      achievementService.updateAchievements.mockResolvedValue();
      achievementService.getRecentAchievements.mockResolvedValue([
        { id: 'first_session', name: 'First Steps', earned: true }
      ]);

      geminiService.generateCoachFeedback.mockResolvedValue({
        positiveAspects: ['Good pace', 'Clear articulation'],
        improvementAreas: ['Reduce filler words'],
        nextSteps: ['Practice more scenarios'],
        overallSummary: 'Great progress!'
      });

      const result = await integrationService.endTrainingSession(sessionId);

      expect(result.score).toBe(85);
      expect(result.feedback).toBeDefined();
      expect(result.achievements).toBeDefined();
      
      // Verify cleanup
      expect(audioEngine.stopRecording).toHaveBeenCalled();
      expect(elevenLabsService.disconnect).toHaveBeenCalled();
      
      // Verify achievements updated
      expect(achievementService.updateAchievements).toHaveBeenCalled();
      
      // Verify quota recorded
      const quotaService = require('../quotaService');
      expect(quotaService.recordUsage).toHaveBeenCalled();
    });
  });

  describe('Voice Activity Handling', () => {
    beforeEach(async () => {
      await integrationService.initialize();
      sessionManager.isSessionActive.mockReturnValue(true);
    });

    test('should handle voice activity start correctly', async () => {
      elevenLabsService.isCurrentlyStreaming.mockReturnValue(true);

      await integrationService.handleVoiceActivity(true, 0.5);

      // Should interrupt AI speech
      expect(elevenLabsService.stopSpeaking).toHaveBeenCalled();
      expect(audioEngine.triggerBargeIn).toHaveBeenCalled();
      
      // Should notify session manager
      expect(sessionManager.handleUserSpeechStart).toHaveBeenCalled();
    });

    test('should handle voice activity end correctly', async () => {
      await integrationService.handleVoiceActivity(false, 0.1);

      // Should process user input
      expect(sessionManager.handleUserSpeechEnd).toHaveBeenCalled();
    });
  });

  describe('AI Response Processing', () => {
    beforeEach(async () => {
      await integrationService.initialize();
      
      const networkService = require('../networkService');
      networkService.isOnline.mockReturnValue(true);
      elevenLabsService.isServiceConnected.mockReturnValue(true);
      sessionManager.isSessionActive.mockReturnValue(true);
    });

    test('should process AI response with TTS', async () => {
      const text = 'This is an AI response for testing';
      const sessionId = 'test-session-123';

      await integrationService.processAIResponse(text, sessionId);

      // Should send text to ElevenLabs
      expect(elevenLabsService.sendText).toHaveBeenCalledWith(text, true);
      
      // Should record in session
      expect(sessionManager.recordAIResponse).toHaveBeenCalledWith(text);
    });

    test('should use offline fallback when network unavailable', async () => {
      const networkService = require('../networkService');
      networkService.isOnline.mockReturnValue(false);
      
      const offlineService = require('../offlineService');
      offlineService.getFallbackResponse.mockReturnValue('Offline response');

      const text = 'This is an AI response for testing';
      const sessionId = 'test-session-123';

      await integrationService.processAIResponse(text, sessionId);

      // Should use offline fallback
      expect(offlineService.getFallbackResponse).toHaveBeenCalled();
      expect(elevenLabsService.sendText).not.toHaveBeenCalled();
    });
  });

  describe('System Status and Health', () => {
    beforeEach(async () => {
      await integrationService.initialize();
    });

    test('should provide comprehensive system status', () => {
      const networkService = require('../networkService');
      networkService.getConnectionStatus.mockReturnValue({
        isConnected: true,
        connectionType: 'wifi'
      });

      const status = integrationService.getSystemStatus();

      expect(status.isInitialized).toBe(true);
      expect(status.services).toBeDefined();
      expect(status.network).toBeDefined();
      expect(status.audio).toBeDefined();
      expect(status.ai).toBeDefined();
      expect(status.session).toBeDefined();
    });

    test('should perform comprehensive health check', async () => {
      const networkService = require('../networkService');
      networkService.isOffline.mockReturnValue(false);
      
      const quotaService = require('../quotaService');
      quotaService.getQuotaStatus.mockReturnValue({
        usage: 50,
        limit: 1000
      });

      const health = await integrationService.performHealthCheck();

      expect(health.overall).toBe('healthy');
      expect(health.services).toBeDefined();
      expect(health.issues).toBeDefined();
      expect(health.recommendations).toBeDefined();
    });

    test('should detect degraded health conditions', async () => {
      const networkService = require('../networkService');
      networkService.isOffline.mockReturnValue(true);
      
      const quotaService = require('../quotaService');
      quotaService.getQuotaStatus.mockReturnValue({
        usage: 950,
        limit: 1000
      });

      const health = await integrationService.performHealthCheck();

      expect(health.overall).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Service Cleanup', () => {
    test('should cleanup all services properly', async () => {
      await integrationService.initialize();
      sessionManager.isSessionActive.mockReturnValue(true);
      sessionManager.endCurrentSession.mockResolvedValue();

      await integrationService.cleanup();

      // Should end active session
      expect(sessionManager.endCurrentSession).toHaveBeenCalled();
      
      // Should cleanup services
      expect(audioEngine.cleanup).toHaveBeenCalled();
      expect(elevenLabsService.cleanup).toHaveBeenCalled();
      expect(geminiService.cleanup).toHaveBeenCalled();
      
      expect(integrationService.isInitialized).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      await integrationService.initialize();
      
      // Make one service fail cleanup
      audioEngine.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(integrationService.cleanup()).resolves.not.toThrow();
      
      expect(integrationService.isInitialized).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle service integration errors', async () => {
      // Mock a service to fail during integration setup
      vadService.setVoiceActivityCallback.mockImplementation(() => {
        throw new Error('Callback setup failed');
      });

      // Should still initialize successfully
      const result = await integrationService.initialize();
      expect(result.success).toBe(true);
    });

    test('should propagate critical errors appropriately', async () => {
      await integrationService.initialize();

      const config = {
        scenario: 'crisis_negotiation',
        userRole: 'Customer Service Rep',
        aiRole: 'Angry Customer'
      };

      // Mock a critical failure
      audioEngine.startRecording.mockRejectedValue(new Error('Audio permission denied'));

      await expect(integrationService.startTrainingSession(config)).rejects.toThrow();
    });
  });
});