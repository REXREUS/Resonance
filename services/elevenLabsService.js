import * as SecureStore from 'expo-secure-store';
import { API_ENDPOINTS, API_CONFIG } from '../constants/api';
import { 
  globalErrorHandler, 
  ResonanceError, 
  ErrorCode, 
  ErrorCategory,
  createNetworkError 
} from '../utils/errorHandler';
import { networkService, withNetworkRetry } from './networkService';
import { offlineService } from './offlineService';

/**
 * ElevenLabs service for TTS and voice cloning
 * Handles WebSocket connection for real-time audio streaming
 */
class ElevenLabsService {
  constructor() {
    this.websocket = null;
    this.config = null;
    this.audioChunkCallback = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000;
    this.apiKey = null;
    this.currentVoiceId = null;
    this.streamStartTime = null;
  }

  /**
   * Validate API key by making a test request
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} - Whether the key is valid
   */
  async validateApiKey(apiKey) {
    try {
      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}${API_ENDPOINTS.ELEVENLABS.VOICES}`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('ElevenLabs API key validation failed:', error);
      return false;
    }
  }

  /**
   * Initialize the service with configuration
   * @param {Object} config - Service configuration
   * @param {string} config.apiKey - ElevenLabs API key
   * @param {string} config.voiceId - Default voice ID
   * @param {string} config.modelId - TTS model ID
   */
  async initialize(config = {}) {
    try {
      // Get API key from secure storage if not provided
      if (!config.apiKey) {
        this.apiKey = await SecureStore.getItemAsync('api_key_elevenlabs');
        if (!this.apiKey) {
          throw new Error('ElevenLabs API key not found in secure storage');
        }
      } else {
        this.apiKey = config.apiKey;
      }

      this.config = {
        voiceId: config.voiceId || 'default',
        modelId: config.modelId || API_CONFIG.ELEVENLABS.MODEL_ID,
        voiceSettings: { ...API_CONFIG.ELEVENLABS.VOICE_SETTINGS, ...config.voiceSettings },
      };

      console.log('ElevenLabsService initialized successfully');
      return true;
    } catch (error) {
      console.error('ElevenLabsService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Connect to ElevenLabs WebSocket for real-time TTS
   * @param {Object} options - Connection options
   * @param {string} options.voiceId - Voice ID to use
   * @param {string} options.modelId - Model ID to use
   */
  async connect(options = {}) {
    try {
      if (this.isConnected) {
        console.warn('WebSocket already connected');
        return;
      }

      const voiceId = options.voiceId || this.config.voiceId;
      const modelId = options.modelId || this.config.modelId;
      
      // Construct WebSocket URL with parameters
      const wsUrl = `${API_ENDPOINTS.ELEVENLABS.WEBSOCKET_URL}/${voiceId}/stream-input?model_id=${modelId}&optimize_streaming_latency=4&output_format=pcm_16000`;
      
      // Create WebSocket connection
      this.websocket = new WebSocket(wsUrl, [], {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      // Wait for connection to establish
      await this.waitForConnection();
      
      this.currentVoiceId = voiceId;
      console.log(`Connected to ElevenLabs WebSocket with voice: ${voiceId}`);
      
      return true;
    } catch (error) {
      console.error('Failed to connect to ElevenLabs WebSocket:', error);
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.websocket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('ElevenLabs WebSocket connected');
      
      // Send initial configuration
      this.sendConfiguration();
    };

    this.websocket.onmessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.websocket.onclose = (event) => {
      this.isConnected = false;
      this.isStreaming = false;
      console.log('ElevenLabs WebSocket closed:', event.code, event.reason);
      
      // Attempt reconnection if not intentional
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('ElevenLabs WebSocket error:', error);
      this.isConnected = false;
      this.isStreaming = false;
    };
  }

  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  handleWebSocketMessage(event) {
    try {
      if (typeof event.data === 'string') {
        // Handle JSON messages (metadata, errors, etc.)
        const message = JSON.parse(event.data);
        
        if (message.type === 'audio_stream_start') {
          this.streamStartTime = Date.now();
          console.log('Audio stream started');
        } else if (message.type === 'audio_stream_end') {
          const latency = Date.now() - this.streamStartTime;
          console.log(`Audio stream ended. Total latency: ${latency}ms`);
          this.isStreaming = false;
        } else if (message.type === 'error') {
          console.error('ElevenLabs stream error:', message.error);
        }
      } else {
        // Handle binary audio data
        if (this.audioChunkCallback && event.data instanceof ArrayBuffer) {
          this.audioChunkCallback(event.data);
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Send initial configuration to WebSocket
   */
  sendConfiguration() {
    if (!this.isConnected) return;

    const config = {
      type: 'configure',
      voice_settings: this.config.voiceSettings,
    };

    this.websocket.send(JSON.stringify(config));
  }

  /**
   * Wait for WebSocket connection to establish
   * @param {number} timeout - Connection timeout in ms
   */
  waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Attempt to reconnect WebSocket
   */
  async attemptReconnection() {
    this.reconnectAttempts++;
    console.log(`Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    
    try {
      await this.connect({ voiceId: this.currentVoiceId });
    } catch (error) {
      console.error('Reconnection failed:', error);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    }
  }

  /**
   * Send text for TTS conversion
   * @param {string} text - Text to convert to speech
   * @param {boolean} flush - Whether to flush the stream after sending
   */
  sendText(text, flush = false) {
    if (!this.isConnected) {
      console.error('WebSocket not connected');
      return false;
    }

    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for TTS');
      return false;
    }

    try {
      const message = {
        type: 'text',
        text: text.trim(),
        flush: flush,
      };

      this.websocket.send(JSON.stringify(message));
      this.isStreaming = true;
      
      console.log(`Sent text for TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      return true;
    } catch (error) {
      console.error('Failed to send text:', error);
      return false;
    }
  }

  /**
   * Stop current TTS playback and clear stream
   */
  stopSpeaking() {
    if (!this.isConnected) {
      console.warn('WebSocket not connected');
      return false;
    }

    try {
      const message = {
        type: 'flush',
      };

      this.websocket.send(JSON.stringify(message));
      this.isStreaming = false;
      
      console.log('TTS stream flushed');
      return true;
    } catch (error) {
      console.error('Failed to stop speaking:', error);
      return false;
    }
  }

  /**
   * Set callback for audio chunks
   * @param {Function} callback - Callback function (audioData) => void
   */
  onAudioChunk(callback) {
    this.audioChunkCallback = callback;
  }

  /**
   * Clone voice from audio sample
   * @param {ArrayBuffer|string} audioSample - Audio sample data or file path
   * @param {string} name - Name for the cloned voice
   * @param {string} description - Description of the voice
   * @returns {Promise<string>} Voice ID of cloned voice
   */
  async cloneVoice(audioSample, name, description = '') {
    try {
      if (!this.apiKey) {
        throw new Error('API key not available');
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      
      // Handle audio sample
      if (typeof audioSample === 'string') {
        // File URI - create file object for React Native
        const fileUri = audioSample;
        const fileName = fileUri.split('/').pop() || 'sample.wav';
        const fileType = fileName.endsWith('.mp3') ? 'audio/mpeg' : 
                         fileName.endsWith('.m4a') ? 'audio/mp4' :
                         fileName.endsWith('.ogg') ? 'audio/ogg' : 'audio/wav';
        
        // React Native FormData expects this format
        formData.append('files', {
          uri: fileUri,
          type: fileType,
          name: fileName,
        });
      } else if (audioSample instanceof ArrayBuffer) {
        // ArrayBuffer - convert to blob
        const blob = new Blob([audioSample], { type: 'audio/wav' });
        formData.append('files', blob, 'sample.wav');
      } else {
        throw new Error('Invalid audio sample format');
      }

      // Make API request
      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}${API_ENDPOINTS.ELEVENLABS.VOICE_CLONE}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail?.message || errorData.detail || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(`Voice cloning failed: ${errorMessage}`);
      }

      const result = await response.json();
      console.log(`Voice cloned successfully: ${name} (ID: ${result.voice_id})`);
      
      return result.voice_id;
    } catch (error) {
      console.error('Voice cloning failed:', error);
      throw error;
    }
  }

  /**
   * List available voices (system and cloned)
   * @returns {Promise<Array>} Array of voice objects
   */
  async listVoices() {
    try {
      if (!this.apiKey) {
        throw new Error('API key not available');
      }

      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}${API_ENDPOINTS.ELEVENLABS.VOICES}`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform voices to our format
      const voices = data.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        isCloned: voice.category === 'cloned',
        isSystem: voice.category === 'premade',
        stability: voice.settings?.stability || 0.75,
        similarity: voice.settings?.similarity_boost || 0.90,
        description: voice.description || '',
        previewUrl: voice.preview_url,
      }));

      console.log(`Retrieved ${voices.length} voices`);
      return voices;
    } catch (error) {
      console.error('Failed to list voices:', error);
      throw error;
    }
  }

  /**
   * Delete a cloned voice
   * @param {string} voiceId - ID of voice to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteVoice(voiceId) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not available');
      }

      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete voice: ${response.statusText}`);
      }

      console.log(`Voice deleted successfully: ${voiceId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete voice:', error);
      throw error;
    }
  }

  /**
   * Update voice settings
   * @param {string} voiceId - Voice ID
   * @param {Object} settings - Voice settings
   * @param {number} settings.stability - Stability (0-1)
   * @param {number} settings.similarity - Similarity boost (0-1)
   * @returns {Promise<boolean>} Success status
   */
  async updateVoiceSettings(voiceId, settings) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not available');
      }

      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}/voices/${voiceId}/settings`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Failed to update voice settings: ${response.statusText}`);
      }

      console.log(`Voice settings updated for: ${voiceId}`);
      return true;
    } catch (error) {
      console.error('Failed to update voice settings:', error);
      throw error;
    }
  }

  /**
   * Test TTS with given text and voice
   * @param {string} text - Text to test
   * @param {string} voiceId - Voice ID to use
   * @param {Object} settings - Voice settings override
   * @returns {Promise<ArrayBuffer>} Audio data
   */
  async testTTS(text, voiceId, settings = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not available');
      }

      const voiceSettings = { ...this.config.voiceSettings, ...settings };

      const response = await fetch(`${API_ENDPOINTS.ELEVENLABS.BASE_URL}${API_ENDPOINTS.ELEVENLABS.TTS}/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: this.config.modelId,
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS test failed: ${response.statusText}`);
      }

      const audioData = await response.arrayBuffer();
      console.log(`TTS test completed for voice: ${voiceId}`);
      
      return audioData;
    } catch (error) {
      console.error('TTS test failed:', error);
      throw error;
    }
  }

  /**
   * Get current streaming latency
   * @returns {number} Latency in milliseconds
   */
  getCurrentLatency() {
    if (!this.streamStartTime) return 0;
    return Date.now() - this.streamStartTime;
  }

  /**
   * Check if service is connected
   * @returns {boolean} Connection status
   */
  isServiceConnected() {
    return this.isConnected;
  }

  /**
   * Check if currently streaming
   * @returns {boolean} Streaming status
   */
  isCurrentlyStreaming() {
    return this.isStreaming;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close(1000, 'Intentional disconnect');
      this.websocket = null;
    }
    
    this.isConnected = false;
    this.isStreaming = false;
    this.currentVoiceId = null;
    this.streamStartTime = null;
    
    console.log('ElevenLabs WebSocket disconnected');
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      this.disconnect();
      this.audioChunkCallback = null;
      this.reconnectAttempts = 0;
      
      console.log('ElevenLabsService cleaned up');
    } catch (error) {
      console.error('Error during ElevenLabsService cleanup:', error);
    }
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;