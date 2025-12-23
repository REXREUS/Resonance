import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { AUDIO_CONFIG } from '../constants/audio';
import { databaseService } from './databaseService';
import {
  ResonanceError,
  ErrorCode,
  ErrorCategory,
  createAudioError,
} from '../utils/errorHandler';

// Safely import LiveAudioStream - may be null in Expo Go
let LiveAudioStream = null;
try {
  LiveAudioStream = require('react-native-live-audio-stream');
} catch (e) {
  console.warn('react-native-live-audio-stream not available, using fallback mode');
}

/**
 * AudioEngine class for managing audio operations
 * Handles real-time audio input/output, recording, and playback
 */
class AudioEngine {
  constructor() {
    this.config = null;
    this.isRecording = false;
    this.isPlaying = false;
    this.currentAmplitude = 0;
    this.audioChunkCallback = null;
    this.sound = null;
    this.recording = null;
    this.useFallbackMode = !LiveAudioStream;
    this.fallbackInterval = null;
    
    // Audio stream configuration
    this.streamConfig = {
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      channels: AUDIO_CONFIG.CHANNELS,
      bitsPerSample: AUDIO_CONFIG.BITS_PER_SAMPLE,
      audioSource: 6, // VOICE_RECOGNITION
      bufferSize: AUDIO_CONFIG.BUFFER_SIZE,
    };
  }

  /**
   * Initialize the audio engine with configuration
   * @param {Object} config - Audio configuration
   * @param {number} config.sampleRate - Sample rate in Hz
   * @param {number} config.channels - Number of audio channels
   * @param {number} config.bitsPerSample - Bits per sample
   * @param {string} config.vadSensitivity - VAD sensitivity level
   */
  async initialize(config = {}) {
    try {
      this.config = { ...AUDIO_CONFIG, ...config };
      
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new ResonanceError(
          ErrorCode.AUDIO_PERMISSION_DENIED,
          'Audio permission not granted',
          ErrorCategory.PERMISSION,
          false,
          'Microphone permission is required for voice training. Please enable it in your device settings.'
        );
      }
      
      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      
      // Initialize live audio stream if available
      if (LiveAudioStream) {
        try {
          LiveAudioStream.init({
            sampleRate: this.config.SAMPLE_RATE,
            channels: this.config.CHANNELS,
            bitsPerSample: this.config.BITS_PER_SAMPLE,
            audioSource: 6, // VOICE_RECOGNITION
            bufferSize: this.config.BUFFER_SIZE,
          });
          
          // Set up audio data listener
          LiveAudioStream.on('data', this.handleAudioData.bind(this));
          this.useFallbackMode = false;
        } catch (streamError) {
          console.warn('LiveAudioStream init failed, using fallback mode:', streamError.message);
          this.useFallbackMode = true;
        }
      } else {
        console.warn('LiveAudioStream not available, using fallback mode');
        this.useFallbackMode = true;
      }
      
      console.log(`AudioEngine initialized successfully (fallback mode: ${this.useFallbackMode})`);
      return true;
    } catch (error) {
      console.error('AudioEngine initialization failed:', error);
      
      if (error instanceof ResonanceError) {
        throw error;
      }
      
      throw createAudioError(
        `AudioEngine initialization failed: ${error.message}`,
        'Failed to initialize audio system. Please restart the app and try again.'
      );
    }
  }

  /**
   * Handle incoming audio data from live stream
   * @param {string} data - Base64 encoded audio data
   */
  handleAudioData(data) {
    try {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Calculate amplitude (RMS)
      const audioData = new Int16Array(bytes.buffer);
      this.currentAmplitude = this.calculateRMS(audioData);
      
      // Call audio chunk callback if set
      if (this.audioChunkCallback) {
        this.audioChunkCallback(audioData, this.currentAmplitude);
      }
    } catch (error) {
      console.error('Error handling audio data:', error);
    }
  }

  /**
   * Calculate RMS (Root Mean Square) amplitude
   * @param {Int16Array} audioData - Audio data array
   * @returns {number} RMS amplitude value
   */
  calculateRMS(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    
    // Normalize to 0-1 range (assuming 16-bit audio)
    return Math.min(rms / 32768, 1.0);
  }

  /**
   * Start audio recording and streaming
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('Recording already in progress');
        return true;
      }
      
      if (this.useFallbackMode) {
        // Fallback mode: simulate audio with random amplitude
        this.isRecording = true;
        this.fallbackInterval = setInterval(() => {
          // Generate simulated amplitude (random noise pattern)
          this.currentAmplitude = Math.random() * 0.3;
          if (this.audioChunkCallback) {
            // Create dummy audio data
            const dummyData = new Int16Array(1024);
            this.audioChunkCallback(dummyData, this.currentAmplitude);
          }
        }, 100);
        console.log('Audio recording started (fallback mode)');
        return true;
      }
      
      // Start live audio stream
      if (LiveAudioStream) {
        LiveAudioStream.start();
      }
      this.isRecording = true;
      
      console.log('Audio recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop audio recording and streaming
   */
  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('No recording in progress');
        return true;
      }
      
      if (this.useFallbackMode) {
        // Clear fallback interval
        if (this.fallbackInterval) {
          clearInterval(this.fallbackInterval);
          this.fallbackInterval = null;
        }
      } else if (LiveAudioStream) {
        // Stop live audio stream
        LiveAudioStream.stop();
      }
      
      this.isRecording = false;
      this.currentAmplitude = 0;
      
      console.log('Audio recording stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Play audio from ArrayBuffer or URI
   * @param {ArrayBuffer|string} audioData - Audio data or URI
   * @returns {Promise<void>} Resolves when playback completes
   */
  async playAudio(audioData) {
    return new Promise(async (resolve, reject) => {
      try {
        // Stop current playback if any
        if (this.sound) {
          await this.sound.unloadAsync();
        }
        
        let uri;
        if (typeof audioData === 'string') {
          uri = audioData;
        } else {
          // Convert ArrayBuffer to base64 data URI
          const base64 = this.arrayBufferToBase64(audioData);
          uri = `data:audio/mp3;base64,${base64}`;
        }
        
        // Create and load sound
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, isLooping: false }
        );
        
        this.sound = sound;
        this.isPlaying = true;
        
        // Set up playback status listener to detect completion
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            this.isPlaying = false;
            console.log('Audio playback finished (didJustFinish)');
            resolve();
          } else if (status.isLoaded === false && status.error) {
            this.isPlaying = false;
            console.error('Audio playback error:', status.error);
            resolve(); // Resolve anyway to not block
          }
        });
        
        console.log('Audio playback started');
      } catch (error) {
        console.error('Failed to play audio:', error);
        this.isPlaying = false;
        resolve(); // Resolve anyway to not block the flow
      }
    });
  }

  /**
   * Stop current audio playback
   */
  async stopPlayback() {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        this.isPlaying = false;
        console.log('Audio playback stopped');
      }
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  }

  /**
   * Trigger barge-in interrupt with haptic feedback (if enabled)
   */
  async triggerBargeIn() {
    try {
      // Stop current playback immediately
      await this.stopPlayback();

      // Check if haptic feedback is enabled in settings
      let hapticEnabled = true;
      try {
        const settings = await databaseService.getAppSettings();
        hapticEnabled = settings?.haptic_enabled === 1;
      } catch (e) {
        // Default to enabled if can't read settings
      }

      // Provide haptic feedback only if enabled
      if (hapticEnabled) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      console.log('Barge-in triggered', hapticEnabled ? 'with haptic feedback' : '');
      return true;
    } catch (error) {
      console.error('Failed to trigger barge-in:', error);
      throw error;
    }
  }

  /**
   * Get current audio amplitude
   * @returns {number} Current amplitude (0-1)
   */
  getAmplitude() {
    return this.currentAmplitude;
  }

  /**
   * Set callback for audio chunk processing
   * @param {Function} callback - Callback function (audioData, amplitude) => void
   */
  setAudioChunkCallback(callback) {
    this.audioChunkCallback = callback;
  }

  /**
   * Calibrate noise floor by sampling ambient noise
   * @param {number} durationMs - Calibration duration in milliseconds
   * @returns {Promise<number>} Noise floor level
   */
  async calibrateNoiseFloor(durationMs = AUDIO_CONFIG.NOISE_FLOOR_CALIBRATION_MS) {
    return new Promise((resolve, reject) => {
      try {
        const samples = [];
        const startTime = Date.now();
        let resolved = false;
        
        // Temporary callback to collect samples
        const calibrationCallback = (audioData, amplitude) => {
          if (resolved) return;
          
          samples.push(amplitude);
          
          // Check if calibration period is complete
          if (Date.now() - startTime >= durationMs) {
            resolved = true;
            
            // Remove calibration callback
            this.audioChunkCallback = null;
            
            // Stop recording after calibration
            this.stopRecording().catch(console.warn);
            
            // Calculate noise floor (average of samples)
            const noiseFloor = samples.length > 0 
              ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length
              : 0.1; // Default fallback
            
            console.log(`Noise floor calibrated: ${noiseFloor} (${samples.length} samples)`);
            resolve(noiseFloor);
          }
        };
        
        // Set calibration callback
        this.setAudioChunkCallback(calibrationCallback);
        
        // Start recording for calibration
        this.startRecording().catch((err) => {
          if (!resolved) {
            resolved = true;
            console.warn('Calibration recording failed, using default:', err.message);
            resolve(0.1); // Default noise floor
          }
        });
        
        // Timeout fallback - resolve with default instead of rejecting
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.audioChunkCallback = null;
            this.stopRecording().catch(console.warn);
            
            const noiseFloor = samples.length > 0 
              ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length
              : 0.1;
            
            console.warn(`Calibration timeout, using ${samples.length > 0 ? 'partial' : 'default'} noise floor: ${noiseFloor}`);
            resolve(noiseFloor);
          }
        }, durationMs + 1000);
        
      } catch (error) {
        console.warn('Calibration error, using default noise floor:', error.message);
        resolve(0.1); // Default noise floor instead of rejecting
      }
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param {ArrayBuffer} buffer - Audio buffer
   * @returns {string} Base64 encoded string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get current recording status
   * @returns {boolean} True if recording is active
   */
  isRecordingActive() {
    return this.isRecording;
  }

  /**
   * Get current playback status
   * @returns {boolean} True if audio is playing
   */
  isPlaybackActive() {
    return this.isPlaying;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Stop recording if active
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      // Stop playback if active
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      
      // Remove listeners
      if (LiveAudioStream) {
        try {
          LiveAudioStream.removeAllListeners();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Clear fallback interval
      if (this.fallbackInterval) {
        clearInterval(this.fallbackInterval);
        this.fallbackInterval = null;
      }
      
      this.audioChunkCallback = null;
      this.currentAmplitude = 0;
      
      console.log('AudioEngine cleaned up');
    } catch (error) {
      console.error('Error during AudioEngine cleanup:', error);
    }
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();
export default audioEngine;