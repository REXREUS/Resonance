import { AUDIO_CONFIG } from '../constants/audio';

/**
 * VADService class for Voice Activity Detection
 * Uses Signal Energy (RMS) based approach for detecting voice activity
 */
class VADService {
  constructor() {
    this.config = null;
    this.userSpeaking = false;
    this.noiseFloor = 0;
    this.detectionThreshold = 0;
    this.voiceActivityCallback = null;
    this.lastVoiceActivity = 0;
    this.voiceActivityBuffer = [];
    this.bufferSize = 5; // Number of samples to buffer for smoothing
  }

  /**
   * Initialize VAD service with configuration
   * @param {Object} config - VAD configuration
   * @param {string} config.sensitivity - Sensitivity level ('low', 'medium', 'high')
   * @param {number} config.noiseFloor - Baseline noise level
   * @param {number} config.minimumDuration - Minimum voice activity duration in ms
   */
  initialize(config) {
    this.config = {
      sensitivity: 'medium',
      noiseFloor: 0,
      minimumDuration: AUDIO_CONFIG.VAD_RESPONSE_TIME_MS,
      ...config
    };
    
    this.noiseFloor = this.config.noiseFloor;
    this.updateDetectionThreshold();
    
    console.log(`VAD initialized with sensitivity: ${this.config.sensitivity}, noise floor: ${this.noiseFloor}`);
  }

  /**
   * Update detection threshold based on sensitivity and noise floor
   */
  updateDetectionThreshold() {
    const sensitivityDb = AUDIO_CONFIG.VAD_SENSITIVITY[this.config.sensitivity.toUpperCase()];
    
    // Convert dB to linear scale (simplified approximation)
    // In practice: threshold = noiseFloor * 10^(dB/20)
    const dbMultiplier = Math.pow(10, sensitivityDb / 20);
    this.detectionThreshold = this.noiseFloor * dbMultiplier;
    
    console.log(`VAD threshold updated: ${this.detectionThreshold} (${sensitivityDb}dB above noise floor)`);
  }

  /**
   * Process audio chunk for voice activity detection
   * @param {Float32Array|Int16Array} audioData - Audio data chunk
   * @param {number} amplitude - Pre-calculated RMS amplitude (optional)
   * @returns {boolean} True if voice activity detected
   */
  processAudioChunk(audioData, amplitude = null) {
    try {
      // Calculate RMS amplitude if not provided
      const rmsAmplitude = amplitude !== null ? amplitude : this.calculateRMS(audioData);
      
      // Add to buffer for smoothing
      this.voiceActivityBuffer.push(rmsAmplitude);
      if (this.voiceActivityBuffer.length > this.bufferSize) {
        this.voiceActivityBuffer.shift();
      }
      
      // Calculate smoothed amplitude (moving average)
      const smoothedAmplitude = this.voiceActivityBuffer.reduce((sum, val) => sum + val, 0) / this.voiceActivityBuffer.length;
      
      // Check if amplitude exceeds threshold
      const isVoiceDetected = smoothedAmplitude > this.detectionThreshold;
      
      // Update voice activity state with minimum duration check
      const currentTime = Date.now();
      
      if (isVoiceDetected) {
        if (!this.userSpeaking) {
          // Voice activity started
          this.lastVoiceActivity = currentTime;
          this.userSpeaking = true;
          
          // Trigger callback
          if (this.voiceActivityCallback) {
            this.voiceActivityCallback(true, smoothedAmplitude);
          }
          
          console.log(`Voice activity detected: ${smoothedAmplitude.toFixed(4)} > ${this.detectionThreshold.toFixed(4)}`);
        }
      } else {
        if (this.userSpeaking && (currentTime - this.lastVoiceActivity) > this.config.minimumDuration) {
          // Voice activity ended (with minimum duration check)
          this.userSpeaking = false;
          
          // Trigger callback
          if (this.voiceActivityCallback) {
            this.voiceActivityCallback(false, smoothedAmplitude);
          }
          
          console.log(`Voice activity ended: ${smoothedAmplitude.toFixed(4)} < ${this.detectionThreshold.toFixed(4)}`);
        }
      }
      
      return this.userSpeaking;
    } catch (error) {
      console.error('Error processing audio chunk for VAD:', error);
      return false;
    }
  }

  /**
   * Calculate RMS (Root Mean Square) amplitude
   * @param {Float32Array|Int16Array} audioData - Audio data array
   * @returns {number} RMS amplitude value
   */
  calculateRMS(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    
    // Normalize based on data type
    if (audioData instanceof Int16Array) {
      return Math.min(rms / 32768, 1.0);
    } else {
      return Math.min(rms, 1.0);
    }
  }

  /**
   * Check if user is currently speaking
   * @returns {boolean} True if voice activity is detected
   */
  isUserSpeaking() {
    return this.userSpeaking;
  }

  /**
   * Update VAD sensitivity
   * @param {string} sensitivity - Sensitivity level ('low', 'medium', 'high')
   */
  updateSensitivity(sensitivity) {
    if (!['low', 'medium', 'high'].includes(sensitivity)) {
      throw new Error(`Invalid sensitivity level: ${sensitivity}`);
    }
    
    this.config.sensitivity = sensitivity;
    this.updateDetectionThreshold();
    
    console.log(`VAD sensitivity updated to: ${sensitivity}`);
  }

  /**
   * Calibrate noise floor from audio samples
   * @param {Array<number>} amplitudeSamples - Array of amplitude samples
   * @returns {number} Calculated noise floor
   */
  calibrate(amplitudeSamples) {
    if (!amplitudeSamples || amplitudeSamples.length === 0) {
      throw new Error('No amplitude samples provided for calibration');
    }
    
    // Calculate noise floor as average of samples
    const sum = amplitudeSamples.reduce((acc, sample) => acc + sample, 0);
    this.noiseFloor = sum / amplitudeSamples.length;
    
    // Update threshold based on new noise floor
    this.updateDetectionThreshold();
    
    console.log(`VAD calibrated with noise floor: ${this.noiseFloor} (${amplitudeSamples.length} samples)`);
    return this.noiseFloor;
  }

  /**
   * Set callback for voice activity events
   * @param {Function} callback - Callback function (isActive, amplitude) => void
   */
  setVoiceActivityCallback(callback) {
    this.voiceActivityCallback = callback;
  }

  /**
   * Get current detection threshold
   * @returns {number} Current detection threshold
   */
  getDetectionThreshold() {
    return this.detectionThreshold;
  }

  /**
   * Get current noise floor
   * @returns {number} Current noise floor level
   */
  getNoiseFloor() {
    return this.noiseFloor;
  }

  /**
   * Get current sensitivity setting
   * @returns {string} Current sensitivity level
   */
  getSensitivity() {
    return this.config?.sensitivity || 'medium';
  }

  /**
   * Get VAD statistics
   * @returns {Object} VAD statistics
   */
  getStatistics() {
    return {
      sensitivity: this.config?.sensitivity || 'medium',
      noiseFloor: this.noiseFloor,
      detectionThreshold: this.detectionThreshold,
      isUserSpeaking: this.userSpeaking,
      bufferSize: this.voiceActivityBuffer.length,
      lastActivity: this.lastVoiceActivity
    };
  }

  /**
   * Reset VAD state
   */
  reset() {
    this.userSpeaking = false;
    this.lastVoiceActivity = 0;
    this.voiceActivityBuffer = [];
    
    console.log('VAD state reset');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.reset();
    this.voiceActivityCallback = null;
    this.config = null;
    
    console.log('VAD service cleaned up');
  }
}

// Export singleton instance
export const vadService = new VADService();
export default vadService;