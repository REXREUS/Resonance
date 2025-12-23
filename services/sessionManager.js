import { chaosEngine } from './chaosEngine';
import { audioEngine } from './audioEngine';
import { vadService } from './vadService';
import { databaseService } from './databaseService';
import { geminiService } from './geminiService';
import { elevenLabsService } from './elevenLabsService';
import { achievementService } from './achievementService';
import { quotaService } from './quotaService';

/**
 * SessionManager class for orchestrating training sessions
 * Coordinates all services including chaos engine, audio, VAD, and AI
 */
class SessionManager {
  constructor() {
    this.currentSession = null;
    this.sessionState = 'idle'; // 'idle', 'initializing', 'active', 'paused', 'completed'
    this.metrics = {
      pace: 0, // Words per minute
      confidence: 0, // 0-100
      clarity: 0, // 0-100
      fillerWordCount: 0,
      duration: 0, // seconds
      emotionalState: 'neutral' // 'neutral', 'hostile', 'happy', 'frustrated', 'anxious'
    };
    this.conversationHistory = [];
    this.emotionalTelemetry = [];
    this.startTime = null;
    this.endTime = null;
    this.disruptionCallbacks = null;
    
    // Conversation state
    this.isProcessingResponse = false;
    this.conversationContext = null;
    this.onTranscriptUpdate = null;
    this.onAIResponse = null;
    this.onTTSComplete = null; // Callback for TTS completion
    this.onTTSStarting = null; // Callback for TTS starting (to pause listening)
    this.currentVoiceId = null;
  }

  /**
   * Start a new training session
   * @param {Object} config - Session configuration
   * @param {string} config.sessionId - Database session ID
   * @param {string} config.scenario - Training scenario
   * @param {string} config.language - Session language
   * @param {string} config.mode - Session mode ('single' or 'stress')
   * @param {number} config.queueLength - Number of callers (stress mode)
   * @param {number} config.interCallDelay - Delay between calls (stress mode)
   * @param {Object} config.chaosEngine - Chaos engine configuration
   * @param {Array} config.contextFiles - Context files for AI
   * @param {string} config.manualContext - Manual context text
   * @param {Object} config.defaultVoice - Default voice settings
   * @param {boolean} config.blindMode - Hide visual transcripts
   * @param {boolean} config.mockMode - Run without real API calls
   * @param {string} config.vadSensitivity - VAD sensitivity level
   * @returns {Promise<boolean>} Success status
   */
  async startSession(config) {
    try {
      // Force cleanup if session is not idle (handles hot reload scenarios)
      if (this.sessionState !== 'idle') {
        console.warn(`Session in state ${this.sessionState}, forcing cleanup before start`);
        await this.cleanup();
      }

      this.sessionState = 'initializing';
      this.currentSession = {
        ...config,
        startTime: Date.now()
      };

      console.log('Starting session:', config.scenario, 'mode:', config.mode);

      // Initialize stress test specific data if in stress mode
      if (config.mode === 'stress') {
        await this.initializeStressTestData(config);
      }

      // Initialize chaos engine if enabled
      if (config.chaosEngine && config.chaosEngine.enabled) {
        await this.initializeChaosEngine(config.chaosEngine);
      }

      // Initialize AI services (Gemini + ElevenLabs)
      if (!config.mockMode) {
        await this.initializeAIServices(config);
        
        // For stress mode, update conversation context with first caller's info
        if (config.mode === 'stress' && this.stressTestData?.callers?.length > 0) {
          const firstCaller = this.stressTestData.callers[0];
          this.conversationContext = {
            ...this.conversationContext,
            language: config.language || 'id', // Ensure language is preserved
            aiRole: this.getAIRoleForStressCaller(firstCaller),
          };
          console.log('Updated conversation context for first stress caller:', {
            language: this.conversationContext.language,
            aiRole: this.conversationContext.aiRole,
          });
        }
      }

      // Initialize audio and VAD services
      await this.initializeAudioServices(config.vadSensitivity);

      // Set up session callbacks
      this.setupSessionCallbacks();

      // Reset metrics
      this.resetMetrics();

      // Start session timer
      this.startTime = Date.now();
      this.sessionState = 'active';

      // Start automatic chaos disruptions if enabled
      if (config.chaosEngine && config.chaosEngine.enabled) {
        chaosEngine.startAutomaticDisruptions();
      }

      // NOTE: Initial greeting is NOT sent here anymore
      // It should be triggered by the UI after initialization is complete
      // Use sendInitialGreeting() method to start the conversation

      console.log('Session started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start session:', error);
      this.sessionState = 'idle';
      throw error;
    }
  }

  /**
   * End the current session
   * @returns {Promise<Object>} Session report
   */
  async endSession() {
    try {
      if (this.sessionState !== 'active' && this.sessionState !== 'paused') {
        throw new Error(`Cannot end session in state: ${this.sessionState}`);
      }

      this.endTime = Date.now();
      this.sessionState = 'completed';

      // Stop chaos engine
      if (chaosEngine.getConfiguration().enabled) {
        chaosEngine.stopAutomaticDisruptions();
        await chaosEngine.stopContinuousNoise();
      }

      // Calculate final metrics
      this.calculateFinalMetrics();

      // Generate session report
      const sessionReport = await this.generateSessionReport();

      // Update database
      if (this.currentSession.sessionId) {
        await this.updateSessionInDatabase(sessionReport);
      }

      // Clean up
      await this.cleanup();

      console.log('Session ended successfully');
      return sessionReport;
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Pause the current session
   */
  pauseSession() {
    if (this.sessionState === 'active') {
      this.sessionState = 'paused';
      
      // Pause chaos engine
      chaosEngine.stopAutomaticDisruptions();
      
      console.log('Session paused');
    }
  }

  /**
   * Resume a paused session
   */
  resumeSession() {
    if (this.sessionState === 'paused') {
      this.sessionState = 'active';
      
      // Resume chaos engine if enabled
      if (chaosEngine.getConfiguration().enabled) {
        chaosEngine.startAutomaticDisruptions();
      }
      
      console.log('Session resumed');
    }
  }

  /**
   * Get current session metrics
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    // Update duration
    if (this.startTime && this.sessionState === 'active') {
      this.metrics.duration = Math.floor((Date.now() - this.startTime) / 1000);
    }

    return { ...this.metrics };
  }

  /**
   * Handle user speech input
   * @param {ArrayBuffer} audioData - User audio data
   * @param {string} transcription - Speech transcription
   */
  handleUserSpeech(audioData, transcription = '') {
    try {
      if (this.sessionState !== 'active') {
        return;
      }

      // Apply chaos engine effects to audio if enabled
      let processedAudio = audioData;
      if (chaosEngine.getConfiguration().enabled) {
        processedAudio = chaosEngine.applyVoiceVariation(audioData);
        processedAudio = chaosEngine.injectBackgroundNoise(processedAudio);
      }

      // Update metrics
      this.updateMetricsFromUserSpeech(transcription);

      // Add to conversation history
      this.conversationHistory.push({
        sender: 'user',
        text: transcription,
        audioPath: null, // Would store audio file path in real implementation
        timestamp: Date.now() - this.startTime,
        hasHesitation: this.detectHesitation(transcription)
      });

      console.log('User speech processed:', transcription);
    } catch (error) {
      console.error('Error handling user speech:', error);
    }
  }

  /**
   * Handle AI speech output
   * @param {string} text - AI response text
   * @param {string} emotionalState - AI emotional state
   */
  handleAISpeech(text, emotionalState = 'neutral') {
    try {
      if (this.sessionState !== 'active') {
        return;
      }

      // Update emotional telemetry
      this.emotionalTelemetry.push({
        timestamp: Date.now() - this.startTime,
        state: emotionalState,
        intensity: this.calculateEmotionalIntensity(emotionalState)
      });

      // Update current emotional state
      this.metrics.emotionalState = emotionalState;

      // Add to conversation history
      this.conversationHistory.push({
        sender: 'ai',
        text: text,
        audioPath: null,
        timestamp: Date.now() - this.startTime,
        hasHesitation: false
      });

      console.log('AI speech processed:', text, 'emotion:', emotionalState);
    } catch (error) {
      console.error('Error handling AI speech:', error);
    }
  }

  /**
   * Get current session state
   * @returns {string} Current session state
   */
  getSessionState() {
    return this.sessionState;
  }

  /**
   * Get current session configuration
   * @returns {Object} Session configuration
   */
  getSessionConfig() {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get conversation history
   * @returns {Array} Conversation history
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get emotional telemetry data
   * @returns {Array} Emotional telemetry points
   */
  getEmotionalTelemetry() {
    return [...this.emotionalTelemetry];
  }

  /**
   * Get chaos engine statistics
   * @returns {Object} Chaos engine statistics
   */
  getChaosStatistics() {
    return chaosEngine.getStatistics();
  }

  /**
   * Trigger manual chaos disruption
   * @param {string} disruptionType - Type of disruption to trigger
   */
  triggerManualDisruption(disruptionType) {
    if (this.sessionState !== 'active') {
      return;
    }

    switch (disruptionType) {
      case 'voice_variation':
        console.log('Manual voice variation will be applied to next audio');
        break;
      case 'background_noise':
        chaosEngine.startContinuousNoise();
        setTimeout(() => chaosEngine.stopContinuousNoise(), 10000);
        break;
      case 'hardware_failure':
        chaosEngine.simulateHardwareFailure('random', 5000);
        break;
      default:
        console.warn(`Unknown disruption type: ${disruptionType}`);
    }
  }

  // Private methods

  /**
   * Initialize stress test specific data
   * @param {Object} config - Session configuration
   */
  async initializeStressTestData(config) {
    const queueLength = config.queueLength || 3;
    const difficultyCurve = config.difficultyCurve || 50; // 0-100, affects how difficulty scales
    
    // Fetch available voices for random assignment
    let availableVoices = [];
    if (!config.mockMode) {
      try {
        availableVoices = await elevenLabsService.listVoices();
        console.log(`Loaded ${availableVoices.length} voices for stress test`);
      } catch (e) {
        console.warn('Failed to load voices for stress test:', e);
      }
    }
    
    this.stressTestData = {
      queueLength: queueLength,
      interCallDelay: config.interCallDelay || 5, // seconds between calls
      difficultyCurve: difficultyCurve,
      currentCallerIndex: 0,
      callers: this.generateCallerQueueWithDifficulty(queueLength, difficultyCurve, availableVoices),
      availableVoices: availableVoices,
      stamina: 100,
      staminaHistory: [],
      transitionCallbacks: [],
      callStartTime: null,
      totalCallTime: 0,
      completedCalls: 0,
    };
    
    // Set initial voice for first caller
    if (this.stressTestData.callers.length > 0 && this.stressTestData.callers[0].voiceId) {
      this.currentVoiceId = this.stressTestData.callers[0].voiceId;
      console.log(`Initial caller voice: ${this.stressTestData.callers[0].voiceName}`);
    }
    
    console.log('Stress test initialized:', {
      queueLength,
      interCallDelay: this.stressTestData.interCallDelay,
      difficultyCurve,
      voicesAvailable: availableVoices.length,
    });
  }

  /**
   * Generate caller queue with difficulty curve applied
   * @param {number} queueLength - Number of callers
   * @param {number} difficultyCurve - Difficulty curve (0-100)
   * @param {Array} availableVoices - Available ElevenLabs voices
   * @returns {Array} Array of caller objects
   */
  generateCallerQueueWithDifficulty(queueLength, difficultyCurve, availableVoices = []) {
    const moods = ['neutral', 'hostile', 'frustrated', 'anxious', 'demanding'];
    const scenarios = ['complaint', 'negotiation', 'objection', 'crisis', 'inquiry'];
    const callers = [];
    
    // Caller name pools for more realistic names
    const maleNames = ['Ahmad', 'Budi', 'Dimas', 'Eko', 'Fajar', 'Gilang', 'Hendra', 'Irfan', 'John', 'Kevin', 'Michael', 'David'];
    const femaleNames = ['Ani', 'Bunga', 'Citra', 'Dewi', 'Eka', 'Fitri', 'Gita', 'Hana', 'Sarah', 'Lisa', 'Maria', 'Nina'];
    
    // Difficulty curve affects how difficulty increases through the queue
    // 0 = flat difficulty, 50 = moderate increase, 100 = steep increase
    const curveMultiplier = difficultyCurve / 100;
    
    // Shuffle voices to ensure variety
    const shuffledVoices = availableVoices.length > 0 
      ? [...availableVoices].sort(() => Math.random() - 0.5)
      : [];
    
    for (let i = 0; i < queueLength; i++) {
      // Calculate position-based difficulty (0 to 1)
      const positionRatio = i / Math.max(1, queueLength - 1);
      
      // Apply difficulty curve: higher curve = steeper difficulty increase
      const baseDifficulty = 1 + Math.floor(positionRatio * 4 * curveMultiplier);
      const randomVariation = Math.floor(Math.random() * 2) - 1; // -1, 0, or 1
      const difficulty = Math.max(1, Math.min(5, baseDifficulty + randomVariation));
      
      // Higher difficulty = more likely to get hostile/frustrated moods
      const moodIndex = this.selectMoodByDifficulty(difficulty, moods);
      const scenarioIndex = Math.floor(Math.random() * scenarios.length);
      
      // Assign random voice from available voices (cycle through if more callers than voices)
      let voiceId = null;
      let voiceName = null;
      let callerGender = Math.random() > 0.5 ? 'male' : 'female';
      
      if (shuffledVoices.length > 0) {
        const voiceIndex = i % shuffledVoices.length;
        const voice = shuffledVoices[voiceIndex];
        voiceId = voice.id;
        voiceName = voice.name;
        // Try to infer gender from voice name (basic heuristic)
        const nameLower = voice.name.toLowerCase();
        if (nameLower.includes('female') || nameLower.includes('woman') || nameLower.includes('girl') ||
            nameLower.includes('sarah') || nameLower.includes('rachel') || nameLower.includes('emily') ||
            nameLower.includes('bella') || nameLower.includes('elli') || nameLower.includes('domi')) {
          callerGender = 'female';
        } else if (nameLower.includes('male') || nameLower.includes('man') || nameLower.includes('boy') ||
                   nameLower.includes('adam') || nameLower.includes('josh') || nameLower.includes('sam') ||
                   nameLower.includes('arnold') || nameLower.includes('antoni') || nameLower.includes('brian')) {
          callerGender = 'male';
        }
      }
      
      // Select name based on gender
      const namePool = callerGender === 'female' ? femaleNames : maleNames;
      const callerName = namePool[Math.floor(Math.random() * namePool.length)];
      
      const caller = {
        id: i + 1,
        name: callerName,
        gender: callerGender,
        mood: moods[moodIndex],
        scenario: scenarios[scenarioIndex],
        difficulty: difficulty,
        objective: this.generateObjective(scenarios[scenarioIndex]),
        estimatedDuration: this.calculateEstimatedDuration(difficulty),
        positionInQueue: i + 1,
        voiceId: voiceId,
        voiceName: voiceName,
      };
      callers.push(caller);
    }
    
    return callers;
  }

  /**
   * Select mood based on difficulty level
   * @param {number} difficulty - Difficulty level (1-5)
   * @param {Array} moods - Available moods
   * @returns {number} Mood index
   */
  selectMoodByDifficulty(difficulty, moods) {
    // Higher difficulty = higher chance of difficult moods (hostile, frustrated, demanding)
    const weights = {
      1: [0.5, 0.1, 0.1, 0.2, 0.1], // neutral heavy
      2: [0.3, 0.15, 0.2, 0.2, 0.15],
      3: [0.2, 0.2, 0.25, 0.2, 0.15],
      4: [0.1, 0.25, 0.25, 0.2, 0.2],
      5: [0.05, 0.3, 0.25, 0.15, 0.25], // hostile/demanding heavy
    };
    
    const moodWeights = weights[difficulty] || weights[3];
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < moodWeights.length; i++) {
      cumulative += moodWeights[i];
      if (random <= cumulative) {
        return i;
      }
    }
    
    return 0;
  }

  /**
   * Calculate estimated call duration based on difficulty
   * @param {number} difficulty - Difficulty level (1-5)
   * @returns {number} Estimated duration in seconds
   */
  calculateEstimatedDuration(difficulty) {
    // Higher difficulty = longer calls
    const baseDuration = 60; // 1 minute minimum
    const difficultyBonus = difficulty * 45; // Up to 225 seconds extra
    const randomVariation = Math.floor(Math.random() * 60) - 30; // ±30 seconds
    
    return Math.max(60, baseDuration + difficultyBonus + randomVariation);
  }

  /**
   * Generate caller queue for stress test (legacy method for compatibility)
   * @param {number} queueLength - Number of callers
   * @returns {Array} Array of caller objects
   */
  generateCallerQueue(queueLength) {
    return this.generateCallerQueueWithDifficulty(queueLength, 50);
  }

  /**
   * Generate mission objective for caller
   * @param {string} scenario - Scenario type
   * @returns {string} Mission objective
   */
  generateObjective(scenario) {
    const objectives = {
      complaint: 'Resolve customer complaint while maintaining satisfaction',
      negotiation: 'Reach mutually beneficial agreement within budget',
      objection: 'Address concerns and move forward with proposal',
      crisis: 'De-escalate situation and find immediate solution',
      inquiry: 'Provide comprehensive information and guidance'
    };
    return objectives[scenario] || 'Handle interaction professionally';
  }

  /**
   * Get current caller in stress test
   * @returns {Object|null} Current caller object
   */
  getCurrentCaller() {
    if (!this.stressTestData || this.stressTestData.currentCallerIndex >= this.stressTestData.callers.length) {
      return null;
    }
    return this.stressTestData.callers[this.stressTestData.currentCallerIndex];
  }

  /**
   * Get stress test queue status
   * @returns {Object} Queue status
   */
  getStressTestStatus() {
    if (!this.stressTestData) {
      return null;
    }

    return {
      queueLength: this.stressTestData.queueLength,
      currentPosition: this.stressTestData.currentCallerIndex + 1,
      remaining: this.stressTestData.queueLength - this.stressTestData.currentCallerIndex - 1,
      isActive: this.sessionState === 'active',
      progress: ((this.stressTestData.currentCallerIndex + 1) / this.stressTestData.queueLength) * 100,
      stamina: this.stressTestData.stamina,
      interCallDelay: this.stressTestData.interCallDelay,
      difficultyCurve: this.stressTestData.difficultyCurve,
      completedCalls: this.stressTestData.completedCalls || 0,
      totalCallTime: this.stressTestData.totalCallTime || 0,
    };
  }

  /**
   * Start tracking current call time
   */
  startCallTimer() {
    if (this.stressTestData) {
      this.stressTestData.callStartTime = Date.now();
    }
  }

  /**
   * End current call and track time
   */
  endCallTimer() {
    if (this.stressTestData && this.stressTestData.callStartTime) {
      const callDuration = Date.now() - this.stressTestData.callStartTime;
      this.stressTestData.totalCallTime += callDuration;
      this.stressTestData.completedCalls++;
      this.stressTestData.callStartTime = null;
    }
  }

  /**
   * Transition to next caller in stress test
   * @param {Function} onCountdown - Callback for countdown updates (seconds remaining)
   * @returns {Promise<Object|null>} Next caller or null if queue completed
   */
  async transitionToNextCaller(onCountdown = null) {
    if (!this.stressTestData || this.sessionState !== 'active') {
      return null;
    }

    if (this.stressTestData.currentCallerIndex >= this.stressTestData.queueLength - 1) {
      // Queue completed
      return null;
    }

    // End current call timer
    this.endCallTimer();

    // Update stamina based on current performance
    this.updateStamina();

    // Move to next caller
    this.stressTestData.currentCallerIndex++;
    
    // Apply inter-call delay with countdown
    const delay = this.stressTestData.interCallDelay;
    if (delay > 0) {
      console.log(`Inter-call delay: ${delay} seconds`);
      
      // Countdown loop
      for (let i = delay; i > 0; i--) {
        if (onCountdown) {
          onCountdown(i);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (onCountdown) {
        onCountdown(0);
      }
    }

    const nextCaller = this.getCurrentCaller();
    
    // Switch to next caller's voice
    if (nextCaller && nextCaller.voiceId) {
      this.currentVoiceId = nextCaller.voiceId;
      console.log(`Switched to voice: ${nextCaller.voiceName} for caller: ${nextCaller.name}`);
    }
    
    // Clear conversation history for new caller (fresh context)
    geminiService.clearHistory();
    
    // Update conversation context for new caller while preserving language
    if (nextCaller && this.conversationContext) {
      this.conversationContext = {
        ...this.conversationContext,
        // Keep the original language from session config
        language: this.currentSession?.language || this.conversationContext.language || 'id',
        // Update AI role based on new caller's mood and scenario
        aiRole: this.getAIRoleForStressCaller(nextCaller),
      };
      console.log('Updated conversation context for new caller:', {
        language: this.conversationContext.language,
        aiRole: this.conversationContext.aiRole,
        callerMood: nextCaller.mood,
      });
    }
    
    // Start timer for new call
    this.startCallTimer();
    
    // Notify transition callbacks
    this.stressTestData.transitionCallbacks.forEach(callback => {
      callback({
        type: 'caller_transition',
        previousIndex: this.stressTestData.currentCallerIndex - 1,
        currentIndex: this.stressTestData.currentCallerIndex,
        nextCaller,
        status: this.getStressTestStatus()
      });
    });

    return nextCaller;
  }

  /**
   * Update stamina based on performance metrics
   */
  updateStamina() {
    if (!this.stressTestData) return;

    const currentMetrics = this.getCurrentMetrics();
    
    // Calculate performance score
    const paceScore = this.calculatePaceScore(currentMetrics.pace);
    const performanceScore = (paceScore + currentMetrics.confidence + currentMetrics.clarity) / 3;
    
    // Update stamina based on performance
    let staminaChange = 0;
    if (performanceScore < 60) {
      // Poor performance decreases stamina
      const decayMultiplier = (60 - performanceScore) / 60;
      staminaChange = -decayMultiplier * 5;
    } else if (performanceScore > 80) {
      // Good performance slightly recovers stamina
      staminaChange = (performanceScore - 80) / 20 * 2;
    }

    // Apply stamina change
    this.stressTestData.stamina = Math.max(0, Math.min(100, this.stressTestData.stamina + staminaChange));
    
    // Record stamina history
    this.stressTestData.staminaHistory.push({
      timestamp: Date.now() - this.startTime,
      stamina: this.stressTestData.stamina,
      performanceScore,
      metrics: { ...currentMetrics }
    });
  }

  /**
   * Calculate pace score from WPM
   * @param {number} pace - Words per minute
   * @returns {number} Pace score (0-100)
   */
  calculatePaceScore(pace) {
    if (pace === 0) return 0;
    
    const optimalMin = 150;
    const optimalMax = 180;
    
    if (pace >= optimalMin && pace <= optimalMax) {
      return 100;
    } else if (pace < optimalMin) {
      return Math.max(0, (pace / optimalMin) * 100);
    } else {
      return Math.max(0, 100 - ((pace - optimalMax) / optimalMax) * 50);
    }
  }

  /**
   * Add callback for stress test transitions
   * @param {Function} callback - Callback function
   */
  onStressTestTransition(callback) {
    if (this.stressTestData) {
      this.stressTestData.transitionCallbacks.push(callback);
    }
  }

  /**
   * Get stamina history for stress test
   * @returns {Array} Stamina history points
   */
  getStaminaHistory() {
    return this.stressTestData ? [...this.stressTestData.staminaHistory] : [];
  }

  /**
   * Initialize chaos engine with session configuration
   * @param {Object} chaosConfig - Chaos engine configuration
   */
  async initializeChaosEngine(chaosConfig) {
    // Ensure chaos engine is properly configured with all settings
    const fullConfig = {
      enabled: chaosConfig.enabled || false,
      randomVoiceGen: chaosConfig.randomVoiceGen || false,
      backgroundNoise: chaosConfig.backgroundNoise || false,
      hardwareFailure: chaosConfig.hardwareFailure || false,
      noiseType: chaosConfig.noiseType || 'office',
      intensity: chaosConfig.intensity || 0.5,
      frequency: chaosConfig.frequency || 30, // seconds between disruptions
    };
    
    console.log('Initializing Chaos Engine with config:', fullConfig);
    
    chaosEngine.initialize(fullConfig);

    // Set up chaos engine callbacks
    chaosEngine.setCallbacks({
      onVoiceVariation: (params) => {
        console.log('Voice variation applied:', params);
        // Could trigger UI notification here
      },
      onNoiseInjection: (params) => {
        console.log('Background noise injected:', params);
        // Could trigger UI notification here
      },
      onHardwareFailure: (params) => {
        console.log('Hardware failure simulated:', params);
        // Could trigger UI updates here
      },
      onDisruptionStart: (disruption) => {
        console.log('Disruption started:', disruption.type);
      },
      onDisruptionEnd: (disruption) => {
        console.log('Disruption ended:', disruption.type);
      }
    });
    
    // Start background noise immediately if enabled
    if (fullConfig.backgroundNoise && fullConfig.enabled) {
      console.log('Starting continuous background noise:', fullConfig.noiseType);
      await chaosEngine.startContinuousNoise(fullConfig.noiseType, fullConfig.intensity);
    }
  }

  /**
   * Initialize AI services (Gemini and ElevenLabs)
   * @param {Object} config - Session configuration
   */
  async initializeAIServices(config) {
    try {
      // Initialize Gemini
      await geminiService.initialize();
      
      // Clear previous conversation history and context
      geminiService.clearHistory();
      geminiService.contextDocuments = []; // Clear previous context documents
      
      // Collect all context documents
      const allContextDocs = [];
      
      // Add context files if provided (from database)
      if (config.contextFiles && config.contextFiles.length > 0) {
        config.contextFiles.forEach(file => {
          if (file.content && file.content.trim()) {
            allContextDocs.push({
              name: file.name || 'Context File',
              content: file.content,
              type: 'document'
            });
          }
        });
      }
      
      // Add manual context as a document
      if (config.manualContext && config.manualContext.trim()) {
        allContextDocs.push({
          name: 'Manual Context',
          content: config.manualContext.trim(),
          type: 'text'
        });
      }
      
      // Add all context documents to Gemini
      if (allContextDocs.length > 0) {
        geminiService.addContextDocuments(allContextDocs);
        console.log(`Added ${allContextDocs.length} context documents to Gemini`);
      }

      // Set up conversation context with language
      this.conversationContext = {
        scenario: config.scenario,
        language: config.language || 'id', // Default to Indonesian
        userRole: 'trainee',
        aiRole: this.getAIRoleForScenario(config.scenario),
      };
      
      console.log('Conversation context set:', {
        scenario: this.conversationContext.scenario,
        language: this.conversationContext.language,
        aiRole: this.conversationContext.aiRole,
        contextDocsCount: allContextDocs.length
      });

      // Initialize ElevenLabs
      await elevenLabsService.initialize();
      
      // Store voice ID for TTS
      this.currentVoiceId = config.defaultVoice?.voiceId || null;

      console.log('AI services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
      // Continue without AI - will use mock responses
    }
  }

  /**
   * Get AI role based on scenario
   * @param {string} scenario - Scenario type
   * @returns {string} AI role description
   */
  getAIRoleForScenario(scenario) {
    const roles = {
      'crisis-negotiation': 'a difficult customer in a crisis situation demanding immediate resolution',
      'sales-objection': 'a skeptical prospect raising objections about the product',
      'price-negotiation': 'a tough negotiator trying to get the best deal',
      'contract-negotiation': 'a business partner negotiating contract terms',
      'closing-deal': 'a hesitant buyer who needs convincing to close',
      'customer-complaint': 'an angry customer with a serious complaint',
      'refund-request': 'a frustrated customer demanding a refund',
      'technical-support': 'a confused user with technical issues',
      'service-recovery': 'a disappointed customer after a service failure',
      'escalation-handling': 'an irate customer demanding to speak to a manager',
      'performance-review': 'an employee receiving performance feedback',
      'difficult-conversation': 'a colleague in a sensitive workplace discussion',
      'termination-meeting': 'an employee being informed of termination',
      'salary-negotiation': 'an employee negotiating for a raise',
      'conflict-resolution': 'a team member in a workplace conflict',
      'presentation-qa': 'an audience member asking challenging questions',
      'investor-pitch': 'a skeptical investor evaluating your pitch',
      'board-meeting': 'a board member questioning your decisions',
      'team-briefing': 'a team member seeking clarification',
      'job-interview': 'a hiring manager conducting an interview',
      'media-interview': 'a journalist asking probing questions',
      'cold-calling': 'a busy prospect receiving an unsolicited call',
      'debt-collection': 'a debtor avoiding payment',
      'insurance-claim': 'a claimant disputing coverage',
    };
    return roles[scenario] || 'a challenging conversation partner';
  }

  /**
   * Get AI role based on stress test caller profile
   * @param {Object} caller - Caller object with mood, scenario, difficulty
   * @returns {string} AI role description
   */
  getAIRoleForStressCaller(caller) {
    const moodDescriptions = {
      neutral: 'a calm but professional',
      hostile: 'an aggressive and confrontational',
      frustrated: 'a frustrated and impatient',
      anxious: 'a worried and nervous',
      demanding: 'a demanding and assertive',
      happy: 'a friendly but still challenging',
    };

    const scenarioDescriptions = {
      complaint: 'customer with a complaint',
      negotiation: 'negotiator seeking a better deal',
      objection: 'prospect raising objections',
      crisis: 'person in a crisis situation',
      inquiry: 'person seeking information',
    };

    const moodDesc = moodDescriptions[caller.mood] || 'a challenging';
    const scenarioDesc = scenarioDescriptions[caller.scenario] || 'conversation partner';
    const difficultyNote = caller.difficulty >= 4 ? ' who is very difficult to handle' : '';

    return `${moodDesc} ${scenarioDesc}${difficultyNote}`;
  }

  /**
   * Send initial AI greeting to start the conversation
   */
  async sendInitialGreeting() {
    try {
      this.isProcessingResponse = true;

      // Check quota before making API call
      const canAfford = await quotaService.canAfford(0.01); // Estimated minimum cost
      if (!canAfford) {
        console.warn('Daily quota exceeded, using fallback greeting');
        const fallbackGreeting = this.conversationContext?.language === 'id'
          ? 'Selamat datang. Bagaimana saya bisa membantu Anda hari ini?'
          : 'Welcome. How can I help you today?';
        this.handleAISpeech(fallbackGreeting, 'neutral');
        if (this.onAIResponse) {
          this.onAIResponse(fallbackGreeting, 'neutral');
        }
        this.isProcessingResponse = false;
        return;
      }

      // Build language-specific greeting prompt
      const isIndonesian = this.conversationContext?.language === 'id';
      const greetingPrompt = isIndonesian
        ? '[MULAI PERCAKAPAN - Buat pernyataan pembuka sebagai karakter Anda untuk memulai skenario pelatihan. WAJIB dalam Bahasa Indonesia.]'
        : '[START CONVERSATION - Generate an opening statement as your character to begin the training scenario. MUST be in English.]';

      const greeting = await geminiService.generateResponse(
        this.conversationContext,
        greetingPrompt
      );

      // Track Gemini API usage for greeting
      const geminiCost = quotaService.estimateCost('gemini', 'generate', {
        inputLength: 100,
        outputLength: greeting.length,
      });
      await quotaService.recordUsage('gemini', geminiCost, this.currentSession?.sessionId, 'greeting');
      
      // Analyze emotion
      const emotion = await geminiService.analyzeEmotion(greeting);
      
      // Handle AI speech
      this.handleAISpeech(greeting, emotion);
      
      // Notify UI
      if (this.onAIResponse) {
        this.onAIResponse(greeting, emotion);
      }
      
      // Speak the greeting via TTS (using REST API)
      await this.speakText(greeting);
      
      this.isProcessingResponse = false;
    } catch (error) {
      console.error('Failed to send initial greeting:', error);
      this.isProcessingResponse = false;
    }
  }

  /**
   * Speak text using ElevenLabs TTS (REST API)
   * @param {string} text - Text to speak
   * @returns {Promise<void>} - Resolves when audio playback completes
   */
  async speakText(text) {
    try {
      if (!text) {
        // No text to speak, notify completion immediately
        if (this.onTTSComplete) {
          this.onTTSComplete();
        }
        return;
      }
      
      // CRITICAL: Notify that TTS is starting so speech recognition can pause
      if (this.onTTSStarting) {
        this.onTTSStarting();
      }
      
      if (this.currentSession?.mockMode) {
        // In mock mode, simulate TTS delay then notify completion
        console.log('Mock TTS:', text.substring(0, 50) + '...');
        const mockDuration = Math.min(text.length * 50, 5000);
        await new Promise(resolve => setTimeout(resolve, mockDuration));
        if (this.onTTSComplete) {
          this.onTTSComplete();
        }
        return;
      }

      // Get voice ID - use stored or fetch default
      let voiceId = this.currentVoiceId;
      if (!voiceId) {
        try {
          const voices = await elevenLabsService.listVoices();
          const defaultVoice = voices.find(v => v.isSystem) || voices[0];
          voiceId = defaultVoice?.id;
        } catch (e) {
          console.warn('Failed to get voices:', e);
        }
      }

      if (!voiceId) {
        console.warn('No voice ID available for TTS, skipping speech');
        // Still notify completion so listening can resume
        if (this.onTTSComplete) {
          this.onTTSComplete();
        }
        return;
      }

      console.log('Speaking text via TTS:', text.substring(0, 50) + '...');

      // Check quota before TTS
      const ttsCost = quotaService.estimateCost('elevenlabs', 'tts', { textLength: text.length });
      const canAffordTTS = await quotaService.canAfford(ttsCost);
      if (!canAffordTTS) {
        console.warn('Daily quota exceeded, skipping TTS');
        if (this.onTTSComplete) {
          this.onTTSComplete();
        }
        return;
      }

      // Use REST API for TTS
      const audioData = await elevenLabsService.testTTS(text, voiceId);

      // Track ElevenLabs API usage
      await quotaService.recordUsage('elevenlabs', ttsCost, this.currentSession?.sessionId, 'tts');
      
      // Play the audio and wait for completion
      if (audioData) {
        console.log('TTS audio playback starting');
        
        // Better duration estimate based on audio data size and speech rate
        const wordCount = text.split(/\s+/).length;
        const textBasedDuration = wordCount * 450; // 450ms per word for safety
        const audioBasedDuration = audioData.byteLength ? (audioData.byteLength * 8 / 128) : 0;
        const estimatedDuration = Math.max(2000, Math.min(Math.max(textBasedDuration, audioBasedDuration), 60000));
        
        console.log(`TTS duration estimate: ${estimatedDuration}ms (words: ${wordCount}, audioSize: ${audioData.byteLength})`);
        
        // Play audio once and wait for completion
        const playbackPromise = audioEngine.playAudio(audioData);
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, estimatedDuration));
        
        // Wait for either playback to finish or timeout
        await Promise.race([playbackPromise, timeoutPromise]);
        
        // If timeout won, wait a bit more and check if still playing
        if (audioEngine.isPlaybackActive()) {
          console.log('Audio still playing after initial estimate, waiting more...');
          let additionalWait = 0;
          const maxAdditionalWait = 30000;
          while (audioEngine.isPlaybackActive() && additionalWait < maxAdditionalWait) {
            await new Promise(resolve => setTimeout(resolve, 500));
            additionalWait += 500;
          }
        }
        
        // Small buffer after playback ends to prevent echo pickup
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('TTS audio playback completed');
      }
      
      // Notify UI that TTS is complete
      if (this.onTTSComplete) {
        this.onTTSComplete();
      }
    } catch (error) {
      console.error('Failed to speak text:', error);
      // Still notify completion on error so listening can resume
      if (this.onTTSComplete) {
        this.onTTSComplete();
      }
    }
  }

  /**
   * Process user input and generate AI response
   * @param {string} userText - User's spoken text (transcription)
   */
  async processUserInput(userText) {
    if (!userText || this.sessionState !== 'active' || this.isProcessingResponse) {
      return;
    }

    try {
      this.isProcessingResponse = true;

      // Handle user speech
      this.handleUserSpeech(null, userText);

      // Notify UI of user transcript
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate('user', userText);
      }

      // Check quota before making API call
      const canAfford = await quotaService.canAfford(0.01);
      if (!canAfford) {
        console.warn('Daily quota exceeded, using fallback response');
        const fallback =
          this.conversationContext?.language === 'id'
            ? 'Saya mengerti. Silakan lanjutkan.'
            : 'I understand. Please continue.';
        this.handleAISpeech(fallback, 'neutral');
        if (this.onAIResponse) {
          this.onAIResponse(fallback, 'neutral');
        }
        this.isProcessingResponse = false;
        return;
      }

      // Generate AI response
      const response = await geminiService.generateResponse(this.conversationContext, userText);

      // Track Gemini API usage
      const geminiCost = quotaService.estimateCost('gemini', 'generate', {
        inputLength: userText.length,
        outputLength: response.length,
      });
      await quotaService.recordUsage('gemini', geminiCost, this.currentSession?.sessionId, 'generate');
      
      // Analyze emotion
      const emotion = await geminiService.analyzeEmotion(response);
      
      // Handle AI speech
      this.handleAISpeech(response, emotion);
      
      // Notify UI
      if (this.onAIResponse) {
        this.onAIResponse(response, emotion);
      }
      
      // Speak the response via TTS (using REST API)
      await this.speakText(response);
      
      this.isProcessingResponse = false;
    } catch (error) {
      console.error('Failed to process user input:', error);
      this.isProcessingResponse = false;
      
      // Use fallback response
      const fallback = "I understand. Please continue.";
      this.handleAISpeech(fallback, 'neutral');
      if (this.onAIResponse) {
        this.onAIResponse(fallback, 'neutral');
      }
    }
  }

  /**
   * Set callback for transcript updates
   * @param {Function} callback - (sender, text) => void
   */
  setTranscriptCallback(callback) {
    this.onTranscriptUpdate = callback;
  }

  /**
   * Set callback for AI responses
   * @param {Function} callback - (text, emotion) => void
   */
  setAIResponseCallback(callback) {
    this.onAIResponse = callback;
  }

  /**
   * Set callback for TTS completion
   * @param {Function} callback - () => void
   */
  setTTSCompleteCallback(callback) {
    this.onTTSComplete = callback;
  }

  /**
   * Set callback for TTS starting (to pause speech recognition)
   * @param {Function} callback - () => void
   */
  setTTSStartingCallback(callback) {
    this.onTTSStarting = callback;
  }

  /**
   * Trigger barge-in (interrupt AI speech)
   */
  async triggerBargeIn() {
    if (elevenLabsService.isCurrentlyStreaming()) {
      elevenLabsService.stopSpeaking();
      await audioEngine.triggerBargeIn();
      console.log('Barge-in triggered');
    }
  }

  /**
   * Initialize audio and VAD services
   * @param {string} vadSensitivity - VAD sensitivity level ('low', 'medium', 'high')
   */
  async initializeAudioServices(vadSensitivity = 'medium') {
    try {
      // Initialize audio engine (but don't start recording - speechService handles that)
      await audioEngine.initialize();

      // Initialize VAD service with sensitivity
      vadService.initialize({
        sensitivity: vadSensitivity,
        noiseFloor: 0.1, // Default, will be calibrated
        minimumDuration: 150
      });

      // Note: We don't start audioEngine recording here because speechService 
      // handles recording with its own VAD-based silence detection.
      // audioEngine is only used for playback and amplitude visualization.
      
      console.log('Audio services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio services:', error);
      // Don't throw - allow session to continue in degraded mode
    }
  }

  /**
   * Set up session-specific callbacks
   */
  setupSessionCallbacks() {
    // Set up any additional callbacks needed for session management
    // This could include callbacks for UI updates, metric calculations, etc.
  }

  /**
   * Reset session metrics
   */
  resetMetrics() {
    this.metrics = {
      pace: 0,
      confidence: 0,
      clarity: 0,
      fillerWordCount: 0,
      duration: 0,
      emotionalState: 'neutral'
    };
    this.conversationHistory = [];
    this.emotionalTelemetry = [];
  }

  /**
   * Update metrics from user speech
   * @param {string} transcription - Speech transcription
   */
  updateMetricsFromUserSpeech(transcription) {
    if (!transcription) return;

    // Calculate words per minute (pace)
    const words = transcription.trim().split(/\s+/).length;
    const durationMinutes = this.metrics.duration / 60;
    if (durationMinutes > 0) {
      this.metrics.pace = Math.round(words / durationMinutes);
    }

    // Count filler words (including Indonesian)
    const fillerWords = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'eung', 'anu', 'uhm'];
    const fillerCount = fillerWords.reduce((count, filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      return count + (transcription.match(regex) || []).length;
    }, 0);
    this.metrics.fillerWordCount += fillerCount;

    // Update confidence and clarity (simplified calculation)
    // In a real implementation, this would use more sophisticated analysis
    this.metrics.confidence = Math.max(0, Math.min(100, 
      100 - (fillerCount * 10) - (this.detectHesitation(transcription) ? 15 : 0)
    ));
    this.metrics.clarity = Math.max(0, Math.min(100, 
      100 - (fillerCount * 5)
    ));
  }

  /**
   * Update amplitude-based metrics
   * @param {number} amplitude - Current audio amplitude
   */
  updateAmplitudeMetrics(amplitude) {
    // Could use amplitude for confidence calculations
    // This is a simplified implementation
  }

  /**
   * Detect hesitation in speech
   * @param {string} text - Speech text
   * @returns {boolean} True if hesitation detected
   */
  detectHesitation(text) {
    const hesitationPatterns = [
      /\.{2,}/, // Multiple dots
      /\s{2,}/, // Multiple spaces
      /\b(um|uh|er|ah|eung|anu)\b/gi, // Filler words
      /\b\w+\s+\w+\s+\w+\b.*\b\w+\s+\w+\s+\w+\b/gi // Repetitive patterns
    ];

    return hesitationPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Calculate emotional intensity
   * @param {string} emotionalState - Emotional state
   * @returns {number} Intensity value (0-1)
   */
  calculateEmotionalIntensity(emotionalState) {
    const intensityMap = {
      'neutral': 0.0,
      'happy': 0.6,
      'frustrated': 0.8,
      'hostile': 1.0,
      'anxious': 0.7
    };
    return intensityMap[emotionalState] || 0.0;
  }

  /**
   * Calculate final session metrics
   */
  calculateFinalMetrics() {
    if (this.startTime && this.endTime) {
      this.metrics.duration = Math.floor((this.endTime - this.startTime) / 1000);
    }

    // Calculate overall session score (0-100)
    const paceScore = Math.min(100, Math.max(0, (this.metrics.pace - 100) / 2 + 50));
    const fillerPenalty = Math.min(50, this.metrics.fillerWordCount * 5);
    const overallScore = Math.max(0, Math.min(100, 
      (paceScore + this.metrics.confidence + this.metrics.clarity) / 3 - fillerPenalty
    ));

    this.metrics.overallScore = Math.round(overallScore);
  }

  /**
   * Generate comprehensive session report
   * @returns {Object} Session report
   */
  async generateSessionReport() {
    const report = {
      sessionId: this.currentSession.sessionId,
      scenario: this.currentSession.scenario,
      mode: this.currentSession.mode,
      language: this.currentSession.language,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.metrics.duration,
      score: this.metrics.overallScore || 0,
      grade: this.calculateGrade(this.metrics.overallScore || 0),
      metrics: { ...this.metrics },
      conversationHistory: [...this.conversationHistory],
      emotionalTelemetry: [...this.emotionalTelemetry],
      chaosStatistics: chaosEngine.getStatistics(),
      disruptionLog: chaosEngine.getDisruptionLog(),
      timestamp: Date.now()
    };

    return report;
  }

  /**
   * Calculate letter grade from score
   * @param {number} score - Numerical score (0-100)
   * @returns {string} Letter grade
   */
  calculateGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Update session in database
   * @param {Object} sessionReport - Session report
   */
  async updateSessionInDatabase(sessionReport) {
    try {
      // Update session record
      await databaseService.updateSession(sessionReport.sessionId, {
        score: sessionReport.score,
        duration: sessionReport.duration,
        pace: sessionReport.metrics.pace,
        filler_word_count: sessionReport.metrics.fillerWordCount,
        clarity_score: sessionReport.metrics.clarity,
        confidence_score: sessionReport.metrics.confidence,
        completed: 1
      });

      // Save conversation history
      for (const entry of sessionReport.conversationHistory) {
        await databaseService.createChatLog({
          session_id: sessionReport.sessionId,
          sender: entry.sender,
          text: entry.text,
          audio_path: entry.audioPath,
          has_hesitation: entry.hasHesitation ? 1 : 0,
          timestamp: entry.timestamp
        });
      }

      // Save emotional telemetry
      for (const point of sessionReport.emotionalTelemetry) {
        await databaseService.createEmotionalTelemetry({
          session_id: sessionReport.sessionId,
          timestamp: point.timestamp,
          emotion_state: point.state,
          intensity: point.intensity
        });
      }

      console.log('Session data saved to database');
      
      // Check and update achievements
      await this.checkAchievements(sessionReport);
    } catch (error) {
      console.error('Failed to save session to database:', error);
    }
  }

  /**
   * Check and update achievements after session completion
   * @param {Object} sessionReport - Session report
   */
  async checkAchievements(sessionReport) {
    try {
      // Prepare session data for achievement checking
      const sessionData = {
        score: sessionReport.score,
        timestamp: sessionReport.timestamp,
        mode: sessionReport.mode,
        queueLength: this.stressTestData?.queueLength || 1,
        chaosEffectsEnabled: this.getChaosEffectsEnabled()
      };

      // Check achievements
      const unlockedAchievements = await achievementService.checkSessionAchievements(sessionData);
      
      if (unlockedAchievements.length > 0) {
        console.log('Achievements unlocked:', unlockedAchievements.map(a => a.name).join(', '));
      }
      
      return unlockedAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Get list of enabled chaos effects
   */
  getChaosEffectsEnabled() {
    const effects = [];
    const config = this.currentSession?.chaosEngine;
    
    if (config?.enabled) {
      if (config.randomVoiceGen) effects.push('randomVoiceGen');
      if (config.backgroundNoise) effects.push('backgroundNoise');
      if (config.hardwareFailure) effects.push('hardwareFailure');
    }
    
    return effects;
  }

  /**
   * Clean up session resources
   */
  async cleanup() {
    try {
      // Reset state
      this.currentSession = null;
      this.sessionState = 'idle';
      this.startTime = null;
      this.endTime = null;
      this.isProcessingResponse = false;
      this.conversationContext = null;
      this.onTranscriptUpdate = null;
      this.onAIResponse = null;
      this.onTTSComplete = null;
      this.onTTSStarting = null;

      // Clean up stress test data
      this.stressTestData = null;

      // Clean up chaos engine
      await chaosEngine.cleanup();

      // Stop audio recording
      await audioEngine.stopRecording();
      
      // Clean up audio callbacks
      audioEngine.setAudioChunkCallback(null);
      vadService.setVoiceActivityCallback(null);

      // Clean up AI services
      this.currentVoiceId = null;
      geminiService.clearHistory();

      console.log('Session manager cleaned up');
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default sessionManager;