import { Audio } from 'expo-av';
import { NOISE_TYPES } from '../constants/audio';

/**
 * ChaosEngine class for simulating real-world disruptions during training sessions
 * Implements random voice generation, background noise injection, and hardware failure simulation
 */
class ChaosEngine {
  constructor() {
    this.config = null;
    this.activeDisruptions = [];
    this.disruptionLog = [];
    this.noiseSound = null;
    this.isNoiseActive = false;
    this.noiseInterval = null;
    this.voiceVariationSettings = {
      pitchRange: { min: 0.8, max: 1.2 },
      speedRange: { min: 0.9, max: 1.1 },
      intensityRange: { min: 0.3, max: 0.8 }
    };
    this.hardwareFailureState = {
      micMuted: false,
      connectionDropped: false,
      lastFailureTime: 0
    };
    this.disruptionCallbacks = {
      onVoiceVariation: null,
      onNoiseInjection: null,
      onHardwareFailure: null,
      onDisruptionStart: null,
      onDisruptionEnd: null
    };
  }

  /**
   * Initialize Chaos Engine with configuration
   * @param {Object} config - Chaos Engine configuration
   * @param {boolean} config.enabled - Whether chaos engine is enabled
   * @param {boolean} config.randomVoiceGen - Enable random voice generation
   * @param {boolean} config.backgroundNoise - Enable background noise injection
   * @param {boolean} config.hardwareFailure - Enable hardware failure simulation
   * @param {string} config.noiseType - Type of background noise ('office', 'rain', 'traffic', 'cafe')
   * @param {number} config.intensity - Overall disruption intensity (0-1)
   * @param {number} config.frequency - Disruption frequency in seconds
   */
  initialize(config) {
    this.config = {
      enabled: false,
      randomVoiceGen: false,
      backgroundNoise: false,
      hardwareFailure: false,
      noiseType: 'office',
      intensity: 0.5,
      frequency: 30, // seconds between disruptions
      ...config
    };

    // Reset state
    this.activeDisruptions = [];
    this.disruptionLog = [];
    this.hardwareFailureState = {
      micMuted: false,
      connectionDropped: false,
      lastFailureTime: 0
    };

    console.log('ChaosEngine initialized:', this.config);
  }

  /**
   * Apply voice variation to audio data
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {Object} options - Voice variation options
   * @param {number} options.pitch - Pitch multiplier (0.5-2.0)
   * @param {number} options.speed - Speed multiplier (0.5-2.0)
   * @param {number} options.intensity - Variation intensity (0-1)
   * @returns {ArrayBuffer} Modified audio data
   */
  applyVoiceVariation(audioData, options = {}) {
    if (!this.config.enabled || !this.config.randomVoiceGen) {
      return audioData;
    }

    try {
      // Generate random variation parameters if not provided
      const pitch = options.pitch || this.generateRandomValue(
        this.voiceVariationSettings.pitchRange.min,
        this.voiceVariationSettings.pitchRange.max
      );
      const speed = options.speed || this.generateRandomValue(
        this.voiceVariationSettings.speedRange.min,
        this.voiceVariationSettings.speedRange.max
      );
      const intensity = options.intensity || this.generateRandomValue(
        this.voiceVariationSettings.intensityRange.min,
        this.voiceVariationSettings.intensityRange.max
      );

      // Log disruption
      const disruption = {
        type: 'voice_variation',
        timestamp: Date.now(),
        parameters: { pitch, speed, intensity },
        duration: 0 // Will be updated when disruption ends
      };
      
      this.logDisruption(disruption);

      // Apply voice variation (simplified implementation)
      // In a real implementation, this would use audio processing libraries
      // For now, we'll simulate the effect and return modified data
      const modifiedData = this.simulateVoiceVariation(audioData, { pitch, speed, intensity });

      // Trigger callback
      if (this.disruptionCallbacks.onVoiceVariation) {
        this.disruptionCallbacks.onVoiceVariation({ pitch, speed, intensity });
      }

      console.log(`Voice variation applied: pitch=${pitch.toFixed(2)}, speed=${speed.toFixed(2)}, intensity=${intensity.toFixed(2)}`);
      return modifiedData;
    } catch (error) {
      console.error('Error applying voice variation:', error);
      return audioData;
    }
  }

  /**
   * Inject background noise into audio
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {string} noiseType - Type of noise ('office', 'rain', 'traffic', 'cafe')
   * @param {number} intensity - Noise intensity (0-1)
   * @returns {ArrayBuffer} Audio with background noise
   */
  injectBackgroundNoise(audioData, noiseType = null, intensity = null) {
    if (!this.config.enabled || !this.config.backgroundNoise) {
      return audioData;
    }

    try {
      const selectedNoiseType = noiseType || this.config.noiseType;
      const noiseIntensity = intensity !== null ? intensity : this.config.intensity;

      // Validate noise type
      if (!NOISE_TYPES.includes(selectedNoiseType)) {
        console.warn(`Invalid noise type: ${selectedNoiseType}, using 'office'`);
        selectedNoiseType = 'office';
      }

      // Log disruption
      const disruption = {
        type: 'background_noise',
        timestamp: Date.now(),
        parameters: { noiseType: selectedNoiseType, intensity: noiseIntensity },
        duration: 0
      };
      
      this.logDisruption(disruption);

      // Apply background noise (simplified implementation)
      const noisyData = this.simulateBackgroundNoise(audioData, selectedNoiseType, noiseIntensity);

      // Trigger callback
      if (this.disruptionCallbacks.onNoiseInjection) {
        this.disruptionCallbacks.onNoiseInjection({ noiseType: selectedNoiseType, intensity: noiseIntensity });
      }

      console.log(`Background noise injected: ${selectedNoiseType} at ${(noiseIntensity * 100).toFixed(0)}% intensity`);
      return noisyData;
    } catch (error) {
      console.error('Error injecting background noise:', error);
      return audioData;
    }
  }

  /**
   * Simulate hardware failure (mic mute, connection drops)
   * @param {string} failureType - Type of failure ('mic_mute', 'connection_drop', 'random')
   * @param {number} duration - Failure duration in milliseconds
   */
  simulateHardwareFailure(failureType = 'random', duration = 3000) {
    if (!this.config.enabled || !this.config.hardwareFailure) {
      return;
    }

    try {
      // Prevent too frequent failures
      const currentTime = Date.now();
      if (currentTime - this.hardwareFailureState.lastFailureTime < 10000) {
        console.log('Hardware failure skipped - too frequent');
        return;
      }

      // Select random failure type if not specified
      if (failureType === 'random') {
        const failureTypes = ['mic_mute', 'connection_drop'];
        failureType = failureTypes[Math.floor(Math.random() * failureTypes.length)];
      }

      // Apply failure
      switch (failureType) {
        case 'mic_mute':
          this.simulateMicMute(duration);
          break;
        case 'connection_drop':
          this.simulateConnectionDrop(duration);
          break;
        default:
          console.warn(`Unknown hardware failure type: ${failureType}`);
          return;
      }

      // Update failure state
      this.hardwareFailureState.lastFailureTime = currentTime;

      // Log disruption
      const disruption = {
        type: 'hardware_failure',
        timestamp: currentTime,
        parameters: { failureType, duration },
        duration: duration
      };
      
      this.logDisruption(disruption);

      // Trigger callback
      if (this.disruptionCallbacks.onHardwareFailure) {
        this.disruptionCallbacks.onHardwareFailure({ failureType, duration });
      }

      console.log(`Hardware failure simulated: ${failureType} for ${duration}ms`);
    } catch (error) {
      console.error('Error simulating hardware failure:', error);
    }
  }

  /**
   * Simulate microphone mute
   * @param {number} duration - Mute duration in milliseconds
   */
  simulateMicMute(duration) {
    this.hardwareFailureState.micMuted = true;
    
    // Add to active disruptions
    const disruption = {
      id: `mic_mute_${Date.now()}`,
      type: 'mic_mute',
      startTime: Date.now(),
      duration: duration,
      active: true
    };
    
    this.activeDisruptions.push(disruption);

    // Auto-restore after duration
    setTimeout(() => {
      this.hardwareFailureState.micMuted = false;
      this.removeActiveDisruption(disruption.id);
      console.log('Microphone unmuted automatically');
    }, duration);

    console.log(`Microphone muted for ${duration}ms`);
  }

  /**
   * Simulate connection drop
   * @param {number} duration - Connection drop duration in milliseconds
   */
  simulateConnectionDrop(duration) {
    this.hardwareFailureState.connectionDropped = true;
    
    // Add to active disruptions
    const disruption = {
      id: `connection_drop_${Date.now()}`,
      type: 'connection_drop',
      startTime: Date.now(),
      duration: duration,
      active: true
    };
    
    this.activeDisruptions.push(disruption);

    // Auto-restore after duration
    setTimeout(() => {
      this.hardwareFailureState.connectionDropped = false;
      this.removeActiveDisruption(disruption.id);
      console.log('Connection restored automatically');
    }, duration);

    console.log(`Connection dropped for ${duration}ms`);
  }

  /**
   * Start continuous background noise playback
   * @param {string} noiseType - Type of noise to play
   * @param {number} volume - Volume level (0-1)
   */
  async startContinuousNoise(noiseType = null, volume = 0.3) {
    if (!this.config.enabled || !this.config.backgroundNoise) {
      console.log('Background noise disabled, skipping');
      return;
    }

    try {
      // Stop existing noise
      await this.stopContinuousNoise();

      const selectedNoiseType = noiseType || this.config.noiseType;
      const noiseVolume = volume * this.config.intensity;
      
      console.log(`Starting continuous ${selectedNoiseType} noise at ${(noiseVolume * 100).toFixed(0)}% volume`);
      
      // Generate noise audio
      const noiseBase64 = this.generateNoiseAudio(selectedNoiseType, 5000, noiseVolume);
      const uri = `data:audio/wav;base64,${noiseBase64}`;
      
      // Create and play sound with looping
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: true, volume: noiseVolume }
      );
      
      this.noiseSound = sound;
      this.isNoiseActive = true;
      
      // Add to active disruptions
      const disruption = {
        id: `continuous_noise_${Date.now()}`,
        type: 'continuous_noise',
        startTime: Date.now(),
        duration: -1, // Continuous
        active: true,
        parameters: { noiseType: selectedNoiseType, volume: noiseVolume }
      };
      
      this.activeDisruptions.push(disruption);

      // Log disruption
      this.logDisruption({
        type: 'continuous_noise_start',
        timestamp: Date.now(),
        parameters: { noiseType: selectedNoiseType, volume: noiseVolume },
        duration: -1
      });
      
      console.log(`Background noise started: ${selectedNoiseType}`);

    } catch (error) {
      console.error('Error starting continuous noise:', error);
    }
  }

  /**
   * Generate noise audio as WAV base64
   * @param {string} noiseType - Type of noise ('office', 'rain', 'traffic', 'cafe')
   * @param {number} duration - Duration in milliseconds
   * @param {number} volume - Volume (0-1)
   * @returns {string} Base64 encoded WAV data
   */
  generateNoiseAudio(noiseType, duration = 5000, volume = 0.3) {
    const sampleRate = 44100;
    const numSamples = Math.floor((sampleRate * duration) / 1000);
    const numChannels = 1;
    const bitsPerSample = 16;
    
    // Create WAV header
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    
    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Generate noise based on type
    for (let i = 0; i < numSamples; i++) {
      let sample = 0;
      
      switch (noiseType) {
        case 'rain':
          // Rain: Pink noise with occasional droplet sounds
          sample = this.generatePinkNoise(i) * 0.3;
          // Add random droplet sounds
          if (Math.random() < 0.001) {
            sample += Math.sin(2 * Math.PI * (800 + Math.random() * 400) * i / sampleRate) * 0.5 * Math.exp(-((i % 1000) / 200));
          }
          break;
          
        case 'traffic':
          // Traffic: Low frequency rumble with occasional horn/engine sounds
          sample = this.generateBrownNoise(i) * 0.4;
          // Add low frequency rumble
          sample += Math.sin(2 * Math.PI * 60 * i / sampleRate) * 0.2;
          // Occasional horn-like sound
          if (Math.random() < 0.0002) {
            sample += Math.sin(2 * Math.PI * 400 * i / sampleRate) * 0.3;
          }
          break;
          
        case 'cafe':
          // Cafe: Murmur of voices (filtered noise) with occasional clinks
          sample = this.generatePinkNoise(i) * 0.25;
          // Add voice-like frequencies
          sample += Math.sin(2 * Math.PI * (200 + Math.random() * 100) * i / sampleRate) * 0.1;
          // Occasional clink sounds
          if (Math.random() < 0.0005) {
            sample += Math.sin(2 * Math.PI * 2000 * i / sampleRate) * 0.4 * Math.exp(-((i % 500) / 50));
          }
          break;
          
        case 'office':
        default:
          // Office: Keyboard clicks, AC hum, muffled conversations
          sample = this.generatePinkNoise(i) * 0.15;
          // AC hum (low frequency)
          sample += Math.sin(2 * Math.PI * 120 * i / sampleRate) * 0.1;
          // Occasional keyboard click
          if (Math.random() < 0.0008) {
            sample += Math.sin(2 * Math.PI * 3000 * i / sampleRate) * 0.3 * Math.exp(-((i % 200) / 20));
          }
          break;
      }
      
      // Apply volume and clamp
      sample *= volume;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(44 + i * 2, intSample, true);
    }
    
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Generate white noise sample
   */
  generateWhiteNoise() {
    return Math.random() * 2 - 1;
  }

  /**
   * Generate pink noise sample (1/f noise)
   */
  generatePinkNoise(i) {
    // Simple pink noise approximation using multiple octaves
    let sample = 0;
    for (let octave = 0; octave < 5; octave++) {
      const freq = Math.pow(2, octave);
      sample += Math.sin(i / freq + Math.random() * Math.PI) / freq;
    }
    return sample * 0.5 + (Math.random() * 2 - 1) * 0.3;
  }

  /**
   * Generate brown noise sample (1/f² noise)
   */
  generateBrownNoise(i) {
    // Brown noise - integrated white noise
    if (!this._brownNoiseState) {
      this._brownNoiseState = 0;
    }
    this._brownNoiseState += (Math.random() * 2 - 1) * 0.1;
    this._brownNoiseState *= 0.99; // Decay to prevent drift
    return this._brownNoiseState;
  }

  /**
   * Write string to DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Stop continuous background noise playback
   */
  async stopContinuousNoise() {
    try {
      if (this.noiseSound) {
        try {
          await this.noiseSound.stopAsync();
          await this.noiseSound.unloadAsync();
        } catch (e) {
          console.warn('Error stopping noise sound:', e);
        }
        this.noiseSound = null;
      }
      
      if (this.noiseInterval) {
        clearInterval(this.noiseInterval);
        this.noiseInterval = null;
      }
      
      this.isNoiseActive = false;
      this._brownNoiseState = 0; // Reset brown noise state
      
      // Remove continuous noise from active disruptions
      this.activeDisruptions = this.activeDisruptions.filter(
        disruption => disruption.type !== 'continuous_noise'
      );

      // Log disruption end
      this.logDisruption({
        type: 'continuous_noise_stop',
        timestamp: Date.now(),
        parameters: {},
        duration: 0
      });

      console.log('Continuous noise stopped');
    } catch (error) {
      console.error('Error stopping continuous noise:', error);
    }
  }

  /**
   * Set background noise level dynamically
   * @param {number} level - Noise level (0-1)
   */
  async setBackgroundNoiseLevel(level) {
    if (!this.config || !this.config.enabled) {
      return;
    }
    
    const normalizedLevel = Math.max(0, Math.min(1, level));
    this.config.intensity = normalizedLevel;
    
    // If continuous noise is active, update its volume
    if (this.isNoiseActive && this.noiseSound) {
      try {
        await this.noiseSound.setVolumeAsync(normalizedLevel);
        console.log(`Background noise volume updated to: ${(normalizedLevel * 100).toFixed(0)}%`);
      } catch (error) {
        console.warn('Failed to update noise volume:', error);
      }
    }
    
    console.log(`Background noise level set to: ${(normalizedLevel * 100).toFixed(0)}%`);
  }

  /**
   * Get currently active disruptions
   * @returns {Array} Array of active disruption objects
   */
  getActiveDisruptions() {
    // Clean up expired disruptions
    const currentTime = Date.now();
    this.activeDisruptions = this.activeDisruptions.filter(disruption => {
      if (disruption.duration === -1) return true; // Continuous disruptions
      return (currentTime - disruption.startTime) < disruption.duration;
    });

    return [...this.activeDisruptions];
  }

  /**
   * Get disruption log
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Array of disruption log entries
   */
  getDisruptionLog(limit = 100) {
    return this.disruptionLog.slice(-limit);
  }

  /**
   * Check if microphone is currently muted by chaos engine
   * @returns {boolean} True if mic is muted
   */
  isMicMuted() {
    return this.hardwareFailureState.micMuted;
  }

  /**
   * Check if connection is currently dropped by chaos engine
   * @returns {boolean} True if connection is dropped
   */
  isConnectionDropped() {
    return this.hardwareFailureState.connectionDropped;
  }

  /**
   * Check if continuous noise is active
   * @returns {boolean} True if noise is playing
   */
  isNoiseActive() {
    return this.isNoiseActive;
  }

  /**
   * Set callback functions for disruption events
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onVoiceVariation - Called when voice variation is applied
   * @param {Function} callbacks.onNoiseInjection - Called when noise is injected
   * @param {Function} callbacks.onHardwareFailure - Called when hardware failure occurs
   * @param {Function} callbacks.onDisruptionStart - Called when any disruption starts
   * @param {Function} callbacks.onDisruptionEnd - Called when any disruption ends
   */
  setCallbacks(callbacks) {
    this.disruptionCallbacks = { ...this.disruptionCallbacks, ...callbacks };
  }

  /**
   * Trigger random disruption based on configuration
   */
  triggerRandomDisruption() {
    if (!this.config.enabled) {
      return;
    }

    const enabledDisruptions = [];
    
    if (this.config.randomVoiceGen) enabledDisruptions.push('voice_variation');
    if (this.config.backgroundNoise) enabledDisruptions.push('background_noise');
    if (this.config.hardwareFailure) enabledDisruptions.push('hardware_failure');

    if (enabledDisruptions.length === 0) {
      return;
    }

    // Select random disruption type
    const disruptionType = enabledDisruptions[Math.floor(Math.random() * enabledDisruptions.length)];

    switch (disruptionType) {
      case 'voice_variation':
        // Voice variation is applied per audio chunk, so we just log it
        console.log('Random voice variation will be applied to next audio');
        break;
      case 'background_noise':
        if (!this.isNoiseActive) {
          this.startContinuousNoise();
          // Stop after random duration
          setTimeout(() => {
            this.stopContinuousNoise();
          }, this.generateRandomValue(5000, 15000));
        }
        break;
      case 'hardware_failure':
        this.simulateHardwareFailure('random', this.generateRandomValue(2000, 8000));
        break;
    }
  }

  /**
   * Start automatic random disruptions
   * @param {number} intervalMs - Interval between disruptions in milliseconds
   */
  startAutomaticDisruptions(intervalMs = null) {
    if (!this.config.enabled) {
      return;
    }

    const interval = intervalMs || (this.config.frequency * 1000);
    
    this.disruptionInterval = setInterval(() => {
      // Random chance to trigger disruption (based on intensity)
      if (Math.random() < this.config.intensity) {
        this.triggerRandomDisruption();
      }
    }, interval);

    console.log(`Automatic disruptions started with ${interval}ms interval`);
  }

  /**
   * Stop automatic random disruptions
   */
  stopAutomaticDisruptions() {
    if (this.disruptionInterval) {
      clearInterval(this.disruptionInterval);
      this.disruptionInterval = null;
      console.log('Automatic disruptions stopped');
    }
  }

  /**
   * Update chaos engine configuration
   * @param {Object} newConfig - New configuration parameters
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('ChaosEngine configuration updated:', this.config);
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Get chaos engine statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    // Return default stats if not initialized
    if (!this.config) {
      return {
        enabled: false,
        totalDisruptions: 0,
        activeDisruptions: 0,
        disruptionsByType: {},
        hardwareFailureState: { micMuted: false, connectionDropped: false, lastFailureTime: 0 },
        isNoiseActive: false,
        configuration: {
          enabled: false,
          randomVoiceGen: false,
          backgroundNoise: false,
          hardwareFailure: false,
          noiseType: 'office',
          intensity: 0.5,
          frequency: 30
        }
      };
    }

    const totalDisruptions = this.disruptionLog.length;
    const activeDisruptions = this.getActiveDisruptions().length;
    
    // Count disruptions by type
    const disruptionsByType = this.disruptionLog.reduce((acc, disruption) => {
      acc[disruption.type] = (acc[disruption.type] || 0) + 1;
      return acc;
    }, {});

    return {
      enabled: this.config.enabled,
      totalDisruptions,
      activeDisruptions,
      disruptionsByType,
      hardwareFailureState: { ...this.hardwareFailureState },
      isNoiseActive: this.isNoiseActive,
      configuration: { ...this.config }
    };
  }

  /**
   * Reset chaos engine state
   */
  reset() {
    // Stop all active disruptions
    this.stopAutomaticDisruptions();
    this.stopContinuousNoise();
    
    // Reset state
    this.activeDisruptions = [];
    this.disruptionLog = [];
    this.hardwareFailureState = {
      micMuted: false,
      connectionDropped: false,
      lastFailureTime: 0
    };
    this.isNoiseActive = false;

    console.log('ChaosEngine state reset');
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      this.reset();
      
      // Clear callbacks
      this.disruptionCallbacks = {
        onVoiceVariation: null,
        onNoiseInjection: null,
        onHardwareFailure: null,
        onDisruptionStart: null,
        onDisruptionEnd: null
      };

      console.log('ChaosEngine cleaned up');
    } catch (error) {
      console.error('Error during ChaosEngine cleanup:', error);
    }
  }

  // Private helper methods

  /**
   * Generate random value between min and max
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random value
   */
  generateRandomValue(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Log disruption event
   * @param {Object} disruption - Disruption object
   */
  logDisruption(disruption) {
    this.disruptionLog.push({
      ...disruption,
      id: `${disruption.type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    });

    // Limit log size
    if (this.disruptionLog.length > 1000) {
      this.disruptionLog = this.disruptionLog.slice(-500);
    }

    // Trigger callback
    if (this.disruptionCallbacks.onDisruptionStart) {
      this.disruptionCallbacks.onDisruptionStart(disruption);
    }
  }

  /**
   * Remove active disruption by ID
   * @param {string} disruptionId - Disruption ID to remove
   */
  removeActiveDisruption(disruptionId) {
    const index = this.activeDisruptions.findIndex(d => d.id === disruptionId);
    if (index !== -1) {
      const disruption = this.activeDisruptions[index];
      this.activeDisruptions.splice(index, 1);
      
      // Trigger callback
      if (this.disruptionCallbacks.onDisruptionEnd) {
        this.disruptionCallbacks.onDisruptionEnd(disruption);
      }
    }
  }

  /**
   * Simulate voice variation (placeholder implementation)
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {Object} params - Variation parameters
   * @returns {ArrayBuffer} Modified audio data
   */
  simulateVoiceVariation(audioData, params) {
    // In a real implementation, this would use audio processing libraries
    // to actually modify pitch and speed. For now, we return the original data
    // but log the intended modifications.
    
    console.log(`Simulating voice variation: pitch=${params.pitch}, speed=${params.speed}, intensity=${params.intensity}`);
    
    // Return original data for now
    return audioData;
  }

  /**
   * Simulate background noise injection (placeholder implementation)
   * @param {ArrayBuffer} audioData - Original audio data
   * @param {string} noiseType - Type of noise
   * @param {number} intensity - Noise intensity
   * @returns {ArrayBuffer} Audio with simulated noise
   */
  simulateBackgroundNoise(audioData, noiseType, intensity) {
    // In a real implementation, this would mix actual noise samples
    // with the audio data. For now, we return the original data
    // but log the intended noise injection.
    
    console.log(`Simulating background noise: ${noiseType} at ${intensity} intensity`);
    
    // Return original data for now
    return audioData;
  }
}

// Export singleton instance
export const chaosEngine = new ChaosEngine();
export default chaosEngine;