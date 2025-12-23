import { useEffect, useCallback, useRef } from 'react';
import { useSessionStore, useSessionActions, useSessionState } from '../stores/sessionStore';
import { audioEngine } from '../services/audioEngine';
import { vadService } from '../services/vadService';
import { sessionManager } from '../services/sessionManager';

/**
 * Custom hook for session management integration
 * Handles real-time audio processing, VAD integration, and metrics updates
 */
export const useSessionManager = () => {
  const sessionState = useSessionState();
  const actions = useSessionActions();
  const audioCallbackRef = useRef(null);
  const vadCallbackRef = useRef(null);
  
  // Get current session data
  const {
    metrics,
    conversationHistory,
    emotionalTelemetry,
    stressTestData,
    chaosStatistics,
    currentAmplitude,
    isMetricsVisible,
    isVisualizerActive
  } = useSessionStore((state) => ({
    metrics: state.metrics,
    conversationHistory: state.conversationHistory,
    emotionalTelemetry: state.emotionalTelemetry,
    stressTestData: state.stressTestData,
    chaosStatistics: state.chaosStatistics,
    currentAmplitude: state.currentAmplitude,
    isMetricsVisible: state.isMetricsVisible,
    isVisualizerActive: state.isVisualizerActive
  }));
  
  /**
   * Initialize session with real-time audio integration
   */
  const initializeSession = useCallback(async (config) => {
    try {
      // Initialize session through store
      const success = await actions.initializeSession(config);
      
      if (success) {
        // Set up real-time audio processing
        setupAudioIntegration();
        
        console.log('Session initialized with real-time integration');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to initialize session with integration:', error);
      throw error;
    }
  }, [actions]);
  
  /**
   * End session and cleanup integrations
   */
  const endSession = useCallback(async () => {
    try {
      // Cleanup audio integration
      cleanupAudioIntegration();
      
      // End session through store
      const sessionReport = await actions.endSession();
      
      console.log('Session ended with cleanup');
      return sessionReport;
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }, [actions]);
  
  /**
   * Set up real-time audio processing integration
   */
  const setupAudioIntegration = useCallback(() => {
    // Audio chunk callback for real-time processing
    audioCallbackRef.current = (audioData, amplitude) => {
      try {
        // Update amplitude in store for visualizer
        actions.updateAmplitude(amplitude);
        
        // Process with VAD service
        vadService.processAudioChunk(audioData, amplitude);
        
        // Apply chaos engine effects if session is active
        if (sessionState === 'active') {
          // This would be handled by SessionManager internally
          // but we can trigger UI updates here if needed
        }
      } catch (error) {
        console.error('Error in audio chunk processing:', error);
      }
    };
    
    // VAD callback for voice activity detection
    vadCallbackRef.current = (isActive, amplitude) => {
      try {
        if (isActive && sessionState === 'active') {
          // Voice activity detected - could trigger barge-in
          console.log('Voice activity detected, amplitude:', amplitude);
          
          // Trigger barge-in through audio engine
          audioEngine.triggerBargeIn();
        }
      } catch (error) {
        console.error('Error in VAD callback:', error);
      }
    };
    
    // Set callbacks on services
    audioEngine.setAudioChunkCallback(audioCallbackRef.current);
    vadService.setVoiceActivityCallback(vadCallbackRef.current);
    
    console.log('Audio integration callbacks set up');
  }, [sessionState, actions]);
  
  /**
   * Cleanup audio integration
   */
  const cleanupAudioIntegration = useCallback(() => {
    // Remove callbacks
    audioEngine.setAudioChunkCallback(null);
    vadService.setVoiceActivityCallback(null);
    
    // Clear refs
    audioCallbackRef.current = null;
    vadCallbackRef.current = null;
    
    console.log('Audio integration cleaned up');
  }, []);
  
  /**
   * Handle user speech with transcription
   */
  const handleUserSpeech = useCallback((audioData, transcription) => {
    if (sessionState === 'active') {
      actions.handleUserSpeech(audioData, transcription);
    }
  }, [sessionState, actions]);
  
  /**
   * Handle AI speech response
   */
  const handleAISpeech = useCallback((text, emotionalState = 'neutral') => {
    if (sessionState === 'active') {
      actions.handleAISpeech(text, emotionalState);
    }
  }, [sessionState, actions]);
  
  /**
   * Pause session with audio cleanup
   */
  const pauseSession = useCallback(() => {
    // Pause audio processing
    audioEngine.stopRecording().catch(console.error);
    
    // Pause session
    actions.pauseSession();
  }, [actions]);
  
  /**
   * Resume session with audio restart
   */
  const resumeSession = useCallback(async () => {
    try {
      // Resume audio processing
      await audioEngine.startRecording();
      
      // Resume session
      actions.resumeSession();
    } catch (error) {
      console.error('Failed to resume session:', error);
      throw error;
    }
  }, [actions]);
  
  /**
   * Get real-time session statistics
   */
  const getSessionStatistics = useCallback(() => {
    return {
      sessionState,
      metrics,
      conversationLength: conversationHistory.length,
      emotionalTelemetryPoints: emotionalTelemetry.length,
      chaosStatistics,
      stressTestData,
      audioAmplitude: currentAmplitude,
      isVADActive: vadService.isUserSpeaking(),
      isRecording: audioEngine.isRecordingActive(),
      isPlaying: audioEngine.isPlaybackActive()
    };
  }, [
    sessionState,
    metrics,
    conversationHistory.length,
    emotionalTelemetry.length,
    chaosStatistics,
    stressTestData,
    currentAmplitude
  ]);
  
  /**
   * Trigger manual disruption with UI feedback
   */
  const triggerManualDisruption = useCallback((disruptionType) => {
    actions.triggerManualDisruption(disruptionType);
    
    // Could add UI feedback here (toast, animation, etc.)
    console.log(`Manual disruption triggered: ${disruptionType}`);
  }, [actions]);
  
  /**
   * Get current caller information (stress test)
   */
  const getCurrentCaller = useCallback(() => {
    return sessionManager.getCurrentCaller();
  }, []);
  
  /**
   * Transition to next caller with UI updates
   */
  const transitionToNextCaller = useCallback(async () => {
    try {
      const nextCaller = await actions.transitionToNextCaller();
      
      // Could trigger UI animations or notifications here
      if (nextCaller) {
        console.log('Transitioned to next caller:', nextCaller.name);
      } else {
        console.log('Stress test queue completed');
      }
      
      return nextCaller;
    } catch (error) {
      console.error('Failed to transition to next caller:', error);
      throw error;
    }
  }, [actions]);
  
  /**
   * Subscribe to stress test events
   */
  const subscribeToStressTestEvents = useCallback((callback) => {
    return sessionManager.onStressTestTransition(callback);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioIntegration();
    };
  }, [cleanupAudioIntegration]);
  
  // Auto-cleanup when session ends
  useEffect(() => {
    if (sessionState === 'idle' || sessionState === 'completed') {
      cleanupAudioIntegration();
    }
  }, [sessionState, cleanupAudioIntegration]);
  
  return {
    // Session state
    sessionState,
    isActive: sessionState === 'active',
    isPaused: sessionState === 'paused',
    isIdle: sessionState === 'idle',
    isCompleted: sessionState === 'completed',
    
    // Session data
    metrics,
    conversationHistory,
    emotionalTelemetry,
    stressTestData,
    chaosStatistics,
    currentAmplitude,
    
    // UI state
    isMetricsVisible,
    isVisualizerActive,
    
    // Session management actions
    initializeSession,
    endSession,
    pauseSession,
    resumeSession,
    
    // Speech handling
    handleUserSpeech,
    handleAISpeech,
    
    // Chaos engine
    triggerManualDisruption,
    
    // Stress test
    getCurrentCaller,
    transitionToNextCaller,
    subscribeToStressTestEvents,
    
    // Utilities
    getSessionStatistics,
    
    // Computed values
    isSessionRunning: sessionState === 'active' || sessionState === 'paused',
    canStartSession: sessionState === 'idle',
    canPauseSession: sessionState === 'active',
    canResumeSession: sessionState === 'paused',
    canEndSession: sessionState === 'active' || sessionState === 'paused',
    
    // Audio state
    isRecording: audioEngine.isRecordingActive(),
    isPlaying: audioEngine.isPlaybackActive(),
    isVADActive: vadService.isUserSpeaking()
  };
};

export default useSessionManager;