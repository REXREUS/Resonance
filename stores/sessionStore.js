import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { sessionManager } from '../services/sessionManager';

/**
 * Zustand store for session state management
 * Manages session state, metrics, and real-time updates
 */
export const useSessionStore = create(
  subscribeWithSelector((set, get) => ({
    // Session state
    sessionState: 'idle', // 'idle', 'initializing', 'active', 'paused', 'completed'
    currentSession: null,
    sessionConfig: null,
    
    // Real-time metrics
    metrics: {
      pace: 0, // Words per minute
      confidence: 0, // 0-100
      clarity: 0, // 0-100
      fillerWordCount: 0,
      duration: 0, // seconds
      emotionalState: 'neutral' // 'neutral', 'hostile', 'happy', 'frustrated', 'anxious'
    },
    
    // Conversation data
    conversationHistory: [],
    emotionalTelemetry: [],
    
    // Stress test specific data
    stressTestData: null,
    
    // Chaos engine data
    chaosStatistics: null,
    activeDisruptions: [],
    
    // UI state
    isMetricsVisible: true,
    isVisualizerActive: false,
    currentAmplitude: 0,
    
    // Actions
    
    /**
     * Initialize session with configuration
     * @param {Object} config - Session configuration
     */
    initializeSession: async (config) => {
      try {
        set({ sessionState: 'initializing' });
        
        const success = await sessionManager.startSession(config);
        
        if (success) {
          set({
            sessionState: 'active',
            currentSession: sessionManager.getSessionConfig(),
            sessionConfig: config,
            stressTestData: sessionManager.getStressTestStatus()
          });
          
          // Start metrics update interval
          get().startMetricsUpdates();
          
          return true;
        } else {
          set({ sessionState: 'idle' });
          return false;
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        set({ sessionState: 'idle' });
        throw error;
      }
    },
    
    /**
     * End current session
     */
    endSession: async () => {
      try {
        const sessionReport = await sessionManager.endSession();
        
        set({
          sessionState: 'completed',
          currentSession: null,
          sessionConfig: null,
          stressTestData: null
        });
        
        // Stop metrics updates
        get().stopMetricsUpdates();
        
        return sessionReport;
      } catch (error) {
        console.error('Failed to end session:', error);
        throw error;
      }
    },
    
    /**
     * Pause current session
     */
    pauseSession: () => {
      sessionManager.pauseSession();
      set({ sessionState: 'paused' });
      get().stopMetricsUpdates();
    },
    
    /**
     * Resume paused session
     */
    resumeSession: () => {
      sessionManager.resumeSession();
      set({ sessionState: 'active' });
      get().startMetricsUpdates();
    },
    
    /**
     * Update real-time metrics
     */
    updateMetrics: () => {
      const currentMetrics = sessionManager.getCurrentMetrics();
      const conversationHistory = sessionManager.getConversationHistory();
      const emotionalTelemetry = sessionManager.getEmotionalTelemetry();
      const chaosStatistics = sessionManager.getChaosStatistics();
      const stressTestData = sessionManager.getStressTestStatus();
      
      set({
        metrics: currentMetrics,
        conversationHistory,
        emotionalTelemetry,
        chaosStatistics,
        stressTestData
      });
    },
    
    /**
     * Start automatic metrics updates
     */
    startMetricsUpdates: () => {
      const state = get();
      
      // Clear existing interval if any
      if (state.metricsInterval) {
        clearInterval(state.metricsInterval);
      }
      
      // Start new interval for real-time updates
      const interval = setInterval(() => {
        const currentState = get();
        if (currentState.sessionState === 'active') {
          currentState.updateMetrics();
        }
      }, 1000); // Update every second
      
      set({ metricsInterval: interval });
    },
    
    /**
     * Stop automatic metrics updates
     */
    stopMetricsUpdates: () => {
      const state = get();
      if (state.metricsInterval) {
        clearInterval(state.metricsInterval);
        set({ metricsInterval: null });
      }
    },
    
    /**
     * Handle user speech input
     * @param {ArrayBuffer} audioData - User audio data
     * @param {string} transcription - Speech transcription
     */
    handleUserSpeech: (audioData, transcription) => {
      sessionManager.handleUserSpeech(audioData, transcription);
      // Metrics will be updated by the automatic update interval
    },
    
    /**
     * Handle AI speech output
     * @param {string} text - AI response text
     * @param {string} emotionalState - AI emotional state
     */
    handleAISpeech: (text, emotionalState) => {
      sessionManager.handleAISpeech(text, emotionalState);
      // Metrics will be updated by the automatic update interval
    },
    
    /**
     * Update current audio amplitude for visualizer
     * @param {number} amplitude - Current amplitude (0-1)
     */
    updateAmplitude: (amplitude) => {
      set({ currentAmplitude: amplitude });
    },
    
    /**
     * Toggle metrics visibility
     */
    toggleMetricsVisibility: () => {
      set((state) => ({ isMetricsVisible: !state.isMetricsVisible }));
    },
    
    /**
     * Set visualizer active state
     * @param {boolean} active - Whether visualizer is active
     */
    setVisualizerActive: (active) => {
      set({ isVisualizerActive: active });
    },
    
    /**
     * Trigger manual chaos disruption
     * @param {string} disruptionType - Type of disruption
     */
    triggerManualDisruption: (disruptionType) => {
      sessionManager.triggerManualDisruption(disruptionType);
      // Update chaos statistics
      setTimeout(() => {
        const chaosStatistics = sessionManager.getChaosStatistics();
        set({ chaosStatistics });
      }, 100);
    },
    
    /**
     * Transition to next caller in stress test
     */
    transitionToNextCaller: async () => {
      try {
        const nextCaller = await sessionManager.transitionToNextCaller();
        const stressTestData = sessionManager.getStressTestStatus();
        
        set({ stressTestData });
        
        return nextCaller;
      } catch (error) {
        console.error('Failed to transition to next caller:', error);
        throw error;
      }
    },
    
    /**
     * Get current caller in stress test
     */
    getCurrentCaller: () => {
      return sessionManager.getCurrentCaller();
    },
    
    /**
     * Get stamina history for stress test
     */
    getStaminaHistory: () => {
      return sessionManager.getStaminaHistory();
    },
    
    /**
     * Reset session state
     */
    resetSessionState: () => {
      const state = get();
      
      // Stop metrics updates
      if (state.metricsInterval) {
        clearInterval(state.metricsInterval);
      }
      
      set({
        sessionState: 'idle',
        currentSession: null,
        sessionConfig: null,
        metrics: {
          pace: 0,
          confidence: 0,
          clarity: 0,
          fillerWordCount: 0,
          duration: 0,
          emotionalState: 'neutral'
        },
        conversationHistory: [],
        emotionalTelemetry: [],
        stressTestData: null,
        chaosStatistics: null,
        activeDisruptions: [],
        currentAmplitude: 0,
        metricsInterval: null
      });
    },
    
    /**
     * Get session statistics
     */
    getSessionStatistics: () => {
      const state = get();
      return {
        sessionState: state.sessionState,
        metrics: state.metrics,
        conversationLength: state.conversationHistory.length,
        emotionalTelemetryPoints: state.emotionalTelemetry.length,
        chaosStatistics: state.chaosStatistics,
        stressTestData: state.stressTestData
      };
    },
    
    /**
     * Subscribe to stress test transitions
     * @param {Function} callback - Callback function for transitions
     */
    subscribeToStressTestTransitions: (callback) => {
      sessionManager.onStressTestTransition(callback);
    },
    
    // Internal state
    metricsInterval: null
  }))
);

/**
 * Selector hooks for specific parts of the session state
 */

// Session state selectors
export const useSessionState = () => useSessionStore((state) => state.sessionState);
export const useCurrentSession = () => useSessionStore((state) => state.currentSession);
export const useSessionConfig = () => useSessionStore((state) => state.sessionConfig);

// Metrics selectors
export const useSessionMetrics = () => useSessionStore((state) => state.metrics);
export const useConversationHistory = () => useSessionStore((state) => state.conversationHistory);
export const useEmotionalTelemetry = () => useSessionStore((state) => state.emotionalTelemetry);

// Stress test selectors
export const useStressTestData = () => useSessionStore((state) => state.stressTestData);
export const useCurrentCaller = () => useSessionStore((state) => state.getCurrentCaller());

// Chaos engine selectors
export const useChaosStatistics = () => useSessionStore((state) => state.chaosStatistics);
export const useActiveDisruptions = () => useSessionStore((state) => state.activeDisruptions);

// UI state selectors
export const useCurrentAmplitude = () => useSessionStore((state) => state.currentAmplitude);
export const useIsMetricsVisible = () => useSessionStore((state) => state.isMetricsVisible);
export const useIsVisualizerActive = () => useSessionStore((state) => state.isVisualizerActive);

// Action selectors
export const useSessionActions = () => useSessionStore((state) => ({
  initializeSession: state.initializeSession,
  endSession: state.endSession,
  pauseSession: state.pauseSession,
  resumeSession: state.resumeSession,
  handleUserSpeech: state.handleUserSpeech,
  handleAISpeech: state.handleAISpeech,
  updateAmplitude: state.updateAmplitude,
  triggerManualDisruption: state.triggerManualDisruption,
  transitionToNextCaller: state.transitionToNextCaller,
  resetSessionState: state.resetSessionState
}));

/**
 * Custom hook for session management
 * Provides a complete interface for session operations
 */
export const useSessionManager = () => {
  const sessionState = useSessionState();
  const currentSession = useCurrentSession();
  const metrics = useSessionMetrics();
  const actions = useSessionActions();
  
  return {
    // State
    sessionState,
    currentSession,
    metrics,
    isActive: sessionState === 'active',
    isPaused: sessionState === 'paused',
    isIdle: sessionState === 'idle',
    
    // Actions
    ...actions,
    
    // Computed values
    isSessionRunning: sessionState === 'active' || sessionState === 'paused',
    canStartSession: sessionState === 'idle',
    canPauseSession: sessionState === 'active',
    canResumeSession: sessionState === 'paused',
    canEndSession: sessionState === 'active' || sessionState === 'paused'
  };
};

export default useSessionStore;